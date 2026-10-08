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

  // Der Abschluss aus Sicht des Vertriebs: Der Kunde hat unterschrieben, die
  // Arbeit des Closers ist getan. "Gewonnen" ist etwas anderes - es loest die
  // Rechnung aus (Abrechnungs-Bridge) und bleibt deshalb der Leitung
  // vorbehalten. Wer unterschrieben hat, ist noch nicht abgerechnet.
  ANGEBOT_UNTERSCHRIEBEN: 'Angebot unterschrieben',
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

/**
 * Status, die nur die Leitung setzen darf.
 *
 * "Gewonnen" ist nicht bloss eine Beschriftung: Der Wechsel dorthin meldet den
 * Abschluss an die Abrechnungs-Bridge, und damit entsteht eine Rechnung. Das
 * ist keine Entscheidung des Vertriebs. Wer unterschrieben hat, setzt
 * ANGEBOT_UNTERSCHRIEBEN - fachlich der Abschluss, nur eben ohne Rechnung.
 * Die Leitung hebt ihn danach.
 */
export const NUR_LEITUNG = [STATUS.GEWONNEN]

export function statusBrauchtLeitung(status) {
  return NUR_LEITUNG.includes(normalisiere(status))
}

/** Zustände, aus denen nichts mehr folgt. */
export const ENDZUSTAENDE = [STATUS.GEWONNEN, STATUS.VERLOREN_ENDGUELTIG]

export const IST_VERLOREN = [STATUS.VERLOREN_ENDGUELTIG, STATUS.VERLOREN_WIEDERVORLAGE]

/**
 * Der Vertrag steht - fuer die Vertriebsstatistik ist das der Abschluss.
 *
 * Nicht dasselbe wie abgerechnet: Die Rechnung haengt allein an GEWONNEN.
 * Wer die Leistung des Vertriebs zaehlt, meint diese Liste; wer Umsatz zaehlt,
 * meint GEWONNEN.
 */
export const IST_ABSCHLUSS = [STATUS.ANGEBOT_UNTERSCHRIEBEN, STATUS.GEWONNEN]

export function istAbschluss(status) {
  return IST_ABSCHLUSS.includes(normalisiere(status))
}

/** Was der Nutzer sieht. "Angebot" heisst im Wert anders als in der Anzeige. */
export const ANZEIGE = {
  [STATUS.ANGEBOT_ANGEFORDERT]: 'Angebot wird erstellt',
  [STATUS.ANGEBOT_VERSCHICKT]:  'Angebot verschickt, wartet auf Unterschrift'
}

/**
 * Wie ein Status in einer Stufe heisst.
 *
 * Im Closing gibt es kein Beratungsgespraech - das ist das Setting. Kontakte
 * von vor dem OSC-Umbau tragen trotzdem einen Beratungs-Status, obwohl sie
 * beim Closer liegen: Damals gab es nur einen Termin, und der war seiner. Die
 * Migration laesst das bewusst stehen (Geschichte wird nicht erfunden), also
 * darf hier nur die Anzeige helfen: Im Closing heisst es "Termin vereinbart"
 * statt "Beratungsgespraech vereinbart". Ein Abschlussgespraech daraus zu
 * machen waere eine Behauptung - einen Abschlusstermin haben diese Kontakte
 * nicht.
 */
const ANZEIGE_IM_CLOSING = {
  [STATUS.BERATUNG_VEREINBART]: 'Termin vereinbart',
  [STATUS.BERATUNG_GEFUEHRT]:   'Termin geführt'
}

export function anzeigeName(status, stufe = null) {
  const s = normalisiere(status)
  if (stufe === STUFE.CLOSING && ANZEIGE_IM_CLOSING[s]) return ANZEIGE_IM_CLOSING[s]
  return ANZEIGE[s] || s || 'Unbekannt'
}

/**
 * Wie der Stand DIESES Kontakts heisst - nicht nur, wie sein Statusfeld heisst.
 *
 * Beides kann auseinanderlaufen: Eine Terminverschiebung setzt den Status auf
 * einen Beratungswert zurueck, auch wenn die Uebergabe an den Closer laengst
 * steht. Dann zeigte die Liste „Beratungsgespräch vereinbart" bei einem
 * Kontakt, der ein gebuchtes Abschlussgespraech hat. Hinkt der Status der
 * Uebergabe hinterher, gilt die Uebergabe.
 *
 * Nur fuer die beiden Beratungswerte: Ein Kontakt, der im Closing schon beim
 * Angebot steht, behaelt selbstverstaendlich seinen eigenen Stand.
 */
export function statusBasisVonLead(lead, stufe = null) {
  const s = normalisiere(lead?.status)
  if (anCloserUebergeben(lead)
      && (s === STATUS.BERATUNG_VEREINBART || s === STATUS.BERATUNG_GEFUEHRT)) {
    return ANZEIGE[STATUS.ABSCHLUSS_VEREINBART] || STATUS.ABSCHLUSS_VEREINBART
  }
  return anzeigeName(s, stufe)
}

export function anzeigeNameVonLead(lead, stufe = null) {
  const s = normalisiere(lead?.status)
  /* „Beratungsgespräch geführt" sagt nicht, wie es ausging. Drei ganz
     verschiedene Kontakte tragen denselben Wert: der noch nicht
     dokumentierte, der vertagte und der übergebene. Für das Setting gibt es
     keinen eigenen Status „vertagt" - „Wird nachgefasst" gehört laut
     STATUS_JE_STUFE ins Closing und würde den Kontakt dorthin schieben.
     Deshalb steht die Entscheidung in der Anzeige statt im Statusfeld: Der
     Wert bleibt, wie er ist, Übergänge und Auswertungen merken nichts. */
  const zusatz = statusZusatzVonLead(lead)
  const basis = statusBasisVonLead(lead, stufe)
  return zusatz ? `${basis} · ${zusatz}` : basis
}

/**
 * Nur der Zusatz, ohne den Status davor.
 *
 * In der Liste ist die Statuspille einzeilig und bricht nicht um; der lange
 * Text spraengte die Spalte. Dort steht deshalb der Status in der Pille und
 * der Zusatz klein darunter. In der Schublade ist Platz fuer beides in einer
 * Zeile - dafuer gibt es anzeigeNameVonLead().
 */
export function statusZusatzVonLead(lead) {
  const s = normalisiere(lead?.status)
  if (s === STATUS.BERATUNG_GEFUEHRT && vertagt(lead)) return 'Entscheidung vertagt'
  return null
}

/** Gespräch geführt, aber ohne festen nächsten Schritt: der Setter fasst nach. */
export function vertagt(lead) {
  const ergebnis = lead?.ergebnis_beratung ?? lead?.ergebnisBeratung
  return ergebnis === 'Vertagt ohne festen Schritt'
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
  [STATUS.IM_ABSCHLUSS]:         [STATUS.ANGEBOT_UNTERSCHRIEBEN, STATUS.GEWONNEN, STATUS.ANGEBOT_ANGEFORDERT, STATUS.ANGEBOT_VERSCHICKT, STATUS.WIRD_NACHGEFASST],
  [STATUS.ANGEBOT_ANGEFORDERT]:  [STATUS.ANGEBOT_VERSCHICKT, STATUS.IM_ABSCHLUSS],
  [STATUS.ANGEBOT_VERSCHICKT]:   [STATUS.ANGEBOT_UNTERSCHRIEBEN, STATUS.GEWONNEN, STATUS.WIRD_NACHGEFASST, STATUS.IM_ABSCHLUSS],
  [STATUS.WIRD_NACHGEFASST]:     [STATUS.ABSCHLUSS_VEREINBART, STATUS.ANGEBOT_ANGEFORDERT, STATUS.ANGEBOT_VERSCHICKT, STATUS.ANGEBOT_UNTERSCHRIEBEN],
  [STATUS.NICHT_ERSCHIENEN]:     [STATUS.BERATUNG_VEREINBART, STATUS.ABSCHLUSS_VEREINBART],
  [STATUS.TERMIN_ABGESAGT]:      [STATUS.BERATUNG_VEREINBART, STATUS.ABSCHLUSS_VEREINBART],
  [STATUS.VERLOREN_WIEDERVORLAGE]: [STATUS.WIRD_NACHGEFASST, STATUS.BERATUNG_VEREINBART],
  // Unterschrieben ist kein Endzustand: Die Leitung macht daraus "Gewonnen",
  // und wenn der Vertrag doch platzt, geht es zurueck in die Nachfassung.
  [STATUS.ANGEBOT_UNTERSCHRIEBEN]: [STATUS.GEWONNEN, STATUS.WIRD_NACHGEFASST, STATUS.VERLOREN_ENDGUELTIG],
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

/**
 * Ist die Übergabe an den Closer vollzogen?
 *
 * Der Status allein genügt dafür nicht. Am 28.09.2026 stand ein längst
 * übergebener Kontakt wieder unter „Anstehend" im Setting: Sein Status war
 * durch eine Terminverschiebung auf einen Beratungswert zurückgefallen,
 * während Ergebnis, Abschlusstermin und Closer längst gesetzt waren. Die
 * Sperre hing am Status und griff deshalb nicht — der Setter hätte am Kontakt
 * des Closers weiterarbeiten können.
 *
 * Gemessen wird am Ergebnis des Beratungsgesprächs, nicht am Abschlusstermin:
 * Der Termin bleibt auch nach einer Rücknahme als Information stehen, das
 * Ergebnis räumt die Rücknahme mit ab. Sonst käme ein zurückgeholter Kontakt
 * nie wieder ins Setting.
 */
export function anCloserUebergeben(lead) {
  const ergebnis = lead?.ergebnis_beratung ?? lead?.ergebnisBeratung
  return ergebnis === 'Abschlussgespräch vereinbart'
}

export function stufeVonLead(lead) {
  const s = normalisiere(lead?.status)
  if (!s) return STUFE.OPENING

  if (s === STATUS.GEWONNEN) return STUFE.GEWONNEN
  if (IST_VERLOREN.includes(s)) return STUFE.VERLOREN

  if (s === STATUS.NICHT_ERSCHIENEN || s === STATUS.TERMIN_ABGESAGT) {
    return (lead.closer_id || lead.closerId) ? STUFE.CLOSING : STUFE.SETTING
  }
  if (s === STATUS.BERATUNG_VEREINBART || s === STATUS.BERATUNG_GEFUEHRT) {
    return anCloserUebergeben(lead) ? STUFE.CLOSING : STUFE.SETTING
  }

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

/**
 * Welche Status in einer Stufe ueberhaupt vorkommen - fuer Statuswahl und
 * Statusfilter der Listen.
 *
 * Im Closing gibt es kein Beratungsgespraech: Das ist das Setting. Beide
 * Beratungs-Status standen dort trotzdem im Auswahlfeld und im Filter. Der
 * Filter fand damit nie etwas, und die Auswahl war schlimmer als nutzlos -
 * ein Klick auf "Beratungsgespraech vereinbart" schob den Kontakt aus dem
 * Closing zurueck ins Setting.
 *
 * Gewonnen und Verloren stehen beim Closer: Er setzt sie. Die beiden
 * geplatzten Termine stehen in beiden Stufen, weil sie in beiden vorkommen -
 * wer sie behandelt, entscheidet der Closer am Kontakt (stufeVonLead).
 *
 * Das Follow-Up bekommt hier bewusst keine eigene Liste: Es ist eine Sicht
 * quer durch den Prozess, dort kommen auch Beratungs-Status vor.
 */
export const STATUS_JE_STUFE = {
  [STUFE.SETTING]: [
    STATUS.BERATUNG_VEREINBART,
    STATUS.BERATUNG_GEFUEHRT,
    STATUS.TERMIN_ABGESAGT,
    STATUS.NICHT_ERSCHIENEN,
    STATUS.VERLOREN_WIEDERVORLAGE,
    STATUS.VERLOREN_ENDGUELTIG
  ],
  [STUFE.CLOSING]: [
    STATUS.ABSCHLUSS_VEREINBART,
    STATUS.IM_ABSCHLUSS,
    STATUS.ANGEBOT_ANGEFORDERT,
    STATUS.ANGEBOT_VERSCHICKT,
    STATUS.WIRD_NACHGEFASST,
    STATUS.ANGEBOT_UNTERSCHRIEBEN,
    STATUS.GEWONNEN,
    STATUS.TERMIN_ABGESAGT,
    STATUS.NICHT_ERSCHIENEN,
    STATUS.VERLOREN_WIEDERVORLAGE,
    STATUS.VERLOREN_ENDGUELTIG
  ]
}

/** Die Status einer Stufe, oder alle, wenn die Stufe keine eigene Liste hat. */
export function statusFuerStufe(stufe) {
  return STATUS_JE_STUFE[stufe] || Object.values(STATUS)
}
