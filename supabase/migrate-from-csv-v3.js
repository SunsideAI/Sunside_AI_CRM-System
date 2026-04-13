/**
 * SUNSIDE CRM - CSV zu Supabase Migration v3
 *
 * Migriert alle Daten aus den CSV-Backups direkt nach Supabase.
 *
 * Verwendung:
 * node supabase/migrate-from-csv-v3.js
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { createReadStream } from 'fs'
import { parse } from 'csv-parse'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'Data_Backup')

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ID Mappings
const userEmailToId = new Map()
const userNameToId = new Map()
const leadNameToId = new Map()

// Statistics
const stats = {
  users: { total: 0, inserted: 0, failed: 0 },
  leads: { total: 0, inserted: 0, failed: 0 },
  assignments: { total: 0, inserted: 0, failed: 0 },
  hotLeads: { total: 0, inserted: 0, failed: 0 },
  archive: { total: 0, inserted: 0, failed: 0 },
  emailTemplates: { total: 0, inserted: 0, failed: 0 },
  leadRequests: { total: 0, inserted: 0, failed: 0 }
}

// =====================================================
// CSV PARSING
// =====================================================

async function parseCSV(filename) {
  const records = []
  const filePath = join(DATA_DIR, filename)

  return new Promise((resolve, reject) => {
    createReadStream(filePath)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_column_count: true,
        relax_quotes: true
      }))
      .on('data', (record) => records.push(record))
      .on('end', () => resolve(records))
      .on('error', (err) => reject(err))
  })
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function parseRollen(rolleStr) {
  if (!rolleStr) return []
  return rolleStr.split(',').map(r => r.trim()).filter(Boolean)
}

function parseBoolean(val) {
  if (!val) return false
  const v = String(val).toLowerCase().trim()
  return v === 'x' || v === 'true' || v === '1' || v === 'ja' || v === 'yes'
}

function normalizeLand(land) {
  if (!land) return 'Deutschland'
  const mapping = {
    'Deutschland': 'Deutschland',
    'DE': 'Deutschland',
    'Österreich': 'Österreich',
    'AT': 'Österreich',
    'Schweiz': 'Schweiz',
    'CH': 'Schweiz'
  }
  return mapping[land] || 'Deutschland'
}

function normalizeErgebnis(ergebnis) {
  if (!ergebnis) return null
  const mapping = {
    'Beratungsgespräch': 'Beratungsgespräch',
    'Beratungsgespraech': 'Beratungsgespräch',
    'Nicht erreicht': 'Nicht erreicht',
    'Kein Interesse': 'Kein Interesse',
    'Unterlage bereitstellen': 'Unterlage bereitstellen',
    'Wiedervorlage': 'Wiedervorlage',
    'Ungültiger Lead': 'Ungültiger Lead'
  }
  return mapping[ergebnis] || ergebnis
}

function normalizeHotLeadStatus(status) {
  if (!status) return 'Lead'
  const validStatuses = ['Lead', 'Angebot', 'Angebot versendet', 'Abgeschlossen', 'Verloren', 'Termin abgesagt', 'Termin verschoben']
  return validStatuses.includes(status) ? status : 'Lead'
}

function parseDate(dateStr) {
  if (!dateStr) return null
  // Try different date formats
  // Format: 1.4.2026 or 17.6.2025 09:00
  const parts = dateStr.split(/[\s,]+/)[0].split('.')
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    const year = parseInt(parts[2], 10)
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const fullYear = year < 100 ? 2000 + year : year
      return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  return null
}

function parseCurrency(val) {
  if (!val) return null
  // Remove currency symbols and convert comma to dot
  const cleaned = String(val).replace(/[€$\s]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function lookupUserId(userName) {
  if (!userName) return null
  const trimmed = userName.trim()
  // Try exact match first
  if (userNameToId.has(trimmed)) {
    return userNameToId.get(trimmed)
  }
  // Try partial match
  for (const [name, id] of userNameToId.entries()) {
    if (name.includes(trimmed) || trimmed.includes(name)) {
      return id
    }
  }
  return null
}

function lookupLeadId(leadName) {
  if (!leadName) return null
  const trimmed = leadName.trim()
  return leadNameToId.get(trimmed) || null
}

// =====================================================
// MIGRATION FUNCTIONS
// =====================================================

async function clearAllData() {
  console.log('\n🗑️  LÖSCHE BESTEHENDE DATEN...')

  const tables = ['lead_archive', 'lead_assignments', 'lead_requests', 'hot_leads', 'leads', 'email_templates', 'users']

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (error && !error.message.includes('does not exist')) {
      console.log(`   ⚠️  ${table}: ${error.message}`)
    } else {
      console.log(`   ✓ ${table} geleert`)
    }
  }
}

async function migrateUsers() {
  console.log('\n👤 MIGRIERE USERS...')

  const records = await parseCSV('User_Datenbank-Grid view.csv')
  stats.users.total = records.length
  console.log(`   📥 ${records.length} Users aus CSV geladen`)

  const seenEmails = new Set()
  let inserted = 0
  let skipped = 0

  for (const record of records) {
    const vorname = record['Vorname'] || ''
    const nachname = record['Name'] || ''
    const email = record['E-Mail'] || `temp_${Date.now()}_${Math.random().toString(36).slice(2)}@migration.local`

    // Skip duplicates
    if (seenEmails.has(email.toLowerCase())) {
      skipped++
      continue
    }
    seenEmails.add(email.toLowerCase())

    const userData = {
      vorname,
      nachname,
      email,
      email_geschaeftlich: record['E-Mail_Geschäftlich'] || null,
      telefon: record['Telefon'] || null,
      strasse: record['Straße'] || null,
      plz: record['PLZ'] || null,
      ort: record['Ort'] || null,
      bundesland: record['Bundesland'] || null,
      password_hash: record['Passwort'] || null,
      rollen: parseRollen(record['Rolle']),
      status: record['Status'] !== 'false',
      onboarding: parseBoolean(record['Onboarding']),
      google_calendar_id: record['Google_Calendar_ID'] || null
    }

    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single()

    if (error) {
      console.error(`   ❌ User ${vorname} ${nachname}: ${error.message}`)
      stats.users.failed++
    } else {
      inserted++
      // Store mappings
      userEmailToId.set(email.toLowerCase(), data.id)
      const fullName = `${vorname} ${nachname}`.trim()
      if (fullName) {
        userNameToId.set(fullName, data.id)
      }
    }

    // Rate limiting
    if (inserted % 10 === 0) {
      await new Promise(r => setTimeout(r, 50))
    }
  }

  stats.users.inserted = inserted
  console.log(`   ✓ ${inserted} Users eingefügt (${skipped} Duplikate übersprungen)`)
  console.log(`   📋 ${userNameToId.size} User-Namen gemappt`)
}

async function migrateLeads() {
  console.log('\n📋 MIGRIERE LEADS...')

  const records = await parseCSV('Immobilienmakler_Leads-Grid view.csv')
  stats.leads.total = records.length
  console.log(`   📥 ${records.length} Leads aus CSV geladen`)

  const assignmentsToCreate = []
  const BATCH_SIZE = 100
  let inserted = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const leadsData = []
    const batchAssignments = []

    for (const record of batch) {
      const unternehmensname = record['Unternehmensname'] || null

      leadsData.push({
        unternehmensname,
        stadt: record['Stadt'] || null,
        land: normalizeLand(record['Land']),
        kategorie: record['Kategorie'] || 'Immobilienmakler',
        mail: record['Mail'] || null,
        website: record['Website'] || null,
        telefonnummer: record['Telefonnummer'] || null,
        ansprechpartner_vorname: record['Ansprechpartner_Vorname'] || null,
        ansprechpartner_nachname: record['Ansprechpartner_Nachname'] || null,
        bereits_kontaktiert: parseBoolean(record['Bereits_kontaktiert']),
        datum: parseDate(record['Datum']),
        ergebnis: normalizeErgebnis(record['Ergebnis']),
        kommentar: record['Kommentar'] || null,
        wiedervorlage_datum: parseDate(record['Wiedervorlage_Datum']),
        quelle: record['Quelle'] || 'Kaltakquise',
        absprungrate: record['Absprungrate'] || null,
        monatliche_besuche: record['Monatliche_Besuche'] || null,
        anzahl_leads: record['Anzahl_Leads'] || null,
        mehrwert: record['Mehrwert'] || null
      })

      // Store user assignments for later
      if (record['User_Datenbank']) {
        batchAssignments.push({
          leadName: unternehmensname,
          userName: record['User_Datenbank']
        })
      }
    }

    const { data, error } = await supabase
      .from('leads')
      .insert(leadsData)
      .select()

    if (error) {
      console.error(`   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
      stats.leads.failed += batch.length
    } else if (data) {
      inserted += data.length

      // Map lead names to IDs
      for (let j = 0; j < data.length; j++) {
        const leadName = leadsData[j].unternehmensname
        if (leadName) {
          leadNameToId.set(leadName, data[j].id)
        }

        // Link assignments
        if (batchAssignments[j]) {
          assignmentsToCreate.push({
            leadId: data[j].id,
            userName: batchAssignments[j].userName
          })
        }
      }
    }

    // Progress logging
    if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= records.length) {
      console.log(`   📊 Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`)
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 100))
  }

  stats.leads.inserted = inserted
  console.log(`   ✓ ${inserted} Leads eingefügt`)
  console.log(`   📋 ${leadNameToId.size} Lead-Namen gemappt`)

  // Create assignments
  await migrateLeadAssignments(assignmentsToCreate)
}

async function migrateLeadAssignments(assignments) {
  console.log('\n🔗 MIGRIERE LEAD ASSIGNMENTS...')
  stats.assignments.total = assignments.length
  console.log(`   📊 ${assignments.length} Assignments zu erstellen`)

  if (assignments.length === 0) return

  const validAssignments = []
  let userNotFound = 0

  for (const assignment of assignments) {
    const userId = lookupUserId(assignment.userName)
    if (userId && assignment.leadId) {
      validAssignments.push({
        lead_id: assignment.leadId,
        user_id: userId
      })
    } else if (!userId) {
      userNotFound++
    }
  }

  console.log(`   📊 ${validAssignments.length} gültige Assignments (${userNotFound} User nicht gefunden)`)

  // Batch insert
  const BATCH_SIZE = 100
  let inserted = 0

  for (let i = 0; i < validAssignments.length; i += BATCH_SIZE) {
    const batch = validAssignments.slice(i, i + BATCH_SIZE)

    const { error } = await supabase
      .from('lead_assignments')
      .upsert(batch, { onConflict: 'lead_id,user_id', ignoreDuplicates: true })

    if (error) {
      console.error(`   ❌ Assignment Batch: ${error.message}`)
    } else {
      inserted += batch.length
    }

    await new Promise(r => setTimeout(r, 50))
  }

  stats.assignments.inserted = inserted
  console.log(`   ✓ ${inserted} Assignments erstellt`)
}

async function migrateHotLeads() {
  console.log('\n🔥 MIGRIERE HOT LEADS...')

  const records = await parseCSV('Immobilienmakler_Hot_Leads-Grid view.csv')
  stats.hotLeads.total = records.length
  console.log(`   📥 ${records.length} Hot Leads aus CSV geladen`)

  const BATCH_SIZE = 50
  let inserted = 0
  let setterFound = 0, closerFound = 0, leadFound = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const hotLeadsData = []

    for (const record of batch) {
      const setterId = lookupUserId(record['Setter'])
      const closerId = lookupUserId(record['Closer'])
      const leadId = lookupLeadId(record['Immobilienmakler_Leads'])

      if (setterId) setterFound++
      if (closerId) closerFound++
      if (leadId) leadFound++

      hotLeadsData.push({
        lead_id: leadId,
        setter_id: setterId,
        closer_id: closerId,
        unternehmen: record['Unternehmen'] || null,
        ansprechpartner_vorname: record['Ansprechpartner_Vorname'] || null,
        ansprechpartner_nachname: record['Ansprechpartner_Nachname'] || null,
        kategorie: record['Kategorie'] || null,
        mail: record['Mail'] || null,
        telefonnummer: record['Telefonnummer'] || null,
        ort: record['Ort'] || null,
        bundesland: record['Bundesland'] || null,
        website: record['Website'] || null,
        termin_beratungsgespraech: record['Termin_Beratungsgespräch'] || null,
        terminart: record['Terminart'] || null,
        meeting_link: record['Meeting_Link'] || null,
        status: normalizeHotLeadStatus(record['Status']),
        setup: parseCurrency(record['Setup']),
        retainer: parseCurrency(record['Retainer']),
        laufzeit: parseInt(record['Laufzeit']) || null,
        prioritaet: record['Priorität'] || null,
        quelle: record['Quelle'] || null,
        monatliche_besuche: record['Monatliche_Besuche'] || null,
        mehrwert: record['Mehrwert'] || null,
        absprungrate: record['Absprungrate'] || null,
        anzahl_leads: record['Anzahl_Leads'] || null,
        produkt_dienstleistung: record['Produkt_Dienstleistung'] || null,
        kunde_seit: record['Kunde seit'] || record['Kunde_seit'] || null,
        kommentar: record['Kommentar'] || null
      })
    }

    const { data, error } = await supabase
      .from('hot_leads')
      .insert(hotLeadsData)
      .select()

    if (error) {
      console.error(`   ❌ Hot Leads Batch: ${error.message}`)
      stats.hotLeads.failed += batch.length
    } else if (data) {
      inserted += data.length
    }

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= records.length) {
      console.log(`   📊 Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`)
    }

    await new Promise(r => setTimeout(r, 100))
  }

  stats.hotLeads.inserted = inserted
  console.log(`   ✓ ${inserted} Hot Leads eingefügt`)
  console.log(`   🔗 Verknüpfungen: Setter ${setterFound}, Closer ${closerFound}, Lead ${leadFound}`)
}

async function migrateArchive() {
  console.log('\n📦 MIGRIERE ARCHIV...')

  const records = await parseCSV('Immobilienmakler_Leads_Archiv-Grid view.csv')
  stats.archive.total = records.length
  console.log(`   📥 ${records.length} Archiv-Einträge aus CSV geladen`)

  const BATCH_SIZE = 50
  let inserted = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const archiveData = []

    for (const record of batch) {
      const leadId = lookupLeadId(record['Lead'])
      const userId = lookupUserId(record['Vertriebler'])

      archiveData.push({
        lead_id: leadId,
        user_id: userId,
        bereits_kontaktiert: parseBoolean(record['Bereits_kontaktiert']),
        ergebnis: normalizeErgebnis(record['Ergebnis']),
        datum: parseDate(record['Datum'])
      })
    }

    const { error } = await supabase
      .from('lead_archive')
      .insert(archiveData)

    if (error) {
      console.error(`   ❌ Archiv Batch: ${error.message}`)
      stats.archive.failed += batch.length
    } else {
      inserted += batch.length
    }

    await new Promise(r => setTimeout(r, 50))
  }

  stats.archive.inserted = inserted
  console.log(`   ✓ ${inserted} Archiv-Einträge eingefügt`)
}

async function migrateEmailTemplates() {
  console.log('\n📧 MIGRIERE E-MAIL TEMPLATES...')

  const records = await parseCSV('E-Mail_Templates-Grid view.csv')
  stats.emailTemplates.total = records.length
  console.log(`   📥 ${records.length} Templates aus CSV geladen`)

  let inserted = 0

  for (const record of records) {
    const templateData = {
      name: record['Name'] || 'Unbenannt',
      kategorie: record['Kategorie'] || 'Sonstige',
      betreff: record['Betreff'] || '',
      inhalt: record['Inhalt'] || '',
      aktiv: record['Aktiv'] !== 'false'
    }

    const { error } = await supabase
      .from('email_templates')
      .insert(templateData)

    if (error) {
      console.error(`   ❌ Template ${record['Name']}: ${error.message}`)
      stats.emailTemplates.failed++
    } else {
      inserted++
    }
  }

  stats.emailTemplates.inserted = inserted
  console.log(`   ✓ ${inserted} Templates eingefügt`)
}

async function migrateLeadRequests() {
  console.log('\n📝 MIGRIERE LEAD ANFRAGEN...')

  const records = await parseCSV('Lead_Anfragen-Grid view.csv')
  stats.leadRequests.total = records.length
  console.log(`   📥 ${records.length} Anfragen aus CSV geladen`)

  let inserted = 0

  for (const record of records) {
    const userId = lookupUserId(record['User'])
    const bearbeitetVonId = lookupUserId(record['Bearbeitet_von'])

    const requestData = {
      anfrage_id: record['Anfrage_ID'] || `ANF-${Date.now()}`,
      user_id: userId,
      anzahl: parseInt(record['Anzahl']) || 0,
      nachricht: record['Nachricht'] || null,
      status: record['Status'] || 'Ausstehend',
      bearbeitet_von: bearbeitetVonId,
      genehmigte_anzahl: parseInt(record['Genehmigte_Anzahl']) || null,
      admin_kommentar: record['Admin_Kommentar'] || null
    }

    const { error } = await supabase
      .from('lead_requests')
      .insert(requestData)

    if (error) {
      console.error(`   ❌ Anfrage ${record['Anfrage_ID']}: ${error.message}`)
      stats.leadRequests.failed++
    } else {
      inserted++
    }
  }

  stats.leadRequests.inserted = inserted
  console.log(`   ✓ ${inserted} Anfragen eingefügt`)
}

async function verifyMigration() {
  console.log('\n🔍 VERIFIZIERE MIGRATION...')

  const tables = ['users', 'leads', 'lead_assignments', 'hot_leads', 'lead_archive', 'email_templates', 'lead_requests']
  const counts = {}

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    counts[table] = error ? 'ERROR' : count
  }

  console.log('')
  console.log('📊 SUPABASE COUNTS:')
  console.log(`   users:            ${counts.users}`)
  console.log(`   leads:            ${counts.leads}`)
  console.log(`   lead_assignments: ${counts.lead_assignments}`)
  console.log(`   hot_leads:        ${counts.hot_leads}`)
  console.log(`   lead_archive:     ${counts.lead_archive}`)
  console.log(`   email_templates:  ${counts.email_templates}`)
  console.log(`   lead_requests:    ${counts.lead_requests}`)

  return counts
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  SUNSIDE CRM - CSV zu SUPABASE MIGRATION v3')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  console.log('📂 Datenquelle:', DATA_DIR)
  console.log('')

  try {
    // 1. Clear existing data
    await clearAllData()

    // 2. Migrate in correct order (dependencies first)
    await migrateUsers()
    await migrateLeads()  // Also creates assignments
    await migrateHotLeads()
    await migrateArchive()
    await migrateEmailTemplates()
    await migrateLeadRequests()

    // 3. Verify
    await verifyMigration()

    // Summary
    console.log('\n═══════════════════════════════════════════════════════')
    console.log('  MIGRATION ABGESCHLOSSEN')
    console.log('═══════════════════════════════════════════════════════')
    console.log('')
    console.log('📊 STATISTIK:')
    console.log(`   Users:           ${stats.users.inserted}/${stats.users.total}`)
    console.log(`   Leads:           ${stats.leads.inserted}/${stats.leads.total}`)
    console.log(`   Assignments:     ${stats.assignments.inserted}/${stats.assignments.total}`)
    console.log(`   Hot Leads:       ${stats.hotLeads.inserted}/${stats.hotLeads.total}`)
    console.log(`   Archiv:          ${stats.archive.inserted}/${stats.archive.total}`)
    console.log(`   E-Mail Templates: ${stats.emailTemplates.inserted}/${stats.emailTemplates.total}`)
    console.log(`   Lead Anfragen:   ${stats.leadRequests.inserted}/${stats.leadRequests.total}`)
    console.log('')

    const totalFailed = stats.users.failed + stats.leads.failed + stats.hotLeads.failed +
                        stats.archive.failed + stats.emailTemplates.failed + stats.leadRequests.failed

    if (totalFailed > 0) {
      console.log(`⚠️  ${totalFailed} Records fehlgeschlagen`)
    } else {
      console.log('✅ Migration erfolgreich!')
    }

  } catch (error) {
    console.error('\n❌ MIGRATION FEHLGESCHLAGEN:', error)
    process.exit(1)
  }
}

main()
