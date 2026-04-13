/**
 * FIX: Lead Assignments aus CSV nachmigrieren
 *
 * Problem: Die Airtable-Migration hat nur 1000 Assignments erstellt,
 * aber die CSV zeigt 10604 Zuweisungen.
 *
 * Dieses Script:
 * 1. Liest die Leads-CSV
 * 2. Matched User_Datenbank (Namen) mit users.vor_nachname
 * 3. Matched Unternehmensname mit leads.unternehmensname
 * 4. Erstellt fehlende lead_assignments
 *
 * Verwendung:
 * node supabase/fix-lead-assignments.js
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { createReadStream } from 'fs'
import { parse } from 'csv-parse'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const CSV_PATH = join(__dirname, 'csv/Immobilienmakler_Leads-Grid view.csv')

async function loadUsersMap() {
  console.log('📋 Lade User-Map aus Supabase...')

  const { data: users, error } = await supabase
    .from('users')
    .select('id, vor_nachname')

  if (error) throw new Error(`Users laden fehlgeschlagen: ${error.message}`)

  const userMap = new Map()
  for (const user of users) {
    if (user.vor_nachname) {
      // Normalisiere Namen für Matching
      const normalizedName = user.vor_nachname.trim().toLowerCase()
      userMap.set(normalizedName, user.id)
    }
  }

  console.log(`   ✓ ${userMap.size} User geladen`)
  return userMap
}

async function loadLeadsMap() {
  console.log('📋 Lade Leads-Map aus Supabase...')

  // Lade alle Leads in Batches
  const leadsMap = new Map()
  let offset = 0
  const batchSize = 1000

  while (true) {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, unternehmensname')
      .range(offset, offset + batchSize - 1)

    if (error) throw new Error(`Leads laden fehlgeschlagen: ${error.message}`)
    if (!leads || leads.length === 0) break

    for (const lead of leads) {
      if (lead.unternehmensname) {
        const normalizedName = lead.unternehmensname.trim().toLowerCase()
        leadsMap.set(normalizedName, lead.id)
      }
    }

    offset += batchSize
    if (leads.length < batchSize) break
  }

  console.log(`   ✓ ${leadsMap.size} Leads geladen`)
  return leadsMap
}

async function loadExistingAssignments() {
  console.log('📋 Lade bestehende Assignments...')

  const { data: assignments, error } = await supabase
    .from('lead_assignments')
    .select('lead_id, user_id')

  if (error) throw new Error(`Assignments laden fehlgeschlagen: ${error.message}`)

  const existingSet = new Set()
  for (const a of assignments || []) {
    existingSet.add(`${a.lead_id}:${a.user_id}`)
  }

  console.log(`   ✓ ${existingSet.size} bestehende Assignments`)
  return existingSet
}

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const records = []

    createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        bom: true
      }))
      .on('data', (record) => records.push(record))
      .on('end', () => resolve(records))
      .on('error', reject)
  })
}

async function main() {
  console.log('🔧 FIX LEAD ASSIGNMENTS\n')

  // 1. Lade Maps
  const userMap = await loadUsersMap()
  const leadsMap = await loadLeadsMap()
  const existingAssignments = await loadExistingAssignments()

  // 2. Parse CSV
  console.log('\n📂 Lese CSV...')
  const csvRecords = await parseCSV(CSV_PATH)
  console.log(`   ✓ ${csvRecords.length} CSV-Zeilen gelesen`)

  // 3. Finde fehlende Assignments
  console.log('\n🔍 Analysiere Zuweisungen...')

  const newAssignments = []
  const stats = {
    total: 0,
    withUser: 0,
    userNotFound: 0,
    leadNotFound: 0,
    alreadyExists: 0,
    toCreate: 0
  }

  for (const row of csvRecords) {
    stats.total++

    const userName = (row['User_Datenbank'] || '').trim()
    const leadName = (row['Unternehmensname'] || '').trim()

    if (!userName) continue
    stats.withUser++

    // Finde User ID
    const normalizedUserName = userName.toLowerCase()
    const userId = userMap.get(normalizedUserName)

    if (!userId) {
      stats.userNotFound++
      continue
    }

    // Finde Lead ID
    const normalizedLeadName = leadName.toLowerCase()
    const leadId = leadsMap.get(normalizedLeadName)

    if (!leadId) {
      stats.leadNotFound++
      continue
    }

    // Prüfe ob bereits existiert
    const key = `${leadId}:${userId}`
    if (existingAssignments.has(key)) {
      stats.alreadyExists++
      continue
    }

    // Neues Assignment
    newAssignments.push({ lead_id: leadId, user_id: userId })
    existingAssignments.add(key) // Verhindere Duplikate
    stats.toCreate++
  }

  console.log('\n📊 STATISTIKEN:')
  console.log(`   Total CSV-Zeilen:      ${stats.total}`)
  console.log(`   Mit User_Datenbank:    ${stats.withUser}`)
  console.log(`   User nicht gefunden:   ${stats.userNotFound}`)
  console.log(`   Lead nicht gefunden:   ${stats.leadNotFound}`)
  console.log(`   Bereits vorhanden:     ${stats.alreadyExists}`)
  console.log(`   Neu zu erstellen:      ${stats.toCreate}`)

  // 4. Erstelle neue Assignments
  if (newAssignments.length === 0) {
    console.log('\n✅ Keine neuen Assignments zu erstellen.')
    return
  }

  console.log(`\n📝 Erstelle ${newAssignments.length} neue Assignments...`)

  const BATCH_SIZE = 100
  let inserted = 0
  let failed = 0

  for (let i = 0; i < newAssignments.length; i += BATCH_SIZE) {
    const batch = newAssignments.slice(i, i + BATCH_SIZE)

    const { error } = await supabase
      .from('lead_assignments')
      .upsert(batch, { onConflict: 'lead_id,user_id', ignoreDuplicates: true })

    if (error) {
      console.error(`   ❌ Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${error.message}`)
      failed += batch.length
    } else {
      inserted += batch.length
    }

    // Progress
    if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= newAssignments.length) {
      console.log(`   📊 Progress: ${Math.min(i + BATCH_SIZE, newAssignments.length)}/${newAssignments.length}`)
    }
  }

  console.log(`\n✅ FERTIG:`)
  console.log(`   Erfolgreich: ${inserted}`)
  console.log(`   Fehlgeschlagen: ${failed}`)

  // 5. Verifizierung
  const { count } = await supabase
    .from('lead_assignments')
    .select('*', { count: 'exact', head: true })

  console.log(`\n📊 Gesamt lead_assignments jetzt: ${count}`)
}

main().catch(console.error)
