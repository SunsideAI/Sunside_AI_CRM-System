/* Zwei Stellen, an denen Status und Wirklichkeit auseinanderliefen.

   1. Wer einen Closer zugewiesen bekommt, steht im Abschluss. Die Genehmigung
      einer Bewerbung schrieb nur closer_id - im Closing sah es danach aus,
      als warte der Kontakt noch auf jemanden.

   2. „Abschlussgespraech vereinbart" ist nicht nur ein Ergebnis, sondern der
      Schalter, an dem anCloserUebergeben() die Stufe misst. Der
      Zwischenstand speicherte ihn mit - ohne Termin. Belegt am 06.10.2026 an
      Westfalenmakler: im Closing, ohne Termin, ohne Closer, Status noch
      „Beratungsgespraech vereinbart". */
import fs from 'fs'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const bew = fs.readFileSync('netlify/functions/hot-lead-applications.js', 'utf8')

sagt(/import \{ normalisiere, STATUS \}/.test(bew),
  'Die Bewerbungsannahme kennt die Statuswerte')
/* Ohne status in der Abfrage liefe die Bedingung immer ins Leere - das Feld
   fehlte dort zuerst, und der Fix haette nie gegriffen. */
const abfrage = bew.slice(bew.indexOf('if (event.httpMethod === \'PATCH\''))
sagt(/hot_lead:hot_leads[\s\S]{0,220}status,/.test(abfrage),
  'Und lädt den Status des Kontakts mit')
sagt(/normalisiere\(application\.hot_lead\?\.status\) === STATUS\.ABSCHLUSS_VEREINBART/.test(bew),
  'Sie prüft ihn über den Altbestand hinweg')
sagt(/status: STATUS\.IM_ABSCHLUSS/.test(bew),
  'Mit dem Closer wandert der Kontakt in den Abschluss')
sagt(/stufe === STUFE\.CLOSER\s*\n?\s*&& normalisiere/.test(bew),
  'Nur beim Closer, nicht beim Setter')

const ueb = fs.readFileSync('src/components/SetterUebergabe.jsx', 'utf8')
const zwischen = ueb.slice(ueb.indexOf('const zwischenstand'), ueb.indexOf('const knopfText'))
sagt(/nochOhneTermin/.test(zwischen),
  'Der Zwischenstand erkennt ein Ergebnis ohne Termin')
sagt(/felder\.ergebnis_beratung = null/.test(zwischen),
  'Und hält „Abschlussgespräch vereinbart" zurück, bis gebucht ist')
sagt(/lead\?\.termin_abschlussgespraech/.test(zwischen),
  'Gemessen am gebuchten Termin, nicht an der Absicht')

/* Der Weg ueber den Terminwaehler setzt beides zusammen - Ergebnis, Termin
   und Status. Faellt das auseinander, entsteht genau der halbe Zustand. */
const uebergeben = ueb.slice(ueb.indexOf('const uebergeben = async'),
                             ueb.indexOf('const felderPruefen'))
sagt(/termin_abschlussgespraech: new Date\(gebucht\.start\)/.test(uebergeben)
     && /status: STATUS\.ABSCHLUSS_VEREINBART/.test(uebergeben),
  'Beim Übergeben gehen Termin und Status gemeinsam raus')

/* „Beratungsgespraech gefuehrt" traegt drei verschiedene Kontakte: den noch
   nicht dokumentierten, den vertagten und den uebergebenen. Einen eigenen
   Status fuer die Vertagung gibt es im Setting nicht - „Wird nachgefasst"
   gehoert laut STATUS_JE_STUFE ins Closing und wuerde den Kontakt dorthin
   schieben. Deshalb steht die Entscheidung in der Anzeige. */
const st = fs.readFileSync('shared/status.js', 'utf8')
sagt(/export function vertagt\(lead\)/.test(st),
  'Eine Vertagung ist als Zustand benannt')
sagt(/Entscheidung vertagt/.test(st),
  'Und steht hinter dem Status, statt ihn zu ersetzen')
sagt(!/STATUS_JE_STUFE[\s\S]{0,260}STUFE\.SETTING\][\s\S]{0,300}WIRD_NACHGEFASST/.test(st),
  'Der Nachfass-Status bleibt dem Closing vorbehalten')

/* Beide Wege - Liste und Schublade - bilden den Namen ueber dieselbe
   Funktion. Griffe einer davon roh auf lead.status zu, stuende die
   Vertagung nur an einer Stelle. */
/* Die Statuspille bricht nicht um (whitespace-nowrap). Stuende der Zusatz
   darin, spraengte er die Spalte - deshalb Pille und Zusatz getrennt. */
const z = fs.readFileSync('src/utils/zeile.js', 'utf8')
sagt(/statusBasisVonLead\(lead, stufe\)/.test(z),
  'Die Liste trägt den Status in der Pille')
sagt(/statusZusatz: statusZusatzVonLead\(lead\)/.test(z),
  'Und den Zusatz getrennt daneben')
const tab = fs.readFileSync('src/components/LeadTabelle.jsx', 'utf8')
sagt(/zeile\?\.statusZusatz &&/.test(tab),
  'Die Tabelle zeigt ihn unter der Pille')
sagt(/statusBasisVonLead/.test(st) && /export function statusZusatzVonLead/.test(st),
  'Beide Teile sind einzeln abrufbar')
sagt(/anzeigeNameVonLead\(gewaehlt\)/.test(fs.readFileSync('src/pages/Setting.jsx', 'utf8')),
  'Die Schublade im Setting ebenso')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Closing: der Status folgt der Zuständigkeit, das Ergebnis dem Termin.')
