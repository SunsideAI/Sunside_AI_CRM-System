// Script um Leads zu finden die "erreicht" wurden aber kein Ergebnis haben
// Ausführen mit: node find-missing-ergebnis.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function findMissingErgebnis() {
  console.log('\n=== Suche Leads ohne Ergebnis (aber bereits_kontaktiert = true) ===\n')

  // Leads die kontaktiert wurden aber kein Ergebnis haben
  const { data: leads, error } = await supabase
    .from('leads')
    .select(`
      id,
      vorname,
      nachname,
      firma_name,
      bereits_kontaktiert,
      ergebnis,
      datum,
      status,
      created_at
    `)
    .eq('bereits_kontaktiert', true)
    .or('ergebnis.is.null,ergebnis.eq.')
    .order('datum', { ascending: false })

  if (error) {
    console.error('Fehler:', error)
    return
  }

  console.log(`Gefunden: ${leads?.length || 0} Leads ohne Ergebnis\n`)

  if (leads && leads.length > 0) {
    // Detaillierte Ausgabe
    for (const lead of leads) {
      console.log('-------------------------------------------')
      console.log(`ID: ${lead.id}`)
      console.log(`Name: ${lead.vorname || ''} ${lead.nachname || ''}`)
      console.log(`Firma: ${lead.firma_name || '(keine)'}`)
      console.log(`bereits_kontaktiert: ${lead.bereits_kontaktiert}`)
      console.log(`ergebnis: "${lead.ergebnis || ''}" (${lead.ergebnis === null ? 'NULL' : lead.ergebnis === '' ? 'LEER' : 'hat Wert'})`)
      console.log(`datum: ${lead.datum || '(kein Datum)'}`)
      console.log(`status: ${lead.status}`)
      console.log(`created_at: ${lead.created_at}`)
    }
    console.log('-------------------------------------------')

    // Zusammenfassung
    console.log('\n=== Zusammenfassung ===')
    console.log(`Gesamt ohne Ergebnis: ${leads.length}`)

    // Gruppiert nach ergebnis-Wert
    const nullCount = leads.filter(l => l.ergebnis === null).length
    const emptyCount = leads.filter(l => l.ergebnis === '').length
    console.log(`  - ergebnis = NULL: ${nullCount}`)
    console.log(`  - ergebnis = '' (leer): ${emptyCount}`)
  }

  // Auch im Archiv prüfen
  console.log('\n=== Prüfe auch lead_archive ===\n')

  const { data: archiveLeads, error: archiveError } = await supabase
    .from('lead_archive')
    .select('*')
    .eq('bereits_kontaktiert', true)
    .or('ergebnis.is.null,ergebnis.eq.')

  if (archiveError) {
    console.error('Archiv-Fehler:', archiveError)
  } else {
    console.log(`Im Archiv: ${archiveLeads?.length || 0} Leads ohne Ergebnis`)
  }

  console.log('\n=== Fertig ===\n')
}

findMissingErgebnis().catch(console.error)
