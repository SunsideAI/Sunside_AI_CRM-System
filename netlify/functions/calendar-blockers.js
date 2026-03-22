// Kalender-Blocker API
// GET: Alle aktiven Blocker laden (für Kalenderanzeige und Slot-Filterung)
// POST: Neuen Blocker erstellen (Admin)
// PATCH: Blocker aktualisieren (Admin)
// DELETE: Blocker löschen (Admin)

import { fetchWithRetry } from './utils/airtable.js'

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = 'Kalender_Blocker'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
}

const airtableHeaders = {
  'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json'
}

const TABLE_URL = () => `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`

// Airtable-Record in Frontend-Format umwandeln
function mapRecord(record) {
  const f = record.fields
  return {
    id: record.id,
    name: f.Name || '',
    typ: f.Typ || 'Einmalig',
    startdatum: f.Startdatum || '',
    enddatum: f.Enddatum || '',
    startzeit: f.Startzeit || '00:00',
    endzeit: f.Endzeit || '23:59',
    wochentage: f.Wochentage || [],
    gueltigVon: f.Gueltig_Von || '',
    gueltigBis: f.Gueltig_Bis || '',
    aktiv: f.Aktiv !== false, // Standard: aktiv
    notiz: f.Notiz || '',
    erstelltVon: f.Erstellt_Von || ''
  }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Airtable nicht konfiguriert' })
    }
  }

  try {
    // ==========================================
    // GET: Alle aktiven Blocker laden
    // ==========================================
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      // ?all=true lädt auch inaktive (für Admin-Modal)
      const loadAll = params.all === 'true'

      const filterFormula = loadAll
        ? ''
        : `?filterByFormula={Aktiv}=TRUE()`

      let allRecords = []
      let offset = null

      do {
        let url = TABLE_URL() + (filterFormula || '?') + (filterFormula ? '&' : '') + `pageSize=100`
        if (!filterFormula) url = TABLE_URL() + `?pageSize=100`
        if (filterFormula) url = TABLE_URL() + filterFormula + `&pageSize=100`
        if (offset) url += `&offset=${offset}`

        const response = await fetchWithRetry(url, { headers: airtableHeaders })

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(`Airtable Fehler ${response.status}: ${errText}`)
        }

        const data = await response.json()
        allRecords = allRecords.concat(data.records || [])
        offset = data.offset || null
      } while (offset)

      const blockers = allRecords.map(mapRecord)

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ blockers })
      }
    }

    // ==========================================
    // POST: Neuen Blocker erstellen
    // ==========================================
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const { name, typ, startdatum, enddatum, startzeit, endzeit, wochentage, gueltigVon, gueltigBis, notiz, erstelltVon } = body

      if (!name || !typ || !startzeit || !endzeit) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Name, Typ, Startzeit und Endzeit sind erforderlich' })
        }
      }

      const fields = {
        Name: name,
        Typ: typ,
        Startzeit: startzeit,
        Endzeit: endzeit,
        Aktiv: true
      }

      if (startdatum) fields.Startdatum = startdatum
      if (enddatum) fields.Enddatum = enddatum
      if (wochentage && wochentage.length > 0) fields.Wochentage = wochentage
      if (gueltigVon) fields.Gueltig_Von = gueltigVon
      if (gueltigBis) fields.Gueltig_Bis = gueltigBis
      if (notiz) fields.Notiz = notiz
      if (erstelltVon) fields.Erstellt_Von = erstelltVon

      const response = await fetchWithRetry(TABLE_URL(), {
        method: 'POST',
        headers: airtableHeaders,
        body: JSON.stringify({ fields })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Airtable Fehler ${response.status}: ${errText}`)
      }

      const data = await response.json()

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, blocker: mapRecord(data) })
      }
    }

    // ==========================================
    // PATCH: Blocker aktualisieren
    // ==========================================
    if (event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body || '{}')
      const { recordId, fields } = body

      if (!recordId || !fields) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'recordId und fields sind erforderlich' })
        }
      }

      // Feldnamen-Mapping: Frontend → Airtable
      const airtableFields = {}
      if (fields.aktiv !== undefined) airtableFields.Aktiv = fields.aktiv
      if (fields.name !== undefined) airtableFields.Name = fields.name
      if (fields.typ !== undefined) airtableFields.Typ = fields.typ
      if (fields.startdatum !== undefined) airtableFields.Startdatum = fields.startdatum || null
      if (fields.enddatum !== undefined) airtableFields.Enddatum = fields.enddatum || null
      if (fields.startzeit !== undefined) airtableFields.Startzeit = fields.startzeit
      if (fields.endzeit !== undefined) airtableFields.Endzeit = fields.endzeit
      if (fields.wochentage !== undefined) airtableFields.Wochentage = fields.wochentage
      if (fields.gueltigVon !== undefined) airtableFields.Gueltig_Von = fields.gueltigVon || null
      if (fields.gueltigBis !== undefined) airtableFields.Gueltig_Bis = fields.gueltigBis || null
      if (fields.notiz !== undefined) airtableFields.Notiz = fields.notiz

      const response = await fetchWithRetry(`${TABLE_URL()}/${recordId}`, {
        method: 'PATCH',
        headers: airtableHeaders,
        body: JSON.stringify({ fields: airtableFields })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Airtable Fehler ${response.status}: ${errText}`)
      }

      const data = await response.json()

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, blocker: mapRecord(data) })
      }
    }

    // ==========================================
    // DELETE: Blocker löschen
    // ==========================================
    if (event.httpMethod === 'DELETE') {
      const body = JSON.parse(event.body || '{}')
      const { recordId } = body

      if (!recordId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'recordId ist erforderlich' })
        }
      }

      const response = await fetchWithRetry(`${TABLE_URL()}/${recordId}`, {
        method: 'DELETE',
        headers: airtableHeaders
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Airtable Fehler ${response.status}: ${errText}`)
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

  } catch (err) {
    console.error('Calendar-Blockers Fehler:', err)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    }
  }
}
