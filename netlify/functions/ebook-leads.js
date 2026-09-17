// E-Book Leads API - Supabase Version
// Empfängt Leads vom E-Book Funnel und verwaltet den E-Book Pool
import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'
import { systemMailSenden } from './utils/mailLayout.js'
import { neuerEbookLead } from './utils/mails.js'
import { darf, verboten } from './utils/zugriff.js'
import { istOpener, istSetter, istLeitung } from '../../shared/rollen.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const RESEND_API_KEY = process.env.RESEND_API_KEY

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Content-Type': 'application/json'
}

// Alle Vertriebler (Setter) Emails laden
async function loadVertrieblerEmails() {
  try {
    const { data: users } = await supabase
      .from('users')
      .select('email_geschaeftlich, email, vor_nachname, rollen')
      .eq('status', true)

    return (users || [])
      .filter(u => {
        // Die Rolle Opener traf keine der frueheren drei Bedingungen - ein
        // umgetragener Nutzer haette keine E-Book-Benachrichtigung mehr
        // bekommen, ohne dass es jemandem auffaellt.
        const rollen = u.rollen || []
        return istOpener(rollen) || istSetter(rollen) || istLeitung(rollen)
      })
      .map(u => ({
        email: u.email_geschaeftlich || u.email,
        name: u.vor_nachname || 'Vertriebler'
      }))
      .filter(v => v.email)
  } catch (err) {
    console.error('Fehler beim Laden der Vertriebler:', err)
    return []
  }
}

// Benachrichtigungs-Email an alle Vertriebler senden
async function notifyVertrieblers(vertriebler, leadData) {
  if (!RESEND_API_KEY || vertriebler.length === 0) {
    console.log('Keine Vertriebler-Benachrichtigung')
    return
  }

  const emailAddresses = vertriebler.map(v => v.email)

  // Die Angaben stammen aus dem oeffentlichen Formular - der Baustein
  // maskiert sie. Vorher gingen sie ungeprueft ins HTML.
  const { betreff, mail } = neuerEbookLead(leadData)

  try {
    await systemMailSenden({ an: emailAddresses, betreff, mail })
    console.log('Vertriebler-Benachrichtigung gesendet')
  } catch (err) {
    console.error('Fehler beim Senden der Benachrichtigung:', err)
  }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  // POST ist das oeffentliche E-Book-Formular auf der Website und bleibt ohne
  // Anmeldung erreichbar. Lesen und Aendern nicht - dort haengen Kontaktdaten
  // aller Interessenten dran.
  let angemeldet = null
  if (event.httpMethod !== 'POST') {
    const zugang = anmeldungVerlangen(event)
    if (zugang.antwort) return zugang.antwort
    angemeldet = zugang.nutzer
    // Der E-Book-Pool ist ein Teil der Kaltakquise.
    if (!darf.opening(angemeldet)) return verboten('Der E-Book-Pool gehört zum Opening', 'rolle_fehlt')
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Server nicht konfiguriert' })
    }
  }

  try {
    // GET: E-Book Pool Leads laden (ohne Vertriebler zugewiesen)
    if (event.httpMethod === 'GET') {
      // ALLE Assignments mit Pagination laden (Supabase hat 1000er Server-Limit!)
      const assignedLeadIdSet = new Set()
      const pageSize = 1000
      let page = 0
      let hasMore = true

      while (hasMore) {
        const { data: assignments, error: assignError } = await supabase
          .from('lead_assignments')
          .select('lead_id')
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (assignError) {
          console.error('Assignment Query Error:', assignError)
          break
        }

        if (!assignments || assignments.length === 0) {
          hasMore = false
        } else {
          assignments.forEach(a => assignedLeadIdSet.add(String(a.lead_id)))
          page++
          if (assignments.length < pageSize) {
            hasMore = false
          }
        }
      }

      console.log(`E-Book Pool: ${assignedLeadIdSet.size} Assignments geladen (${page} Seiten)`)

      let query = supabase
        .from('leads')
        .select('*')
        .eq('quelle', 'E-Book')
        .order('datum', { ascending: false })

      const { data: leads, error } = await query

      if (error) throw new Error(error.message)

      console.log(`E-Book Pool: ${leads?.length || 0} E-Book Leads gefunden`)

      // Im Code filtern: Nur Leads ohne Assignment (String-Vergleich für UUID-Sicherheit)
      const poolLeads = (leads || [])
        .filter(lead => {
          const leadIdStr = String(lead.id)
          const isAssigned = assignedLeadIdSet.has(leadIdStr)
          if (!isAssigned) {
            console.log(`E-Book Pool: Lead "${lead.unternehmensname}" (${leadIdStr}) ist NICHT zugewiesen`)
          }
          return !isAssigned
        })
        .map(record => ({
          id: record.id,
          unternehmensname: arrayToString(record.unternehmensname) || '',
          ansprechpartnerVorname: arrayToString(record.ansprechpartner_vorname) || '',
          ansprechpartnerNachname: arrayToString(record.ansprechpartner_nachname) || '',
          kategorie: arrayToString(record.kategorie) || '',
          email: arrayToString(record.mail) || '',
          telefon: arrayToString(record.telefonnummer) || '',
          ort: arrayToString(record.stadt) || '',
          bundesland: arrayToString(record.bundesland) || '',
          land: arrayToString(record.land) || 'Deutschland',
          website: arrayToString(record.website) || '',
          quelle: arrayToString(record.quelle) || '',
          datum: record.datum || '',
          kommentar: record.kommentar || '',
          ergebnis: arrayToString(record.ergebnis) || '',
          kontaktiert: record.bereits_kontaktiert === true
        }))

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ leads: poolLeads, count: poolLeads.length })
      }
    }

    // POST: Neuen E-Book Lead erstellen (Webhook vom Funnel)
    if (event.httpMethod === 'POST') {
      let parsedBody = {}
      try {
        parsedBody = JSON.parse(event.body)
      } catch (e) {
        console.log('Body is not JSON')
      }

      // Felder extrahieren
      let vorname, nachname, email, telefon, unternehmen, kategorie

      if (parsedBody[''] && typeof parsedBody[''] === 'string') {
        try {
          const dataObj = JSON.parse(parsedBody[''])
          vorname = dataObj.vorname
          nachname = dataObj.nachname
          email = dataObj.email
          telefon = dataObj.telefon
          unternehmen = dataObj.unternehmen
          kategorie = dataObj.kategorie
        } catch (e) {}
      } else if (parsedBody.email) {
        vorname = parsedBody.vorname
        nachname = parsedBody.nachname
        email = parsedBody.email
        telefon = parsedBody.telefon
        unternehmen = parsedBody.unternehmen
        kategorie = parsedBody.kategorie
      } else if (parsedBody.data && typeof parsedBody.data === 'object') {
        vorname = parsedBody.data.vorname
        nachname = parsedBody.data.nachname
        email = parsedBody.data.email
        telefon = parsedBody.data.telefon
        unternehmen = parsedBody.data.unternehmen
        kategorie = parsedBody.data.kategorie
      }

      if (!email) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'E-Mail ist erforderlich' })
        }
      }

      // Duplikat-Check
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .or(`mail.ilike.${email}${telefon ? `,telefonnummer.eq.${telefon}` : ''}`)
        .limit(1)

      if (existing && existing.length > 0) {
        return {
          statusCode: 409,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Lead bereits vorhanden',
            existingLeadId: existing[0].id
          })
        }
      }

      // Neuen Lead erstellen
      const now = new Date()
      const timestamp = now.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' }) + ', ' + now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })

      const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
          unternehmensname: unternehmen || '',
          ansprechpartner_vorname: vorname || '',
          ansprechpartner_nachname: nachname || '',
          mail: email,
          telefonnummer: telefon || '',
          kategorie: kategorie === 'Sachverständiger' ? 'Sachverständiger' : 'Immobilienmakler',
          quelle: 'E-Book',
          datum: now.toISOString().split('T')[0],
          land: 'Deutschland',
          kommentar: `[${timestamp}] Lead ueber E-Book Funnel eingegangen`
        })
        .select()
        .single()

      if (error) throw new Error(error.message)

      console.log('E-Book Lead erstellt:', newLead.id)

      // Alle Vertriebler benachrichtigen
      const vertriebler = await loadVertrieblerEmails()
      await notifyVertrieblers(vertriebler, { vorname, nachname, email, telefon, unternehmen, kategorie })

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'E-Book Lead erfolgreich erstellt',
          leadId: newLead.id
        })
      }
    }

    // PATCH: Lead aus Pool übernehmen (Vertriebler zuweisen)
    if (event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body)
      const { leadId, vertrieblerName, vertrieblerId } = body
      const id = leadId || body.id

      if (!id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'leadId ist erforderlich' })
        }
      }

      if (!vertrieblerName && !vertrieblerId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'vertrieblerName oder vertrieblerId ist erforderlich' })
        }
      }

      // Uebernehmen kann man einen Lead nur fuer sich selbst - die Leitung
      // darf ihn jemandem zuteilen. Vorher kam der Empfaenger aus der Anfrage.
      if (!angemeldet.istAdmin) {
        if ((vertrieblerId && vertrieblerId !== angemeldet.id) ||
            (!vertrieblerId && vertrieblerName && vertrieblerName !== angemeldet.name)) {
          return verboten('Einen Lead übernimmst du nur für dich selbst')
        }
      }

      // Nur aus dem Pool: Ein Lead, der schon jemandem gehoert, wird hier
      // nicht ein zweites Mal vergeben.
      const { data: schonVergeben } = await supabase
        .from('lead_assignments').select('id').eq('lead_id', id).limit(1)
      if ((schonVergeben?.length || 0) > 0) {
        return { statusCode: 409, headers: corsHeaders, body: JSON.stringify({ error: 'Dieser Lead ist bereits vergeben' }) }
      }

      // Vertriebler ID ermitteln
      let assigneeId = vertrieblerId
      if (!assigneeId && vertrieblerName) {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .ilike('vor_nachname', vertrieblerName)
          .limit(1)

        if (userData && userData.length > 0) {
          assigneeId = userData[0].id
        }
      }

      if (!assigneeId) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Vertriebler nicht gefunden' })
        }
      }

      // Assignment erstellen
      await supabase
        .from('lead_assignments')
        .insert({ lead_id: id, user_id: assigneeId })

      // Kommentar aktualisieren
      const { data: leadData } = await supabase
        .from('leads')
        .select('kommentar')
        .eq('id', id)
        .single()

      const currentKommentar = leadData?.kommentar || ''
      const now = new Date()
      const timestamp = now.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' }) + ', ' + now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
      const newEntry = `[${timestamp}] Lead aus E-Book Pool uebernommen von ${vertrieblerName}`

      await supabase
        .from('leads')
        .update({ kommentar: `${newEntry}\n${currentKommentar}` })
        .eq('id', id)

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: `Lead wurde ${vertrieblerName} zugewiesen`
        })
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Methode nicht erlaubt' })
    }

  } catch (error) {
    console.error('E-Book Leads Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}
