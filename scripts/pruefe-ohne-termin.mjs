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
/* Ohne einen Weg zum Termin waere die Liste eine Anklage ohne Ausweg. Wo der
   Weg steht, pruefen die Zeilen weiter unten: in der Auswahl der
   Gespraechsmaske, nicht als eigener Knopf daneben. */

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

// ── Der Weg zum Termin steht in der Auswahl, nicht daneben ───────────────
/* Ein eigener Knopf ueber der Maske war die erste Fassung. Paul wollte den
   Weg dort, wo alle anderen Ausgaenge stehen - das ist auch der Ort, an dem
   man ihn sucht, so wie im Opening. */
const maskeDatei = fs.readFileSync('src/components/SetterUebergabe.jsx', 'utf8')

sagt(/const TERMIN_BUCHEN = 'termin_buchen'/.test(maskeDatei),
  'Die Buchung ist ein eigener Ausgang der Gesprächsmaske')
sagt(/name: 'Beratungsgespräch buchen',\s*\n\s*nurOhneTermin: true/.test(maskeDatei),
  'Sie erscheint nur bei Kontakten ohne Termin')
sagt(/const hatTermin = Boolean\(lead\?\.terminDatum\)/.test(maskeDatei),
  'Dafür wird geprüft, ob überhaupt ein Termin hinterlegt ist')
sagt(/if \(ablauf === 'termin_buchen'\)/.test(maskeDatei),
  'Die Auswahl öffnet den Terminwähler')
sagt(/onGespeichert\?\.\(\{ terminGebucht: true \}\)/.test(maskeDatei),
  'Und meldet den ersten Termin als eigenen Fall, nicht als Verschiebung')
sagt(/ist gebucht und steht im Kalender/.test(setting),
  'Die Rückmeldung sagt „gebucht“, nicht „neu gelegt“')

/* Die Gegenrichtung: Was einen Termin voraussetzt, darf ohne Termin nicht in
   der Auswahl stehen. Ohne Termin kann niemand nicht erschienen sein. */
sagt(/brauchtTermin: true/.test(maskeDatei),
  'Ausgänge, die einen Termin voraussetzen, sind als solche markiert')
sagt(/\.filter\(a => \(a\.nurOhneTermin \? !hatTermin : true\) && \(a\.brauchtTermin \? hatTermin : true\)\)/.test(maskeDatei),
  'Die Auswahl zeigt nur, was zum Zustand des Kontakts passt')

/* Und die alten Knoepfe sind weg - sonst gaebe es zwei Wege zum selben Ziel.
   Zuerst fiel der fuer den ersten Termin, am 15.10.2026 auch der fuer den
   geplatzten: Er stand als einziges Bedienelement in der Schublade, weil die
   Maske bei geplatztem Status gar nicht rendert. */
sagt(!/Beratungsgespräch buchen<\/button>|<Calendar className="w-4 h-4" \/> Beratungsgespräch/.test(setting),
  'Kein eigener Buchen-Knopf mehr über der Maske')

/* Ein geplatzter Termin ist kein Termin. Die Maske behandelt ihn wie gar
   keinen: dieselben zwei Wege, buchen oder gleich sprechen. */
sagt(/const terminGeplatzt = \[STATUS\.TERMIN_ABGESAGT, STATUS\.NICHT_ERSCHIENEN\]\.includes\(status\)/.test(maskeDatei),
  'Ein abgesagter oder verpasster Termin ist als geplatzt erkannt')
sagt(/const hatTermin = Boolean\(lead\?\.terminDatum\) && !terminGeplatzt/.test(maskeDatei),
  'Und zählt damit nicht mehr als gültiger Termin')
sagt(/if \(status !== STATUS\.BERATUNG_VEREINBART && !terminGeplatzt\) return null/.test(maskeDatei),
  'Die Maske zeigt sich auch bei geplatztem Termin')
sagt(/terminGeplatzt \? 'Beratungsgespräch neu buchen' : a\.name/.test(maskeDatei),
  'Dort heißt der Eintrag „neu buchen“ — es gab ja einen')

// Die Filterlogik durchgerechnet
const auswahl = (hatTermin) => [
  { name: 'Bitte wählen' },
  { name: 'Beratungsgespräch buchen', nurOhneTermin: true },
  { name: 'Setting starten' },
  { name: 'Kunde nicht erschienen', brauchtTermin: true },
  { name: 'Termin abgesagt', brauchtTermin: true },
  { name: 'Termin verschoben', brauchtTermin: true },
].filter(a => (a.nurOhneTermin ? !hatTermin : true) && (a.brauchtTermin ? hatTermin : true))
  .map(a => a.name)

const ohne = auswahl(false)   // nie ein Termin gebucht ODER geplatzt
const mit = auswahl(true)     // gültiger Termin steht
sagt(ohne.includes('Beratungsgespräch buchen') && ohne.includes('Setting starten'),
  'Ohne Termin: buchen oder gleich sprechen')
sagt(!ohne.some(n => ['Kunde nicht erschienen','Termin abgesagt','Termin verschoben'].includes(n)),
  'Ohne Termin: nichts, was einen Termin voraussetzt')
sagt(!mit.includes('Beratungsgespräch buchen'),
  'Mit Termin: kein zweiter Ersttermin')
sagt(mit.includes('Termin verschoben') && mit.includes('Kunde nicht erschienen'),
  'Mit Termin: die gewohnten Ausgänge bleiben')

/* Nach einem geplatzten Termin ergibt dasselbe Bild Sinn wie ohne Termin:
   Man kann nichts mehr absagen, verschieben oder verpassen - nur neu buchen
   oder den Kunden doch noch ans Telefon bekommen. */
const nachGeplatzt = auswahl(false)
sagt(!nachGeplatzt.some(n => ['Kunde nicht erschienen','Termin abgesagt','Termin verschoben'].includes(n)),
  'Nach einem geplatzten Termin: nichts, was einen Termin voraussetzt')
sagt(nachGeplatzt.includes('Beratungsgespräch buchen'),
  'Nach einem geplatzten Termin: neu buchen steht zur Wahl')

if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Ohne Termin: sichtbar statt liegengeblieben.')
