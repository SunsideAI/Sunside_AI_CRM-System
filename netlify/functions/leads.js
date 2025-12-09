// Leads API - Laden und Aktualisieren von Leads
export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
  const LEADS_TABLE = 'Immobilienmakler_Leads'
  const USERS_TABLE = 'User_Datenbank'

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server nicht konfiguriert' })
    }
  }

  // GET - Leads laden
  if (event.httpMethod === 'GET') {
    try {
      const params = event.queryStringParameters || {}
      const {
        userId,        // Für Filter nach zugewiesenem User
        userRole,      // 'Admin', 'Setter', 'Closer'
        view,          // 'all' oder 'own' (für Admins)
        search,        // Suchbegriff
        contacted,     // 'true' oder 'false'
        result,        // Ergebnis-Filter
        page = '1',
        limit = '50'
      } = params

      // Basis-URL
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(LEADS_TABLE)}`
      
      // Filter bauen
      const filters = []
      
      // Wenn kein Admin ODER Admin mit "own" view → nur eigene Leads
      if (userRole !== 'Admin' || view === 'own') {
        if (userId) {
          // Filter nach zugewiesenem User (Link-Feld enthält Record ID)
          filters.push(`FIND("${userId}", ARRAYJOIN({User_Datenbank}))`)
        }
      }

      // Kontaktiert-Filter
      if (contacted === 'true') {
        filters.push(`{Bereits kontaktiert} = TRUE()`)
      } else if (contacted === 'false') {
        filters.push(`{Bereits kontaktiert} = FALSE()`)
      }

      // Ergebnis-Filter
      if (result && result !== 'all') {
        filters.push(`{Ergebnis} = '${result}'`)
      }

      // Suchfilter (Unternehmensname oder Stadt)
      if (search) {
        filters.push(`OR(FIND(LOWER("${search}"), LOWER({Unternehmensname})), FIND(LOWER("${search}"), LOWER({Stadt})))`)
      }

      // Query-Parameter
      const queryParams = new URLSearchParams()
      
      // Filter kombinieren
      if (filters.length > 0) {
        const formula = filters.length === 1 ? filters[0] : `AND(${filters.join(', ')})`
        queryParams.append('filterByFormula', formula)
      }

      // Pagination
      const pageNum = parseInt(page)
      const limitNum = Math.min(parseInt(limit), 100)
      queryParams.append('pageSize', limitNum.toString())

      // Sortierung - neueste zuerst, dann nach Name
      queryParams.append('sort[0][field]', 'Unternehmensname')
      queryParams.append('sort[0][direction]', 'asc')

      // Felder die wir brauchen
      const fields = [
        'Unternehmensname',
        'Stadt',
        'Bundesland',
        'Kategorie',
        'Mail',
        'Website',
        'Telefonnummer',
        'User_Datenbank',
        'Bereits kontaktiert',
        'Datum',
        'Ergebnis',
        'Kommentar'
      ]
      fields.forEach(field => queryParams.append('fields[]', field))

      // Offset für Pagination (wenn vorhanden)
      if (params.offset) {
        queryParams.append('offset', params.offset)
      }

      const fullUrl = `${url}?${queryParams.toString()}`
      
      const response = await fetch(fullUrl, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Airtable Error:', error)
        throw new Error('Fehler beim Laden der Leads')
      }

      const data = await response.json()

      // Leads formatieren
      const leads = data.records.map(record => ({
        id: record.id,
        unternehmensname: record.fields.Unternehmensname || '',
        stadt: record.fields.Stadt || '',
        bundesland: record.fields.Bundesland || '',
        kategorie: record.fields.Kategorie || '',
        email: record.fields.Mail || '',
        website: record.fields.Website || '',
        telefon: record.fields.Telefonnummer || '',
        zugewiesenAn: record.fields.User_Datenbank || [],
        kontaktiert: record.fields['Bereits kontaktiert'] || false,
        datum: record.fields.Datum || null,
        ergebnis: record.fields.Ergebnis || '',
        kommentar: record.fields.Kommentar || ''
      }))

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          leads,
          offset: data.offset || null,
          hasMore: !!data.offset
        })
      }

    } catch (error) {
      console.error('GET Leads Error:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      }
    }
  }

  // PATCH - Lead aktualisieren
  if (event.httpMethod === 'PATCH') {
    try {
      const { leadId, updates } = JSON.parse(event.body)

      if (!leadId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Lead ID fehlt' })
        }
      }

      // Erlaubte Felder für Update
      const allowedFields = ['Bereits kontaktiert', 'Ergebnis', 'Kommentar', 'Datum']
      const fieldsToUpdate = {}

      if (updates.kontaktiert !== undefined) {
        fieldsToUpdate['Bereits kontaktiert'] = updates.kontaktiert
      }
      if (updates.ergebnis !== undefined) {
        fieldsToUpdate['Ergebnis'] = updates.ergebnis
      }
      if (updates.kommentar !== undefined) {
        fieldsToUpdate['Kommentar'] = updates.kommentar
      }
      if (updates.datum !== undefined) {
        fieldsToUpdate['Datum'] = updates.datum
      }

      // Automatisch Datum setzen wenn kontaktiert
      if (updates.kontaktiert === true && !updates.datum) {
        fieldsToUpdate['Datum'] = new Date().toISOString().split('T')[0]
      }

      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(LEADS_TABLE)}/${leadId}`

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: fieldsToUpdate })
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Airtable Update Error:', error)
        throw new Error('Fehler beim Aktualisieren')
      }

      const data = await response.json()

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          lead: {
            id: data.id,
            kontaktiert: data.fields['Bereits kontaktiert'] || false,
            ergebnis: data.fields.Ergebnis || '',
            kommentar: data.fields.Kommentar || '',
            datum: data.fields.Datum || null
          }
        })
      }

    } catch (error) {
      console.error('PATCH Lead Error:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      }
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  }
}
