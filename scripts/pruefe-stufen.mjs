// Prueft, dass Setting und Closing von den richtigen Gespraechen sprechen.
//
// Anlass: Im Closing standen beide Beratungs-Status im Auswahlfeld und im
// Filter, und der Terminwaehler wurde dort mit zweck="beratung" aufgerufen.
// Ein im Closing neu gebuchter Termin schrieb damit den Beratungstermin des
// Setters, setzte "Beratungsgespraech vereinbart" - und warf den Kontakt
// zurueck ins Setting. Im Closing ist immer vom Abschlussgespraech die Rede.
//
// Aufruf: node scripts/pruefe-stufen.mjs

import fs from 'node:fs'
import {
  STATUS, STUFE, STATUS_JE_STUFE, statusFuerStufe, stufeVonLead, uebergangErlaubt
} from '../shared/status.js'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const BERATUNG = [STATUS.BERATUNG_VEREINBART, STATUS.BERATUNG_GEFUEHRT]

// 1. Im Closing kein Beratungsgespraech, im Setting kein Abschlussgespraech.
const closing = statusFuerStufe(STUFE.CLOSING)
const setting = statusFuerStufe(STUFE.SETTING)
sagt(!closing.some(s => BERATUNG.includes(s)), 'Closing-Status ohne Beratungsgespraech')
sagt(setting.some(s => BERATUNG.includes(s)), 'Setting-Status mit Beratungsgespraech')
sagt(!setting.includes(STATUS.ABSCHLUSS_VEREINBART) && !setting.includes(STATUS.IM_ABSCHLUSS),
  'Setting-Status ohne Abschlussgespraech')

// 2. Jeder Status fuehrt in die Stufe, in deren Liste er steht. Die beiden
//    geplatzten Termine haengen am Closer - deshalb einmal mit, einmal ohne.
for (const s of setting) {
  const stufe = stufeVonLead({ status: s, closer_id: null })
  sagt([STUFE.SETTING, STUFE.GEWONNEN, STUFE.VERLOREN].includes(stufe),
    `Setting: "${s}" liegt ohne Closer im Setting (ist: ${stufe})`)
}
for (const s of closing) {
  const stufe = stufeVonLead({ status: s, closer_id: 'c' })
  sagt([STUFE.CLOSING, STUFE.GEWONNEN, STUFE.VERLOREN].includes(stufe),
    `Closing: "${s}" liegt mit Closer im Closing (ist: ${stufe})`)
}

// 3. Wohin ein Closer wechseln kann, muss er auch filtern koennen. Einzige
//    Ausnahme: die Rueckgabe ins Setting - die laeuft nicht ueber die
//    Statuswahl, sondern ueber "zurueck an den Setter".
for (const von of closing) {
  for (const nach of Object.values(STATUS)) {
    if (!uebergangErlaubt(von, nach) || von === nach) continue
    const bekannt = closing.includes(nach) || BERATUNG.includes(nach)
    sagt(bekannt, `Closing: Wechsel "${von}" -> "${nach}" ist im Closing bekannt`)
  }
}

// 4. Die Seiten muessen die Liste auch benutzen.
const closingSeite = fs.readFileSync('src/pages/Closing.jsx', 'utf8')
sagt(!/zweck="beratung"/.test(closingSeite), 'Closing bucht kein Beratungsgespraech')
sagt(/zweck="abschluss"/.test(closingSeite), 'Closing bucht das Abschlussgespraech')
sagt(/statusFuerStufe\(STUFE\.CLOSING\)/.test(closingSeite), 'Closing nimmt die Status seiner Stufe')
sagt(!/Offene Beratungsgespräche/.test(closingSeite), 'Closer-Pool spricht vom Abschlussgespraech')

// Die Setting-Seite darf beides: das Beratungsgespraech neu legen und das
// Abschlussgespraech uebergeben.
const settingSeite = fs.readFileSync('src/pages/Setting.jsx', 'utf8')
sagt(/zweck="beratung"/.test(settingSeite) && /zweck="abschluss"/.test(settingSeite),
  'Setting legt Beratungs- und Abschlussgespraech')

console.log(`\n${STATUS_JE_STUFE[STUFE.CLOSING].length} Closing-Status, ${STATUS_JE_STUFE[STUFE.SETTING].length} Setting-Status geprueft.`)
if (befunde.length) {
  console.error('\nFEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Stufen: Setting spricht von Beratung, Closing vom Abschluss.')
