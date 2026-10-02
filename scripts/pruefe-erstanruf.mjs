// Prueft die Maske des Erstanrufs gegen die Revision vom 25.09.
//
// Die Felder des Openers entscheiden, welche Mail und welches Video rausgeht.
// Nach dem Test am 25.09. sind drei Felder gestrichen, zwei umbenannt, und das
// priorisierte Ziel ist Pflicht, sobald mehr als ein Ziel im Gespraech fiel.
// Diese Pruefung haelt den Stand fest, damit er nicht zurueckwandert.
//
// Aufruf: node scripts/pruefe-erstanruf.mjs
import fs from 'node:fs'

import {
  UEBERGABE_1, BRANCHE, ZIEL, FELDER, maske, zieleFuerBranche, brancheSprache, brancheVonLead, istSv,
  uebergabePruefen, zielAbleiten
} from '../shared/felder.js'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const spalten = maske(UEBERGABE_1).map(f => f.schluessel)

// 1. Gestrichen
for (const weg of ['entscheider', 'fragt_nach_konditionen']) {
  sagt(!spalten.includes(weg), `Erstanruf ohne "${weg}"`)
}
sagt(!FELDER.fragt_nach_konditionen, 'Feld "fragt_nach_konditionen" ist ganz weg')
sagt(!('OFFEN' in ZIEL), '„Noch nicht besprochen" gibt es nicht mehr')
sagt(!maske(UEBERGABE_1).some(f => f.frage?.()?.hinweis),
  'Kein Opener-Hinweis mehr über dem Notizfeld')

// 2. Umbenannt
sagt(FELDER.vorhaben.name === 'Will etwas Neues aufbauen (eigenes Vorhaben)',
  `Vorhaben heißt "${FELDER.vorhaben.name}"`)

// 3. Ziele je Branche
const namen = (branche) => zieleFuerBranche(branche).map(z => brancheSprache(z, { berufsgruppe: branche }))
sagt(namen(BRANCHE.MAKLER).join(' · ') === 'Mehr Eigentümer-Anfragen · Mehr Kaufinteressenten · Zeitersparnis und Entlastung',
  `Makler: ${namen(BRANCHE.MAKLER).join(' · ')}`)
sagt(namen(BRANCHE.SV).join(' · ') === 'Mehr Bewertungsanfragen · Zeitersparnis und Entlastung',
  `Sachverständiger: ${namen(BRANCHE.SV).join(' · ')}`)
sagt(namen(BRANCHE.ANDERE).join(' · ') === 'Mehr Anfragen · Zeitersparnis und Entlastung',
  `andere: ${namen(BRANCHE.ANDERE).join(' · ')}`)

// 3b. Die Branche steht fest, bevor der Erstanruf sie einträgt.
//
// `berufsgruppe` setzt der Opener. Bis dahin war sie leer, und alles rechnete
// mit einem Makler: Bei Verowert - einem Sachverständigen, dessen Erstanruf
// noch nicht gelaufen war - stand im Beratungsgespräch „Mehr
// Kaufinteressenten" zur Wahl, ein Ziel, das es in diesem Beruf nicht gibt.
// Die Kategorie aus dem Import weiß es längst.
const BRANCHENFAELLE = [
  // Kategorien, die einen Sachverständigen bezeichnen (1.329 Kontakte).
  ['Sachverständiger', true], ['Immobiliensachverständiger', true],
  ['Immobiliengutachter', true], ['Real estate appraiser', true],
  // Und die, die es nicht tun.
  ['Immobilienmakler', false], ['Immobilienagentur', false],
  ['Immobilienvermittlung', false], ['Real estate agent', false],
  ['Immobilienberater', false], [null, false], ['', false],
]
let branchenfehler = 0
for (const [kategorie, sollSv] of BRANCHENFAELLE) {
  if (istSv({ berufsgruppe: null, kategorie }) !== sollSv) {
    branchenfehler++
    console.log(`    ✗ „${kategorie}" → ${sollSv ? 'kein SV erkannt' : 'fälschlich SV'}`)
  }
}
sagt(branchenfehler === 0,
  `${BRANCHENFAELLE.length} Kategorien: Sachverständiger auch ohne Erstanruf erkannt`)

// Was der Opener einträgt, schlägt die Kategorie - er hat mit dem Menschen
// gesprochen, der Import nur mit einem Verzeichnis.
sagt(brancheVonLead({ berufsgruppe: BRANCHE.MAKLER, kategorie: 'Immobiliengutachter' }) === BRANCHE.MAKLER,
  'Der Erstanruf schlägt die Kategorie')
sagt(brancheVonLead({ berufsgruppe: null, kategorie: null }) === null,
  'Ohne beides wird nicht geraten')

// Und die Auswahl im Beratungsgespräch hängt an derselben Stelle wie die im
// Erstanruf - vorher hing sie an einer festen Liste.
const verowert = { berufsgruppe: null, kategorie: 'Sachverständiger' }
sagt(!FELDER.ziel.optionen(verowert).includes(ZIEL.KAEUFER),
  'Verowert bekommt „Mehr Kaufinteressenten" nicht mehr angeboten')
sagt(FELDER.ziel.optionen({ kategorie: 'Immobilienmakler' }).includes(ZIEL.KAEUFER),
  'Der Makler schon')
sagt(typeof FELDER.ziel.optionen === 'function' && typeof FELDER.ziele.optionen === 'function',
  'Beide Zielfelder fragen die Branche, keines eine feste Liste')

// Die Maske muss die Kategorie überhaupt mitführen, sonst nützt die Regel nichts.
const uebergabe = fs.readFileSync('src/components/SetterUebergabe.jsx', 'utf8')
sagt(/'berufsgruppe', 'kategorie'/.test(uebergabe),
  'Das Beratungsgespräch führt die Kategorie mit')

// 4. Priorisiertes Ziel: Pflicht, sobald es etwas zu priorisieren gibt
const basis = { berufsgruppe: BRANCHE.MAKLER, schmerzpunkt_wortlaut: 'x', vorhaben: false, mobilnummer: '0170' }
const offen = (l) => uebergabePruefen(l, UEBERGABE_1).offen.map(o => o.schluessel)
const einZiel = { ...basis, ziele: [ZIEL.EIGENTUEMER] }
const zweiOhne = { ...basis, ziele: [ZIEL.EIGENTUEMER, ZIEL.ZEIT] }
const zweiMit = { ...zweiOhne, ziel_prioritaet: ZIEL.ZEIT }
sagt(!offen(einZiel).includes('ziel_prioritaet'), 'Ein Ziel: keine Priorisierung nötig')
sagt(offen(zweiOhne).includes('ziel_prioritaet'), 'Zwei Ziele ohne Vorrang: blockiert')
sagt(!offen(zweiMit).includes('ziel_prioritaet'), 'Zwei Ziele mit Vorrang: frei')

// 5. Das abgeleitete Ziel steuert die Mail - es darf nie leer bleiben, wenn
//    Ziele erfasst sind.
sagt(zielAbleiten(einZiel).ziel === ZIEL.EIGENTUEMER, 'Ein Ziel wird übernommen')
sagt(zielAbleiten(zweiMit).ziel === ZIEL.ZEIT, 'Das priorisierte Ziel gewinnt')

console.log(`\n${spalten.length} Felder im Erstanruf: ${spalten.join(', ')}`)
if (befunde.length) {
  console.error('\nFEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Erstanruf: Stand der Revision vom 25.09.')
