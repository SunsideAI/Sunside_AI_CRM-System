// Users Function - Lädt alle User für Admin-Dropdown

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
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
    const AIRTABLE_TABLE_NAME = 'User_Datenbank'

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'Airtable nicht konfiguriert', users: [] })
      }
    }

    // Alle User laden
    const fields = ['Vorname', 'Name', 'Vor_Nachname', 'E-Mail', 'E-Mail_Geschäftlich', 'Rolle', 'Passwort']
    let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?`
    fields.forEach(field => {
      url += `fields[]=${encodeURIComponent(field)}&`
    })

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`
      }
    })

    if (!response.ok) {
      throw new Error('Airtable API Fehler')
    }

    const data = await response.json()

    // User formatieren (ohne Passwort, aber mit hasPassword Flag)
    const users = data.records.map(record => ({
      id: record.id,
      vorname: record.fields.Vorname || '',
      name: record.fields.Name || '',
      vor_nachname: record.fields.Vor_Nachname || `${record.fields.Vorname} ${record.fields.Name}`,
      email: record.fields['E-Mail'] || record.fields['E-Mail_Geschäftlich'] || '',
      rolle: record.fields.Rolle || [],
      hasPassword: !!(record.fields.Passwort && record.fields.Passwort.length > 0)
    }))

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
      body: JSON.stringify({ error: 'Interner Server-Fehler', users: [] })
    }
  }
}
