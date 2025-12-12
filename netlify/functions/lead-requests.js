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

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          anfrage: {
            id: result.id,
            status: result.fields.Status
          }
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

// E-Mail an alle Admins senden
async function sendAdminNotification(userId, anzahl, nachricht, anfrageId, userUrl, airtableHeaders) {
  // Admins aus User_Datenbank laden
  const adminFilter = `FIND("Admin", ARRAYJOIN({Rolle}, ","))`
  const adminResponse = await fetch(
    `${userUrl}?filterByFormula=${encodeURIComponent(adminFilter)}&fields[]=E-Mail&fields[]=Vor_Nachname`,
    { headers: airtableHeaders }
  )
  
  if (!adminResponse.ok) {
    throw new Error('Konnte Admins nicht laden')
  }

  const adminData = await adminResponse.json()
  const adminEmails = adminData.records
    .map(r => r.fields['E-Mail'])
    .filter(Boolean)

  if (adminEmails.length === 0) {
    console.log('Keine Admin-E-Mails gefunden')
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
    <h2>Neue Lead-Anfrage</h2>
    <p><strong>Von:</strong> ${userName}</p>
    <p><strong>Anzahl:</strong> ${anzahl} Leads</p>
    ${nachricht ? `<p><strong>Nachricht:</strong> ${nachricht}</p>` : ''}
    <p><strong>Anfrage-ID:</strong> ${anfrageId}</p>
    <br>
    <p><a href="https://crmsunsideai.netlify.app/einstellungen">Jetzt bearbeiten →</a></p>
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
