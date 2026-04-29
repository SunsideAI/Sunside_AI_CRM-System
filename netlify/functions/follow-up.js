// Follow-Up API - Admin-only
// GET: Follow-Up Leads laden (Hot Leads mit Status 'Wiedervorlage' oder 'Verloren')
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
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Content-Type': 'application/json'
}

// Admin-Check: User-Rolle über User-ID prüfen
async function isAdminUser(userId) {
  if (!userId) return false

  try {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('rollen')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      console.log('Admin check - User not found:', userId, userError)
      return false
    }

    const rollen = userData.rollen || []
    console.log('Admin check - User roles:', userId, rollen)
    return rollen.some(r => r.toLowerCase() === 'admin')
  } catch (err) {
    console.error('Admin check failed:', err)
    return false
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

  // Admin-Check für alle Methoden
  const isAdmin = await isAdminUser(userId)
  if (!isAdmin) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Zugriff verweigert. Nur Admins haben Zugriff.' })
    }
  }

  try {
    // ==========================================
    // GET: Follow-Up Leads laden
    // ==========================================
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const {
        closerId,
        followUpStatus,
        faelligBis,
        search,
        sortBy = 'created_at',
        sortDir = 'desc',
        limit = '100',
        offset = '0'
      } = params

      console.log('Follow-Up GET - Params:', params)

      // User-Map laden
      const userMap = await loadUserMap()

      // Hot Leads mit Status 'Wiedervorlage' oder 'Verloren' laden
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

      // Filter: Closer
      if (closerId && closerId !== 'all') {
        query = query.eq('closer_id', closerId)
      }

      // Filter: Follow-Up-Status
      if (followUpStatus && followUpStatus !== 'all') {
        query = query.eq('follow_up_status', followUpStatus)
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

      // Total Count für Pagination
      const { count: totalCount } = await supabase
        .from('hot_leads')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'Abgeschlossen')

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
        const allowedActionFields = ['erledigt', 'beschreibung', 'faellig_am', 'typ']
        const filteredUpdates = {}
        for (const key of allowedActionFields) {
          if (updates[key] !== undefined) {
            filteredUpdates[key] = updates[key]
          }
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
