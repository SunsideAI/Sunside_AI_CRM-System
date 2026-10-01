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
const engine = fs.readFileSync('netlify/functions/anrede-nachtragen.js', 'utf8')
sagt(/kommtInFrage/.test(engine), 'Die Engine siebt Firmen und Floskeln aus')
sagt(/unklar/.test(engine) && /falsche Anrede ist schlimmer/.test(engine),
  'Und weist das Modell an, im Zweifel nichts zu setzen')

// ── Die Position in der Signatur ────────────────────────────────────────────
// Gewuenscht am 01.10.2026: unter dem Namen steht die Position. Gruender sind
// Paul Probodziak und Niklas Schwerin, alle anderen KI-Entwickler.
const { positionFuer, signaturHtml } = await import('../shared/signatur.js')

sagt(positionFuer('Paul Probodziak') === 'Gründer', 'Paul ist Gründer')
sagt(positionFuer('Niklas Schwerin') === 'Gründer', 'Niklas ist Gründer')
sagt(positionFuer('Max Lehmann') === 'KI-Entwickler', 'Alle anderen sind KI-Entwickler')
// Der Name kommt aus dem Benutzerprofil - dort steht schon mal ein Leerzeichen zu viel.
sagt(positionFuer('  paul   probodziak ') === 'Gründer', 'Schreibweise und Leerzeichen egal')

const sig = signaturHtml({ name: 'Max Lehmann', email: 'a@b.de', telefon: '+49 1' })
sagt(sig.includes('>KI-Entwickler<'), 'Die Position steht in der Signatur')
sagt(sig.indexOf('Max Lehmann') < sig.indexOf('>KI-Entwickler<'), 'Und zwar unter dem Namen')
// Auch wenn die Mail schon mit eigenem Gruss schliesst, darf sie nicht fehlen.
sagt(signaturHtml({ name: 'Max Lehmann', eigenerGruss: true }).includes('>KI-Entwickler<'),
  'Auch bei eigenem Gruß in der Mail')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Anrede: richtig oder gar nicht, nie geraten.')
