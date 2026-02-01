// Lead-Anfragen API - Supabase Version
// GET: Anfragen laden (Admin: alle, Vertriebler: eigene)
// POST: Neue Anfrage erstellen
// PATCH: Anfrage bearbeiten (genehmigen/ablehnen)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Content-Type': 'application/json'
}

// Anfrage-ID generieren
function generateAnfrageId() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const mins = String(now.getMinutes()).padStart(2, '0')
  const secs = String(now.getSeconds()).padStart(2, '0')
  return 'ANF-' + year + month + day + '-' + hours + mins + secs
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

  try {
    // GET - Anfragen laden
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const userId = params.userId
      const status = params.status
      const isAdmin = params.isAdmin === 'true'

      let query = supabase
        .from('lead_requests')
        .select('*, user:users!lead_requests_user_id_fkey(id, vor_nachname), bearbeiter:users!lead_requests_bearbeitet_von_id_fkey(id, vor_nachname)')
        .order('erstellt_am', { ascending: false })

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      if (!isAdmin && userId) {
        query = query.eq('user_id', userId)
      }

      const { data: anfragenData, error } = await query

      if (error) throw new Error(error.message)

      const anfragen = (anfragenData || []).map(record => ({
        id: record.id,
        anfrageId: record.anfrage_id || '',
        userId: record.user_id || null,
        userName: record.user?.vor_nachname || 'Unbekannt',
        anzahl: record.anzahl || 0,
        nachricht: record.nachricht || '',
        status: record.status || 'Offen',
        erstelltAm: record.erstellt_am || null,
        bearbeitetVonId: record.bearbeitet_von_id || null,
        bearbeitetVonName: record.bearbeiter?.vor_nachname || '',
        bearbeitetAm: record.bearbeitet_am || null,
        genehmigteAnzahl: record.genehmigte_anzahl || null,
        adminKommentar: record.admin_kommentar || ''
      }))

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ anfragen })
      }
    }

    // POST - Neue Anfrage erstellen
    if (event.httpMethod === 'POST') {
      const { userId, anzahl, nachricht } = JSON.parse(event.body)

      if (!userId || !anzahl) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'User und Anzahl sind erforderlich' })
        }
      }

      // Prüfen ob bereits eine offene Anfrage existiert
      const { data: existing } = await supabase
        .from('lead_requests')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'Offen')
        .limit(1)

      if (existing && existing.length > 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Du hast bereits eine offene Anfrage' })
        }
      }

      const anfrageId = generateAnfrageId()

      const { data: newRequest, error } = await supabase
        .from('lead_requests')
        .insert({
          anfrage_id: anfrageId,
          user_id: userId,
          anzahl: parseInt(anzahl, 10),
          nachricht: nachricht || null,
          status: 'Offen'
        })
        .select()
        .single()

      if (error) throw new Error(error.message)

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          anfrage: { id: newRequest.id, anfrageId }
        })
      }
    }

    // PATCH - Anfrage bearbeiten (Admin)
    if (event.httpMethod === 'PATCH') {
      const { anfrageId, status, genehmigteAnzahl, adminKommentar, adminId } = JSON.parse(event.body)

      if (!anfrageId || !status) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Anfrage-ID und Status sind erforderlich' })
        }
      }

      const fields = {
        status,
        bearbeitet_am: new Date().toISOString()
      }

      if (adminId) fields.bearbeitet_von_id = adminId
      if (genehmigteAnzahl !== undefined && genehmigteAnzahl !== null) {
        fields.genehmigte_anzahl = parseInt(genehmigteAnzahl, 10)
      }
      if (adminKommentar) fields.admin_kommentar = adminKommentar

      const { data: updatedRequest, error } = await supabase
        .from('lead_requests')
        .update(fields)
        .eq('id', anfrageId)
        .select('*')
        .single()

      if (error) throw new Error(error.message)

      // Nach Genehmigung: Leads zuweisen
      let zugewieseneLeads = 0
      if (status === 'Genehmigt' || status === 'Teilweise_Genehmigt') {
        const anzahlZuweisen = genehmigteAnzahl || 0
        const userId = updatedRequest.user_id

        if (userId && anzahlZuweisen > 0) {
          try {
            zugewieseneLeads = await assignLeadsToUser(userId, anzahlZuweisen)
          } catch (e) {
            console.error('Lead-Zuweisung Fehler:', e)
          }
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          anfrage: { id: updatedRequest.id, status: updatedRequest.status },
          zugewieseneLeads
        })
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Lead-Requests Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}

async function assignLeadsToUser(userId, anzahl) {
  const { data: assignments } = await supabase
    .from('lead_assignments')
    .select('lead_id')

  const assignedLeadIds = (assignments || []).map(a => a.lead_id)

  const { data: allFreeLeads } = await supabase
    .from('leads')
    .select('id')
    .or('bereits_kontaktiert.is.null,bereits_kontaktiert.eq.false')
    .neq('ergebnis', 'Ungültiger Lead')
    .limit(anzahl * 2)

  const freeLeads = (allFreeLeads || [])
    .filter(l => !assignedLeadIds.includes(l.id))
    .slice(0, anzahl)

  if (freeLeads.length === 0) return 0

  const newAssignments = freeLeads.map(lead => ({
    lead_id: lead.id,
    user_id: userId
  }))

  const { error } = await supabase
    .from('lead_assignments')
    .insert(newAssignments)

  if (error) throw new Error(error.message)

  return freeLeads.length
}
