/**
 * SUNSIDE CRM - Airtable zu Supabase Migration
 *
 * Migriert alle Daten direkt von Airtable nach Supabase.
 *
 * Verwendung:
 * node supabase/migrate-airtable-to-supabase.js
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// =====================================================
// KONFIGURATION
// =====================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appomNFLRY3mYFCvd'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const AIRTABLE_TABLES = {
  users: 'User_Datenbank',
  leads: 'Immobilienmakler_Leads',
  hotLeads: 'Immobilienmakler_Hot_Leads',
  archive: 'Immobilienmakler_Leads_Archiv',
  emailTemplates: 'E-Mail_Templates',
  leadRequests: 'Lead_Anfragen',
  systemMessages: 'System_Messages'
}

// ID Mappings: Airtable ID -> Supabase UUID
const idMappings = {
  users: new Map(),
  leads: new Map()
}

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
// AIRTABLE API FUNKTIONEN
// =====================================================

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchFromAirtable(tableName, offset = null) {
  // Proaktiv warten BEVOR Request - verhindert 429
  await sleep(300)

  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`)
  url.searchParams.set('pageSize', '100')
  if (offset) {
    url.searchParams.set('offset', offset)
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  })

  if (response.status === 429) {
    console.log('   ⏳ Rate limit - warte 35 Sekunden...')
    await sleep(35000)
    return fetchFromAirtable(tableName, offset)
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Airtable Fehler ${response.status}: ${error}`)
  }

  return response.json()
}

async function fetchAllFromAirtable(tableName) {
  console.log(`   📥 Lade ${tableName} aus Airtable...`)

  const allRecords = []
  let offset = null

  do {
    const data = await fetchFromAirtable(tableName, offset)
    allRecords.push(...(data.records || []))
    offset = data.offset

    if (offset) {
      await sleep(250) // Rate limiting: max 5 requests/second
    }
  } while (offset)

  console.log(`   ✓ ${allRecords.length} Records geladen`)
  return allRecords
}

// =====================================================
// HELPER FUNKTIONEN
// =====================================================

function parseRollen(rolleStr) {
  if (!rolleStr) return []
  if (Array.isArray(rolleStr)) return rolleStr
  return rolleStr.split(',').map(r => r.trim()).filter(Boolean)
}

function parseBoolean(val) {
  if (!val) return false
  if (val === true) return true
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
  return ergebnis // Behalte Original-Wert
}

function normalizeHotLeadStatus(status) {
  if (!status) return 'Lead'
  const validStatuses = ['Lead', 'Angebot', 'Angebot versendet', 'Abgeschlossen', 'Verloren', 'Termin abgesagt', 'Termin verschoben']
  return validStatuses.includes(status) ? status : 'Lead'
}

function parseCurrency(val) {
  if (!val) return null
  if (typeof val === 'number') return val
  const cleaned = String(val).replace(/[€$\s]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

// =====================================================
// MIGRATION FUNKTIONEN
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

  const records = await fetchAllFromAirtable(AIRTABLE_TABLES.users)
  stats.users.total = records.length

  const seenEmails = new Set()
  let inserted = 0

  for (const record of records) {
    const f = record.fields
    const email = f['E-Mail'] || f['Mail'] || `temp_${record.id}@migration.local`

    // Skip duplicates
    if (seenEmails.has(email.toLowerCase())) {
      // Map duplicate to existing user
      continue
    }
    seenEmails.add(email.toLowerCase())

    const userData = {
      vorname: f['Vorname'] || '',
      nachname: f['Name'] || f['Nachname'] || '',
      email,
      email_geschaeftlich: f['E-Mail_Geschäftlich'] || null,
      telefon: f['Telefon'] || null,
      strasse: f['Straße'] || null,
      plz: f['PLZ'] || null,
      ort: f['Ort'] || null,
      bundesland: f['Bundesland'] || null,
      password_hash: f['Passwort'] || null,
      rollen: parseRollen(f['Rolle']),
      status: f['Status'] !== false,
      onboarding: parseBoolean(f['Onboarding']),
      google_calendar_id: f['Google_Calendar_ID'] || null,
      airtable_id: record.id
    }

    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single()

    if (error) {
      console.error(`   ❌ User ${f['Vorname']} ${f['Name']}: ${error.message}`)
      stats.users.failed++
    } else {
      inserted++
      idMappings.users.set(record.id, data.id)
    }
  }

  // Map duplicates to their primary user
  for (const record of records) {
    if (!idMappings.users.has(record.id)) {
      const email = (record.fields['E-Mail'] || record.fields['Mail'] || '').toLowerCase()
      // Find the user with same email
      for (const [airtableId, supabaseId] of idMappings.users.entries()) {
        const otherRecord = records.find(r => r.id === airtableId)
        const otherEmail = (otherRecord?.fields['E-Mail'] || otherRecord?.fields['Mail'] || '').toLowerCase()
        if (otherEmail === email) {
          idMappings.users.set(record.id, supabaseId)
          break
        }
      }
    }
  }

  stats.users.inserted = inserted
  console.log(`   ✓ ${inserted} Users eingefügt`)
  console.log(`   📋 ${idMappings.users.size} User-IDs gemappt`)
}

async function migrateLeads() {
  console.log('\n📋 MIGRIERE LEADS...')

  const records = await fetchAllFromAirtable(AIRTABLE_TABLES.leads)
  stats.leads.total = records.length

  const assignmentsToCreate = []
  const BATCH_SIZE = 100
  let inserted = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const leadsData = []
    const airtableIds = []

    for (const record of batch) {
      const f = record.fields

      leadsData.push({
        unternehmensname: f['Unternehmensname'] || f['Name'] || null,
        stadt: f['Stadt'] || f['Ort'] || null,
        land: normalizeLand(f['Land']),
        kategorie: f['Kategorie'] || 'Immobilienmakler',
        mail: f['Mail'] || f['Email'] || null,
        website: f['Website'] || null,
        telefonnummer: f['Telefonnummer'] || f['Telefon'] || null,
        ansprechpartner_vorname: f['Ansprechpartner_Vorname'] || null,
        ansprechpartner_nachname: f['Ansprechpartner_Nachname'] || null,
        bereits_kontaktiert: parseBoolean(f['Bereits_kontaktiert']),
        datum: f['Datum'] || null,
        ergebnis: normalizeErgebnis(f['Ergebnis']),
        kommentar: f['Kommentar'] || f['Notizen'] || null,
        wiedervorlage_datum: f['Wiedervorlage_Datum'] || f['Wiedervorlage'] || null,
        quelle: f['Quelle'] || 'Kaltakquise',
        absprungrate: f['Absprungrate'] || null,
        monatliche_besuche: f['Monatliche_Besuche'] || null,
        anzahl_leads: f['Anzahl_Leads'] || null,
        mehrwert: f['Mehrwert'] || null,
        airtable_id: record.id
      })
      airtableIds.push(record.id)

      // Store user assignments
      const userIds = f['User_Datenbank'] || []
      if (Array.isArray(userIds) && userIds.length > 0) {
        assignmentsToCreate.push({
          airtableLeadId: record.id,
          airtableUserIds: userIds
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
      // Map IDs
      for (let j = 0; j < data.length; j++) {
        idMappings.leads.set(airtableIds[j], data[j].id)
      }
    }

    // Progress
    if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= records.length) {
      console.log(`   📊 Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`)
    }

    await sleep(100)
  }

  stats.leads.inserted = inserted
  console.log(`   ✓ ${inserted} Leads eingefügt`)
  console.log(`   📋 ${idMappings.leads.size} Lead-IDs gemappt`)

  // Create assignments
  await migrateLeadAssignments(assignmentsToCreate)
}

async function migrateLeadAssignments(assignmentsData) {
  console.log('\n🔗 MIGRIERE LEAD ASSIGNMENTS...')

  const assignments = []
  let userNotFound = 0
  let leadNotFound = 0

  for (const data of assignmentsData) {
    const supabaseLeadId = idMappings.leads.get(data.airtableLeadId)
    if (!supabaseLeadId) {
      leadNotFound++
      continue
    }

    for (const airtableUserId of data.airtableUserIds) {
      const supabaseUserId = idMappings.users.get(airtableUserId)
      if (supabaseUserId) {
        assignments.push({
          lead_id: supabaseLeadId,
          user_id: supabaseUserId
        })
      } else {
        userNotFound++
      }
    }
  }

  stats.assignments.total = assignments.length
  console.log(`   📊 ${assignments.length} Assignments zu erstellen`)
  console.log(`   ⚠️  ${userNotFound} User nicht gefunden, ${leadNotFound} Leads nicht gefunden`)

  if (assignments.length === 0) return

  // Batch insert
  const BATCH_SIZE = 100
  let inserted = 0

  for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
    const batch = assignments.slice(i, i + BATCH_SIZE)

    const { error } = await supabase
      .from('lead_assignments')
      .upsert(batch, { onConflict: 'lead_id,user_id', ignoreDuplicates: true })

    if (error) {
      console.error(`   ❌ Assignment Batch: ${error.message}`)
    } else {
      inserted += batch.length
    }
  }

  stats.assignments.inserted = inserted
  console.log(`   ✓ ${inserted} Assignments erstellt`)
}

async function migrateHotLeads() {
  console.log('\n🔥 MIGRIERE HOT LEADS...')

  const records = await fetchAllFromAirtable(AIRTABLE_TABLES.hotLeads)
  stats.hotLeads.total = records.length

  const BATCH_SIZE = 50
  let inserted = 0
  let setterFound = 0, closerFound = 0, leadFound = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const hotLeadsData = []

    for (const record of batch) {
      const f = record.fields

      // Resolve linked records
      const originalLeadIds = f['Immobilienmakler_Leads'] || []
      const setterIds = f['Setter'] || []
      const closerIds = f['Closer'] || []

      const leadId = originalLeadIds[0] ? idMappings.leads.get(originalLeadIds[0]) : null
      const setterId = setterIds[0] ? idMappings.users.get(setterIds[0]) : null
      const closerId = closerIds[0] ? idMappings.users.get(closerIds[0]) : null

      if (leadId) leadFound++
      if (setterId) setterFound++
      if (closerId) closerFound++

      hotLeadsData.push({
        lead_id: leadId,
        setter_id: setterId,
        closer_id: closerId,
        unternehmen: f['Unternehmen'] || null,
        ansprechpartner_vorname: f['Ansprechpartner_Vorname'] || null,
        ansprechpartner_nachname: f['Ansprechpartner_Nachname'] || null,
        kategorie: f['Kategorie'] || null,
        mail: f['Mail'] || null,
        telefonnummer: f['Telefonnummer'] || null,
        ort: f['Ort'] || null,
        bundesland: f['Bundesland'] || null,
        website: f['Website'] || null,
        termin_beratungsgespraech: f['Termin_Beratungsgespräch'] || null,
        terminart: f['Terminart'] || null,
        meeting_link: f['Meeting_Link'] || null,
        status: normalizeHotLeadStatus(f['Status']),
        setup: parseCurrency(f['Setup']),
        retainer: parseCurrency(f['Retainer']),
        laufzeit: parseInt(f['Laufzeit']) || null,
        prioritaet: f['Priorität'] || null,
        quelle: f['Quelle'] || null,
        monatliche_besuche: f['Monatliche_Besuche'] || null,
        mehrwert: f['Mehrwert'] || null,
        absprungrate: f['Absprungrate'] || null,
        anzahl_leads: f['Anzahl_Leads'] || null,
        produkt_dienstleistung: f['Produkt_Dienstleistung'] || null,
        kunde_seit: f['Kunde_seit'] || f['Kunde seit'] || null,
        kommentar: f['Kommentar'] || null,
        airtable_id: record.id
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

    await sleep(100)
  }

  stats.hotLeads.inserted = inserted
  console.log(`   ✓ ${inserted} Hot Leads eingefügt`)
  console.log(`   🔗 Verknüpfungen: ${setterFound} Setter, ${closerFound} Closer, ${leadFound} Leads`)
}

async function migrateArchive() {
  console.log('\n📦 MIGRIERE ARCHIV...')

  const records = await fetchAllFromAirtable(AIRTABLE_TABLES.archive)
  stats.archive.total = records.length

  const BATCH_SIZE = 50
  let inserted = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const archiveData = []

    for (const record of batch) {
      const f = record.fields

      const leadIds = f['Lead'] || f['Immobilienmakler_Leads'] || []
      const userIds = f['Vertriebler'] || f['User_Datenbank'] || []

      const leadId = leadIds[0] ? idMappings.leads.get(leadIds[0]) : null
      const userId = userIds[0] ? idMappings.users.get(userIds[0]) : null

      archiveData.push({
        lead_id: leadId,
        user_id: userId,
        bereits_kontaktiert: parseBoolean(f['Bereits_kontaktiert']),
        ergebnis: normalizeErgebnis(f['Ergebnis']),
        datum: f['Datum'] || null,
        airtable_id: record.id
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

    await sleep(50)
  }

  stats.archive.inserted = inserted
  console.log(`   ✓ ${inserted} Archiv-Einträge eingefügt`)
}

async function migrateEmailTemplates() {
  console.log('\n📧 MIGRIERE E-MAIL TEMPLATES...')

  const records = await fetchAllFromAirtable(AIRTABLE_TABLES.emailTemplates)
  stats.emailTemplates.total = records.length

  let inserted = 0

  for (const record of records) {
    const f = record.fields

    const templateData = {
      name: f['Name'] || 'Unbenannt',
      kategorie: f['Kategorie'] || 'Sonstige',
      betreff: f['Betreff'] || '',
      inhalt: f['Inhalt'] || '',
      aktiv: f['Aktiv'] !== false,
      airtable_id: record.id
    }

    const { error } = await supabase
      .from('email_templates')
      .insert(templateData)

    if (error) {
      console.error(`   ❌ Template ${f['Name']}: ${error.message}`)
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

  const records = await fetchAllFromAirtable(AIRTABLE_TABLES.leadRequests)
  stats.leadRequests.total = records.length

  let inserted = 0

  for (const record of records) {
    const f = record.fields

    const userIds = f['User'] || []
    const bearbeitetVonIds = f['Bearbeitet_von'] || []

    const userId = userIds[0] ? idMappings.users.get(userIds[0]) : null
    const bearbeitetVonId = bearbeitetVonIds[0] ? idMappings.users.get(bearbeitetVonIds[0]) : null

    const requestData = {
      anfrage_id: f['Anfrage_ID'] || `ANF-${Date.now()}`,
      user_id: userId,
      anzahl: parseInt(f['Anzahl']) || 0,
      nachricht: f['Nachricht'] || null,
      status: f['Status'] || 'Ausstehend',
      bearbeitet_von: bearbeitetVonId,
      genehmigte_anzahl: parseInt(f['Genehmigte_Anzahl']) || null,
      admin_kommentar: f['Admin_Kommentar'] || null,
      airtable_id: record.id
    }

    const { error } = await supabase
      .from('lead_requests')
      .insert(requestData)

    if (error) {
      console.error(`   ❌ Anfrage ${f['Anfrage_ID']}: ${error.message}`)
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
  console.log('  SUNSIDE CRM - AIRTABLE zu SUPABASE MIGRATION')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  console.log('📡 Airtable Base:', AIRTABLE_BASE_ID)
  console.log('🗄️  Supabase URL:', process.env.SUPABASE_URL)
  console.log('')

  if (!AIRTABLE_API_KEY) {
    console.error('❌ AIRTABLE_API_KEY nicht in .env gesetzt!')
    process.exit(1)
  }

  try {
    // 1. Clear existing data
    await clearAllData()

    // 2. Migrate in correct order (dependencies first)
    await migrateUsers()
    await migrateLeads()       // Also creates assignments
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
