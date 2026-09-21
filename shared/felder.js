// Die Felder der beiden Übergaben. Namen, Fragesätze und Hilfetexte stammen
// aus der Feldspezifikation (Block 1 und 3, Stand 20.09.) und der Feldtabelle
// neben Miro F24, mit den Änderungen aus dem Test vom 21.09.
//
// Warum hier und nicht im Formular: Dieselben Definitionen prüfen im Backend
// das Gate und beschriften im Frontend die Eingabe. Zwei Quellen wären zwei
// Wahrheiten.
//
// Aufbau: FELDER beschreibt jede Spalte einmal (Name, Art, Werte). Die beiden
// Masken legen fest, welche Spalten in welcher Reihenfolge erscheinen und wie
// streng sie dort sind. Dieselbe Spalte darf in beiden Masken stehen: Die
// Mobilnummer ist im Erstanruf Gate und im Beratungsgespräch nur Pflicht, wenn
// sie fehlt; den Entscheider notiert der Opener und der Setter ergänzt ihn.

export const UEBERGABE_1 = 'Erstanruf (Opener)'
export const UEBERGABE_2 = 'Beratungsgespräch (Setter)'

/** Die Branchen. Der gespeicherte Wert heißt aus Altgründen `berufsgruppe`. */
export const BRANCHE = {
  MAKLER: 'Makler',
  SV: 'Sachverständiger',
  ANDERE: 'andere'
}

/** Die Ziele. Die langen Werte stehen so in der Datenbank und in jeder Mailregel. */
export const ZIEL = {
  EIGENTUEMER: 'Mehr Eigentümer-Anfragen',
  KAEUFER: 'Mehr Kaufinteressenten',
  ZEIT: 'Zeitersparnis und Entlastung',
  OFFEN: 'Noch nicht besprochen'
}

/** Auswahllisten. */
export const AUSWAHL = {
  berufsgruppe: [BRANCHE.MAKLER, BRANCHE.SV, BRANCHE.ANDERE],
  ziel: [ZIEL.EIGENTUEMER, ZIEL.KAEUFER, ZIEL.ZEIT, ZIEL.OFFEN],
  vorerfahrung: [
    'Anbieter beauftragt',
    'Eigenes Werkzeug im Einsatz',
    'Beides',
    'Nichts genannt',
    'Nicht gefragt'
  ],
  kennzeichen: ['vom Kunden genannt', 'geschätzt'],
  // Ausgang des Beratungsgesprächs und des Abschlussgesprächs: dieselben vier
  // Werte, aber zwei Spalten, denn jedes Gespräch hat seinen eigenen Ausgang.
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

// ---------------------------------------------------------------------------
// Ziel aus dem Erstanruf
// ---------------------------------------------------------------------------

const echteZiele = (werte) =>
  (Array.isArray(werte?.ziele) ? werte.ziele : []).filter(z => z && z !== ZIEL.OFFEN)

/**
 * Leitet aus der Mehrfachauswahl des Openers das Arbeits-Ziel ab.
 *
 *   ein Ziel genannt               -> dieses Ziel, gilt als priorisiert
 *   mehrere, eines priorisiert     -> das priorisierte
 *   mehrere ohne Vorrang           -> kein Arbeits-Ziel; der Setter fragt nach
 *   nur „Noch nicht besprochen"    -> „Noch nicht besprochen"
 *
 * `ziel` steuert Mail, Video und Zahlenblock. Bleibt es bei mehreren Zielen
 * ohne Vorrang leer, wählt der Opener die Mail von Hand, statt dass das System
 * eines der Ziele rät.
 */
export function zielAbleiten(werte) {
  const ziele = echteZiele(werte)
  const prio = ziele.includes(werte?.ziel_prioritaet) ? werte.ziel_prioritaet : null
  let ziel = null
  if (prio) ziel = prio
  else if (ziele.length === 1) ziel = ziele[0]
  else if (ziele.length === 0 && (werte?.ziele || []).includes(ZIEL.OFFEN)) ziel = ZIEL.OFFEN
  return {
    ziel,
    ziel_prioritaet: prio,
    ziel_priorisiert: Boolean(prio) || ziele.length === 1
  }
}

/** Welche der drei Fassungen des Ziel-Satzes im Beratungsgespräch gilt. */
export function zielStatus(lead) {
  const ziele = echteZiele(lead)
  if (ziele.length === 0) {
    // Altbestand ohne Mehrfachauswahl: ein gesetztes Ziel zählt als genannt.
    if (lead?.ziel && lead.ziel !== ZIEL.OFFEN) return lead.ziel_priorisiert ? 'priorisiert' : 'genannt'
    return 'nicht_erhoben'
  }
  if (ziele.length === 1 || lead?.ziel_prioritaet) return 'priorisiert'
  return 'genannt'
}

/** Was der Opener als Ziel notiert hat, für den Satz „Mein Kollege hatte notiert …". */
function zielNotiert(lead) {
  if (lead?.ziel_prioritaet) return kurzZiel(lead.ziel_prioritaet, lead)
  const ziele = echteZiele(lead)
  if (ziele.length) return ziele.map(z => kurzZiel(z, lead)).join(' und ')
  return lead?.ziel ? kurzZiel(lead.ziel, lead) : '…'
}

function kurzZiel(ziel, lead) {
  const sv = istSv(lead)
  if (ziel === ZIEL.EIGENTUEMER) return sv ? 'mehr Bewertungsanfragen' : 'mehr Eigentümer-Anfragen'
  if (ziel === ZIEL.KAEUFER) return 'mehr ernsthafte Kaufinteressenten'
  if (ziel === ZIEL.ZEIT) return 'Zeitersparnis und Entlastung'
  return '…'
}

// ---------------------------------------------------------------------------
// Sonderfälle
// ---------------------------------------------------------------------------

export const istSv = (lead) => lead?.berufsgruppe === BRANCHE.SV

/**
 * Reduzierter Modus im Beratungsgespräch (Entscheidung Niklas, 20.09.):
 * andere Branche oder eigenes Vorhaben. Dann passen die Standardfragen nicht,
 * die Maske zeigt nur Notizen, Termin, Mobilnummer und Ergebnis, und es
 * blockiert nur noch der Abschlusstermin.
 */
export function reduzierterModus(lead) {
  if (lead?.vorhaben === true) return 'vorhaben'
  if (lead?.berufsgruppe === BRANCHE.ANDERE) return 'andere'
  return null
}

/** Der Satz über dem Notizfeld im reduzierten Modus. Bei beiden Auslösern gilt der Vorhaben-Satz. */
export const GRUND_REDUZIERT = {
  vorhaben: 'Dieser Kunde kommt mit einem konkreten eigenen Vorhaben statt mit einem Problem. Die Standardfragen passen deshalb nicht. Schreib frei mit, was du hörst; die Vorschläge oben helfen dir dabei.',
  andere: 'Dieser Kunde ist weder Makler noch Sachverständiger. Unsere Standardfragen passen deshalb nicht. Schreib frei mit, was du hörst; die Vorschläge oben helfen dir dabei.'
}

/** Die Anleitung im Notizfeld, je nach Auslöser. */
export const ANLEITUNG_REDUZIERT = {
  vorhaben: 'Was er genau vorhat (wörtlich), was am Ende dabei herauskommen soll, welche Systeme und Daten beteiligt sind, bis wann es stehen soll, was ihn die heutige Lösung kostet.',
  andere: 'Was sein Geschäft ausmacht, wo seine Anfragen herkommen, was am meisten Zeit frisst, was er schon versucht hat, woran er Erfolg messen würde.'
}

/**
 * Sprache für Sachverständige (Feedback 21.09.): Aus Eigentümeranfragen werden
 * Bewertungsanfragen, in Feldnamen, Fragesätzen, Hilfetexten und Auswahllisten.
 * Nur die Anzeige ändert sich, gespeichert wird weiter der Standardwert.
 */
export function svSprache(text, lead) {
  if (!text || !istSv(lead)) return text
  return String(text)
    .replace(/Eigentümeranfragen/g, 'Bewertungsanfragen')
    .replace(/Eigentümer-Anfragen/g, 'Bewertungsanfragen')
    .replace(/Eigentümeranfrage/g, 'Bewertungsanfrage')
    .replace(/Ihre Eigentümer/g, 'Ihre Auftraggeber')
}

// ---------------------------------------------------------------------------
// Die Spalten
// ---------------------------------------------------------------------------

/**
 * Art der Eingabe:
 *   auswahl, mehrfach, janein, checkbox, freitext, text, zahl, telefon, liste
 * `liste` ist reine Anzeige: Das System füllt sie.
 */
export const FELDER = {
  berufsgruppe: {
    name: 'Branche', art: 'auswahl', optionen: AUSWAHL.berufsgruppe,
    hilfe: 'Steuert, welche Mail und welches Video der Kunde bekommt. Sachverständige bekommen immer die eigene Fassung. Bei „andere" zeigt das Setting später nur das Notizfeld.'
  },
  branche_andere: {
    name: 'Welche Branche?', art: 'text',
    hilfe: 'Nur bei „andere". Ein, zwei Wörter reichen, zum Beispiel „Hausverwaltung" oder „Bauträger".'
  },
  entscheider: {
    name: 'Ansprechpartner und Funktion', art: 'text',
    hilfe: 'Wer entscheidet? Name und Rolle im Büro.'
  },
  ziele: {
    name: 'Was der Kunde erreichen will', art: 'mehrfach', optionen: AUSWAHL.ziel,
    hilfe: 'Alle Ziele, die im Telefonat gefallen sind. Sie bestimmen Video, Mails und Unterlagen bis zum Abschluss. Nennt der Kunde mehrere, entscheidet das priorisierte Ziel.'
  },
  ziel_prioritaet: {
    name: 'Priorisiertes Ziel', art: 'auswahl',
    hilfe: 'Nur setzen, wenn der Kunde selbst ein Ziel als wichtigstes nennt. Danach richten sich Testimonial und VSL. Leer heißt: mehrere Themen ohne klaren Vorrang, der Setter fragt nach.'
  },
  ziel: {
    name: 'Ziel bestätigt oder korrigiert', art: 'auswahl', optionen: AUSWAHL.ziel,
    hilfe: 'Der Block beginnt mit „Was hat Sie dazu gebracht, sich das Gespräch und das Thema KI überhaupt anzuhören?". In der Antwort steckt oft schon das Ziel und das Problem, das dann ins Feld darunter gehört. Wozu: Dieses eine Feld steuert den Rest des Gesprächs. Es entscheidet, welche zwei Zahlen gleich gefragt werden, wie die Budget-Frage lautet, welche Unterlagen du am Ende ankündigst und welches Video der Kunde bekommt. Korrigiere es sofort, wenn er etwas anderes sagt.'
  },
  schmerzpunkt_wortlaut: {
    name: 'Größtes Problem, in den Worten des Kunden', art: 'freitext',
    hilfe: 'Wörtlich mitschreiben, nicht zusammenfassen. Der Satz wird in Gesprächen und Mails wiederverwendet. Mehrere Probleme sind in Ordnung.'
  },
  vorerfahrung: {
    name: 'Bisherige Versuche und Anbieter zur Lösung des Problems', art: 'auswahl', optionen: AUSWAHL.vorerfahrung,
    hilfe: 'Nichts genannt heißt: gefragt, aber nichts vorhanden. Nicht gefragt heißt: kam im Gespräch nicht vor. Bitte nicht raten, ein leeres Feld ist besser als ein falsches. Ein Maklerprogramm allein zählt nicht als Werkzeug.'
  },
  vorerfahrung_wortlaut: {
    name: 'Wer oder was genau, wörtlich', art: 'freitext',
    hilfe: 'Name des Anbieters oder Werkzeugs und was es tut.'
  },
  notizen_erstanruf: {
    name: 'Notizen zum Erstanruf', art: 'freitext', zeilen: 3,
    hilfe: 'Wichtige Zusatzinfos aus dem Telefonat oder eine kurze Zusammenfassung. Der Setter liest es vor seinem Gespräch.'
  },
  vorhaben: {
    name: 'Kunde hat ein konkretes eigenes Vorhaben', art: 'janein',
    hilfe: 'Ja heißt: Er kommt mit einem fertigen Plan statt mit einem Problem. Dann geht statt der Standard-Mail die Vorhaben-Mail raus, die das Vorhaben wörtlich aufgreift. Im Setting ist dann nur das Notizfeld offen.'
  },
  fragt_nach_konditionen: {
    name: 'Kunde fragt von sich aus nach Preis, Ablauf oder Starttermin', art: 'checkbox',
    hilfe: 'Nur anhaken, wenn er selbst gefragt hat. Das stuft ihn als weit fortgeschritten ein und steuert, welches Material er später bekommt.'
  },
  mobilnummer: {
    name: 'Mobilnummer', art: 'telefon',
    hilfe: 'Für die SMS-Erinnerung eine Stunde vor den Terminen.'
  },
  termin_bestaetigt: {
    name: 'Termin vom Kunden bestätigt', art: 'checkbox',
    hilfe: 'Hat der Kunde die Kalender-Einladung noch im Telefonat angenommen?'
  },

  // ---- Beratungsgespräch ----
  schmerzpunkt_vertieft: {
    name: 'Wo es am meisten hakt, wörtlich', art: 'freitext',
    hilfe: 'Einstieg in den Block: „Was könnte aktuell besser laufen?" Vertiefung, wenn die Antwort blass bleibt: „Woran merken Sie das im Alltag am deutlichsten?" Wozu: Der Closer beginnt sein Gespräch mit genau diesem Satz („Beim letzten Mal hatten Sie gesagt: …"), und er steht in jeder Nachfass-Mail. Eine Zusammenfassung von dir nützt dort nichts, sie klingt nach uns statt nach ihm.'
  },
  versuche_ergebnis: {
    name: 'Was er schon ausprobiert hat, und was dabei rauskam', art: 'freitext',
    hilfe: 'Beiläufig hinterher: „Was haben Sie da ungefähr investiert?" Steht im Erstanruf ein Name: „Was genau machen die für Sie?" Nutzt er ein eigenes Werkzeug: „Wofür genau, und was bringt es Ihnen?" Die Antwort auf den Vorsatz gehört mit in dieses Feld. Wozu: Der Closer muss wissen, wovon sich unser Vorschlag unterscheiden muss. Und was der Kunde schon bezahlt hat, sagt mehr über sein Budget als jede Budget-Frage.'
  },
  bedarf_wortlaut: {
    name: 'Was er bräuchte, damit es besser läuft, wörtlich', art: 'freitext',
    hilfe: 'Nur ausfüllen, wenn der Satz wirklich gefallen ist. Fiel er schon früher im Gespräch, hier eintragen. Wozu: Das ist der einzige Satz, in dem der Kunde selbst eine Lösung ausspricht. Gespräche mit so einem Satz schließen deutlich häufiger ab, deshalb messen wir, wie oft er fällt.'
  },
  zuwachs_auftraege: {
    name: 'Wie viele Aufträge im Jahr dazukommen sollen', art: 'zahl', min: 0,
    hilfe: 'Wozu: Aus dieser und der nächsten Zahl rechnet das System, wie viele Anfragen ihm im Monat fehlen. Diese eine Zahl trägt später das ganze Konzept, die Budget-Frage und das Abschlussgespräch.'
  },
  abschlussquote: {
    // Aufträge aus zehn Anfragen: mehr als zehn kann es nicht sein, und die
    // Zahl geht als Nenner in die Bedarfsrechnung ein.
    name: 'Von 10 Eigentümeranfragen werden Auftrag', art: 'zahl', min: 0, max: 10,
    hilfe: 'Vorspann, wenn er zögert: „Das ist von Büro zu Büro sehr verschieden, deshalb frage ich:" Kennt er die Zahl nicht, einen Schätzanker geben („eher zwei von zehn oder eher vier?") und als geschätzt kennzeichnen. Wozu: Zweiter Eingang derselben Rechnung.'
  },
  objekte_pro_jahr: {
    name: 'Objekte im Jahr auf dem Markt', art: 'zahl', min: 0,
    hilfe: 'Wozu: Grundlage der Rechnung, wie viel Zeit die Gucker kosten, und der Muster-Anzeige für eines seiner Objekte.'
  },
  ernsthafte_von_10: {
    name: 'Von 10 Anfragen je Objekt sind ernsthaft', art: 'zahl', min: 0, max: 10,
    hilfe: 'Schätzanker wie beim Eigentümer-Paar, dann als geschätzt kennzeichnen. Wozu: Zeigt, wie viel Aussortier-Arbeit heute anfällt.'
  },
  zeitfresser: {
    name: 'Was die meiste Zeit frisst', art: 'text',
    hilfe: 'Keine eigene Frage: Die Antwort steht schon im Feld „Wo es am meisten hakt". Wozu: Der Eintrag ist die Überschrift seiner Automatisierungs-Kurzanalyse und der Platzhalter in der Stunden- und der Budget-Frage.'
  },
  stunden_pro_woche: {
    name: 'Stunden dafür pro Woche', art: 'zahl', min: 0, max: 168,
    hilfe: 'Vorspann: „Nur damit ich die Größenordnung habe:" Wozu: Die Stunden sind der Kern seiner Kurzanalyse und tauchen wörtlich in der Budget-Frage wieder auf.'
  },
  erreichbarkeit_thema: {
    name: 'Erreichbarkeit war Thema', art: 'checkbox',
    hilfe: 'Anhaken, wenn der Kunde verpasste Anrufe oder schlechte Erreichbarkeit anspricht. Dann erscheint das Feld „Anrufe pro Woche".'
  },
  anrufe_pro_woche: {
    name: 'Anrufe pro Woche', art: 'zahl', min: 0,
    hilfe: 'Wozu: Geht in die Rechnung ein, wie viele Anrufe heute unbeantwortet bleiben.'
  },
  keine_zahlen: {
    name: 'Kunde wollte keine Zahlen nennen', art: 'checkbox',
    hilfe: 'Dann bleiben die Zahlenfelder leer, und das ist in Ordnung.'
  },
  erfolgskriterien: {
    name: 'Was passieren müsste, damit es sich gelohnt hat, wörtlich', art: 'freitext',
    hilfe: 'Wozu: Mit genau diesem Satz schließt der Closer ab („und wichtig war Ihnen …"), und er wird zum messbaren Ergebnis im Strategiepapier. Ohne ihn verhandelt der Closer über Leistungen statt über sein Ziel.'
  },
  investitionsrahmen: {
    name: 'Was er bereit wäre zu investieren', art: 'freitext', zeilen: 1,
    hilfe: 'Zweite Möglichkeit, wenn er ausweicht: „Angenommen, wir bekommen das hin … Was haben Sie sich dafür an Budget vorgestellt? Ich frage, weil es ein bisschen wie beim Autokauf ist: Fiat oder Porsche, beides bringt Sie ans Ziel, das eine schneller." Keine Preise nennen, seine Zahl ist ein Rahmen, kein Angebot. Weicht er aus, genau das notieren („ausgewichen") und nicht verhandeln.'
  },
  ist_auftraege: {
    name: 'Aufträge im letzten Jahr', art: 'zahl', min: 0,
    hilfe: 'Wozu: Nur damit das Konzept „von 20 auf 28" heißen kann statt „8 mehr". Fehlt die Zahl, funktioniert es trotzdem.'
  },
  provision_je_auftrag: {
    name: 'Provision je Auftrag', art: 'zahl', min: 0,
    hilfe: 'Bei Zögern: „Eine Größenordnung reicht mir völlig. Eher zehn oder eher zwanzigtausend?" Wozu: Mit seiner echten Zahl rechnet der Closer im Abschluss den Mehrumsatz vor.'
  },
  offene_huerde: {
    name: 'Was noch geklärt sein müsste, wörtlich', art: 'freitext',
    hilfe: 'Kam ein klares Ja, bleibt das Feld leer. Wozu: Der Closer baut seine Vorbereitung darauf auf und bringt den passenden Beleg mit, statt den Einwand in Minute 40 zum ersten Mal zu hören.'
  },
  notizen_setting: {
    name: 'Notizen und Sonderthemen', art: 'freitext', zeilen: 3,
    hilfe: 'Wer aus seinem Team dazukommt, Besonderheiten des Büros, vereinbarte Ausnahmen, Stimmung im Gespräch. Wozu: Damit du nichts unterschlagen musst, was nicht in ein Feld passt. Der Closer liest es vor dem Termin.'
  },
  ergebnis_beratung: {
    name: 'Ergebnis des Gesprächs', art: 'auswahl', optionen: AUSWAHL.gespraechsausgang,
    hilfe: 'Bis auf die klare Absage endet jedes Beratungsgespräch mit einem Abschlusstermin. Kam ausnahmsweise keiner zustande, fasst du binnen 48 Stunden nach. Kannst du die Handlung nicht mit Datum benennen, ist es „Vertagt ohne festen Schritt". Wozu: Das Feld entscheidet, was das System als Nächstes tut, und ist die Grundlage der Quote, an der wir sehen, ob der Prozess trägt.'
  },
  material_versendet: {
    name: 'Versendete Unterlagen und Videos', art: 'liste',
    hilfe: 'Füllt das System beim Senden automatisch aus. Vor dem Abschlussgespräch kurz prüfen.'
  },

  // ---- Altbestand: nicht mehr in einer Maske, aber lesbar ----
  entscheider_messlatte: {
    name: 'Wer entscheidet, und woran der Erfolg gemessen wird (alte Fassung)', art: 'freitext',
    hilfe: 'Stammt aus der Maske vor dem 21.09., als Entscheider und Erfolgskriterien ein Feld waren.'
  }
}

/** Berechnete Anzeigen, niemand gibt sie ein. */
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

/** Dieselbe Rechnung wie die berechnete Spalte in der Datenbank. */
export function noetigeAnfragen(werte) {
  const zuwachs = Number(werte?.zuwachs_auftraege)
  const quote = Number(werte?.abschlussquote)
  if (!zuwachs || !quote || quote <= 0) return null
  return Math.round((zuwachs / (quote / 10) / 12) * 10) / 10
}

// ---------------------------------------------------------------------------
// Die beiden Masken
// ---------------------------------------------------------------------------

// Stufen je Feld:
//   pflicht: true   Gate. Ohne das Feld geht die Übergabe nicht weiter.
//   pflicht: false  Pflicht mit Warnung. Fehlt es, wird gewarnt, nicht blockiert.
//   optional: true  Leer ist kein Fehler, keine Warnung.
//
// frage(werte) liefert, was dauerhaft unter dem Feldnamen steht:
//   { vorsatz, satz }  Sätze zum Vorlesen, in Anführungszeichen
//   { hinweis }        Anweisung an den Setter, wird nie vorgelesen
// sichtbar(werte) blendet ein Feld aus. Ausgeblendete Felder prüft niemand.

const nurBeiZiel = (...ziele) => (w) => ziele.includes(w?.ziel)
const nichtReduziert = (w) => !reduzierterModus(w)

const MASKE_1 = [
  { spalte: 'berufsgruppe', pflicht: true },
  { spalte: 'branche_andere', pflicht: true, sichtbar: w => w?.berufsgruppe === BRANCHE.ANDERE },
  { spalte: 'entscheider', pflicht: false },
  { spalte: 'ziele', pflicht: true },
  {
    spalte: 'ziel_prioritaet', optional: true,
    sichtbar: w => echteZiele(w).length > 1,
    optionen: w => echteZiele(w)
  },
  { spalte: 'schmerzpunkt_wortlaut', pflicht: true },
  {
    spalte: 'vorerfahrung', pflicht: false,
    // E6 (21.09.): „Nicht gefragt" ist eine erlaubte Antwort, aber keine gute.
    // Es blockiert nichts, sagt aber, was daraus folgt.
    wertHinweis: { 'Nicht gefragt': 'Kam im Gespräch nicht vor. Der Setter fragt im Beratungsgespräch danach.' }
  },
  { spalte: 'vorerfahrung_wortlaut', optional: true, sichtbar: w => ['Anbieter beauftragt', 'Eigenes Werkzeug im Einsatz', 'Beides'].includes(w?.vorerfahrung) },
  {
    spalte: 'notizen_erstanruf', optional: true,
    frage: () => ({ hinweis: 'Vor dem Auflegen ankündigen, was gleich kommt, zum Beispiel: „Ich schicke Ihnen gleich noch ein kurzes Video von einem Kunden, der vor derselben Frage stand."' })
  },
  { spalte: 'vorhaben', pflicht: true },
  { spalte: 'fragt_nach_konditionen', optional: true },
  { spalte: 'mobilnummer', pflicht: true },
  { spalte: 'termin_bestaetigt', optional: true }
]

const ABSCHNITT = {
  ZIEL: 'Anlass und Ziel',
  PROBLEM: 'Problem und Versuche',
  ZAHLEN: 'Zahlen und Entscheidung',
  NEBENBEI: 'Nur wenn es im Gespräch fiel',
  ABSCHLUSS: 'Abschluss des Gesprächs'
}

export const ABSCHNITT_UNTERTITEL = {
  [ABSCHNITT.ZAHLEN]: '„Damit unser Experte mit Ihren Zahlen rechnen kann und nicht mit irgendwelchen, zwei kurze Zahlenfragen."'
}

const zahlenPflicht = (w) => !w?.keine_zahlen

const MASKE_2 = [
  {
    spalte: 'ziel', abschnitt: ABSCHNITT.ZIEL, pflicht: false, sichtbar: nichtReduziert,
    frage: (w) => {
      const status = zielStatus(w)
      const notiert = `„Mein Kollege hatte notiert, dass es Ihnen vor allem um ${zielNotiert(w)} geht. Ist das weiterhin so?"`
      if (status === 'priorisiert') return { satz: notiert }
      if (status === 'genannt') return { satz: `${notiert} „Und wenn Sie nur eines davon bekommen könnten, welches?"` }
      return { satz: '„Und was sind Ihre Ziele für die nächsten zwölf Monate?"' }
    }
  },
  {
    spalte: 'schmerzpunkt_vertieft', abschnitt: ABSCHNITT.PROBLEM, pflicht: true,
    vorbelegt: 'schmerzpunkt_wortlaut', sichtbar: nichtReduziert,
    frage: (w) => w?.ziel === ZIEL.ZEIT
      ? { satz: '„Was frisst bei Ihnen die meiste Zeit, die nichts mit Verkaufen zu tun hat?"' }
      : { satz: '„Und wo hakt es da heute am meisten?"' }
  },
  {
    spalte: 'versuche_ergebnis', abschnitt: ABSCHNITT.PROBLEM, optional: true,
    vorbelegt: 'vorerfahrung_wortlaut', sichtbar: nichtReduziert,
    frage: (w) => ({
      vorsatz: w?.ziel === ZIEL.EIGENTUEMER ? '„Wie kommen Ihre Eigentümer heute zu Ihnen?"'
        : w?.ziel === ZIEL.KAEUFER ? '„Wie kommen Ihre Kaufinteressenten heute zu Ihnen?"'
          : null,
      satz: '„Und was haben Sie schon ausprobiert, um das zu lösen? Mit wem? Was kam dabei rum?"'
    })
  },
  {
    spalte: 'bedarf_wortlaut', abschnitt: ABSCHNITT.PROBLEM, optional: true, sichtbar: nichtReduziert,
    frage: () => ({ satz: '„Was bräuchten Sie, damit das besser läuft?"' })
  },

  // Der Zahlenblock wechselt mit dem Ziel: immer genau zwei Zahlen.
  {
    spalte: 'zuwachs_auftraege', abschnitt: ABSCHNITT.ZAHLEN, pflicht: false, kennzeichen: true,
    pflichtWenn: zahlenPflicht, sichtbar: w => nichtReduziert(w) && nurBeiZiel(ZIEL.EIGENTUEMER)(w),
    frage: () => ({ satz: '„Wo wollen Sie hin? Wie viele Aufträge sollen im Jahr dazukommen?"' })
  },
  {
    spalte: 'abschlussquote', abschnitt: ABSCHNITT.ZAHLEN, pflicht: false, kennzeichen: true,
    pflichtWenn: zahlenPflicht, sichtbar: w => nichtReduziert(w) && nurBeiZiel(ZIEL.EIGENTUEMER)(w),
    frage: () => ({ satz: '„Von zehn Eigentümeranfragen, die bei Ihnen reinkommen, wie viele werden am Ende ein Auftrag?"' })
  },
  {
    spalte: 'objekte_pro_jahr', abschnitt: ABSCHNITT.ZAHLEN, pflicht: false, kennzeichen: true,
    pflichtWenn: zahlenPflicht, sichtbar: w => nichtReduziert(w) && nurBeiZiel(ZIEL.KAEUFER)(w),
    frage: () => ({ satz: '„Wie viele Objekte bringen Sie im Jahr ungefähr auf den Markt?"' })
  },
  {
    spalte: 'ernsthafte_von_10', abschnitt: ABSCHNITT.ZAHLEN, pflicht: false, kennzeichen: true,
    pflichtWenn: zahlenPflicht, sichtbar: w => nichtReduziert(w) && nurBeiZiel(ZIEL.KAEUFER)(w),
    frage: () => ({ satz: '„Und von zehn Anfragen, die auf ein Objekt kommen, wie viele sind wirklich ernsthaft?"' })
  },
  {
    spalte: 'zeitfresser', abschnitt: ABSCHNITT.ZAHLEN, pflicht: false,
    pflichtWenn: zahlenPflicht, sichtbar: w => nichtReduziert(w) && nurBeiZiel(ZIEL.ZEIT)(w),
    frage: () => ({ hinweis: 'Trag hier den Zeitfresser ein, den er eben genannt hat.' })
  },
  {
    spalte: 'stunden_pro_woche', abschnitt: ABSCHNITT.ZAHLEN, pflicht: false, kennzeichen: true,
    pflichtWenn: zahlenPflicht, sichtbar: w => nichtReduziert(w) && nurBeiZiel(ZIEL.ZEIT)(w),
    frage: () => ({ satz: '„Wie viele Stunden gehen dafür bei Ihnen in der Woche drauf?"' })
  },
  {
    spalte: 'erreichbarkeit_thema', abschnitt: ABSCHNITT.ZAHLEN, optional: true,
    sichtbar: w => nichtReduziert(w) && nurBeiZiel(ZIEL.ZEIT)(w),
    frage: () => ({ hinweis: 'Nur anhaken, wenn Erreichbarkeit im Gespräch Thema war.' })
  },
  {
    spalte: 'anrufe_pro_woche', abschnitt: ABSCHNITT.ZAHLEN, optional: true, kennzeichen: true,
    sichtbar: w => nichtReduziert(w) && nurBeiZiel(ZIEL.ZEIT)(w) && w?.erreichbarkeit_thema === true,
    frage: () => ({ satz: '„Wie viele Anrufe bekommen Sie ungefähr in der Woche?"' })
  },
  {
    spalte: 'keine_zahlen', abschnitt: ABSCHNITT.ZAHLEN, optional: true,
    sichtbar: w => nichtReduziert(w) && [ZIEL.EIGENTUEMER, ZIEL.KAEUFER, ZIEL.ZEIT].includes(w?.ziel)
  },
  {
    spalte: 'entscheider', name: 'Wer das mitentscheidet', abschnitt: ABSCHNITT.ZAHLEN, pflicht: true,
    sichtbar: nichtReduziert,
    hilfe: 'Name und Rolle. Aus dem Erstanruf vorbelegt, hier ergänzen. Wozu: Ein Abschlussgespräch ohne den Entscheider endet fast immer mit „Ich muss das noch besprechen". Steht hier jemand Zusätzliches, lädst du ihn zum zweiten Termin mit ein.',
    frage: () => ({ satz: '„Wer entscheidet das bei Ihnen mit?"' })
  },
  {
    spalte: 'erfolgskriterien', abschnitt: ABSCHNITT.ZAHLEN, pflicht: true, sichtbar: nichtReduziert,
    frage: () => ({ satz: '„Was müsste passieren, damit Sie in einem halben Jahr sagen: die Zusammenarbeit hat sich gelohnt?"' })
  },
  {
    spalte: 'investitionsrahmen', abschnitt: ABSCHNITT.ZAHLEN, pflicht: true, sichtbar: nichtReduziert,
    frage: (w) => {
      if (w?.ziel === ZIEL.KAEUFER) {
        return { satz: '„Was wären Sie bereit zu investieren, vorausgesetzt Sie bekommen zu jedem Objekt … ernsthafte, geprüfte Kaufinteressenten statt der Gucker?"' }
      }
      if (w?.ziel === ZIEL.ZEIT) {
        const stunden = w?.stunden_pro_woche ? String(w.stunden_pro_woche).replace('.', ',') : '…'
        return { satz: `„Was wären Sie bereit zu investieren, vorausgesetzt wir spielen Ihnen die ${stunden} Stunden die Woche wieder frei?"` }
      }
      const anfragen = noetigeAnfragen(w)
      const zahl = anfragen ? anfragen.toLocaleString('de-DE') : '…'
      return { satz: `„Was wären Sie bereit zu investieren, vorausgesetzt es kommen wirklich ${zahl} Eigentümeranfragen im Monat dazu?"` }
    }
  },
  {
    spalte: 'ist_auftraege', abschnitt: ABSCHNITT.NEBENBEI, optional: true,
    // Bei Kaufinteressenten steht dieselbe Frage schon im Hauptblock.
    sichtbar: w => nichtReduziert(w) && w?.ziel !== ZIEL.KAEUFER,
    frage: (w) => ({ satz: istSv(w)
      ? '„Wie viele Gutachten erstellen Sie heute im Jahr?"'
      : '„Wie viele Objekte bringen Sie heute im Jahr auf den Markt?"' })
  },
  {
    spalte: 'provision_je_auftrag', abschnitt: ABSCHNITT.NEBENBEI, optional: true, sichtbar: nichtReduziert,
    frage: () => ({ satz: '„Was verdienen Sie im Schnitt an einem Auftrag?"' })
  },
  {
    spalte: 'offene_huerde', abschnitt: ABSCHNITT.ABSCHLUSS, optional: true, sichtbar: nichtReduziert,
    frage: () => ({
      vorsatz: '„Wenn wir Ihnen nächste Woche zeigen, wie genau das bei Ihnen läuft, können wir dann gemeinsam starten?"',
      satz: 'Wenn kein klares Ja kommt: „Was müsste dafür noch geklärt sein?"'
    })
  },
  // Das Abschlussgespräch selbst bucht die Setter-Ansicht über den Terminwähler
  // und prüft es dort als Gate; es ist keine Spalte dieser Liste.
  {
    spalte: 'mobilnummer', abschnitt: ABSCHNITT.ABSCHLUSS, pflicht: false,
    hilfe: 'Aus dem Erstanruf vorbelegt; nur nachtragen, wenn das Feld leer ist. Wozu: Ohne sie läuft die SMS eine Stunde vor dem Abschlussgespräch nicht, und die ist die letzte Absicherung gegen ein vergessenes Gespräch.',
    // Der Satz erscheint nur bei leerem Feld: Aus dem Erstanruf ist es fast immer gefüllt.
    frage: (w) => String(w?.mobilnummer || '').trim()
      ? null
      : { satz: '„Und geben Sie mir noch Ihre Mobilnummer, falls am Tag selbst etwas dazwischenkommt."' }
  },
  {
    spalte: 'notizen_setting', abschnitt: ABSCHNITT.ABSCHLUSS, optional: true,
    frage: () => ({ hinweis: 'Hier hinein, was in kein anderes Feld passt.' })
  },
  {
    spalte: 'ergebnis_beratung', abschnitt: ABSCHNITT.ABSCHLUSS, pflicht: false,
    frage: () => ({ hinweis: 'Erst nach dem Gespräch. „Nächster Schritt vereinbart" nur, wenn du die zugesagte Handlung mit Datum benennen kannst.' })
  },
  { spalte: 'material_versendet', abschnitt: ABSCHNITT.ABSCHLUSS, optional: true, anzeige: true, sichtbar: nichtReduziert }
]

const MASKEN = { [UEBERGABE_1]: MASKE_1, [UEBERGABE_2]: MASKE_2 }

/**
 * Die Felder einer Maske, fertig zusammengesetzt: Spaltendefinition plus die
 * Regeln der Maske. Jeder Eintrag trägt `schluessel` (= Spalte).
 */
export function maske(bereich) {
  return (MASKEN[bereich] || []).map(eintrag => ({
    ...FELDER[eintrag.spalte],
    ...eintrag,
    schluessel: eintrag.spalte,
    bereich
  }))
}

/** Alle Spalten beider Masken, ohne Doppel. Für Lesen und Schreiben im Backend. */
export const SPALTEN_UEBERGABE = [...new Set(
  [...MASKE_1, ...MASKE_2].map(e => e.spalte)
    .concat(['ziel', 'ziel_priorisiert', 'zahlen_kennzeichen', 'entscheider_messlatte'])
)]

export const SPALTEN_UEBERGABE_1 = [...new Set(MASKE_1.map(e => e.spalte).concat(['ziel', 'ziel_priorisiert']))]

/** Ist das Feld in dieser Maske gerade zu sehen? */
export const istSichtbar = (feld, werte) => !feld.sichtbar || feld.sichtbar(werte) !== false

/** Ist das Feld gerade ein Gate? `pflichtWenn` schaltet Pflicht und Warnung aus. */
function stufe(feld, werte) {
  if (feld.optional || feld.anzeige) return 'optional'
  if (feld.pflichtWenn && !feld.pflichtWenn(werte)) return 'optional'
  return feld.pflicht ? 'gate' : 'pflicht'
}

/** Beschriftung, Satz und Hilfe in der Sprache des Kunden. */
export function beschriftung(feld, werte) {
  const frage = feld.frage ? feld.frage(werte) : null
  return {
    name: svSprache(feld.name, werte),
    hilfe: svSprache(feld.hilfe, werte),
    frage: frage && {
      vorsatz: svSprache(frage.vorsatz, werte) || null,
      satz: svSprache(frage.satz, werte) || null,
      hinweis: svSprache(frage.hinweis, werte) || null
    }
  }
}

function leer(wert, art) {
  // Eine nicht angehakte Checkbox ist eine Antwort, keine Lücke. Würde sie
  // als fehlend gelten, nörgelte das System über Felder, die korrekt leer
  // sind, und die Warnungen wären nach einer Woche Rauschen.
  if (art === 'checkbox') return false
  // Bei Ja/Nein ist „gar nicht beantwortet" dagegen sehr wohl eine Lücke.
  if (art === 'janein') return wert !== true && wert !== false
  if (wert === null || wert === undefined) return true
  if (art === 'liste' || art === 'mehrfach') return !Array.isArray(wert) || wert.length === 0
  return String(wert).trim() === ''
}

/**
 * Prüft eine Übergabe.
 *
 * Rückgabe: { offen, warnungen, vollstaendig }
 *   offen      Gate-Felder, die fehlen. Solange hier etwas steht, geht die
 *              Übergabe nicht weiter.
 *   warnungen  Felder, deren Fehlen auffällt, aber nichts blockiert.
 */
export function uebergabePruefen(lead, bereich) {
  const offen = []
  const warnungen = []

  for (const feld of maske(bereich)) {
    if (!istSichtbar(feld, lead)) continue
    const s = stufe(feld, lead)
    if (s === 'optional') continue
    if (leer(lead?.[feld.schluessel], feld.art)) {
      const { name, hilfe } = beschriftung(feld, lead)
      ;(s === 'gate' ? offen : warnungen).push({ schluessel: feld.schluessel, name, hilfe })
    }
  }

  return { offen, warnungen, vollstaendig: offen.length === 0 }
}

/** Gate oder Pflicht, für das Sternchen in der Maske. */
export const istGate = (feld, werte) => stufe(feld, werte) === 'gate'

/**
 * Werte außerhalb der erlaubten Spanne.
 *
 * Getrennt von uebergabePruefen(): Ein fehlendes Feld und ein unmögliches
 * Feld sind zwei verschiedene Fehler. „-3 gewünschte Aufträge" ist nicht
 * unvollständig, es ist falsch, und die Bedarfsrechnung lieferte daraus
 * negative Anfragen pro Monat.
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

export const FELDER_UEBERGABE_1 = maske(UEBERGABE_1)
export const FELDER_UEBERGABE_2 = maske(UEBERGABE_2)
