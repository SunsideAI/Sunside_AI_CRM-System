/* Dieselben Stammdaten stehen in zwei Tabellen: leads und hot_leads. Wer sie
   auf einer Seite pflegt, erwartet sie auf der anderen - sonst bucht die
   Terminvergabe mit einer Adresse, die im CRM laengst korrigiert ist.

   Belegt am 06.10.2026: 35 Kontakte trugen auf beiden Seiten verschiedene
   Mailadressen, bei 14 davon war die Pflege am kalten Lead juenger. Die
   Spiegelung gab es nur in eine Richtung und nur fuer die Namen. */
import fs from 'fs'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const hot = fs.readFileSync('netlify/functions/hot-leads.js', 'utf8')
const kalt = fs.readFileSync('netlify/functions/leads.js', 'utf8')

const FELDER = ['ansprechpartner_vorname', 'ansprechpartner_nachname',
                'anrede', 'mail', 'telefonnummer']

const hotBlock = hot.slice(hot.indexOf('const STAMMFELDER'),
                           hot.indexOf('const STAMMFELDER') + 600)
const kaltBlock = kalt.slice(kalt.indexOf('const STAMMFELDER'),
                             kalt.indexOf('const STAMMFELDER') + 900)

sagt(hotBlock.length > 20, 'Der Kontakt spiegelt seine Stammdaten')
sagt(kaltBlock.length > 20, 'Und der kalte Lead ebenso - die Gegenrichtung fehlte')

for (const feld of FELDER) {
  sagt(new RegExp(feld).test(hotBlock), `Kontakt → Lead: ${feld}`)
  sagt(new RegExp(feld).test(kaltBlock), `Lead → Kontakt: ${feld}`)
}

sagt(/from\('leads'\)[\s\S]{0,80}\.update\(stammAenderung\)/.test(hot),
  'Der Kontakt schreibt in leads')
sagt(/from\('hot_leads'\)[\s\S]{0,80}\.update\(stammAenderung\)[\s\S]{0,80}\.eq\('lead_id'/.test(kalt),
  'Und der Lead in hot_leads, ueber lead_id')

/* Kein throw: Der Datensatz steht schon. Aber benannt, sonst laufen die
   beiden Seiten still auseinander. */
sagt(/console\.error\('Stammdaten in leads spiegeln:'/.test(hot) &&
     /console\.error\('Stammdaten in hot_leads spiegeln:'/.test(kalt),
  'Eine fehlgeschlagene Spiegelung steht im Protokoll, statt still zu bleiben')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Stammdaten: beide Seiten, beide Richtungen.')
