// Script um die 10 fehlenden Leads zu finden
// Diese sind "erreicht" (bereits_kontaktiert = true) aber haben ein Ergebnis
// das nicht in Beratungsgespräch, Kein Interesse, Unterlage/WV fällt
// Ausführen mit: node find-missing-10.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function findMissing10() {
  console.log('\n=== Suche nach Leads die "erreicht" sind aber nicht in den 3 Kategorien ===\n')

  // Die 3 Kategorien im Dashboard:
  // - Beratungsgespräch
  // - Unterlage/WV = Unterlage bereitstellen + Wiedervorlage
  // - Kein Interesse

  const expectedResults = [
    'Beratungsgespräch',
    'Kein Interesse',
    'Unterlage bereitstellen',
    'Wiedervorlage'
  ]

  // Alle Leads laden die bereits_kontaktiert = true haben
  const { data: allKontaktiert, error: error1 } = await supabase
    .from('leads')
    .select('id, unternehmensname, stadt, bereits_kontaktiert, ergebnis, datum, kommentar')
    .eq('bereits_kontaktiert', true)

  if (error1) {
    console.error('Fehler:', error1)
    return
  }

  console.log(`Gesamt kontaktiert (bereits_kontaktiert=true): ${allKontaktiert.length}`)

  // Gruppiere nach Ergebnis
  const byErgebnis = {}
  allKontaktiert.forEach(lead => {
    const e = lead.ergebnis || '(NULL/leer)'
    if (!byErgebnis[e]) byErgebnis[e] = []
    byErgebnis[e].push(lead)
  })

  console.log('\n=== Verteilung nach Ergebnis ===')
  Object.entries(byErgebnis).sort((a, b) => b[1].length - a[1].length).forEach(([ergebnis, leads]) => {
    console.log(`  ${ergebnis}: ${leads.length}`)
  })

  // Finde Leads die NICHT in den erwarteten Kategorien sind
  const missing = allKontaktiert.filter(lead => {
    const e = lead.ergebnis
    // Nicht in den erwarteten Kategorien = missing
    return !expectedResults.includes(e)
  })

  console.log(`\n=== Fehlende Leads (nicht in den 3 Dashboard-Kategorien) ===`)
  console.log(`Anzahl: ${missing.length}\n`)

  if (missing.length > 0) {
    // Gruppiere nach Ergebnis
    const missingByErgebnis = {}
    missing.forEach(lead => {
      const e = lead.ergebnis || '(NULL/leer)'
      if (!missingByErgebnis[e]) missingByErgebnis[e] = []
      missingByErgebnis[e].push(lead)
    })

    console.log('Verteilung der fehlenden Leads:')
    Object.entries(missingByErgebnis).forEach(([ergebnis, leads]) => {
      console.log(`\n--- ${ergebnis}: ${leads.length} Leads ---`)
      leads.forEach(lead => {
        console.log(`  ID: ${lead.id}`)
        console.log(`  Firma: ${lead.unternehmensname || '(keine)'}`)
        console.log(`  Stadt: ${lead.stadt || '(keine)'}`)
        console.log(`  Datum: ${lead.datum || '(kein Datum)'}`)
        console.log(`  Ergebnis: "${lead.ergebnis}" (${lead.ergebnis === null ? 'NULL' : lead.ergebnis === '' ? 'LEER STRING' : 'hat Wert'})`)
        // Nur erste Zeile des Kommentars
        const kommentarLine = lead.kommentar ? lead.kommentar.split('\n')[0] : '(kein Kommentar)'
        console.log(`  Kommentar: ${kommentarLine.substring(0, 100)}...`)
        console.log('')
      })
    })
  }

  // Zusätzliche Prüfung: Nicht erreicht die trotzdem als kontaktiert markiert sind
  console.log('\n=== Prüfung: "Nicht erreicht" mit bereits_kontaktiert=true ===')
  const nichtErreichtAberKontaktiert = allKontaktiert.filter(l => l.ergebnis === 'Nicht erreicht')
  console.log(`Anzahl: ${nichtErreichtAberKontaktiert.length}`)
  if (nichtErreichtAberKontaktiert.length > 0 && nichtErreichtAberKontaktiert.length <= 20) {
    nichtErreichtAberKontaktiert.forEach(lead => {
      console.log(`  - ${lead.unternehmensname || lead.id}: ${lead.ergebnis}, Datum: ${lead.datum}`)
    })
  }

  // Zusammenfassung
  console.log('\n=== ZUSAMMENFASSUNG ===')
  const beratung = byErgebnis['Beratungsgespräch']?.length || 0
  const keinInteresse = byErgebnis['Kein Interesse']?.length || 0
  const unterlage = byErgebnis['Unterlage bereitstellen']?.length || 0
  const wiedervorlage = byErgebnis['Wiedervorlage']?.length || 0
  const nichtErreicht = byErgebnis['Nicht erreicht']?.length || 0
  const ungueltig = byErgebnis['Ungültiger Lead']?.length || 0
  const nullOderLeer = byErgebnis['(NULL/leer)']?.length || 0

  console.log(`Beratungsgespräch: ${beratung}`)
  console.log(`Kein Interesse: ${keinInteresse}`)
  console.log(`Unterlage bereitstellen: ${unterlage}`)
  console.log(`Wiedervorlage: ${wiedervorlage}`)
  console.log(`Nicht erreicht (aber kontaktiert!): ${nichtErreicht}`)
  console.log(`Ungültiger Lead: ${ungueltig}`)
  console.log(`NULL oder leer: ${nullOderLeer}`)
  console.log(`-----`)
  console.log(`Dashboard "Erreicht" sollte sein: ${allKontaktiert.length}`)
  console.log(`Dashboard zeigt vermutlich: Beratung(${beratung}) + KeinInteresse(${keinInteresse}) + Unterlage/WV(${unterlage + wiedervorlage}) = ${beratung + keinInteresse + unterlage + wiedervorlage}`)
  console.log(`Differenz: ${allKontaktiert.length - (beratung + keinInteresse + unterlage + wiedervorlage)}`)

  console.log('\n=== Fertig ===\n')
}

findMissing10().catch(console.error)
