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
/* Pille und Zusatz baut eine Komponente - sonst stuende der Zusatz in der
   Liste und fehlte im Dashboard, wo derselbe Kontakt auftaucht. */
const anz = fs.readFileSync('src/components/StatusAnzeige.jsx', 'utf8')
sagt(/statusBasisVonLead/.test(anz) && /statusZusatzVonLead/.test(anz),
  'Eine Komponente baut Pille und Zusatz')
const tab = fs.readFileSync('src/components/LeadTabelle.jsx', 'utf8')
sagt(/<StatusAnzeige/.test(tab), 'Die Liste nutzt sie')
const dash = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8')
sagt((dash.match(/<StatusAnzeige/g) || []).length >= 3,
  'Das Dashboard an allen drei Stellen')
/* Das Dashboard zeigte den rohen Datenbankwert: „Lead" statt
   „Beratungsgespraech vereinbart", und die Farbe traf keinen Zweig. */
sagt(/switch \(normalisiere\(status\)\)/.test(dash),
  'Und waehlt die Farbe ueber den Altbestand hinweg')
sagt(/statusBasisVonLead/.test(st) && /export function statusZusatzVonLead/.test(st),
  'Beide Teile sind einzeln abrufbar')
sagt(/anzeigeNameVonLead\(gewaehlt\)/.test(fs.readFileSync('src/pages/Setting.jsx', 'utf8')),
  'Die Schublade im Setting ebenso')

/* „Zurueck an den Vorgaenger" stand im Closing ganz oben in der Schublade,
   vor allem, was man dort wirklich sucht - im Setting steht es am Ende.
   Jetzt im Aktionsmenue der Fussleiste, mit derselben Rueckmeldung danach
   wie im Setting. */
const cl = fs.readFileSync('src/pages/Closing.jsx', 'utf8')
sagt(/name: 'Zurück an den Vorgänger', icon: Undo2/.test(cl),
  'Die Rückgabe steht im Aktionsmenü')
sagt(/ruecknahmeZiel\(selectedLead\.status\) && \{/.test(cl),
  'Und nur dort, wo es einen Schritt zurück gibt')
sagt(/offen=\{zurueckOffen\}/.test(cl) && /onSchliessen=\{\(\) => setZurueckOffen\(false\)\}/.test(cl),
  'Der Dialog wird von dort gesteuert')
sagt(/meldung\.erfolg\(ziel/.test(cl),
  'Nach der Rückgabe steht da, wohin der Kontakt gegangen ist')

const rk = fs.readFileSync('src/components/RueckgabeKnopf.jsx', 'utf8')
sagt(/if \(gesteuert\) return null/.test(rk),
  'Im gesteuerten Fall zeigt die Komponente keinen zweiten Knopf')
sagt(/scrollIntoView/.test(rk),
  'Und scrollt zum Dialog, wenn er aus der Fußleiste geöffnet wird')

/* Die Statuskette war als Leitplanke gedacht und hat vor allem die Korrektur
   verhindert. Dazu kannte die Datenbankfunktion die alten Statuswerte nicht:
   Bei 391 Kontakten war gar kein Wechsel moeglich. Belegt am 08.10.2026 an
   Priebe & Sorensen - Angebot laeuft, Status liess sich nicht setzen. */
sagt(/!\[STATUS\.GEWONNEN, 'Abgeschlossen'\]\.includes\(v\)/.test(st),
  'Gesperrt ist nur noch, was aus einem Endzustand herausführt')
sagt(/an „Abgeschlossen" haengt die Abrechnungs-Bridge|Abrechnungs-Bridge/i.test(st),
  'Und warum: an „Abgeschlossen" hängt die Abrechnung')

const mig = fs.readFileSync('supabase/migrations/20261008_altstatus_bereinigen.sql', 'utf8')
sagt(/create or replace function public\.status_normalisieren/.test(mig),
  'Die Datenbank kennt die alten Statuswerte')
for (const alt2 of ['Lead', 'Im Closing', 'Termin verschoben', 'Verloren'])
  sagt(new RegExp(`when '${alt2}'`).test(mig), `Sie übersetzt „${alt2}"`)
sagt(/when von in \('Abgeschlossen', 'Gewonnen'\) then false/.test(mig),
  'Und sperrt dieselben Endzustände wie der Code')

/* Die Farbe folgt dem angezeigten Stand, nicht dem gespeicherten Wert. Sie
   las vorher lead.status roh und verglich woertlich: Bei den Altwerten traf
   sie keinen Zweig, und „Abschlussgespraech vereinbart" - fuer den Setter das
   Ziel - sah aus wie ein Zwischenstand. */
const farbe = fs.readFileSync('src/utils/statusfarbe.js', 'utf8')
sagt(/statusBasisVonLead\(lead, stufe\) === STATUS\.ABSCHLUSS_VEREINBART/.test(farbe),
  'Die Farbe misst am angezeigten Stand')
sagt(/uebergeben\s*\n?\s*\|\|/.test(farbe) && /bg-success-container/.test(farbe),
  'Ein vereinbartes Abschlussgespräch ist grün')
sagt(/normalisiere\(lead\?\.status\)/.test(farbe),
  'Und greift auch bei alten Statuswerten')
sagt(/statusFarbe\(z\.roh, 'setting'\)/.test(fs.readFileSync('src/pages/Setting.jsx', 'utf8')),
  'Das Setting nutzt sie')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Closing: der Status folgt der Zuständigkeit, das Ergebnis dem Termin.')
