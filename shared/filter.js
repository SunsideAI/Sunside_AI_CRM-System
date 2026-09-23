// Filter für die Listen — dieselben Regeln in Opening, Setting und Closing.
//
// Gefiltert wurde bisher mit festen Auswahlfeldern: im Opening fünf, in den
// anderen beiden je eines. Ausschließen ging nirgends, kombinieren auch nicht.
// Hier ist ein Filter ein Satz aus drei Teilen — Feld, Vergleich, Wert — und
// davon lassen sich mehrere stapeln.
//
// Ausgewertet wird an zwei Stellen: im Browser (Setting, Closing; die Daten
// liegen dort ohnehin vollständig vor) und auf dem Server (Opening, wo knapp
// 29.000 Leads seitenweise kommen). Damit beides dasselbe tut, stehen die
// Regeln hier und nicht dort.

import { spaltenFuer } from './spalten.js'

/** Mehr als sechs Bedingungen liest niemand mehr — und sie widersprechen sich. */
export const MAX_FILTER = 6

export const VERGLEICHE = {
  ist: { name: 'ist', wert: true },
  ist_nicht: { name: 'ist nicht', wert: true },
  enthaelt: { name: 'enthält', wert: true },
  enthaelt_nicht: { name: 'enthält nicht', wert: true },
  groesser: { name: 'größer als', wert: true },
  kleiner: { name: 'kleiner als', wert: true },
  vor: { name: 'vor dem', wert: true },
  nach: { name: 'nach dem', wert: true },
  leer: { name: 'ist leer', wert: false },
  nicht_leer: { name: 'ist gefüllt', wert: false }
}

/** Welche Vergleiche zu einer Spaltenart passen. */
export function vergleicheFuer(art) {
  switch (art) {
    case 'zahl':
    case 'geld':
    case 'prozent':
      return ['ist', 'ist_nicht', 'groesser', 'kleiner', 'leer', 'nicht_leer']
    case 'datum':
    case 'tag':
      return ['vor', 'nach', 'leer', 'nicht_leer']
    case 'badge':
    case 'symbol':
      return ['ist', 'ist_nicht', 'leer', 'nicht_leer']
    default:
      return ['ist', 'ist_nicht', 'enthaelt', 'enthaelt_nicht', 'leer', 'nicht_leer']
  }
}

// ---------------------------------------------------------------------------
// Für die Server-Abfrage im Opening: Welcher Katalog-Schlüssel liegt in welcher
// Spalte der Lead-Tabelle? Was hier fehlt, lässt sich dort nicht filtern.
// ---------------------------------------------------------------------------
export const SPALTE_IN_DB = {
  unternehmen: 'unternehmensname',
  ort: 'stadt',
  land: 'land',
  kontaktiert: 'bereits_kontaktiert',
  ergebnis: 'ergebnis',
  quelle: 'quelle',
  wiedervorlage: 'wiedervorlage_datum',
  besucher: 'monatliche_besuche',
  mehrwert: 'mehrwert',
  absprungrate: 'absprungrate',
  leads_pro_monat: 'anzahl_leads'
}

// Im Opening rechnet der Server, und er kennt nur die Spalten oben plus die
// beiden zusammengesetzten Felder. Alles andere wird dort gar nicht erst
// angeboten - ein Filter, der still nichts tut, ist schlimmer als keiner.
const IM_OPENING = new Set([...Object.keys(SPALTE_IN_DB), 'ansprechpartner', 'kontakt'])

/** Die Felder, nach denen sich in dieser Stufe filtern lässt. */
export function filterFelder(stufe) {
  const alle = spaltenFuer(stufe).filter(s => s.art !== 'verlauf')
  return stufe === 'opening' ? alle.filter(s => IM_OPENING.has(s.schluessel)) : alle
}

/** Prüft eine gespeicherte Filterliste: bekannte Felder, passende Vergleiche. */
export function filterPruefen(stufe, liste) {
  if (!Array.isArray(liste)) return null
  const felder = new Map(filterFelder(stufe).map(s => [s.schluessel, s]))
  const sauber = []
  for (const f of liste.slice(0, MAX_FILTER)) {
    const spalte = felder.get(f?.feld)
    if (!spalte) continue
    if (!vergleicheFuer(spalte.art).includes(f?.vergleich)) continue
    const brauchtWert = VERGLEICHE[f.vergleich]?.wert
    if (brauchtWert && (f.wert === undefined || f.wert === null || f.wert === '')) continue
    sauber.push({ feld: f.feld, vergleich: f.vergleich, wert: brauchtWert ? String(f.wert) : null })
  }
  return sauber
}

const text = (wert) => {
  if (wert === null || wert === undefined) return ''
  if (typeof wert === 'object') {
    // Unternehmen, Kontakt und Symbol tragen mehrere Teile.
    return [wert.titel, wert.unter, wert.telefon, wert.email, wert.zeichen, wert.text]
      .filter(Boolean).join(' ')
  }
  return String(wert)
}

const leer = (wert) => wert === null || wert === undefined || wert === '' || text(wert).trim() === ''

/** Trifft ein einzelner Filter auf eine Zeile zu? */
export function passt(zeile, filter, spalte) {
  const roh = zeile?.[filter.feld]
  const art = spalte?.art

  if (filter.vergleich === 'leer') return leer(roh)
  if (filter.vergleich === 'nicht_leer') return !leer(roh)
  if (leer(roh)) return false

  if (['zahl', 'geld', 'prozent'].includes(art)) {
    const a = Number(roh)
    const b = Number(String(filter.wert).replace(',', '.'))
    if (Number.isNaN(a) || Number.isNaN(b)) return false
    if (filter.vergleich === 'ist') return a === b
    if (filter.vergleich === 'ist_nicht') return a !== b
    if (filter.vergleich === 'groesser') return a > b
    if (filter.vergleich === 'kleiner') return a < b
    return true
  }

  if (['datum', 'tag'].includes(art)) {
    const a = new Date(roh).getTime()
    const b = new Date(filter.wert).getTime()
    if (Number.isNaN(a) || Number.isNaN(b)) return false
    return filter.vergleich === 'vor' ? a < b : a > b
  }

  const links = text(roh).toLowerCase()
  const rechts = String(filter.wert).toLowerCase().trim()
  switch (filter.vergleich) {
    case 'ist': return links === rechts
    case 'ist_nicht': return links !== rechts
    case 'enthaelt': return links.includes(rechts)
    case 'enthaelt_nicht': return !links.includes(rechts)
    default: return true
  }
}

/** Alle Filter zusammen — es gilt: jede Bedingung muss zutreffen. */
export function filtern(zeilen, filter, stufe) {
  if (!filter?.length) return zeilen
  const felder = new Map(filterFelder(stufe).map(s => [s.schluessel, s]))
  return zeilen.filter(z => filter.every(f => passt(z, f, felder.get(f.feld))))
}
