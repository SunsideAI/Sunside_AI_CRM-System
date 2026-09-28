// Prueft den Ausgang des Beratungsgespraechs (Revision 25.09.).
//
// Nach dem Setting ist niemand Kunde: „Auftrag" gibt es dort nicht mehr. Es
// bleiben drei Wege - das Abschlussgespraech steht, es wird nachgefasst, oder
// der Kontakt passt nicht. Und ein vereinbartes Abschlussgespraech ohne
// gebuchten Termin ist eine leere Zusage: Der Kontakt laege beim Setter,
// waehrend die Quote ihn als uebergeben zaehlt.
//
// Aufruf: node scripts/pruefe-beratung.mjs

import fs from 'node:fs'
import { AUSWAHL, UEBERGABE_2, uebergabePruefen, maske } from '../shared/felder.js'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

// 1. Die Liste des Settings
const setting = AUSWAHL.ausgang_beratung
sagt(setting.join(' · ') === 'Abschlussgespräch vereinbart · Vertagt ohne festen Schritt · Nicht geeignet',
  `Setting: ${setting.join(' · ')}`)
sagt(!setting.includes('Auftrag'), 'Kein „Auftrag" nach dem Beratungsgespräch')
sagt(setting.includes('Vertagt ohne festen Schritt'),
  '„Vertagt ohne festen Schritt" bleibt - sonst hat das Nachfassen kein Tor')

// 2. Das Closing behaelt seine eigene Liste
sagt(AUSWAHL.gespraechsausgang.includes('Auftrag'),
  `Closing unverändert: ${AUSWAHL.gespraechsausgang.join(' · ')}`)

// 3. Aussortieren nur mit Begruendung
const offen = (l) => uebergabePruefen(l, UEBERGABE_2).offen.map(o => o.schluessel)
sagt(offen({ ergebnis_beratung: 'Nicht geeignet' }).includes('verlust_grund'),
  '„Nicht geeignet" ohne Begründung: blockiert')
sagt(!offen({ ergebnis_beratung: 'Nicht geeignet', verlust_grund: 'kein Budget' }).includes('verlust_grund'),
  '„Nicht geeignet" mit Begründung: frei')
sagt(!offen({ ergebnis_beratung: 'Vertagt ohne festen Schritt' }).includes('verlust_grund'),
  'Vertagt braucht keine Begründung')
sagt(maske(UEBERGABE_2).some(f => f.schluessel === 'verlust_grund'),
  'Das Begründungsfeld steht in der Maske des Settings')

// 4. Der Termin ist Bedingung - im Ablauf und auf dem Server
const seite = fs.readFileSync('src/components/SetterUebergabe.jsx', 'utf8')
sagt(/mitUebergabe = ergebnis === 'Abschlussgespräch vereinbart'/.test(seite),
  'Nur das vereinbarte Abschlussgespräch führt zum Terminwähler')
sagt(!/'Auftrag'|'Absage'/.test(seite), 'Keine alten Ausgänge mehr im Ablauf')

const server = fs.readFileSync('netlify/functions/hot-leads.js', 'utf8')
sagt(/ergebnis_beratung === 'Abschlussgespräch vereinbart'[\s\S]{0,120}termin_abschlussgespraech/.test(server),
  'Der Server weist das Ergebnis ohne gebuchten Termin ab')
sagt(/STATUS\.ABSCHLUSS_VEREINBART[\s\S]{0,600}termin_abschlussgespraech/.test(server),
  'Und den Status ohne Termin ebenso')

// 5. Die Reihenfolge der Seiten: erst die Fragen, das Ergebnis am Ende.
const reihenfolge = ['Angaben aus dem Gespräch', 'Ergebnis des Gesprächs', 'Termin mit dem Closer']
  .map(t => seite.indexOf(`kopf('${t}'`))
sagt(reihenfolge.every((i, n) => i > -1 && (n === 0 || i > reihenfolge[n - 1])),
  'Seitenfolge: Angaben (1), Ergebnis (2), Termin (3)')
sagt(/kopf\('Angaben aus dem Gespräch', 1\)/.test(seite), 'Die Angaben sind Schritt 1')
sagt(/kopf\('Ergebnis des Gesprächs', 2\)/.test(seite), 'Das Ergebnis ist Schritt 2')
sagt(/BERATUNG_GEFUEHRT\) setAblauf\('felder'\)/.test(seite),
  '„Setting starten" führt direkt zu den Fragen')
sagt(/name: 'Setting starten'/.test(seite), 'Der Ausgang heißt „Setting starten"')
sagt(!/Noch offen, bitte Ausgang wählen/.test(seite), '„Noch offen, bitte Ausgang wählen" ist weg')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Beratungsgespräch: drei Ausgänge, Termin als Bedingung.')
