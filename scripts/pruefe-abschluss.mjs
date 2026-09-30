// Prueft die beiden Regeln um den Abschluss und die Freigabe.
//
// 1. "Gewonnen" meldet den Abschluss an die Abrechnungs-Bridge - dort entsteht
//    eine Rechnung. Das darf nicht am Vertrieb haengen. Der Closer schliesst
//    mit "Angebot unterschrieben" ab, die Leitung hebt es danach.
// 2. Einen Kontakt zurueck in den Pool geben muss in Setting und Closing gehen,
//    mit demselben Bauteil und ohne Popup.
//
// Aufruf: node scripts/pruefe-abschluss.mjs

import fs from 'node:fs'
import {
  STATUS, STUFE, statusFuerStufe, uebergangErlaubt, normalisiere, anzeigeName,
  statusBrauchtLeitung, istAbschluss, ENDZUSTAENDE
} from '../shared/status.js'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

// ── Der Abschluss des Vertriebs ────────────────────────────────────────────
sagt(STATUS.ANGEBOT_UNTERSCHRIEBEN === 'Angebot unterschrieben',
  'Es gibt den Status „Angebot unterschrieben"')
sagt(statusFuerStufe(STUFE.CLOSING).includes(STATUS.ANGEBOT_UNTERSCHRIEBEN),
  'Er gehoert ins Closing')
sagt(!statusFuerStufe(STUFE.SETTING).includes(STATUS.ANGEBOT_UNTERSCHRIEBEN),
  'Und nicht ins Setting')

// Er muss aus dem Angebot heraus erreichbar sein, sonst kommt niemand hin.
sagt(uebergangErlaubt(STATUS.ANGEBOT_VERSCHICKT, STATUS.ANGEBOT_UNTERSCHRIEBEN),
  'Aus „Angebot versendet" erreichbar')
sagt(uebergangErlaubt(STATUS.IM_ABSCHLUSS, STATUS.ANGEBOT_UNTERSCHRIEBEN),
  'Aus „Im Abschluss" erreichbar')
sagt(uebergangErlaubt(STATUS.ANGEBOT_UNTERSCHRIEBEN, STATUS.GEWONNEN),
  'Und von dort weiter auf „Gewonnen"')
sagt(!ENDZUSTAENDE.includes(STATUS.ANGEBOT_UNTERSCHRIEBEN),
  'Unterschrieben ist kein Endzustand')

// ── Wer darf was ───────────────────────────────────────────────────────────
sagt(statusBrauchtLeitung(STATUS.GEWONNEN), '„Gewonnen" ist der Leitung vorbehalten')
sagt(statusBrauchtLeitung('Abgeschlossen'),
  'Auch der Altwert „Abgeschlossen" - darauf haengt der Datenbank-Trigger')
sagt(!statusBrauchtLeitung(STATUS.ANGEBOT_UNTERSCHRIEBEN),
  '„Angebot unterschrieben" darf der Vertrieb setzen')

// Fuer die Statistik zaehlen beide, fuer die Rechnung nur eines.
sagt(istAbschluss(STATUS.ANGEBOT_UNTERSCHRIEBEN) && istAbschluss(STATUS.GEWONNEN),
  'Beide zaehlen als Abschluss')

// ── Die Serverpruefung ─────────────────────────────────────────────────────
const server = fs.readFileSync('netlify/functions/hot-leads.js', 'utf8')
sagt(/statusBrauchtLeitung\(fields\.status\) && !angemeldet\.istAdmin/.test(server),
  'Der Server weist den Vertrieb ab, nicht nur die Oberflaeche')
// Die Bridge haengt weiter allein an GEWONNEN.
sagt(/normalisiere\(fields\.status\) === STATUS\.GEWONNEN[\s\S]{0,120}BRIDGE_URL/.test(server),
  'Die Abrechnung haengt allein an „Gewonnen"')

// Der Datenbank-Trigger notify_bridge_lead_closed hoert auf den Altwert
// "Abgeschlossen". Also wird der auch geschrieben - sonst entstuende bei einem
// gewonnenen Deal keine Rechnung. Gelesen wird er ueberall als GEWONNEN.
sagt(/if \(fields\.status === STATUS\.GEWONNEN\) fields\.status = 'Abgeschlossen'/.test(server),
  'Gespeichert wird der Wert, auf den der Trigger hoert')
sagt(normalisiere('Abgeschlossen') === STATUS.GEWONNEN,
  'Und gelesen heisst er wieder „Gewonnen"')
sagt(anzeigeName('Abgeschlossen') === 'Gewonnen',
  `In der Oberflaeche steht „${anzeigeName('Abgeschlossen')}"`)
// Die Umschreibung darf erst nach der Uebergangspruefung greifen, sonst
// vergleicht die Matrix gegen einen Wert, den sie nicht kennt.
const posPruefung = server.indexOf('uebergangErlaubt(vorher.status, fields.status)')
const posSchreib  = server.indexOf("fields.status = 'Abgeschlossen'")
sagt(posPruefung > 0 && posSchreib > posPruefung,
  'Sie greift erst nach der Uebergangspruefung')

// ── Die Oberflaeche ────────────────────────────────────────────────────────
const closing = fs.readFileSync('src/pages/Closing.jsx', 'utf8')
sagt(/statusZurWahl\(isAdmin\(\)\)/.test(closing),
  'Die Statuswahl im Closing fragt nach der Rolle')
sagt(/filter\(o => !statusBrauchtLeitung\(o\.value\)\)/.test(closing),
  'Ohne Leitung faellt „Gewonnen" aus der Auswahl')

const form = fs.readFileSync('src/components/AbschlussForm.jsx', 'utf8')
sagt(/zielStatus = STATUS\.ANGEBOT_UNTERSCHRIEBEN/.test(form),
  'Das Abschlussformular endet standardmaessig bei „unterschrieben"')
sagt(!/status: STATUS\.GEWONNEN/.test(form),
  'Und setzt „Gewonnen" nicht mehr fest')

// ── Die Freigabe ───────────────────────────────────────────────────────────
sagt(fs.existsSync('src/components/LeadFreigabe.jsx'), 'Es gibt ein Bauteil fuer die Freigabe')
const frei = fs.readFileSync('src/components/LeadFreigabe.jsx', 'utf8')
sagt(/setterName/.test(frei) && /closerName/.test(frei),
  'Es kennt beide Rollen')

const setting = fs.readFileSync('src/pages/Setting.jsx', 'utf8')
for (const [datei, inhalt] of [['Setting', setting], ['Closing', closing]]) {
  sagt(/import LeadFreigabe/.test(inhalt), `${datei} benutzt dasselbe Bauteil`)
}
sagt(/stufe="setting"/.test(setting), 'Das Setting gibt an den Setter-Pool zurueck')
// Der Server muss den Namensweg fuer beide Rollen kennen - fuer setterName
// fehlte er, das Freigeben im Setting waere wirkungslos geblieben.
sagt(/'setterName': 'setter_id'/.test(server) && /if \(key === 'setterName'\)/.test(server),
  'Der Server loest auch setterName auf')
// Nur vor dem Gespraech: danach zeigt der Pool den Kontakt nicht mehr.
sagt(/gewaehlt\.status === STATUS\.BERATUNG_VEREINBART && \(\s*<button onClick=\{\(\) => setFreigabeOffen/.test(setting),
  'Freigeben steht nur vor dem Beratungsgespraech')
sagt(/stufe="closing"/.test(closing), 'Das Closing an den Closer-Pool')

// Kein Popup mehr: ein Kasten in der Bildmitte ueber der Schublade.
sagt(!/Freigabe-Bestätigung Modal/.test(closing),
  'Das Freigabe-Popup im Closing ist weg')
sagt(!/showReleaseConfirm && \(\s*<div className="absolute inset-0 bg-black/.test(closing),
  'Und kommt nicht als Kasten in der Bildmitte zurueck')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Abschluss: der Vertrieb unterschreibt, die Leitung rechnet ab.')
