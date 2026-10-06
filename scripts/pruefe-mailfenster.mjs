/* Im Mailfenster gehen Betreff und Nachricht verschiedene Wege: Der Betreff
   ist ein React-Feld und kommt aus dem State, das Nachrichtenfeld ist ein
   contentEditable und wird von Hand beschrieben. Faellt dieser eine
   Schreibzugriff aus, sieht man eine gewaehlte Vorlage mit gefuelltem
   Betreff und leerem Text - und sendet, was man nicht sieht, denn der
   Senden-Knopf haengt am State.

   Gemeldet am 06.10.2026 aus dem Fenster direkt nach der Buchung: Dort
   setzt ein Effekt die empfohlene Vorlage, waehrend das Fenster erst
   entsteht. */
import fs from 'fs'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const fn = fs.readFileSync('src/components/EmailComposer.jsx', 'utf8')

sagt(/editorRef\.current\.innerHTML = htmlContent/.test(fn),
  'Die gewählte Vorlage schreibt in das Feld')

/* Der Abgleich ist die Absicherung: Er holt den Text aus dem State zurueck,
   sobald das Feld da ist. Faellt er weg, haengt alles wieder an einem
   einzigen Schreibzugriff zum richtigen Zeitpunkt. */
const abgleich = fn.slice(fn.indexOf('for (const editor of [editorRef.current, modalEditorRef.current])'),
                          fn.indexOf('for (const editor of [editorRef.current, modalEditorRef.current])') + 400)
sagt(abgleich.length > 50, 'Und ein Abgleich holt ihn zurück, wenn das Feld später entsteht')
sagt(/\}, \[inhalt\]\)/.test(fn),
  'Der Abgleich hängt am Inhalt, läuft also bei jeder Änderung')
sagt(/document\.activeElement === editor/.test(abgleich),
  'Beim Tippen fasst er nichts an, sonst spränge der Cursor')
sagt(/editor\.innerHTML === \(inhalt \|\| ''\)/.test(abgleich),
  'Und schreibt nur, wenn Feld und Stand wirklich auseinanderliegen')

/* Der Senden-Knopf haengt am State, nicht am Feld: Sonst liesse sich eine
   Mail abschicken, deren Text niemand gesehen hat. */
sagt(/disabled=\{sending \|\| !empfaenger \|\| !betreff \|\| !inhalt\}/.test(fn),
  'Gesendet wird nur, was auch im Stand steht')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Mailfenster: was gewählt wurde, steht auch im Feld.')
