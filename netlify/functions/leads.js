// Leads API - Laden und Aktualisieren von Leads - Supabase Version
import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'
import { filterPruefen, SPALTE_IN_DB } from '../../shared/filter.js'
import { darf, verboten, leadBeteiligt } from './utils/zugriff.js'

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  // Identitaet kommt aus dem Sitzungs-Token, nicht aus der Anfrage.
  const zugang = anmeldungVerlangen(event)
  if (zugang.antwort) return zugang.antwort
  const angemeldet = zugang.nutzer


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

  // Helper: Lead-Record zu Frontend-Format konvertieren
  /**
   * Einen Filter in eine Bedingung der Abfrage uebersetzen.
   * Felder, die aus mehreren Spalten bestehen (Ansprechpartner, Kontakt),
   * werden ueber beide geprueft.
   */
  function filterAnwenden(query, f) {
    const mehrteilig = {
      ansprechpartner: ['ansprechpartner_vorname', 'ansprechpartner_nachname'],
      kontakt: ['telefonnummer', 'mail']
    }[f.feld]
    const spalte = SPALTE_IN_DB[f.feld]
    if (!spalte && !mehrteilig) return query

    const wert = f.wert
    if (mehrteilig) {
      const [a, b] = mehrteilig
      switch (f.vergleich) {
        case 'ist':
          return query.or(`${a}.ilike.${wert},${b}.ilike.${wert}`)
        case 'enthaelt':
          return query.or(`${a}.ilike.%${wert}%,${b}.ilike.%${wert}%`)
        case 'ist_nicht':
        case 'enthaelt_nicht': {
          const muster = f.vergleich === 'ist_nicht' ? wert : `%${wert}%`
          return query.not(a, 'ilike', muster).not(b, 'ilike', muster)
        }
        case 'leer':
          return query.is(a, null).is(b, null)
        case 'nicht_leer':
          return query.or(`${a}.not.is.null,${b}.not.is.null`)
        default: return query
      }
    }

    switch (f.vergleich) {
      case 'ist': return query.ilike(spalte, wert)
      case 'ist_nicht': return query.not(spalte, 'ilike', wert)
      case 'enthaelt': return query.ilike(spalte, `%${wert}%`)
      case 'enthaelt_nicht': return query.not(spalte, 'ilike', `%${wert}%`)
      case 'groesser':
      case 'nach': return query.gt(spalte, wert)
      case 'kleiner':
      case 'vor': return query.lt(spalte, wert)
      case 'leer': return query.is(spalte, null)
      case 'nicht_leer': return query.not(spalte, 'is', null)
      default: return query
    }
  }

  function formatLead(record, assignmentMap) {
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
  }

  // GET - Leads laden
  if (event.httpMethod === 'GET') {
    try {
      const params = event.queryStringParameters || {}
      // Die frei zusammengestellten Filter des Benutzers. Sie kommen als JSON
      // und werden hier geprueft - was nicht im Katalog steht, faellt raus.
      let eigeneFilter = []
      try {
        eigeneFilter = filterPruefen('opening', JSON.parse(params.filter || '[]')) || []
      } catch { eigeneFilter = [] }
      const {
        userName: userNameAnfrage,
        userId: userIdAnfrage,
        airtableId: airtableIdAnfrage, // Fallback für alte IDs in lead_assignments
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

      // Wessen Leads: Fuer alle ausser der Leitung die eigenen - aus dem Token.
      // Vorher kam die userId aus der Anfrage. Ohne sie fiel der Filter ganz
      // weg, und jeder Angemeldete bekam die Leads der gesamten Firma.
      const leitung = angemeldet.istAdmin
      if (!leitung && wiedervorlage !== 'true' && !darf.opening(angemeldet)) {
        return verboten('Die Kaltakquise ist nur für Opener', 'rolle_fehlt')
      }
      const userId = leitung ? userIdAnfrage : angemeldet.id
      const userName = leitung ? userNameAnfrage : undefined
      const airtableId = leitung ? airtableIdAnfrage : undefined

      // User-Map laden für Namen-Auflösung
      const userMap = await loadUserMap()

      // Basis-Query
      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' })

      // User-Filter: Nur wenn NICHT Admin mit "all" view ODER bei Wiedervorlagen-Abfrage
      // Die Rolle kam aus der Query: ?userRole=Admin&view=all lieferte jedem
      // Angemeldeten saemtliche Leads der Firma. Jetzt entscheidet das Token.
      const needsUserFilter = !angemeldet.istAdmin || view === 'own' || wiedervorlage === 'true'

      // === RPC-basierter Pfad: skaliert auf beliebig viele Assignments ===
      // Löst das URL-Limit-Problem bei .in('id', [...1200 UUIDs])
      // Mit eigenen Filtern geht es ueber die normale Abfrage: Die SQL-Funktion
      // kennt nur die fuenf festen Filter von frueher.
      if (needsUserFilter && userId && eigeneFilter.length === 0) {
        console.log('[Leads] RPC path - userId:', userId, 'airtableId:', airtableId, 'userName:', userName)

        let effectiveUserId = userId

        // Fallback 1: airtableId - suche User über airtable_id Spalte
        if (airtableId) {
          const { count } = await supabase
            .from('lead_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)

          if (count === 0) {
            // User über airtable_id in users-Tabelle nachschlagen
            const { data: userByAirtable } = await supabase
              .from('users')
              .select('id')
              .eq('airtable_id', airtableId)
              .single()

            if (userByAirtable?.id) {
              // Prüfen ob dieser User Assignments hat
              const { count: countAt } = await supabase
                .from('lead_assignments')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userByAirtable.id)

              if (countAt > 0) {
                effectiveUserId = userByAirtable.id
                console.log('[Leads] Using airtableId fallback:', airtableId, '-> UUID:', userByAirtable.id, 'with', countAt, 'assignments')
              }
            }
          }
        }

        // Fallback 2: User by name (nur wenn weder userId noch airtableId Treffer haben)
        if (userName && effectiveUserId === userId) {
          const { count } = await supabase
            .from('lead_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', effectiveUserId)

          if (count === 0) {
            const { data: matchingUsers } = await supabase
              .from('users')
              .select('id')
              .ilike('vor_nachname', userName)
              .limit(5)

            for (const u of matchingUsers || []) {
              if (u.id === userId) continue
              const { count: c2 } = await supabase
                .from('lead_assignments')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', u.id)

              if (c2 > 0) {
                effectiveUserId = u.id
                console.log('[Leads] Using userName fallback:', u.id, 'with', c2, 'assignments')
                break
              }
            }
          }
        }

        // RPC-Aufruf — alle Filter serverseitig
        const { data: rpcResult, error: rpcError } = await supabase.rpc('get_user_leads', {
          p_user_id: effectiveUserId,
          p_wiedervorlage: wiedervorlage === 'true' ? true : null,
          p_contacted: contacted === 'true' ? true : (contacted === 'false' ? false : null),
          p_ergebnis: result && result !== 'all' ? result : null,
          p_land: land && land !== 'all' ? land : null,
          p_quelle: quelle && quelle !== 'all' ? quelle : null,
          p_search: search || null,
          p_offset: parseInt(offset) || 0,
          p_limit: 50
        })

        if (rpcError) {
          console.error('[Leads] RPC error:', rpcError.message)
          throw new Error(rpcError.message || 'Fehler beim Laden der Leads (RPC)')
        }

        const totalCount = rpcResult?.[0]?.total_count ?? 0
        const leadsRaw = (rpcResult || []).map(r => r.lead_data)

        console.log('[Leads] RPC returned', leadsRaw.length, 'leads, total:', totalCount)

        // Lead Assignments für die zurückgegebenen Leads laden (für zugewiesenAn-Anzeige)
        const leadIds = leadsRaw.map(l => l.id)
        const assignmentMap = await loadLeadAssignments(leadIds)

        const leads = leadsRaw.map(record => formatLead(record, assignmentMap))
        const offsetNum = parseInt(offset) || 0
        const hasMore = totalCount > offsetNum + leads.length

        const users = Object.entries(userMap)
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            leads,
            users,
            offset: hasMore ? offsetNum + leads.length : null,
            hasMore
          })
        }
      }

      // Vertriebler-Filter (für Admins)
      // Mit Pagination um > 1000 Assignments zu unterstützen
      if (vertriebler && vertriebler !== 'all') {
        let vertrAssignments = []
        let vertrOffset = 0
        const vertrPageSize = 1000

        while (true) {
          const { data: batch } = await supabase
            .from('lead_assignments')
            .select('lead_id')
            .eq('user_id', vertriebler)
            .range(vertrOffset, vertrOffset + vertrPageSize - 1)

          if (!batch || batch.length === 0) break
          vertrAssignments = vertrAssignments.concat(batch)
          if (batch.length < vertrPageSize) break
          vertrOffset += vertrPageSize
        }

        if (vertrAssignments.length > 0) {
          const leadIds = vertrAssignments.map(a => a.lead_id)
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

      // Eigene Leads: ueber die Zuweisungstabelle verknuepft. Eine Liste mit
      // tausend IDs in der URL sprengt deren Laenge - ein Join nicht.
      if (needsUserFilter && userId && eigeneFilter.length > 0) {
        query = supabase
          .from('leads')
          .select('*, lead_assignments!inner(user_id)', { count: 'exact' })
          .eq('lead_assignments.user_id', userId)

        if (contacted === 'true') query = query.eq('bereits_kontaktiert', true)
        else if (contacted === 'false') query = query.or('bereits_kontaktiert.is.null,bereits_kontaktiert.eq.false')
        if (result && result !== 'all') query = query.eq('ergebnis', result)
        if (land && land !== 'all') query = query.eq('land', land)
        if (quelle && quelle !== 'all') query = query.eq('quelle', quelle)
        if (wiedervorlage === 'true') query = query.not('wiedervorlage_datum', 'is', null)
      }

      // Suchfilter
      if (search) {
        query = query.or(`unternehmensname.ilike.%${search}%,stadt.ilike.%${search}%`)
      }

      // Die eigenen Filter des Benutzers, jeder als eigene Bedingung.
      for (const f of eigeneFilter) {
        query = filterAnwenden(query, f)
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

      // Leads formatieren (nutzt formatLead Helper)
      const leads = leadsData.map(record => formatLead(record, assignmentMap))

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

      // Aendern darf, wem der Lead zugeteilt ist oder wer am Hot Lead dazu
      // arbeitet. Vorher jeder Angemeldete, an jedem Lead.
      if (!(await leadBeteiligt(supabase, angemeldet, leadId))) {
        return verboten('Dieser Lead gehört nicht zu deinen', 'nicht_beteiligt')
      }

      // Anrufversuch mitzaehlen: Wer ein Ergebnis dokumentiert oder den Lead
      // als kontaktiert markiert, hat angewaehlt. Der Hilfetext im CRM sagt
      // "Zaehlt jeden Anrufversuch automatisch. Niemand muss Striche machen" -
      // dafuer muss es jemand schreiben, und zwar hier und nicht in der Maske:
      // so zaehlt es unabhaengig davon, welche Ansicht speichert.
      const istAnrufversuch =
        updates.kontaktiert === true || typeof updates.ergebnis === 'string'

      if (istAnrufversuch) {
        try {
          await supabase.from('anrufversuche').insert({
            lead_id: leadId,
            anrufer_id: angemeldet.id,
            ergebnis: updates.ergebnis || null
          })
        } catch (e) {
          // Der Zaehler darf das Speichern des Leads nie verhindern.
          console.error('Anrufversuch konnte nicht erfasst werden:', e)
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
      // Der Ort war als Einziges der Kontaktdaten nicht zu aendern - im Setting
      // und Closing ging es laengst, im Opening fehlte das Feld ganz.
      if (updates.stadt !== undefined) {
        fieldsToUpdate.stadt = updates.stadt || null
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
          year: 'numeric',
          timeZone: 'Europe/Berlin'
        }) + ', ' + now.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Berlin'
        })

        const icons = {
          'email': '📧',
          'termin': '📅',
          'termin_manuell_verschoben': '🔄',
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

        // Der Name im Verlauf kommt aus der Anmeldung, nicht aus der Anfrage.
        const newEntry = `[${timestamp}] ${icon} ${historyEntry.details} (${angemeldet.name || historyEntry.userName})`

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
