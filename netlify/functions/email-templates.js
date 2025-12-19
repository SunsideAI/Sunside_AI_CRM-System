// Email Templates CRUD API
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = 'E-Mail_Templates'

// Gültige Kategorien
const VALID_CATEGORIES = ['Kaltakquise', 'Closing', 'Allgemein']

const headers = {
  'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json'
}

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders }
  }

  try {
    // GET: Alle aktiven Templates laden
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const includeInactive = params.all === 'true'
      const kategorie = params.kategorie // Optional: Filter nach Kategorie
      
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`
      
      // Filter aufbauen
      const filters = []
      if (!includeInactive) {
        filters.push('{Aktiv}=TRUE()')
      }
      if (kategorie) {
        // Kategorie oder "Allgemein" anzeigen
        filters.push(`OR({Kategorie}='${kategorie}',{Kategorie}='Allgemein',{Kategorie}=BLANK())`)
      }
      
      if (filters.length > 0) {
        const formula = filters.length === 1 
          ? filters[0] 
          : `AND(${filters.join(',')})`
        url += `?filterByFormula=${encodeURIComponent(formula)}`
      }
      
      const response = await fetch(url, { headers })
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message)
      }

      // Hilfsfunktion für Dateiendung
      const getExtension = (filename) => {
        if (!filename) return ''
        const lastDot = filename.lastIndexOf('.')
        return lastDot > 0 ? filename.substring(lastDot) : ''
      }

      const templates = (data.records || []).map(record => {
        // Attachments_Name kann ein einzelner Name oder kommasepariert sein
        const attachmentNames = (record.fields.Attachments_Name || '')
          .split(',')
          .map(n => n.trim())
          .filter(n => n)

        const attachments = (record.fields.Attachments || []).map((att, index) => {
          // Nutze Attachments_Name wenn vorhanden, sonst original filename
          const customName = attachmentNames[index] || attachmentNames[0] || null
          
          return {
            id: att.id,
            // Wenn customName vorhanden, nutze ihn (mit korrekter Extension)
            filename: customName 
              ? (customName.includes('.') ? customName : `${customName}${getExtension(att.filename)}`)
              : att.filename,
            url: att.url,
            type: att.type,
            size: att.size
          }
        })

        return {
          id: record.id,
          name: record.fields.Name || '',
          betreff: record.fields.Betreff || '',
          inhalt: record.fields.Inhalt || '',
          aktiv: record.fields.Aktiv !== false,
          kategorie: record.fields.Kategorie || 'Allgemein',
          attachments
        }
      })

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ templates })
      }
    }

    // POST: Neues Template erstellen (Admin only)
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body)
      const { name, betreff, inhalt, aktiv = true, kategorie = 'Allgemein', attachments = [] } = body

      if (!name || !betreff || !inhalt) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Name, Betreff und Inhalt sind erforderlich' })
        }
      }

      // Felder für Airtable vorbereiten
      const fields = {
        Name: name,
        Betreff: betreff,
        Inhalt: inhalt,
        Aktiv: aktiv,
        Kategorie: VALID_CATEGORIES.includes(kategorie) ? kategorie : 'Allgemein'
      }

      // Attachments hinzufügen wenn vorhanden
      if (attachments.length > 0) {
        fields.Attachments = attachments.map(att => ({ url: att.url }))
        // Dateinamen kommasepariert speichern
        fields.Attachments_Name = attachments.map(att => att.filename).join(', ')
      }

      const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            records: [{ fields }]
          })
        }
      )

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message)
      }

      const created = data.records[0]
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          template: {
            id: created.id,
            name: created.fields.Name,
            betreff: created.fields.Betreff,
            inhalt: created.fields.Inhalt,
            aktiv: created.fields.Aktiv,
            kategorie: created.fields.Kategorie || 'Allgemein',
            attachments: created.fields.Attachments || []
          }
        })
      }
    }

    // PATCH: Template aktualisieren (Admin only)
    if (event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body)
      const { id, name, betreff, inhalt, aktiv, kategorie, attachments } = body

      if (!id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Template ID erforderlich' })
        }
      }

      const fields = {}
      if (name !== undefined) fields.Name = name
      if (betreff !== undefined) fields.Betreff = betreff
      if (inhalt !== undefined) fields.Inhalt = inhalt
      if (aktiv !== undefined) fields.Aktiv = aktiv
      if (kategorie !== undefined) {
        fields.Kategorie = VALID_CATEGORIES.includes(kategorie) ? kategorie : 'Allgemein'
      }
      
      // Attachments aktualisieren (auch leeres Array um alle zu entfernen)
      if (attachments !== undefined) {
        fields.Attachments = attachments.map(att => ({ url: att.url }))
        // Dateinamen kommasepariert speichern (oder leeren wenn keine Attachments)
        fields.Attachments_Name = attachments.length > 0 
          ? attachments.map(att => att.filename).join(', ')
          : ''
      }

      const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ fields })
        }
      )

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message)
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          template: {
            id: data.id,
            name: data.fields.Name,
            betreff: data.fields.Betreff,
            inhalt: data.fields.Inhalt,
            aktiv: data.fields.Aktiv,
            kategorie: data.fields.Kategorie || 'Allgemein',
            attachments: data.fields.Attachments || []
          }
        })
      }
    }

    // DELETE: Template löschen (Admin only)
    if (event.httpMethod === 'DELETE') {
      const params = event.queryStringParameters || {}
      const { id } = params

      if (!id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Template ID erforderlich' })
        }
      }

      const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${id}`,
        {
          method: 'DELETE',
          headers
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Löschen fehlgeschlagen')
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, deleted: id })
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Email Templates Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}
