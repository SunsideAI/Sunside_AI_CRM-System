// Netlify Function: User-Verwaltung
export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server nicht konfiguriert' })
    }
  }

  try {
    // User aus Airtable laden
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/User_Datenbank?fields[]=Vor_Nachname&fields[]=E-Mail&fields[]=E-Mail_Geschäftlich&fields[]=Rolle&fields[]=Status&fields[]=Telefon&fields[]=Google_Calendar_ID`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`
      }
    })

    if (!response.ok) {
      throw new Error('Airtable Fehler')
    }

    const data = await response.json()

    // User-Daten formatieren
    const users = data.records.map(record => ({
      id: record.id,
      vor_nachname: record.fields.Vor_Nachname || '',
      email: record.fields['E-Mail'] || '',
      email_geschaeftlich: record.fields['E-Mail_Geschäftlich'] || '',
      rolle: record.fields.Rolle || [],
      status: record.fields.Status || false,
      telefon: record.fields.Telefon || '',
      google_calendar_id: record.fields.Google_Calendar_ID || ''
    }))

    // Nach Name sortieren
    users.sort((a, b) => a.vor_nachname.localeCompare(b.vor_nachname))

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ users })
    }

  } catch (error) {
    console.error('Users Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    }
  }
}
