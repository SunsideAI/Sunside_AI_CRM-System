// Files API - Laden der Dateien aus der Dateien-Tabelle
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = 'Dateien'

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`
      }
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message)
    }

    // Dateien aus den Records extrahieren
    const files = []
    
    for (const record of (data.records || [])) {
      const name = record.fields.Name || 'Unbenannt'
      const attachments = record.fields.Attachments || record.fields.Datei || record.fields.File || []
      
      // Jedes Attachment als separate Datei
      for (const att of attachments) {
        files.push({
          id: att.id,
          recordId: record.id,
          name: name,
          filename: att.filename,
          url: att.url,
          type: att.type,
          size: att.size
        })
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ files })
    }

  } catch (error) {
    console.error('Files API Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}
