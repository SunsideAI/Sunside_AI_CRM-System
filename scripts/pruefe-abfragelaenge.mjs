/* Eine Liste von Ids gehoert nicht in die Adresse einer Abfrage.

   Am 14.10.2026 meldete Paul "Fehler beim Laden der Leads" im Opening. Die
   Suche war unschuldig: Er hatte den Vertriebler-Filter auf Marvin Schuetze
   gesetzt. Der Filter holte erst saemtliche Zuteilungen dieser Person und
   haengte ihre Lead-Ids einzeln an die Abfrage. Bei Patrick Wolfram (3.901
   Zuteilungen) kam die Antwort im Klartext zurueck:

       414 Request-URI Too Large - cloudflare

   Betroffen war jeder mit grossem Bestand, also genau die, nach denen man
   filtert: Max Lehmann 6.298, Patrick 3.901, Manuel Schaelling 2.453, Marvin
   2.199. Mit 566 Zuteilungen (Paul selbst) lief es noch - deshalb fiel es
   lange niemandem auf, und deshalb prueft diese Datei das Muster und nicht
   eine Zahl.

   Seitdem gilt: Wer ueber eine Zuteilung filtert, nimmt einen Join. Der
   laeuft in der Datenbank und ist von der Menge unabhaengig. */
import fs from 'fs'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const leads = fs.readFileSync('netlify/functions/leads.js', 'utf8')

// ── Der Vertriebler-Filter ───────────────────────────────────────────────
sagt(/const nachVertrieblerFiltern = Boolean\(vertriebler && vertriebler !== 'all'\)/.test(leads),
  'Der Vertriebler-Filter wird einmal entschieden, nicht zweimal geprüft')
sagt(/\.select\(nachVertrieblerFiltern \? '\*, lead_assignments!inner\(user_id\)' : '\*'/.test(leads),
  'Die Basis-Abfrage holt den Join nur dann dazu, wenn gefiltert wird')
sagt(/if \(nachVertrieblerFiltern\) \{\s*\n\s*query = query\.eq\('lead_assignments\.user_id', vertriebler\)/.test(leads),
  'Gefiltert wird über die verknüpfte Tabelle')

/* Der Rueckfall darf nicht zurueckkehren: kein Sammeln von lead_id aus
   lead_assignments, um daraus eine Id-Liste zu bauen. */
sagt(!/from\('lead_assignments'\)\s*\n\s*\.select\('lead_id'\)\s*\n\s*\.eq\('user_id', vertriebler\)/.test(leads),
  'Die Zuteilungen werden nicht mehr eingesammelt, um Ids zu sammeln')
sagt(!/query = query\.in\('id', leadIds\)/.test(leads),
  'Und keine Id-Liste mehr an die Abfrage gehängt')

/* Der gleiche Weg war fuer den eigenen Bestand schon da - er bleibt. */
sagt(/\.select\('\*, lead_assignments!inner\(user_id\)', \{ count: 'exact' \}\)[\s\S]{0,80}\.eq\('lead_assignments\.user_id', userId\)/.test(leads),
  'Der eigene Bestand läuft weiter über denselben Join')

/* Warum es passiert ist, muss im Code stehen - sonst baut es jemand zurueck,
   weil eine Id-Liste beim Lesen harmloser aussieht als ein Join. */
sagt(/414|Request-URI Too Large/.test(leads),
  'Der Grund steht im Quelltext, mit der Fehlermeldung von damals')

// ── Die anderen Id-Listen: gemessen, nicht geraten ───────────────────────
/* Zwei weitere Stellen bauen Id-Listen, beide bleiben bewusst stehen:

     follow-up.js  Lead-Infos zu Kanban-Aktionen   118 Zeilen  ~4,5 KB
     hot-leads.js  Closer-Bestand freigeben        179 Zeilen  ~6,8 KB

   Beide liegen weit unter der Grenze (566 Zuteilungen, rund 22 KB, liefen
   noch). Sie werden hier nur festgehalten, damit beim naechsten Fehler
   dieser Art sofort klar ist, wo sonst noch Listen entstehen - und damit
   niemand sie unbesehen nachbaut, wo es um Zuteilungen geht. */
const weitere = [
  ['netlify/functions/follow-up.js', /\.in\('id', leadIds\)/, 'Follow-Up: Lead-Infos zu Aktionen'],
  ['netlify/functions/hot-leads.js', /\.in\('id', leadIds\)/, 'Hot Leads: Closer-Bestand freigeben'],
]
for (const [datei, muster, was] of weitere) {
  sagt(muster.test(fs.readFileSync(datei, 'utf8')),
    `${was} baut weiter eine Id-Liste (bekannt, Menge unkritisch)`)
}

if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Abfragelänge: Zuteilungen laufen über Joins, nicht über Id-Listen.')
