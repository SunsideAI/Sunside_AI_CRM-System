/* Was gespeichert wurde, muss sofort dastehen.

   Am 12.10.2026 gemeldet: Ein Kommentar im Setting, Opening oder Closing war
   nach dem Speichern nicht zu sehen. Erst Liste aktualisieren, dann den
   Kontakt erneut oeffnen - dann stand er da. Wer darauf nicht kommt, tippt
   ihn ein zweites Mal.

   Die Ursache lag in Verlauf.jsx: Der Abruf hing allein an leadId, hotLeadId
   und dem Filter. Solange die Schublade offen blieb und derselbe Kontakt
   darin stand, aenderte sich keines davon - der Verlauf hatte keinen Anlass,
   noch einmal zu fragen. Die Absicht war sogar da: Setting fuehrte einen
   Zaehler `neuladen`, den der Kommentarkasten hochzaehlte. Er ging nur nie
   an den Verlauf, sondern allein an die geplatzten Termine.

   Seitdem gilt: Jede Seite, die eine Schublade mit Verlauf zeigt, fuehrt
   einen Zaehler und reicht ihn als `signal` durch. Jede Stelle, die etwas
   schreibt und die Schublade offen laesst, zaehlt ihn hoch. */
import fs from 'fs'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const lies = (p) => fs.readFileSync(p, 'utf8')
const verlauf = lies('src/components/Verlauf.jsx')

// ── Die Komponente selbst ────────────────────────────────────────────────
sagt(/export default function Verlauf\(\{ leadId, hotLeadId, signal = 0 \}\)/.test(verlauf),
  'Verlauf nimmt ein signal entgegen')

/* Zwei getrennte Effekte, und das ist der Punkt: Ein Kontaktwechsel zeigt
   das Skelett, denn dort steht gleich etwas voellig anderes. Ein Nachfassen
   ersetzt still - sonst fiele der Abschnitt bei jedem Speichern kurz
   zusammen und klappte wieder auf. */
sagt(/useEffect\(\(\) => \{ laden\(\) \}, \[leadId, hotLeadId, gruppe\]\)/.test(verlauf),
  'Kontakt- oder Filterwechsel lädt mit Skelett')
sagt(/letztesSignal\.current === signal\) return/.test(verlauf),
  'Der erste Durchlauf löst keinen zweiten Abruf aus')
sagt(/laden\(true\)/.test(verlauf) && /const laden = async \(still = false\)/.test(verlauf)
     && /if \(!still\) setLaedt\(true\)/.test(verlauf),
  'Nachgefasst wird still, ohne Skelett')

// ── Die Durchreiche ──────────────────────────────────────────────────────
const schublade = lies('src/components/LeadSchublade.jsx')
sagt(/signal=\{verlauf\.signal\}/.test(schublade),
  'Die Schublade reicht das Signal durch')

/* Jede Einbindung muss es setzen. Ohne diese Pruefung faellt eine neue
   Seite still durch - sie sieht richtig aus und laedt nie nach. */
for (const [datei, stelle] of [
  ['src/pages/Setting.jsx',  'signal: neuladen'],
  ['src/pages/FollowUp.jsx', 'signal: neuladen'],
  ['src/pages/Termine.jsx',  'signal: neuladen'],
  ['src/pages/Opening.jsx',  'signal={neuladen}'],
  ['src/pages/Closing.jsx',  'signal={neuladen}'],
]) {
  const q = lies(datei)
  const name = datei.split('/').pop().replace('.jsx', '')
  sagt(q.includes(stelle), `${name} gibt dem Verlauf sein Signal mit`)
  sagt(/const \[neuladen, setNeuladen\] = useState\(0\)/.test(q),
    `${name} führt den Zähler`)
}

/* Der Zaehler nuetzt nichts, wenn ihn niemand hochzaehlt. Geprueft werden
   die Stellen, an denen gespeichert wird und die Schublade offen bleibt -
   genau die Faelle aus der Meldung. */
const zaehltHoch = (datei, funktion) => {
  const z = lies(datei).split('\n')
  const start = z.findIndex(l => l.includes(`const ${funktion} =`))
  if (start < 0) return null
  let ende = z.length - 1
  for (let i = start + 1; i < z.length; i++) if (z[i] === '  }') { ende = i; break }
  return z.slice(start, ende + 1).join('\n').includes('setNeuladen(n => n + 1)')
}

for (const [datei, fn, was] of [
  ['src/pages/Opening.jsx',  'saveLead',            'Opening: Lead speichern'],
  ['src/pages/Opening.jsx',  'saveKommentarOnly',   'Opening: nur ein Kommentar'],
  ['src/pages/Closing.jsx',  'doSave',              'Closing: Lead speichern'],
  ['src/pages/Closing.jsx',  'handleNoShowConfirm', 'Closing: nicht erschienen'],
  ['src/pages/FollowUp.jsx', 'handleSaveLead',      'Follow-Up: Lead speichern'],
]) {
  const t = zaehltHoch(datei, fn)
  sagt(t === true, `${was} stößt den Verlauf an`)
}

/* Setting geht einen anderen Weg: Dort ruft jede Speicherung laden(), und
   der Zaehler steht in laden() selbst. Damit haengt das Nachladen an einer
   Stelle statt an jedem Knopf. */
const setting = lies('src/pages/Setting.jsx')
sagt(zaehltHoch('src/pages/Setting.jsx', 'laden') === true,
  'Setting zählt in laden() hoch, also bei jeder Speicherung')
sagt(/setGewaehlt\(g => \(g \? \(frisch\.find\(k => k\.id === g\.id\) \?\? g\) : g\)\)/.test(setting),
  'Setting zieht auch den geöffneten Kontakt nach, nicht nur die Liste')

/* Closing zieht ebenso nach. Opening bewusst NICHT: Aus dem Terminbereich
   heraus steht dort ein von Hand gebautes Objekt (mappedLead) mit echter
   Lead-Id, aber zusaetzlichen Feldern - ein Nachziehen aus der Liste wuerde
   genau die ueberschreiben. */
sagt(/setSelectedLead\(l => \(l \? \(sortedLeads\.find\(k => k\.id === l\.id\) \?\? l\) : l\)\)/
       .test(lies('src/pages/Closing.jsx')),
  'Closing zieht den geöffneten Kontakt nach')
sagt(!/setSelectedLead\(l => \(l \? \(data\.leads\.find/.test(lies('src/pages/Opening.jsx')),
  'Opening zieht bewusst nicht nach (mappedLead würde überschrieben)')

if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Verlauf: nach dem Speichern sofort sichtbar.')
