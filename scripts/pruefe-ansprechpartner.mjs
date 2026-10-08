// Prueft die Impressum-Suche.
//
// Anlass: Von 28.851 kalten Leads trugen am 01.10.2026 nur 1.921 einen
// Ansprechpartner. In allen anderen Mails stand der Firmenname statt eines
// Menschen. Die Namen stehen im Impressum - die Frage war nur, wie man sie
// verlaesslich herausholt.
//
// Jeder Fall hier ist ein Fehlgriff aus den drei Probelaeufen vom 01.10.2026,
// nachgestellt an der Website, an der er auftrat.
//
// Aufruf: node scripts/pruefe-ansprechpartner.mjs

import fs from 'node:fs'
import { zuText, ausschnitt, unterseiten, brauchbar, wirktWieEinName, entschluessleBytes,
         namenspaarBrauchbar, andereFirma, adresse, holeSeiteMitGrund }
  from '../netlify/functions/utils/impressum.js'


const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

// ── Inline-Tags duerfen Namen nicht zerreissen ────────────────────────────
// der-regionalmakler.de setzt den Anfangsbuchstaben in ein <span>. Solange
// jedes Tag einen Zeilenumbruch bedeutete, wurde daraus "T" und
// "homas Mennecke" - der Name war weg.
const zerrissen = '<p>Christian Kurlinkus &amp;<span>T</span>homas Mennecke</p>'
sagt(zuText(zerrissen).includes('Thomas Mennecke'),
  `Inline-Tag zerreißt den Namen nicht: „${zuText(zerrissen).trim()}"`)
// Block-Tags muessen dagegen trennen, sonst klebt alles aneinander.
sagt(zuText('<div>Inhaber:</div><div>Anna Berg</div>').split('\n').filter(Boolean).length === 2,
  'Block-Tags trennen weiterhin')
// Entitaeten und Umlaute: ein Zeichen, nicht zwei (NFC).
const umlaut = zuText('<p>M&uuml;cahit Ya&#x15F;ar</p>').trim()
sagt(umlaut.includes('Mücahit') && umlaut.normalize('NFC') === umlaut,
  `Umlaute aus Entitäten, als ein Zeichen: „${umlaut}"`)

// ── Der Zeichensatz ──────────────────────────────────────────────────────
// immobilienbuero-jakob.de nennt keinen - weder im Kopf noch im HTML - ist
// aber latin-1. Aus "Berufsaufsichtsbehörde" wurde "Berufsaufsichtsbeh\uFFFDrde".
const bytesVon = (text, satz) => satz === 'latin1'
  ? Uint8Array.from([...text].map(z => z.codePointAt(0)))
  : new TextEncoder().encode(text)

sagt(entschluessleBytes(bytesVon('Berufsaufsichtsbehörde', 'latin1'), 'text/html')
       === 'Berufsaufsichtsbehörde',
  'Ohne Angabe wird latin-1 erkannt, nicht als UTF-8 verstümmelt')
sagt(entschluessleBytes(bytesVon('Persönlich', 'utf8'), 'text/html; charset=utf-8')
       === 'Persönlich',
  'Und sauberes UTF-8 bleibt UTF-8')
// Eine falsche Angabe darf nicht schlagen, wenn die Bytes es widerlegen.
sagt(entschluessleBytes(bytesVon('Persönlich', 'utf8'), 'text/html; charset=iso-8859-1')
       === 'Persönlich',
  'Eine falsche Angabe im Kopf wird übergangen')
// Ein Zeichensatz, den die Laufzeit nicht kennt, darf nichts verschlucken.
sagt(entschluessleBytes(bytesVon('Nicole Ehret', 'utf8'), 'text/html; charset=cp-unbekannt')
       === 'Nicole Ehret',
  'Ein unbekannter Zeichensatz wirft die Seite nicht weg')

// ── Ein Personenname, kein Begriffspaar ───────────────────────────────────
// Davon haengt ab, ob eine Stelle als Fund gilt und die Suche aufhoert.
// Jeder Fall unten ist aus einem Probelauf: links der Text, rechts ob ein
// Name drinsteht.
const NAMENSFAELLE = [
  // Sieht aus wie ein Name, ist keiner.
  ['Blankeneser Bahnhofstraße 8', false],            // eine Straße
  ['Ansprechpartner Immobilienverwaltung', false],   // eine Menüzeile (priveg.de)
  ['MEISSLER & CO Verwaltungs GmbH', false],         // eine Firma
  ['Zuständige Aufsichtsbehörde', false],
  ['Zuständige Industrie- und Handelskammer', false],
  ['Handelskammer Bremen', false],
  ['Gesetzlicher Vertreter:', false],                // die Zeile ohne den Namen
  ['Mark Wohnungsgesellschaft', false],              // der Fehlgriff aus Lauf 1
  ['Rechtliche Angaben', false],
  ['ALLE GROSS HIER', false],
  // Ist einer.
  ['Kerstin Petersen', true],
  ['Götz M. Fluck', true],                           // mit Initial in der Mitte
  ['Rainer M. Körbel', true],
  ['Claudia Glaser-Zormann', true],                  // Doppelname
  ['Patrick Florian von Stosch', true],              // Namenszusatz
  ['Ute Gräfin von Ballestrem', true],
  ['Jörg-Michael Meyer', true],
  ['Werner Höbel', true],
  // Buchstaben ausserhalb der deutschen Umlaute. In JavaScript ist \b
  // ASCII-basiert, darum stand vor einem "Ü" keine Wortgrenze und der Name
  // fiel durch - jeder Name, der mit einem Umlaut beginnt, war betroffen.
  ['Ümit Alagöz', true],
  ['Mücahit Yaşar', true],
]
let namensfehler = 0
for (const [text, soll] of NAMENSFAELLE) {
  const ist = wirktWieEinName(text) !== null
  if (ist !== soll) { namensfehler++; console.log(`    ✗ „${text}" → ${ist ? 'Name' : 'kein Name'}`) }
}
sagt(namensfehler === 0, `${NAMENSFAELLE.length} Fälle: Personenname von Begriffspaar unterschieden`)

// ── Die Überschrift zählt erst, wenn sonst nichts da ist ─────────────────
// Viele Impressen nennen Namen und Anschrift direkt unter „Impressum", ohne
// Einleitung: bei rudert-immobilien.de steht „Johannes Rudert Immobilien" in
// der Zeile darunter, und das erste starke Signalwort kam erst neun Zeilen
// später - im Pflichttext, der nie einen Namen enthält.
const unterUeberschrift = ausschnitt(['Impressum', 'Johannes Rudert Immobilien',
  'Lehderstr. 54, 13086 Berlin', 'Telefon: +49 174 9542360',
  'Haftung für Inhalte:', 'Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene '
  + 'Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.'].join('\n'))
sagt(unterUeberschrift.text.includes('Johannes Rudert') && unterUeberschrift.vielversprechend,
  'Der Name direkt unter „Impressum" wird gefunden')
sagt(!unterUeberschrift.text.startsWith('Als Diensteanbieter'),
  'Und der Pflichttext zieht den Ausschnitt nicht an sich')

// Umgekehrt darf die Überschrift die ausdrückliche Angabe nicht verdrängen.
// Bei sinnfalt-immobilien.de stand unter „Impressum" nur die Firma, der Name
// sechs Zeilen weiter.
const ausdruecklich = ausschnitt(['Impressum', 'Sinnfalt GmbH', 'Staufener Str. 25',
  '79189 Bad Krozingen', 'Handelsregister: HRB717343',
  'Vertreten durch:', 'Frau Nicole Ehret', 'Kontakt'].join('\n'))
sagt(ausdruecklich.text.startsWith('Vertreten durch'),
  '„Vertreten durch" schlägt die bloße Überschrift')

// Zusammengesetzte Formen: optin.at schreibt „Geschäftsinhaber", und davor
// steht keine Wortgrenze.
const zusammengesetzt = ausschnitt(['Unternehmensgegenstand: Immobilientreuhänder',
  'Geschäftsinhaber: Mag. David Breitwieser, Mag. Alexander Fenzl',
  'Wirtschaftskammer Wien'].join('\n'))
sagt(zusammengesetzt.text.includes('Breitwieser') && zusammengesetzt.vielversprechend,
  '„Geschäftsinhaber" zählt wie „Inhaber"')

// Navigationswörter sind keine Namen. „Zum Inhalt" aus „Zum Inhalt springen"
// liess die Navigationsleiste als Fundstelle gewinnen.
const NAVIGATION = ['Zum Inhalt springen', 'Unsere Dienstleistungen', 'Herzlich Willkommen',
                    'Alle Objekte', 'Ihre Ansprechpartnerin', 'Neue Wege']
let navfehler = 0
for (const t of NAVIGATION) if (wirktWieEinName(t)) { navfehler++; console.log(`    ✗ „${t}"`) }
sagt(navfehler === 0, `${NAVIGATION.length} Navigationszeilen gelten nicht als Name`)

// ── Die Signalstelle, nicht die erste ─────────────────────────────────────
// priveg.de hat "Ansprechpartner Immobilienverwaltung" im Menü. Der erste
// Treffer war also die Navigationsleiste - und der Ausschnitt begann dort.
const menue = ['Ansprechpartner Immobilienverwaltung', 'Ansprechpartner Logendienste',
               'KONTAKT', 'Menü', 'Startseite',
               'Vertreten durch den Geschäftsführer', 'Götz M. Fluck',
               'Tel: 030 844 14 94 0'].join('\n')
const a = ausschnitt(menue)
sagt(a.text.startsWith('Vertreten durch'),
  `Der Ausschnitt beginnt an der richtigen Stelle: „${a.text.slice(0, 48)}…"`)
sagt(a.text.includes('Götz M. Fluck'), 'Und der Name steht darin')


// ── Die Unterseiten ───────────────────────────────────────────────────────
const seite = `<a href="index.html">Herzlich Willkommen</a>
  <a href="/kontakt">Kontakt</a>
  <a href="impressum.html">Impressum</a>
  <a href="https://www.facebook.com/sharer.php">teilen</a>`
const ziele = unterseiten(seite, 'https://www.beispiel.de/')
sagt(/impressum/.test(ziele[0]), `Impressum zuerst: ${ziele[0]}`)
sagt(ziele.some(z => /kontakt/.test(z)), 'Kontakt als zweite Quelle')
sagt(!ziele.some(z => /facebook/.test(z)), 'Kein Weiterklicken zu Facebook')
sagt(ziele.every(z => z.startsWith('https://www.beispiel.de/')),
  'Relative Links werden zur vollen Adresse')

/* Das alte Muster verlangte doppelte Anfuehrungszeichen und hoechstens 120
   Zeichen Beschriftung. bremerich-immobilien.de schreibt href='...' - in
   WordPress-Themes verbreitet -, und bei expo-immo.de steckt so viel
   Markup in der Beschriftung, dass 120 Zeichen nicht reichten. In einer
   Stichprobe von 140 leeren Leads blieb dadurch bei 11 das Impressum
   unentdeckt, obwohl es verlinkt war - darunter Gerhard Bremerich und
   Peer-Oliver Puelm. */
const einfach = unterseiten(
  `<a href='https://www.beispiel.de/impressum/' title='Impressum'>Impressum</a>`,
  'https://www.beispiel.de/')
sagt(einfach.some(z => /impressum/.test(z)), "Ein href='...' zaehlt genauso")

const langeBeschriftung = unterseiten(
  `<a href="/impressum" class="x"><span class="${'y'.repeat(200)}">Impressum</span></a>`,
  'https://www.beispiel.de/')
sagt(langeBeschriftung.some(z => /impressum/.test(z)),
  'Und viel Markup in der Beschriftung verdeckt den Link nicht')

sagt(unterseiten('<a href="/impressum#oben">Impressum</a>', 'https://www.beispiel.de/')[0]
       === 'https://www.beispiel.de/impressum',
  'Ein Sprungziel am Ende der Adresse wird abgeschnitten')
sagt(!unterseiten('<a href="javascript:void(0)">Impressum</a>', 'https://www.beispiel.de/').length
     && !unterseiten('<a href="mailto:a@b.de">Kontakt</a>', 'https://www.beispiel.de/').length,
  'Und javascript: oder mailto: ist keine Seite')

/* Ein kaputter Link darf die Gruppe nicht beenden - vorher brach die
   Schleife nach dem ersten Treffer ab, auch wenn er unbrauchbar war. */
sagt(unterseiten('<a href="http://[/impressum">Impressum</a>'
                 + '<a href="/impressum/">Impressum</a>', 'https://www.beispiel.de/')
       .some(z => z === 'https://www.beispiel.de/impressum/'),
  'Nach einem kaputten Link wird weitergesucht')
sagt(unterseiten('<a href="ftp://x/impressum">Impressum</a>'
                 + '<a href="/impressum/">Impressum</a>', 'https://www.beispiel.de/')
       .some(z => z === 'https://www.beispiel.de/impressum/'),
  'Und nach einem, der nicht ins Web zeigt, auch')

// ── Die Lead-Adresse ──────────────────────────────────────────────────────
/* 44 Leads tragen als Website eine Google-Umleitung aus einem Suchergebnis.
   Die wurde nie geholt, weil ihr das Schema fehlt - das Ziel steht aber im
   Parameter. */
sagt(adresse('/url?q=http://www.immobilien-aalen.de/&opi=79508299&sa=U')
       === 'http://www.immobilien-aalen.de/',
  'Eine Google-Umleitung wird auf ihr Ziel zurueckgefuehrt')
sagt(adresse('www.foo.de') === 'https://www.foo.de', 'Ohne Schema wird https ergaenzt')
sagt(adresse('') === null && adresse(null) === null, 'Und nichts bleibt nichts')

// ── Was aus dem Modell kommt, wird nochmal gesiebt ────────────────────────
// Das Modell soll Unsicheres weglassen, aber darauf allein verlaesst sich
// hier nichts: eine falsche Anrede faellt beim Empfaenger sofort auf.
sagt(brauchbar('Kerstin') === 'Kerstin', 'Ein Name geht durch')
sagt(brauchbar(' Ümit ') === 'Ümit', 'Umlaute und Leerzeichen ringsum')
sagt(brauchbar('von Stosch') === 'von Stosch', 'Namenszusätze bleiben')
sagt(brauchbar('GmbH') === null, '„GmbH" nicht')
sagt(brauchbar('WEG') === null, '„WEG" ist keine Abkuerzung, die durchgeht')
/* Ein Branchenwort ist weder Vor- noch Nachname. Das Modell zerlegte am
   04.10.2026 sechs Firmennamen und schrieb den zweiten Teil ins
   Nachnamensfeld; die Rechtsform-Regel traf nicht, weil keine dabeistand. */
sagt(brauchbar('Immobilien') === null, '„Immobilien" ist kein Name')
/* Die Liste kannte „gutachter", also den Menschen, nicht aber „gutachten",
   also die Sache - und genau die steht im Firmennamen: „Kammler Gutachten"
   stand am 05.10.2026 als Name im Bestand, ebenso „Die Gutachterin". */
sagt(brauchbar('Gutachten') === null && brauchbar('Gutachterin') === null,
  '„Gutachten" und „Gutachterin" sind keine Nachnamen')
sagt(brauchbar('Sachverständige') === null && brauchbar('Bewertungen') === null,
  'Und „Sachverständige" oder „Bewertungen" auch nicht')
/* Echte Namen mit demselben Anfang bleiben: Gutacker, Guttenberg, Gutmann. */
sagt(['Gutacker', 'Guttenberg', 'Gutmann', 'Sacher'].every(n => brauchbar(n) === n),
  'Namen, die ähnlich anfangen, bleiben unberührt')
sagt(brauchbar('Immobilien Management') === null, 'Auch nicht als zweites Wort')
sagt(brauchbar('Hausverwaltung') === null && brauchbar('Immobilienservice') === null,
  'Und Komposita darauf auch nicht')
sagt(brauchbar('Neuenschwander') === 'Neuenschwander',
  'Ein langer Nachname bleibt davon unberuehrt')

/* Das Modell soll den Eintrag weglassen, wenn es nichts findet. Bei „s REAL
   Immobilien Braunau" schrieb es stattdessen „Nicht angegeben" ins
   Vornamensfeld. */
/* Ein Titel vor dem Namen wird abgeschnitten, nicht verworfen. Der Filter
   erkannte ihn bisher nur allein im Feld: „Dr." fiel durch, „Dr. Armin" ging
   als Vorname durch - und die Mail gruesste „Hallo Dr. Armin Hartmann". */
sagt(brauchbar('Dr. Armin') === 'Armin', 'Ein Titel vor dem Namen fällt we