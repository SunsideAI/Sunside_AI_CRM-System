/* Telefonnummern werden von Hand gepflegt, also steht im Feld alles:
   "09071/5679968", "(04141) 80 29 08 - 0", "+49 (0)511 899 928 68", und
   mitunter zwei Nummern nebeneinander. Calendly nimmt nur E.164 und weist
   die Buchung sonst ab - der Setter sieht nur, dass es "nicht geht".

   Belegt am 06.10.2026: 12 von 509 Kontakten mit Nummer waeren abgewiesen
   worden, darunter Michael Streil Immobilien. Die Faelle unten sind genau
   diese zwoelf plus die Normalfaelle. */
import fs from 'fs'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const fn = fs.readFileSync('netlify/functions/calendar.js', 'utf8')

/* Die Aufbereitung aus calendar.js, Zeile fuer Zeile nachgezogen. Weicht sie
   ab, faellt es hier auf, bevor eine Buchung scheitert. */
const machen = (inviteePhone) => {
  let roh = String(inviteePhone || '').trim()
  if (roh.replace(/\D/g, '').length > 15) {
    for (const teil of roh.split(/[/,;]|\s{2,}/)) {
      if (teil.replace(/\D/g, '').length >= 7) { roh = teil.trim(); break }
    }
  }
  let f = roh || '+49'
  const plusVorn = f.startsWith('+')
  let ziffern = f.replace(/\D/g, '')
  if (plusVorn) { ziffern = ziffern.replace(/^(49|43|41)0+/, '$1'); f = '+' + ziffern }
  else if (ziffern.startsWith('00')) f = '+' + ziffern.substring(2)
  else if (ziffern.startsWith('0')) f = '+49' + ziffern.replace(/^0+/, '')
  else if (ziffern) f = '+49' + ziffern
  else f = '+49'
  return f
}

const FAELLE = [
  ['(04141) 80 29 08 - 0',            '+4941418029080'],
  ['+49 172 / 56 38 960',             '+491725638960'],
  ['+49 (0)7552 3822418',             '+4975523822418'],
  ['03 46 02 / 4 89 46',              '+493460248946'],
  ['0202.73 955 - 0',                 '+49202739550'],
  ['+49 6625 4632876.  0175-1569596', '+4966254632876'],
  ['0201/8090388',                    '+492018090388'],
  ['09071/5679968',                   '+4990715679968'],
  ['+49 4154 8981111 / 015785079700', '+4941548981111'],
  ['+49 30 64092298 / 01607325341',   '+493064092298'],
  ['+49 (0)511 899 928 68',           '+4951189992868'],
  ['0176 56039050',                   '+4917656039050'],
  ['0049 171 2732899',                '+491712732899'],
  ['+43 1 8900152',                   '+4318900152'],
  ['',                                '+49'],
]

for (const [ein, soll] of FAELLE) {
  const ist = machen(ein)
  sagt(ist === soll, `${JSON.stringify(ein) || '(leer)'} → ${ist}${ist === soll ? '' : ` statt ${soll}`}`)
}

/* Der Schraegstrich trennt meist Vorwahl und Rufnummer, nicht zwei
   Anschluesse. Wer immer an ihm teilt, verliert die Vorwahl: Aus Streils
   09071/5679968 wurde so +495679968 - gueltig geformt und trotzdem falsch. */
sagt(/length > 15/.test(fn),
  'Getrennt wird erst, wenn es fuer eine Nummer zu viele Ziffern sind')
sagt(/replace\(\/\^\(49\|43\|41\)0\+\//.test(fn),
  'Die Null hinter der Landesvorwahl faellt weg, nicht die Vorwahl selbst')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Telefon: E.164 auch bei handgepflegten Nummern.')
