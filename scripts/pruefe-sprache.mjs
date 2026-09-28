// Prueft die Sprache der Oberflaeche: keine Gedankenstriche im Fliesstext.
//
// Anlass: Feedback 21.09. und 25.09. - „es sind noch viele Em-Dashes und
// KI-Muster ueberall im CRM". Der Gedankenstrich ist das auffaelligste davon:
// Er steht in fast jedem Satz, den eine Maschine schreibt, und in kaum einem,
// den ein Mensch tippt. In Kommentaren stoert er niemanden, sichtbar schon.
//
// Erlaubt bleibt der Strich als Zeichen fuer „nichts": In Tabellen und Listen
// steht '—' fuer eine leere Zelle, das ist Satz und keine Sprache.
//
// Aufruf: node scripts/pruefe-sprache.mjs

import fs from 'node:fs'
import path from 'node:path'

const ORTE = ['src', 'shared', 'netlify/functions']
const ENDUNGEN = ['.js', '.jsx', '.mjs']
const STRICH = '—'

function dateien(ort) {
  const gefunden = []
  for (const eintrag of fs.readdirSync(ort, { withFileTypes: true })) {
    const pfad = path.join(ort, eintrag.name)
    if (eintrag.isDirectory()) gefunden.push(...dateien(pfad))
    else if (ENDUNGEN.includes(path.extname(eintrag.name))) gefunden.push(pfad)
  }
  return gefunden
}

/**
 * Die Zeilen einer Datei, die wirklich Programm sind.
 *
 * Kommentare zaehlen nicht: weder `//`, noch `/* ... *\/` ueber mehrere
 * Zeilen, noch die JSX-Fassung `{/* ... *\/}`. Sie stehen im Quelltext, nicht
 * auf dem Schirm. Ein Blockkommentar laeuft ueber Zeilen hinweg, deshalb
 * merkt sich der Durchlauf, ob er gerade drin steckt.
 */
function ohneKommentare(zeilen) {
  const raus = new Set()
  let drin = false
  zeilen.forEach((zeile, i) => {
    if (drin) {
      raus.add(i)
      if (zeile.includes('*/')) drin = false
      return
    }
    const z = zeile.trim()
    if (z.startsWith('//')) { raus.add(i); return }
    const auf = zeile.indexOf('/*')
    if (auf > -1) {
      raus.add(i)
      if (!zeile.includes('*/', auf + 2)) drin = true
    }
  })
  return raus
}

/** Der Strich allein, als Platzhalter fuer eine leere Angabe. */
const istLeerzeichen = (zeile) =>
  /(['"`>]\s*)—(\s*['"`<])/.test(zeile) || /[?:]\s*'—'/.test(zeile)

const befunde = []
let geprueft = 0

for (const ort of ORTE) {
  for (const datei of dateien(ort)) {
    geprueft++
    const zeilen = fs.readFileSync(datei, 'utf8').split('\n')
    const kommentar = ohneKommentare(zeilen)
    zeilen.forEach((zeile, i) => {
      if (!zeile.includes(STRICH)) return
      if (kommentar.has(i) || istLeerzeichen(zeile)) return
      befunde.push(`${datei}:${i + 1}  ${zeile.trim().slice(0, 100)}`)
    })
  }
}

// Und die drei KI-Aufrufe sagen es der Maschine selbst.
const PROMPTS = [
  'netlify/functions/ai-analysis.js',
  'netlify/functions/fragen-vorschlag.js',
  'netlify/functions/mail-bausteine.js'
]
for (const datei of PROMPTS) {
  const quelle = fs.readFileSync(datei, 'utf8')
  if (!/Keine Gedankenstriche/.test(quelle)) {
    befunde.push(`${datei}  sagt der KI nicht, dass sie keine Gedankenstriche setzen soll`)
  }
}

console.log(`${geprueft} Dateien geprüft.`)
if (befunde.length) {
  console.error(`\nGedankenstriche im sichtbaren Text (${befunde.length}):`)
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Sprache: kein Gedankenstrich im Fließtext, die KI weiß es auch.')
