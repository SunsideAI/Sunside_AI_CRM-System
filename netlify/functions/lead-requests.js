// Lead-Anfragen API
// GET: Anfragen laden (Admin: alle, Vertriebler: eigene)
// POST: Neue Anfrage erstellen
// PATCH: Anfrage bearbeiten (genehmigen/ablehnen)

import { fetchWithRetry } from './utils/airtable.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
}

// Anfrage-ID generieren (Timestamp-basiert)
function generateAnfrageId() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const mins = String(now.getMinutes()).padStart(2, '0')
  const secs = String(now.getSeconds()).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  return `ANF-${year}${month}${day}-${hours}${mins}${secs}-${ms}`
}

export async function handler(event) {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
  const TABLE_NAME = 'Lead_Anfragen'
  const USER_TABLE = 'User_Datenbank'
  
  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`
  const USER_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(USER_TABLE)}`
  
  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  try {
    // GET - Anfragen laden
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const userId = params.userId
      const status = params.status // Optional: "Offen", "Genehmigt", etc.
      const isAdmin = params.isAdmin === 'true'

      console.log('GET Anfragen - isAdmin:', isAdmin, 'userId:', userId, 'status:', status)

      // Alle Anfragen laden, dann im Code filtern (robuster für Link-Felder)
      let url = `${TABLE_URL}?sort[0][field]=Erstellt_am&sort[0][direction]=desc`
      
      // Nur Status-Filter in Airtable (einfacher und zuverlässiger)
      if (status && status !== 'all') {
        url += `&filterByFormula=${encodeURIComponent(`{Status}="${status}"`)}`
      }

      const response = await fetchWithRetry(url, { headers: airtableHeaders })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Fehler beim Laden der Anfragen')
      }

      const data = await response.json()

      const anfragen = await Promise.all(data.records.map(async (record) => {
        // User-Namen nachladen wenn nötig
        let userName = 'Unbekannt'
        let bearbeitetVonName = ''
        
        const userId = record.fields.User?.[0]
        if (userId) {
          try {
            const userRes = await fetchWithRetry(`${USER_URL}/${userId}`, { headers: airtableHeaders })
            if (userRes.ok) {
              const userData = await userRes.json()
              userName = userData.fields?.Vor_Nachname || 'Unbekannt'
            }
          } catch (e) {
            console.error('User laden fehlgeschlagen:', e)
          }
        }
        
        const bearbeitetVonId = record.fields.Bearbeitet_von?.[0]
        if (bearbeitetVonId) {
          try {
            const adminRes = await fetchWithRetry(`${USER_URL}/${bearbeitetVonId}`, { headers: airtableHeaders })
            if (adminRes.ok) {
              const adminData = await adminRes.json()
              bearbeitetVonName = adminData.fields?.Vor_Nachname || ''
            }
          } catch (e) {
            console.error('Admin laden fehlgeschlagen:', e)
          }
        }
        
        return {
          id: record.id,
          anfrageId: record.fields.Anfrage_ID || '',
          userId: userId || null,
          userName: userName,
          anzahl: record.fields.Anzahl || 0,
          nachricht: record.fields.Nachricht || '',
          status: record.fields.Status || 'Offen',
          erstelltAm: record.fields.Erstellt_am || null,
          bearbeitetVonId: bearbeitetVonId || null,
          bearbeitetVonName: bearbeitetVonName,
          bearbeitetAm: record.fields.Bearbeitet_am || null,
          genehmigteAnzahl: record.fields.Genehmigte_Anzahl || null,
          adminKommentar: record.fields.Admin_Kommentar || ''
        }
      }))

      // Für Vertriebler: Nur eigene Anfragen filtern
      let filteredAnfragen = anfragen
      if (!isAdmin && userId) {
        filteredAnfragen = anfragen.filter(a => a.userId === userId)
        console.log(`Gefiltert: ${anfragen.length} → ${filteredAnfragen.length} Anfragen für User ${userId}`)
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ anfragen: filteredAnfragen })
      }
    }

    // POST - Neue Anfrage erstellen
    if (event.httpMethod === 'POST') {
      const { userId, anzahl, nachricht } = JSON.parse(event.body)

      if (!userId || !anzahl) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'User und Anzahl sind erforderlich' })
        }
      }

      // Prüfen ob bereits eine offene Anfrage existiert
      const checkFormula = `AND(FIND("${userId}", ARRAYJOIN({User})), {Status}="Offen")`
      const checkUrl = `${TABLE_URL}?filterByFormula=${encodeURIComponent(checkFormula)}`
      const checkResponse = await fetchWithRetry(checkUrl, { headers: airtableHeaders })
      const checkData = await checkResponse.json()

      if (checkData.records && checkData.records.length > 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Du hast bereits eine offene Anfrage' })
        }
      }

      // Neue Anfrage erstellen
      const anfrageId = generateAnfrageId()
      const now = new Date().toISOString()

      const response = await fetchWithRetry(TABLE_URL, {
        method: 'POST',
        headers: airtableHeaders,
        body: JSON.stringify({
          fields: {
            'Anfrage_ID': anfrageId,
            'User': [userId],
            'Anzahl': parseInt(anzahl, 10),
            'Nachricht': nachricht || null,
            'Status': 'Offen',
            'Erstellt_am': now
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Anfrage konnte nicht erstellt werden')
      }

      const result = await response.json()

      // E-Mail an Admins senden
      try {
        await sendAdminNotification(userId, anzahl, nachricht, anfrageId, USER_URL, airtableHeaders)
      } catch (emailError) {
        console.error('E-Mail Fehler:', emailError)
        // Anfrage trotzdem erfolgreich, nur E-Mail fehlgeschlagen
      }

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          anfrage: {
            id: result.id,
            anfrageId: anfrageId
          }
        })
      }
    }

    // PATCH - Anfrage bearbeiten (Admin)
    if (event.httpMethod === 'PATCH') {
      const { anfrageId, status, genehmigteAnzahl, adminKommentar, adminId } = JSON.parse(event.body)

      if (!anfrageId || !status) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Anfrage-ID und Status sind erforderlich' })
        }
      }

      const now = new Date().toISOString()

      const fields = {
        'Status': status,
        'Bearbeitet_am': now
      }

      if (adminId) {
        // Linked Record Feld - muss als Array gesendet werden
        fields['Bearbeitet_von'] = [adminId]
      }

      if (genehmigteAnzahl !== undefined && genehmigteAnzahl !== null) {
        fields['Genehmigte_Anzahl'] = parseInt(genehmigteAnzahl, 10)
      }

      if (adminKommentar) {
        fields['Admin_Kommentar'] = adminKommentar
      }

      const response = await fetchWithRetry(`${TABLE_URL}/${anfrageId}`, {
        method: 'PATCH',
        headers: airtableHeaders,
        body: JSON.stringify({ fields })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Anfrage konnte nicht aktualisiert werden')
      }

      const result = await response.json()

      // Nach Genehmigung: Leads automatisch zuweisen
      let zugewieseneLeads = 0
      if (status === 'Genehmigt' || status === 'Teilweise_Genehmigt') {
        const anzahlZuweisen = genehmigteAnzahl || 0
        
        // User-ID aus der Anfrage holen
        const userId = result.fields.User?.[0]
        
        if (userId && anzahlZuweisen > 0) {
          try {
            zugewieseneLeads = await assignLeadsToUser(
              userId, 
              anzahlZuweisen, 
              AIRTABLE_BASE_ID, 
              airtableHeaders
            )
            console.log(`${zugewieseneLeads} Leads zugewiesen`)
          } catch (assignError) {
            console.error('Fehler bei Lead-Zuweisung:', assignError.message)
          }
        }
      }

      // E-Mail an den Anfragenden senden
      try {
        const anfragenderId = result.fields.User?.[0]
        if (anfragenderId) {
          await sendUserNotification(
            anfragenderId,
            status,
            genehmigteAnzahl || result.fields.Anzahl,
            result.fields.Anzahl,
            adminKommentar,
            zugewieseneLeads,
            USER_URL,
            airtableHeaders
          )
        }
      } catch (emailError) {
        console.error('Fehler beim Senden der User-Benachrichtigung:', emailError.message)
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          anfrage: {
            id: result.id,
            status: result.fields.Status
          },
          zugewieseneLeads
        })
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Lead-Requests Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}

// E-Mail an alle Admins senden (nur geschäftliche E-Mail)
async function sendAdminNotification(userId, anzahl, nachricht, anfrageId, userUrl, airtableHeaders) {
  // Admins aus User_Datenbank laden - NUR geschäftliche E-Mail
  const adminFilter = `FIND("Admin", ARRAYJOIN({Rolle}, ","))`
  const adminResponse = await fetchWithRetry(
    `${userUrl}?filterByFormula=${encodeURIComponent(adminFilter)}&fields[]=E-Mail_Geschäftlich&fields[]=Vor_Nachname`,
    { headers: airtableHeaders }
  )
  
  if (!adminResponse.ok) {
    throw new Error('Konnte Admins nicht laden')
  }

  const adminData = await adminResponse.json()
  const adminEmails = adminData.records
    .map(r => r.fields['E-Mail_Geschäftlich'])
    .filter(Boolean)

  if (adminEmails.length === 0) {
    console.log('Keine geschäftlichen Admin-E-Mails gefunden')
    return
  }

  // User-Name laden
  const userResponse = await fetchWithRetry(`${userUrl}/${userId}`, { headers: airtableHeaders })
  const userData = await userResponse.json()
  const userName = userData.fields?.Vor_Nachname || 'Unbekannt'

  // E-Mail via Resend senden (falls konfiguriert)
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY nicht konfiguriert - E-Mail wird übersprungen')
    console.log('Anfrage von:', userName, '| Anzahl:', anzahl)
    return
  }

  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #7C3AED 100%); padding: 40px; text-align: center;">
        <h1 style="color: white; margin: 0;">Sunside CRM</h1>
      </div>
      <div style="padding: 40px; background: #ffffff;">
        <h2 style="color: #1a1a2e; margin-top: 0;">🙋 Neue Lead-Anfrage</h2>
        <p style="color: #4a5568; line-height: 1.6;">
          Ein Vertriebler hat neue Leads angefordert und wartet auf deine Genehmigung.
        </p>
        
        <div style="background: #f7f7f7; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #718096; font-size: 14px;">Vertriebler:</td>
              <td style="padding: 8px 0; color: #1a1a2e; font-weight: bold; text-align: right;">${userName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #718096; font-size: 14px;">Anzahl Leads:</td>
              <td style="padding: 8px 0; color: #7C3AED; font-weight: bold; font-size: 18px; text-align: right;">${anzahl}</td>
            </tr>
            ${nachricht ? `
            <tr>
              <td style="padding: 8px 0; color: #718096; font-size: 14px; vertical-align: top;">Nachricht:</td>
              <td style="padding: 8px 0; color: #4a5568; text-align: right;">${nachricht}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; color: #718096; font-size: 14px;">Anfrage-ID:</td>
              <td style="padding: 8px 0; color: #a0aec0; font-size: 12px; text-align: right;">${anfrageId}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin-top: 32px;">
          <a href="https://crmsunsideai.netlify.app/einstellungen?tab=anfragen" 
             style="display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #9333EA 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Jetzt bearbeiten →
          </a>
        </div>
        
        <p style="color: #718096; font-size: 14px; margin-top: 32px; text-align: center;">
          Du erhältst diese E-Mail, weil du Admin im Sunside CRM bist.
        </p>
      </div>
      <div style="background: #f7f7f7; padding: 20px; text-align: center;">
        <p style="color: #a0aec0; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Sunside AI
        </p>
      </div>
    </div>
  `

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Sunside CRM <noreply@sunsideai.de>',
      to: adminEmails,
      subject: `🙋 Neue Lead-Anfrage von ${userName} (${anzahl} Leads)`,
      html: emailBody
    })
  })

  if (!emailResponse.ok) {
    const error = await emailResponse.json()
    throw new Error(error.message || 'E-Mail konnte nicht gesendet werden')
  }

  console.log('Admin-Benachrichtigung gesendet an:', adminEmails.join(', '))
}

// Leads einem User zuweisen
async function assignLeadsToUser(userId, anzahl, baseId, airtableHeaders) {
  // Direkt aus Umgebungsvariable, genau wie in leads.js
  const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID
  // Table ID statt Name (aus Airtable URL)
  const LEADS_TABLE_ID = 'tblFRrrCPoT3t8FpC'
  const LEADS_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${LEADS_TABLE_ID}`
  
  console.log('Lead-Zuweisung: User', userId, '| Anzahl:', anzahl)
  
  // Nur Leads wo:
  // 1. User_Datenbank leer ist (nicht zugewiesen)
  // 2. Bereits_kontaktiert NICHT 'X' ist (nicht kontaktiert)
  // 3. Ergebnis ist NICHT 'Ungültiger Lead' (diese sollen nie wieder vergeben werden)
  const filterFormula = `AND({User_Datenbank}=BLANK(), OR({Bereits_kontaktiert}=BLANK(), {Bereits_kontaktiert}=''), {Ergebnis}!='Ungültiger Lead')`
  
  let url = `${LEADS_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=${anzahl}`
  
  const response = await fetchWithRetry(url, { headers: airtableHeaders })
  
  if (!response.ok) {
    const error = await response.json()
    console.error('Airtable API Fehler:', JSON.stringify(error))
    throw new Error(error.error?.message || 'Fehler beim Laden der freien Leads')
  }
  
  const data = await response.json()
  const freieLeads = data.records || []
  
  if (freieLeads.length === 0) {
    console.log('Keine freien Leads verfügbar')
    return 0
  }
  
  console.log(`${freieLeads.length} freie Leads gefunden, weise zu...`)
  
  // Leads in Batches von max 10 zuweisen (Airtable Limit)
  const batchSize = 10
  let zugewiesen = 0
  
  for (let i = 0; i < freieLeads.length; i += batchSize) {
    const batch = freieLeads.slice(i, i + batchSize)
    
    const records = batch.map(lead => ({
      id: lead.id,
      fields: {
        'User_Datenbank': [userId]
      }
    }))
    
    const updateResponse = await fetchWithRetry(LEADS_URL, {
      method: 'PATCH',
      headers: airtableHeaders,
      body: JSON.stringify({ records })
    })
    
    if (updateResponse.ok) {
      zugewiesen += batch.length
    } else {
      const error = await updateResponse.json()
      console.error('Batch-Update Fehler:', error)
    }
  }
  
  return zugewiesen
}

// E-Mail an den Anfragenden senden
async function sendUserNotification(userId, status, genehmigteAnzahl, angefragt, adminKommentar, zugewieseneLeads, userUrl, airtableHeaders) {
  // User-Daten laden
  const userResponse = await fetchWithRetry(`${userUrl}/${userId}`, { headers: airtableHeaders })
  
  if (!userResponse.ok) {
    throw new Error('Konnte User-Daten nicht laden')
  }
  
  const userData = await userResponse.json()
  const userName = userData.fields?.Vor_Nachname || userData.fields?.Vorname || 'Vertriebler'
  const userEmail = userData.fields?.['E-Mail_Geschäftlich'] || userData.fields?.['E-Mail']
  
  if (!userEmail) {
    console.log('Keine E-Mail-Adresse für User gefunden')
    return
  }
  
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY nicht konfiguriert')
    return
  }
  
  // Status-spezifische Inhalte
  let statusTitle, statusColor, statusIcon, mainMessage
  
  if (status === 'Genehmigt') {
    statusTitle = 'Genehmigt ✓'
    statusColor = '#10B981' // green
    statusIcon = '✅'
    mainMessage = `Deine Anfrage über ${angefragt} Leads wurde genehmigt. ${zugewieseneLeads > 0 ? `${zugewieseneLeads} Leads wurden dir zugewiesen.` : ''}`
  } else if (status === 'Teilweise_Genehmigt') {
    statusTitle = 'Teilweise Genehmigt'
    statusColor = '#F59E0B' // amber
    statusIcon = '⚠️'
    mainMessage = `Deine Anfrage wurde teilweise genehmigt. ${genehmigteAnzahl} von ${angefragt} Leads wurden dir zugewiesen.`
  } else if (status === 'Abgelehnt') {
    statusTitle = 'Abgelehnt'
    statusColor = '#EF4444' // red
    statusIcon = '❌'
    mainMessage = `Deine Anfrage über ${angefragt} Leads wurde leider abgelehnt.`
  } else {
    return // Unbekannter Status
  }
  
  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #7C3AED 100%); padding: 40px; text-align: center;">
        <h1 style="color: white; margin: 0;">Sunside CRM</h1>
      </div>
      <div style="padding: 40px; background: #ffffff;">
        <h2 style="color: #1a1a2e; margin-top: 0;">Hallo ${userName}!</h2>
        <p style="color: #4a5568; line-height: 1.6;">
          Deine Lead-Anfrage wurde bearbeitet.
        </p>
        
        <div style="background: #f7f7f7; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid ${statusColor};">
          <div style="display: flex; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 24px; margin-right: 12px;">${statusIcon}</span>
            <span style="color: ${statusColor}; font-weight: bold; font-size: 18px;">${statusTitle}</span>
          </div>
          <p style="color: #4a5568; margin: 0;">${mainMessage}</p>
        </div>
        
        ${adminKommentar ? `
        <div style="background: #EEF2FF; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="color: #6366F1; font-weight: bold; margin: 0 0 8px 0; font-size: 14px;">💬 Kommentar vom Admin:</p>
          <p style="color: #4a5568; margin: 0;">${adminKommentar}</p>
        </div>
        ` : ''}
        
        <div style="text-align: center; margin-top: 32px;">
          <a href="https://crmsunsideai.netlify.app/kaltakquise" 
             style="display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #9333EA 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Zum CRM →
          </a>
        </div>
        
        <p style="color: #718096; font-size: 14px; margin-top: 32px; text-align: center;">
          Bei Fragen wende dich an deinen Admin.
        </p>
      </div>
      <div style="background: #f7f7f7; padding: 20px; text-align: center;">
        <p style="color: #a0aec0; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Sunside AI
        </p>
      </div>
    </div>
  `
  
  const subject = status === 'Genehmigt' 
    ? `✅ Deine Lead-Anfrage wurde genehmigt (${zugewieseneLeads} Leads)`
    : status === 'Teilweise_Genehmigt'
      ? `⚠️ Deine Lead-Anfrage wurde teilweise genehmigt (${genehmigteAnzahl}/${angefragt})`
      : `❌ Deine Lead-Anfrage wurde abgelehnt`
  
  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Sunside CRM <noreply@sunsideai.de>',
      to: [userEmail],
      subject: subject,
      html: emailBody
    })
  })
  
  if (!emailResponse.ok) {
    const error = await emailResponse.json()
    throw new Error(error.message || 'E-Mail konnte nicht gesendet werden')
  }
  
  console.log('User-Benachrichtigung gesendet an:', userEmail)
}
