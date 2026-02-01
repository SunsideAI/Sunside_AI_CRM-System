// Quick Check Script für einen Lead
// Ausführen mit: node check-lead.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const LEAD_ID = 'a7489003-b3fe-4305-af93-d1d79ffece93'

async function checkLead() {
  console.log(`\n=== Prüfe Lead: ${LEAD_ID} ===\n`)

  // 1. Lead in leads-Tabelle prüfen
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, bereits_kontaktiert, ergebnis, datum, status, vorname, nachname')
    .eq('id', LEAD_ID)
    .single()

  if (leadError && leadError.code !== 'PGRST116') {
    console.error('Fehler beim Laden des Leads:', leadError)
  }

  if (lead) {
    console.log('✅ Lead in "leads" Tabelle gefunden:')
    console.log('   bereits_kontaktiert:', lead.bereits_kontaktiert)
    console.log('   ergebnis:', lead.ergebnis || '(leer)')
    console.log('   datum:', lead.datum || '(leer)')
    console.log('   status:', lead.status)
    console.log('   Name:', lead.vorname, lead.nachname)
  } else {
    console.log('❌ Lead NICHT in "leads" Tabelle gefunden')
  }

  // 2. Lead im Archiv prüfen
  const { data: archiv, error: archivError } = await supabase
    .from('lead_archive')
    .select('*')
    .eq('lead_id', LEAD_ID)

  if (archivError) {
    console.error('Fehler beim Laden des Archivs:', archivError)
  }

  if (archiv && archiv.length > 0) {
    console.log('\n📦 Lead im "lead_archive" gefunden:')
    for (const a of archiv) {
      console.log('   user_id:', a.user_id)
      console.log('   bereits_kontaktiert:', a.bereits_kontaktiert)
      console.log('   ergebnis:', a.ergebnis || '(leer)')
      console.log('   archiviert_am:', a.archiviert_am)
    }
  } else {
    console.log('\n📦 Lead NICHT im "lead_archive" gefunden')
  }

  // 3. Lead-Assignments prüfen
  const { data: assignments, error: assignError } = await supabase
    .from('lead_assignments')
    .select('user_id, assigned_at, users(vor_nachname)')
    .eq('lead_id', LEAD_ID)

  if (assignError) {
    console.error('Fehler beim Laden der Assignments:', assignError)
  }

  if (assignments && assignments.length > 0) {
    console.log('\n👤 Lead-Assignments:')
    for (const a of assignments) {
      console.log('   user_id:', a.user_id)
      console.log('   assigned_at:', a.assigned_at)
      console.log('   Name:', a.users?.vor_nachname || '(unbekannt)')
    }
  } else {
    console.log('\n👤 Keine Lead-Assignments (Lead ist frei)')
  }

  console.log('\n=== Prüfung abgeschlossen ===\n')
}

checkLead().catch(console.error)
