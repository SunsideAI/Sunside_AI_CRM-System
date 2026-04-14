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
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('id')
      .or('bereits_kontaktiert.is.null,bereits_kontaktiert.eq.false')
      .neq('ergebnis', 'Ungültiger Lead')
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

  const userName = user.vor_nachname || 'Vertriebler'

  // Status-spezifische Texte
  let statusTitle, statusColor, statusIcon, mainMessage, subject
  if (status === 'Genehmigt') {
    statusTitle = 'Genehmigt ✓'
    statusColor = '#10B981'
    statusIcon = '✅'
    mainMessage = `Deine Anfrage über ${angefragt} Leads wurde genehmigt. ${zugewieseneLeads > 0 ? `${zugewieseneLeads} Leads wurden dir zugewiesen.` : ''}`
    subject = `✅ Deine Lead-Anfrage wurde genehmigt (${zugewieseneLeads} Leads)`
  } else if (status === 'Teilweise_Genehmigt') {
    statusTitle = 'Teilweise Genehmigt'
    statusColor = '#F59E0B'
    statusIcon = '⚠️'
    mainMessage = `Deine Anfrage wurde teilweise genehmigt. ${genehmigteAnzahl} von ${angefragt} Leads wurden dir zugewiesen.`
    subject = `⚠️ Lead-Anfrage teilweise genehmigt (${genehmigteAnzahl}/${angefragt})`
  } else if (status === 'Abgelehnt') {
    statusTitle = 'Abgelehnt'
    statusColor = '#EF4444'
    statusIcon = '❌'
    mainMessage = `Deine Anfrage über ${angefragt} Leads wurde leider abgelehnt.`
    subject = `❌ Deine Lead-Anfrage wurde abgelehnt`
  } else {
    return
  }

  // HTML Template
  const emailBody = buildUserNotificationHtml({
    userName, statusTitle, statusColor, statusIcon,
    mainMessage, adminKommentar
  })

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Sunside CRM <noreply@sunsideai.de>',
      to: [userEmail],
      subject,
      html: emailBody
    })
  })

  console.log(`[Lead-Requests] User-Benachrichtigung gesendet an ${userEmail}`)
}

// HTML-Template für User-Benachrichtigung
function buildUserNotificationHtml({ userName, statusTitle, statusColor, statusIcon, mainMessage, adminKommentar }) {
  const kommentarSection = adminKommentar
    ? `<div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin-top: 20px;">
        <strong style="color: #374151;">Kommentar vom Admin:</strong>
        <p style="color: #4B5563; margin: 8px 0 0 0;">${adminKommentar}</p>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">${statusIcon}</div>
      <h1 style="color: white; margin: 0; font-size: 24px;">Lead-Anfrage ${statusTitle}</h1>
    </div>
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        Hallo ${userName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        ${mainMessage}
      </p>
      ${kommentarSection}
      <div style="text-align: center; margin-top: 25px;">
        <a href="https://crm.sunside.ai/kaltakquise" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Zum CRM
        </a>
      </div>
    </div>
    <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 20px;">
      Sunside AI GbR | Schiefer Berg 3 | 38124 Braunschweig
    </p>
  </div>
</body>
</html>`
}
