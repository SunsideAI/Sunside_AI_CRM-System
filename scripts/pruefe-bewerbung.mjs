// Prueft, dass sich im Setting niemand mehr bewirbt.
//
// Entscheidung vom 25.09.: Ein Beratungsgespraech im Pool nimmt sich der
// Setter, der Zeit hat. Beworben wird sich nur noch auf Abschlussgespraeche,
// dort entscheidet die Leitung. Frueher hing beides am selben Schalter, und
// weil er fuer das Setting auf "an" stand, wurde aus jedem "Uebernehmen" eine
// Bewerbung, die niemand erwartete.
//
// Aufruf: node scripts/pruefe-bewerbung.mjs

import fs from 'node:fs'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const server = fs.readFileSync('netlify/functions/hot-lead-applications.js', 'utf8')
sagt(/stufe !== STUFE\.SETTER/.test(server),
  'Der Server fragt den Schalter nur noch fuer das Closing')
sagt(!/bewerbung_pflicht_setter/.test(server),
  'Kein Schalter mehr fuer das Setting')

const einstellungen = fs.readFileSync('netlify/functions/einstellungen.js', 'utf8')
sagt(!/bewerbung_pflicht_setter:/.test(einstellungen),
  'Die Einstellungen kennen den Schalter nicht mehr')
sagt(/bewerbung_pflicht_closer:/.test(einstellungen),
  'Fuer das Closing bleibt er')

const oberflaeche = fs.readFileSync('src/components/VertriebsEinstellungen.jsx', 'utf8')
sagt(!/bewerbung_pflicht_setter/.test(oberflaeche),
  'Die Einstellungsseite zeigt ihn nicht mehr an')

const verwaltung = fs.readFileSync('src/components/HotLeadBewerbungenVerwaltung.jsx', 'utf8')
sagt(!/stufeFilter/.test(verwaltung), 'Die Verwaltung hat keinen Stufen-Umschalter mehr')
sagt(/=== 'Closer'\)/.test(verwaltung), 'Die Verwaltung zeigt nur Abschlussgespraeche')

const pool = fs.readFileSync('src/components/SetterPool.jsx', 'utf8')
sagt(/text: 'Übernehmen'/.test(pool), 'Im Setter-Pool steht „Übernehmen"')
sagt(!/Bewerben/.test(pool), 'Im Setter-Pool steht nirgends „Bewerben"')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Bewerbung: nur noch im Closing.')
