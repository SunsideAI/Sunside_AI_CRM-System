// Hot Leads API - Supabase Version
// GET: Hot Leads laden (für Closing-Seite und Dashboard)
// POST: Neuen Hot Lead erstellen (bei Termin-Buchung) oder Closer-Leads freigeben
// PATCH: Hot Lead aktualisieren (Status, Deal-Werte)

import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'
import { STATUS, normalisiere, uebergangErlaubt, anzeigeName, ruecknahmeZiel, beideSchreibweisen } from '../../shared/status.js'
import { FELDER, uebergabePruefen, grenzenPruefen, UEBERGABE_1, UEBERGABE_2 } from '../../shared/felder.js'
import { ABSENDER_SYSTEM } from './utils/mail.js'

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
// Robust gegen: Whitespace-Varianten, non-breaking-space, Umlaut/Latin-Schreibweise
// (Schuetze ↔ Schütze, Müller ↔ Mueller etc.)
async function getUserIdByName(userName) {
  if (!userName) return null

  // Whitespace normalisieren (inkl. non-breaking-space  )
  const normalized = String(userName).replace(/ /g, ' ').trim().replace(/\s+/g, ' ')
  if (!normalized) return null

  // Kandidaten-Schreibweisen aufbauen
  const candidates = [normalized]

  // Latin → Umlaut (Schuetze → Schütze, ae → ä, oe → ö, ue → ü, ss → ß)
  const toUmlaut = normalized
    .replace(/ae/gi, 'ä')
    .replace(/oe/gi, 'ö')
    .replace(/ue/gi, 'ü')
    .replace(/ss/gi, 'ß')
  if (toUmlaut !== normalized) candidates.push(toUmlaut)

  // Umlaut → Latin (Schütze → Schuetze)
  const toLatin = normalized
    .replace(/ä/gi, 'ae')
    .replace(/ö/gi, 'oe')
    .replace(/ü/gi, 'ue')
    .replace(/ß/g, 'ss')
  if (toLatin !== normalized) candidates.push(toLatin)

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .ilike('vor_nachname', candidate)
      .limit(1)

    if (error) {
      console.error('[getUserIdByName] DB-Fehler für', candidate, error)
      continue
    }
    if (data && data.length > 0) return data[0].id
  }

  console.warn('[getUserIdByName] Kein User gefunden für Name:', JSON.stringify(userName), '(kandidaten:', JSON.stringify(candidates) + ')')
  return null
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    // ==========================================
    // GET: Hot Leads laden
    // ==========================================
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const { setterId, closerId, setterName, closerName, openerId, openerName, status, limit, pool, originalLeadId } = params

      console.log('Hot Leads GET - Params:', { setterId, closerId, setterName, closerName, status, limit, pool, originalLeadId })

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

      // Ein Name, der sich nicht aufloesen laesst, darf NICHT bedeuten
      // "kein Filter". Genau das passierte vorher: getUserIdByName() gab
      // null zurueck, der Filter fiel weg, und die Abfrage lieferte den
      // gesamten Bestand statt der eigenen Kontakte. Ein Setter sah damit
      // die Termine aller anderen. Hier wird stattdessen leer geliefert.
      let filterInsLeere = false

      if (!setterIdFilter && setterName) {
        setterIdFilter = await getUserIdByName(setterName)
        if (!setterIdFilter) {
          console.warn('[hot-leads GET] setterName nicht aufloesbar:', setterName)
          filterInsLeere = true
        }
      }
      if (!closerIdFilter && closerName) {
        closerIdFilter = await getUserIdByName(closerName)
        if (!closerIdFilter) {
          console.warn('[hot-leads GET] closerName nicht aufloesbar:', closerName)
          filterInsLeere = true
        }
      }

      // Der Opener braucht einen eigenen Filter: Nach dem Umbau zeigt setter_id
      // auf den, der das Beratungsgespraech haelt - nicht mehr auf den, der
      // gebucht hat. Ohne diesen Filter verloere der Opener die von ihm
      // gelegten Termine aus den Augen.
      let openerIdFilter = openerId
      if (!openerIdFilter && openerName) {
        openerIdFilter = await getUserIdByName(openerName)
        if (!openerIdFilter) {
          console.warn('[hot-leads GET] openerName nicht aufloesbar:', openerName)
          filterInsLeere = true
        }
      }

      if (filterInsLeere) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ hotLeads: [], total: 0 })
        }
      }

      while (hotLeadsData.length < maxLimit) {
        let query = supabase
          .from('hot_leads')
          .select(`
            *,
            setter:users!hot_leads_setter_id_fkey(id, vor_nachname),
            closer:users!hot_leads_closer_id_fkey(id, vor_nachname),
            opener:users!hot_leads_opener_id_fkey(id, vor_nachname),
            reaktivierer:users!hot_leads_reaktivierung_bearbeiter_id_fkey(id, vor_nachname),
            original_lead:leads!hot_leads_lead_id_fkey(
              id, unternehmensname, ansprechpartner_vorname, ansprechpartner_nachname,
              kategorie, mail, telefonnummer, stadt, website, kommentar,
              monatliche_besuche, mehrwert, absprungrate, anzahl_leads
            )
          `)

        // Pool-Filter. Zwei Poole seit dem OSC-Umbau:
        //   pool=true | pool=closer -> Termine ohne Closer
        //   pool=setter             -> Beratungsgespräche ohne Setter
        if (pool === 'setter') {
          query = query.is('setter_id', null)
          // Der Pool ist eine Liste zum Bewerben. Ein abgesagter Termin steht
          // nicht zur Uebernahme - er gehoert dem Opener, der neu terminiert.
          // Das Frontend filtert ebenfalls; hier steht es, damit es auch fuer
          // jeden anderen Aufrufer gilt.
          //
          // beideSchreibweisen() ist hier Pflicht, nicht Vorsicht: Der Bestand
          // traegt in der Datenbank noch 'Lead', die neue Bezeichnung entsteht
          // erst beim Ausliefern. Ein Vergleich gegen den neuen Wert allein
          // liesse den Pool leer erscheinen, obwohl sieben Termine darin sind.
          query = query.in('status', beideSchreibweisen(STATUS.BERATUNG_VEREINBART))
        } else if (pool === 'true' || pool === 'closer') {
          query = query.is('closer_id', null)
          // Seit dem OSC-Umbau reicht "kein Closer" nicht mehr aus.
          //
          // Vorher gab es eine Uebergabe: Wer den Termin legte, gab ihn an den
          // Closer weiter - "ohne Closer" hiess also "wartet auf einen Closer".
          // Jetzt liegt das Setting dazwischen. Ein frisch gelegtes
          // Beratungsgespraech hat ebenfalls keinen Closer, gehoert aber dem
          // Setter-Pool. Ohne diese Zeile standen 39 Setting-Termine im
          // Closer-Pool und boten sich Closern zur Bewerbung an.
          //
          // Der Closer-Pool ist genau das: ein gebuchtes Abschlussgespraech,
          // fuer das noch niemand eingeteilt ist.
          query = query.not('termin_abschlussgespraech', 'is', null)

          // Ein geplatzter Termin ist keine Uebernahme wert: Er wartet beim
          // Setter auf einen neuen. Ohne diese Zeile stand derselbe Kontakt
          // gleichzeitig im Kasten des Setters UND im Pool - zwei Leute
          // haetten unabhaengig voneinander daran gearbeitet.
          query = query.not('status', 'in',
            `(${[...beideSchreibweisen(STATUS.TERMIN_ABGESAGT),
                 ...beideSchreibweisen(STATUS.NICHT_ERSCHIENEN)]
                .map(x => `"${x}"`).join(',')})`)
        }

        // Setter-Filter
        if (setterIdFilter) {
          query = query.eq('setter_id', setterIdFilter)
        }

        // Opener-Filter
        if (openerIdFilter && UUID_REGEX.test(openerIdFilter)) {
          query = query.eq('opener_id', openerIdFilter)
        } else if (openerIdFilter) {
          console.warn('[hot-leads GET] openerIdFilter ist keine gueltige UUID, ignoriert:', openerIdFilter)
        }

        // Closer-Filter: User sieht Leads, die ihm als Closer ODER als
        // Reaktivierungs-Bearbeiter zugewiesen sind. Damit taucht ein
        // reaktivierter Lead in dessen Closing-Ansicht auf, ohne dass
        // er dem User als Closer attribuiert wird (Statistik bleibt sauber).
        // UUID-Validierung verhindert PostgREST-Filter-Injection via ID-Param.
        if (closerIdFilter && UUID_REGEX.test(closerIdFilter)) {
          query = query.or(`closer_id.eq.${closerIdFilter},reaktivierung_bearbeiter_id.eq.${closerIdFilter}`)
        } else if (closerIdFilter) {
          console.warn('[hot-leads GET] closerIdFilter ist keine gültige UUID, ignoriert:', closerIdFilter)
        }

        // Status-Filter. Wie im Pool gilt: Der Aufrufer nennt die neue
        // Bezeichnung, in der Datenbank steht bei Bestandsdaten noch die alte.
        // follow-up.js macht es an zwei Stellen genauso.
        if (status) {
          const statusList = status.split(',').map(s => s.trim())
            .flatMap(s => beideSchreibweisen(s))
          query = query.in('status', [...new Set(statusList)])
        }

        // Original Lead ID Filter (für No-Show Bearbeitung durch Setter)
        if (originalLeadId) {
          query = query.eq('lead_id', originalLeadId)
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
          // Altbestand wird beim Lesen auf die neue Liste gebracht - die
          // Datenbank-Migration laeuft spaeter, das Frontend sieht trotzdem
          // ueberall dieselben Werte.
          status: normalisiere(record.status) || STATUS.BERATUNG_VEREINBART,
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
          kommentar: originalLead.kommentar || '', // SINGLE SOURCE: leads.kommentar
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
          reaktivierungBearbeiterId: record.reaktivierung_bearbeiter_id || null,
          setterName: record.setter?.vor_nachname || '',
          closerName: record.closer?.vor_nachname || '',
          openerId: record.opener_id || null,
          openerName: record.opener?.vor_nachname || '',
          reaktivierungBearbeiterName: record.reaktivierer?.vor_nachname || '',
          // Billing-Felder für Abschluss-Modal
          rechnung_anrede: record.rechnung_anrede || '',
          rechnung_firma: record.rechnung_firma || '',
          rechnung_strasse: record.rechnung_strasse || '',
          rechnung_zusatz: record.rechnung_zusatz || '',
          rechnung_plz: record.rechnung_plz || '',
          rechnung_ort: record.rechnung_ort || '',
          rechnung_land: record.rechnung_land || 'DE',
          rechnung_email: record.rechnung_email || '',
          ust_id: record.ust_id || '',
          steuernummer: record.steuernummer || '',
          vertragsbeginn: record.vertragsbeginn || null,
          zahlungsziel_tage: record.zahlungsziel_tage || 14,
          retainer_start_offset_months: record.retainer_start_offset_months || 0,
          billing_mode: record.billing_mode || 'none',
          billing_notes: record.billing_notes || '',
          // No-Show Felder
          no_show_count: record.no_show_count || 0,
          no_show_marked_at: record.no_show_marked_at || null,
          no_show_marked_by: record.no_show_marked_by || null,
          no_show_keep_in_closing: record.no_show_keep_in_closing || false,

          // Felder der beiden Uebergaben. Ohne sie kann die Setter-Ansicht
          // nicht vorbefuellen und das Gate ist im Frontend unsichtbar.
          ...Object.fromEntries(
            Object.keys(FELDER).map(k => [k, record[k] ?? null])
          ),
          // Berechnet, nicht eingegeben.
          noetige_anfragen: record.noetige_anfragen ?? null,
          anfragen_bereich: record.anfragen_bereich ?? null,
          termin_abschlussgespraech: record.termin_abschlussgespraech || null,
          meeting_link_abschluss: record.meeting_link_abschluss || null,

          // Der Angebots-Zweig. Der Stand beim Versand bleibt erhalten, auch
          // wenn sich die Vertragsfelder bis zum Abschluss noch aendern.
          angebot_paket: record.angebot_paket ?? null,
          angebot_setup: record.angebot_setup ?? null,
          angebot_gebuehr: record.angebot_gebuehr ?? null,
          angebot_angefordert_am: record.angebot_angefordert_am || null,
          angebot_verschickt_am: record.angebot_verschickt_am || null,
          wiedervorlage_am: record.wiedervorlage_am || null,
          vertrag_laeuft_bis: record.vertrag_laeuft_bis || null,
          kuendigung_zum: record.kuendigung_zum || null
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
        // Gibt saemtliche Leads eines Closers in den Pool zurueck - das darf
        // nur die Leitung. Vorher konnte jeder Angemeldete einem Kollegen
        // seinen gesamten Bestand entziehen.
        if (!angemeldet.istAdmin) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Nur die Leitung darf Leads eines Closers freigeben' })
          }
        }

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
      <div style="font-size: 48px; margin-bottom: 10px;">🔄</div>
      <h1 style="color: white; margin: 0; font-size: 24px;">Neue Leads im Pool</h1>
    </div>
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        <strong>${targetCloserName}</strong> wurde deaktiviert.
        <strong style="color: #3B82F6;">${closerLeads.length} Beratungsgespraeche</strong> sind jetzt im Closer-Pool verfuegbar.
      </p>
      <div style="text-align: center; margin-top: 25px;">
        <a href="https://crmsunsideai.netlify.app/closing" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Zum Closer-Pool
        </a>
      </div>
    </div>
    <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 20px;">
      Sunside AI GbR | Schiefer Berg 3 | 38124 Braunschweig
    </p>
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
                  from: ABSENDER_SYSTEM,
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
      // ACTION: zurueck-an-vorgaenger
      // ==========================================
      // Der Sonderweg aus F25.3: genau EINE Stufe zurueck, mit Pflicht-Grund.
      // Bewusst eine eigene Aktion und kein gewoehnlicher Statuswechsel - nur
      // so bleibt die Rueckgabequote zaehlbar, statt in den normalen Wechseln
      // unterzugehen.
      if (body.action === 'zurueck-an-vorgaenger') {
        const { hotLeadId, grund } = body

        if (!hotLeadId || !grund || !String(grund).trim()) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'hotLeadId und ein Grund sind erforderlich' })
          }
        }

        const { data: stand } = await supabase
          .from('hot_leads').select('status, setter_id, closer_id, opener_id, unternehmen')
          .eq('id', hotLeadId).maybeSingle()

        if (!stand) {
          return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Kontakt nicht gefunden' }) }
        }

        const ziel = ruecknahmeZiel(stand.status)
        if (!ziel) {
          return {
            statusCode: 409,
            headers: corsHeaders,
            body: JSON.stringify({
              error: `Aus "${anzeigeName(stand.status)}" gibt es keinen Schritt zurueck.`
            })
          }
        }

        const { error: zurueckError } = await supabase
          .from('hot_leads')
          .update({ status: ziel, zuletzt_geaendert_von: angemeldet.id })
          .eq('id', hotLeadId)

        if (zurueckError) throw new Error(zurueckError.message)

        // Als eigenes Ereignis festhalten, damit die Quote zaehlbar wird. Der
        // Statuswechsel selbst wird vom Datenbank-Trigger ohnehin protokolliert.
        await supabase.from('hot_lead_ereignisse').insert({
          hot_lead_id: hotLeadId,
          art: 'rueckgabe',
          von_status: normalisiere(stand.status),
          nach_status: ziel,
          akteur_id: angemeldet.id,
          bemerkung: String(grund).trim()
        })

        // Den Vorgaenger benachrichtigen - er soll nachbessern koennen.
        // Wer das ist, haengt an der Stufe: Gibt der Setter zurueck, landet der
        // Kontakt wieder beim Opener; gibt der Closer zurueck, beim Setter.
        const empfaenger = ziel === STATUS.BERATUNG_VEREINBART
          ? stand.opener_id
          : stand.setter_id
        if (empfaenger && empfaenger !== angemeldet.id) {
          await supabase.from('system_messages').insert({
            message_id: 'RG-' + Date.now().toString(36).toUpperCase(),
            empfaenger_id: empfaenger,
            titel: 'Kontakt zurueckgegeben: ' + (stand.unternehmen || 'Ohne Namen'),
            nachricht: angemeldet.name + ' hat den Kontakt zurueckgegeben. Grund: ' + String(grund).trim(),
            typ: 'Pool Update',
            hot_lead_id: hotLeadId,
            gelesen: false
          })
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ success: true, status: ziel })
        }
      }

      // ==========================================
      // Standard POST: Neuen Hot Lead erstellen
      // ==========================================
      const {
        originalLeadId,
        setterName,
        closerName,
        openerName,
        setterId,
        closerId,
        unternehmen,
        terminDatum,
        terminart,
        quelle,
        meetingLink,
        infosErstgespraech,
        // Kontaktdaten aus dem Buchungsformular - werden für den Match durch
        // den Calendly-Webhook gebraucht (verhindert Duplikate durch die
        // spätere Direktbuchungs-Auto-Anlage) und sind auch für die spätere
        // Kommunikation nötig.
        mail: mailInput,
        telefonnummer: telefonnummerInput,
        ansprechpartnerVorname: ansprechpartnerVornameInput,
        ansprechpartnerNachname: ansprechpartnerNachnameInput,
        ort: ortInput
      } = body

      console.log('Hot Lead POST - Input:', {
        originalLeadId, setterName, closerName, setterId, closerId, openerName,
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

      // Ein Setter ist NICHT mehr Pflicht: Der Opener legt den Termin, die
      // Besetzung laeuft ueber den Setter-Pool. Frueher war das Feld
      // erforderlich, weil derselbe Mensch beides war.

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
      // WICHTIG: Wenn Name gegeben aber nicht auflösbar → 400 statt silent null.
      // Sonst würde der Hot Lead mit setter_id: null gespeichert und im Kalender
      // des Setters nicht mehr auftauchen (Bug: "Termine sind weg").
      let setterRecordId = setterId
      if (!setterRecordId && setterName) {
        setterRecordId = await getUserIdByName(setterName)
        if (!setterRecordId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              error: 'setter_not_found',
              message: `Setter "${setterName}" konnte nicht in der User-Datenbank gefunden werden. Termin wurde NICHT gespeichert. Bitte Name prüfen (Umlaute, Schreibweise) und Support kontaktieren.`
            })
          }
        }
      }

      // Closer-ID ermitteln (optional - für Pool-Termine)
      // Analog: closerName leer = Pool erlaubt. Aber wenn Name gegeben und nicht
      // auflösbar → 400, damit der Termin nicht orphan in den Pool fällt.
      let closerRecordId = closerId
      if (!closerRecordId && closerName) {
        closerRecordId = await getUserIdByName(closerName)
        if (!closerRecordId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              error: 'closer_not_found',
              message: `Closer "${closerName}" konnte nicht in der User-Datenbank gefunden werden. Termin wurde NICHT gespeichert. Bitte Name prüfen oder in den Pool zuweisen.`
            })
          }
        }
      }

      // Übergabe 1: ohne die Felder aus dem Erstanruf wird nicht gebucht.
      // Sie steuern, welche Mail und welches Video rausgehen und ob die SMS
      // vor dem Termin zugestellt werden kann - fehlen sie, laufen die
      // nachgelagerten Schritte ins Leere.
      const uebergabe1 = uebergabePruefen(body, UEBERGABE_1)
      if (!uebergabe1.vollstaendig) {
        return {
          statusCode: 422,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'uebergabe_unvollstaendig',
            stufe: UEBERGABE_1,
            message: 'Zum Buchen fehlen noch Angaben aus dem Erstanruf.',
            offen: uebergabe1.offen,
            warnungen: uebergabe1.warnungen
          })
        }
      }

      // Hot Lead erstellen
      const hotLeadData = {
        lead_id: originalLeadId,
        unternehmen: unternehmen || '',
        termin_beratungsgespraech: terminDatum,
        status: STATUS.BERATUNG_VEREINBART,
        quelle: quelle || 'Opening',
        setter_id: setterRecordId || null,
        closer_id: closerRecordId || null,
        // Wer bucht, ist der Opener. Ausdruecklich setzen statt dem Trigger zu
        // ueberlassen: der fuellt nur, wenn genau ein Kandidat in
        // lead_assignments steht - hier wissen wir es sicher.
        opener_id: angemeldet.id,
        zuletzt_geaendert_von: angemeldet.id
      }

      // Kontaktdaten aus dem Buchungsformular übernehmen. Vor allem `mail` ist
      // wichtig, damit der Calendly-Webhook den Hot Lead 3 Sekunden später per
      // findHotLeadByEmail identifiziert und keinen Duplikat-Eintrag anlegt.
      if (mailInput) hotLeadData.mail = mailInput
      if (telefonnummerInput) hotLeadData.telefonnummer = telefonnummerInput
      if (ansprechpartnerVornameInput) hotLeadData.ansprechpartner_vorname = ansprechpartnerVornameInput
      if (ansprechpartnerNachnameInput) hotLeadData.ansprechpartner_nachname = ansprechpartnerNachnameInput
      if (ortInput) hotLeadData.ort = ortInput

      // Die Felder der Übergabe 1 wandern mit in den Datensatz.
      for (const schluessel of Object.keys(FELDER)) {
        if (FELDER[schluessel].bereich === UEBERGABE_1 && body[schluessel] !== undefined) {
          hotLeadData[schluessel] = body[schluessel]
        }
      }

      if (terminart) hotLeadData.terminart = terminart
      if (meetingLink) hotLeadData.meeting_link = meetingLink
      if (infosErstgespraech) hotLeadData.kommentar = infosErstgespraech

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

      // Fehlt 'updates', lief die Funktion vorher weiter und scheiterte erst
      // an updates.kommentar - mit einer 500 und einer internen Meldung, aus
      // der niemand ablesen kann, was am Aufruf falsch war.
      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'updates fehlt oder ist kein Objekt' })
        }
      }

      // Felder mappen
      const fieldMap = {
        // Die Felder beider Uebergaben heissen im CRM wie in der Datenbank -
        // eine Umbenennung waere nur eine weitere Stelle, die auseinanderlaufen
        // kann.
        ...Object.fromEntries(Object.keys(FELDER).map(k => [k, k])),
        'schmerzpunkt_vertieft': 'schmerzpunkt_vertieft',
        'termin_abschlussgespraech': 'termin_abschlussgespraech',
        'meeting_link_abschluss': 'meeting_link_abschluss',
        'gespraechsausgang': 'gespraechsausgang',
        'zugesagter_schritt': 'zugesagter_schritt',
        'zugesagt_bis': 'zugesagt_bis',
        'nachfass_grund': 'nachfass_grund',
        'wiedervorlage_am': 'wiedervorlage_am',
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
        'setterId': 'setter_id',
        'reaktivierungBearbeiterId': 'reaktivierung_bearbeiter_id',
        'reaktivierungBearbeiterName': 'reaktivierung_bearbeiter_id',  // im Spezialcode aufgelöst
        'terminDatum': 'termin_beratungsgespraech',
        'terminart': 'terminart',
        'meetingLink': 'meeting_link',
        // Angebot konfigurieren - Felder
        'vertragsbestandteile': 'vertragsbestandteile',
        'paketname': 'paketname_individuell',
        'kurzbeschreibung': 'kurzbeschreibung',
        'leistungsbeschreibung': 'leistungsbeschreibung',
        // Eigene Felder (nicht mehr Lookup)
        // 'kommentar' wird separat über leads-Tabelle behandelt
        'attachments': 'attachments',
        // Billing-Felder (Abschluss-Modal)
        'rechnung_anrede': 'rechnung_anrede',
        'rechnung_firma': 'rechnung_firma',
        'rechnung_strasse': 'rechnung_strasse',
        'rechnung_zusatz': 'rechnung_zusatz',
        'rechnung_plz': 'rechnung_plz',
        'rechnung_ort': 'rechnung_ort',
        'rechnung_land': 'rechnung_land',
        'rechnung_email': 'rechnung_email',
        'ust_id': 'ust_id',
        'steuernummer': 'steuernummer',
        'vertragsbeginn': 'vertragsbeginn',
        'zahlungsziel_tage': 'zahlungsziel_tage',
        'retainer_start_offset_months': 'retainer_start_offset_months',
        'billing_mode': 'billing_mode',
        'billing_notes': 'billing_notes',
        'ansprechpartner_vorname': 'ansprechpartner_vorname',
        'ansprechpartner_nachname': 'ansprechpartner_nachname',
        'telefonnummer': 'telefonnummer',
        'mail': 'mail',
        'website': 'website',
        'ort': 'ort',
        // No-Show Felder
        'no_show_count': 'no_show_count',
        'no_show_marked_at': 'no_show_marked_at',
        'no_show_marked_by': 'no_show_marked_by',
        'no_show_keep_in_closing': 'no_show_keep_in_closing'
      }

      // Kommentar separat behandeln (wird in leads-Tabelle geschrieben)
      let kommentarToUpdate = null
      if (updates.kommentar !== undefined) {
        kommentarToUpdate = updates.kommentar
      }

      const fields = {}

      for (const [key, value] of Object.entries(updates)) {
        const dbField = fieldMap[key]
        if (dbField) {
          // Closer nach Name auflösen (leer = zurück in Pool)
          if (key === 'closerName') {
            if (value) {
              const cid = await getUserIdByName(value)
              if (cid) fields.closer_id = cid
            } else {
              // Leerer String = Closer entfernen (zurück in Pool)
              fields.closer_id = null
            }
            continue
          }
          // Reaktivierungs-Bearbeiter nach Name auflösen (leer = entfernen)
          if (key === 'reaktivierungBearbeiterName') {
            if (value) {
              const rid = await getUserIdByName(value)
              if (rid) fields.reaktivierung_bearbeiter_id = rid
            } else {
              fields.reaktivierung_bearbeiter_id = null
            }
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

      // Wenn weder hot_leads-Felder noch Kommentar zu updaten sind, Fehler
      if (Object.keys(fields).length === 0 && kommentarToUpdate === null) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Keine gültigen Update-Felder' })
        }
      }

      // Zuteilungen laufen ueber den Bewerbungsweg, nicht ueber ein beliebiges
      // PATCH-Feld. Sonst koennte sich jeder Angemeldete mit
      // {"updates":{"closerId":"<eigene ID>"}} zum Closer eines fremden Leads
      // machen und den Genehmigungsweg umgehen.
      //
      // ABGEBEN ist etwas anderes als NEHMEN. Der Schutz galt bisher fuer
      // beides, und damit lief "An Pool freigeben" fuer jeden Closer ohne
      // Admin-Rechte in ein 403 - genau wie die Rueckgabe eines geplatzten
      // Termins an die Stufe davor. Wer eine Zuteilung loescht, verschafft
      // sich keinen Vorteil; nur das Setzen bleibt dem Bewerbungsweg
      // vorbehalten.
      for (const feld of ['closerId', 'setterId', 'openerId']) {
        const wert = fields[fieldMap[feld]]
        if (wert !== undefined && wert !== null && !angemeldet.istAdmin) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({
              error: 'Zuteilungen laufen ueber die Bewerbung, nicht ueber das Bearbeiten des Kontakts'
            })
          }
        }
      }

      // Statuswechsel: gegen die Übergangsmatrix prüfen, bevor geschrieben wird.
      // Die Datenbank prüft dasselbe noch einmal - hier geht es um eine
      // verständliche Meldung statt einer Constraint-Verletzung.
      if (fields.status) {
        fields.status = normalisiere(fields.status)

        const { data: vorher } = await supabase
          .from('hot_leads').select('status').eq('id', hotLeadId).maybeSingle()

        if (vorher && !uebergangErlaubt(vorher.status, fields.status)) {
          return {
            statusCode: 409,
            headers: corsHeaders,
            body: JSON.stringify({
              error: `Von "${anzeigeName(vorher.status)}" kann nicht direkt auf `
                   + `"${anzeigeName(fields.status)}" gewechselt werden.`,
              von: normalisiere(vorher.status),
              nach: fields.status
            })
          }
        }

        // Dieselbe Regel wie beim Calendly-Webhook, damit sie unabhängig vom
        // Weg gilt: Wer den geplatzten Termin gelegt hat, legt den neuen.
        //
        //   Beratungsgespräch geplatzt  -> zurück an den Opener (Setter weg)
        //   Abschlussgespräch geplatzt  -> zurück an den Setter (Closer weg)
        //
        // Vorher kannte dieser Zweig nur den ersten Fall. Setzte ein Closer
        // "nicht erschienen", schickte die Oberfläche den Closer weg UND der
        // Server den Setter - der Kontakt gehörte danach niemandem.
        //
        // Welcher Termin geplatzt ist, sagt das Abschlussgespräch: Gibt es
        // eines, liegt das Beratungsgespräch schon hinter uns.
        if (fields.status === STATUS.TERMIN_ABGESAGT || fields.status === STATUS.NICHT_ERSCHIENEN) {
          const { data: stand } = await supabase
            .from('hot_leads')
            .select('setter_id, closer_id, status, termin_abschlussgespraech, no_show_keep_in_closing')
            .eq('id', hotLeadId).maybeSingle()

          const abschlussGeplatzt = !!stand?.termin_abschlussgespraech

          if (abschlussGeplatzt) {
            // Der Closer darf ihn behalten, wenn er das beim No-Show ausdrücklich
            // sagt - derselbe Schalter, den der Webhook auch beachtet.
            const behaelt = (fields.no_show_keep_in_closing ?? stand?.no_show_keep_in_closing) === true
            if (!behaelt && stand?.closer_id) {
              fields.closer_id = null
              await supabase.from('hot_lead_ereignisse').insert({
                hot_lead_id: hotLeadId,
                art: 'closer_freigestellt',
                von_status: normalisiere(stand.status),
                nach_status: fields.status,
                akteur_id: angemeldet.id,
                bemerkung: fields.status === STATUS.NICHT_ERSCHIENEN
                  ? 'Nicht erschienen - zurück an den Setter'
                  : 'Abschlussgespräch abgesagt - zurück an den Setter',
                daten: { frueherer_closer: stand.closer_id }
              })
            }
            // Der Setter bleibt, wo er ist - er terminiert neu.
            delete fields.setter_id
          } else if (stand?.setter_id) {
            fields.setter_id = null
            await supabase.from('hot_lead_ereignisse').insert({
              hot_lead_id: hotLeadId,
              art: 'setter_freigestellt',
              von_status: normalisiere(stand.status),
              nach_status: fields.status,
              akteur_id: angemeldet.id,
              bemerkung: fields.status === STATUS.NICHT_ERSCHIENEN
                ? 'Nicht erschienen - zurück an den Opener'
                : 'Termin abgesagt - zurück an den Opener',
              daten: { frueherer_setter: stand.setter_id }
            })
          }
        }
      }

      // Unmoegliche Zahlen werden gar nicht erst gespeichert. Das Formular
      // zieht sie beim Tippen in die Spanne; wer an der Maske vorbei schreibt,
      // faellt hier auf. Eine negative Wunschzahl kippt sonst die
      // Bedarfsrechnung, und die steht spaeter im Strategiepapier.
      const ausserhalb = grenzenPruefen(fields)
      if (ausserhalb.length > 0) {
        return {
          statusCode: 422,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'wert_ausserhalb_der_spanne',
            message: ausserhalb
              .map(v => `${v.name}: ${v.grenze}`)
              .join(', '),
            felder: ausserhalb
          })
        }
      }

      // Übergabe 2: das Abschlussgespräch wird erst gebucht, wenn der Setter
      // dokumentiert hat. Der Closer bereitet sein Strategiepapier daraus vor -
      // ohne die Felder hat er nichts in der Hand.
      if (fields.status === STATUS.ABSCHLUSS_VEREINBART) {
        const { data: stand } = await supabase
          .from('hot_leads').select('*').eq('id', hotLeadId).maybeSingle()

        const uebergabe2 = uebergabePruefen({ ...stand, ...fields }, UEBERGABE_2)
        if (!uebergabe2.vollstaendig) {
          return {
            statusCode: 422,
            headers: corsHeaders,
            body: JSON.stringify({
              error: 'uebergabe_unvollstaendig',
              stufe: UEBERGABE_2,
              message: 'Zum Buchen des Abschlussgesprächs fehlen noch Angaben aus dem Beratungsgespräch.',
              offen: uebergabe2.offen,
              warnungen: uebergabe2.warnungen
            })
          }
        }
      }

      // Wer geschrieben hat, reist in der Zeile mit - der Protokoll-Trigger
      // liest es dort ab und schreibt es in den Ereignis-Verlauf.
      if (Object.keys(fields).length > 0) {
        fields.zuletzt_geaendert_von = angemeldet.id
      }

      console.log('Updating Hot Lead:', hotLeadId, fields, 'Kommentar:', kommentarToUpdate !== null)

      // Hot Lead laden (auch wenn keine fields zu updaten)
      let data, error
      if (Object.keys(fields).length > 0) {
        const result = await supabase
          .from('hot_leads')
          .update(fields)
          .eq('id', hotLeadId)
          .select(`
            *,
            closer:users!hot_leads_closer_id_fkey(vor_nachname, email, email_geschaeftlich),
            original_lead:leads!hot_leads_lead_id_fkey(
              unternehmensname, ansprechpartner_vorname, ansprechpartner_nachname,
              kategorie, mail, telefonnummer, kommentar
            )
          `)
          .single()
        data = result.data
        error = result.error
      } else {
        // Nur Kommentar-Update - Hot Lead nur laden, nicht updaten
        const result = await supabase
          .from('hot_leads')
          .select(`
            *,
            closer:users!hot_leads_closer_id_fkey(vor_nachname, email, email_geschaeftlich),
            original_lead:leads!hot_leads_lead_id_fkey(
              unternehmensname, ansprechpartner_vorname, ansprechpartner_nachname,
              kategorie, mail, telefonnummer, kommentar
            )
          `)
          .eq('id', hotLeadId)
          .single()
        data = result.data
        error = result.error
      }

      if (error) {
        console.error('Update Hot Lead Error:', error)
        throw new Error(error.message || 'Hot Lead konnte nicht aktualisiert werden')
      }

      // Kommentar in leads-Tabelle schreiben (SINGLE SOURCE OF TRUTH)
      if (kommentarToUpdate !== null && data.lead_id) {
        const { error: kommentarError } = await supabase
          .from('leads')
          .update({ kommentar: kommentarToUpdate })
          .eq('id', data.lead_id)

        if (kommentarError) {
          console.error('Update Kommentar in leads Error:', kommentarError)
          // Kein throw - Hot Lead ist bereits gespeichert
        }
      }

      // Zapier-Webhook für Angebotsversand (wenn Status auf 'Angebot' gesetzt wird)
      if (fields.status === STATUS.ANGEBOT_ANGEFORDERT && data) {
        try {
          // Kontaktdaten aus hot_leads ODER aus verknüpftem original_lead
          const lead = data.original_lead || {}

          const zapierPayload = {
            // Record ID für Supabase-Update nach Versand
            hotLeadId: data.id,
            // Status für Zapier-Filter
            Status: 'Angebot',
            // Kontaktdaten (aus hot_leads oder original_lead)
            name: arrayToString(data.ansprechpartner_nachname) || arrayToString(lead.ansprechpartner_nachname) || '',
            vorname: arrayToString(data.ansprechpartner_vorname) || arrayToString(lead.ansprechpartner_vorname) || '',
            unternehmensname: arrayToString(data.unternehmen) || arrayToString(lead.unternehmensname) || '',
            telefonnummer: arrayToString(data.telefonnummer) || arrayToString(lead.telefonnummer) || '',
            email: arrayToString(data.mail) || arrayToString(lead.mail) || '',
            // Bearbeiter (Closer)
            Bearbeiter: data.closer?.vor_nachname || '',
            BearbeiterEmail: data.closer?.email_geschaeftlich || data.closer?.email || '',
            // Angebotsdaten
            retainer: data.retainer || 0,
            setup: data.setup || 0,
            laufzeit: data.laufzeit || 12,
            kategorie: arrayToString(data.kategorie) || arrayToString(lead.kategorie) || '',
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

      // Bridge-Trigger: Rechnung erstellen wenn Lead auf Abgeschlossen gesetzt wird
      if (normalisiere(fields.status) === STATUS.GEWONNEN && data && process.env.BRIDGE_URL && process.env.BRIDGE_SECRET) {
        try {
          const bridgeResponse = await fetch(`${process.env.BRIDGE_URL}/webhooks/supabase/lead-closed`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.BRIDGE_SECRET}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ hot_lead_id: data.id }),
          })
          if (bridgeResponse.status === 422) {
            const bridgeBody = await bridgeResponse.json()
            console.warn('Bridge Validierung fehlgeschlagen:', bridgeBody)
            return {
              statusCode: 422,
              headers: corsHeaders,
              body: JSON.stringify({
                error: 'billing_validation_failed',
                message: 'Rechnungsdaten unvollständig',
                fields: bridgeBody.fields || [],
              })
            }
          }
          if (!bridgeResponse.ok) {
            console.error('Bridge Fehler:', bridgeResponse.status, await bridgeResponse.text())
            // Kein Hard-Fail — Lead ist gespeichert, Bridge kann manuell nachgetriggert werden
          } else {
            console.log('Bridge erfolgreich getriggert für Lead:', data.id)
          }
        } catch (bridgeErr) {
          console.error('Bridge-Aufruf fehlgeschlagen:', bridgeErr.message)
          // Kein Hard-Fail
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
