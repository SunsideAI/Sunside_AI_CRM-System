/* Der Kalender zeigte nur Beratungsgespraeche: Er las allein terminDatum
   (= termin_beratungsgespraech). Abschlussgespraeche standen nirgends - am
   08.10.2026 fehlten drei Termine am 13. und 14. Oktober. Stattdessen faerbte
   sich der alte Beratungstermin um, sobald der Kontakt ins Closing wanderte,
   und hiess in der Legende "Abschlussgespraech".

   Seitdem gilt: Die Farbe sagt, WAS fuer ein Termin das ist. Die Art aendert
   sich nie, also behaelt ein Termin seine Farbe, solange es ihn gibt. Zustand
   und Zustaendigkeit tragen Form und Beschriftung. */
import fs from 'fs'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const fn = fs.readFileSync('src/pages/Termine.jsx', 'utf8')

sagt(/lead\.termin_abschlussgespraech\) \{/.test(fn),
  'Der Kalender lädt auch Abschlussgespräche')
sagt(/source: 'abschlussgespraech'/.test(fn),
  'Sie sind als eigene Art geführt')
sagt(/id: `abschluss-\$\{lead\.id\}`/.test(fn),
  'Und haben eine eigene Kennung - beide Termine eines Kontakts stehen nebeneinander')

/* Ein Abschlussgespraech belegt in Calendly 45 Minuten. Alle Termine auf 30
   zu setzen liess es im Raster kuerzer aussehen, als es ist. */
sagt(/DAUER = \{ beratung: 30, abschluss: 45/.test(fn),
  'Jede Terminart hat ihre eigene Dauer')

/* Die Farbe darf nicht am Status haengen: Sonst faerbt sich ein gehaltenes
   Beratungsgespraech um, sobald der Kontakt weiterwandert. */
sagt(/FARBE\[event\.source\]/.test(fn),
  'Die Farbe hängt an der Art des Termins')
sagt(!/stufeVonLead\(event\.lead/.test(fn),
  'Und nicht mehr an der Stufe des Kontakts')
sagt(/if \(isEventCancelled\(event\)\) return FARBE\.abgesagt/.test(fn),
  'Abgesagt schlägt die Artfarbe - das zählt im Kalender zuerst')

/* Was die Farbe nicht traegt, traegt die Form. */
sagt(/opacity-60/.test(fn) && /new Date\(event\.start\) < new Date\(\)/.test(fn),
  'Vergangene Termine sind blasser, bleiben aber stehen')
sagt(/border-l-dashed/.test(fn),
  'Ohne Zuständigen: gestrichelte Kante')

/* Der Firmenname allein sagt nicht, um welches Gespraech es geht. */
sagt(/KUERZEL\[event\.source\]/.test(fn),
  'Die Kachel nennt die Art')
sagt(/\{event\.haeltRolle\}: \{event\.haelt \|\| 'niemand'\}/.test(fn),
  'Und wer das Gespräch hält, mit Rollennamen')
sagt(/\{event\.legteRolle\}: \{event\.legte\}/.test(fn),
  'Sowie wer den Termin gelegt hat')
/* Die Rolle heisst je nach Terminart anders - derselbe Mensch ist beim
   Beratungsgespraech Setter und beim Abschluss der Uebergebende. */
sagt(/haeltRolle: 'Setter'[\s\S]{0,200}legteRolle: 'Opener'/.test(fn)
     && /haeltRolle: 'Closer'[\s\S]{0,200}legteRolle: 'Setter'/.test(fn),
  'Die Rollennamen richten sich nach der Terminart')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Kalender: beide Termine, Farbe nach Art, Form für den Rest.')
