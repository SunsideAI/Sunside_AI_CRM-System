// Follow-Up API - Admin + Closer
// GET: Follow-Up Leads laden (Hot Leads außer Abgeschlossen)
// GET ?kanban=true: Alle Actions für Kanban Board
// POST: Neue Action anlegen
// PATCH: Action oder Lead updaten

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json'
}

// User-Zugang prüfen: Admin hat vollen Zugriff, Closer nur auf eigene Leads
async function checkUserAccess(userId) {
  if (!userId) return { isAdmin: false, isCloser: false, closerId: null }

  try {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, rollen')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      console.log('User check - User not found:', userId, userError)
      return { isAdmin: false, isCloser: false, closerId: null }
    }

    const rollen = userData.rollen || []
    console.log('User check - Roles:', userId, rollen)

    const isAdmin = rollen.some(r => r.toLowerCase() === 'admin')
    const isCloser = rollen.some(r => r.toLowerCase() === 'closer')

    return {
      isAdmin,
      isCloser,
      closerId: isCloser ? userData.id : null
    }
  } catch (err) {
    console.error('User check failed:', err)
    return { isAdmin: false, isCloser: false, closerId: null }
  }
}

// User-Map laden für Namen-Auflösung
async function loadUserMap() {
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
  return userMap
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Server nicht konfiguriert' })
    }
  }

  // User-ID aus Query-Params oder Body extrahieren
  let userId = null
  if (event.httpMethod === 'GET') {
    userId = (event.queryStringParameters || {}).userId
  } else if (event.body) {
    try {
      const body = JSON.parse(event.body)
      userId = body.userId
    } catch (e) {}
  }

  // User-Zugang prüfen (Admin oder Closer)
  const { isAdmin, isCloser, closerId } = await checkUserAccess(userId)
  if (!isAdmin && !isCloser) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Zugriff verweigert. Nur Admins und Closer haben Zugriff.' })
    }
  }

  try {
    // ==========================================
    // GET: Follow-Up Leads laden ODER Kanban Actions
    // ==========================================
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const {
        kanban,
        closerId: filterCloserId,
        followUpStatus,
        faelligBis,
        search,
        sortBy = 'created_at',
        sortDir = 'desc',
        limit = '100',
        offset = '0'
      } = params

      console.log('Follow-Up GET - Params:', params, '- isAdmin:', isAdmin, '- isCloser:', isCloser)

      // User-Map laden
      const userMap = await loadUserMap()

      // ==========================================
      // KANBAN: Alle Actions für Board laden
      // ==========================================
      if (kanban === 'true') {
        let actionsQuery = supabase
          .from('follow_up_actions')
          .select(`
            id,
            hot_lead_id,
            typ,
            beschreibung,
            erledigt,
            faellig_am,
            kanban_status,
            erstellt_von,
            created_at
          `)
          .order('faellig_am', { ascending: true, nullsFirst: false })

        const { data: actionsData, error: actionsError } = await actionsQuery

        if (actionsError) {
          console.error('Kanban Actions Error:', actionsError)
          throw new Error(actionsError.message || 'Fehler beim Laden der Actions')
        }

        // Lead-Infos für jede Action laden
        const leadIds = [...new Set((actionsData || []).map(a => a.hot_lead_id))]

        let leadsQuery = supabase
          .from('hot_leads')
          .select('id, unternehmen, closer_id')
          .in('id', leadIds)
          .neq('status', 'Abgeschlossen')

        // Closer sieht nur eigene Leads
        if (isCloser && !isAdmin) {
          leadsQuery = leadsQuery.eq('closer_id', closerId)
        }

        const { data: leadsData } = await leadsQuery

        const leadsMap = {}
        ;(leadsData || []).forEach(lead => {
          leadsMap[lead.id] = lead
        })

        // Actions mit Lead-Info anreichern (nur Actions für sichtbare Leads)
        const actionsWithLeads = (actionsData || [])
          .filter(action => leadsMap[action.hot_lead_id])
          .map(action => ({
            ...action,
            kanban_status: action.kanban_status || 'offen',
            erstellt_von_name: action.erstellt_von ? userMap[action.erstellt_von] : null,
            hot_lead: leadsMap[action.hot_lead_id]
          }))

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ actions: actionsWithLeads })
        }
      }

      // ==========================================
      // STANDARD: Hot Leads laden
      // ==========================================
      let query = supabase
        .from('hot_leads')
        .select(`
          id,
          unternehmen,
          ansprechpartner_vorname,
          ansprechpartner_nachname,
          telefonnummer,
          mail,
          website,
          status,
          kommentar,
          follow_up_status,
          follow_up_naechster_schritt,
          follow_up_datum,
          setter_id,
          closer_id,
          created_at
        `)
        .neq('status', 'Abgeschlossen')

      // Closer sieht nur eigene Leads
      if (isCloser && !isAdmin) {
        query = query.eq('closer_id', closerId)
      } else if (filterCloserId && filterCloserId !== 'all') {
        // Admin kann nach Closer filtern
        query = query.eq('closer_id', filterCloserId)
      }

      // Filter: Follow-Up-Status (NULL wird als 'aktiv' behandelt)
      if (followUpStatus && followUpStatus !== 'all') {
        if (followUpStatus === 'aktiv') {
          // Aktiv = explizit 'aktiv' ODER NULL (Default)
          query = query.or('follow_up_status.eq.aktiv,follow_up_status.is.null')
        } else {
          query = query.eq('follow_up_status', followUpStatus)
        }
      }

      // Filter: Fälligkeit
      if (faelligBis) {
        query = query.lte('follow_up_datum', faelligBis)
      }

      // Filter: Suche
      if (search) {
        query = query.ilike('unternehmen', `%${search}%`)
      }

      // Sortierung
      const validSortColumns = ['follow_up_datum', 'unternehmen', 'created_at']
      const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'follow_up_datum'
      const ascending = sortDir === 'asc'

      // NULL-Werte bei follow_up_datum ans Ende sortieren
      if (sortColumn === 'follow_up_datum') {
        query = query.order('follow_up_datum', { ascending, nullsFirst: false })
      } else {
        query = query.order(sortColumn, { ascending })
      }

      // Pagination
      const limitNum = Math.min(parseInt(limit) || 100, 500)
      const offsetNum = parseInt(offset) || 0
      query = query.range(offsetNum, offsetNum + limitNum - 1)

      const { data: hotLeadsData, error: hotLeadsError, count } = await query

      if (hotLeadsError) {
        console.error('Follow-Up GET Error:', hotLeadsError)
        throw new Error(hotLeadsError.message || 'Fehler beim Laden der Follow-Up Leads')
      }

      // Total Count für Pagination (respektiert Closer-Filter)
      let countQuery = supabase
        .from('hot_leads')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'Abgeschlossen')

      if (isCloser && !isAdmin) {
        countQuery = countQuery.eq('closer_id', closerId)
      }

      const { count: totalCount } = await countQuery

      // Actions für jeden Lead laden (letzte 5 + nächste offene)
      const leadsWithActions = await Promise.all(
        (hotLeadsData || []).map(async (lead) => {
          // Letzte 5 Actions
          const { data: actions } = await supabase
            .from('follow_up_actions')
            .select('*')
            .eq('hot_lead_id', lead.id)
            .order('created_at', { ascending: false })
            .limit(5)

          // Nächste offene Action (nicht erledigt, frühestes Datum)
          const { data: nextAction } = await supabase
            .from('follow_up_actions')
            .select('*')
            .eq('hot_lead_id', lead.id)
            .eq('erledigt', false)
            .not('faellig_am', 'is', null)
            .order('faellig_am', { ascending: true })
            .limit(1)

          // Actions mit User-Namen anreichern
          const formattedActions = (actions || []).map(action => ({
            id: action.id,
            typ: action.typ,
            beschreibung: action.beschreibung,
            erledigt: action.erledigt,
            faellig_am: action.faellig_am,
            erstellt_von_name: action.erstellt_von ? userMap[action.erstellt_von] : null,
            created_at: action.created_at
          }))

          return {
            id: lead.id,
            unternehmen: lead.unternehmen || '',
            ansprechpartner_vorname: lead.ansprechpartner_vorname || '',
            ansprechpartner_nachname: lead.ansprechpartner_nachname || '',
            telefonnummer: lead.telefonnummer || '',
            mail: lead.mail || '',
            website: lead.website || '',
            status: lead.status,
            kommentar: lead.kommentar || '',
            follow_up_status: lead.follow_up_status || 'aktiv',
            follow_up_naechster_schritt: lead.follow_up_naechster_schritt || '',
            follow_up_datum: lead.follow_up_datum,
            setter_name: lead.setter_id ? userMap[lead.setter_id] : '',
            closer_name: lead.closer_id ? userMap[lead.closer_id] : '',
            setter_id: lead.setter_id,
            closer_id: lead.closer_id,
            letzte_aktionen: formattedActions,
            naechste_aktion: nextAction?.[0] ? {
              id: nextAction[0].id,
              typ: nextAction[0].typ,
              beschreibung: nextAction[0].beschreibung,
              faellig_am: nextAction[0].faellig_am
            } : null
          }
        })
      )

      // Closers-Liste für Filter-Dropdown
      const closerIds = [...new Set((hotLeadsData || []).map(l => l.closer_id).filter(Boolean))]
      const closers = closerIds.map(id => ({
        id,
        name: userMap[id] || 'Unbekannt'
      }))

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          leads: leadsWithActions,
          total: totalCount || 0,
          closers
        })
      }
    }

    // ==========================================
    // POST: Neue Action anlegen
    // ==========================================
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body)
      const { hotLeadId, typ, beschreibung, faelligAm, erstelltVon, naechsterSchritt, naechstesDatum } = body

      if (!hotLeadId || !typ || !beschreibung) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'hotLeadId, typ und beschreibung sind erforderlich' })
        }
      }

      console.log('Follow-Up POST - Create Action:', { hotLeadId, typ })

      // Neue Action anlegen
      const { data: newAction, error: actionError } = await supabase
        .from('follow_up_actions')
        .insert({
          hot_lead_id: hotLeadId,
          typ,
          beschreibung,
          faellig_am: faelligAm || null,
          erstellt_von: erstelltVon || null,
          erledigt: false
        })
        .select()
        .single()

      if (actionError) {
        console.error('Create Action Error:', actionError)
        throw new Error(actionError.message || 'Fehler beim Anlegen der Action')
      }

      // Optional: Hot Lead Follow-Up-Felder parallel updaten
      if (naechsterSchritt !== undefined || naechstesDatum !== undefined) {
        const updates = {}
        if (naechsterSchritt !== undefined) updates.follow_up_naechster_schritt = naechsterSchritt
        if (naechstesDatum !== undefined) updates.follow_up_datum = naechstesDatum

        const { error: leadUpdateError } = await supabase
          .from('hot_leads')
          .update(updates)
          .eq('id', hotLeadId)

        if (leadUpdateError) {
          console.warn('Lead Update Warning:', leadUpdateError)
        }
      }

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ action: newAction })
      }
    }

    // ==========================================
    // PATCH: Action oder Lead updaten
    // ==========================================
    if (event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body)
      const { actionId, hotLeadId, updates } = body

      if (!actionId && !hotLeadId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'actionId oder hotLeadId ist erforderlich' })
        }
      }

      if (!updates || typeof updates !== 'object') {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'updates-Objekt ist erforderlich' })
        }
      }

      console.log('Follow-Up PATCH:', { actionId, hotLeadId, updates })

      // Action updaten
      if (actionId) {
        const allowedActionFields = ['erledigt', 'beschreibung', 'faellig_am', 'typ', 'kanban_status']
        const filteredUpdates = {}
        for (const key of allowedActionFields) {
          if (updates[key] !== undefined) {
            filteredUpdates[key] = updates[key]
          }
        }

        // Bidirektionaler Sync: kanban_status ↔ erledigt
        // kanban_status → erledigt
        if (filteredUpdates.kanban_status === 'erledigt') {
          filteredUpdates.erledigt = true
        } else if (filteredUpdates.kanban_status && filteredUpdates.kanban_status !== 'erledigt') {
          filteredUpdates.erledigt = false
        }
        // erledigt → kanban_status (wenn nicht explizit gesetzt)
        if (filteredUpdates.erledigt === true && !filteredUpdates.kanban_status) {
          filteredUpdates.kanban_status = 'erledigt'
        }
        if (filteredUpdates.erledigt === false && !filteredUpdates.kanban_status) {
          filteredUpdates.kanban_status = 'offen'
        }

        const { data: updatedAction, error: actionError } = await supabase
          .from('follow_up_actions')
          .update(filteredUpdates)
          .eq('id', actionId)
          .select()
          .single()

        if (actionError) {
          console.error('Update Action Error:', actionError)
          throw new Error(actionError.message || 'Fehler beim Aktualisieren der Action')
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ action: updatedAction })
        }
      }

      // Hot Lead Follow-Up-Felder updaten
      if (hotLeadId) {
        const allowedLeadFields = ['follow_up_status', 'follow_up_naechster_schritt', 'follow_up_datum', 'kommentar']
        const filteredUpdates = {}
        for (const key of allowedLeadFields) {
          if (updates[key] !== undefined) {
            filteredUpdates[key] = updates[key]
          }
        }

        const { data: updatedLead, error: leadError } = await supabase
          .from('hot_leads')
          .update(filteredUpdates)
          .eq('id', hotLeadId)
          .select()
          .single()

        if (leadError) {
          console.error('Update Lead Error:', leadError)
          throw new Error(leadError.message || 'Fehler beim Aktualisieren des Leads')
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ lead: updatedLead })
        }
      }
    }

    // ==========================================
    // DELETE: Action löschen
    // ==========================================
    if (event.httpMethod === 'DELETE') {
      const body = JSON.parse(event.body)
      const { actionId } = body

      if (!actionId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'actionId ist erforderlich' })
        }
      }

      console.log('Follow-Up DELETE - Action:', actionId)

      const { error } = await supabase
        .from('follow_up_actions')
        .delete()
        .eq('id', actionId)

      if (error) {
        console.error('Delete Action Error:', error)
        throw new Error(error.message || 'Fehler beim Löschen der Action')
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ deleted: true })
      }
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Follow-Up Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || 'Interner Serverfehler' })
    }
  }
}
