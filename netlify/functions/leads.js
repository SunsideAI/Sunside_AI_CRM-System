// Leads Function - Holt Leads aus Airtable

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
    // Query Parameter
    const params = event.queryStringParameters || {}
    const page = parseInt(params.page) || 1
    const limit = Math.min(parseInt(params.limit) || 25, 100)
    const userId = params.userId || ''
    const search = params.search || ''

    // Airtable Konfiguration
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
    const AIRTABLE_TABLE_NAME = 'Immobilienmakler_Leads'

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ 
          error: 'Airtable nicht konfiguriert',
          leads: [],
          total: 0
        })
      }
    }

    // Filter aufbauen
    let filterParts = []
    
    // Filter nach User (nur seine Leads)
    if (userId) {
      filterParts.push(`FIND('${userId}', ARRAYJOIN({User_Datenbank}))`)
    }

    // Suchfilter
    if (search) {
      filterParts.push(`OR(
        FIND(LOWER('${search}'), LOWER({Unternehmensname})),
        FIND(LOWER('${search}'), LOWER({Stadt}))
      )`)
    }

    const formula = filterParts.length > 0 
      ? `AND(${filterParts.join(',')})`
      : ''

    // Airtable Request
    let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`
    url += `?pageSize=${limit}`
    
    if (formula) {
      url += `&filterByFormula=${encodeURIComponent(formula)}`
    }

    // Felder die wir brauchen
    const fields = [
      'Unternehmensname',
      'Stadt',
      'Kategorie',
      'Mail',
      'Website',
      'Telefonnummer',
      'Ergebnis',
      'Kommentar',
      'Bereits kontaktiert',
      'Datum'
    ]
    fields.forEach(field => {
      url += `&fields[]=${encodeURIComponent(field)}`
    })

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Airtable Error:', errorText)
      throw new Error('Airtable API Fehler')
    }

    const data = await response.json()

    // Leads formatieren
    const leads = data.records.map(record => ({
      id: record.id,
      unternehmensname: record.fields.Unternehmensname || '',
      stadt: record.fields.Stadt || '',
      kategorie: record.fields.Kategorie || '',
      mail: record.fields.Mail || '',
      website: record.fields.Website || '',
      telefonnummer: record.fields.Telefonnummer || '',
      ergebnis: record.fields.Ergebnis || '',
      kommentar: record.fields.Kommentar || '',
      bereits_kontaktiert: record.fields['Bereits kontaktiert'] || false,
      datum: record.fields.Datum || null
    }))

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        leads,
        total: leads.length, // Airtable gibt kein Total zurück ohne extra Request
        page,
        limit,
        hasMore: !!data.offset
      })
    }

  } catch (error) {
    console.error('Leads Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Fehler beim Laden der Leads',
        leads: [],
        total: 0
      })
    }
  }
}
