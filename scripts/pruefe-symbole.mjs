// Prüft, ob jedes als JSX benutzte Symbol auch importiert ist.
//
// Der Anlass: <History /> ohne Import. Weder esbuild noch oxlint schlagen an,
// weil `History` ein eingebautes Browser-Objekt ist - der Build läuft durch,
// und React stürzt erst beim Öffnen der Schublade ab. Dieselbe Falle stellen
// Screen, Text, Option, Image, Range, Selection, Comment, Notification ...
//
// Aufruf: node scripts/pruefe-symbole.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dateien = []
;(function sammle(ordner) {
  for (const e of readdirSync(ordner)) {
    const pfad = join(ordner, e)
    if (statSync(pfad).isDirectory()) sammle(pfad)
    else if (pfad.endsWith('.jsx')) dateien.push(pfad)
  }
})('src')

let funde = 0

for (const datei of dateien) {
  const quelle = readFileSync(datei, 'utf8')

  // Alles, was oben hereinkommt - egal aus welchem Paket, plus lokale Namen.
  const bekannt = new Set()
  for (const m of quelle.matchAll(/import\s+(?:(\w+)\s*,\s*)?\{([^}]*)\}\s*from/g)) {
    if (m[1]) bekannt.add(m[1])
    for (const teil of m[2].split(',')) {
      const name = teil.trim().split(/\s+as\s+/).pop().trim()
      if (name) bekannt.add(name)
    }
  }
  for (const m of quelle.matchAll(/import\s+(\w+)\s+from/g)) bekannt.add(m[1])
  for (const m of quelle.matchAll(/(?:function|const|let|class)\s+([A-Z]\w*)/g)) bekannt.add(m[1])
  // Umbenannt entgegengenommen: ({ icon: Icon }) oder ({ symbol: Symbol }).
  for (const m of quelle.matchAll(/\b\w+\s*:\s*([A-Z]\w*)/g)) bekannt.add(m[1])

  // Grossgeschriebene Bauteile im JSX
  const benutzt = new Set()
  for (const m of quelle.matchAll(/<([A-Z]\w*)[\s/>]/g)) benutzt.add(m[1])
  // und als Eigenschaft weitergereicht: icon={Foo}, arbeitsIcon={Foo}, symbol={Foo}
  for (const m of quelle.matchAll(/\w*(?:[Ii]con|[Ss]ymbol)=\{([A-Z]\w*)\}/g)) benutzt.add(m[1])

  for (const name of benutzt) {
    if (!bekannt.has(name)) {
      console.error(`FEHLT  ${datei}: <${name} /> wird benutzt, ist aber nicht importiert`)
      funde++
    }
  }
}

console.log(funde === 0
  ? `Alle Symbole importiert (${dateien.length} Dateien).`
  : `${funde} fehlende Importe.`)
process.exit(funde === 0 ? 0 : 1)
