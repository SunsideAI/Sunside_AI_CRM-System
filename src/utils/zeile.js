import { STATUS, anzeigeName } from '../../shared/status.js'

// Eine Zeile für die Liste — egal, aus welcher Stufe der Datensatz kommt.
//
// Opening liest aus der Lead-Tabelle (`unternehmensname`, `stadt`, `telefon`),
// Setting und Closing aus den Hot Leads (`unternehmen`, `ort`, `telefonnummer`).
// Dieselbe Sache hieß also je nach Tab anders, und jede Tabelle hatte ihre
// eigene Übersetzung eingebaut. Hier steht sie einmal; danach kennt die
// Tabelle nur noch die Namen aus dem Spaltenkatalog.

const name = (vor, nach) => [vor, nach].filter(Boolean).join(' ') || null

const zahl = (wert) => (wert === null || wert === undefined || wert === '') ? null : Number(wert)

/** Der letzte Eintrag aus dem Kommentarfeld: „[TT.MM.JJJJ, HH:MM] Text". */
function letzteAktivitaet(kommentar) {
  const treffer = String(kommentar || '')
    .split('\n')
    .find(z => /^\[\d{2}\.\d{2}\.\d{4}/.test(z.trim()))
  if (!treffer) return null
  const kopf = treffer.match(/^\[(\d{2}\.\d{2})\.\d{4}[^\]]*\]\s*(.*)$/)
  if (!kopf) return { tag: null, text: treffer.trim() }
  return { tag: kopf[1], text: (kopf[2] || '').trim() }
}

/** Das Symbol links: Terminart, wo es Termine gibt, sonst der Stand. */
function symbol(stufe, lead) {
  if (stufe === 'followup') {
    // Im Follow-Up sagt das Symbol, ob noch nachgefasst wird.
    const ruht = ['pausiert', 'beendet'].includes(lead.follow_up_status)
    return { zeichen: ruht ? 'offen' : 'kontaktiert', ton: ruht ? 'neutral' : 'gut' }
  }
  if (stufe === 'opening') {
    return lead.kontaktiert ? { zeichen: 'kontaktiert', ton: 'gut' } : { zeichen: 'offen', ton: 'neutral' }
  }
  const ton = lead.status === STATUS.BERATUNG_GEFUEHRT || lead.status === STATUS.GEWONNEN ? 'gut'
    : [STATUS.TERMIN_ABGESAGT, STATUS.NICHT_ERSCHIENEN, STATUS.VERLOREN_ENDGUELTIG].includes(lead.status) ? 'schlecht'
    : 'neutral'
  return { zeichen: lead.terminart === 'Video' ? 'video' : 'telefon', ton }
}

export function zeileAusLead(stufe, lead) {
  const gemeinsam = {
    id: lead.id,
    roh: lead,
    art: symbol(stufe, lead),
    besucher: zahl(lead.monatlicheBesuche),
    mehrwert: zahl(lead.mehrwert),
    absprungrate: lead.absprungrate == null ? null : Number(lead.absprungrate) * 100,
    leads_pro_monat: zahl(lead.anzahlLeads),
    quelle: lead.quelle || null
  }

  if (stufe === 'opening') {
    return {
      ...gemeinsam,
      unternehmen: { titel: lead.unternehmensname || 'Ohne Namen', unter: lead.kategorie || null },
      ansprechpartner: name(lead.ansprechpartnerVorname, lead.ansprechpartnerNachname),
      ort: lead.stadt || null,
      land: lead.land || null,
      kontakt: { telefon: lead.telefon || null, email: lead.email || null },
      ergebnis: lead.ergebnis || null,
      kontaktiert: lead.kontaktiert ? 'Ja' : 'Nein',
      zustaendig: (lead.zugewiesenAn || []).join(', ') || null,
      aktivitaet: letzteAktivitaet(lead.kommentar),
      wiedervorlage: lead.wiedervorlageDatum || null
    }
  }

  // Das Follow-Up hat eine eigene Abfrage mit eigenen Feldnamen (snake_case)
  // und kennt weder Ort noch Website-Zahlen. Es bekommt deshalb seinen eigenen
  // Zweig - übersetzt wird trotzdem auf dieselben Namen wie überall.
  if (stufe === 'followup') {
    return {
      ...gemeinsam,
      unternehmen: {
        titel: lead.unternehmen || 'Ohne Namen',
        unter: name(lead.ansprechpartner_vorname, lead.ansprechpartner_nachname)
      },
      ansprechpartner: name(lead.ansprechpartner_vorname, lead.ansprechpartner_nachname),
      kontakt: { telefon: lead.telefonnummer || null, email: lead.mail || null },
      termin: lead.termin_beratungsgespraech || null,
      status: lead.status ? anzeigeName(lead.status) : null,
      statusWert: lead.status || null,
      setter: lead.setter_name || null,
      closer: lead.closer_name || null,
      naechster_schritt: lead.follow_up_naechster_schritt || null,
      bis_wann: lead.follow_up_datum || null,
      fu_status: lead.follow_up_status || null,
      notiz: letzteAktivitaet(lead.kommentar)
    }
  }

  // Setting und Closing lesen dieselben Hot Leads; der Termin ist der, der in
  // dieser Stufe zählt.
  const termin = stufe === 'closing'
    ? (lead.termin_abschlussgespraech || lead.terminDatum)
    : lead.terminDatum

  return {
    ...gemeinsam,
    unternehmen: { titel: lead.unternehmen || 'Ohne Namen', unter: lead.kategorie || null },
    ansprechpartner: name(lead.ansprechpartnerVorname, lead.ansprechpartnerNachname),
    ort: lead.ort || null,
    bundesland: lead.bundesland || null,
    kontakt: { telefon: lead.telefon || null, email: lead.email || null },
    termin: termin || null,
    terminart: lead.terminart || null,
    // Die Stufe entscheidet, wie der Status heisst: Im Closing steht bei
    // Altkontakten "Termin vereinbart", nicht "Beratungsgespraech vereinbart".
    status: lead.status ? anzeigeName(lead.status, stufe) : null,
    statusWert: lead.status || null,
    zustaendig: (stufe === 'closing' ? lead.closerName : lead.setterName) || null,
    opener: lead.openerName || null,
    setter: lead.setterName || null,
    closer: lead.closerName || null,
    paketname: lead.paketname || null,
    setup: zahl(lead.setup),
    retainer: zahl(lead.retainer),
    laufzeit: lead.laufzeit || null,
    wiedervorlage: lead.wiedervorlage_am || null,
    zugesagt_bis: lead.zugesagt_bis || null,
    angebot_verschickt: lead.angebot_verschickt_am || null,
    nachfass_schritt: zahl(lead.nachfass_schritt),
    no_shows: zahl(lead.no_show_count),
    mobilnummer: lead.mobilnummer || null
  }
}

/** Wonach eine Spalte sortiert: Zahl, Datum oder Text — je nach Inhalt. */
export function sortierwert(zeile, spalte) {
  const wert = zeile[spalte.schluessel]
  if (wert === null || wert === undefined) return null
  switch (spalte.art) {
    case 'titel': return (wert.titel || '').toLowerCase()
    case 'kontakt': return (wert.telefon || wert.email || '').toLowerCase()
    case 'symbol': return wert.zeichen || ''
    case 'verlauf': return wert.tag || ''
    case 'datum':
    case 'tag': return new Date(wert).getTime() || null
    case 'zahl':
    case 'geld':
    case 'prozent': return Number(wert)
    default: return String(wert).toLowerCase()
  }
}

/**
 * Zeilen nach einer Spalte sortieren. Leeres steht immer hinten, egal in
 * welcher Richtung — sonst füllt eine Spalte voller Lücken den Anfang.
 *
 * Sortiert wird über die ganze Liste, nicht nur über die sichtbare Seite:
 * Eine Sortierung, die bei Zeile zehn aufhört, ist keine.
 */
export function sortiere(zeilen, spalte, ab = false) {
  if (!spalte) return zeilen
  const richtung = ab ? -1 : 1
  return [...zeilen].sort((a, b) => {
    const x = sortierwert(a, spalte)
    const y = sortierwert(b, spalte)
    if (x === null && y === null) return 0
    if (x === null) return 1
    if (y === null) return -1
    if (x < y) return -1 * richtung
    if (x > y) return 1 * richtung
    return 0
  })
}
