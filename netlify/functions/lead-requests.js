// Lead-Anfragen API - Supabase Version
// GET: Anfragen laden (Admin: alle, Vertriebler: eigene)
// POST: Neue Anfrage erstellen
// PATCH: Anfrage bearbeiten (genehmigen/ablehnen)

import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'
import { systemMailSenden } from './utils/mailLayout.js'
import { leadAnfrageEntschieden } from './utils/mails.js'
import { darf, verboten } from './utils/zugriff.js'

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

  // Identitaet kommt aus dem Sitzungs-Token, nicht aus der Anfrage.
  const zugang = anmeldungVerlangen(event)
  if (zugang.antwort) return zugang.antwort
  const angemeldet = zugang.nutzer


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
      // Adminrechte kommen aus dem Token, nicht aus der Anfrage. Vorher
      // genuegte ?isAdmin=true, um alles zu sehen.
      const isAdmin = angemeldet.istAdmin
      // Und man sieht die eigenen Anfragen, nicht die eines beliebigen Nutzers.
      const userId = angemeldet.id
      const status = params.status

      console.log('[Lead-Requests GET] Params:', { userId, status, isAdmin })

      let query = supabase
        .from('lead_requests')
        .select('*, user:users!lead_requests_user_id_fkey(id, vor_nachname), bearbeiter:users!lead_requests_bearbeitet_von_fkey(id, vor_nachname)')
        .order('erstellt_am', { ascending: false })

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      if (!isAdmin && userId) {
        query = query.eq('user_id', userId)
      }

      const { data: anfragenData, error } = await query

      if (error) {
        console.error('[Lead-Requests GET] Error:', error)
        throw new Error(error.message)
      }

      console.log('[Lead-Requests GET] Found', anfragenData?.length || 0, 'requests')

      const anfragen = (anfragenData || []).map(record => ({
        id: record.id,
        anfrageId: record.anfrage_id || '',
        userId: record.user_id || null,
        userName: record.user?.vor_nachname || 'Unbekannt',
        anzahl: record.anzahl || 0,
        nachricht: record.nachricht || '',
        status: record.status || 'Offen',
        erstelltAm: record.erstellt_am || null,
        bearbeitetVonId: record.bearbeitet_von || null,
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
      if (!darf.opening(angemeldet)) return verboten('Leads fordern Opener an', 'rolle_fehlt')
      const { anzahl, nachricht } = JSON.parse(event.body)
      // Man stellt nur fuer sich selbst eine Anfrage.
      const userId = angemeldet.id

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

      // User-Namen laden für Benachrichtigung
      const { data: userData } = await supabase
        .from('users')
        .select('vor_nachname')
        .eq('id', userId)
        .single()

      const userName = userData?.vor_nachname || 'Ein Vertriebler'

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

      console.log('[Lead-Requests POST] Created request:', anfrageId, 'by', userName)

      // System Messages sind nicht mehr nötig - die Anfrage selbst erscheint als Benachrichtigung
      // im Layout.jsx (lädt lead_requests mit status='Offen' für Admins)

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
      const { anfrageId, status, genehmigteAnzahl, adminKommentar } = JSON.parse(event.body)
      // Wer entscheidet, steht im Token - nicht in der Anfrage.
      const adminId = angemeldet.id
      if (!angemeldet.istAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Nur die Leitung darf Lead-Anfragen entscheiden' })
        }
      }

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

      if (adminId) fields.bearbeitet_von = adminId
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

      // E-Mail-Benachrichtigung an den Anfragenden
      try {
        await sendUserNotification({
          userId: updatedRequest.user_id,
          status: updatedRequest.status,
          genehmigteAnzahl: updatedRequest.genehmigte_anzahl || updatedRequest.anzahl,
          angefragt: updatedRequest.anzahl,
          adminKommentar: updatedRequest.admin_kommentar,
          zugewieseneLeads
        })
      } catch (e) {
        console.error('User-Benachrichtigung fehlgeschlagen:', e)
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
  // Versuche zuerst die skalierbare RPC-Funktion zu verwenden
  const { data: freeLeads, error: rpcError } = await supabase
    .rpc('get_unassigned_leads', { requested_count: anzahl })

  if (rpcError) {
    // Fallback auf alte Methode wenn RPC nicht existiert (Migration noch nicht angewendet)
    console.warn('RPC get_unassigned_leads nicht verfügbar, verwende Fallback:', rpcError.message)
    return await assignLeadsToUserFallback(userId, anzahl)
  }

  if (!freeLeads || freeLeads.length === 0) return 0

  const newAssignments = freeLeads.map(lead => ({
    lead_id: lead.id,
    user_id: userId
  }))

  const { error } = await supabase
    .from('lead_assignments')
    .insert(newAssignments)

  if (error) throw new Error(error.message)

  console.log(`[Lead-Requests] ${freeLeads.length} Leads zugewiesen via RPC`)
  return freeLeads.length
}

// Fallback-Methode für Kompatibilität (vor Migration)
async function assignLeadsToUserFallback(userId, anzahl) {
  // KRITISCH: Pagination für lead_assignments wegen Supabase 1000-Row Limit!
  const pageSize = 1000
  let allAssignments = []
  let page = 0

  while (true) {
    const { data, error } = await supabase
      .from('lead_assignments')
      .select('lead_id')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) {
      console.error('Assignments laden fehlgeschlagen:', error)
      break
    }

    if (!data || data.length === 0) break
    allAssignments = allAssignments.concat(data)
    page++
    if (data.length < pageSize) break
  }

  console.log(`[Lead-Requests Fallback] ${allAssignments.length} Assignments geladen (${page} Seiten)`)

  const assignedLeadIds = new Set(allAssignments.map(a => a.lead_id))

  // Leads laden - auch mit Pagination falls nötig
  let freeLeads = []
  let leadPage = 0
  const neededLeads = anzahl

  while (freeLeads.length < neededLeads) {
    // WICHTIG: .neq() schließt NULL-Werte aus! Daher .or() mit is.null verwenden
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('id')
      .or('bereits_kontaktiert.is.null,bereits_kontaktiert.eq.false')
      .or('ergebnis.is.null,ergebnis.neq.Ungültiger Lead')
      .range(leadPage * pageSize, (leadPage + 1) * pageSize - 1)

    if (leadsError) {
      console.error('Leads laden fehlgeschlagen:', leadsError)
      break
    }

    if (!leadsData || leadsData.length === 0) break

    // Nur nicht-zugewiesene Leads sammeln
    for (const lead of leadsData) {
      if (!assignedLeadIds.has(lead.id)) {
        freeLeads.push(lead)
        if (freeLeads.length >= neededLeads) break
      }
    }

    leadPage++
    if (leadsData.length < pageSize) break
  }

  console.log(`[Lead-Requests Fallback] ${freeLeads.length} freie Leads gefunden`)

  if (freeLeads.length === 0) return 0

  const newAssignments = freeLeads.map(lead => ({
    lead_id: lead.id,
    user_id: userId
  }))

  const { error } = await supabase
    .from('lead_assignments')
    .insert(newAssignments)

  if (error) throw new Error(error.message)

  console.log(`[Lead-Requests] ${freeLeads.length} Leads zugewiesen via Fallback`)
  return freeLeads.length
}

// E-Mail-Benachrichtigung an den Anfragenden User
async function sendUserNotification({ userId, status, genehmigteAnzahl, angefragt, adminKommentar, zugewieseneLeads }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) return

  const { data: user } = await supabase
    .from('users')
    .select('vor_nachname, email_geschaeftlich, email')
    .eq('id', userId)
    .single()

  const userEmail = user?.email_geschaeftlich || user?.email
  if (!userEmail) return

  const inhalt = leadAnfrageEntschieden({
    status,
    angefragt,
    zugewiesen: status === 'Teilweise_Genehmigt' ? genehmigteAnzahl : zugewieseneLeads,
    kommentar: adminKommentar
  })
  if (!inhalt) return

  await systemMailSenden({ an: userEmail, betreff: inhalt.betreff, mail: inhalt.mail })

  console.log(`[Lead-Requests] User-Benachrichtigung gesendet an ${userEmail}`)
}

