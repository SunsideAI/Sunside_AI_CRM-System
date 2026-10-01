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
         namenspaarBrauchbar }
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

// ── Was aus dem Modell kommt, wird nochmal gesiebt ────────────────────────
// Das Modell soll Unsicheres weglassen, aber darauf allein verlaesst sich
// hier nichts: eine falsche Anrede faellt beim Empfaenger sofort auf.
sagt(brauchbar('Kerstin') === 'Kerstin', 'Ein Name geht durch')
sagt(brauchbar(' Ümit ') === 'Ümit', 'Umlaute und Leerzeichen ringsum')
sagt(brauchbar('von Stosch') === 'von Stosch', 'Namenszusätze bleiben')
sagt(brauchbar('GmbH') === null, '„GmbH" nicht')
sagt(brauchbar('Vertreter') === null, '„Vertreter" nicht')
sagt(brauchbar('unklar') === null, '„unklar" nicht')
sagt(brauchbar('info@firma.de') === null, 'Keine Mailadresse')
sagt(brauchbar('Haus 12') === null, 'Nichts mit Ziffern')
sagt(brauchbar('') === null && brauchbar(null) === null, 'Leer bleibt leer')

// Das Paar zusammen, nicht nur jeder Teil fuer sich. Im ersten echten
// Durchgang am 01.10.2026 schrieb das Modell bei 6 von 25 Leads "WEG" in
// beide Felder - die Abkuerzung stand im Seitentext, und es nahm sie, weil
// kein Name da war. Einzeln sah "WEG" harmlos aus.
sagt(namenspaarBrauchbar('WEG', 'WEG') === null, '„WEG WEG" kommt nicht durch')
sagt(namenspaarBrauchbar('IVD', 'Immobilien') === null, 'Eine Abkürzung als Vorname auch nicht')
sagt(namenspaarBrauchbar('HV', 'Müller') === null, 'Und „HV Müller" nicht')
sagt(namenspaarBrauchbar('Günther', 'Günther') === null,
  'Zweimal dasselbe Wort ist kein Name, sondern eine Partnerfirma')
sagt(namenspaarBrauchbar('Kerstin', 'Petersen')?.nachname === 'Petersen', 'Ein echtes Paar schon')
sagt(namenspaarBrauchbar('Ümit', 'Alagöz')?.vorname === 'Ümit', 'Auch mit Umlaut am Anfang')
sagt(namenspaarBrauchbar('Lars', 'Krüssel')?.nachname === 'Krüssel', 'Und mit Umlaut im Namen')

// ── Der Auftrag an das Modell ─────────────────────────────────────────────
const fn = fs.readFileSync('netlify/functions/ansprechpartner-suchen-background.js', 'utf8')
sagt(/falscher Name ist schlimmer als kein Name/.test(fn),
  'Das Modell weiß: im Zweifel nichts setzen')
sagt(/Webdesigner, Agentur/.test(fn),
  'Und es soll fremde Impressen erkennen (Anneser → Butlerium)')
sagt(/Gründer aus der Firmenhistorie/.test(fn),
  'Und den Gründer von 1982 nicht für die heutige Leitung halten (OMIT AG)')
sagt(/Begriffspaar/.test(fn),
  'Und „Mark Wohnungsgesellschaft" nicht für einen Menschen')
sagt(/Abkürzung \(WEG, IVD, RDM, HV\)/.test(fn),
  'Und keine Abkürzung aus dem Seitentext')

// ── Was die Funktion nicht anfasst ────────────────────────────────────────
sagt(/\.is\('ansprechpartner_vorname', null\)/.test(fn),
  'Ein von Hand gesetzter Name wird nicht überschrieben')
sagt(/ansprechpartner_gesucht_am/.test(fn) && /sonst nimmt sich der naechste Durchgang/.test(fn),
  'Auch Leads ohne Fund werden vermerkt')
sagt(!/anrede:/.test(fn),
  'Die Anrede setzt der Trigger, nicht diese Funktion')
sagt(/istAdmin/.test(fn), 'Nur die Leitung darf den Lauf anstoßen')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Ansprechpartner: aus dem Impressum, und im Zweifel keiner.')
