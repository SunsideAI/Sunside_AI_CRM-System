// System Messages API
// GET: Nachrichten für einen User laden
// POST: Neue Nachricht erstellen (+ Email senden)
// PATCH: Nachricht als gelesen markieren

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
}

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const RESEND_API_KEY = process.env.RESEND_API_KEY

const TABLE_NAME = 'System_Messages'
const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`
const USER_TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('User_Datenbank')}`

exports.handler = async (event) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  try {
    // ==========================================
    // GET: Nachrichten für User laden
    // ==========================================
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const { userId, unreadOnly } = params

      if (!userId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'userId ist erforderlich' })
        }
      }

      // Filter: Nachrichten für diesen User
      let filterFormula = `FIND("${userId}", ARRAYJOIN({Empfänger}))`
      
      if (unreadOnly === 'true') {
        filterFormula = `AND(${filterFormula}, NOT({Gelesen}))`
      }

      let allRecords = []
      let offset = null

      do {
        let url = `${TABLE_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&sort%5B0%5D%5Bfield%5D=Erstellt_am&sort%5B0%5D%5Bdirection%5D=desc`
        if (offset) url += `&offset=${offset}`

        const response = await fetch(url, { headers: airtableHeaders })
        const data = await response.json()

        if (data.records) {
          allRecords = allRecords.concat(data.records)
        }
        offset = data.offset
      } while (offset)

      const messages = allRecords.map(record => ({
        id: record.id,
        messageId: record.fields.Message_ID,
        typ: record.fields.Typ,
        titel: record.fields.Titel,
        nachricht: record.fields.Nachricht,
        hotLeadId: record.fields.Hot_Lead?.[0] || null,
        gelesen: record.fields.Gelesen || false,
        erstelltAm: record.fields.Erstellt_am
      }))

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ messages })
      }
    }

    // ==========================================
    // POST: Neue Nachricht erstellen + Email senden
    // ==========================================
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body)
      const { 
        empfaengerId,   // User-ID des Empfängers
        typ,            // 'Termin abgesagt', 'Termin verschoben', 'Lead gewonnen', 'Lead verloren', 'Pool Update'
        titel,          // Kurzer Titel
        nachricht,      // Längere Nachricht
        hotLeadId,      // Optional: Verknüpfung zum Hot Lead
        sendEmail = true // Email senden? Standard: ja
      } = body

      if (!empfaengerId || !typ || !titel) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'empfaengerId, typ und titel sind erforderlich' })
        }
      }

      console.log('Creating System Message:', { empfaengerId, typ, titel })

      // 1. Nachricht in Airtable erstellen
      const fields = {
        'Empfänger': [empfaengerId],
        'Typ': typ,
        'Titel': titel,
        'Nachricht': nachricht || '',
        'Gelesen': false
      }

      if (hotLeadId) {
        fields['Hot_Lead'] = [hotLeadId]
      }

      const createResponse = await fetch(TABLE_URL, {
        method: 'POST',
        headers: airtableHeaders,
        body: JSON.stringify({ fields })
      })

      if (!createResponse.ok) {
        const error = await createResponse.json()
        console.error('Airtable Error:', error)
        throw new Error(error.error?.message || 'Nachricht konnte nicht erstellt werden')
      }

      const createdMessage = await createResponse.json()
      console.log('Message created:', createdMessage.id)

      // 2. Email an Empfänger senden
      if (sendEmail && RESEND_API_KEY) {
        try {
          // User-Email laden
          const userResponse = await fetch(`${USER_TABLE_URL}/${empfaengerId}`, { headers: airtableHeaders })
          if (userResponse.ok) {
            const userData = await userResponse.json()
            const userEmail = userData.fields?.Mail
            const userName = userData.fields?.Vor_Nachname || 'User'

            if (userEmail) {
              // Email-Icon je nach Typ
              const icons = {
                'Termin abgesagt': '❌',
                'Termin verschoben': '🔄',
                'Lead gewonnen': '🎉',
                'Lead verloren': '😔',
                'Pool Update': '📢'
              }
              const icon = icons[typ] || '📬'

              // Email-Farbe je nach Typ
              const colors = {
                'Termin abgesagt': { bg: '#FEE2E2', text: '#991B1B', gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' },
                'Termin verschoben': { bg: '#FEF3C7', text: '#92400E', gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' },
                'Lead gewonnen': { bg: '#D1FAE5', text: '#065F46', gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' },
                'Lead verloren': { bg: '#FEE2E2', text: '#991B1B', gradient: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)' },
                'Pool Update': { bg: '#DBEAFE', text: '#1E40AF', gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' }
              }
              const color = colors[typ] || colors['Pool Update']

              const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: ${color.gradient}; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">${icon} ${titel}</h1>
    </div>
    
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        Hallo ${userName},
      </p>
      
      ${nachricht ? `
      <div style="background: ${color.bg}; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <p style="color: ${color.text}; margin: 0; font-size: 15px; line-height: 1.6;">
          ${nachricht}
        </p>
      </div>
      ` : ''}
      
      <div style="text-align: center; margin-top: 25px;">
        <a href="https://crm.sunside.ai/${typ.includes('Termin') ? 'closing' : typ.includes('Lead') ? 'dashboard' : ''}" 
           style="display: inline-block; background: ${color.gradient}; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Im CRM ansehen →
        </a>
      </div>
      
      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 30px; margin-bottom: 0;">
        Sunside AI CRM System
      </p>
    </div>
  </div>
</body>
</html>`

              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${RESEND_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  from: 'Sunside AI <noreply@sunside.ai>',
                  to: userEmail,
                  subject: `${icon} ${titel}`,
                  html: emailHtml
                })
              })

              console.log('Email sent to:', userEmail)
            }
          }
        } catch (emailError) {
          console.error('Email-Fehler:', emailError)
          // Nicht werfen - Nachricht wurde trotzdem erstellt
        }
      }

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Nachricht erstellt',
          id: createdMessage.id
        })
      }
    }

    // ==========================================
    // PATCH: Nachricht als gelesen markieren
    // ==========================================
    if (event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body)
      const { messageId, markAllRead, userId } = body

      if (markAllRead && userId) {
        // Alle Nachrichten für User als gelesen markieren
        let filterFormula = `AND(FIND("${userId}", ARRAYJOIN({Empfänger})), NOT({Gelesen}))`
        
        const response = await fetch(`${TABLE_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`, {
          headers: airtableHeaders
        })
        const data = await response.json()
        
        // In Batches von 10 updaten
        const records = data.records || []
        for (let i = 0; i < records.length; i += 10) {
          const batch = records.slice(i, i + 10)
          await fetch(TABLE_URL, {
            method: 'PATCH',
            headers: airtableHeaders,
            body: JSON.stringify({
              records: batch.map(r => ({
                id: r.id,
                fields: { 'Gelesen': true }
              }))
            })
          })
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ success: true, updated: records.length })
        }
      }

      if (!messageId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'messageId ist erforderlich' })
        }
      }

      const updateResponse = await fetch(`${TABLE_URL}/${messageId}`, {
        method: 'PATCH',
        headers: airtableHeaders,
        body: JSON.stringify({ fields: { 'Gelesen': true } })
      })

      if (!updateResponse.ok) {
        const error = await updateResponse.json()
        throw new Error(error.error?.message || 'Update fehlgeschlagen')
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true })
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('System Messages Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}
