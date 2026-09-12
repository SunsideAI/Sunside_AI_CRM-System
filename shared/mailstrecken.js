/**
 * Die Nachrichten-Ketten des OSC-Prozesses (Tickets 9 und 12).
 *
 * Quelle: Miro F25.1 "Mail-Uebersicht: alle Nachrichten der drei Ketten",
 * abgerufen am 2026-09-12. Alle 23 Eintraege sind hier abgebildet - Ausloeser,
 * Zeitpunkt, Platzhalter, Versandart und die Fundstelle im Quelltext-Dokument.
 *
 * WAS HIER NICHT STEHT: die Wortlaute. Die liegen in
 * "ressourcen-crm-mailstrecken" (Teil B, Teil E, Strecke A, Strecke B) und sind
 * noch nicht im Zugriff. Der `fundstelle`-Eintrag jeder Nachricht sagt, aus
 * welchem Abschnitt der Text kommt - mehr braucht es nicht, um ihn spaeter
 * einzusetzen: Text in email_templates anlegen, `vorlage` hier eintragen.
 *
 * Zwei Regeln aus F23, die den Aufbau bestimmen:
 *
 *   1. "Kein Automatikversand: Das System schlaegt vor, ein Mensch schickt ab."
 *      Deshalb traegt jede Nachricht ein `versand` - und nur die drei
 *      Calendly-Nachrichten und die zwei SMS stehen auf 'automatisch'.
 *   2. Das Mail-Modul ist in JEDER Stufe frei. Diese Ketten sind ein Vorschlag,
 *      keine Sperre.
 */

export const KETTE = {
  VOR_BERATUNG:  'Vor dem Beratungsgespräch',
  VOR_ABSCHLUSS: 'Vor dem Abschlussgespräch',
  STRECKE_A:     'Nachfassen zufrieden mit dem Ist',
  STRECKE_B:     'Nachfassen will aber traut sich nicht',
  WERKZEUGKASTEN:'Werkzeugkasten'
}

/** Versandart. 'automatisch' laeuft ohne uns - Calendly bzw. der SMS-Weg. */
export const VERSAND = {
  AUTOMATISCH: 'automatisch',   // Calendly oder System, kein Mensch beteiligt
  EIN_KLICK:   'ein Klick',     // System legt vor, Mensch bestaetigt
  VORGELEGT:   'vorgelegt',     // System schlaegt vor, Mensch bearbeitet
  MENSCH:      'Mensch'         // reine Handarbeit (Anruf, freie Mail)
}

/**
 * `nachfass_grund` waehlt die Strecke. Die beiden Werte stehen so in
 * shared/felder.js - hier ist die Abbildung auf die Kette.
 */
export const GRUND_ZU_STRECKE = {
  'Kunde ist zufrieden mit dem Ist-Zustand': KETTE.STRECKE_A,
  'Kunde will, traut sich noch nicht':       KETTE.STRECKE_B
}

/**
 * Alle Nachrichten. `tag` ist der Versatz in Tagen ab Streckenbeginn und nur
 * bei den zwei Nachfass-Strecken gesetzt; die uebrigen Ketten haengen an einem
 * Ereignis, das in `ausloeser` steht.
 *
 * `freigabe: false` heisst: Der Wortlaut ist noch nicht freigegeben. Solche
 * Nachrichten darf das System vorschlagen, aber nicht als fertig ausweisen.
 */
export const NACHRICHTEN = [
  // ---------------------------------------------------------------- Kette 1
  {
    id: 'einladung_beratung',
    kette: KETTE.VOR_BERATUNG,
    name: 'Kalender-Einladung Beratungsgespräch',
    ausloeser: 'Buchung durch den Opener',
    versand: VERSAND.AUTOMATISCH,
    platzhalter: ['Vorname Nachname', 'Absender'],
    freigabe: true,
    fundstelle: 'Teil E, Nr. 1'
  },
  {
    id: 'segment_eigentuemer',
    kette: KETTE.VOR_BERATUNG,
    name: 'Segment-Mail Eigentümer (Video Streil)',
    ausloeser: 'binnen Minuten nach dem Erstanruf, Empfehlungsfenster',
    versand: VERSAND.EIN_KLICK,
    // Welche der fuenf Fassungen gilt, entscheidet das Feld - nicht der Mensch.
    gesteuert_ueber: { feld: 'ziel', wert: 'Eigentümer' },
    platzhalter: ['Nachname', 'Wochentag', 'Video-Link', 'Link'],
    freigabe: true,
    fundstelle: 'Teil E, Nr. 2, Fassung Eigentümergewinnung'
  },
  {
    id: 'segment_kaeufer',
    kette: KETTE.VOR_BERATUNG,
    name: 'Segment-Mail Kaufinteressenten',
    ausloeser: 'binnen Minuten nach dem Erstanruf, Empfehlungsfenster',
    versand: VERSAND.EIN_KLICK,
    gesteuert_ueber: { feld: 'ziel', wert: 'Käufer' },
    platzhalter: ['Nachname', 'Wochentag', 'Video-Link', 'Link'],
    freigabe: false,
    hinweis: 'Übergangsfassung mit Streil-Kurzschnitt. Die Zielfassung wartet auf das Käufer-Video.',
    fundstelle: 'Teil E, Nr. 2, Fassung Kaufinteressenten'
  },
  {
    id: 'segment_automatisierung',
    kette: KETTE.VOR_BERATUNG,
    name: 'Segment-Mail Automatisierung/Entlastung (Video Beier)',
    ausloeser: 'binnen Minuten nach dem Erstanruf, Empfehlungsfenster',
    versand: VERSAND.EIN_KLICK,
    gesteuert_ueber: { feld: 'ziel', wert: 'Zeit' },
    platzhalter: ['Nachname', 'Wochentag', 'Video-Link', 'Link'],
    freigabe: true,
    fundstelle: 'Teil E, Nr. 2, Fassung Automatisierung'
  },
  {
    id: 'segment_sachverstaendige',
    kette: KETTE.VOR_BERATUNG,
    name: 'Segment-Mail Sachverständige (Video Beier, eigene Fassung)',
    // Diese eine Fassung schlaegt das Ziel: Die Berufsgruppe entscheidet.
    ausloeser: 'binnen Minuten nach dem Erstanruf, gesteuert über die Berufsgruppe',
    versand: VERSAND.EIN_KLICK,
    gesteuert_ueber: { feld: 'berufsgruppe', wert: 'Sachverständige' },
    schlaegt: ['segment_eigentuemer', 'segment_kaeufer', 'segment_automatisierung'],
    platzhalter: ['Nachname', 'Wochentag', 'Video-Link', 'Link'],
    freigabe: true,
    fundstelle: 'Teil E, Nr. 2, Fassung Sachverständige'
  },
  {
    id: 'vorhaben_mail',
    kette: KETTE.VOR_BERATUNG,
    name: 'Vorhaben-Mail (nennt das Vorhaben wörtlich, Beier-Video als Umsetzungs-Beweis)',
    ausloeser: 'binnen Minuten nach dem Erstanruf, gesteuert über das Vorhaben-Feld',
    versand: VERSAND.EIN_KLICK,
    gesteuert_ueber: { feld: 'vorhaben', wert: true },
    // Ersetzt die Segment-Mail vollstaendig, auch die Sachverstaendigen-Fassung.
    schlaegt: ['segment_eigentuemer', 'segment_kaeufer', 'segment_automatisierung', 'segment_sachverstaendige'],
    platzhalter: ['Nachname', 'Wochentag', 'Vorhaben wörtlich', 'Video-Link'],
    freigabe: true,
    fundstelle: 'Teil E, Nr. 2, Fassung Vorhaben'
  },
  {
    id: 'erinnerung_24h_beratung',
    kette: KETTE.VOR_BERATUNG,
    name: 'Erinnerung 24 Stunden vorher',
    ausloeser: '24 h vor dem Termin',
    versand: VERSAND.AUTOMATISCH,
    platzhalter: ['Vorname Nachname', 'Uhrzeit', 'Absender'],
    freigabe: true,
    hinweis: 'Enthält einen Absage-Absatz. Das ist Absicht, nicht versehentlich.',
    fundstelle: 'Teil E, Nr. 3'
  },
  {
    id: 'sms_1h_beratung',
    kette: KETTE.VOR_BERATUNG,
    name: 'SMS eine Stunde vorher',
    ausloeser: '1 h vor dem Termin',
    versand: VERSAND.AUTOMATISCH,
    braucht: ['mobilnummer'],
    platzhalter: ['Absender'],
    freigabe: true,
    hinweis: 'Mehr Erinnerung gibt es bewusst nicht.',
    fundstelle: 'Teil E, Nr. 4'
  },
  {
    id: 'bestaetigungsanruf',
    kette: KETTE.VOR_BERATUNG,
    name: 'Bestätigungsanruf am Vortag',
    ausloeser: 'ein Tag vor dem Termin',
    versand: VERSAND.MENSCH,
    platzhalter: [],
    freigabe: true,
    hinweis: 'Kein Mailtext - ein Gesprächsleitfaden.',
    fundstelle: 'Skript Terminbestätigung (eigene Datei, in Teil E verlinkt)'
  },

  // ---------------------------------------------------------------- Kette 2
  {
    id: 'einladung_abschluss',
    kette: KETTE.VOR_ABSCHLUSS,
    name: 'Kalender-Einladung Abschlussgespräch',
    ausloeser: 'Buchung durch den Setter im Gespräch',
    versand: VERSAND.AUTOMATISCH,
    platzhalter: ['Nachname', 'Absender'],
    freigabe: true,
    hinweis: 'Der Termin trägt kein Etikett - der Kunde soll nicht "Abschluss" lesen.',
    fundstelle: 'Teil E, Nr. 5'
  },
  {
    id: 'bestaetigung_hausaufgabe',
    kette: KETTE.VOR_ABSCHLUSS,
    name: 'Bestätigungsmail mit Video-Hausaufgabe und Magnet-Ankündigung',
    ausloeser: 'direkt nach dem Beratungsgespräch',
    versand: VERSAND.EIN_KLICK,
    platzhalter: ['Nachname', 'Datum', 'Uhrzeit', 'Ausgesprochener Bedarf', 'Magnet-Einschub', 'VSL-Link'],
    freigabe: true,
    hinweis: 'Vier Magnet-Einschübe je Segment, Referenzschreiben-PS je Segment. VSL-Übergangsregel beachten.',
    fundstelle: 'Teil E, Nr. 6 inkl. Magnet-Einschüben und Übergangsregel'
  },
  {
    id: 'sms_1h_abschluss',
    kette: KETTE.VOR_ABSCHLUSS,
    name: 'SMS eine Stunde vorher',
    ausloeser: '1 h vor dem Termin',
    versand: VERSAND.AUTOMATISCH,
    braucht: ['mobilnummer'],
    platzhalter: [],
    freigabe: true,
    fundstelle: 'Teil E, Nr. 7'
  },

  // ------------------------------------------------- Kette 3: Strecke A
  {
    id: 'a1', kette: KETTE.STRECKE_A, schritt: 1, tag: 0,
    name: 'Mail 1: die Zusammenfassung seiner Zahlen',
    ausloeser: 'Tag 0 nach der Streckenwahl',
    versand: VERSAND.VORGELEGT,
    platzhalter: ['Anrede', 'Gesprächsdatum', 'Zuwachs', 'Nötige Anfragen im Monat', 'Schmerzpunkt im Wortlaut'],
    freigabe: true, fundstelle: 'Strecke A, A1'
  },
  {
    id: 'a2', kette: KETTE.STRECKE_A, schritt: 2, tag: 4,
    name: 'Mail 2: das Fallbeispiel',
    ausloeser: 'Tag 4', versand: VERSAND.VORGELEGT,
    platzhalter: [], aus_werkzeugkasten: true,
    freigabe: true, fundstelle: 'Strecke A, A2'
  },
  {
    id: 'a3', kette: KETTE.STRECKE_A, schritt: 3, tag: 10,
    name: 'Mail 3: Anruf und Mail zusammen',
    ausloeser: 'Tag 10', versand: VERSAND.MENSCH,
    platzhalter: [], aus_werkzeugkasten: true,
    freigabe: true, fundstelle: 'Strecke A, A3'
  },
  {
    id: 'a4', kette: KETTE.STRECKE_A, schritt: 4, tag: 21,
    name: 'Mail 4: etwas, das nützt (Themen-Baustein)',
    ausloeser: 'Tag 21', versand: VERSAND.VORGELEGT,
    platzhalter: [], aus_werkzeugkasten: true,
    freigabe: false,
    hinweis: 'Drei Baustein-Texte sind noch in Freigabe.',
    fundstelle: 'Strecke A, A4 + Ordner nachfass-bausteine'
  },
  {
    id: 'a5', kette: KETTE.STRECKE_A, schritt: 5, tag: 35,
    name: 'Mail 5: der Abschied',
    ausloeser: 'Tag 35', versand: VERSAND.VORGELEGT,
    platzhalter: ['Anrede', 'Absender'],
    beendet_strecke: true,
    freigabe: true,
    hinweis: 'Ende der Serie. Danach Wiedervorlage setzen.',
    fundstelle: 'Strecke A, A5'
  },

  // ------------------------------------------------- Kette 4: Strecke B
  {
    id: 'b1', kette: KETTE.STRECKE_B, schritt: 1, tag: 0,
    name: 'Mail 1: der offene Punkt aus dem Gespräch',
    ausloeser: 'Tag 0', versand: VERSAND.VORGELEGT,
    platzhalter: ['Anrede', 'Offener Punkt'],
    freigabe: true, fundstelle: 'Strecke B, B1'
  },
  {
    id: 'b2', kette: KETTE.STRECKE_B, schritt: 2, tag: 3,
    name: 'Mail 2: das eine Beweisstück',
    ausloeser: 'Tag 3', versand: VERSAND.VORGELEGT,
    platzhalter: [], aus_werkzeugkasten: true,
    freigabe: true, fundstelle: 'Strecke B, B2'
  },
  {
    id: 'b3', kette: KETTE.STRECKE_B, schritt: 3, tag: 7,
    name: 'Mail 3: Anruf und Mail zusammen',
    ausloeser: 'Tag 7', versand: VERSAND.MENSCH,
    platzhalter: [], aus_werkzeugkasten: true,
    freigabe: true, fundstelle: 'Strecke B, B3'
  },
  {
    id: 'b4', kette: KETTE.STRECKE_B, schritt: 4, tag: 14,
    name: 'Mail 4: der Lead-Magnet in seinen Farben',
    ausloeser: 'Tag 14', versand: VERSAND.VORGELEGT,
    platzhalter: [], aus_werkzeugkasten: true,
    freigabe: true, fundstelle: 'Strecke B, B4'
  },
  {
    id: 'b5', kette: KETTE.STRECKE_B, schritt: 5, tag: 28,
    name: 'Mail 5: der Abschied',
    ausloeser: 'Tag 28', versand: VERSAND.VORGELEGT,
    platzhalter: ['Anrede', 'Absender'],
    beendet_strecke: true,
    freigabe: true,
    fundstelle: 'Strecke B, B5'
  },

  // ---------------------------------------------------------------- Kette 5
  {
    id: 'werkzeugkasten',
    kette: KETTE.WERKZEUGKASTEN,
    name: 'Nachfass-Toolset: sechs Karten',
    ausloeser: 'füllt die Nachfass-Mails, Auswahl nach Empfehlungstabelle',
    versand: VERSAND.MENSCH,
    platzhalter: [],
    freigabe: true,
    hinweis: 'Zwei E-Books, Analyse-Aufhänger, Webinar, Beweis-Stücke, '
           + 'Telefonassistenz-Demo. Das System empfiehlt, der Closer darf überstimmen.',
    fundstelle: 'Teil B (Karten, Empfehlungstabelle, Ausweichregel, Versandregel)'
  }
]

// ---------------------------------------------------------------------------

/** Alle Nachrichten einer Kette, in ihrer Reihenfolge. */
export function kette(name) {
  return NACHRICHTEN.filter(n => n.kette === name)
                    .sort((a, b) => (a.tag ?? 0) - (b.tag ?? 0))
}

/** Die Strecke eines Kontakts - aus `nachfass_grund`. */
export function streckeVon(lead) {
  return GRUND_ZU_STRECKE[lead?.nachfass_grund] || null
}

/**
 * Welche Nachricht ist als naechste faellig?
 *
 * `nachfass_schritt` zaehlt, was schon raus ist (0 oder null = noch nichts).
 * Zurueck kommt die naechste Nachricht mit dem Datum, an dem sie ansteht -
 * und ob dieses Datum erreicht ist. Die Entscheidung, ob wirklich geschickt
 * wird, trifft ein Mensch; diese Funktion legt nur vor.
 */
export function naechsteNachricht(lead, heute = new Date()) {
  const streckeName = streckeVon(lead)
  if (!streckeName) return null

  const schritte = kette(streckeName)
  const erledigt = Number(lead?.nachfass_schritt) || 0
  if (erledigt >= schritte.length) return null      // Serie durch

  const naechste = schritte[erledigt]
  const start = lead?.nachfass_beginn_am || lead?.termin_abschlussgespraech
  if (!start) return { nachricht: naechste, faellig_am: null, faellig: false }

  const faelligAm = new Date(start)
  faelligAm.setDate(faelligAm.getDate() + naechste.tag)

  // Auf den Tag genau, nicht auf die Stunde: Eine Mail am Tag 3 ist am Tag 3
  // faellig, egal ob das Gespraech morgens oder abends war.
  const aufTag = d => new Date(d.getFullYear(), d.getMonth(), d.getDate())

  return {
    nachricht: naechste,
    faellig_am: faelligAm,
    faellig: aufTag(heute) >= aufTag(faelligAm),
    von: schritte.length,
    schritt: erledigt + 1
  }
}

/** Fehlt zu dieser Nachricht noch der freigegebene Wortlaut? */
export function wortlautFehlt(nachricht) {
  return nachricht?.freigabe === false
}
