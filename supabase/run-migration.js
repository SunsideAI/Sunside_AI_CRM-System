/**
 * SUNSIDE CRM - Angepasste CSV Migration
 *
 * Migriert die exportierten Airtable-CSVs aus Data_Backup/ nach Supabase.
 * Angepasst an die tatsaechliche Datenstruktur.
 *
 * AUSFUEHRUNG:
 *   node supabase/run-migration.js
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { parse } from 'csv-parse/sync'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')

// =====================================================
// KONFIGURATION
// =====================================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const CSV_DIR = join(ROOT_DIR, 'Data_Backup')

// CSV-Dateinamen
const CSV_FILES = {
  users: 'User_Datenbank-Grid view.csv',
  leads: 'Immobilienmakler_Leads-Grid view.csv',
  hotLeads: 'Immobilienmakler_Hot_Leads-Grid view.csv',
  archive: 'Immobilienmakler_Leads_Archiv-Grid view.csv',
  templates: 'E-Mail_Templates-Grid view.csv',
  requests: 'Lead_Anfragen-Grid view.csv',
  messages: 'System_Messages-Grid view.csv'
}

// ID Mappings: Airtable ID/Name -> Supabase UUID
const userNameToId = new Map()  // Vor_Nachname -> UUID
const userIdToUuid = new Map()  // Airtable ID (1,2,3) -> UUID

// Statistiken
const stats = {
  users: { total: 0, inserted: 0, failed: 0 },
  leads: { total: 0, inserted: 0, failed: 0 },
  hot_leads: { total: 0, inserted: 0, failed: 0 },
  lead_archive: { total: 0, inserted: 0, failed: 0 },
  email_templates: { total: 0, inserted: 0, failed: 0 },
  lead_requests: { total: 0, inserted: 0, failed: 0 },
  system_messages: { total: 0, inserted: 0, failed: 0 }
}

// =====================================================
// HELPER FUNKTIONEN
// =====================================================

function readCSV(filename) {
  const filepath = join(CSV_DIR, filename)
  if (!existsSync(filepath)) {
    console.log(`   ⚠️ CSV nicht gefunden: ${filename}`)
    return []
  }

  const content = readFileSync(filepath, 'utf-8')
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_quotes: true,
    relax_column_count: true
  })

  console.log(`   ✓ ${records.length} Records aus ${filename}`)
  return records
}

function parseBoolean(val) {
  if (!val) return false
  if (val === true || val === 'true' || val === '1') return true
  if (typeof val === 'string') {
    const v = val.toLowerCase().trim()
    return v === 'x' || v === 'true' || v === '1' || v === 'ja' || v === 'yes' || v === 'checked'
  }
  return false
}

function parseRollen(val) {
  if (!val) return []
  // Format: "Coldcaller,Closer" oder "Admin"
  return val.split(',').map(r => r.trim()).filter(Boolean)
}

function parseDate(val) {
  if (!val) return null
  // Deutsches Format: "17.6.2025 09:00" oder ISO
  if (val.includes('.')) {
    const parts = val.split(' ')
    const dateParts = parts[0].split('.')
    if (dateParts.length === 3) {
      const day = dateParts[0].padStart(2, '0')
      const month = dateParts[1].padStart(2, '0')
      const year = dateParts[2].length === 2 ? '20' + dateParts[2] : dateParts[2]
      const time = parts[1] || '00:00'
      return `${year}-${month}-${day}T${time}:00`
    }
  }
  const date = new Date(val)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

function parseDateOnly(val) {
  if (!val) return null
  const date = parseDate(val)
  return date ? date.split('T')[0] : null
}

function parseNumber(val) {
  if (!val) return null
  // Format: "€1000,00" oder "1000.00"
  const cleaned = val.replace(/[€\s]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function parseArray(val) {
  if (!val) return []
  return val.split(',').map(v => v.trim()).filter(Boolean)
}

function normalizeStatus(val) {
  if (!val) return 'Lead'
  const mapping = {
    'Lead': 'Lead',
    'Geplant': 'Geplant',
    'Im Closing': 'Im Closing',
    'Angebot': 'Angebot',
    'Angebot versendet': 'Angebot versendet',
    'Abgeschlossen': 'Abgeschlossen',
    'Termin abgesagt': 'Termin abgesagt',
    'Termin verschoben': 'Termin verschoben',
    'Verloren': 'Verloren'
  }
  return mapping[val] || 'Lead'
}

function lookupUserId(name) {
  if (!name) return null
  // Exakter Match
  if (userNameToId.has(name)) {
    return userNameToId.get(name)
  }
  // Fuzzy Match (falls Name leicht anders)
  for (const [key, value] of userNameToId.entries()) {
    if (key.toLowerCase() === name.toLowerCase()) {
      return value
    }
  }
  return null
}

async function insertBatch(table, records, batchSize = 50) {
  let inserted = 0
  let failed = 0

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)

    const { data, error } = await supabase
      .from(table)
      .insert(batch)
      .select()

    if (error) {
      console.error(`   ❌ Batch ${Math.floor(i/batchSize)+1} Fehler:`, error.message)
      failed += batch.length
    } else {
      inserted += data?.length || 0
    }

    // Progress
    if ((i + batchSize) % 200 === 0 || i + batchSize >= records.length) {
      console.log(`   📊 ${Math.min(i + batchSize, records.length)}/${records.length}...`)
    }
  }

  return { inserted, failed }
}

// =====================================================
// MIGRATION FUNKTIONEN
// =====================================================

async function migrateUsers() {
  console.log('\n👤 MIGRIERE USERS...')

  const rows = readCSV(CSV_FILES.users)
  if (rows.length === 0) return

  stats.users.total = rows.length

  const records = []
  const seenEmails = new Set()

  for (const row of rows) {
    const email = row['E-Mail'] || row['E-Mail_Geschäftlich'] || `temp_${row['ID']}@migration.local`

    if (seenEmails.has(email.toLowerCase())) {
      console.log(`   ⚠️ Duplikat: ${email}`)
      continue
    }
    seenEmails.add(email.toLowerCase())

    records.push({
      airtable_id: row['ID'] || null,
      vorname: row['Vorname'] || null,
      nachname: row['Name'] || null,
      email: email,
      email_geschaeftlich: row['E-Mail_Geschäftlich'] || null,
      telefon: row['Telefon'] || null,
      strasse: row['Straße'] || null,
      plz: row['PLZ'] || null,
      ort: row['Ort'] || null,
      bundesland: row['Bundesland'] || null,
      password_hash: row['Passwort'] || null,
      rollen: parseRollen(row['Rolle']),
      status: true, // Alle importierten User sind aktiv
      onboarding: parseBoolean(row['Onboarding']),
      google_calendar_id: row['Google_Calendar_ID'] || null
    })
  }

  // Insert und Mapping erstellen
  const { data, error } = await supabase
    .from('users')
    .insert(records)
    .select()

  if (error) {
    console.error('   ❌ Users Insert Fehler:', error.message)
    stats.users.failed = records.length
    return
  }

  stats.users.inserted = data?.length || 0
  stats.users.failed = records.length - stats.users.inserted

  // Mapping erstellen: Vor_Nachname -> UUID und ID -> UUID
  for (let i = 0; i < rows.length && i < (data?.length || 0); i++) {
    const vorNachname = rows[i]['Vor_Nachname']
    const airtableId = rows[i]['ID']
    const supabaseId = data[i]?.id

    if (supabaseId) {
      if (vorNachname) userNameToId.set(vorNachname, supabaseId)
      if (airtableId) userIdToUuid.set(airtableId, supabaseId)
    }
  }

  console.log(`   ✓ ${stats.users.inserted}/${stats.users.total} Users importiert`)
  console.log(`   📋 ${userNameToId.size} User-Mappings erstellt`)
}

async function migrateHotLeads() {
  console.log('\n🔥 MIGRIERE HOT LEADS...')

  const rows = readCSV(CSV_FILES.hotLeads)
  if (rows.length === 0) return

  stats.hot_leads.total = rows.length

  const records = []
  let setterFound = 0, setterMissing = 0
  let closerFound = 0, closerMissing = 0

  for (const row of rows) {
    // Setter/Closer ueber Namen auflösen
    const setterId = lookupUserId(row['Setter'])
    const closerId = lookupUserId(row['Closer'])

    if (row['Setter']) {
      if (setterId) setterFound++
      else setterMissing++
    }
    if (row['Closer']) {
      if (closerId) closerFound++
      else closerMissing++
    }

    records.push({
      unternehmen: row['Unternehmen'] || null,
      ansprechpartner_vorname: row['Ansprechpartner_Vorname'] || null,
      ansprechpartner_nachname: row['Ansprechpartner_Nachname'] || null,
      kategorie: row['Kategorie'] === 'Immobilienmakler' ? 'Immobilienmakler' :
                 row['Kategorie'] === 'Sachverständiger' ? 'Sachverstaendiger' : null,
      mail: row['Mail'] || null,
      telefonnummer: row['Telefonnummer'] || null,
      ort: row['Ort'] || null,
      bundesland: row['Bundesland'] || null,
      website: row['Website'] || null,
      setter_id: setterId,
      closer_id: closerId,
      produkt_dienstleistung: row['Produkt_Dienstleistung'] ? [row['Produkt_Dienstleistung']] : [],
      paketname_individuell: row['Paketname_Individuell'] || null,
      vertragsbestandteile: row['Vertragsbestandteile'] || null,
      leistungsbeschreibung: row['Leistungsbeschreibung'] || null,
      kurzbeschreibung: row['Kurzbeschreibung'] || null,
      setup: parseNumber(row['Setup']),
      retainer: parseNumber(row['Retainer']),
      laufzeit: parseNumber(row['Laufzeit']),
      monatliche_besuche: row['Monatliche_Besuche'] || null,
      mehrwert: row['Mehrwert'] || null,
      status: normalizeStatus(row['Status']),
      quelle: row['Quelle'] || null,
      prioritaet: row['Priorität'] || null,
      kunde_seit: parseDateOnly(row['Kunde seit']),
      termin_beratungsgespraech: parseDate(row['Termin_Beratungsgespräch']),
      terminart: row['Terminart'] || null,
      meeting_link: row['Meeting_Link'] || null,
      kommentar: row['Kommentar'] || null
    })
  }

  console.log(`   📊 Setter: ${setterFound} gefunden, ${setterMissing} fehlend`)
  console.log(`   📊 Closer: ${closerFound} gefunden, ${closerMissing} fehlend`)

  const result = await insertBatch('hot_leads', records)
  stats.hot_leads.inserted = result.inserted
  stats.hot_leads.failed = result.failed

  console.log(`   ✓ ${stats.hot_leads.inserted}/${stats.hot_leads.total} Hot Leads importiert`)
}

async function migrateEmailTemplates() {
  console.log('\n📧 MIGRIERE E-MAIL TEMPLATES...')

  const rows = readCSV(CSV_FILES.templates)
  if (rows.length === 0) return

  stats.email_templates.total = rows.length

  const records = rows.map(row => ({
    name: row['Name'] || 'Unbenannt',
    betreff: row['Betreff'] || null,
    inhalt: row['Inhalt'] || null,
    kategorie: row['Kategorie'] || 'Allgemein',
    aktiv: true
  }))

  const result = await insertBatch('email_templates', records)
  stats.email_templates.inserted = result.inserted
  stats.email_templates.failed = result.failed

  console.log(`   ✓ ${stats.email_templates.inserted}/${stats.email_templates.total} Templates importiert`)
}

async function migrateLeadRequests() {
  console.log('\n📝 MIGRIERE LEAD ANFRAGEN...')

  const rows = readCSV(CSV_FILES.requests)
  if (rows.length === 0) return

  stats.lead_requests.total = rows.length

  const records = []
  for (const row of rows) {
    const userId = lookupUserId(row['User'] || row['Antragsteller'])
    if (!userId) continue

    records.push({
      anfrage_id: row['Anfrage_ID'] || `ANF-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      user_id: userId,
      anzahl: parseNumber(row['Anzahl']) || 0,
      nachricht: row['Nachricht'] || null,
      status: row['Status'] || 'Offen',
      genehmigte_anzahl: parseNumber(row['Genehmigte_Anzahl']),
      admin_kommentar: row['Admin_Kommentar'] || null,
      bearbeitet_von: lookupUserId(row['Bearbeitet_von']),
      bearbeitet_am: parseDate(row['Bearbeitet_am']),
      erstellt_am: parseDate(row['Erstellt_am']) || new Date().toISOString()
    })
  }

  const result = await insertBatch('lead_requests', records)
  stats.lead_requests.inserted = result.inserted
  stats.lead_requests.failed = result.failed

  console.log(`   ✓ ${stats.lead_requests.inserted}/${stats.lead_requests.total} Anfragen importiert`)
}

async function migrateSystemMessages() {
  console.log('\n💬 MIGRIERE SYSTEM MESSAGES...')

  const rows = readCSV(CSV_FILES.messages)
  if (rows.length === 0) return

  stats.system_messages.total = rows.length

  const records = []
  for (const row of rows) {
    const empfaengerId = lookupUserId(row['Empfänger'] || row['Empfaenger'])
    if (!empfaengerId) continue

    records.push({
      message_id: row['Message_ID'] || `MSG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      empfaenger_id: empfaengerId,
      typ: row['Typ'] || 'Pool Update',
      titel: row['Titel'] || null,
      nachricht: row['Nachricht'] || null,
      gelesen: parseBoolean(row['Gelesen']),
      erstellt_am: parseDate(row['Erstellt_am']) || new Date().toISOString()
    })
  }

  const result = await insertBatch('system_messages', records)
  stats.system_messages.inserted = result.inserted
  stats.system_messages.failed = result.failed

  console.log(`   ✓ ${stats.system_messages.inserted}/${stats.system_messages.total} Messages importiert`)
}

// =====================================================
// CLEAR & VERIFY
// =====================================================

async function clearAllData() {
  console.log('\n🗑️ LOESCHE BESTEHENDE DATEN...')

  const tables = [
    'system_messages',
    'lead_requests',
    'lead_archive',
    'hot_leads',
    'lead_assignments',
    'email_templates',
    'leads',
    'users'
  ]

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (error) {
      console.error(`   ❌ ${table}: ${error.message}`)
    } else {
      console.log(`   ✓ ${table} geleert`)
    }
  }
}

async function verifyMigration() {
  console.log('\n🔍 VERIFIZIERE MIGRATION...')

  const tables = ['users', 'hot_leads', 'email_templates', 'lead_requests', 'system_messages']

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.log(`   ❌ ${table}: ${error.message}`)
    } else {
      console.log(`   📊 ${table}: ${count} Records`)
    }
  }

  // Hot Leads mit Setter/Closer pruefen
  const { data: hotLeadsStats } = await supabase
    .from('hot_leads')
    .select('setter_id, closer_id')

  if (hotLeadsStats) {
    const withSetter = hotLeadsStats.filter(h => h.setter_id).length
    const withCloser = hotLeadsStats.filter(h => h.closer_id).length
    console.log(`   🔗 Hot Leads mit Setter: ${withSetter}/${hotLeadsStats.length}`)
    console.log(`   🔗 Hot Leads mit Closer: ${withCloser}/${hotLeadsStats.length}`)
  }
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  SUNSIDE CRM - AIRTABLE CSV MIGRATION')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')

  // Pruefen ob Supabase konfiguriert ist
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_URL und SUPABASE_SERVICE_KEY muessen in .env gesetzt sein!')
    process.exit(1)
  }

  // Pruefen ob CSV-Ordner existiert
  if (!existsSync(CSV_DIR)) {
    console.error(`❌ CSV-Ordner nicht gefunden: ${CSV_DIR}`)
    process.exit(1)
  }

  const args = process.argv.slice(2)
  const clearFirst = args.includes('--clear')

  try {
    // Optional: Bestehende Daten loeschen
    if (clearFirst) {
      await clearAllData()
    }

    // Migration in der richtigen Reihenfolge
    await migrateUsers()         // 1. Users zuerst (fuer Mappings)
    await migrateHotLeads()      // 2. Hot Leads
    await migrateEmailTemplates() // 3. E-Mail Templates
    await migrateLeadRequests()  // 4. Lead Anfragen
    await migrateSystemMessages() // 5. System Messages

    // Verifizieren
    await verifyMigration()

    // Zusammenfassung
    console.log('\n═══════════════════════════════════════════════════════')
    console.log('  MIGRATION ABGESCHLOSSEN')
    console.log('═══════════════════════════════════════════════════════')
    console.log('')
    console.log('📊 STATISTIK:')
    console.log(`   Users:           ${stats.users.inserted}/${stats.users.total}`)
    console.log(`   Hot Leads:       ${stats.hot_leads.inserted}/${stats.hot_leads.total}`)
    console.log(`   E-Mail Templates: ${stats.email_templates.inserted}/${stats.email_templates.total}`)
    console.log(`   Lead Anfragen:   ${stats.lead_requests.inserted}/${stats.lead_requests.total}`)
    console.log(`   System Messages: ${stats.system_messages.inserted}/${stats.system_messages.total}`)
    console.log('')

    const totalFailed = Object.values(stats).reduce((sum, s) => sum + s.failed, 0)
    if (totalFailed > 0) {
      console.log(`⚠️ ${totalFailed} Records fehlgeschlagen`)
    } else {
      console.log('✅ Migration erfolgreich!')
    }

    console.log('')
    console.log('📋 NAECHSTE SCHRITTE:')
    console.log('   1. Netlify Functions auf Supabase umstellen')
    console.log('   2. Frontend testen')
    console.log('   3. Airtable API Keys aus .env entfernen')

  } catch (error) {
    console.error('\n❌ MIGRATION FEHLGESCHLAGEN:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
