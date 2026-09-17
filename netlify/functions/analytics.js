// Analytics API: die Auswertungen für Opening, Setting und Closing.
//
// Drei Stufen, drei Auswertungen, und jede gehört einer Rolle:
//
//   type=opening  Kaltakquise      Opener (auch Coldcaller)
//   type=setter   Beratungsgespräch Setter
//   type=closing  Abschluss         Closer
//
// Die Leitung sieht alle Zahlen und kann nach Person filtern. Alle anderen
// sehen ausschliesslich ihre eigenen - über die ID aus dem Sitzungs-Token.
// Früher wurde der Name aus der Anfrage per Teilzeichenkette verglichen:
// "Max" hätte die Zahlen von "Max Lehmann" UND "Maximilian Gaik" bekommen.
//
// type=setting ist der alte Name der Opening-Auswertung und bleibt als
// Alias bestehen, damit ein noch offener Browser-Tab nicht bricht.
import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'
import { STATUS, normalisiere, IST_VERLOREN } from '../../shared/status.js'
import { istOpener, istSetter, istCloser, istLeitung } from '../../shared/rollen.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
}

const antwort = (statusCode, body) => ({ statusCode, headers: corsHeaders, body: JSON.stringify(body) })

/** Welche Rolle eine Auswertung öffnen darf. Die Leitung darf immer. */
const AUSWERTUNG = {
  opening: istOpener,
  setter:  istSetter,
  closing: istCloser
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  // Identitaet kommt aus dem Sitzungs-Token, nicht aus der Anfrage.
  const zugang = anmeldungVerlangen(event)
  if (zugang.antwort) return zugang.antwort
  const angemeldet = zugang.nutzer

  if (event.httpMethod !== 'GET') {
    return antwort(405, { error: 'Method not allowed' })
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return antwort(500, { error: 'Server nicht konfiguriert' })
  }

  try {
    const params = event.queryStringParameters || {}
    const type = params.type === 'setting' || !params.type ? 'opening' : params.type
    const darf = AUSWERTUNG[type]
    if (!darf) return antwort(400, { error: `Unbekannte Auswertung: ${type}` })

    // Die Rollen aus dem Token, nicht aus der Datenbank: Wer eine Rolle
    // verliert, verliert sie mit der nächsten Anmeldung - wie überall sonst.
    const leitung = istLeitung(angemeldet.rollen)
    if (!leitung && !darf(angemeldet.rollen)) {
      return antwort(403, { error: 'Keine Berechtigung für diese Auswertung', code: 'rolle_fehlt' })
    }

    // Wessen Zahlen: die eigenen - ausser für die Leitung, die optional eine
    // Person wählt. Ein filterUserId eines Nicht-Leiters wird ignoriert.
    let personId = leitung ? null : angemeldet.id
    if (leitung) {
      if (params.filterUserId) personId = params.filterUserId
      else if (params.filterUserName) personId = await idZumNamen(params.filterUserName) || 'unbekannt'
    }

    const zeitraum = {
      von: gueltigesDatum(params.startDate),
      bis: gueltigesDatum(params.endDate)
    }

    const rechner = { opening: openingZahlen, setter: setterZahlen, closing: closingZahlen }[type]
    const ergebnis = await rechner({ leitung, personId, zeitraum })
    return antwort(200, { ...ergebnis, sicht: { type, leitung, personId } })
  } catch (error) {
    console.error('Analytics Error:', error)
    return antwort(500, { error: error.message })
  }
}

// ==========================================
// Gemeinsame Helfer
// ==========================================

function gueltigesDatum(wert) {
  return typeof wert === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(wert) ? wert : null
}

// Ein Termin um 23:30 Uhr in Berlin ist in UTC schon der nächste Tag. Mit
// split('T') landete er im falschen Tag - und am Monatsende im falschen Monat.
const BERLIN = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
})

/** Kalendertag in Berlin als YYYY-MM-DD. Reine Datumswerte bleiben, wie sie sind. */
export function berlinTag(wert) {
  if (!wert) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(wert)) return wert
  const d = new Date(wert)
  return isNaN(d.getTime()) ? null : BERLIN.format(d)
}

/** Liegt ein Tag im Zeitraum? Ohne Datum zählt nur, wenn kein Zeitraum gesetzt ist. */
function imZeitraum(tag, { von, bis }) {
  if (!von && !bis) return true
  if (!tag) return false
  if (von && tag < von) return false
  if (bis && tag > bis) return false
  return true
}

async function alleSeiten(tabelle, spalten, filter = q => q) {
  const seite = 1000
  let alle = []
  for (let i = 0; ; i++) {
    const { data, error } = await filter(supabase.from(tabelle).select(spalten))
      .order('id')
      .range(i * seite, (i + 1) * seite - 1)
    if (error) throw new Error(`${tabelle}: ${error.message}`)
    if (!data || data.length === 0) break
    alle = alle.concat(data)
    if (data.length < seite) break
  }
  return alle
}

async function namensListe() {
  const { data, error } = await supabase.from('users').select('id, vor_nachname')
  if (error) throw new Error(error.message)
  return Object.fromEntries((data || []).map(u => [u.id, u.vor_nachname || 'Unbekannt']))
}

async function idZumNamen(name) {
  const { data } = await supabase.from('users').select('id').eq('vor_nachname', name).limit(1)
  return data?.[0]?.id || null
}

const quote = (teil, ganz) => (ganz > 0 ? (teil / ganz) * 100 : 0)

/** Addiert Zähler in einen Eimer je Tag. */
function eintragen(verlauf, tag, werte) {
  if (!tag) return
  const eimer = verlauf[tag] || (verlauf[tag] = {})
  for (const [k, v] of Object.entries(werte)) eimer[k] = (eimer[k] || 0) + v
}

// ==========================================
// OPENING (Kaltakquise)
// ==========================================
//
// Eine Einwahl ist ein kontaktierter Lead mit Datum - aus dem aktiven
// Bestand und aus dem Archiv. Das Archiv hält frühere Anrufe fest, deren
// Lead zurückgesetzt und neu vergeben wurde; beide zählen.
//
// "Erreicht" heisst: jemand hat abgenommen. "Ungültiger Lead" und ein
// fehlendes Ergebnis zählten vorher als erreicht, obwohl dort niemand
// gesprochen hat.

function openingKategorie(ergebnisRoh, hatWiedervorlage) {
  const e = (ergebnisRoh || '').toLowerCase()
  if (e.includes('nicht erreicht')) return 'nichtErreicht'
  if (e.includes('ungültig') || e.includes('ungueltig')) return 'ungueltig'
  if (e.includes('beratungsgespräch') || e.includes('beratungsgespraech') || e.includes('termin')) return 'beratungsgespraech'
  if (e.includes('unterlage') || e.includes('wiedervorlage')) return 'unterlagen'
  if (e.includes('kein interesse') || e.includes('absage')) return 'keinInteresse'
  // Kein Ergebnis eingetragen, aber eine Wiedervorlage gesetzt: das
  // Gespräch hat stattgefunden und geht weiter.
  if (!e && hatWiedervorlage) return 'unterlagen'
  return 'ohneErgebnis'
}

async function openingZahlen({ leitung, personId, zeitraum }) {
  const [aktiv, zuweisungen, archiv, namen] = await Promise.all([
    alleSeiten('leads', 'id, ergebnis, datum, wiedervorlage_datum', q => q.eq('bereits_kontaktiert', true)),
    alleSeiten('lead_assignments', 'id, lead_id, user_id'),
    alleSeiten('lead_archive', 'id, bereits_kontaktiert, ergebnis, datum, user_id'),
    namensListe()
  ])

  const zugewiesen = {}
  for (const z of zuweisungen) (zugewiesen[z.lead_id] ||= []).push(z.user_id)

  const anrufe = [
    ...aktiv.map(l => ({
      tag: berlinTag(l.datum),
      kategorie: openingKategorie(l.ergebnis, !!l.wiedervorlage_datum),
      personen: zugewiesen[l.id] || []
    })),
    ...archiv.filter(a => a.bereits_kontaktiert).map(a => ({
      tag: berlinTag(a.datum),
      kategorie: openingKategorie(a.ergebnis, false),
      personen: a.user_id ? [a.user_id] : []
    }))
  ]

  const leer = () => ({ einwahlen: 0, erreicht: 0, beratungsgespraech: 0, unterlagen: 0, keinInteresse: 0, nichtErreicht: 0, ungueltig: 0, ohneErgebnis: 0 })
  const summe = leer()
  const verlauf = {}
  const proPerson = {}

  const zaehle = (z, kategorie) => {
    z.einwahlen++
    z[kategorie]++
    if (['beratungsgespraech', 'unterlagen', 'keinInteresse'].includes(kategorie)) z.erreicht++
  }

  for (const a of anrufe) {
    if (!imZeitraum(a.tag, zeitraum)) continue
    if (personId && !a.personen.includes(personId)) continue

    zaehle(summe, a.kategorie)
    eintragen(verlauf, a.tag, { count: 1 })

    if (leitung) {
      for (const p of a.personen) zaehle(proPerson[p] ||= { id: p, ...leer() }, a.kategorie)
    }
  }

  return {
    summary: {
      ...summe,
      erreichQuote: quote(summe.erreicht, summe.einwahlen),
      beratungsgespraechQuote: quote(summe.beratungsgespraech, summe.erreicht),
      unterlagenQuote: quote(summe.unterlagen, summe.erreicht),
      keinInteresseQuote: quote(summe.keinInteresse, summe.erreicht)
    },
    zeitverlauf: formatZeitverlauf(verlauf, zeitraum),
    perUser: Object.values(proPerson)
      .map(p => ({ ...p, name: namen[p.id] || `User ${String(p.id).slice(0, 6)}` }))
      .sort((a, b) => b.einwahlen - a.einwahlen)
  }
}

// ==========================================
// SETTING (Beratungsgespräch)
// ==========================================
//
// Jeder Hot Lead mit einem Beratungstermin ist ein Gespräch des Setters.
// Wie es ausging, steht im Status - mit einer Falle: "Nicht erschienen" und
// "Termin abgesagt" gibt es für beide Termine. Hat der Lead schon einen
// Abschlusstermin, ist der geplatzt, nicht das Beratungsgespräch.

const CLOSING_STUFEN = [
  STATUS.ABSCHLUSS_VEREINBART, STATUS.IM_ABSCHLUSS,
  STATUS.ANGEBOT_ANGEFORDERT, STATUS.ANGEBOT_VERSCHICKT, STATUS.GEWONNEN
]

export function beratungsAusgang(lead, heute) {
  const s = normalisiere(lead.status)
  const abschlussTermin = !!lead.termin_abschlussgespraech

  if (s === STATUS.BERATUNG_VEREINBART) {
    const tag = berlinTag(lead.termin_beratungsgespraech)
    return tag && tag < heute ? 'ohneAusgang' : 'anstehend'
  }
  if (!abschlussTermin && s === STATUS.NICHT_ERSCHIENEN) return 'noShow'
  if (!abschlussTermin && s === STATUS.TERMIN_ABGESAGT) return 'abgesagt'
  if (abschlussTermin || CLOSING_STUFEN.includes(s)) return 'uebergeben'
  if (s === STATUS.WIRD_NACHGEFASST) return 'nachfassen'
  if (IST_VERLOREN.includes(s)) return 'verloren'
  if (s === STATUS.BERATUNG_GEFUEHRT) return 'gefuehrt'
  return 'anstehend'
}

async function setterZahlen({ leitung, personId, zeitraum }) {
  const [leads, namen] = await Promise.all([
    alleSeiten('hot_leads', 'id, status, setter_id, termin_beratungsgespraech, termin_abschlussgespraech', q => q.not('termin_beratungsgespraech', 'is', null)),
    namensListe()
  ])
  const heute = berlinTag(new Date().toISOString())

  const leer = () => ({ termine: 0, stattgefunden: 0, uebergeben: 0, nachfassen: 0, verloren: 0, gefuehrt: 0, noShow: 0, abgesagt: 0, ohneAusgang: 0, anstehend: 0 })
  const summe = leer()
  const verlauf = {}
  const proPerson = {}

  const zaehle = (z, ausgang) => {
    z.termine++
    z[ausgang]++
    if (['uebergeben', 'nachfassen', 'verloren', 'gefuehrt'].includes(ausgang)) z.stattgefunden++
  }

  for (const lead of leads) {
    const tag = berlinTag(lead.termin_beratungsgespraech)
    if (!imZeitraum(tag, zeitraum)) continue
    if (personId && lead.setter_id !== personId) continue

    const ausgang = beratungsAusgang(lead, heute)
    zaehle(summe, ausgang)

    const stattgefunden = ['uebergeben', 'nachfassen', 'verloren', 'gefuehrt'].includes(ausgang)
    eintragen(verlauf, tag, {
      count: 1,
      stattgefunden: stattgefunden ? 1 : 0,
      geplatzt: ausgang === 'noShow' || ausgang === 'abgesagt' ? 1 : 0,
      offen: ausgang === 'anstehend' || ausgang === 'ohneAusgang' ? 1 : 0
    })

    if (leitung && lead.setter_id) {
      zaehle(proPerson[lead.setter_id] ||= { id: lead.setter_id, ...leer() }, ausgang)
    }
  }

  const mitQuoten = z => ({
    ...z,
    // Erschienen ist, wer zum Gespräch kam. Abgesagte Termine fehlen im
    // Nenner - eine rechtzeitige Absage ist kein Nichterscheinen.
    erscheinungsQuote: quote(z.stattgefunden, z.stattgefunden + z.noShow),
    uebergabeQuote: quote(z.uebergeben, z.stattgefunden)
  })

  return {
    summary: mitQuoten(summe),
    zeitverlauf: formatZeitverlauf(verlauf, zeitraum),
    perUser: Object.values(proPerson)
      .map(p => mitQuoten({ ...p, name: namen[p.id] || `User ${String(p.id).slice(0, 6)}` }))
      .sort((a, b) => b.termine - a.termine)
  }
}

// ==========================================
// CLOSING (Abschluss)
// ==========================================
//
// Im Closing ist ein Lead, sobald ein Closer ihn hat oder ein
// Abschlusstermin steht. Was noch beim Setter liegt, gehört nicht hierher:
// Vorher zählte jeder Lead im System als "offen" im Closing - auch der
// gerade erst gebuchte Beratungstermin - und jedes geplatzte
// Beratungsgespräch als No-Show des Closers.

export function closingAusgang(lead) {
  const s = normalisiere(lead.status)
  const abschlussTermin = !!lead.termin_abschlussgespraech
  if (!lead.closer_id && !abschlussTermin) return null

  if (s === STATUS.GEWONNEN) return 'gewonnen'
  if (IST_VERLOREN.includes(s)) return 'verloren'
  if (s === STATUS.NICHT_ERSCHIENEN || s === STATUS.TERMIN_ABGESAGT) {
    return abschlussTermin ? 'noShow' : null
  }
  if (s === STATUS.ANGEBOT_ANGEFORDERT || s === STATUS.ANGEBOT_VERSCHICKT) return 'angebotVersendet'
  if ([STATUS.ABSCHLUSS_VEREINBART, STATUS.IM_ABSCHLUSS, STATUS.WIRD_NACHGEFASST].includes(s)) return 'offen'
  return null
}

/** Der Tag, an dem ein Closing-Ergebnis zählt. */
function closingTag(lead, ausgang) {
  const termin = lead.termin_abschlussgespraech || lead.termin_beratungsgespraech
  return berlinTag(ausgang === 'gewonnen' ? (lead.kunde_seit || termin) : termin)
}

export function dealWert(lead) {
  const setup = Number(lead.setup) || 0
  const retainer = Number(lead.retainer) || 0
  const laufzeit = parseInt(lead.laufzeit) || 6
  return setup + retainer * laufzeit
}

async function closingZahlen({ leitung, personId, zeitraum }) {
  const [leads, namen] = await Promise.all([
    alleSeiten('hot_leads', 'id, status, closer_id, setup, retainer, laufzeit, kunde_seit, termin_beratungsgespraech, termin_abschlussgespraech'),
    namensListe()
  ])

  const leer = () => ({ gewonnen: 0, verloren: 0, angebotVersendet: 0, noShow: 0, offen: 0, umsatz: 0 })
  const summe = leer()
  const verlauf = {}
  const proPerson = {}

  for (const lead of leads) {
    const ausgang = closingAusgang(lead)
    if (!ausgang) continue
    const tag = closingTag(lead, ausgang)
    if (!imZeitraum(tag, zeitraum)) continue
    if (personId && lead.closer_id !== personId) continue

    const wert = ausgang === 'gewonnen' ? dealWert(lead) : 0
    const zaehle = z => { z[ausgang]++; z.umsatz += wert }
    zaehle(summe)
    if (ausgang === 'gewonnen') eintragen(verlauf, tag, { count: 1, umsatz: wert })

    if (leitung && lead.closer_id) zaehle(proPerson[lead.closer_id] ||= { id: lead.closer_id, ...leer() })
  }

  const entschieden = summe.gewonnen + summe.verloren

  // Die Last je Closer: alles, was jemandem gehört, unabhängig vom Zeitraum.
  let leadsProCloser = []
  if (leitung) {
    const last = {}
    for (const lead of leads) {
      const name = lead.closer_id ? (namen[lead.closer_id] || 'Unbekannt') : 'Pool (nicht zugewiesen)'
      const z = last[name] ||= { name, gesamt: 0, aktiv: 0, imClosing: 0, angebotVersendet: 0, abgeschlossen: 0, verloren: 0 }
      const s = normalisiere(lead.status)
      z.gesamt++
      if (s === STATUS.GEWONNEN) z.abgeschlossen++
      else if (IST_VERLOREN.includes(s)) z.verloren++
      else {
        z.aktiv++
        if (s === STATUS.IM_ABSCHLUSS) z.imClosing++
        else if (s === STATUS.ANGEBOT_VERSCHICKT || s === STATUS.ANGEBOT_ANGEFORDERT) z.angebotVersendet++
      }
    }
    leadsProCloser = Object.values(last).sort((a, b) => b.aktiv - a.aktiv)
  }

  return {
    summary: {
      gewonnen: summe.gewonnen,
      verloren: summe.verloren,
      angebotVersendet: summe.angebotVersendet,
      noShow: summe.noShow,
      offen: summe.offen + summe.angebotVersendet,
      closingQuote: quote(summe.gewonnen, entschieden),
      umsatzGesamt: summe.umsatz,
      umsatzDurchschnitt: summe.gewonnen > 0 ? summe.umsatz / summe.gewonnen : 0
    },
    zeitverlauf: formatZeitverlauf(verlauf, zeitraum),
    perUser: Object.values(proPerson)
      .map(p => ({ ...p, offen: p.offen + p.angebotVersendet, name: namen[p.id] || 'Unbekannt' }))
      .sort((a, b) => b.umsatz - a.umsatz),
    leadsProCloser
  }
}

// ==========================================
// Zeitverlauf
// ==========================================
//
// Eingabe: Zähler je Berliner Kalendertag. Ausgabe: Tage, Wochen oder
// Monate - je nach Länge des Zeitraums. Gerechnet wird nur mit
// Datums-Zeichenketten, damit die Zeitzone des Servers keine Rolle spielt.

const tagPlus = (tag, n) => {
  const d = new Date(`${tag}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const alsDatum = tag => new Date(`${tag}T12:00:00Z`)

function summiere(verlauf, tage) {
  const z = {}
  for (const t of tage) {
    for (const [k, v] of Object.entries(verlauf[t] || {})) z[k] = (z[k] || 0) + v
  }
  return { count: 0, umsatz: 0, ...z }
}

function formatZeitverlauf(verlauf, { von, bis }) {
  const heute = berlinTag(new Date().toISOString())
  const vorhandene = Object.keys(verlauf).sort()
  const ende = bis || heute
  // Ohne Startdatum ("Gesamt") ab dem ersten Eintrag - höchstens zwei Jahre,
  // sonst wird der Monatsverlauf unlesbar.
  const zweiJahre = tagPlus(ende, -730)
  let start = von || vorhandene[0] || tagPlus(ende, -180)
  if (!von && start < zweiJahre) start = zweiJahre
  if (start > ende) return []

  const tageZwischen = (a, b) => {
    const liste = []
    for (let t = a; t <= b; t = tagPlus(t, 1)) liste.push(t)
    return liste
  }
  const dauer = Math.round((alsDatum(ende) - alsDatum(start)) / 86400000) + 1
  const ergebnis = []

  if (dauer <= 14) {
    for (const t of tageZwischen(start, ende)) {
      ergebnis.push({
        period: t,
        label: alsDatum(t).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', timeZone: 'UTC', ...(dauer === 1 ? { month: 'short' } : {}) }),
        ...summiere(verlauf, [t])
      })
    }
  } else if (dauer <= 62) {
    // Wochen ab Montag. Die erste und letzte Woche werden auf den Zeitraum
    // gekürzt, damit nichts ausserhalb mitgezählt wird.
    let t = start
    while (t <= ende) {
      const wochentag = (alsDatum(t).getUTCDay() + 6) % 7
      const sonntag = tagPlus(t, 6 - wochentag)
      const bisTag = sonntag < ende ? sonntag : ende
      ergebnis.push({ period: `KW${kalenderwoche(t)}-${t}`, label: `KW ${kalenderwoche(t)}`, ...summiere(verlauf, tageZwischen(t, bisTag)) })
      t = tagPlus(bisTag, 1)
    }
  } else {
    let monat = start.slice(0, 7)
    while (monat <= ende.slice(0, 7)) {
      const tage = Object.keys(verlauf).filter(t => t.startsWith(monat) && t >= start && t <= ende)
      ergebnis.push({
        period: monat,
        label: alsDatum(`${monat}-01`).toLocaleDateString('de-DE', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
        ...summiere(verlauf, tage)
      })
      const [j, m] = monat.split('-').map(Number)
      monat = m === 12 ? `${j + 1}-01` : `${j}-${String(m + 1).padStart(2, '0')}`
    }
  }
  return ergebnis
}

function kalenderwoche(tag) {
  const d = alsDatum(tag)
  const wochentag = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - wochentag)
  const jahresbeginn = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - jahresbeginn) / 86400000) + 1) / 7)
}
