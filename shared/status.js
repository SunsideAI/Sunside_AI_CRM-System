// Die Status eines Hot Leads - eine Quelle für Frontend und Functions.
//
// Vorher standen diese Zeichenketten rund 140-mal verstreut im Code. Zwei
// davon, "Termin abgesagt" und "Termin verschoben", sind gleichzeitig Werte
// des message_type-Enums für Systemnachrichten - ein pauschales Ersetzen
// hätte die Benachrichtigungen zerschossen. Deshalb: benannte Werte statt
// Zeichenketten.
//
// Quelle: Miro F25.3 (Status-Übergänge), Klartext-Bezeichnungen aus F24.

export const STATUS = {
  BERATUNG_VEREINBART:  'Beratungsgespräch vereinbart',
  BERATUNG_GEFUEHRT:    'Beratungsgespräch geführt',
  ABSCHLUSS_VEREINBART: 'Abschlussgespräch vereinbart',
  IM_ABSCHLUSS:         'Im Abschluss',

  // Diese beiden behalten ihre Schreibweise. "Angebot" ist das Signal an die
  // externe Angebots-Automatisierung, "Angebot versendet" deren Rückmeldung.
  // Kein Datensatz trägt "Angebot" dauerhaft - der Wert existiert nur im Flug.
  // Ein Umbenennen würde diesen Pfad still zerreissen.
  ANGEBOT_ANGEFORDERT:  'Angebot',
  ANGEBOT_VERSCHICKT:   'Angebot versendet',

  WIRD_NACHGEFASST:     'Wird nachgefasst',
  GEWONNEN:             'Gewonnen',
  NICHT_ERSCHIENEN:     'Nicht erschienen',
  TERMIN_ABGESAGT:      'Termin abgesagt',
  VERLOREN_WIEDERVORLAGE: 'Verloren, wiedervorlagefähig',
  VERLOREN_ENDGUELTIG:  'Verloren, endgültig'
}

/**
 * Werte aus der Zeit vor dem OSC-Umbau.
 *
 * Die Datenbank-Migration läuft bewusst NACH diesem Deploy: so kann der Code
 * beide Stände lesen und es gibt kein Fenster, in dem Listen leer aussehen.
 * Geschrieben werden ab hier nur noch die neuen Werte.
 */
const ALTBESTAND = {
  'Lead':              STATUS.BERATUNG_VEREINBART,
  'Geplant':           STATUS.BERATUNG_VEREINBART,
  'Termin verschoben': STATUS.BERATUNG_VEREINBART,
  'Im Closing':        STATUS.IM_ABSCHLUSS,
  'Abgeschlossen':     STATUS.GEWONNEN,
  'Verloren':          STATUS.VERLOREN_ENDGUELTIG,
  'Wiedervorlage':     STATUS.VERLOREN_WIEDERVORLAGE
}

/** Bringt einen beliebigen gespeicherten Wert auf die neue Liste. */
export function normalisiere(status) {
  if (!status) return null
  return ALTBESTAND[status] || OHNE_GROSSSCHREIBUNG[status.trim().toLowerCase()] || status
}

// Fremdsysteme schreiben nicht immer in unserer Schreibweise: Die
// Operations-API setzte am 15.09.2026 "abgeschlossen" klein. Der Wert fiel
// damit aus jeder Zählung der Abschlüsse - ohne Fehler, nur ohne Treffer.
const OHNE_GROSSSCHREIBUNG = Object.fromEntries([
  ...Object.values(STATUS).map(w => [w.toLowerCase(), w]),
  ...Object.entries(ALTBESTAND).map(([alt, neu]) => [alt.toLowerCase(), neu])
])

/** Normalisiert den Status in einem Hot-Lead-Objekt (oder einer Liste). */
export function normalisiereLead(lead) {
  if (Array.isArray(lead)) return lead.map(normalisiereLead)
  if (!lead || typeof lead !== 'object' || !lead.status) return lead
  const neu = normalisiere(lead.status)
  return neu === lead.status ? lead : { ...lead, status: neu }
}

/**
 * Alle Schreibweisen, die auf denselben Zustand zeigen.
 *
 * Für Datenbank-Filter gedacht: Der Filter kommt mit einem neuen Wert herein,
 * der Bestand trägt aber noch den alten, solange die Migration aussteht. Ein
 * `.eq('status', neu)` liefert dann leer - ohne Fehler, nur ohne Ergebnis.
 */
export function beideSchreibweisen(status) {
  const neu = normalisiere(status)
  const alte = Object.entries(ALTBESTAND)
    .filter(([, ziel]) => ziel === neu)
    .map(([alt]) => alt)
  return [neu, ...alte]
}

/** Die Stufen des Prozesses in ihrer Reihenfolge - für Anzeige und Sortierung. */
export const REIHENFOLGE = [
  STATUS.BERATUNG_VEREINBART,
  STATUS.BERATUNG_GEFUEHRT,
  STATUS.ABSCHLUSS_VEREINBART,
  STATUS.IM_ABSCHLUSS,
  STATUS.ANGEBOT_ANGEFORDERT,
  STATUS.ANGEBOT_VERSCHICKT,
  STATUS.WIRD_NACHGEFASST,
  STATUS.GEWONNEN
]

/** Zustände, aus denen nichts mehr folgt. */
export const ENDZUSTAENDE = [STATUS.GEWONNEN, STATUS.VERLOREN_ENDGUELTIG]

export const IST_VERLOREN = [STATUS.VERLOREN_ENDGUELTIG, STATUS.VERLOREN_WIEDERVORLAGE]

/** Was der Nutzer sieht. "Angebot" heisst im Wert anders als in der Anzeige. */
export const ANZEIGE = {
  [STATUS.ANGEBOT_ANGEFORDERT]: 'Angebot wird erstellt',
  [STATUS.ANGEBOT_VERSCHICKT]:  'Angebot verschickt — wartet auf Unterschrift'
}

export function anzeigeName(status) {
  const s = normalisiere(status)
  return ANZEIGE[s] || s || 'Unbekannt'
}

/**
 * Übergangsmatrix, gleichlautend zu status_uebergang_erlaubt() in der
 * Datenbank. Der Code prüft für eine verständliche Fehlermeldung, die
 * Datenbank prüft, damit es niemand umgehen kann.
 */
const UEBERGAENGE = {
  [STATUS.BERATUNG_VEREINBART]:  [STATUS.BERATUNG_GEFUEHRT, STATUS.TERMIN_ABGESAGT, STATUS.NICHT_ERSCHIENEN],
  [STATUS.BERATUNG_GEFUEHRT]:    [STATUS.ABSCHLUSS_VEREINBART, STATUS.WIRD_NACHGEFASST],
  [STATUS.ABSCHLUSS_VEREINBART]: [STATUS.IM_ABSCHLUSS, STATUS.TERMIN_ABGESAGT, STATUS.NICHT_ERSCHIENEN],
  [STATUS.IM_ABSCHLUSS]:         [STATUS.GEWONNEN, STATUS.ANGEBOT_ANGEFORDERT, STATUS.ANGEBOT_VERSCHICKT, STATUS.WIRD_NACHGEFASST],
  [STATUS.ANGEBOT_ANGEFORDERT]:  [STATUS.ANGEBOT_VERSCHICKT, STATUS.IM_ABSCHLUSS],
  [STATUS.ANGEBOT_VERSCHICKT]:   [STATUS.GEWONNEN, STATUS.WIRD_NACHGEFASST, STATUS.IM_ABSCHLUSS],
  [STATUS.WIRD_NACHGEFASST]:     [STATUS.ABSCHLUSS_VEREINBART, STATUS.ANGEBOT_ANGEFORDERT, STATUS.ANGEBOT_VERSCHICKT],
  [STATUS.NICHT_ERSCHIENEN]:     [STATUS.BERATUNG_VEREINBART, STATUS.ABSCHLUSS_VEREINBART],
  [STATUS.TERMIN_ABGESAGT]:      [STATUS.BERATUNG_VEREINBART, STATUS.ABSCHLUSS_VEREINBART],
  [STATUS.VERLOREN_WIEDERVORLAGE]: [STATUS.WIRD_NACHGEFASST, STATUS.BERATUNG_VEREINBART],
  [STATUS.GEWONNEN]:             [],
  [STATUS.VERLOREN_ENDGUELTIG]:  []
}

export function uebergangErlaubt(von, nach) {
  const v = normalisiere(von)
  const n = normalisiere(nach)
  if (!v || v === n) return true
  // Absagen ist aus jeder Stufe möglich.
  if (IST_VERLOREN.includes(n)) return true
  return (UEBERGAENGE[v] || []).includes(n)
}

/**
 * In welcher Stufe des Prozesses ein Kontakt gerade steckt.
 *
 * Die Stufe steht nirgends als Feld - sie ergibt sich aus dem Status und, bei
 * den beiden geplatzten Terminen, aus der Frage, ob noch ein Closer dranhängt.
 * Ein geplatztes ABSCHLUSSgespräch ohne Closer ist wieder Sache des Setters;
 * behält der Closer es (no_show_keep_in_closing), bleibt es im Closing.
 *
 * Gebraucht wird das überall dort, wo eine Ansicht sagt, wo der Kontakt liegt:
 * Das Opening zeigte jedem gebuchten Beratungstermin an, er sei "im
 * Closing-Prozess" - auch wenn er noch beim Setter lag.
 */
export const STUFE = {
  OPENING:  'opening',
  SETTING:  'setting',
  CLOSING:  'closing',
  GEWONNEN: 'gewonnen',
  VERLOREN: 'verloren'
}

export function stufeVonLead(lead) {
  const s = normalisiere(lead?.status)
  if (!s) return STUFE.OPENING

  if (s === STATUS.GEWONNEN) return STUFE.GEWONNEN
  if (IST_VERLOREN.includes(s)) return STUFE.VERLOREN

  if (s === STATUS.NICHT_ERSCHIENEN || s === STATUS.TERMIN_ABGESAGT) {
    return (lead.closer_id || lead.closerId) ? STUFE.CLOSING : STUFE.SETTING
  }
  if (s === STATUS.BERATUNG_VEREINBART || s === STATUS.BERATUNG_GEFUEHRT) return STUFE.SETTING

  return STUFE.CLOSING
}

/** Wie eine Stufe in der Oberfläche heisst - und was sie für andere bedeutet. */
export const STUFE_TEXT = {
  [STUFE.SETTING]: {
    name: 'Setting',
    kopf: 'Dieser Kontakt ist im Setting',
    satz: 'Das Beratungsgespräch liegt beim Setter. Du kannst weiterhin Kommentare hinzufügen.'
  },
  [STUFE.CLOSING]: {
    name: 'Closing',
    kopf: 'Dieser Kontakt ist im Closing',
    satz: 'Änderungen laufen über die Closing-Seite. Du kannst weiterhin Kommentare hinzufügen.'
  },
  [STUFE.GEWONNEN]: {
    name: 'Abschluss',
    kopf: 'Dieser Kontakt ist gewonnen',
    satz: 'Der Kontakt ist Kunde. Du kannst weiterhin Kommentare hinzufügen.'
  },
  [STUFE.VERLOREN]: {
    name: 'Abschluss',
    kopf: 'Dieser Kontakt ist verloren',
    satz: 'Hier ist nichts mehr zu tun. Du kannst weiterhin Kommentare hinzufügen.'
  }
}

/**
 * Wer den Kontakt in seiner aktuellen Stufe inhaltlich ändern darf.
 * Alle anderen Beteiligten dürfen weiter kommentieren - mehr nicht.
 */
export function zustaendigFuerStufe(lead) {
  const stufe = stufeVonLead(lead)
  const wert = (...namen) => namen.map(n => lead?.[n]).find(Boolean) || null

  if (stufe === STUFE.SETTING) {
    // Ohne Setter liegt der Kontakt wieder beim Opener: Er terminiert neu.
    return [wert('setter_id', 'setterId') || wert('opener_id', 'openerId')].filter(Boolean)
  }
  return [wert('closer_id', 'closerId'), wert('reaktivierung_bearbeiter_id', 'reaktivierungBearbeiterId')].filter(Boolean)
}

/** Sonderweg: genau eine Stufe zurück, mit Pflicht-Grund. */
export function ruecknahmeZiel(von) {
  const v = normalisiere(von)
  if (v === STATUS.ABSCHLUSS_VEREINBART) return STATUS.BERATUNG_GEFUEHRT
  if (v === STATUS.BERATUNG_GEFUEHRT) return STATUS.BERATUNG_VEREINBART
  return null
}
