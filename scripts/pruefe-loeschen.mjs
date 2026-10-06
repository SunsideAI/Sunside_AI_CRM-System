// Prueft die Loeschregel fuer Kontakte.
//
// Anlass: Am 06.10.2026 stand ein Testkontakt „Paul Test" im Setter-Pool
// zwischen echten Terminen, und niemand im Haus konnte ihn entfernen - das
// CRM kannte nur den Massen-Archivlauf fuer kalte Leads.
//
// Loeschen ist der einzige Vorgang im CRM, der sich nicht rueckgaengig machen
// laesst. Deshalb haengen drei Bedingungen daran: nur die Leitung, nur mit
// dem Firmennamen als Bestaetigung, und niemals bei einem Kontakt, der in der
// Buchhaltung haengt.
//
// Aufruf: node scripts/pruefe-loeschen.mjs

import fs from 'node:fs'

const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

const fn = fs.readFileSync('netlify/functions/hot-leads.js', 'utf8')
const teil = fn.slice(fn.indexOf("if (event.httpMethod === 'DELETE')"),
                      fn.indexOf("if (event.httpMethod === 'PATCH')"))

sagt(teil.length > 0, 'Es gibt überhaupt einen Weg, einen Kontakt zu löschen')
sagt(/angemeldet\?\.istAdmin/.test(teil), 'Nur die Leitung darf ihn gehen')
/* Ein Tippfehler in einer Kennung darf keinen Kontakt kosten: Wer loescht,
   nennt den Firmennamen dazu. */
sagt(/bestaetigung/.test(teil) && /unternehmen \|\| ''\)\.trim\(\) !== String\(bestaetigung\)/.test(teil),
  'Und nur, wenn der Firmenname dazu genannt wird')

// Was in der Buchhaltung haengt, loescht man nicht aus dem CRM heraus.
for (const tabelle of ['kunden', 'billing_invoices', 'billing_recurring']) {
  sagt(new RegExp(`'${tabelle}'`).test(teil), `Ein Kontakt mit Eintrag in ${tabelle} wird abgewiesen`)
}

/* Die Reihenfolge zaehlt: erst was auf den Kontakt zeigt, dann er selbst,
   zuletzt der kalte Lead - sonst weist der Fremdschluessel ab. */
const abhaengigStelle = teil.indexOf("'kontakt_verlauf'")
const hotStelle = teil.indexOf("from('hot_leads').delete()")
const kaltStelle = teil.indexOf("from('leads').delete()")
sagt(abhaengigStelle > 0 && abhaengigStelle < hotStelle,
  'Abhängige Zeilen fallen vor dem Kontakt')
sagt(hotStelle > 0 && hotStelle < kaltStelle,
  'Und der Kontakt vor seinem kalten Lead')

sagt(/console\.log\('Kontakt gelöscht:'/.test(teil),
  'Wer was gelöscht hat, steht im Protokoll')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Löschen: nur die Leitung, nur mit Bestätigung, nie bei Rechnungen.')
