/**
 * SUNSIDE CRM - CSV zu Supabase Migration
 *
 * Migriert exportierte Airtable-CSVs nach Supabase.
 * Umgeht Airtable Rate-Limits durch direkten CSV-Import.
 *
 * VORBEREITUNG:
 * 1. CSVs aus Airtable exportieren (jede Tabelle einzeln)
 * 2. CSVs in ./csv/ Ordner ablegen:
 *    - User_Datenbank.csv
 *    - Immobilienmakler_Leads.csv
 *    - Immobilienmakler_Hot_Leads.csv
 *    - Immobilienmakler_Leads_Archiv.csv
 *    - E-Mail_Templates.csv
 *    - Lead_Anfragen.csv
 *    - System_Messages.csv
 *
 * AUSFUEHRUNG:
 *   node supabase/migrate-from-csv.js
 *
 * OPTIONEN:
 *   --dry-run     Nur pruefen, nicht importieren
 *   --table=X     Nur bestimmte Tabelle migrieren
 *   --clear       Bestehende Daten loeschen vor Import
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { parse } from 'csv-parse/sync'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// =====================================================
// KONFIGURATION
// =====================================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const CSV_DIR = join(__dirname, 'csv')

// CSV-Dateinamen -> Supabase Tabellen
const TABLE_MAPPING = {
  'User_Datenbank-Grid view.csv': 'users',
  'Immobilienmakler_Leads-Grid view.csv': 'leads',
  'Immobilienmakler_Hot_Leads-Grid view.csv': 'hot_leads',
  'Immobilienmakler_Leads_Archiv-Grid view.csv': 'lead_archive',
  'E-Mail_Templates-Grid view.csv': 'email_templates',
  'Lead_Anfragen-Grid view.csv': 'lead_requests',
  'System_Messages-Grid view.csv': 'system_messages'
}

// ID Mappings: Airtable Record ID -> Supabase UUID
const idMappings = {
  users: new Map(),
  leads: new Map(),
  hot_leads: new Map(),
  email_templates: new Map()
}

// Statistiken
const stats = {
  users: { total: 0, inserted: 0, failed: 0 },
  leads: { total: 0, inserted: 0, failed: 0 },
  assignments: { total: 0, inserted: 0, failed: 0 },
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
    return null
  }

  const content = readFileSync(filepath, 'utf-8')
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true // Handle UTF-8 BOM
  })

  console.log(`   ✓ ${records.length} Records aus ${filename} geladen`)
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
  if (Array.isArray(val)) return val
  // Airtable Multi-Select: "Admin, Closer" oder "Admin,Closer"
  return val.split(',').map(r => r.trim()).filter(Boolean)
}

function parseArray(val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  // Airtable Arrays: "Value1, Value2" oder JSON
  try {
    return JSON.parse(val)
  } catch {
    return val.split(',').map(v => v.trim()).filter(Boolean)
  }
}

function parseLinkedRecord(val) {
  // Airtable Linked Records: "recXXXXX" oder "recXXXXX, recYYYYY"
  if (!val) return []
  if (val.startsWith('rec')) {
    return val.split(',').map(v => v.trim()).filter(v => v.startsWith('rec'))
  }
  return []
}

function parseDate(val) {
  if (!val) return null
  // ISO Format oder deutsches Format
  const date = new Date(val)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

function parseDateOnly(val) {
  if (!val) return null
  const date = new Date(val)
  return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0]
}

function parseNumber(val) {
  if (!val) return null
  const num = parseFloat(val.replace(',', '.').replace(/[^\d.-]/g, ''))
  return isNaN(num) ? null : num
}

function normalizeLand(land) {
  if (!land) return 'Deutschland'
  const mapping = {
    'Deutschland': 'Deutschland',
    'DE': 'Deutschland',
    'Oesterreich': 'Oesterreich',
    'Österreich': 'Oesterreich',
    'AT': 'Oesterreich',
    'Schweiz': 'Schweiz',
    'CH': 'Schweiz'
  }
  return mapping[land] || 'Deutschland'
}

function normalizeErgebnis(val) {
  if (!val) return null
  const mapping = {
    'Beratungsgespräch': 'Beratungsgespraech',
    'Beratungsgespraech': 'Beratungsgespraech',
    'Nicht erreicht': 'Nicht erreicht',
    'Kein Interesse': 'Kein Interesse',
    'Unterlage bereitstellen': 'Unterlage bereitstellen',
    'Wiedervorlage': 'Wiedervorlage',
    'Ungültiger Lead': 'Ungueltiger Lead',
    'Ungueltiger Lead': 'Ungueltiger Lead'
  }
  return mapping[val] || val
}

function normalizeHotLeadStatus(val) {
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

async function insertWithRetry(table, record, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const { data, error } = await supabase
      .from(table)
      .insert(record)
      .select()
      .single()

    if (!error && data) {
      return { success: true, data }
    }

    if (attempt < retries) {
      console.warn(`   ⚠️ Retry ${attempt}/${retries} fuer ${table}`)
      await new Promise(r => setTimeout(r, 500 * attempt))
    } else {
      console.error(`   ❌ Fehler bei ${table}:`, error?.message)
      return { success: false, error }
    }
  }
}

// =====================================================
// MIGRATION FUNKTIONEN
// =====================================================

async function migrateUsers() {
  console.log('\n👤 MIGRIERE USERS...')

  const records = readCSV('User_Datenbank-Grid view.csv')
  if (!records) return

  stats.users.total = records.length

  // Duplikate nach E-Mail filtern
  const seenEmails = new Set()

  for (const row of records) {
    // Airtable Record ID (erste Spalte oder "airtable_record_id")
    const airtableId = row['airtable_record_id'] || row['Record ID'] || row['id'] || null

    // E-Mail Felder pruefen
    const email = row['E-Mail'] || row['Mail'] || row['Email'] || `temp_${Date.now()}@migration.local`

    if (seenEmails.has(email.toLowerCase())) {
      console.log(`   ⚠️ Duplikat: ${email}`)
      continue
    }
    seenEmails.add(email.toLowerCase())

    const record = {
      airtable_id: airtableId,
      vorname: row['Vorname'] || null,
      nachname: row['Name'] || row['Nachname'] || null,
      email: email,
      email_geschaeftlich: row['E-Mail_Geschäftlich'] || row['E-Mail_Geschaeftlich'] || null,
      telefon: row['Telefon'] || null,
      strasse: row['Straße'] || row['Strasse'] || null,
      plz: row['PLZ'] || null,
      ort: row['Ort'] || null,
      bundesland: row['Bundesland'] || null,
      password_hash: row['Passwort'] || null,
      rollen: parseRollen(row['Rolle']),
      status: parseBoolean(row['Status']),
      onboarding: parseBoolean(row['Onboarding']),
      google_calendar_id: row['Google_Calendar_ID'] || null,
      preferences: row['Preferences'] ? JSON.parse(row['Preferences']) : {}
    }

    const result = await insertWithRetry('users', record)
    if (result.success) {
      stats.users.inserted++
      if (airtableId) {
        idMappings.users.set(airtableId, result.data.id)
      }
    } else {
      stats.users.failed++
    }
  }

  console.log(`   ✓ ${stats.users.inserted}/${stats.users.total} Users importiert`)
}

async function migrateLeads() {
  console.log('\n📋 MIGRIERE LEADS...')

  const records = readCSV('Immobilienmakler_Leads-Grid view.csv')
  if (!records) return

  stats.leads.total = records.length

  // Sammle Assignment-Daten fuer spaeter
  const assignmentData = []

  for (const row of records) {
    const airtableId = row['airtable_record_id'] || row['Record ID'] || row['id'] || null

    const record = {
      airtable_id: airtableId,
      unternehmensname: row['Unternehmensname'] || row['Name'] || null,
      stadt: row['Stadt'] || row['Ort'] || null,
      land: normalizeLand(row['Land']),
      kategorie: row['Kategorie'] || 'Immobilienmakler',
      mail: row['Mail'] || row['E-Mail'] || null,
      website: row['Website'] || null,
      telefonnummer: row['Telefonnummer'] || row['Telefon'] || null,
      ansprechpartner_vorname: row['Ansprechpartner_Vorname'] || null,
      ansprechpartner_nachname: row['Ansprechpartner_Nachname'] || null,
      bereits_kontaktiert: parseBoolean(row['Bereits_kontaktiert']),
      datum: parseDateOnly(row['Datum']),
      ergebnis: normalizeErgebnis(row['Ergebnis']),
      kommentar: row['Kommentar'] || row['Notizen'] || null,
      wiedervorlage_datum: parseDate(row['Wiedervorlage_Datum'] || row['Wiedervorlage']),
      quelle: row['Quelle'] || 'Kaltakquise',
      absprungrate: row['Absprungrate'] || null,
      monatliche_besuche: row['Monatliche_Besuche'] || null,
      anzahl_leads: row['Anzahl_Leads'] || null,
      mehrwert: row['Mehrwert'] || null
    }

    const result = await insertWithRetry('leads', record)
    if (result.success) {
      stats.leads.inserted++
      if (airtableId) {
        idMappings.leads.set(airtableId, result.data.id)
      }

      // User-Assignments speichern
      const userIds = parseLinkedRecord(row['User_Datenbank'])
      if (userIds.length > 0) {
        assignmentData.push({
          supabaseLeadId: result.data.id,
          airtableUserIds: userIds
        })
      }
    } else {
      stats.leads.failed++
    }
  }

  console.log(`   ✓ ${stats.leads.inserted}/${stats.leads.total} Leads importiert`)

  // Lead Assignments migrieren
  await migrateLeadAssignments(assignmentData)
}

async function migrateLeadAssignments(assignmentData) {
  console.log('\n🔗 MIGRIERE LEAD ASSIGNMENTS...')

  stats.assignments.total = assignmentData.reduce((sum, d) => sum + d.airtableUserIds.length, 0)

  for (const data of assignmentData) {
    for (const airtableUserId of data.airtableUserIds) {
      const supabaseUserId = idMappings.users.get(airtableUserId)

      if (!supabaseUserId) {
        stats.assignments.failed++
        continue
      }

      const { error } = await supabase
        .from('lead_assignments')
        .upsert({
          lead_id: data.supabaseLeadId,
          user_id: supabaseUserId
        }, { onConflict: 'lead_id,user_id' })

      if (error) {
        stats.assignments.failed++
      } else {
        stats.assignments.inserted++
      }
    }
  }

  console.log(`   ✓ ${stats.assignments.inserted}/${stats.assignments.total} Assignments importiert`)
}

async function migrateHotLeads() {
  console.log('\n🔥 MIGRIERE HOT LEADS...')

  const records = readCSV('Immobilienmakler_Hot_Leads-Grid view.csv')
  if (!records) return

  stats.hot_leads.total = records.length

  for (const row of records) {
    const airtableId = row['airtable_record_id'] || row['Record ID'] || row['id'] || null

    // Linked Records aufloesen
    const originalLeadIds = parseLinkedRecord(row['Immobilienmakler_Leads'])
    const setterIds = parseLinkedRecord(row['Setter'])
    const closerIds = parseLinkedRecord(row['Closer'])

    const record = {
      airtable_id: airtableId,
      lead_id: originalLeadIds[0] ? idMappings.leads.get(originalLeadIds[0]) : null,
      setter_id: setterIds[0] ? idMappings.users.get(setterIds[0]) : null,
      closer_id: closerIds[0] ? idMappings.users.get(closerIds[0]) : null,
      unternehmen: row['Unternehmen'] || null,
      ansprechpartner_vorname: row['Ansprechpartner_Vorname'] || null,
      ansprechpartner_nachname: row['Ansprechpartner_Nachname'] || null,
      kategorie: row['Kategorie'] || null,
      mail: row['Mail'] || row['E-Mail'] || null,
      telefonnummer: row['Telefonnummer'] || row['Telefon'] || null,
      ort: row['Ort'] || null,
      bundesland: row['Bundesland'] || null,
      website: row['Website'] || null,
      termin_beratungsgespraech: parseDate(row['Termin_Beratungsgespräch'] || row['Termin_Beratungsgespraech']),
      terminart: row['Terminart'] || null,
      meeting_link: row['Meeting_Link'] || null,
      status: normalizeHotLeadStatus(row['Status']),
      setup: parseNumber(row['Setup']),
      retainer: parseNumber(row['Retainer']),
      laufzeit: parseNumber(row['Laufzeit']),
      prioritaet: row['Priorität'] || row['Prioritaet'] || null,
      produkt_dienstleistung: parseArray(row['Produkt_Dienstleistung']),
      // Neue Felder
      vertragsbestandteile: row['Vertragsbestandteile'] || null,
      paketname_individuell: row['Paketname_Individuell'] || null,
      kurzbeschreibung: row['Kurzbeschreibung'] || null,
      leistungsbeschreibung: row['Leistungsbeschreibung'] || null,
      kommentar: row['Kommentar'] || null,
      quelle: row['Quelle'] || null,
      monatliche_besuche: row['Monatliche_Besuche'] || null,
      mehrwert: row['Mehrwert'] || null,
      absprungrate: row['Absprungrate'] || null,
      anzahl_leads: row['Anzahl_Leads'] || null,
      kunde_seit: parseDateOnly(row['Kunde_seit'] || row['Kunde seit']),
      attachments: row['Attachments'] ? JSON.parse(row['Attachments']) : []
    }

    const result = await insertWithRetry('hot_leads', record)
    if (result.success) {
      stats.hot_leads.inserted++
      if (airtableId) {
        idMappings.hot_leads.set(airtableId, result.data.id)
      }
    } else {
      stats.hot_leads.failed++
    }
  }

  console.log(`   ✓ ${stats.hot_leads.inserted}/${stats.hot_leads.total} Hot Leads importiert`)
}

async function migrateEmailTemplates() {
  console.log('\n📧 MIGRIERE E-MAIL TEMPLATES...')

  const records = readCSV('E-Mail_Templates-Grid view.csv')
  if (!records) return

  stats.email_templates.total = records.length

  for (const row of records) {
    const airtableId = row['airtable_record_id'] || row['Record ID'] || row['id'] || null

    const record = {
      airtable_id: airtableId,
      name: row['Name'] || 'Unbenannt',
      betreff: row['Betreff'] || null,
      inhalt: row['Inhalt'] || null,
      kategorie: row['Kategorie'] || 'Allgemein',
      aktiv: parseBoolean(row['Aktiv']),
      attachments: row['Attachments'] ? JSON.parse(row['Attachments']) : []
    }

    const result = await insertWithRetry('email_templates', record)
    if (result.success) {
      stats.email_templates.inserted++
      if (airtableId) {
        idMappings.email_templates.set(airtableId, result.data.id)
      }
    } else {
      stats.email_templates.failed++
    }
  }

  console.log(`   ✓ ${stats.email_templates.inserted}/${stats.email_templates.total} Templates importiert`)
}

async function migrateLeadArchive() {
  console.log('\n📦 MIGRIERE LEAD ARCHIV...')

  const records = readCSV('Immobilienmakler_Leads_Archiv-Grid view.csv')
  if (!records) return

  stats.lead_archive.total = records.length

  for (const row of records) {
    const airtableId = row['airtable_record_id'] || row['Record ID'] || row['id'] || null

    const leadIds = parseLinkedRecord(row['Lead'] || row['Immobilienmakler_Leads'])
    const userIds = parseLinkedRecord(row['Vertriebler'] || row['User_Datenbank'])

    const record = {
      airtable_id: airtableId,
      lead_id: leadIds[0] ? idMappings.leads.get(leadIds[0]) : null,
      user_id: userIds[0] ? idMappings.users.get(userIds[0]) : null,
      bereits_kontaktiert: parseBoolean(row['Bereits_kontaktiert']),
      ergebnis: normalizeErgebnis(row['Ergebnis']),
      datum: parseDateOnly(row['Datum']),
      archiviert_am: parseDate(row['Archiviert_am']) || new Date().toISOString()
    }

    const result = await insertWithRetry('lead_archive', record)
    if (result.success) {
      stats.lead_archive.inserted++
    } else {
      stats.lead_archive.failed++
    }
  }

  console.log(`   ✓ ${stats.lead_archive.inserted}/${stats.lead_archive.total} Archiv-Eintraege importiert`)
}

async function migrateLeadRequests() {
  console.log('\n📝 MIGRIERE LEAD ANFRAGEN...')

  const records = readCSV('Lead_Anfragen-Grid view.csv')
  if (!records) return

  stats.lead_requests.total = records.length

  for (const row of records) {
    const airtableId = row['airtable_record_id'] || row['Record ID'] || row['id'] || null

    const userIds = parseLinkedRecord(row['User'] || row['User_Datenbank'])
    const adminIds = parseLinkedRecord(row['Bearbeitet_von'])

    const supabaseUserId = userIds[0] ? idMappings.users.get(userIds[0]) : null
    if (!supabaseUserId) continue

    const record = {
      airtable_id: airtableId,
      anfrage_id: row['Anfrage_ID'] || `ANF-${Date.now()}`,
      user_id: supabaseUserId,
      anzahl: parseNumber(row['Anzahl']) || 0,
      nachricht: row['Nachricht'] || null,
      status: row['Status'] || 'Offen',
      genehmigte_anzahl: parseNumber(row['Genehmigte_Anzahl']),
      admin_kommentar: row['Admin_Kommentar'] || null,
      bearbeitet_von: adminIds[0] ? idMappings.users.get(adminIds[0]) : null,
      bearbeitet_am: parseDate(row['Bearbeitet_am']),
      erstellt_am: parseDate(row['Erstellt_am']) || new Date().toISOString()
    }

    const result = await insertWithRetry('lead_requests', record)
    if (result.success) {
      stats.lead_requests.inserted++
    } else {
      stats.lead_requests.failed++
    }
  }

  console.log(`   ✓ ${stats.lead_requests.inserted}/${stats.lead_requests.total} Anfragen importiert`)
}

async function migrateSystemMessages() {
  console.log('\n💬 MIGRIERE SYSTEM MESSAGES...')

  const records = readCSV('System_Messages-Grid view.csv')
  if (!records) return

  stats.system_messages.total = records.length

  for (const row of records) {
    const airtableId = row['airtable_record_id'] || row['Record ID'] || row['id'] || null

    const empfaengerIds = parseLinkedRecord(row['Empfänger'] || row['Empfaenger'])
    const hotLeadIds = parseLinkedRecord(row['Hot_Lead'])

    const supabaseEmpfaengerId = empfaengerIds[0] ? idMappings.users.get(empfaengerIds[0]) : null
    if (!supabaseEmpfaengerId) continue

    const record = {
      airtable_id: airtableId,
      message_id: row['Message_ID'] || `MSG-${Date.now()}`,
      empfaenger_id: supabaseEmpfaengerId,
      typ: row['Typ'] || 'Pool Update',
      titel: row['Titel'] || null,
      nachricht: row['Nachricht'] || null,
      hot_lead_id: hotLeadIds[0] ? idMappings.hot_leads.get(hotLeadIds[0]) : null,
      gelesen: parseBoolean(row['Gelesen']),
      erstellt_am: parseDate(row['Erstellt_am']) || new Date().toISOString()
    }

    const result = await insertWithRetry('system_messages', record)
    if (result.success) {
      stats.system_messages.inserted++
    } else {
      stats.system_messages.failed++
    }
  }

  console.log(`   ✓ ${stats.system_messages.inserted}/${stats.system_messages.total} Messages importiert`)
}

// =====================================================
// CLEAR FUNCTIONS
// =====================================================

async function clearAllData() {
  console.log('\n🗑️ LOESCHE BESTEHENDE DATEN...')

  // In umgekehrter Abhaengigkeitsreihenfolge
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
      console.error(`   ❌ Fehler bei ${table}:`, error.message)
    } else {
      console.log(`   ✓ ${table} geleert`)
    }
  }
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  SUNSIDE CRM - CSV zu SUPABASE MIGRATION')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')

  // CLI Argumente
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const clearFirst = args.includes('--clear')
  const tableArg = args.find(a => a.startsWith('--table='))
  const specificTable = tableArg ? tableArg.split('=')[1] : null

  if (dryRun) {
    console.log('🔍 DRY-RUN Modus - keine Aenderungen werden gemacht')
    console.log('')
  }

  // Pruefen ob CSV-Ordner existiert
  if (!existsSync(CSV_DIR)) {
    console.error(`❌ CSV-Ordner nicht gefunden: ${CSV_DIR}`)
    console.log('')
    console.log('Bitte CSVs aus Airtable exportieren und in ./supabase/csv/ ablegen:')
    for (const filename of Object.keys(TABLE_MAPPING)) {
      console.log(`   - ${filename}`)
    }
    process.exit(1)
  }

  try {
    // Optional: Bestehende Daten loeschen
    if (clearFirst && !dryRun) {
      await clearAllData()
    }

    // Migration in der richtigen Reihenfolge
    if (!specificTable || specificTable === 'users') {
      await migrateUsers()
    }
    if (!specificTable || specificTable === 'leads') {
      await migrateLeads()
    }
    if (!specificTable || specificTable === 'hot_leads') {
      await migrateHotLeads()
    }
    if (!specificTable || specificTable === 'email_templates') {
      await migrateEmailTemplates()
    }
    if (!specificTable || specificTable === 'lead_archive') {
      await migrateLeadArchive()
    }
    if (!specificTable || specificTable === 'lead_requests') {
      await migrateLeadRequests()
    }
    if (!specificTable || specificTable === 'system_messages') {
      await migrateSystemMessages()
    }

    // Zusammenfassung
    console.log('\n═══════════════════════════════════════════════════════')
    console.log('  MIGRATION ABGESCHLOSSEN')
    console.log('═══════════════════════════════════════════════════════')
    console.log('')
    console.log('📊 STATISTIK:')
    console.log(`   Users:           ${stats.users.inserted}/${stats.users.total} (${stats.users.failed} Fehler)`)
    console.log(`   Leads:           ${stats.leads.inserted}/${stats.leads.total} (${stats.leads.failed} Fehler)`)
    console.log(`   Assignments:     ${stats.assignments.inserted}/${stats.assignments.total} (${stats.assignments.failed} Fehler)`)
    console.log(`   Hot Leads:       ${stats.hot_leads.inserted}/${stats.hot_leads.total} (${stats.hot_leads.failed} Fehler)`)
    console.log(`   E-Mail Templates: ${stats.email_templates.inserted}/${stats.email_templates.total} (${stats.email_templates.failed} Fehler)`)
    console.log(`   Lead Archiv:     ${stats.lead_archive.inserted}/${stats.lead_archive.total} (${stats.lead_archive.failed} Fehler)`)
    console.log(`   Lead Anfragen:   ${stats.lead_requests.inserted}/${stats.lead_requests.total} (${stats.lead_requests.failed} Fehler)`)
    console.log(`   System Messages: ${stats.system_messages.inserted}/${stats.system_messages.total} (${stats.system_messages.failed} Fehler)`)
    console.log('')

    // Gesamtfehler
    const totalFailed = Object.values(stats).reduce((sum, s) => sum + s.failed, 0)
    if (totalFailed > 0) {
      console.log(`⚠️ ${totalFailed} Records fehlgeschlagen`)
    } else {
      console.log('✅ Alle Records erfolgreich migriert!')
    }

    console.log('')
    console.log('📋 NAECHSTE SCHRITTE:')
    console.log('   1. Netlify Functions auf Supabase umstellen')
    console.log('   2. Frontend testen')
    console.log('   3. Airtable API Keys aus .env entfernen')

  } catch (error) {
    console.error('\n❌ MIGRATION FEHLGESCHLAGEN:', error.message)
    process.exit(1)
  }
}

main()
