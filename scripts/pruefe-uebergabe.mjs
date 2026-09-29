// Prueft, dass ein an den Closer uebergebener Kontakt im Setting gesperrt ist.
//
// Anlass: Am 28.09.2026 stand "Sunside AI - Immobilien" im Setting unter
// "Anstehend", voll bearbeitbar - obwohl Ergebnis ("Abschlussgespraech
// vereinbart"), Abschlusstermin und Closer laengst gesetzt waren. Sein Status
// war durch eine Terminverschiebung auf einen Beratungswert zurueckgefallen,
// und sowohl die Sperre in der Schublade als auch die Serverpruefung haengen
// an stufeVonLead - das nur den Status ansah. Der Setter haette am Kontakt des
// Closers weiterarbeiten koennen.
//
// Aufruf: node scripts/pruefe-uebergabe.mjs

import fs from 'node:fs'
import {
  STATUS, STUFE, stufeVonLead, zustaendigFuerStufe, anCloserUebergeben, anzeigeNameVonLead
} from '../shared/status.js'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const SETTER = 'aaaaaaaa-0000-0000-0000-000000000001'
const CLOSER = 'bbbbbbbb-0000-0000-0000-000000000002'

// Der echte Fall vom 28.09.2026, Feld fuer Feld.
const derFall = {
  status: STATUS.BERATUNG_VEREINBART,      // aus "Termin verschoben" normalisiert
  ergebnis_beratung: 'Abschlussgespräch vereinbart',
  termin_abschlussgespraech: '2026-09-29T13:00:00+00:00',
  setter_id: SETTER,
  closer_id: CLOSER
}

// 1. Die Uebergabe zaehlt, nicht der hinterherhinkende Status.
sagt(anCloserUebergeben(derFall), 'Die vollzogene Uebergabe wird erkannt')
sagt(stufeVonLead(derFall) === STUFE.CLOSING, 'Der Kontakt liegt im Closing, nicht im Setting')

// 2. Damit greift die Serversperre: zustaendig ist der Closer, nicht der Setter.
const zustaendig = zustaendigFuerStufe(derFall)
sagt(zustaendig.includes(CLOSER), 'Zustaendig ist der Closer')
sagt(!zustaendig.includes(SETTER), 'Der Setter darf nicht mehr schreiben')

// 3. Und die Liste nennt den Stand beim Namen.
sagt(anzeigeNameVonLead(derFall) === 'Abschlussgespräch vereinbart',
  `Die Liste zeigt „${anzeigeNameVonLead(derFall)}"`)

// 4. Ohne Uebergabe bleibt alles wie zuvor - sonst waere jeder Setting-Kontakt
//    gesperrt.
const normal = { status: STATUS.BERATUNG_VEREINBART, setter_id: SETTER }
sagt(stufeVonLead(normal) === STUFE.SETTING, 'Ein offener Beratungstermin bleibt im Setting')
sagt(zustaendigFuerStufe(normal).includes(SETTER), 'Dort ist der Setter zustaendig')
sagt(anzeigeNameVonLead(normal) === 'Beratungsgespräch vereinbart',
  'Und heisst weiter Beratungsgespraech vereinbart')

// 5. Ein Kontakt, der im Closing schon weiter ist, behaelt seinen eigenen
//    Stand - die Uebergabe darf ihn nicht ueberschreiben.
const imAngebot = {
  status: STATUS.ANGEBOT_VERSCHICKT,
  ergebnis_beratung: 'Abschlussgespräch vereinbart',
  closer_id: CLOSER
}
sagt(anzeigeNameVonLead(imAngebot) !== 'Abschlussgespräch vereinbart',
  `Ein Kontakt im Angebot heisst „${anzeigeNameVonLead(imAngebot)}"`)

// 6. Die Ruecknahme muss das Ergebnis mitnehmen. Sonst kaeme ein zurueck-
//    geholter Kontakt nie wieder ins Setting - stufeVonLead saehe die alte
//    Uebergabe und hielte ihn fuer immer im Closing.
const server = fs.readFileSync('netlify/functions/hot-leads.js', 'utf8')
sagt(/zurueckFelder\.ergebnis_beratung = null/.test(server),
  'Die Ruecknahme raeumt das Ergebnis ab')
const zurueckgeholt = {
  status: STATUS.BERATUNG_GEFUEHRT,
  ergebnis_beratung: null,
  termin_abschlussgespraech: '2026-09-29T13:00:00+00:00',   // bleibt als Information
  setter_id: SETTER,
  closer_id: CLOSER
}
sagt(stufeVonLead(zurueckgeholt) === STUFE.SETTING,
  'Ein zurueckgeholter Kontakt ist wieder Sache des Setters')

// 7. Das Select der Serverpruefung muss das Feld mitladen, sonst sieht
//    stufeVonLead dort nichts.
const select = server.match(/\.select\('status, setter_id, closer_id, opener_id, reaktivierung_bearbeiter_id[^']*'\)/)
sagt(Boolean(select && /ergebnis_beratung/.test(select[0])),
  'Die Serverpruefung laedt das Ergebnis mit')

// 8. Das Setting fuehrt einen eigenen Reiter dafuer und haelt uebergebene
//    Kontakte aus den Arbeitslisten heraus.
const seite = fs.readFileSync('src/pages/Setting.jsx', 'utf8')
sagt(/wert: 'uebergeben'/.test(seite), 'Das Setting hat einen Reiter „Übergeben"')
sagt(/const imSetting = \(l\) => stufeVonLead\(l\) === STUFE\.SETTING/.test(seite),
  'Die Arbeitslisten fragen die Stufe')
// Die Bedingung darf wachsen (die Freigabe haengt inzwischen mit drin),
// „!gesperrt" muss aber drinbleiben.
sagt(/fuss=\{\([^)]*!gesperrt[^)]*\)\s*\?/.test(seite),
  'Ein gesperrter Kontakt hat keine Aktionen im Fuss')

// 9. Die Reiter muessen nachrechenbar sein. Der erste Umbau am 28.09. sortierte
//    jeden Kontakt im Closing unter „Übergeben" ein - damit standen dort auch
//    geplatzte Termine und Altbestand ohne dokumentierte Uebergabe, waehrend
//    „Geplatzt" leer blieb, obwohl zwei abgesagte Termine da waren.
const filterBlock = seite.match(/const FILTER = \[[\s\S]*?\n\]/)?.[0] || ''
sagt(/wert: 'geplatzt',[\s\S]{0,200}?trifft: l => \[STATUS\.TERMIN_ABGESAGT/.test(filterBlock),
  'Geplatzt fragt nicht nach der Stufe')
sagt(/wert: 'uebergeben',[\s\S]{0,200}?trifft: l => anCloserUebergeben\(l\)/.test(filterBlock),
  'Uebergeben fragt nach der Uebergabe, nicht nach der Stufe')

// Und die Probe an den echten Faellen aus dem Bestand vom 28.09.
const geplatztBeimCloser = {
  status: STATUS.TERMIN_ABGESAGT, ergebnis_beratung: null,
  setter_id: SETTER, closer_id: CLOSER
}
sagt(stufeVonLead(geplatztBeimCloser) === STUFE.CLOSING,
  'Ein geplatzter Termin beim Closer bleibt gesperrt')
sagt(!anCloserUebergeben(geplatztBeimCloser),
  'Aber er gilt nicht als uebergeben')

const altbestandImClosing = {
  status: STATUS.ANGEBOT_VERSCHICKT, ergebnis_beratung: null, closer_id: CLOSER
}
sagt(!anCloserUebergeben(altbestandImClosing),
  'Altbestand im Closing ohne Ergebnis gilt nicht als uebergeben')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Uebergabe: was beim Closer liegt, ist im Setting zu.')
