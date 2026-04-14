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

// Helper: Array zu String konvertieren (falls Airtable-Migration Arrays hinterlassen hat)
// Behandelt: echte Arrays, JSON-Strings mit Arrays, normale Strings
function arrayToString(value) {
  if (!value) return ''

  // Echtes Array
  if (Array.isArray(value)) {
    return value.join(' ').trim()
  }

  // String der wie ein JSON-Array aussieht: '["value"]' oder '["val1", "val2"]'
  const strValue = String(value).trim()
  if (strValue.startsWith('[') && strValue.endsWith(']')) {
    try {
      const parsed = JSON.parse(strValue)
      if (Array.isArray(parsed)) {
        return parsed.join(' ').trim()
      }
    } catch (e) {
      // Kein gültiges JSON, normalen String zurückgeben
    }
  }

  return strValue
}

// Helper: Array zu Zahl konvertieren (für numerische Felder aus Airtable-Migration)
function arrayToNumber(value, defaultValue = 0) {
  if (value === null || value === undefined) return defaultValue

  // Bereits eine Zahl
  if (typeof value === 'number') return value

  // Echtes Array - erstes Element nehmen
  if (Array.isArray(value)) {
    const first = value[0]
    const num = parseFloat(first)
    return isNaN(num) ? defaultValue : num
  }

  // String der wie ein JSON-Array aussieht: '[150]' oder '[1800]'
  const strValue = String(value).trim()
  if (strValue.startsWith('[') && strValue.endsWith(']')) {
    try {
      const parsed = JSON.parse(strValue)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const num = parseFloat(parsed[0])
        return isNaN(num) ? defaultValue : num
      }
    } catch (e) {
      // Kein gültiges JSON
    }
  }

  // Normaler String zu Zahl
  const num = parseFloat(strValue)
  return isNaN(num) ? defaultValue : num
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

      // Hot Leads mit Pagination laden (Supabase 1000er Server-Limit!)
      // Hinweis: Attachments werden jetzt aus dem JSONB-Feld 'attachments' gelesen, nicht aus separater Tabelle
      let hotLeadsData = []
      const pageSize = 1000
      let page = 0
      const maxLimit = limit ? parseInt(limit) : 10000

      // Filter-Werte vorberechnen
      let setterIdFilter = setterId
      let closerIdFilter = closerId

      if (!setterIdFilter && setterName) {
        setterIdFilter = await getUserIdByName(setterName)
      }
      if (!closerIdFilter && closerName) {
        closerIdFilter = await getUserIdByName(closerName)
      }

      while (hotLeadsData.length < maxLimit) {
        let query = supabase
          .from('hot_leads')
          .select(`
            *,
            setter:users!hot_leads_setter_id_fkey(id, vor_nachname),
            closer:users!hot_leads_closer_id_fkey(id, vor_nachname),
            original_lead:leads!hot_leads_lead_id_fkey(
              id, unternehmensname, ansprechpartner_vorname, ansprechpartner_nachname,
              kategorie, mail, telefonnummer, stadt, website, kommentar,
              monatliche_besuche, mehrwert, absprungrate, anzahl_leads
            )
          `)

        // Pool-Filter: Termine ohne Closer (offene Termine für Closer-Pool)
        if (pool === 'true') {
          query = query.is('closer_id', null)
        }

        // Setter-Filter
        if (setterIdFilter) {
          query = query.eq('setter_id', setterIdFilter)
        }

        // Closer-Filter
        if (closerIdFilter) {
          query = query.eq('closer_id', closerIdFilter)
        }

        // Status-Filter
        if (status) {
          const statusList = status.split(',').map(s => s.trim())
          query = query.in('status', statusList)
        }

        // Sortierung und Pagination
        query = query.order('unternehmen', { ascending: true })
        query = query.range(page * pageSize, (page + 1) * pageSize - 1)

        const { data, error } = await query

        if (error) {
          console.error('Hot Leads GET Error:', error)
          throw new Error(error.message || 'Fehler beim Laden der Hot Leads')
        }

        if (!data || data.length === 0) break

        hotLeadsData = hotLeadsData.concat(data)
        page++
        if (data.length < pageSize) break
      }

      console.log(`Hot Leads: ${hotLeadsData.length} Einträge geladen (${page} Seiten)`)

      // Records formatieren
      const hotLeads = hotLeadsData.map(record => {
        const originalLead = record.original_lead || {}

        return {
          id: record.id,
          unternehmen: arrayToString(record.unternehmen) || arrayToString(originalLead.unternehmensname) || '',
          ansprechpartnerVorname: arrayToString(record.ansprechpartner_vorname) || arrayToString(originalLead.ansprechpartner_vorname) || '',
          ansprechpartnerNachname: arrayToString(record.ansprechpartner_nachname) || arrayToString(originalLead.ansprechpartner_nachname) || '',
          kategorie: arrayToString(record.kategorie) || arrayToString(originalLead.kategorie) || '',
          email: arrayToString(record.mail) || arrayToString(originalLead.mail) || '',
          telefon: arrayToString(record.telefonnummer) || arrayToString(originalLead.telefonnummer) || '',
          ort: arrayToString(record.ort) || arrayToString(originalLead.stadt) || '',
          bundesland: arrayToString(record.bundesland) || arrayToString(originalLead.bundesland) || '',
          website: arrayToString(record.website) || arrayToString(originalLead.website) || '',
          terminDatum: record.termin_beratungsgespraech || '',
          terminart: record.terminart || '',
          meetingLink: record.meeting_link || '',
          status: record.status || 'Lead',
          quelle: record.quelle || '',
          prioritaet: record.prioritaet || '',
          setup: record.setup || 0,
          retainer: record.retainer || 0,
          websiteSetup: record.website_setup || 0,
          laufzeit: record.laufzeit || 0,
          monatlicheBesuche: arrayToNumber(record.monatliche_besuche) || arrayToNumber(originalLead.monatliche_besuche) || 0,
          mehrwert: arrayToNumber(record.mehrwert) || arrayToNumber(originalLead.mehrwert) || 0,
          absprungrate: arrayToNumber(record.absprungrate, null) ?? arrayToNumber(originalLead.absprungrate, null),
          anzahlLeads: arrayToNumber(record.anzahl_leads, null) ?? arrayToNumber(originalLead.anzahl_leads, null),
          produktDienstleistung: record.produkt_dienstleistung || [],
          kommentar: record.kommentar || originalLead.kommentar || '',
          kundeSeit: record.kunde_seit || '',
          // Angebot konfigurieren - Felder
          vertragsbestandteile: record.vertragsbestandteile || '',
          paketname: record.paketname_individuell || '',
          kurzbeschreibung: record.kurzbeschreibung || '',
          leistungsbeschreibung: record.leistungsbeschreibung || '',
          // Attachments aus JSONB-Feld (nicht mehr aus separater Tabelle)
          attachments: Array.isArray(record.attachments) ? record.attachments : [],
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

        // Hot Leads des Closers finden (mit Pagination - Supabase 1000er Server-Limit!)
        let closerLeads = []
        const closerPageSize = 1000
        let closerPage = 0

        while (true) {
          const { data, error: findError } = await supabase
            .from('hot_leads')
            .select('id, unternehmen, termin_beratungsgespraech')
            .eq('closer_id', targetCloserId)
            .range(closerPage * closerPageSize, (closerPage + 1) * closerPageSize - 1)

          if (findError) {
            throw new Error(findError.message)
          }

          if (!data || data.length === 0) break

          closerLeads = closerLeads.concat(data)
          closerPage++
          if (data.length < closerPageSize) break
        }

        if (closerLeads.length === 0) {
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
        'websiteSetup': 'website_setup',
        'laufzeit': 'laufzeit',
        'produktDienstleistung': 'produkt_dienstleistung',
        'kundeSeit': 'kunde_seit',
        'prioritaet': 'prioritaet',
        'closerId': 'closer_id',
        'closerName': 'closer_id',  // Wird im Spezialcode zu closer_id aufgelöst
        'terminDatum': 'termin_beratungsgespraech',
        'terminart': 'terminart',
        'meetingLink': 'meeting_link',
        // Angebot konfigurieren - Felder
        'vertragsbestandteile': 'vertragsbestandteile',
        'paketname': 'paketname_individuell',
        'kurzbeschreibung': 'kurzbeschreibung',
        'leistungsbeschreibung': 'leistungsbeschreibung',
        // Eigene Felder (nicht mehr Lookup)
        'kommentar': 'kommentar',
        'attachments': 'attachments'
      }

      const fields = {}

      for (const [key, value] of Object.entries(updates)) {
        const dbField = fieldMap[key]
        if (dbField) {
          // Closer nach Name auflösen
          if (key === 'closerName' && value) {
            const cid = await getUserIdByName(value)
            if (cid) fields.closer_id = cid
            continue
          }
          // Spezialbehandlung für produkt_dienstleistung (TEXT[] in DB)
          if (dbField === 'produkt_dienstleistung') {
            fields[dbField] = Array.isArray(value) ? value : (value ? [value] : null)
            continue
          }
          fields[dbField] = value
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
        .select('*, closer:users!hot_leads_closer_id_fkey(vor_nachname)')
        .single()

      if (error) {
        console.error('Update Hot Lead Error:', error)
        throw new Error(error.message || 'Hot Lead konnte nicht aktualisiert werden')
      }

      // Zapier-Webhook für Angebotsversand (wenn Status auf 'Angebot' gesetzt wird)
      if (fields.status === 'Angebot' && data) {
        try {
          const zapierPayload = {
            // Kontaktdaten
            name: arrayToString(data.ansprechpartner_nachname) || '',
            vorname: arrayToString(data.ansprechpartner_vorname) || '',
            unternehmensname: arrayToString(data.unternehmen) || '',
            telefonnummer: arrayToString(data.telefon) || '',
            email: arrayToString(data.email) || '',
            // Bearbeiter
            Bearbeiter: data.closer?.vor_nachname || '',
            // Angebotsdaten
            retainer: data.retainer || 0,
            setup: data.setup || 0,
            laufzeit: data.laufzeit || 12,
            kategorie: arrayToString(data.kategorie) || '',
            paket: Array.isArray(data.produkt_dienstleistung)
              ? data.produkt_dienstleistung[0] || ''
              : data.produkt_dienstleistung || '',
            vertragsbestandteile: data.vertragsbestandteile || '',
            // Individuelle Felder
            paketname: data.paketname_individuell || '',
            leistungsbeschreibung: data.leistungsbeschreibung || '',
            kurzbeschreibung: data.kurzbeschreibung || ''
          }

          console.log('Sende Angebot an Zapier:', zapierPayload)

          const zapierResponse = await fetch('https://hooks.zapier.com/hooks/catch/21938164/ub2g9ge/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(zapierPayload)
          })

          if (zapierResponse.ok) {
            console.log('Zapier Webhook erfolgreich')
          } else {
            console.warn('Zapier Webhook Fehler:', zapierResponse.status)
          }
        } catch (zapierErr) {
          console.warn('Zapier Webhook fehlgeschlagen:', zapierErr)
          // Nicht abbrechen - Hot Lead wurde bereits aktualisiert
        }
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
