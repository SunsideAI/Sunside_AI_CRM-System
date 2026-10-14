/* Ein Kontakt im Setting, fuer den nie ein Termin gebucht wurde.

   Am 14.10.2026 fiel beides an einem Tag auf. Morgens Westfalenmakler: Der
   Setter hatte "Abschlussgespraech vereinbart" dokumentiert und den Termin
   nur als Text in die Notiz geschrieben ("14.10. 14:00 closing"). Das
   Terminfeld blieb leer, also stand nichts im Kalender, kein Closer war
   zustaendig, und der Kunde hatte keine Einladung - der Termin war an dem
   Tag, an dem es auffiel. Mittags dann die Gegenrichtung: 22 Kontakte standen
   im Setting, ohne dass je ein Termin gebucht wurde, darunter drei Anfragen
   von der Website mit 7, 42 und 47 Tagen Liegezeit. Eine davon hatte nicht
   einmal einen Setter und stand damit in keiner Liste eines Menschen.

   Beide Male war die Ursache dieselbe: Es gab keinen Ort, an dem ein Kontakt
   ohne Termin sichtbar wird. "Anstehend" zeigte sie zwischen echten Terminen,
   nur ohne Datum, und "Uebergeben" zeigte sie als erledigt.

   Seitdem gilt: "Anstehend" heisst, der Termin steht. Alles andere sammelt
   "Ohne Termin". Die Liste heisst bewusst nicht "Termin vereinbaren" - nicht
   jeder Kontakt braucht einen Termin, manchmal ist das Telefonat selbst das
   Gespraech. */
import fs from 'fs'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const setting = fs.readFileSync('src/pages/Setting.jsx', 'utf8')

// ── Die Liste gibt es, und sie heisst nach dem Zustand ───────────────────
sagt(/\{ wert: 'ohne_termin', name: 'Ohne Termin',/.test(setting),
  'Es gibt den Filter „Ohne Termin"')
sagt(/const ohneTermin = \(l\) =>/.test(setting),
  'Die Bedingung steht als eigene Funktion, nicht inline im Filter')

/* Beide Wege hierher muessen erfasst sein - sonst faengt die Liste nur die
   Haelfte, und die andere bleibt genauso liegen wie vorher. */
sagt(/imSetting\(l\) && l\.status === STATUS\.BERATUNG_VEREINBART && !l\.terminDatum/.test(setting),
  'Erfasst: Anfrage im Setting ohne Beratungstermin')
sagt(/anCloserUebergeben\(l\) && !l\.termin_abschlussgespraech/.test(setting),
  'Erfasst: Übergabe dokumentiert, aber kein Abschlusstermin (Westfalenmakler)')

// ── „Anstehend" wird dadurch ehrlich ─────────────────────────────────────
sagt(/trifft: l => imSetting\(l\) && l\.status === STATUS\.BERATUNG_VEREINBART && l\.terminDatum \}/.test(setting),
  'Anstehend verlangt jetzt einen Termin')

// ── Und man kann aus der Liste heraus handeln ────────────────────────────
/* Ohne Buchen-Knopf waere die Liste eine Anklage ohne Ausweg. Der Knopf hing
   vorher daran, dass vorher etwas geplatzt sein musste - eine Anfrage von der
   Website hat aber nie einen Termin gehabt, der platzen koennte. */
sagt(/gewaehlt\.status === STATUS\.BERATUNG_VEREINBART && !gewaehlt\.terminDatum && \(/.test(setting),
  'Ein Kontakt ohne Termin lässt sich aus der Schublade heraus terminieren')
sagt(/Beratungsgespräch buchen/.test(setting),
  'Der Knopf heißt „buchen", nicht „neu buchen" — es gab ja keinen')

/* Der andere Weg muss offen bleiben: anrufen und sofort dokumentieren. Die
   Gespraechsmaske haengt an keiner Terminbedingung, und das soll so sein. */
const maske = setting.slice(setting.indexOf('<SetterUebergabe'))
sagt(!/termin/i.test(maske.slice(0, maske.indexOf('/>'))),
  'Die Gesprächsmaske hängt an keinem Termin — direkt setten bleibt möglich')

// ── Die Bedingung selbst, nachgebaut und durchgerechnet ──────────────────
/* Nachgebaut statt importiert: Setting.jsx ist eine React-Seite, die Node
   nicht laedt. Die Faelle stammen aus den echten Daten vom 14.10.2026. */
const BERATUNG_VEREINBART = 'Beratungsgespräch vereinbart'
const imSetting = (l) => l._imSetting
const anCloserUebergeben = (l) => l.ergebnis_beratung === 'Abschlussgespräch vereinbart'
const ohneTermin = (l) =>
  (imSetting(l) && l.status === BERATUNG_VEREINBART && !l.terminDatum)
  || (anCloserUebergeben(l) && !l.termin_abschlussgespraech)

const faelle = [
  ['Website-Anfrage, nie terminiert (Hw-Immobilienservice)',
   { _imSetting: true, status: BERATUNG_VEREINBART, terminDatum: '' }, true],
  ['Übergabe ohne Abschlusstermin (Westfalenmakler)',
   { _imSetting: false, status: 'Nicht erschienen', terminDatum: '2026-10-06T11:00:00+00:00',
     ergebnis_beratung: 'Abschlussgespräch vereinbart', termin_abschlussgespraech: null }, true],
  ['Normaler Termin steht (J&P Immobilien)',
   { _imSetting: true, status: BERATUNG_VEREINBART, terminDatum: '2026-10-14T08:30:00+00:00' }, false],
  ['Übergeben MIT Abschlusstermin',
   { _imSetting: false, status: BERATUNG_VEREINBART, terminDatum: '2026-10-01T09:00:00+00:00',
     ergebnis_beratung: 'Abschlussgespräch vereinbart',
     termin_abschlussgespraech: '2026-10-20T09:00:00+00:00' }, false],
]
for (const [name, lead, erwartet] of faelle) {
  sagt(ohneTermin(lead) === erwartet,
    `${erwartet ? 'Gefangen' : 'Nicht gefangen'}: ${name}`)
}

if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Ohne Termin: sichtbar statt liegengeblieben.')
