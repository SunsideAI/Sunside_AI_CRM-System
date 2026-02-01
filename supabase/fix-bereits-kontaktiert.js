/**
 * FIX: bereits_kontaktiert Feld korrigieren
 *
 * Problem: Migration hat 'X' statt true/false geprüft
 * Lösung: Alle Leads mit einem Ergebnis oder Datum als "kontaktiert" markieren
 *
 * Verwendung: node supabase/fix-bereits-kontaktiert.js
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function fixBereitsKontaktiert() {
  console.log('🔧 Korrigiere bereits_kontaktiert Feld...\n')

  // 1. Alle Leads laden
  const { data: allLeads, error: fetchError } = await supabase
    .from('leads')
    .select('id, bereits_kontaktiert, ergebnis, datum')

  if (fetchError) {
    console.error('❌ Fehler beim Laden:', fetchError)
    return
  }

  console.log(`📊 ${allLeads.length} Leads geladen`)

  // 2. Leads finden die kontaktiert sein sollten (haben Ergebnis ODER Datum)
  const leadsToFix = allLeads.filter(lead => {
    const hasErgebnis = lead.ergebnis && lead.ergebnis.trim() !== ''
    const hasDatum = lead.datum && lead.datum.trim() !== ''
    const isMarkedAsKontaktiert = lead.bereits_kontaktiert === true

    // Sollte kontaktiert sein, ist aber nicht markiert
    return (hasErgebnis || hasDatum) && !isMarkedAsKontaktiert
  })

  console.log(`🔍 ${leadsToFix.length} Leads müssen korrigiert werden`)

  if (leadsToFix.length === 0) {
    console.log('✅ Keine Korrekturen nötig!')
    return
  }

  // 3. In Batches updaten
  const batchSize = 100
  let updatedCount = 0

  for (let i = 0; i < leadsToFix.length; i += batchSize) {
    const batch = leadsToFix.slice(i, i + batchSize)
    const ids = batch.map(l => l.id)

    const { error: updateError } = await supabase
      .from('leads')
      .update({ bereits_kontaktiert: true })
      .in('id', ids)

    if (updateError) {
      console.error(`❌ Fehler bei Batch ${i / batchSize + 1}:`, updateError)
    } else {
      updatedCount += batch.length
      console.log(`   ✓ Batch ${i / batchSize + 1}: ${batch.length} Leads aktualisiert`)
    }

    // Kurze Pause
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\n✅ ${updatedCount} Leads korrigiert!`)

  // 4. Statistik anzeigen
  const { data: stats } = await supabase
    .from('leads')
    .select('bereits_kontaktiert')

  const kontaktiert = stats.filter(l => l.bereits_kontaktiert === true).length
  const nichtKontaktiert = stats.filter(l => l.bereits_kontaktiert !== true).length

  console.log(`\n📊 Neue Statistik:`)
  console.log(`   Kontaktiert:       ${kontaktiert}`)
  console.log(`   Nicht kontaktiert: ${nichtKontaktiert}`)
}

fixBereitsKontaktiert()
