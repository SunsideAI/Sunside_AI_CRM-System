/**
 * SUNSIDE CRM - Airtable zu Supabase Daten-Migration v2
 *
 * VERBESSERUNGEN:
 * - Speichert Airtable-IDs für spätere Referenz
 * - Keine index-basierte Zuordnung mehr
 * - Bessere Fehlerbehandlung
 * - Detailliertes Logging
 *
 * Verwendung:
 * 1. npm install @supabase/supabase-js airtable dotenv
 * 2. .env Datei mit allen Keys erstellen
 * 3. node supabase/migrate-data-v2.js
 */

import 'dotenv/config'
import Airtable from 'airtable'
import { createClient } from '@supabase/supabase-js'

// =====================================================
// KONFIGURATION
// =====================================================

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
const base = airtable.base(process.env.AIRTABLE_BASE_ID)

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

// ID Mapping: Airtable Record ID -> Supabase UUID
const idMappings = {
  users: new Map(),
  leads: new Map(),
  hotLeads: new Map(),
  emailTemplates: new Map()
}

// Stats für Logging
const stats = {
  users: { total: 0, inserted: 0, failed: 0 },
  leads: { total: 0, inserted: 0, failed: 0 },
  assignments: { total: 0, inserted: 0, failed: 0 },
  hotLeads: { total: 0, inserted: 0, failed: 0 },
  archive: { total: 0, inserted: 0, failed: 0 }
}

// =====================================================
// HELPER FUNKTIONEN
// =====================================================

async function fetchAllFromAirtable(tableName) {
  console.log(`📥 Lade ${tableName} aus Airtable...`)
  const records = []

  await base(tableName)
    .select({ view: 'Grid view' })
    .eachPage((pageRecords, fetchNextPage) => {
      records.push(...pageRecords)
      fetchNextPage()
    })

  console.log(`   ✓ ${records.length} Records geladen`)
  return records
}

/**
 * Einzelnen Record in Supabase einfügen mit Retry-Logik
 */
async function insertSingleRecord(tableName, record, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const { data, error } = await supabase
      .from(tableName)
      .insert(record)
      .select()
      .single()

    if (!error && data) {
      return { success: true, data }
    }

    if (attempt < retries) {
      console.warn(`   ⚠️ Retry ${attempt}/${retries} für ${tableName}`)
      await new Promise(r => setTimeout(r, 500 * attempt))
    } else {
      console.error(`   ❌ Fehler bei ${tableName}:`, error?.message)
      return { success: false, error }
    }
  }
}

/**
 * Batch-Insert mit individuellem Tracking
 */
async function insertRecordsWithTracking(tableName, records, airtableIds) {
  console.log(`📤 Importiere ${records.length} Records in ${tableName}...`)

  const results = []
  let successCount = 0
  let failCount = 0

  for (let i = 0; i < records.length; i++) {
    const result = await insertSingleRecord(tableName, records[i])

    if (result.success) {
      results.push({
        airtableId: airtableIds[i],
        supabaseId: result.data.id,
        data: result.data
      })
      successCount++
    } else {
      failCount++
      console.error(`   ❌ Record ${i + 1}/${records.length} fehlgeschlagen (Airtable ID: ${airtableIds[i]})`)
    }

    // Progress logging alle 100 Records
    if ((i + 1) % 100 === 0) {
      console.log(`   📊 Progress: ${i + 1}/${records.length} (${successCount} OK, ${failCount} Fehler)`)
    }

    // Rate limiting
    if ((i + 1) % 50 === 0) {
      await new Promise(r => setTimeout(r, 100))
    }
  }

  console.log(`   ✓ ${successCount} erfolgreich, ${failCount} fehlgeschlagen`)
  return results
}

// =====================================================
// MIGRATION FUNCTIONS
// =====================================================

async function migrateUsers() {
  console.log('\n👤 MIGRIERE USERS...')

  const airtableRecords = await fetchAllFromAirtable(AIRTABLE_TABLES.users)
  stats.users.total = airtableRecords.length

  const supabaseRecords = []
  const airtableIds = []

  // E-Mail Duplikat-Prüfung
  const seenEmails = new Set()

  for (const record of airtableRecords) {
    const fields = record.fields

    // Feldnamen wie in Airtable (aus v1 Migration)
    const vorname = fields['Vorname'] || ''
    const nachname = fields['Name'] || fields['Nachname'] || ''  // 'Name' ist Nachname in Airtable
    const email = fields['E-Mail'] || fields['Mail'] || `temp_${record.id}@migration.local`

    // Duplikat-Check (Airtable erlaubt Duplikate, Supabase nicht)
    if (seenEmails.has(email.toLowerCase())) {
      console.log(`   ⚠️ Duplikat übersprungen: ${email} (Airtable ID: ${record.id})`)
      // Trotzdem zum Mapping hinzufügen (falls später referenziert)
      continue
    }
    seenEmails.add(email.toLowerCase())

    supabaseRecords.push({
      vorname,
      nachname,
      email,
      email_geschaeftlich: fields['E-Mail_Geschäftlich'] || null,
      telefon: fields['Telefon'] || null,
      strasse: fields['Straße'] || null,
      plz: fields['PLZ'] || null,
      ort: fields['Ort'] || null,
      bundesland: fields['Bundesland'] || null,
      password_hash: fields['Passwort'] || null,
      rollen: parseRollen(fields['Rolle']),  // 'Rolle' nicht 'Rollen'
      status: fields['Status'] !== false,
      onboarding: fields['Onboarding'] === true,
      google_calendar_id: fields['Google_Calendar_ID'] || null,
      airtable_id: record.id
    })
    airtableIds.push(record.id)
  }

  console.log(`   📊 ${airtableRecords.length} in Airtable, ${supabaseRecords.length} unique (nach Duplikat-Filter)`)

  const results = await insertRecordsWithTracking('users', supabaseRecords, airtableIds)

  // ID Mapping erstellen
  for (const result of results) {
    idMappings.users.set(result.airtableId, result.supabaseId)
  }

  // Email-zu-Supabase-ID Map für Duplikat-Handling
  const emailToSupabaseId = new Map()
  for (const result of results) {
    // Finde das entsprechende Airtable Record
    const airtableRecord = airtableRecords.find(r => r.id === result.airtableId)
    if (airtableRecord) {
      const email = (airtableRecord.fields['E-Mail'] || airtableRecord.fields['Mail'] || '').toLowerCase()
      if (email) {
        emailToSupabaseId.set(email, result.supabaseId)
      }
    }
  }

  // Duplikate auf die gleiche Supabase ID mappen
  for (const record of airtableRecords) {
    if (!idMappings.users.has(record.id)) {
      const email = (record.fields['E-Mail'] || record.fields['Mail'] || '').toLowerCase()
      const supabaseId = emailToSupabaseId.get(email)
      if (supabaseId) {
        idMappings.users.set(record.id, supabaseId)
        console.log(`   🔗 Duplikat gemappt: ${record.id} -> ${supabaseId}`)
      }
    }
  }

  stats.users.inserted = results.length
  stats.users.failed = airtableRecords.length - idMappings.users.size

  console.log(`   📋 ID Mappings: ${idMappings.users.size} Users (inkl. Duplikate)`)
}

async function migrateLeads() {
  console.log('\n📋 MIGRIERE LEADS...')

  const airtableRecords = await fetchAllFromAirtable(AIRTABLE_TABLES.leads)
  stats.leads.total = airtableRecords.length

  const supabaseRecords = []
  const airtableIds = []
  const assignmentData = [] // Speichere Assignment-Info für später

  // Statistik-Counter für Debugging
  let kontaktiertCount = 0
  let ergebnisStats = {}

  for (const record of airtableRecords) {
    const fields = record.fields

    const bereitsKontaktiert = isTruthy(fields['Bereits_kontaktiert'])
    const ergebnis = normalizeErgebnis(fields['Ergebnis'])

    if (bereitsKontaktiert) kontaktiertCount++
    if (ergebnis) {
      ergebnisStats[ergebnis] = (ergebnisStats[ergebnis] || 0) + 1
    }

    supabaseRecords.push({
      unternehmensname: fields['Unternehmensname'] || fields['Name'] || null,
      stadt: fields['Stadt'] || fields['Ort'] || null,
      land: normalizeLand(fields['Land']),
      kategorie: normalizeKategorie(fields['Kategorie']),
      mail: fields['Mail'] || fields['Email'] || null,
      website: fields['Website'] || null,
      telefonnummer: fields['Telefonnummer'] || fields['Telefon'] || null,
      ansprechpartner_vorname: fields['Ansprechpartner_Vorname'] || null,
      ansprechpartner_nachname: fields['Ansprechpartner_Nachname'] || null,
      bereits_kontaktiert: isTruthy(fields['Bereits_kontaktiert']),
      datum: fields['Datum'] || null,
      ergebnis: normalizeErgebnis(fields['Ergebnis']),
      kommentar: fields['Kommentar'] || fields['Notizen'] || null,
      wiedervorlage_datum: fields['Wiedervorlage_Datum'] || fields['Wiedervorlage'] || null,
      quelle: fields['Quelle'] || 'Kaltakquise',
      absprungrate: fields['Absprungrate'] || null,
      monatliche_besuche: fields['Monatliche_Besuche'] || null,
      anzahl_leads: fields['Anzahl_Leads'] || null,
      mehrwert: fields['Mehrwert'] || null,
      airtable_id: record.id
    })
    airtableIds.push(record.id)

    // Speichere User-Assignments für später
    const userIds = fields['User_Datenbank'] || []
    if (Array.isArray(userIds) && userIds.length > 0) {
      assignmentData.push({
        airtableLeadId: record.id,
        airtableUserIds: userIds
      })
    }
  }

  const results = await insertRecordsWithTracking('leads', supabaseRecords, airtableIds)

  // ID Mapping erstellen
  for (const result of results) {
    idMappings.leads.set(result.airtableId, result.supabaseId)
  }

  stats.leads.inserted = results.length
  stats.leads.failed = airtableRecords.length - results.length

  console.log(`   📋 ID Mappings: ${idMappings.leads.size} Leads`)
  console.log(`   📊 Kontaktiert: ${kontaktiertCount}/${airtableRecords.length}`)
  console.log(`   📊 Ergebnis-Verteilung:`)
  for (const [ergebnis, count] of Object.entries(ergebnisStats).sort((a, b) => b[1] - a[1])) {
    console.log(`      - ${ergebnis}: ${count}`)
  }

  // Lead Assignments migrieren
  await migrateLeadAssignments(assignmentData)
}

async function migrateLeadAssignments(assignmentData) {
  console.log('\n🔗 MIGRIERE LEAD ASSIGNMENTS...')
  console.log(`   📊 ${assignmentData.length} Leads mit User-Zuweisungen in Airtable`)

  const assignments = []
  let leadLookupSuccess = 0
  let leadLookupFail = 0
  let userLookupSuccess = 0
  let userLookupFail = 0

  for (const data of assignmentData) {
    const supabaseLeadId = idMappings.leads.get(data.airtableLeadId)

    if (!supabaseLeadId) {
      leadLookupFail++
      // Nur erste 5 loggen um Console nicht zu überfluten
      if (leadLookupFail <= 5) {
        console.warn(`   ⚠️ Lead nicht gefunden: ${data.airtableLeadId}`)
      }
      continue
    }
    leadLookupSuccess++

    for (const airtableUserId of data.airtableUserIds) {
      const supabaseUserId = idMappings.users.get(airtableUserId)

      if (supabaseUserId) {
        userLookupSuccess++
        assignments.push({
          lead_id: supabaseLeadId,
          user_id: supabaseUserId
        })
      } else {
        userLookupFail++
        if (userLookupFail <= 5) {
          console.warn(`   ⚠️ User nicht gefunden: ${airtableUserId}`)
        }
      }
    }
  }

  console.log(`   📊 Lead Lookups: ${leadLookupSuccess} OK, ${leadLookupFail} fehlend`)
  console.log(`   📊 User Lookups: ${userLookupSuccess} OK, ${userLookupFail} fehlend`)

  stats.assignments.total = assignments.length
  console.log(`   📊 ${assignments.length} Assignments zu erstellen`)

  if (assignments.length === 0) {
    console.log('   ⚠️ Keine Assignments zu migrieren!')
    return
  }

  // Batch-Insert für Assignments (diese sind simpler)
  const chunkSize = 100
  let inserted = 0
  let failed = 0

  for (let i = 0; i < assignments.length; i += chunkSize) {
    const chunk = assignments.slice(i, i + chunkSize)

    const { data, error } = await supabase
      .from('lead_assignments')
      .upsert(chunk, {
        onConflict: 'lead_id,user_id',
        ignoreDuplicates: true
      })
      .select()

    if (error) {
      console.error(`   ❌ Assignment Chunk Fehler:`, error.message)
      failed += chunk.length
    } else {
      inserted += chunk.length
    }

    if ((i + chunkSize) % 500 === 0) {
      console.log(`   📊 Progress: ${Math.min(i + chunkSize, assignments.length)}/${assignments.length}`)
    }
  }

  stats.assignments.inserted = inserted
  stats.assignments.failed = failed

  console.log(`   ✓ ${inserted} Assignments erstellt`)
}

async function migrateHotLeads() {
  console.log('\n🔥 MIGRIERE HOT LEADS...')

  const airtableRecords = await fetchAllFromAirtable(AIRTABLE_TABLES.hotLeads)
  stats.hotLeads.total = airtableRecords.length

  const supabaseRecords = []
  const airtableIds = []

  // Lookup-Statistiken
  let lookupStats = {
    leadFound: 0, leadMissing: 0,
    setterFound: 0, setterMissing: 0,
    closerFound: 0, closerMissing: 0
  }

  for (const record of airtableRecords) {
    const fields = record.fields

    // Linked Records auflösen
    const originalLeadIds = fields['Immobilienmakler_Leads'] || []
    const setterIds = fields['Setter'] || []
    const closerIds = fields['Closer'] || []

    // Lookups mit Tracking
    let supabaseLeadId = null
    let supabaseSetter = null
    let supabaseCloser = null

    if (originalLeadIds[0]) {
      supabaseLeadId = idMappings.leads.get(originalLeadIds[0])
      if (supabaseLeadId) lookupStats.leadFound++
      else {
        lookupStats.leadMissing++
        console.warn(`   ⚠️ Hot Lead: Original-Lead nicht gefunden: ${originalLeadIds[0]}`)
      }
    }

    if (setterIds[0]) {
      supabaseSetter = idMappings.users.get(setterIds[0])
      if (supabaseSetter) lookupStats.setterFound++
      else {
        lookupStats.setterMissing++
        console.warn(`   ⚠️ Hot Lead: Setter nicht gefunden: ${setterIds[0]}`)
      }
    }

    if (closerIds[0]) {
      supabaseCloser = idMappings.users.get(closerIds[0])
      if (supabaseCloser) lookupStats.closerFound++
      else {
        lookupStats.closerMissing++
        console.warn(`   ⚠️ Hot Lead: Closer nicht gefunden: ${closerIds[0]}`)
      }
    }

    supabaseRecords.push({
      lead_id: supabaseLeadId,
      setter_id: supabaseSetter,
      closer_id: supabaseCloser,
      unternehmen: fields['Unternehmen'] || null,
      ansprechpartner_vorname: fields['Ansprechpartner_Vorname'] || null,
      ansprechpartner_nachname: fields['Ansprechpartner_Nachname'] || null,
      kategorie: fields['Kategorie'] || null,
      mail: fields['Mail'] || null,
      telefonnummer: fields['Telefonnummer'] || null,
      ort: fields['Ort'] || null,
      bundesland: fields['Bundesland'] || null,
      website: fields['Website'] || null,
      termin_beratungsgespraech: fields['Termin_Beratungsgespräch'] || null,
      terminart: fields['Terminart'] || null,
      meeting_link: fields['Meeting_Link'] || null,
      status: normalizeHotLeadStatus(fields['Status']),
      setup: parseFloat(fields['Setup']) || null,
      retainer: parseFloat(fields['Retainer']) || null,
      laufzeit: parseInt(fields['Laufzeit']) || null,
      prioritaet: fields['Priorität'] || null,
      quelle: fields['Quelle'] || null,
      monatliche_besuche: fields['Monatliche_Besuche'] || null,
      mehrwert: fields['Mehrwert'] || null,
      absprungrate: fields['Absprungrate'] || null,
      anzahl_leads: fields['Anzahl_Leads'] || null,
      produkt_dienstleistung: fields['Produkt_Dienstleistung'] || null,
      kunde_seit: fields['Kunde_seit'] || fields['Kunde seit'] || null,
      kommentar: fields['Kommentar'] || null,
      airtable_id: record.id
    })
    airtableIds.push(record.id)
  }

  console.log(`   📊 Lookups: Lead ${lookupStats.leadFound}/${lookupStats.leadFound + lookupStats.leadMissing}, Setter ${lookupStats.setterFound}/${lookupStats.setterFound + lookupStats.setterMissing}, Closer ${lookupStats.closerFound}/${lookupStats.closerFound + lookupStats.closerMissing}`)

  const results = await insertRecordsWithTracking('hot_leads', supabaseRecords, airtableIds)

  for (const result of results) {
    idMappings.hotLeads.set(result.airtableId, result.supabaseId)
  }

  stats.hotLeads.inserted = results.length
  stats.hotLeads.failed = airtableRecords.length - results.length

  console.log(`   📋 ID Mappings: ${idMappings.hotLeads.size} Hot Leads`)
}

async function migrateArchive() {
  console.log('\n📦 MIGRIERE LEAD ARCHIV...')

  const airtableRecords = await fetchAllFromAirtable(AIRTABLE_TABLES.archive)
  stats.archive.total = airtableRecords.length

  const supabaseRecords = []
  const airtableIds = []

  // Lookup-Statistiken
  let lookupStats = { leadFound: 0, leadMissing: 0, userFound: 0, userMissing: 0 }

  for (const record of airtableRecords) {
    const fields = record.fields

    // Verknüpfungen auflösen - Feldnamen aus v1: 'Lead' und 'Vertriebler'
    const leadIds = fields['Lead'] || fields['Immobilienmakler_Leads'] || []
    const userIds = fields['Vertriebler'] || fields['User_Datenbank'] || []

    // Lookup mit Logging
    let supabaseLeadId = null
    let supabaseUserId = null

    if (leadIds[0]) {
      supabaseLeadId = idMappings.leads.get(leadIds[0])
      if (supabaseLeadId) {
        lookupStats.leadFound++
      } else {
        lookupStats.leadMissing++
        console.warn(`   ⚠️ Archive: Lead nicht gefunden: ${leadIds[0]}`)
      }
    }

    if (userIds[0]) {
      supabaseUserId = idMappings.users.get(userIds[0])
      if (supabaseUserId) {
        lookupStats.userFound++
      } else {
        lookupStats.userMissing++
        console.warn(`   ⚠️ Archive: User nicht gefunden: ${userIds[0]}`)
      }
    }

    supabaseRecords.push({
      lead_id: supabaseLeadId,
      user_id: supabaseUserId,
      bereits_kontaktiert: isTruthy(fields['Bereits_kontaktiert']),
      ergebnis: normalizeErgebnis(fields['Ergebnis']),
      datum: fields['Datum'] || null,
      airtable_id: record.id
    })
    airtableIds.push(record.id)
  }

  console.log(`   📊 Lookups: Lead ${lookupStats.leadFound}/${lookupStats.leadFound + lookupStats.leadMissing}, User ${lookupStats.userFound}/${lookupStats.userFound + lookupStats.userMissing}`)

  const results = await insertRecordsWithTracking('lead_archive', supabaseRecords, airtableIds)

  stats.archive.inserted = results.length
  stats.archive.failed = airtableRecords.length - results.length

  console.log(`   ✓ ${results.length} Archiv-Einträge migriert`)
}

// =====================================================
// HELPER FUNKTIONEN
// =====================================================

function parseRollen(rollenString) {
  if (!rollenString) return []
  if (Array.isArray(rollenString)) return rollenString
  return rollenString.split(',').map(r => r.trim()).filter(Boolean)
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

function normalizeKategorie(kategorie) {
  if (!kategorie) return 'Immobilienmakler'
  return kategorie
}

// Helper: Prüft alle truthy Werte für bereits_kontaktiert
function isTruthy(val) {
  if (!val) return false
  if (val === true) return true
  if (typeof val === 'string') {
    const v = val.toLowerCase().trim()
    return v === 'x' || v === 'true' || v === '1' || v === 'ja' || v === 'yes'
  }
  if (typeof val === 'number') return val !== 0
  return !!val
}

function normalizeErgebnis(ergebnis) {
  if (!ergebnis) return null
  const mapping = {
    'Beratungsgespräch': 'Beratungsgespräch',
    'Beratungsgespraech': 'Beratungsgespräch',
    'Nicht erreicht': 'Nicht erreicht',
    'Kein Interesse': 'Kein Interesse',
    'Unterlage bereitstellen': 'Unterlage bereitstellen',
    'Ungültiger Lead': 'Ungültiger Lead'
  }
  // WICHTIG: Unbekannte Werte behalten statt null zurückzugeben!
  return mapping[ergebnis] || ergebnis
}

function normalizeHotLeadStatus(status) {
  if (!status) return 'Lead'
  const mapping = {
    'Lead': 'Lead',
    'Angebot': 'Angebot',
    'Angebot versendet': 'Angebot versendet',
    'Abgeschlossen': 'Abgeschlossen',
    'Verloren': 'Verloren',
    'Termin abgesagt': 'Termin abgesagt',
    'Termin verschoben': 'Termin verschoben'
  }
  return mapping[status] || 'Lead'
}

// =====================================================
// MAIN
// =====================================================

async function clearExistingData() {
  console.log('\n🗑️ LÖSCHE BESTEHENDE DATEN...')

  // In umgekehrter Reihenfolge der Abhängigkeiten löschen
  const tables = ['lead_archive', 'lead_assignments', 'hot_leads', 'leads', 'users']

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      console.error(`   ❌ Fehler beim Löschen von ${table}:`, error.message)
    } else {
      console.log(`   ✓ ${table} geleert`)
    }
  }
}

async function verifyMigration() {
  console.log('\n🔍 VERIFIZIERE MIGRATION...')

  // Zähle Records in Supabase
  const counts = {}

  const tables = ['users', 'leads', 'lead_assignments', 'hot_leads', 'lead_archive']
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error(`   ❌ Fehler bei ${table}:`, error.message)
      counts[table] = 'ERROR'
    } else {
      counts[table] = count
    }
  }

  console.log('')
  console.log('📊 SUPABASE COUNTS:')
  console.log(`   users:            ${counts.users}`)
  console.log(`   leads:            ${counts.leads}`)
  console.log(`   lead_assignments: ${counts.lead_assignments}`)
  console.log(`   hot_leads:        ${counts.hot_leads}`)
  console.log(`   lead_archive:     ${counts.lead_archive}`)
  console.log('')

  // Prüfe Hot Leads Verknüpfungen
  const { data: hotLeadsWithRefs } = await supabase
    .from('hot_leads')
    .select('id, setter_id, closer_id, lead_id')

  let withSetter = 0, withCloser = 0, withLead = 0
  if (hotLeadsWithRefs) {
    for (const hl of hotLeadsWithRefs) {
      if (hl.setter_id) withSetter++
      if (hl.closer_id) withCloser++
      if (hl.lead_id) withLead++
    }
  }

  console.log('🔗 HOT LEADS VERKNÜPFUNGEN:')
  console.log(`   Mit Setter:  ${withSetter}/${counts.hot_leads}`)
  console.log(`   Mit Closer:  ${withCloser}/${counts.hot_leads}`)
  console.log(`   Mit Lead:    ${withLead}/${counts.hot_leads}`)

  return counts
}

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  SUNSIDE CRM - MIGRATION v2')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  console.log('⚠️  ACHTUNG: Diese Migration löscht ALLE bestehenden Daten!')
  console.log('')

  try {
    // 1. Bestehende Daten löschen
    await clearExistingData()

    // 2. In der richtigen Reihenfolge migrieren
    await migrateUsers()
    await migrateLeads()        // Erstellt auch Lead Assignments
    await migrateHotLeads()
    await migrateArchive()

    // 3. Verifizieren
    await verifyMigration()

    // Zusammenfassung
    console.log('\n═══════════════════════════════════════════════════════')
    console.log('  MIGRATION ABGESCHLOSSEN')
    console.log('═══════════════════════════════════════════════════════')
    console.log('')
    console.log('📊 MIGRATION STATISTIK:')
    console.log(`   Users:       ${stats.users.inserted}/${stats.users.total} (${stats.users.failed} Fehler)`)
    console.log(`   Leads:       ${stats.leads.inserted}/${stats.leads.total} (${stats.leads.failed} Fehler)`)
    console.log(`   Assignments: ${stats.assignments.inserted}/${stats.assignments.total} (${stats.assignments.failed} Fehler)`)
    console.log(`   Hot Leads:   ${stats.hotLeads.inserted}/${stats.hotLeads.total} (${stats.hotLeads.failed} Fehler)`)
    console.log(`   Archiv:      ${stats.archive.inserted}/${stats.archive.total} (${stats.archive.failed} Fehler)`)
    console.log('')

    // Warnungen
    const totalFailed = stats.users.failed + stats.leads.failed + stats.assignments.failed +
                        stats.hotLeads.failed + stats.archive.failed

    if (totalFailed > 0) {
      console.log(`⚠️  ACHTUNG: ${totalFailed} Records konnten nicht migriert werden!`)
    } else {
      console.log('✅ Alle Records erfolgreich migriert!')
    }

  } catch (error) {
    console.error('\n❌ MIGRATION FEHLGESCHLAGEN:', error.message)
    process.exit(1)
  }
}

main()
