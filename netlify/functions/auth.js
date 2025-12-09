// Auth Function - Prüft User + Passwort (gehasht) gegen Airtable
import bcrypt from 'bcryptjs'

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { email, password } = JSON.parse(event.body)

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'E-Mail und Passwort sind erforderlich' })
      }
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
    const AIRTABLE_TABLE_NAME = 'User_Datenbank'

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      // Demo-Modus
      console.log('Airtable nicht konfiguriert - Demo-Modus')
      
      if (email.includes('@sunsideai.de') && password === 'demo') {
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
              rolle: ['Setter', 'Closer', 'Admin'],
              google_calendar_id: ''
            }
          })
        }
      }
      
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Ungültige Anmeldedaten' })
      }
    }

    // Airtable Query
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
        body: JSON.stringify({ error: 'Ungültige Anmeldedaten' })
      }
    }

    const record = data.records[0]
    const fields = record.fields

    // Passwort prüfen
    const storedPassword = fields.Passwort || ''
    
    if (!storedPassword) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Kein Passwort gesetzt. Bitte Admin kontaktieren.' })
      }
    }

    // Prüfen ob es ein Hash ist (beginnt mit $2)
    let isValid = false
    if (storedPassword.startsWith('$2')) {
      // Gehashtes Passwort - mit bcrypt vergleichen
      isValid = await bcrypt.compare(password, storedPassword)
    } else {
      // Klartext-Passwort (Legacy) - direkter Vergleich
      isValid = (storedPassword === password)
    }

    if (!isValid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Ungültige Anmeldedaten' })
      }
    }

    // User Objekt erstellen (ohne Passwort!)
    const user = {
      id: record.id,
      vorname: fields.Vorname || '',
      name: fields.Name || '',
      vor_nachname: fields.Vor_Nachname || `${fields.Vorname} ${fields.Name}`,
      email: fields['E-Mail'] || fields['E-Mail_Geschäftlich'],
      email_geschaeftlich: fields['E-Mail_Geschäftlich'] || '',
      telefon: fields.Telefon || '',
      rolle: fields.Rolle || fields.Status || ['Setter'],
      ort: fields.Ort || '',
      bundesland: fields.Bundesland || '',
      google_calendar_id: fields.Google_Calendar_ID || ''
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
