// Auth Function - Prüft User gegen Airtable

export async function handler(event) {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle OPTIONS (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  // Nur POST erlauben
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { email } = JSON.parse(event.body)

    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'E-Mail ist erforderlich' })
      }
    }

    // Airtable API Konfiguration
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
    const AIRTABLE_TABLE_NAME = 'User_Datenbank'

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      // Fallback für Entwicklung ohne API Key
      console.log('Airtable nicht konfiguriert - Demo-Modus')
      
      // Demo User zurückgeben
      if (email.includes('@sunsideai.de') || email.includes('admin')) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            user: {
              id: 'demo-1',
              vorname: 'Demo',
              name: 'User',
              vor_nachname: 'Demo User',
              email: email,
              rolle: ['Setter', 'Closer', 'Admin']
            }
          })
        }
      }
      
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Ungültige E-Mail Adresse' })
      }
    }

    // Airtable Query - Suche nach E-Mail
    const formula = `OR({E-Mail}='${email}',{E-Mail_Geschäftlich}='${email}')`
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`
      }
    })

    if (!response.ok) {
      throw new Error('Airtable API Fehler')
    }

    const data = await response.json()

    if (!data.records || data.records.length === 0) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'User nicht gefunden. Bitte prüfe deine E-Mail Adresse.' })
      }
    }

    const record = data.records[0]
    const fields = record.fields

    // User Objekt erstellen
    const user = {
      id: record.id,
      vorname: fields.Vorname || '',
      name: fields.Name || '',
      vor_nachname: fields.Vor_Nachname || `${fields.Vorname} ${fields.Name}`,
      email: fields['E-Mail'] || fields['E-Mail_Geschäftlich'],
      email_geschaeftlich: fields['E-Mail_Geschäftlich'],
      telefon: fields.Telefon || '',
      rolle: fields.Rolle || fields.Status || ['Setter'], // Fallback
      ort: fields.Ort || '',
      bundesland: fields.Bundesland || ''
    }

    // Status zu Rolle mappen falls nötig
    if (typeof user.rolle === 'string') {
      if (user.rolle === 'Coldcaller') {
        user.rolle = ['Setter']
      } else {
        user.rolle = [user.rolle]
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ user })
    }

  } catch (error) {
    console.error('Auth Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Interner Server-Fehler' })
    }
  }
}
