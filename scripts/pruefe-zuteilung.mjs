// Prueft, wer sich am Hot Lead in eine Rolle eintragen darf.
//
// Anlass: Beim Buchen eines Termins soll "Ich halte das Beratungsgespraech
// selbst" nur erscheinen, wer die Rolle dafuer hat - und der Server muss
// dasselbe noch einmal pruefen, denn das Haekchen ist nur Oberflaeche. Ein
// Versuch mit dem Admin-Konto belegt dabei nichts: Admins duerfen zuteilen.
// Also wird die Regel hier direkt befragt, Rolle fuer Rolle.
//
// Aufruf: node scripts/pruefe-zuteilung.mjs

import fs from 'node:fs'
import { zuteilungErlaubt } from '../netlify/functions/utils/zugriff.js'

const ICH = '11111111-1111-1111-1111-111111111111'
const ANDERER = '22222222-2222-2222-2222-222222222222'

const nutzer = (rollen, name = 'Ich Selbst') => ({
  id: ICH, name, rollen,
  istAdmin: rollen.includes('Admin') || rollen.includes('Geschäftsführer')
})

const COLDCALLER = nutzer(['Coldcaller'])
const SETTER = nutzer(['Setter'])
const CLOSER = nutzer(['Closer'])
const SETTER_CLOSER = nutzer(['Setter', 'Closer'])
const OPENER_SETTER = nutzer(['Coldcaller', 'Setter'])
const ADMIN = nutzer(['Admin'])
const CHEF = nutzer(['Geschäftsführer'])

// [Beschreibung, Nutzer, Feld, Wert, erwartet]
const FAELLE = [
  // Sich selbst als Setter eintragen - nur mit Setter-Rolle
  ['Coldcaller traegt sich als Setter ein', COLDCALLER, 'setterId', { id: ICH }, false],
  ['Opener+Setter traegt sich als Setter ein', OPENER_SETTER, 'setterId', { id: ICH }, true],
  ['Setter traegt sich als Setter ein', SETTER, 'setterId', { id: ICH }, true],
  ['Closer traegt sich als Setter ein', CLOSER, 'setterId', { id: ICH }, false],

  // Sich selbst als Closer eintragen - nur mit Closer-Rolle
  ['Setter traegt sich als Closer ein', SETTER, 'closerId', { id: ICH }, false],
  ['Setter+Closer traegt sich als Closer ein', SETTER_CLOSER, 'closerId', { id: ICH }, true],
  ['Closer traegt sich als Closer ein', CLOSER, 'closerId', { id: ICH }, true],
  ['Coldcaller traegt sich als Closer ein', COLDCALLER, 'closerId', { id: ICH }, false],

  // Fremde Namen bleiben dem Bewerbungsweg vorbehalten
  ['Closer traegt fremden Closer ein', CLOSER, 'closerId', { id: ANDERER }, false],
  ['Setter+Closer traegt fremden Closer ein', SETTER_CLOSER, 'closerId', { id: ANDERER }, false],
  ['Setter traegt fremden Setter ein', SETTER, 'setterId', { id: ANDERER }, false],
  ['Closer traegt fremden Closer per Name ein', CLOSER, 'closerId', { name: 'Fremder Kollege' }, false],
  ['Closer traegt sich per Name ein', CLOSER, 'closerId', { name: 'Ich Selbst' }, true],

  // Opener und Reaktivierung vergibt nur die Leitung
  ['Setter+Closer traegt sich als Opener ein', SETTER_CLOSER, 'openerId', { id: ICH }, false],
  ['Closer traegt sich als Reaktivierer ein', CLOSER, 'reaktivierungBearbeiterId', { id: ICH }, false],

  // Abgeben ist kein Zuteilen
  ['Closer gibt den Closer frei (null)', CLOSER, 'closerId', { id: null }, true],
  ['Setter gibt den Setter frei (leerer Name)', SETTER, 'setterId', { name: '' }, true],
  ['Coldcaller gibt den Opener frei (null)', COLDCALLER, 'openerId', { id: null }, true],

  // Die Leitung teilt zu
  ['Admin traegt fremden Closer ein', ADMIN, 'closerId', { id: ANDERER }, true],
  ['Admin traegt fremden Opener ein', ADMIN, 'openerId', { id: ANDERER }, true],
  ['Geschaeftsfuehrer traegt fremden Closer ein', CHEF, 'closerId', { id: ANDERER }, true]
]

const befunde = []
for (const [was, wer, feld, wert, erwartet] of FAELLE) {
  const ist = zuteilungErlaubt(feld, wert, wer)
  const ok = ist === erwartet
  console.log(`  ${ok ? '✓' : '✗'} ${was}: ${ist ? 'erlaubt' : 'abgewiesen'}`)
  if (!ok) befunde.push(`${was}: erwartet ${erwartet ? 'erlaubt' : 'abgewiesen'}, ist ${ist ? 'erlaubt' : 'abgewiesen'}`)
}

// Die Regel hilft nur, wenn die Function sie auch benutzt: keine eigene
// Kopie der Logik mehr in hot-leads.js.
const quelle = fs.readFileSync('netlify/functions/hot-leads.js', 'utf8')
const stellen = (quelle.match(/zuteilungErlaubt\(/g) || []).length
if (stellen < 3) {
  befunde.push(`hot-leads.js ruft zuteilungErlaubt nur ${stellen}x auf (erwartet: Buchen Closer, Buchen Setter, Bearbeiten)`)
}
if (/selbstErlaubt|setztSichSelbst|selbstCloser/.test(quelle)) {
  befunde.push('hot-leads.js hat noch eine eigene Kopie der Regel (selbstErlaubt/setztSichSelbst/selbstCloser)')
}

console.log(`\n${FAELLE.length} Faelle geprueft, ${stellen} Aufrufstellen in hot-leads.js.`)
if (befunde.length) {
  console.error('\nFEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
const sagt = (ok, text) => {
  console.log(`  ${ok ? '✓' : '✗'} ${text}`)
  if (!ok) befunde.push(text)
}

// ── Die Leitung kann eine Zuteilung richtigstellen ───────────────────────
//
// Zugeteilt wird über den Bewerbungsweg. Für den Ausnahmefall - jemand fällt
// aus, kündigt oder wurde versehentlich eingetragen - fehlte der Griff: Die
// Leitung musste den Kontakt erst freigeben und hoffen, dass sich der
// Richtige bewirbt.
const server = fs.readFileSync('netlify/functions/hot-leads.js', 'utf8')
sagt(/'openerName': 'opener_id'/.test(server), 'Der Opener lässt sich über den Namen setzen')
sagt(/key === 'openerName'/.test(server), 'Und wird zur Benutzer-ID aufgelöst')

// Verbindlich bleibt die Prüfung im Server: Fremde Zuteilungen darf nur die
// Leitung setzen, und openerId steht in derselben Schleife wie closerId.
sagt(/for \(const feld of \['closerId', 'setterId', 'openerId', 'reaktivierungBearbeiterId'\]\)/.test(server),
  'Alle drei Zuteilungen laufen durch dieselbe Prüfung')

const schublade = fs.readFileSync('src/components/LeadSchublade.jsx', 'utf8')
sagt(/bearbeitbar = false/.test(schublade),
  'Die Rollen-Anzeige ist nur auf Wunsch bearbeitbar')
sagt(/istLeitung\(u\.rolle\) \|\| passt\(u\.rolle\)/.test(schublade),
  'Zur Wahl stehen die, die die Rolle tragen - und die Leitung')
sagt(/wert && !infrage\.some\(u => u\.vor_nachname === wert\)/.test(schublade),
  'Wer eingetragen ist, verschwindet nicht aus der Liste')

for (const [datei, seite] of [['src/pages/Closing.jsx', 'Closing'], ['src/pages/Setting.jsx', 'Setting']]) {
  const inhalt = fs.readFileSync(datei, 'utf8')
  sagt(/bearbeitbar[=:] ?(\{)?(Boolean\()?(editMode|bearbeiten) && isAdmin\(\)/.test(inhalt),
    `${seite}: nur die Leitung sieht die Auswahl`)
  sagt(/\['openerName', 'setterName', 'closerName'\]/.test(inhalt),
    `${seite}: alle drei Zuteilungen werden mitgespeichert`)
}

/* Ein Termin um 10:00 fiel um 10:01 aus dem Pool, obwohl ihn noch niemand
   uebernommen hatte - gemeldet am 09.10.2026. Wer das Gespraech gerade fuehrt
   oder nachtraegt, muss den Kontakt noch finden. */
const sp = fs.readFileSync('src/components/SetterPool.jsx', 'utf8')
sagt(/export function imPoolSichtbar/.test(sp),
  'Eine Stelle entscheidet, was im Pool steht')
sagt(/NACHLAUF_STUNDEN = 24/.test(sp),
  'Ein vorbeier Termin bleibt einen Tag lang übernehmbar')
sagt(/Termin ist vorbei/.test(sp),
  'Und ist als vorbei gekennzeichnet')
sagt(/filter\(imPoolSichtbar\)/.test(fs.readFileSync('src/pages/Setting.jsx', 'utf8')),
  'Der Zähler im Umschalter fragt dasselbe wie die Liste')

if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Zuteilung: alles wie erwartet.')
