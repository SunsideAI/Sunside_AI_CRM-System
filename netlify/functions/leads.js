// Leads API - Laden und Aktualisieren von Leads - Supabase Version
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Helper: Array zu String konvertieren (falls Airtable-Migration Arrays hinterlassen hat)
function arrayToString(value) {
  if (!value) return ''
  if (Array.isArray(value)) return value.join(' ').trim()
  const strValue = String(value).trim()
  if (strValue.startsWith('[') && strValue.endsWith(']')) {
    try {
      const parsed = JSON.parse(strValue)
      if (Array.isArray(parsed)) return parsed.join(' ').trim()
    } catch (e) { /* ignore */ }
  }
  return strValue
}

// Helper: Array zu Zahl konvertieren
function arrayToNumber(value, defaultValue = null) {
  if (value === null || value === undefined) return defaultValue
  if (typeof value === 'number') return value
  if (Array.isArray(value)) {
    const num = parseFloat(value[0])
    return isNaN(num) ? defaultValue : num
  }
  const strValue = String(value).trim()
  if (strValue.startsWith('[') && strValue.endsWith(']')) {
    try {
      const parsed = JSON.parse(strValue)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const num = parseFloat(parsed[0])
        return isNaN(num) ? defaultValue : num
      }
    } catch (e) { /* ignore */ }
  }
  const num = parseFloat(strValue)
  return isNaN(num) ? defaultValue : num
}

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

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server nicht konfiguriert' })
    }
  }

  // Hilfsfunktion: Alle User laden für Name-Mapping
  async function loadUserMap() {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, vor_nachname')

      if (error) {
        console.error('Failed to load users:', error)
        return {}
      }

      const userMap = {}
      users.forEach(user => {
        userMap[user.id] = user.vor_nachname || 'Unbekannt'
      })
      console.log('Loaded users:', Object.keys(userMap).length)
      return userMap
    } catch (err) {
      console.error('Error loading users:', err)
      return {}
    }
  }

  // Hilfsfunktion: Lead Assignments laden
  async function loadLeadAssignments(leadIds) {
    if (!leadIds || leadIds.length === 0) return {}

    const { data, error } = await supabase
      .from('lead_assignments')
      .select('lead_id, user_id, users(id, vor_nachname)')
      .in('lead_id', leadIds)

    if (error) {
      console.error('Failed to load assignments:', error)
      return {}
    }

    const assignmentMap = {}
    data.forEach(assignment => {
      if (!assignmentMap[assignment.lead_id]) {
        assignmentMap[assignment.lead_id] = []
      }
      assignmentMap[assignment.lead_id].push({
        id: assignment.user_id,
        name: assignment.users?.vor_nachname || 'Unbekannt'
      })
    })
    return assignmentMap
  }

  // GET - Leads laden
  if (event.httpMethod === 'GET') {
    try {
      const params = event.queryStringParameters || {}
      const {
        userName,
        userId,
        userRole,
        view,
        search,
        contacted,
        result,
        vertriebler,
        land,
        quelle,
        offset,
        wiedervorlage
      } = params

      // User-Map laden für Namen-Auflösung
      const userMap = await loadUserMap()

      // Basis-Query
      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' })

      // User-Filter: Nur wenn NICHT Admin mit "all" view ODER bei Wiedervorlagen-Abfrage
      const needsUserFilter = userRole !== 'Admin' || view === 'own' || wiedervorlage === 'true'

      if (needsUserFilter && userId) {
        // Zuerst Lead-IDs holen die diesem User zugewiesen sind
        const { data: assignments } = await supabase
          .from('lead_assignments')
          .select('lead_id')
          .eq('user_id', userId)

        if (assignments && assignments.length > 0) {
          const leadIds = assignments.map(a => a.lead_id)
          query = query.in('id', leadIds)
        } else {
          // Keine Leads zugewiesen
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              leads: [],
              users: Object.entries(userMap).map(([id, name]) => ({ id, name })),
              offset: null,
              hasMore: false
            })
          }
        }
      }

      // Vertriebler-Filter (für Admins)
      if (vertriebler && vertriebler !== 'all') {
        const { data: assignments } = await supabase
          .from('lead_assignments')
          .select('lead_id')
          .eq('user_id', vertriebler)

        if (assignments && assignments.length > 0) {
          const leadIds = assignments.map(a => a.lead_id)
          query = query.in('id', leadIds)
        }
      }

      // Kontaktiert-Filter
      if (contacted === 'true') {
        query = query.eq('bereits_kontaktiert', true)
      } else if (contacted === 'false') {
        query = query.or('bereits_kontaktiert.is.null,bereits_kontaktiert.eq.false')
      }

      // Ergebnis-Filter
      if (result && result !== 'all') {
        query = query.eq('ergebnis', result)
      }

      // Land-Filter
      if (land && land !== 'all') {
        query = query.eq('land', land)
      }

      // Quelle-Filter
      if (quelle && quelle !== 'all') {
        query = query.eq('quelle', quelle)
      }

      // Wiedervorlage-Filter
      if (wiedervorlage === 'true') {
        query = query.not('wiedervorlage_datum', 'is', null)
      }

      // Suchfilter
      if (search) {
        query = query.or(`unternehmensname.ilike.%${search}%,stadt.ilike.%${search}%`)
      }

      // Sortierung und Pagination
      const pageSize = 50
      const offsetNum = parseInt(offset) || 0

      query = query
        .order('unternehmensname', { ascending: true })
        .range(offsetNum, offsetNum + pageSize - 1)

      const { data: leadsData, error, count } = await query

      if (error) {
        console.error('Supabase Error:', error)
        throw new Error(error.message || 'Fehler beim Laden der Leads')
      }

      // Lead Assignments laden
      const leadIds = leadsData.map(l => l.id)
      const assignmentMap = await loadLeadAssignments(leadIds)

      // Leads formatieren
      const leads = leadsData.map(record => {
        const assignments = assignmentMap[record.id] || []

        return {
          id: record.id,
          unternehmensname: arrayToString(record.unternehmensname) || '',
          stadt: arrayToString(record.stadt) || '',
          land: arrayToString(record.land) || '',
          kategorie: arrayToString(record.kategorie) || '',
          email: arrayToString(record.mail) || '',
          website: arrayToString(record.website) || '',
          telefon: arrayToString(record.telefonnummer) || '',
          zugewiesenAn: assignments.map(a => a.name),
          zugewiesenAnIds: assignments.map(a => a.id),
          kontaktiert: record.bereits_kontaktiert === true,
          datum: record.datum || null,
          ergebnis: arrayToString(record.ergebnis) || '',
          kommentar: record.kommentar || '',
          ansprechpartnerVorname: arrayToString(record.ansprechpartner_vorname) || '',
          ansprechpartnerNachname: arrayToString(record.ansprechpartner_nachname) || '',
          wiedervorlageDatum: record.wiedervorlage_datum || '',
          quelle: arrayToString(record.quelle) || '',
          absprungrate: arrayToNumber(record.absprungrate),
          monatlicheBesuche: arrayToNumber(record.monatliche_besuche),
          anzahlLeads: arrayToNumber(record.anzahl_leads),
          mehrwert: arrayToNumber(record.mehrwert)
        }
      })

      // User-Liste für Filter
      const users = Object.entries(userMap)
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name))

      const hasMore = count > offsetNum + pageSize

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          leads,
          users,
          offset: hasMore ? offsetNum + pageSize : null,
          hasMore
        })
      }

    } catch (error) {
      console.error('GET Leads Error:', error.message)
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
      const body = JSON.parse(event.body)
      const leadId = body.leadId || body.id
      const updates = body.updates || {}
      const historyEntry = body.historyEntry

      if (!leadId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Lead ID fehlt' })
        }
      }

      // Aktuellen Lead laden (für History)
      let currentKommentar = ''
      if (historyEntry) {
        const { data: currentLead } = await supabase
          .from('leads')
          .select('kommentar')
          .eq('id', leadId)
          .single()

        currentKommentar = currentLead?.kommentar || ''
      }

      const fieldsToUpdate = {}

      console.log('PATCH Lead - Incoming updates:', JSON.stringify(updates, null, 2))

      if (updates.kontaktiert !== undefined) {
        fieldsToUpdate.bereits_kontaktiert = updates.kontaktiert === true
      }
      if (updates.ergebnis !== undefined) {
        fieldsToUpdate.ergebnis = updates.ergebnis || null
      }
      if (updates.datum !== undefined) {
        fieldsToUpdate.datum = updates.datum || null
      }
      if (updates.ansprechpartnerVorname !== undefined) {
        fieldsToUpdate.ansprechpartner_vorname = updates.ansprechpartnerVorname || null
      }
      if (updates.ansprechpartnerNachname !== undefined) {
        fieldsToUpdate.ansprechpartner_nachname = updates.ansprechpartnerNachname || null
      }
      if (updates.kategorie !== undefined) {
        fieldsToUpdate.kategorie = updates.kategorie || null
      }
      if (updates.telefon !== undefined) {
        fieldsToUpdate.telefonnummer = updates.telefon || null
      }
      if (updates.email !== undefined) {
        fieldsToUpdate.mail = updates.email || null
      }
      if (updates.website !== undefined) {
        fieldsToUpdate.website = updates.website || null
      }
      if (updates.wiedervorlageDatum !== undefined) {
        fieldsToUpdate.wiedervorlage_datum = updates.wiedervorlageDatum || null
      }

      // Automatisch Datum setzen wenn kontaktiert
      const hasRealUpdates = Object.keys(updates).length > 0
      if (hasRealUpdates && updates.kontaktiert === true && !updates.datum) {
        fieldsToUpdate.datum = new Date().toISOString().split('T')[0]
      }

      // History-Eintrag erstellen
      if (historyEntry) {
        const now = new Date()
        const timestamp = now.toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) + ', ' + now.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit'
        })

        const icons = {
          'email': '📧',
          'termin': '📅',
          'angebot': '💰',
          'abgeschlossen': '🎉',
          'verloren': '❌',
          'kontaktiert': '✅',
          'nicht_kontaktiert': '↩️',
          'ergebnis': '📋',
          'ansprechpartner': '👤',
          'kommentar': '💬',
          'wiedervorlage': '🔔',
          'kontaktdaten': '✏️'
        }
        const icon = icons[historyEntry.action] || '📋'

        const newEntry = `[${timestamp}] ${icon} ${historyEntry.details} (${historyEntry.userName})`

        fieldsToUpdate.kommentar = currentKommentar
          ? `${newEntry}\n${currentKommentar}`
          : newEntry
      } else if (updates.kommentar !== undefined) {
        fieldsToUpdate.kommentar = updates.kommentar
      }

      console.log('PATCH Lead - Fields to update:', JSON.stringify(fieldsToUpdate, null, 2))

      const { data, error } = await supabase
        .from('leads')
        .update(fieldsToUpdate)
        .eq('id', leadId)
        .select()
        .single()

      if (error) {
        console.error('Supabase Update Error:', error)
        throw new Error(error.message || 'Fehler beim Aktualisieren')
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          lead: {
            id: data.id,
            kontaktiert: data.bereits_kontaktiert === true,
            ergebnis: data.ergebnis || '',
            kommentar: data.kommentar || '',
            datum: data.datum || null,
            ansprechpartnerVorname: data.ansprechpartner_vorname || '',
            ansprechpartnerNachname: data.ansprechpartner_nachname || ''
          }
        })
      }

    } catch (error) {
      console.error('PATCH Lead Error:', error.message)
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
