// Prueft die Anrede in den Mailvorlagen.
//
// Anlass: Bis zum 01.10.2026 stand in jeder Mail woertlich „Herr/Frau Berg" -
// der Absender sollte es beim Durchlesen richtigstellen. Das passierte nicht
// immer. Seitdem traegt jeder Kontakt ein Feld `anrede`, aus dem Vornamen
// bestimmt.
//
// Die Regel, auf die es ankommt: Geraten wird nicht. Wo das Geschlecht unklar
// ist - Unisex-Namen, Doppelnennungen, Firmen im Namensfeld -, gruesst die
// Mail mit vollem Namen. Eine falsche Anrede faellt beim Empfaenger sofort auf,
// eine neutrale nicht.
//
// Aufruf: node scripts/pruefe-anrede.mjs

import fs from 'node:fs'
import { platzhalterWerte } from '../shared/mailvorlagen.js'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const anrede = (lead, schluessel = null) =>
  platzhalterWerte({ lead, absender: 'Paul Probodziak', schluessel })['Anrede']

const mann  = { ansprechpartner_vorname: 'Wilfried', ansprechpartner_nachname: 'Hettich', anrede: 'Herr' }
const frau  = { ansprechpartner_vorname: 'Anna',     ansprechpartner_nachname: 'Berg',    anrede: 'Frau' }
const offen = { ansprechpartner_vorname: 'Dominique', ansprechpartner_nachname: 'Stork',  anrede: null }

sagt(anrede(mann) === 'Hallo Herr Hettich', `Mann: „${anrede(mann)}"`)
sagt(anrede(frau) === 'Hallo Frau Berg',    `Frau: „${anrede(frau)}"`)

// Der Kern: bei unbekanntem Geschlecht kein Rateversuch.
const o = anrede(offen)
sagt(o === 'Hallo Dominique Stork', `Unklar: „${o}"`)
sagt(!/Herr|Frau/.test(o), 'Und keine geratene Anrede darin')

// Der Abschiedsbrief gruesst foermlicher - das war schon vorher so.
sagt(anrede(frau, 'nachfass_abschied') === 'Guten Tag Frau Berg',
  `Abschied: „${anrede(frau, 'nachfass_abschied')}"`)

// Ohne Namen bleibt der Platzhalter stehen, damit der Mail-Dialog blockiert.
sagt(anrede({ ansprechpartner_vorname: '', ansprechpartner_nachname: '' }) == null,
  'Ohne Namen bleibt der Platzhalter stehen')

// Der Platzhalter fuer die Vorlagen in der Datenbank: Anrede und Name ohne
// Gruss, weil die Vorlage ihren eigenen mitbringt.
const kurz = (lead) => platzhalterWerte({ lead, absender: 'Paul' })['Anrede Nachname']
sagt(kurz(mann) === 'Herr Hettich', `Kurzform Mann: „${kurz(mann)}"`)
sagt(kurz(frau) === 'Frau Berg',    `Kurzform Frau: „${kurz(frau)}"`)
sagt(kurz(offen) === 'Dominique Stork', `Kurzform unklar: „${kurz(offen)}"`)

// Das alte „Herr/Frau" darf nirgends mehr im Code stehen.
const vorlagen = fs.readFileSync('shared/mailvorlagen.js', 'utf8')
sagt(!/Herr\/Frau \$\{/.test(vorlagen) && !/'Herr\/Frau'/.test(vorlagen),
  'Kein wörtliches „Herr/Frau" mehr in den Vorlagen')

// Die Schnittstelle muss das Feld mitgeben, sonst kennt die Vorlage es nicht.
const server = fs.readFileSync('netlify/functions/hot-leads.js', 'utf8')
sagt(/anrede: record\.anrede/.test(server), 'Die Schnittstelle reicht die Anrede durch')
sagt(/'anrede': 'anrede'/.test(server), 'Und sie lässt sich von Hand korrigieren')

// Die Nachtrag-Funktion fragt die KI nur fuer echte Vornamen.
const engine = fs.readFileSync('netlify/functions/anrede-nachtragen-background.js', 'utf8')
sagt(/kommtInFrage/.test(engine), 'Die Engine siebt Firmen und Floskeln aus')
sagt(/unklar/.test(fs.readFileSync('netlify/functions/utils/anrede-auftrag.js', 'utf8'))
     && /falsche Anrede f(ä|ae)llt beim Empf(ä|ae)nger sofort auf/
          .test(fs.readFileSync('netlify/functions/utils/anrede-auftrag.js', 'utf8')),
  'Und weist das Modell an, im Zweifel nichts zu setzen')
// Supabase gibt ohne Zutun hoechstens 1.000 Zeilen zurueck. Solange die
// Tabelle 1.670 Namen trug, fiel das nicht auf; seit der Impressum-Suche sind
// es 13.730. Dazu fragte die Abfrage nur nach „keine Anrede" - das trifft auch
// die 23.000 Leads ganz ohne Namen, und die ersten tausend Zeilen waren damit
// fast alle leer.
sagt(/\.range\(von, von \+ 999\)/.test(engine), 'Die Engine holt alle Zeilen, nicht die ersten tausend')
sagt(/\.not\('ansprechpartner_vorname', 'is', null\)/.test(engine),
  'Und fragt nur nach Leads, die überhaupt einen Namen tragen')

// ── Die Signatur ──────────────────────────────────────────────────────────
// Stand vom 01.10.2026: 1:1 wie die Signatur im Postfach. Verglichen wurde
// gegen den MIME-Quelltext einer echten Mail.
const { positionFuer, signaturHtml } = await import('../shared/signatur.js')
const FIRMENZEILE = 'KI-Entwicklung für Immobilienmakler'

sagt(positionFuer('Paul Probodziak') === 'Gründer', 'Paul ist Gründer')
sagt(positionFuer('Niklas Schwerin') === 'Gründer', 'Niklas ist Gründer')
sagt(positionFuer('Max Lehmann') === FIRMENZEILE, 'Bei allen anderen steht die Firmenzeile')
sagt(positionFuer('  paul   probodziak ') === 'Gründer', 'Schreibweise und Leerzeichen egal')

const sig = signaturHtml({ name: 'Paul Probodziak', email: 'contact@sunsideai.de',
                           telefon: '+49 176 43943026' })

// Die Position steht in derselben Schrift wie der Rest - nicht grau.
sagt(!/color: #666[^>]*>(Gründer|KI-Entwicklung)/.test(sig),
  'Die Position steht in Schwarz, nicht in Grau')
// Genau eine Leerzeile zwischen Gruß und Name.
sagt(/Mit freundlichen Grüßen<\/div>\s*<div[^>]*>&nbsp;<\/div>\s*<div[^>]*><strong>/.test(sig),
  'Eine Leerzeile zwischen Gruß und Name')
// Und eine davor, damit der Gruß nicht am Mailtext klebt.
sagt(/^\s*<div[^>]*>\s*<div[^>]*>&nbsp;<\/div>\s*<div[^>]*>Mit freundlichen Grüßen/.test(sig),
  'Eine Leerzeile zwischen Mailtext und Gruß')
// Bei eigenem Gruß steht die Position direkt unter dem Namen aus dem Text -
// dort waere eine Leerzeile falsch.
const eigen = signaturHtml({ name: 'Paul Probodziak', eigenerGruss: true })
sagt(/^\s*<div[^>]*>\s*<div[^>]*>Gründer<\/div>/.test(eigen),
  'Bei eigenem Gruß keine Leerzeile vor der Position')
// Das Trennzeichen der Adresszeile ist ein grosses I, so wie im Postfach.
sagt(sig.includes('Braunschweig I&nbsp;Deutschland'), 'Adresse mit „I" getrennt')
// Die Links der Fusszeile sind schwarz, nicht in der Hausfarbe.
sagt((sig.match(/color: rgb\(0, 0, 0\);/g) || []).length >= 4, 'Die Links sind schwarz')
sagt(!/color: #460E74/.test(sig), 'Kein Lila mehr in der Signatur')
// Der Terminlink zeigt auf die eigene Seite, nicht auf einen Anker.
sagt(sig.includes('sunsideai.de/jetzt-termin-buchen'), 'Terminlink wie im Postfach')
// Die Abzeichen sind verlinkt und haben die Groessen aus dem Postfach.
sagt(sig.includes('coursera.org/share') && sig.includes('credly.com/badges'),
  'Die Abzeichen sind verlinkt')
sagt(/width="189" height="41"/.test(sig), 'Logo in der Größe aus dem Postfach')
sagt(/width="28" height="28"/.test(sig), 'Symbole in der Größe aus dem Postfach')
// Beim Gruender faellt die Firmenzeile weg.
sagt(!sig.includes(FIRMENZEILE), 'Beim Gründer keine Firmenzeile')
sagt(signaturHtml({ name: 'Max Lehmann' }).includes(FIRMENZEILE),
  'Bei allen anderen steht sie dort')

// ── Der Auftrag an das Modell, das das Geschlecht zuordnet ───────────────
/* Der alte Auftrag sagte dreimal „im Zweifel unklar" und nannte kein
   Gegenbeispiel. Das Modell nahm das woertlich: von 870 Leads ohne Anrede
   blieben nach einem Lauf 740 uebrig, darunter Jannik, Francesco, Dominic,
   Helge, Frauke und Friederike - in Deutschland alle sechs eindeutig. */
const auftrag = fs.readFileSync('netlify/functions/utils/anrede-auftrag.js', 'utf8')
const fn = fs.readFileSync('netlify/functions/anrede-nachtragen-background.js', 'utf8')
sagt(/content: ANREDE_AUFTRAG/.test(fn),
  'Die Funktion nimmt den gemeinsamen Auftrag, keinen eigenen Prompt')
sagt(/content: ANREDE_AUFTRAG/.test(
       fs.readFileSync('netlify/functions/ansprechpartner-diagnose.js', 'utf8')),
  'Und die Diagnose fragt mit genau demselben')
sagt(/Nenne JEDEN Namen in der Antwort/.test(auftrag),
  'Das Modell antwortet zu jedem Namen, auch den unklaren')
sagt(/Jannik, Niko, Helge/.test(auftrag) && /Frauke, Friederike/.test(auftrag),
  'Die sechs uebersehenen Namen stehen als Gegenbeispiel darin')
sagt(/regelm(ä|ae)ßig f(ü|ue)r Frauen UND M(ä|ae)nner/.test(auftrag),
  '„unklar" ist auf echte Doppelnamen begrenzt')
sagt(/Kim/.test(auftrag) && /Dominique/.test(auftrag) && /Toni/.test(auftrag),
  'Und die Doppelnamen sind benannt (Kim, Dominique, Toni)')
/* Mit .range(0, 9999) war bei 10.000 bekannten Namen Schluss, und alles
   darueber galt als unbekannt - bezahlt haette das Modell. */
sagt(/bekannteVornamen\(\)/.test(fn) && /von \+= 1000/.test(fn),
  'Die bekannten Vornamen werden paginiert geladen')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Anrede: richtig oder gar nicht, nie geraten.')
