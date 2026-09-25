// Prueft die Maske des Erstanrufs gegen die Revision vom 25.09.
//
// Die Felder des Openers entscheiden, welche Mail und welches Video rausgeht.
// Nach dem Test am 25.09. sind drei Felder gestrichen, zwei umbenannt, und das
// priorisierte Ziel ist Pflicht, sobald mehr als ein Ziel im Gespraech fiel.
// Diese Pruefung haelt den Stand fest, damit er nicht zurueckwandert.
//
// Aufruf: node scripts/pruefe-erstanruf.mjs

import {
  UEBERGABE_1, BRANCHE, ZIEL, FELDER, maske, zieleFuerBranche, brancheSprache,
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
