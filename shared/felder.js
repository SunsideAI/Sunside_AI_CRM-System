// Die Felder der beiden Übergaben - Beschriftungen und Hilfetexte wortgleich
// aus der Feldtabelle neben Miro F24.
//
// Warum hier und nicht im Formular: Dieselben Definitionen prüfen im Backend
// das Gate und beschriften im Frontend die Eingabe. Zwei Quellen wären zwei
// Wahrheiten - und die Tooltips sind mit Bedacht formuliert ("Bitte nicht
// raten, ein leeres Feld ist besser als ein falsches").

export const UEBERGABE_1 = 'Erstanruf (Opener)'
export const UEBERGABE_2 = 'Beratungsgespräch (Setter)'

/** Auswahllisten, wortgleich aus F24. */
export const AUSWAHL = {
  berufsgruppe: ['Makler', 'Sachverständiger', 'andere'],
  ziel: [
    'Mehr Eigentümer-Anfragen',
    'Mehr Kaufinteressenten',
    'Zeitersparnis und Entlastung',
    'Noch nicht besprochen'
  ],
  vorerfahrung: [
    'Anbieter beauftragt',
    'Eigenes Werkzeug im Einsatz',
    'Beides',
    'Nichts genannt',
    'Nicht gefragt'
  ],
  quote_art: ['vom Kunden genannt', 'geschätzt'],
  gespraechsausgang: [
    'Auftrag',
    'Nächster Schritt vereinbart',
    'Vertagt ohne festen Schritt',
    'Absage'
  ],
  nachfass_grund: [
    'Kunde ist zufrieden mit dem Ist-Zustand',
    'Kunde will, traut sich noch nicht'
  ]
}

/**
 * pflicht: true  -> Gate. Ohne das Feld wird nicht weitergebucht.
 * pflicht: false -> Warnung. Fehlt es, wird gewarnt, aber nicht blockiert.
 *
 * Aufteilung nach der Empfehlung aus F23: Gates hart, Pflichtfelder als
 * Warnung. Gate ist, was ohne den Wert nicht funktioniert - die Segment-Mail
 * braucht die Berufsgruppe, die SMS braucht die Mobilnummer, das
 * Empfehlungs-Paket braucht die Zahlen.
 */
export const FELDER = {
  // ---- Übergabe 1: der Opener gibt an den Setter ab ----
  berufsgruppe: {
    bereich: UEBERGABE_1, pflicht: true, art: 'auswahl', optionen: AUSWAHL.berufsgruppe,
    name: 'Berufsgruppe',
    hilfe: 'Steuert, welche Mail und welches Video der Kunde bekommt. Sachverständige bekommen immer die eigene Fassung.'
  },
  ziel: {
    bereich: UEBERGABE_1, pflicht: true, art: 'auswahl', optionen: AUSWAHL.ziel,
    name: 'Was der Kunde erreichen will',
    hilfe: 'Das Hauptziel aus dem Telefonat. Bestimmt Video, Mails und Unterlagen bis zum Abschluss.'
  },
  ziel_priorisiert: {
    bereich: UEBERGABE_1, pflicht: false, art: 'checkbox',
    name: 'Vom Kunden klar priorisiert',
    hilfe: 'Angehakt = der Kunde hat dieses Ziel selbst als wichtigstes genannt. Leer = mehrere Themen ohne klaren Vorrang.'
  },
  schmerzpunkt_wortlaut: {
    bereich: UEBERGABE_1, pflicht: true, art: 'freitext',
    name: 'Größtes Problem, in den Worten des Kunden',
    hilfe: 'Wörtlich mitschreiben, nicht zusammenfassen. Der Satz wird in Gesprächen und Mails wiederverwendet. Mehrere Probleme sind in Ordnung.'
  },
  vorhaben: {
    bereich: UEBERGABE_1, pflicht: true, art: 'janein',
    name: 'Kunde hat ein konkretes eigenes Vorhaben',
    hilfe: 'Ja = er kommt mit einem fertigen Plan statt mit einem Problem. Dann geht statt der Standard-Mail die Vorhaben-Mail raus: Sie nennt das Vorhaben wörtlich, mit Umsetzungs-Beweis. Im Abschluss ist die KI-Bestandsaufnahme der Einstieg.'
  },
  vorerfahrung: {
    bereich: UEBERGABE_1, pflicht: false, art: 'auswahl', optionen: AUSWAHL.vorerfahrung,
    name: 'Bisherige Versuche und Anbieter',
    hilfe: 'Nichts genannt = gefragt, aber nichts vorhanden. Nicht gefragt = kam im Gespräch nicht vor. Bitte nicht raten, ein leeres Feld ist besser als ein falsches. Ein Maklerprogramm allein zählt nicht als Werkzeug.'
  },
  vorerfahrung_wortlaut: {
    bereich: UEBERGABE_1, pflicht: false, art: 'freitext',
    name: 'Wer oder was genau, wörtlich',
    hilfe: 'Name des Anbieters oder Werkzeugs und was es tut.'
  },
  mobilnummer: {
    bereich: UEBERGABE_1, pflicht: true, art: 'telefon',
    name: 'Mobilnummer',
    hilfe: 'Für die zwei SMS-Erinnerungen vor den Terminen.'
  },
  termin_bestaetigt: {
    bereich: UEBERGABE_1, pflicht: false, art: 'checkbox',
    name: 'Vom Kunden bestätigt',
    hilfe: 'Hat der Kunde die Kalender-Einladung noch im Telefonat angenommen?'
  },

  // ---- Übergabe 2: der Setter gibt an den Closer ab ----
  zuwachs_auftraege: {
    bereich: UEBERGABE_2, pflicht: true, art: 'zahl', min: 0,
    name: 'Gewünschte zusätzliche Aufträge pro Jahr',
    hilfe: 'Die Antwort auf die Frage, wo der Kunde hinwill.'
  },
  abschlussquote: {
    // Aufträge aus zehn Anfragen - mehr als zehn kann es nicht sein, und
    // die Zahl geht als Nenner in die Bedarfsrechnung ein.
    bereich: UEBERGABE_2, pflicht: true, art: 'zahl', min: 0, max: 10,
    name: 'Abschlussquote: Aufträge aus 10 Anfragen',
    hilfe: 'Wie viele von 10 Anfragen werden bei ihm ein Auftrag? Bitte kennzeichnen, ob die Zahl vom Kunden kommt oder geschätzt ist.'
  },
  quote_art: {
    bereich: UEBERGABE_2, pflicht: false, art: 'auswahl', optionen: AUSWAHL.quote_art,
    name: 'Herkunft der Quote',
    hilfe: 'Vom Kunden genannt oder geschätzt.'
  },
  ist_auftraege: {
    bereich: UEBERGABE_2, pflicht: false, art: 'zahl', min: 0,
    name: 'Aufträge im letzten Jahr',
    hilfe: 'Nur eintragen, wenn die Zahl im Gespräch fiel.'
  },
  keine_zahlen: {
    bereich: UEBERGABE_2, pflicht: false, art: 'checkbox',
    name: 'Kunde wollte keine Zahlen nennen',
    hilfe: 'Dann bleiben die Zahlenfelder leer, und das ist in Ordnung.'
  },
  entscheider_messlatte: {
    bereich: UEBERGABE_2, pflicht: true, art: 'freitext',
    name: 'Wer entscheidet, und woran der Erfolg gemessen wird, wörtlich',
    hilfe: 'Beides stammt aus einem Moment im Gespräch. Die Messlatte wörtlich notieren, sie kommt ins Strategiepapier.'
  },
  investitionsrahmen: {
    bereich: UEBERGABE_2, pflicht: false, art: 'betrag', min: 0,
    name: 'Investitionsrahmen',
    hilfe: 'Der Rahmen aus der Budget-Frage. Ausweichen ist ein dokumentiertes Ergebnis, kein Fehler.'
  },
  rahmen_ausgewichen: {
    bereich: UEBERGABE_2, pflicht: false, art: 'checkbox',
    name: 'Kunde ist ausgewichen',
    hilfe: 'Ausweichen ist ein dokumentiertes Ergebnis, kein Fehler.'
  },
  schmerzpunkt_vertieft: {
    bereich: UEBERGABE_2, pflicht: true, art: 'freitext',
    name: 'Größtes Problem, bestätigt und vertieft, wörtlich',
    hilfe: 'Der Satz aus dem Erstanruf, durch Nachfragen bestätigt und vertieft. Wieder wörtlich.'
  },
  bedarf_wortlaut: {
    bereich: UEBERGABE_2, pflicht: false, art: 'freitext',
    name: 'Was der Kunde sagt, das er braucht, wörtlich',
    hilfe: 'Nur ausfüllen, wenn der Satz wirklich gefallen ist.'
  },
  offene_huerde: {
    bereich: UEBERGABE_2, pflicht: true, art: 'freitext',
    name: 'Offene Bedenken und Einwände, wörtlich',
    hilfe: 'Was den Kunden noch zögern lässt. Der Closer bereitet sich genau darauf vor.'
  },
  material_versendet: {
    bereich: UEBERGABE_2, pflicht: true, art: 'liste',
    name: 'Versendete Unterlagen und Videos',
    hilfe: 'Füllt das System beim Senden automatisch aus. Vor dem Abschlussgespräch kurz prüfen.'
  }
}

/** Berechnete Anzeigen - niemand gibt sie ein. */
export const BERECHNET = {
  noetige_anfragen: {
    name: 'Nötige Anfragen pro Monat',
    hilfe: 'Aus Wunsch-Aufträgen und Abschlussquote gerechnet. Dieselbe Zahl steht später im Strategiepapier, bitte nicht überschreiben.'
  },
  anfragen_bereich: {
    name: 'Anfragen-Bedarf pro Monat',
    hilfe: 'Zeigt dem Closer, welches Paket die Zahlen begründen.'
  }
}

const felderIn = (bereich) =>
  Object.entries(FELDER).filter(([, f]) => f.bereich === bereich)

/**
 * Prüft eine Übergabe.
 *
 * Rückgabe: { offen, warnungen, vollstaendig }
 *   offen      - Gate-Felder, die fehlen. Solange hier etwas steht, wird nicht
 *                weitergebucht.
 *   warnungen  - Felder, deren Fehlen auffällt, aber nichts blockiert.
 */
/**
 * Werte ausserhalb der erlaubten Spanne.
 *
 * Getrennt von uebergabePruefen(): Ein fehlendes Feld und ein unmoegliches
 * Feld sind zwei verschiedene Fehler. "-3 gewuenschte Auftraege" ist nicht
 * unvollstaendig, es ist falsch - und ging bisher glatt durch, weil ein
 * Zahlenfeld ohne min alles annimmt, was sich tippen laesst. Die
 * Bedarfsrechnung lieferte daraufhin negative Anfragen pro Monat.
 */
export function grenzenPruefen(werte) {
  const verstoesse = []
  for (const [schluessel, feld] of Object.entries(FELDER)) {
    if (feld.min === undefined && feld.max === undefined) continue
    const wert = werte?.[schluessel]
    if (wert === null || wert === undefined || wert === '') continue
    const zahl = Number(wert)
    if (Number.isNaN(zahl)) continue
    if (feld.min !== undefined && zahl < feld.min) {
      verstoesse.push({ schluessel, name: feld.name, grenze: `mindestens ${feld.min}` })
    } else if (feld.max !== undefined && zahl > feld.max) {
      verstoesse.push({ schluessel, name: feld.name, grenze: `höchstens ${feld.max}` })
    }
  }
  return verstoesse
}

export function uebergabePruefen(lead, bereich) {
  const leer = (wert, art) => {
    // Eine nicht angehakte Checkbox ist eine Antwort, keine Luecke. Wuerde sie
    // als fehlend gelten, nörgelte das System über Felder, die korrekt leer
    // sind - und die Warnungen wären nach einer Woche Rauschen.
    if (art === 'checkbox') return false
    // Bei Ja/Nein ist "gar nicht beantwortet" dagegen sehr wohl eine Luecke.
    if (art === 'janein') return wert !== true && wert !== false
    if (wert === null || wert === undefined) return true
    if (art === 'liste') return !Array.isArray(wert) || wert.length === 0
    return String(wert).trim() === ''
  }

  const offen = []
  const warnungen = []

  for (const [schluessel, feld] of felderIn(bereich)) {
    // "Kunde wollte keine Zahlen nennen" hebt die Zahlen-Gates auf - genau
    // dafür ist die Checkbox da. Ein leeres Feld ist dann die richtige Antwort.
    if (lead?.keine_zahlen && ['zuwachs_auftraege', 'abschlussquote'].includes(schluessel)) continue

    if (leer(lead?.[schluessel], feld.art)) {
      (feld.pflicht ? offen : warnungen).push({ schluessel, name: feld.name, hilfe: feld.hilfe })
    }
  }

  return { offen, warnungen, vollstaendig: offen.length === 0 }
}

export const FELDER_UEBERGABE_1 = felderIn(UEBERGABE_1)
export const FELDER_UEBERGABE_2 = felderIn(UEBERGABE_2)
