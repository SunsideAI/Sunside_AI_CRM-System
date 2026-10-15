/* Der Kalender zeigte nur Beratungsgespraeche: Er las allein terminDatum
   (= termin_beratungsgespraech). Abschlussgespraeche standen nirgends - am
   08.10.2026 fehlten drei Termine am 13. und 14. Oktober. Stattdessen faerbte
   sich der alte Beratungstermin um, sobald der Kontakt ins Closing wanderte,
   und hiess in der Legende "Abschlussgespraech".

   Seitdem gilt: Die Farbe sagt, WAS fuer ein Termin das ist. Die Art aendert
   sich nie, also behaelt ein Termin seine Farbe, solange es ihn gibt. Zustand
   und Zustaendigkeit tragen Form und Beschriftung. */
import fs from 'fs'
import { STATUS, STUFE, stufeVonLead } from '../shared/status.js'

const ALLE_STUFEN = Object.keys(STUFE)

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

/* Wer Setting UND Closing haelt, hat zwei Sorten Termine im selben Kalender.
   Nur fuer die lohnt der Umschalter - alle anderen sehen ohnehin eine Sorte.
   Die Leitung bekommt ihn auch: Sie traegt Setter oft nicht im Profil, sieht
   in der Ansicht "Alle" aber beides. */
sagt(/const zeigtBeideArten = \(isSetter\(\) && isCloser\(\)\) \|\| isAdmin\(\)/.test(fn),
  'Den Umschalter sieht, wer beide Rollen hält - und die Leitung')
sagt(/artFilter === 'closing'/.test(fn) && /event\.source === 'abschlussgespraech'/.test(fn),
  '„Closing" zeigt nur Abschlussgespräche')
sagt(/\.filter\(passtZumFilter\)/.test(fn),
  'Der Filter greift auf die Tagesliste')
/* Wiedervorlagen sind Nachfassarbeit des Setters, kein Abschlussgespraech -
   sie gehoeren zum Setting-Teil, nicht in beide oder keinen. */
sagt(/Wiedervorlagen gehoeren zum Setting/.test(fn),
  'Wiedervorlagen zählen zum Setting')

/* Ein Termin ohne Zustaendigen faellt sonst nicht auf: Die Artfarbe wuerde
   ihn wie jeden anderen aussehen lassen. */
sagt(/if \(event\.source !== 'wiedervorlage' && !event\.haelt\) return FARBE\.offen/.test(fn),
  'Ohne Zuständigen schlägt Gelb die Artfarbe')
sagt(/offen:\s+'bg-amber-100/.test(fn),
  'Und zwar in Bernstein, nicht im Orange der Wiedervorlage')

/* ── Der Sprung aus dem Termin in die Arbeitsliste ───────────────────────

   Am 15.10.2026 meldete Paul, dass sich ein Termin als Admin aus dem
   Kalender nicht oeffnen laesst. Dahinter lagen drei getrennte Fehler:

   1. Die Zielseite folgte dem Besitz, nicht der Stufe:
      `isMyClosing ? '/closing' : '/setting'`. Wer den Termin eines fremden
      Closers oeffnete, landete im Setting - dort stand der Kontakt nie.
   2. `openLeadId` wurde nur in Closing.jsx ausgewertet. Im Setting
      passierte nach dem Klick gar nichts.
   3. Beide Seiten starten in „Meine". Ein fremder Kontakt steht in der
      geladenen Liste nicht, `find` gab undefined, und niemand sagte etwas.

   Dazu kam, dass eine Wiedervorlage `hotLeadId` mitgab, das sie nicht hat. */

const setting = fs.readFileSync('src/pages/Setting.jsx', 'utf8')
const closing = fs.readFileSync('src/pages/Closing.jsx', 'utf8')

// ── 1. Die Zielseite folgt der Stufe ────────────────────────────────────
sagt(/const SEITE_ZUR_STUFE = \{/.test(fn),
  'Die Zielseite steht in einer Tabelle über der Stufe')
sagt(ALLE_STUFEN.every(s => new RegExp(`\\[STUFE\\.${s.toUpperCase()}\\]:`).test(fn)),
  'Und zwar für jede Stufe, die es gibt - keine Lücke')
sagt(!/isMyClosing \? '\/closing' : '\/setting'/.test(fn),
  'Der Besitz entscheidet nicht mehr darüber, wohin es geht')
sagt(/stufe,\n/.test(fn) && /Die Stufe bestimmt die Zielseite/.test(fn),
  'Die Stufe reist mit dem Termin mit')

// Nachgebaut: dieselbe Tabelle, gefuettert mit echten Kontakten.
const SEITE = {
  [STUFE.OPENING]: '/setting', [STUFE.SETTING]: '/setting',
  [STUFE.CLOSING]: '/closing', [STUFE.GEWONNEN]: '/closing',
  [STUFE.VERLOREN]: '/closing'
}
const ziel = (lead) => SEITE[stufeVonLead(lead)]
/* Und die alte Regel daneben. Sie muss durchfallen, sonst prueft der Test
   oben nichts: Ein Test, der nichts messt, besteht genauso lautlos. */
const wieFrueher = (lead, ich) =>
  (lead.closerName === ich && stufeVonLead(lead) === STUFE.CLOSING) ? '/closing' : '/setting'

const ICH = 'Paul Probodziak'
const FREMD = { status: STATUS.ABSCHLUSS_VEREINBART, closerName: 'Marvin Kühn' }
const MEINER = { status: STATUS.ABSCHLUSS_VEREINBART, closerName: ICH }
const GEWONNEN = { status: STATUS.GEWONNEN, closerName: 'Marvin Kühn' }
const IM_SETTING = { status: STATUS.BERATUNG_VEREINBART, setterName: 'Marvin Kühn' }

sagt(ziel(FREMD) === '/closing',
  'Der Termin eines fremden Closers führt ins Closing')
sagt(wieFrueher(FREMD, ICH) === '/setting',
  'Früher führte er ins Setting - so sah der Fehler aus')
sagt(ziel(GEWONNEN) === '/closing',
  'Ein gewonnener Kontakt führt ins Closing')
sagt(wieFrueher(GEWONNEN, ICH) === '/setting',
  'Früher ins Setting, wo gewonnene gar nicht stehen')
sagt(ziel(MEINER) === '/closing' && wieFrueher(MEINER, ICH) === '/closing',
  'Beim eigenen Closing-Termin stimmten beide Regeln - darum fiel es nur der Leitung auf')
sagt(ziel(IM_SETTING) === '/setting',
  'Ein Kontakt im Setting führt weiter ins Setting')

// ── Eine Wiedervorlage hat kein Hot Lead ────────────────────────────────
sagt(/source === 'wiedervorlage'\n\s+\? selectedEvent\.leadId : selectedEvent\.hotLeadId/.test(fn),
  'Eine Wiedervorlage schickt ihre leadId mit, nicht undefined')

// ── 2. Beide Seiten werten die ID aus ───────────────────────────────────
for (const [name, quelle] of [['Setting', setting], ['Closing', closing]]) {
  sagt(/location\.state\?\.openLeadId/.test(quelle),
    `${name} liest die mitgeschickte Kennung`)
  // ── 3. Und sieht in „Alle" nach, bevor es aufgibt ──────────────────────
  sagt(/isAdmin\(\) && (ansicht !== 'alle'|viewMode !== 'all')/.test(quelle),
    `${name} schaltet für die Leitung einmal auf „Alle"`)
  sagt(/ausKalender\.current !== (id|openLeadId)/.test(quelle),
    `${name} versucht das nur einmal je Kontakt - sonst dreht es sich im Kreis`)
  sagt(/steht nicht in der (Setting|Closing)-Liste/.test(quelle),
    `${name} sagt es, wenn der Kontakt auch dort nicht steht`)
  sagt(/window\.history\.replaceState\(\{\}, document\.title\)/.test(quelle),
    `${name} räumt die Kennung weg, damit sich die Schublade nicht neu öffnet`)
}

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Kalender: beide Termine, Farbe nach Art, Sprung nach Stufe.')
