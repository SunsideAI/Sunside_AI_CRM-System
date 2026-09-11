// Prueft, dass die Zugangskontrolle der Functions zusammenpasst.
//
// Anlass: Die Calendly-Signaturpruefung war versehentlich IM OPTIONS-Block
// gelandet, hinter dessen return - sie lief nie. Und set-password stand in der
// Liste der offenen Endpunkte, verlangte aber eine Admin-Sitzung, sodass jedes
// Passwort-Setzen in einem 401 endete. Beides faellt beim Buendeln nicht auf
// und beim Lesen leicht durch.
//
// Aufruf: node scripts/pruefe-wachen.mjs

import fs from 'node:fs'
import path from 'node:path'

const VERZEICHNIS = 'netlify/functions'
const befunde = []

// Die Liste der ohne Token erreichbaren Endpunkte aus dem Frontend
const sitzung = fs.readFileSync('src/utils/sitzung.js', 'utf8')
const offen = [...sitzung.matchAll(/const OFFEN = \[([^\]]+)\]/g)]
  .flatMap(m => m[1].split(',').map(t => t.trim().replace(/['"]/g, '')))
  .filter(Boolean)

/** Findet das Ende des OPTIONS-Blocks durch Klammerzaehlung. */
function optionsBlock(quelle) {
  const m = /httpMethod\s*===\s*'OPTIONS'/.exec(quelle)
  if (!m) return null
  const auf = quelle.indexOf('{', m.index)
  let tiefe = 0
  for (let i = auf; i < quelle.length; i++) {
    if (quelle[i] === '{') tiefe++
    else if (quelle[i] === '}' && --tiefe === 0) return { auf, zu: i }
  }
  return null
}

for (const datei of fs.readdirSync(VERZEICHNIS).filter(f => f.endsWith('.js'))) {
  const pfad = path.join(VERZEICHNIS, datei)
  const quelle = fs.readFileSync(pfad, 'utf8')
  const name = datei.replace(/\.js$/, '')

  const hatWache = /anmeldungVerlangen\s*\(/.test(quelle)
  const istOffen = offen.includes(name)

  // 1. Widerspruch: Wache vorhanden, aber das Frontend schickt kein Token
  if (hatWache && istOffen) {
    befunde.push(`${datei}: verlangt eine Sitzung, steht aber in OFFEN - jeder Aufruf endet in 401`)
  }

  // 2. Wache oder Signaturpruefung im OPTIONS-Block = unerreichbar
  const block = optionsBlock(quelle)
  if (block) {
    const innen = quelle.slice(block.auf, block.zu)
    for (const was of ['anmeldungVerlangen', 'calendlyEcht', 'nachweisPruefen']) {
      if (innen.includes(was)) {
        befunde.push(`${datei}: ${was}() steht im OPTIONS-Block und wird nie ausgefuehrt`)
      }
    }
  }

  // 3. Rolle oder Identitaet aus der Anfrage statt aus dem Token
  const verdaechtig = [
    [/params\.(isAdmin|admin)\b/, 'Adminrechte aus der Query'],
    [/userRole\s*(!==|===)/, 'Rolle aus der Anfrage verglichen'],
    [/queryStringParameters[^\n]*\b(userId|user_id)\b/, 'Identitaet aus der Query']
  ]
  for (const [muster, text] of verdaechtig) {
    if (muster.test(quelle)) befunde.push(`${datei}: ${text}`)
  }
}

if (befunde.length === 0) {
  console.log('Wachen in Ordnung: keine unerreichbaren Pruefungen, keine Selbstauskunft.')
  process.exit(0)
}
console.log(`${befunde.length} Befund(e):`)
for (const b of befunde) console.log('  -', b)
process.exit(1)
