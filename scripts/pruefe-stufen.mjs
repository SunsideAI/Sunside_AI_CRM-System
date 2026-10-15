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
  STATUS, STUFE, STATUS_JE_STUFE, statusFuerStufe, stufeVonLead, uebergangErlaubt, anzeigeName
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

// 4. Kein Status heisst im Closing "Beratungsgespraech". Altkontakte liegen
//    beim Closer und tragen trotzdem einen Beratungs-Status - dort hilft nur
//    die Anzeige, denn einen Abschlusstermin haben sie nicht.
for (const s of [...closing, ...BERATUNG]) {
  sagt(!anzeigeName(s, STUFE.CLOSING).includes('Beratungsgespräch'),
    `Im Closing heisst "${s}" nicht Beratungsgespraech (ist: "${anzeigeName(s, STUFE.CLOSING)}")`)
}
sagt(anzeigeName(STATUS.BERATUNG_VEREINBART, STUFE.SETTING) === STATUS.BERATUNG_VEREINBART,
  'Im Setting heisst das Beratungsgespraech weiter so')
sagt(anzeigeName('Lead', STUFE.CLOSING) === 'Termin vereinbart',
  'Altwert "Lead" heisst im Closing "Termin vereinbart"')

// 5. Die Seiten muessen die Liste auch benutzen.
const closingSeite = fs.readFileSync('src/pages/Closing.jsx', 'utf8')
sagt(!/zweck="beratung"/.test(closingSeite), 'Closing bucht kein Beratungsgespraech')
sagt(/zweck="abschluss"/.test(closingSeite), 'Closing bucht das Abschlussgespraech')
sagt(/statusFuerStufe\(STUFE\.CLOSING\)/.test(closingSeite), 'Closing nimmt die Status seiner Stufe')
sagt(!/Offene Beratungsgespräche/.test(closingSeite), 'Closer-Pool spricht vom Abschlussgespraech')

/* Das Setting darf beides: das Beratungsgespraech legen und das
   Abschlussgespraech uebergeben.

   Geprueft wird die Faehigkeit, nicht die Datei. Das Buchen des
   Beratungsgespraechs ist am 14./15.10.2026 aus der Seite in die
   Gespraechsmaske gewandert - erst der erste Termin, dann der nach einem
   geplatzten. In Setting.jsx steht seitdem nur noch der Picker fuer das
   Abschlussgespraech; beide Dateien zusammen sind das Setting. */
const settingSeite = fs.readFileSync('src/pages/Setting.jsx', 'utf8')
const settingMaske = fs.readFileSync('src/components/SetterUebergabe.jsx', 'utf8')
sagt(/zweck="beratung"/.test(settingSeite + settingMaske)
     && /zweck="abschluss"/.test(settingSeite + settingMaske),
  'Setting legt Beratungs- und Abschlussgespraech')

// 6. Die Kalenderansicht muss dieselbe Stufe meinen wie der Rest.
//
// Bis zum 01.10.2026 fragte sie nur, wer als Closer eingetragen ist. Bei
// Welfenross Better Living standen Setter und Closer beide auf Paul und die
// Uebergabe war nie erfolgt - der Termin war gruen wie ein Setting-Termin,
// der Knopf darunter sagte trotzdem "Im Closing öffnen" und fuehrte auf eine
// Seite, auf der der Kontakt gar nicht steht.
const termine = fs.readFileSync('src/pages/Termine.jsx', 'utf8')
sagt(/isMyClosing = lead\.closerName === userName && stufe === STUFE\.CLOSING/.test(termine),
  'Der Kalender nennt es erst Closing, wenn die Übergabe steht')
sagt(/isMySetting = lead\.setterName === userName && stufe === STUFE\.SETTING/.test(termine),
  'Und Setting nur, solange der Kontakt dort liegt')
sagt(/const stufe = stufeVonLead\(lead\)/.test(termine),
  'Beides aus stufeVonLead, nicht aus einer eigenen Regel')

// Und die Probe aufs Exempel: genau dieser Kontakt.
const welfenross = { status: 'Lead', ergebnis_beratung: null }   // so steht er in der Datenbank
sagt(stufeVonLead(welfenross) === STUFE.SETTING,
  'Welfenross: Status „Lead" ohne Übergabe ist Setting')
sagt(stufeVonLead({ ...welfenross, ergebnis_beratung: 'Abschlussgespräch vereinbart' }) === STUFE.CLOSING,
  'Mit Übergabe wäre er Closing')

/* Die Closing-Liste fragt nach der Stufe - als einzige der drei tat sie das
   lange nicht.

   Am 14.10.2026 fiel es an einem frisch angelegten Kontakt auf: Er stand
   gleichzeitig im Setting und im Closing. Dahinter lagen 73 weitere. Von 667
   Hot Leads waren 410 nicht in der Closing-Stufe; das Setting filtert seit
   jeher ueber imSetting(), das Closing ueber gar nichts.

   Der Closer in der Bedingung ist der Schutz vor einem groben Fehler: 130
   Kontakte aus der Zeit vor dem OSC-Umbau tragen noch einen Beratungs-Status,
   obwohl ein Closer sie haelt - ihre Uebergabe wurde nie dokumentiert. Ein
   reiner Stufenfilter haette sie alle aus der Liste geworfen, mitsamt der
   Arbeit, die daran haengt. */
const closingQuelle = fs.readFileSync('src/pages/Closing.jsx', 'utf8')
sagt(/let filtered = leads\.filter\(l => stufeVonLead\(l\) !== STUFE\.SETTING \|\| l\.closerId\)/.test(closingQuelle),
  'Die Closing-Liste lässt Setting-Kontakte ohne Closer weg')
sagt(/stufeVonLead/.test(closingQuelle.split('\n')[0]),
  'stufeVonLead ist dafür importiert')

// Die Bedingung durchgerechnet
const zeigtImClosing = (l) => stufeVonLead(l) !== STUFE.SETTING || l.closerId
const faelle = [
  ['Frische Anfrage im Setting, kein Closer (Hw-Immobilienservice)',
   { status: STATUS.BERATUNG_VEREINBART }, false],
  ['Altbestand: Beratungs-Status, aber ein Closer hält ihn',
   { status: STATUS.BERATUNG_VEREINBART, closerId: 'abc' }, true],
  ['Übergeben ans Closing',
   { status: STATUS.BERATUNG_GEFUEHRT, ergebnis_beratung: 'Abschlussgespräch vereinbart' }, true],
  ['Im Abschluss',
   { status: STATUS.IM_ABSCHLUSS }, true],
  ['Gewonnen bleibt sichtbar',
   { status: STATUS.GEWONNEN }, true],
  ['Verloren bleibt sichtbar',
   { status: STATUS.VERLOREN_ENDGUELTIG }, true],
]
for (const [name, lead, erwartet] of faelle) {
  sagt(Boolean(zeigtImClosing(lead)) === erwartet,
    `${erwartet ? 'Im Closing' : 'Nicht im Closing'}: ${name}`)
}

console.log(`\n${STATUS_JE_STUFE[STUFE.CLOSING].length} Closing-Status, ${STATUS_JE_STUFE[STUFE.SETTING].length} Setting-Status geprueft.`)
if (befunde.length) {
  console.error('\nFEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Stufen: Setting spricht von Beratung, Closing vom Abschluss.')
