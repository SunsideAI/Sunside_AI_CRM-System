// Hot Leads API - Supabase Version
// GET: Hot Leads laden (für Closing-Seite und Dashboard)
// POST: Neuen Hot Lead erstellen (bei Termin-Buchung) oder Closer-Leads freigeben
// PATCH: Hot Lead aktualisieren (Status, Deal-Werte)

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

// User ID nach Name finden
async function getUserIdByName(userName) {
  if (!userName) return null

  const { data, error } = await supabase
    .from('users')
    .select('id')
    .ilike('vor_nachname', userName)
    .limit(1)

  if (error || !data || data.length === 0) return null
  return data[0].id
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
    // ==========================================
    // GET: Hot Leads laden
    // ==========================================
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const { setterId, closerId, setterName, closerName, status, limit, pool } = params

      console.log('Hot Leads GET - Params:', { setterId, closerId, setterName, closerName, status, limit, pool })

      // User-Map laden
      const userMap = await loadUserMap()

      // Basis-Query mit Joins zu users und leads
      let query = supabase
        .from('hot_leads')
        .select(`
          *,
          setter:users!hot_leads_setter_id_fkey(id, vor_nachname),
          closer:users!hot_leads_closer_id_fkey(id, vor_nachname),
          original_lead:leads!hot_leads_lead_id_fkey(
            id, unternehmensname, ansprechpartner_vorname, ansprechpartner_nachname,
            kategorie, mail, telefonnummer, stadt, bundesland, website, kommentar
          ),
          hot_lead_attachments(id, file_url, file_name, file_size, mime_type)
        `)

      // Pool-Filter: Termine ohne Closer (offene Termine für Closer-Pool)
      if (pool === 'true') {
        query = query.is('closer_id', null)
      }

      // Setter-Filter
      if (setterId) {
        query = query.eq('setter_id', setterId)
      } else if (setterName) {
        const sid = await getUserIdByName(setterName)
        if (sid) query = query.eq('setter_id', sid)
      }

      // Closer-Filter
      if (closerId) {
        query = query.eq('closer_id', closerId)
      } else if (closerName) {
        const cid = await getUserIdByName(closerName)
        if (cid) query = query.eq('closer_id', cid)
      }

      // Status-Filter
      if (status) {
        const statusList = status.split(',').map(s => s.trim())
        query = query.in('status', statusList)
      }

      // Sortierung
      query = query.order('unternehmen', { ascending: true })

      // Limit
      if (limit) {
        query = query.limit(parseInt(limit))
      }

      const { data: hotLeadsData, error } = await query

      if (error) {
        console.error('Hot Leads GET Error:', error)
        throw new Error(error.message || 'Fehler beim Laden der Hot Leads')
      }

      // Records formatieren
      const hotLeads = hotLeadsData.map(record => {
        const originalLead = record.original_lead || {}

        return {
          id: record.id,
          unternehmen: record.unternehmen || originalLead.unternehmensname || '',
          ansprechpartnerVorname: record.ansprechpartner_vorname || originalLead.ansprechpartner_vorname || '',
          ansprechpartnerNachname: record.ansprechpartner_nachname || originalLead.ansprechpartner_nachname || '',
          kategorie: record.kategorie || originalLead.kategorie || '',
          email: record.mail || originalLead.mail || '',
          telefon: record.telefonnummer || originalLead.telefonnummer || '',
          ort: record.ort || originalLead.stadt || '',
          bundesland: record.bundesland || originalLead.bundesland || '',
          website: record.website || originalLead.website || '',
          terminDatum: record.termin_beratungsgespraech || '',
          terminart: record.terminart || '',
          meetingLink: record.meeting_link || '',
          status: record.status || 'Lead',
          quelle: record.quelle || '',
          prioritaet: record.prioritaet || '',
          setup: record.setup || 0,
          retainer: record.retainer || 0,
          laufzeit: record.laufzeit || 0,
          monatlicheBesuche: record.monatliche_besuche || originalLead.monatliche_besuche || 0,
          mehrwert: record.mehrwert || originalLead.mehrwert || 0,
          absprungrate: record.absprungrate || originalLead.absprungrate || null,
          anzahlLeads: record.anzahl_leads || originalLead.anzahl_leads || null,
          produktDienstleistung: record.produkt_dienstleistung || [],
          kommentar: originalLead.kommentar || '',
          kundeSeit: record.kunde_seit || '',
          attachments: (record.hot_lead_attachments || []).map(att => ({
            id: att.id,
            url: att.file_url,
            filename: att.file_name,
            size: att.file_size,
            type: att.mime_type
          })),
          originalLeadId: record.lead_id || null,
          setterId: record.setter_id || null,
          closerId: record.closer_id || null,
          setterName: record.setter?.vor_nachname || '',
          closerName: record.closer?.vor_nachname || ''
        }
      })

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ hotLeads })
      }
    }

    // ==========================================
    // POST: Neuen Hot Lead erstellen ODER Closer-Leads freigeben
    // ==========================================
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body)

      // ==========================================
      // ACTION: release-closer-leads - Alle Hot Leads eines Closers in Pool zurückgeben
      // ==========================================
      if (body.action === 'release-closer-leads') {
        const { closerId, closerName } = body

        if (!closerId && !closerName) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'closerId oder closerName ist erforderlich' })
          }
        }

        console.log('Release Closer Leads:', { closerId, closerName })

        // Closer-ID ermitteln
        let targetCloserId = closerId
        let targetCloserName = closerName

        if (!targetCloserId && closerName) {
          targetCloserId = await getUserIdByName(closerName)
        }

        if (!targetCloserId) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Closer nicht gefunden' })
          }
        }

        // Closer-Name laden
        if (!targetCloserName) {
          const userMap = await loadUserMap()
          targetCloserName = userMap[targetCloserId] || 'Unbekannt'
        }

        console.log('Target Closer:', { targetCloserId, targetCloserName })

        // Hot Leads des Closers finden
        const { data: closerLeads, error: findError } = await supabase
          .from('hot_leads')
          .select('id, unternehmen, termin_beratungsgespraech')
          .eq('closer_id', targetCloserId)

        if (findError) {
          throw new Error(findError.message)
        }

        if (!closerLeads || closerLeads.length === 0) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: true,
              message: 'Keine Hot Leads zum Freigeben gefunden',
              released: 0,
              total: 0
            })
          }
        }

        // Closer-Feld leeren (zurück in Pool)
        const leadIds = closerLeads.map(l => l.id)
        const { error: updateError } = await supabase
          .from('hot_leads')
          .update({ closer_id: null })
          .in('id', leadIds)

        if (updateError) {
          throw new Error(updateError.message)
        }

        console.log(`${closerLeads.length} Hot Leads in Pool freigegeben`)

        // Email-Benachrichtigung an alle aktiven Closer senden
        if (closerLeads.length > 0 && process.env.RESEND_API_KEY) {
          try {
            const { data: activeClosers } = await supabase
              .from('users')
              .select('id, email, vor_nachname, rollen, status')
              .eq('status', true)

            const closerUsers = (activeClosers || []).filter(user => {
              const rollen = user.rollen || []
              const isCloser = rollen.some(r =>
                r.toLowerCase().includes('closer') || r.toLowerCase() === 'admin'
              )
              return isCloser && user.id !== targetCloserId && user.email
            })

            for (const closer of closerUsers) {
              const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Neue Leads im Pool</h1>
    </div>
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        <strong>${targetCloserName}</strong> wurde deaktiviert.
        <strong style="color: #3B82F6;">${closerLeads.length} Beratungsgespraeche</strong> sind jetzt im Closer-Pool verfuegbar.
      </p>
      <div style="text-align: center; margin-top: 25px;">
        <a href="https://crm.sunside.ai/closing" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Zum Closer-Pool
        </a>
      </div>
    </div>
  </div>
</body>
</html>`

              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  from: 'Sunside AI <noreply@sunside.ai>',
                  to: closer.email,
                  subject: `${closerLeads.length} neue Leads im Closer-Pool`,
                  html: emailHtml
                })
              })
            }
          } catch (emailError) {
            console.error('Email-Benachrichtigung fehlgeschlagen:', emailError)
          }
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            message: `${closerLeads.length} Hot Leads in Pool freigegeben`,
            released: closerLeads.length,
            total: closerLeads.length,
            closerName: targetCloserName
          })
        }
      }

      // ==========================================
      // Standard POST: Neuen Hot Lead erstellen
      // ==========================================
      const {
        originalLeadId,
        setterName,
        closerName,
        setterId,
        closerId,
        unternehmen,
        terminDatum,
        terminart,
        quelle,
        meetingLink
      } = body

      console.log('Hot Lead POST - Input:', {
        originalLeadId, setterName, closerName, setterId, closerId,
        terminDatum, terminart, meetingLink
      })

      // Validierung
      if (!originalLeadId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'originalLeadId ist erforderlich' })
        }
      }

      if (!setterName && !setterId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'setterName oder setterId ist erforderlich' })
        }
      }

      if (!terminDatum) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'terminDatum ist erforderlich' })
        }
      }

      // Duplikat-Prüfung
      const { data: existing } = await supabase
        .from('hot_leads')
        .select('id')
        .eq('lead_id', originalLeadId)
        .limit(1)

      if (existing && existing.length > 0) {
        return {
          statusCode: 409,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Hot Lead existiert bereits',
            message: 'Für diesen Lead wurde bereits ein Beratungsgespräch gebucht.',
            existingHotLeadId: existing[0].id
          })
        }
      }

      // Setter-ID ermitteln
      let setterRecordId = setterId
      if (!setterRecordId && setterName) {
        setterRecordId = await getUserIdByName(setterName)
      }

      // Closer-ID ermitteln (optional - für Pool-Termine)
      let closerRecordId = closerId
      if (!closerRecordId && closerName) {
        closerRecordId = await getUserIdByName(closerName)
      }

      // Hot Lead erstellen
      const hotLeadData = {
        lead_id: originalLeadId,
        unternehmen: unternehmen || '',
        termin_beratungsgespraech: terminDatum,
        status: 'Lead',
        quelle: quelle || 'Kaltakquise',
        setter_id: setterRecordId || null,
        closer_id: closerRecordId || null
      }

      if (terminart) hotLeadData.terminart = terminart
      if (meetingLink) hotLeadData.meeting_link = meetingLink

      console.log('Creating Hot Lead:', hotLeadData)

      const { data: newHotLead, error } = await supabase
        .from('hot_leads')
        .insert(hotLeadData)
        .select()
        .single()

      if (error) {
        console.error('Create Hot Lead Error:', error)
        throw new Error(error.message || 'Hot Lead konnte nicht erstellt werden')
      }

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Hot Lead erfolgreich erstellt',
          hotLeadId: newHotLead.id
        })
      }
    }

    // ==========================================
    // PATCH: Hot Lead aktualisieren
    // ==========================================
    if (event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body)
      const { hotLeadId, updates } = body

      if (!hotLeadId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'hotLeadId ist erforderlich' })
        }
      }

      // Felder mappen
      const fieldMap = {
        'status': 'status',
        'setup': 'setup',
        'retainer': 'retainer',
        'laufzeit': 'laufzeit',
        'produktDienstleistung': 'produkt_dienstleistung',
        'kundeSeit': 'kunde_seit',
        'prioritaet': 'prioritaet',
        'closerId': 'closer_id',
        'terminDatum': 'termin_beratungsgespraech',
        'terminart': 'terminart',
        'meetingLink': 'meeting_link'
      }

      const fields = {}

      for (const [key, value] of Object.entries(updates)) {
        const dbField = fieldMap[key]
        if (dbField) {
          // Closer nach Name auflösen
          if (key === 'closerName' && value) {
            const cid = await getUserIdByName(value)
            if (cid) fields.closer_id = cid
          } else {
            fields[dbField] = value
          }
        }
      }

      if (Object.keys(fields).length === 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Keine gültigen Update-Felder' })
        }
      }

      console.log('Updating Hot Lead:', hotLeadId, fields)

      const { data, error } = await supabase
        .from('hot_leads')
        .update(fields)
        .eq('id', hotLeadId)
        .select()
        .single()

      if (error) {
        console.error('Update Hot Lead Error:', error)
        throw new Error(error.message || 'Hot Lead konnte nicht aktualisiert werden')
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Hot Lead aktualisiert',
          hotLeadId: data.id
        })
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Hot Leads Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}
