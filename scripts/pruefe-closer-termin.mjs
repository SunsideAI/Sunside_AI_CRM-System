/* Im Closing gelten zwei Termine nebeneinander: Das Beratungsgespraech des
   Setters (telefonisch, meeting_link) und das Abschlussgespraech (in Calendly
   fest als Videotermin, meeting_link_abschluss). Das CRM hat nur EIN Feld
   terminart - es beschreibt das Beratungsgespraech.

   Belegt am 06.10.2026: Drei Abschlussgespraeche standen im Closer-Pool als
   "Telefonisch" mit Telefonhoerer, obwohl alle drei einen Google-Meet-Link
   trugen. In der Schublade fehlte der Link ganz, weil sie meeting_link las
   statt meeting_link_abschluss. Der Closer haette angerufen, waehrend der
   Kunde im Meeting wartet. */
import fs from 'fs'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const fn = fs.readFileSync('src/pages/Closing.jsx', 'utf8')

sagt(/function closerTerminart\(lead\)/.test(fn),
  'Es gibt eine Stelle, die sagt, welche Art der geltende Termin hat')
sagt(/function closerLink\(lead\)/.test(fn),
  'Und eine, die den passenden Einwahllink liefert')
sagt(/lead\?\.termin_abschlussgespraech \? 'Video'/.test(fn),
  'Ein gelegtes Abschlussgespräch gilt als Video')
sagt(/termin_abschlussgespraech[\s\S]{0,60}meeting_link_abschluss/.test(fn),
  'Und bringt den Link des Abschlussgesprächs mit')

/* Die drei Stellen, die vorher terminart roh gelesen haben. Kommt eine
   zurueck, zeigt der Pool wieder den Termin der Stufe davor. */
sagt(!/icon: l\.terminart ===/.test(fn),
  'Das Icon in der Pool-Liste fragt nicht mehr roh terminart')
sagt(!/art: e\.roh\.terminart/.test(fn),
  'Die Pool-Schublade ebenso wenig')
sagt(!/link: e\.roh\.meeting_link\b/.test(fn),
  'Und sie holt den Link nicht mehr vom Beratungsgespräch')
sagt(!/art: lead\?\.terminart \|\| 'Unbekannt'/.test(fn),
  'Auch die Mail an die Closer nennt die richtige Art')

const treffer = (fn.match(/closerTerminart\(/g) || []).length
sagt(treffer >= 4, `closerTerminart wird überall genutzt (${treffer} Stellen)`)

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Closing: Art und Einwahl gehören zum geltenden Termin.')
