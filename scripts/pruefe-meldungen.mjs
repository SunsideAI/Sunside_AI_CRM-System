// Prueft, dass die kurzen Meldungen aus einer Hand kommen.
//
// Anlass: Es gab drei Bauweisen fuer dieselbe Sache - das Closing hatte eigene
// Toasts, zwei Verwaltungsseiten eine zweite Fassung in fremden Gruentoenen,
// und an acht Stellen sprang ein Browser-Dialog auf, der mit dem CRM nichts
// zu tun hat. Seit dem 28.09. gibt es components/Meldungen.jsx, und nur das.
//
// Aufruf: node scripts/pruefe-meldungen.mjs

import fs from 'node:fs'
import path from 'node:path'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

function dateien(ort) {
  const raus = []
  for (const e of fs.readdirSync(ort, { withFileTypes: true })) {
    const pfad = path.join(ort, e.name)
    if (e.isDirectory()) raus.push(...dateien(pfad))
    else if (['.js', '.jsx'].includes(path.extname(e.name))) raus.push(pfad)
  }
  return raus
}

const alle = dateien('src')

// Welche Datei ist ueberhaupt die App? Es lag lange eine zweite, alte App.jsx
// im Wurzelverzeichnis, die niemand mehr einbindet. Ein Einbau dort wirkt nicht
// und faellt trotzdem nicht auf. Also fragen wir den Einstieg, statt zu raten.
const einstieg = fs.readFileSync('src/main.jsx', 'utf8')
const treffer = einstieg.match(/import App from '(\.[^']+)'/)
const appDatei = treffer ? path.normalize(path.join('src', treffer[1])) + '.jsx' : null
sagt(Boolean(appDatei && fs.existsSync(appDatei)), `Einstieg zeigt auf eine App-Datei (${appDatei || 'nicht gefunden'})`)

// 1. Kein Browser-Dialog mehr in den Seiten.
const mitAlert = alle.filter(d => /(^|[^.\w])alert\(/.test(fs.readFileSync(d, 'utf8')))
sagt(mitAlert.length === 0, `Keine alert()-Dialoge (${mitAlert.join(', ') || 'keine'})`)

// 2. Keine zweite Toast-Bauweise: fest positionierte Kaesten oben rechts
//    gehoeren dem Bauteil.
const eigene = alle.filter(d =>
  d !== 'src/components/Meldungen.jsx' && /fixed top-4 right-4/.test(fs.readFileSync(d, 'utf8')))
sagt(eigene.length === 0, `Nur ein Ort für die Meldungen (${eigene.join(', ') || 'keine anderen'})`)

// 3. Und das Bauteil haengt ueber allen Seiten.
const app = appDatei && fs.existsSync(appDatei) ? fs.readFileSync(appDatei, 'utf8') : ''
sagt(/MeldungenProvider/.test(app), 'Der Provider umschließt die Seiten')

// 4. Die drei Arten haben Farben aus dem Haus, keine Fremdgruen.
const bauteil = fs.readFileSync('src/components/Meldungen.jsx', 'utf8')
sagt(!/bg-green-\d|text-green-\d/.test(bauteil), 'Das Bauteil nutzt die Hausfarben')
for (const art of ['erfolg', 'fehler', 'hinweis']) {
  sagt(new RegExp(`${art}:`).test(bauteil), `Art „${art}" gibt es`)
}

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Meldungen: eine Bauweise, drei Arten.')
