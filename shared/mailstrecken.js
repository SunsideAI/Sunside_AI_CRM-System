/**
 * Die Nachrichten des OSC-Prozesses (Tickets 9 und 12).
 *
 * QUELLE DER WORTLAUTE: docs/ressourcen/2026-08-12-ressourcen-crm-mailstrecken.md
 * Die Texte werden dort gepflegt und von dort wortgleich uebernommen. Hier steht
 * nur, WANN und WOFUER eine Nachricht gilt - nie der Text selbst. Zwei Quellen
 * fuer denselben Satz laufen immer auseinander.
 *
 * ACHTUNG, EINE UMKEHR GEGENUEBER MIRO F25.1:
 * Die Miro-Tabelle beschreibt zwei getaktete Nachfass-Strecken (Tag 0/4/10/21/35
 * und 0/3/7/14/28). Teil D der Ressourcen-Datei hebt das auf:
 *
 *     "Es gibt keine getaktete Mail-Serie mehr." (Entscheidung Niklas, 15.09.2026)
 *
 * Das Nachfassen ist seitdem ein Werkzeugkasten. Das CRM empfiehlt EIN Stueck,
 * der Closer waehlt Zeitpunkt und Reihenfolge. Deshalb steht hier kein
 * Terminplan mehr, sondern eine Empfehlung - und die Begruendung dazu, damit
 * niemand raten muss, warum gerade dieses Stueck.
 */

// ---------------------------------------------------------------------------
// Die festen Ketten: was vor den beiden Terminen laeuft
// ---------------------------------------------------------------------------

export const KETTE = {
  VOR_BERATUNG:  'Vor dem Beratungsgespräch',
  VOR_ABSCHLUSS: 'Vor dem Abschlussgespräch'
}

/** 'automatisch' laeuft ohne uns - Calendly bzw. der SMS-Weg. */
export const VERSAND = {
  AUTOMATISCH: 'automatisch',
  EIN_KLICK:   'ein Klick',      // System legt vor, Mensch bestaetigt
  MENSCH:      'Mensch'          // Handarbeit (Anruf, freie Mail)
}

/**
 * Die Segmente. Das Segment ist das Ziel aus dem Kaltanruf (Alltagsregel,
 * Teil A) - es bestimmt, welche Fassung der Segment-Mail laeuft, welcher VSL
 * folgt und welcher Magnet fuers Abschlussgespraech entsteht.
 */
// Die Datei nennt die Segmente kurz "Eigentuemer, Kaeufer, Zeit". Im CRM
// heisst das Feld anders - die Werte stehen in shared/felder.js unter
// AUSWAHL.ziel und werden von der Oberflaeche geschrieben. Hier gelten die
// CRM-Werte, sonst trifft keine Zuordnung.
export const SEGMENT = {
  EIGENTUEMER: 'Mehr Eigentümer-Anfragen',
  KAEUFER:     'Mehr Kaufinteressenten',
  ZEIT:        'Zeitersparnis und Entlastung',
  OFFEN:       'Noch nicht besprochen'
}

/**
 * Zwei Felder schlagen das Segment, in dieser Reihenfolge:
 *   1. Vorhaben = ja        -> die Vorhaben-Fassung, in jedem Segment
 *   2. Berufsgruppe = SV    -> die Sachverstaendigen-Fassung
 * Erst danach entscheidet das Ziel. Steht das Ziel auf 'nicht erhoben', waehlt
 * der Opener nach dem, worueber geklagt wurde (Teil A).
 */
export function segmentMailFassung(lead) {
  if (lead?.vorhaben === true) return 'vorhaben'
  if (lead?.berufsgruppe === 'Sachverständige') return 'sachverstaendige'
  switch (lead?.ziel) {
    case SEGMENT.EIGENTUEMER: return 'eigentuemer'
    case SEGMENT.KAEUFER:     return 'kaeufer'
    case SEGMENT.ZEIT:        return 'automatisierung'
    default:                  return null   // Opener waehlt von Hand
  }
}

export const NACHRICHTEN = [
  // ------------------------------------------------ vor dem Beratungsgespräch
  {
    id: 'einladung_beratung',
    kette: KETTE.VOR_BERATUNG,
    name: 'Calendly-Einladung Beratungsgespräch',
    ausloeser: 'Buchung im Kaltanruf',
    versand: VERSAND.AUTOMATISCH,
    platzhalter: ['Vorname Nachname', 'Absender'],
    fundstelle: 'Teil E, Vor-Termin-Kette Nr. 1'
  },
  {
    id: 'segment_mail',
    kette: KETTE.VOR_BERATUNG,
    name: 'Segment-Mail mit Video',
    ausloeser: 'binnen Minuten nach dem Kaltanruf',
    versand: VERSAND.EIN_KLICK,
    // Fuenf Fassungen, gewaehlt von segmentMailFassung().
    fassungen: {
      eigentuemer:       { video: 'Streil-Kurzschnitt',  fundstelle: 'Teil E, Nr. 2, Fassung Eigentümergewinnung' },
      kaeufer:           { video: 'Käufer-Video',        fundstelle: 'Teil E, Nr. 2, Fassung Kaufinteressenten',
                           offen: 'Käufer-Video noch nicht gedreht — bis dahin die Übergangsfassung mit dem Streil-Kurzschnitt.' },
      automatisierung:   { video: 'Beier-Kurzschnitt',   fundstelle: 'Teil E, Nr. 2, Fassung Automatisierung/Entlastung' },
      sachverstaendige:  { video: 'Beier-Kurzschnitt',   fundstelle: 'Teil E, Nr. 2, Fassung Sachverständige' },
      vorhaben:          { video: 'Beier-Kurzschnitt',   fundstelle: 'Teil E, Nr. 2, Fassung Vorhaben' }
    },
    platzhalter: ['Nachname', 'Video-Link'],
    braucht: ['ziel', 'berufsgruppe'],
    fundstelle: 'Teil E, Vor-Termin-Kette Nr. 2'
  },
  {
    id: 'erinnerung_24h',
    kette: KETTE.VOR_BERATUNG,
    name: 'Erinnerung 24 Stunden vorher',
    ausloeser: '24 h vor dem Termin',
    versand: VERSAND.AUTOMATISCH,
    platzhalter: ['Vorname Nachname', 'Absender'],
    hinweis: 'Generisch für alle Segmente. Enthält den Absage-Absatz — das ist Absicht: '
           + 'Eine ehrliche Absage ist mehr wert als ein leerer Termin.',
    fundstelle: 'Teil E, Vor-Termin-Kette Nr. 3'
  },
  {
    id: 'sms_1h_beratung',
    kette: KETTE.VOR_BERATUNG,
    name: 'SMS eine Stunde vorher',
    ausloeser: '1 h vor dem Termin',
    versand: VERSAND.AUTOMATISCH,
    braucht: ['mobilnummer'],
    platzhalter: ['Absender'],
    fundstelle: 'Teil E, Vor-Termin-Kette Nr. 4'
  },
  {
    id: 'bestaetigungsanruf',
    kette: KETTE.VOR_BERATUNG,
    name: 'Bestätigungsanruf am Vortag',
    ausloeser: 'ein Tag vor dem Termin',
    versand: VERSAND.MENSCH,
    platzhalter: [],
    hinweis: 'Kein Mailtext — ein Gesprächsleitfaden.',
    fundstelle: 'gespraechsfuehrung/2026-08-01-skript-terminbestaetigung.md'
  },

  // ----------------------------------------------- vor dem Abschlussgespräch
  {
    id: 'einladung_abschluss',
    kette: KETTE.VOR_ABSCHLUSS,
    name: 'Calendly-Einladung Abschlussgespräch',
    ausloeser: 'Buchung im Beratungsgespräch',
    versand: VERSAND.AUTOMATISCH,
    platzhalter: ['Vorname Nachname', 'Absender'],
    hinweis: 'Der Termin trägt dem Makler gegenüber kein Etikett — nicht '
           + '„Abschlussgespräch", nicht „Strategiegespräch", sondern „unser Gespräch".',
    fundstelle: 'Teil E, Nr. 5'
  },
  {
    id: 'bestaetigung_hausaufgabe',
    kette: KETTE.VOR_ABSCHLUSS,
    name: 'Bestätigungsmail mit VSL und Magnet-Ankündigung',
    ausloeser: 'direkt nach dem Beratungsgespräch',
    versand: VERSAND.EIN_KLICK,
    platzhalter: ['Nachname', 'Ausgesprochener Bedarf', 'Magnet-Einschub', 'VSL-Link'],
    hinweis: 'Magnet-Einschub je Segment, Referenzschreiben-PS je Segment '
           + '(Wüstenrot für Makler, Beier für Sachverständige).',
    fundstelle: 'Teil E, Nr. 6'
  },
  {
    id: 'sms_1h_abschluss',
    kette: KETTE.VOR_ABSCHLUSS,
    name: 'SMS eine Stunde vorher',
    ausloeser: '1 h vor dem Termin',
    versand: VERSAND.AUTOMATISCH,
    braucht: ['mobilnummer'],
    platzhalter: [],
    hinweis: 'Mehr Erinnerung gibt es vor dem Abschlussgespräch bewusst nicht.',
    fundstelle: 'Teil E, Nr. 7'
  }
]

/** Der Magnet, der bis zum Abschlussgespräch entsteht. Wird wörtlich benannt. */
export const MAGNET = {
  eigentuemer:      'eine SEO- und GEO-Analyse zur Eigentümergewinnung in {Region} und Umgebung',
  kaeufer:          'eine Kalkulation mit Ihren Zahlen und eine Muster-Anzeige für eines Ihrer Objekte',
  automatisierung:  'Ihre Automatisierungs-Kurzanalyse: Ihre drei größten Zeitfresser aus dem Gespräch und was davon KI übernehmen kann',
  sachverstaendige: 'Ihre Automatisierungs-Kurzanalyse: Ihre größten Zeitfresser im Gutachtenprozess und was davon KI übernehmen kann'
}

// ---------------------------------------------------------------------------
// Das Nachfass-Toolkit: Sammlung statt Serie
// ---------------------------------------------------------------------------

/** Die acht Vorlagen aus Teil D, plus der SV-Beweis aus Teil B. */
export const WERKZEUGE = [
  { id: 'zusammenfassung', name: 'Die Zusammenfassung seiner Zahlen',
    greift: 'direkt nach dem Gespräch, solange es frisch ist',
    platzhalter: ['Anrede', 'Gesprächsdatum', 'Zuwachs', 'Nötige Anfragen im Monat', 'Schmerzpunkt im Wortlaut'],
    anhang: false, fundstelle: 'Vorlage 1' },
  { id: 'fallbeispiel', name: 'Das Fallbeispiel',
    greift: 'er soll sich in einem vergleichbaren Büro wiedererkennen',
    platzhalter: ['Anrede', 'Region', 'Schmerzpunkt im Wortlaut'],
    anhang: true, fundstelle: 'Vorlage 2' },
  { id: 'auswirkungsfrage', name: 'Die Auswirkungsfrage',
    greift: 'der Zufriedene bewegt sich nicht',
    platzhalter: ['Anrede', 'Nötige Anfragen im Monat', 'Lücke'],
    anhang: false, mit_anruf: true, fundstelle: 'Vorlage 3' },
  { id: 'sichtbarkeits_check', name: 'Der Sichtbarkeits-Check seiner Region',
    greift: 'Ziel Eigentümer — nur wenn er in ChatGPT und Google wirklich fehlt',
    platzhalter: ['Anrede', 'Ort', 'Büro 1', 'Büro 2', 'Nötige Anfragen im Monat'],
    anhang: false, fundstelle: 'Vorlage 4',
    regel: 'Der Check wird vor dem Versand wirklich gemacht. Kein Platzhalter-Raten.' },
  { id: 'ratgeber', name: 'Der Ratgeber „Sichtbarer in Ihrer Region"',
    greift: 'Ziel Eigentümer, wenn der Sichtbarkeits-Check nicht greift',
    platzhalter: ['Nachname', 'Schmerzpunkt im Wortlaut'],
    anhang: true, fundstelle: 'Vorlage 5' },
  { id: 'sv_ranking', name: 'Der SV-Ranking-Beweis (Scheffler vor Heid)',
    greift: 'Sachverständige, Ziel Aufträge oder Sichtbarkeit',
    platzhalter: ['Nachname', 'Absender'],
    anhang: true, fundstelle: 'Teil B, Vorlage SV-Ranking-Beweis',
    regel: 'Screenshot vor jedem Versand aktuell ziehen — Rankings sind beweglich.' },
  { id: 'beweisstueck', name: 'Das eine Beweisstück',
    greift: 'er will, traut sich nicht — der Beleg, der seinen offenen Punkt trifft',
    platzhalter: ['Anrede', 'Offener Punkt'],
    anhang: true, fundstelle: 'Vorlage 6' },
  { id: 'referenzanruf', name: 'Das Referenzanruf-Angebot',
    greift: 'der stärkste Vertrauens-Beweis: er spricht mit einem Kunden, ohne uns',
    platzhalter: ['Anrede', 'Absender'],
    anhang: false, mit_anruf: true, fundstelle: 'Vorlage 7',
    regel: 'Danach kommt beim Zweifler nichts mehr. 14 Tage ohne Reaktion → wiedervorlagefähig.' },
  { id: 'abschied', name: 'Der Abschied',
    greift: 'spätestens nach fünf Versuchen, oder wenn die Lage ausgereizt ist',
    platzhalter: ['Anrede', 'Zuwachs', 'Nötige Anfragen im Monat', 'Absender'],
    anhang: false, beendet: true, fundstelle: 'Vorlage 8' },
  { id: 'ki_hacks', name: 'E-Book „KI-Hacks"',
    greift: 'der Standard-Erstgriff und der Rückfall, wenn nichts anderes passt',
    platzhalter: ['Anrede'], anhang: true, fundstelle: 'Teil B, Karten' },
  { id: 'webinar', name: 'Webinar-Einladung',
    greift: 'zweiter Griff nach den KI-Hacks — der stärkste Impuls, weil er ein Datum hat',
    platzhalter: ['Anrede'], anhang: false, fundstelle: 'Teil B, Karten' },
  { id: 'voicebot_demo', name: 'Voicebot-Demo-Nummer',
    greift: 'er wollte mehr Erreichbarkeit und interessierte sich für den Voicebot',
    platzhalter: ['Anrede'], anhang: false, fundstelle: 'Teil B, Karten' },
  { id: 'erreichbarkeit', name: 'Erreichbarkeits-Baustein',
    greift: 'Segment Automatisierung, zufrieden mit dem Ist',
    platzhalter: ['Anrede'], anhang: false, fundstelle: 'nachfass-bausteine/' }
]

/** Der Gesprächsausgang, der die Tonlage bestimmt (Diagnosefrage des Closers). */
export const DIAGNOSE = {
  ZUFRIEDEN: 'Kunde ist zufrieden mit dem Ist-Zustand',
  TRAUT_SICH_NICHT: 'Kunde will, traut sich noch nicht'
}

/**
 * Die Empfehlungstabelle aus Teil B: aus Diagnose und Segment ein Stueck.
 *
 * Wichtig: Das ist ein VORSCHLAG. "Der Closer darf ueberstimmen, denn er war
 * im Gespraech. Kein automatischer Versand."
 */
const EMPFEHLUNG = {
  [DIAGNOSE.ZUFRIEDEN]: {
    sachverstaendige: ['sv_ranking', 'ki_hacks'],
    eigentuemer:      ['sichtbarkeits_check', 'ratgeber'],
    kaeufer:          ['ki_hacks', 'webinar'],
    automatisierung:  ['erreichbarkeit', 'voicebot_demo']
  },
  [DIAGNOSE.TRAUT_SICH_NICHT]: {
    sachverstaendige: ['sv_ranking', 'beweisstueck'],
    eigentuemer:      ['beweisstueck', 'referenzanruf'],
    kaeufer:          ['beweisstueck', 'referenzanruf'],
    automatisierung:  ['beweisstueck', 'referenzanruf']
  }
}

/** Sachverstaendige schlagen das Segment - auch beim Nachfassen. */
function empfehlungsSegment(lead) {
  if (lead?.berufsgruppe === 'Sachverständige') return 'sachverstaendige'
  switch (lead?.ziel) {
    case SEGMENT.EIGENTUEMER: return 'eigentuemer'
    case SEGMENT.KAEUFER:     return 'kaeufer'
    case SEGMENT.ZEIT:        return 'automatisierung'
    default:                  return null
  }
}

/**
 * Was soll der Closer als Naechstes schicken?
 *
 * Zurueck kommt EIN Stueck mit einer Zeile Begruendung - keine Liste zum
 * Durchsuchen (Teil C: "eine Empfehlung mit einer Zeile Begruendung").
 *
 * `bereitsGesendet` ist das Feld "Zuletzt gesendetes Material": Jedes Stueck
 * geht je Kontakt nur einmal raus.
 */
export function empfehlung(lead, bereitsGesendet = []) {
  const diagnose = lead?.nachfass_grund
  const segment = empfehlungsSegment(lead)

  // Fallback aus Teil B: Liegt keine Diagnose vor, sind es die KI-Hacks.
  // "Sie verlangen kein Bekenntnis zu einer Massnahme."
  const kandidaten = (EMPFEHLUNG[diagnose]?.[segment] || ['ki_hacks'])
    .concat('ki_hacks', 'webinar')          // Ausweichregel: universellstes zuerst
    .filter(id => !bereitsGesendet.includes(id))

  const id = kandidaten[0]
  if (!id) return null

  const werkzeug = WERKZEUGE.find(w => w.id === id)
  if (!werkzeug) return null

  const grund = !diagnose
    ? 'keine Diagnose hinterlegt — die KI-Hacks funktionieren als Reaktivierung immer'
    : `${diagnose === DIAGNOSE.ZUFRIEDEN ? 'zufrieden mit dem Ist' : 'will, traut sich nicht'}`
      + (segment ? `, Segment ${segment}` : ', Segment offen')

  return { werkzeug, grund, ueberstimmbar: true }
}

/**
 * Die Ausweichregel: Eine abgelehnte Massnahme wird nie zum Mail-Inhalt - die
 * Ablehnung der Massnahme ist aber nicht die Ablehnung des Ziels.
 */
export function ausweichen(abgelehnt) {
  if (abgelehnt === 'SEO') {
    return { hinweis: 'GEO trägt den neuen Winkel: in KI-Suchen empfohlen werden statt bei Google ranken.',
             sonst: 'ki_hacks' }
  }
  return { hinweis: 'Das universellste noch nicht versendete Stück.', sonst: 'ki_hacks' }
}

/**
 * Haekchen B aus Teil A: "Er hat Anbieter, Werkzeuge oder eigene Versuche
 * genannt." Die Werte stammen aus shared/felder.js.
 *
 * 'Nicht gefragt' ist NICHT dasselbe wie 'Nichts genannt' - das eine heisst
 * unbekannt, das andere heisst nein. Die Formel in der Datei kennt nur ja und
 * nein; unbekannt wird hier wie nein behandelt, also vorsichtig eingestuft.
 * Das ist eine Auslegung, keine Vorgabe - sie steht so auch in der Migration.
 */
export function haekchenB(lead) {
  return ['Anbieter beauftragt', 'Eigenes Werkzeug im Einsatz', 'Beides']
    .includes(lead?.vorerfahrung)
}

/** Haekchen A: Hat er ein konkretes Problem benannt? */
export function haekchenA(lead) {
  return Boolean(String(lead?.schmerzpunkt_wortlaut || '').trim())
}

/**
 * Bewusstseinsstufe und Tiefe nach der Formel aus Teil A.
 * C sticht: Wer von sich aus nach Preis, Ablauf oder Start fragt, ist Stufe 5.
 */
export function stufeUndTiefe(lead) {
  const a = haekchenA(lead)
  const b = haekchenB(lead)
  const c = lead?.fragt_nach_konditionen === true

  if (c)             return { stufe: 5, tiefe: 'Angebot' }
  if (!a && !b)      return { stufe: 1, tiefe: 'Grundlage' }
  if (a && !b)       return { stufe: 2, tiefe: 'Grundlage' }
  if (!a && b)       return { stufe: 3, tiefe: 'Beweis' }
  return { stufe: 4, tiefe: 'Beweis' }
}

/** Die Obergrenze aus Teil D. Danach der Abschied, dann wiedervorlagefähig. */
export const HOECHSTENS_VERSUCHE = 5

/** Alle Nachrichten einer festen Kette. */
export function kette(name) {
  return NACHRICHTEN.filter(n => n.kette === name)
}
