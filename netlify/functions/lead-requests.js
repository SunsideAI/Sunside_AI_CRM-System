// Lead-Anfragen API
// GET: Anfragen laden (Admin: alle, Vertriebler: eigene)
// POST: Neue Anfrage erstellen
// PATCH: Anfrage bearbeiten (genehmigen/ablehnen)

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

exports.handler = async (event) => {
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

      let filterFormula = ''
      const filters = []

      // Vertriebler sehen nur eigene Anfragen (Filter über Record ID)
      if (!isAdmin && userId) {
        filters.push(`FIND("${userId}", ARRAYJOIN({User}))`)
      }

      // Optional: Nach Status filtern
      if (status && status !== 'all') {
        filters.push(`{Status}="${status}"`)
      }

      if (filters.length > 0) {
        filterFormula = `AND(${filters.join(',')})`
      }

      let url = `${TABLE_URL}?sort[0][field]=Erstellt_am&sort[0][direction]=desc`
      if (filterFormula) {
        url += `&filterByFormula=${encodeURIComponent(filterFormula)}`
      }

      const response = await fetch(url, { headers: airtableHeaders })
      
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
            const userRes = await fetch(`${USER_URL}/${userId}`, { headers: airtableHeaders })
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
            const adminRes = await fetch(`${USER_URL}/${bearbeitetVonId}`, { headers: airtableHeaders })
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

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ anfragen })
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
      const checkResponse = await fetch(checkUrl, { headers: airtableHeaders })
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

      const response = await fetch(TABLE_URL, {
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

      const response = await fetch(`${TABLE_URL}/${anfrageId}`, {
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
            console.log(`${zugewieseneLeads} Leads an User ${userId} zugewiesen`)
          } catch (assignError) {
            console.error('Fehler bei Lead-Zuweisung:', assignError)
            // Anfrage trotzdem als erfolgreich markieren
          }
        }
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
  const adminResponse = await fetch(
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
  const userResponse = await fetch(`${userUrl}/${userId}`, { headers: airtableHeaders })
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
  const LEADS_TABLE = 'Leads_Datenbank'
  const LEADS_URL = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(LEADS_TABLE)}`
  
  // Freie Leads finden: User_Datenbank ist leer UND nicht kontaktiert
  // Für leeres Link-Feld: beide Möglichkeiten prüfen
  // Für nicht kontaktiert: Feld ist leer oder BLANK (nicht 'X')
  const filterFormula = `AND(OR(ARRAYJOIN({User_Datenbank})='', ARRAYJOIN({User_Datenbank})=BLANK()), OR({Bereits_kontaktiert}='', {Bereits_kontaktiert}=BLANK()))`
  
  console.log('Suche freie Leads...')
  
  let url = `${LEADS_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=${anzahl}&fields[]=Unternehmensname`
  
  const response = await fetch(url, { headers: airtableHeaders })
  
  if (!response.ok) {
    const error = await response.json()
    console.error('Airtable API Fehler:', JSON.stringify(error))
    throw new Error(error.error?.message || 'Fehler beim Laden der freien Leads')
  }
  
  const data = await response.json()
  const freieLeads = data.records || []
  
  console.log(`Gefunden: ${freieLeads.length} freie Leads`)
  
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
    
    const updateResponse = await fetch(LEADS_URL, {
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
