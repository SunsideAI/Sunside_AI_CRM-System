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
console.log('Zuteilung: alles wie erwartet.')
