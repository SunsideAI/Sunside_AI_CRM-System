/**
 * SUNSIDE CRM - Airtable zu Supabase Daten-Migration
 *
 * Dieses Skript exportiert Daten aus Airtable und importiert sie in Supabase.
 *
 * Verwendung:
 * 1. npm install @supabase/supabase-js airtable dotenv
 * 2. .env Datei mit allen Keys erstellen
 * 3. node supabase/migrate-data.js
 *
 * WICHTIG: Führe zuerst schema.sql in Supabase aus!
 */

import 'dotenv/config'
import Airtable from 'airtable'
import { createClient } from '@supabase/supabase-js'

// =====================================================
// KONFIGURATION
// =====================================================

// Airtable
const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
const base = airtable.base(process.env.AIRTABLE_BASE_ID)

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Airtable Tabellen-Namen
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

// =====================================================
// HELPER FUNKTIONEN
// =====================================================

/**
 * Alle Records aus einer Airtable Tabelle laden
 */
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
 * Batch-Insert in Supabase mit Rate Limiting
 */
async function insertToSupabase(tableName, records, chunkSize = 50) {
  console.log(`📤 Importiere ${records.length} Records in ${tableName}...`)

  const results = []
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from(tableName)
      .insert(chunk)
      .select()

    if (error) {
      console.error(`   ❌ Fehler bei Chunk ${i / chunkSize + 1}:`, error.message)
      continue
    }

    results.push(...(data || []))

    // Kurze Pause zwischen Chunks
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`   ✓ ${results.length} Records importiert`)
  return results
}

/**
 * Konvertiert Rolle-String zu Array
 */
function parseRollen(rollenString) {
  if (!rollenString) return []
  if (Array.isArray(rollenString)) return rollenString

  // Airtable speichert manchmal als "Setter, Closer"
  return rollenString.split(',').map(r => r.trim()).filter(Boolean)
}

/**
 * Konvertiert Land-String zu Enum-Wert
 */
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

/**
 * Konvertiert Ergebnis-String zu Enum-Wert
 */
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
  return mapping[ergebnis] || null
}

/**
 * Konvertiert Hot Lead Status
 */
function normalizeHotLeadStatus(status) {
  if (!status) return 'Lead'
  const mapping = {
    'Lead': 'Lead',
    'Geplant': 'Geplant',
    'Im Closing': 'Im Closing',
    'Angebot versendet': 'Angebot versendet',
    'Abgeschlossen': 'Abgeschlossen',
    'Verloren': 'Verloren'
  }
  return mapping[status] || 'Lead'
}

// =====================================================
// MIGRATIONS-FUNKTIONEN
// =====================================================

/**
 * 1. Users migrieren (zuerst, weil andere Tabellen darauf verweisen)
 */
async function migrateUsers() {
  console.log('\n👤 MIGRIERE USERS...')

  const airtableRecords = await fetchAllFromAirtable(AIRTABLE_TABLES.users)

  const supabaseRecords = airtableRecords.map(record => {
    const fields = record.fields
    return {
      vorname: fields['Vorname'] || null,
      nachname: fields['Name'] || null,
      email: fields['E-Mail'] || `temp_${record.id}@migration.local`,
      email_geschaeftlich: fields['E-Mail_Geschäftlich'] || null,
      telefon: fields['Telefon'] || null,
      strasse: fields['Straße'] || null,
      plz: fields['PLZ'] || null,
      ort: fields['Ort'] || null,
      bundesland: fields['Bundesland'] || null,
      password_hash: fields['Passwort'] || null,
      rollen: parseRollen(fields['Rolle']),
      status: fields['Status'] !== false,
      onboarding: fields['Onboarding'] === true,
      google_calendar_id: fields['Google_Calendar_ID'] || null
    }
  })

  const inserted = await insertToSupabase('users', supabaseRecords)

  // ID Mapping speichern
  airtableRecords.forEach((airtableRecord, index) => {
    if (inserted[index]) {
      idMappings.users.set(airtableRecord.id, inserted[index].id)
    }
  })

  console.log(`   📋 ID Mappings: ${idMappings.users.size} Users`)
}

/**
 * 2. Leads migrieren
 */
async function migrateLeads() {
  console.log('\n📋 MIGRIERE LEADS...')

  const airtableRecords = await fetchAllFromAirtable(AIRTABLE_TABLES.leads)

  const supabaseRecords = airtableRecords.map(record => {
    const fields = record.fields
    return {
      unternehmensname: fields['Unternehmensname'] || null,
      stadt: fields['Stadt'] || null,
      land: normalizeLand(fields['Land']),
      kategorie: fields['Kategorie'] || 'Immobilienmakler',
      mail: fields['Mail'] || null,
      website: fields['Website'] || null,
      telefonnummer: fields['Telefonnummer'] || null,
      ansprechpartner_vorname: fields['Ansprechpartner_Vorname'] || null,
      ansprechpartner_nachname: fields['Ansprechpartner_Nachname'] || null,
      bereits_kontaktiert: fields['Bereits_kontaktiert'] === 'X',
      datum: fields['Datum'] || null,
      ergebnis: normalizeErgebnis(fields['Ergebnis']),
      kommentar: fields['Kommentar'] || null,
      wiedervorlage_datum: fields['Wiedervorlage_Datum'] || null,
      quelle: fields['Quelle'] || 'Kaltakquise',
      absprungrate: fields['Absprungrate'] || null,
      monatliche_besuche: fields['Monatliche_Besuche'] || null,
      anzahl_leads: fields['Anzahl_Leads'] || null,
      mehrwert: fields['Mehrwert'] || null
    }
  })

  const inserted = await insertToSupabase('leads', supabaseRecords)

  // ID Mapping speichern
  airtableRecords.forEach((airtableRecord, index) => {
    if (inserted[index]) {
      idMappings.leads.set(airtableRecord.id, inserted[index].id)
    }
  })

  console.log(`   📋 ID Mappings: ${idMappings.leads.size} Leads`)

  // Lead Assignments migrieren (User_Datenbank Verknüpfungen)
  console.log('\n🔗 MIGRIERE LEAD ASSIGNMENTS...')
  const assignments = []

  airtableRecords.forEach((record, index) => {
    const userIds = record.fields['User_Datenbank'] || []
    const supabaseLeadId = inserted[index]?.id

    if (supabaseLeadId && Array.isArray(userIds)) {
      userIds.forEach(airtableUserId => {
        const supabaseUserId = idMappings.users.get(airtableUserId)
        if (supabaseUserId) {
          assignments.push({
            lead_id: supabaseLeadId,
            user_id: supabaseUserId
          })
        }
      })
    }
  })

  if (assignments.length > 0) {
    await insertToSupabase('lead_assignments', assignments)
  }
}

/**
 * 3. Hot Leads migrieren
 */
async function migrateHotLeads() {
  console.log('\n🔥 MIGRIERE HOT LEADS...')

  const airtableRecords = await fetchAllFromAirtable(AIRTABLE_TABLES.hotLeads)

  const supabaseRecords = airtableRecords.map(record => {
    const fields = record.fields

    // Linked Records auflösen
    const originalLeadIds = fields['Immobilienmakler_Leads'] || []
    const setterIds = fields['Setter'] || []
    const closerIds = fields['Closer'] || []

    return {
      lead_id: originalLeadIds[0] ? idMappings.leads.get(originalLeadIds[0]) : null,
      setter_id: setterIds[0] ? idMappings.users.get(setterIds[0]) : null,
      closer_id: closerIds[0] ? idMappings.users.get(closerIds[0]) : null,
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
      kunde_seit: fields['Kunde_seit'] || fields['Kunde seit'] || null
    }
  })

  const inserted = await insertToSupabase('hot_leads', supabaseRecords)

  // ID Mapping speichern
  airtableRecords.forEach((airtableRecord, index) => {
    if (inserted[index]) {
      idMappings.hotLeads.set(airtableRecord.id, inserted[index].id)
    }
  })

  console.log(`   📋 ID Mappings: ${idMappings.hotLeads.size} Hot Leads`)
}

/**
 * 4. E-Mail Templates migrieren
 */
async function migrateEmailTemplates() {
  console.log('\n📧 MIGRIERE E-MAIL TEMPLATES...')

  const airtableRecords = await fetchAllFromAirtable(AIRTABLE_TABLES.emailTemplates)

  const supabaseRecords = airtableRecords.map(record => {
    const fields = record.fields
    return {
      name: fields['Name'] || 'Unbenannt',
      betreff: fields['Betreff'] || null,
      inhalt: fields['Inhalt'] || null,
      kategorie: fields['Kategorie'] || 'Allgemein',
      aktiv: fields['Aktiv'] !== false
    }
  })

  const inserted = await insertToSupabase('email_templates', supabaseRecords)

  // ID Mapping speichern
  airtableRecords.forEach((airtableRecord, index) => {
    if (inserted[index]) {
      idMappings.emailTemplates.set(airtableRecord.id, inserted[index].id)
    }
  })

  // TODO: Attachments separat migrieren (zu Supabase Storage)
  console.log('   ⚠️  Attachments müssen manuell zu Supabase Storage migriert werden')
}

/**
 * 5. Lead Requests migrieren
 */
async function migrateLeadRequests() {
  console.log('\n📝 MIGRIERE LEAD REQUESTS...')

  const airtableRecords = await fetchAllFromAirtable(AIRTABLE_TABLES.leadRequests)

  const supabaseRecords = airtableRecords.map(record => {
    const fields = record.fields

    const userIds = fields['User'] || []
    const adminIds = fields['Bearbeitet_von'] || []

    return {
      anfrage_id: fields['Anfrage_ID'] || `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: userIds[0] ? idMappings.users.get(userIds[0]) : null,
      anzahl: parseInt(fields['Anzahl']) || 0,
      nachricht: fields['Nachricht'] || null,
      status: fields['Status'] || 'Offen',
      genehmigte_anzahl: parseInt(fields['Genehmigte_Anzahl']) || null,
      admin_kommentar: fields['Admin_Kommentar'] || null,
      bearbeitet_von: adminIds[0] ? idMappings.users.get(adminIds[0]) : null,
      bearbeitet_am: fields['Bearbeitet_am'] || null,
      erstellt_am: fields['Erstellt_am'] || new Date().toISOString()
    }
  }).filter(r => r.user_id) // Nur Records mit gültigem User

  await insertToSupabase('lead_requests', supabaseRecords)
}

/**
 * 6. System Messages migrieren
 */
async function migrateSystemMessages() {
  console.log('\n💬 MIGRIERE SYSTEM MESSAGES...')

  const airtableRecords = await fetchAllFromAirtable(AIRTABLE_TABLES.systemMessages)

  const supabaseRecords = airtableRecords.map(record => {
    const fields = record.fields

    const empfaengerIds = fields['Empfänger'] || []
    const hotLeadIds = fields['Hot_Lead'] || []

    return {
      message_id: fields['Message_ID'] || `MSG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      empfaenger_id: empfaengerIds[0] ? idMappings.users.get(empfaengerIds[0]) : null,
      typ: fields['Typ'] || 'Pool Update',
      titel: fields['Titel'] || null,
      nachricht: fields['Nachricht'] || null,
      hot_lead_id: hotLeadIds[0] ? idMappings.hotLeads.get(hotLeadIds[0]) : null,
      gelesen: fields['Gelesen'] === true,
      erstellt_am: fields['Erstellt_am'] || fields['Erstellt am'] || new Date().toISOString()
    }
  }).filter(r => r.empfaenger_id) // Nur Records mit gültigem Empfänger

  await insertToSupabase('system_messages', supabaseRecords)
}

/**
 * 7. Lead Archive migrieren
 */
async function migrateLeadArchive() {
  console.log('\n📦 MIGRIERE LEAD ARCHIVE...')

  const airtableRecords = await fetchAllFromAirtable(AIRTABLE_TABLES.archive)

  const supabaseRecords = airtableRecords.map(record => {
    const fields = record.fields

    const leadIds = fields['Lead'] || []
    const userIds = fields['Vertriebler'] || []

    return {
      lead_id: leadIds[0] ? idMappings.leads.get(leadIds[0]) : null,
      user_id: userIds[0] ? idMappings.users.get(userIds[0]) : null,
      bereits_kontaktiert: fields['Bereits_kontaktiert'] === 'X',
      ergebnis: normalizeErgebnis(fields['Ergebnis']),
      datum: fields['Datum'] || null,
      archiviert_am: fields['Archiviert_am'] || new Date().toISOString()
    }
  })

  await insertToSupabase('lead_archive', supabaseRecords)
}

// =====================================================
// HAUPT-MIGRATION
// =====================================================

async function runMigration() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║     SUNSIDE CRM - AIRTABLE ZU SUPABASE MIGRATION            ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log('⚠️  WARNUNG: Diese Migration überschreibt vorhandene Daten!')
  console.log('   Stelle sicher, dass du ein Backup hast.')
  console.log('')

  try {
    // Reihenfolge wichtig wegen Abhängigkeiten!
    await migrateUsers()           // 1. Users zuerst (keine Abhängigkeiten)
    await migrateLeads()           // 2. Leads (verweist auf Users)
    await migrateHotLeads()        // 3. Hot Leads (verweist auf Leads + Users)
    await migrateEmailTemplates()  // 4. Templates (keine Abhängigkeiten)
    await migrateLeadRequests()    // 5. Requests (verweist auf Users)
    await migrateSystemMessages()  // 6. Messages (verweist auf Users + Hot Leads)
    await migrateLeadArchive()     // 7. Archive (verweist auf Leads + Users)

    console.log('\n╔══════════════════════════════════════════════════════════════╗')
    console.log('║     ✅ MIGRATION ERFOLGREICH ABGESCHLOSSEN!                 ║')
    console.log('╚══════════════════════════════════════════════════════════════╝')

    console.log('\n📊 ZUSAMMENFASSUNG:')
    console.log(`   Users:          ${idMappings.users.size}`)
    console.log(`   Leads:          ${idMappings.leads.size}`)
    console.log(`   Hot Leads:      ${idMappings.hotLeads.size}`)
    console.log(`   E-Mail Templates: ${idMappings.emailTemplates.size}`)

    console.log('\n⚠️  NÄCHSTE SCHRITTE:')
    console.log('   1. Attachments manuell zu Supabase Storage migrieren')
    console.log('   2. Netlify Functions auf Supabase umstellen')
    console.log('   3. Frontend testen')
    console.log('   4. Airtable nach erfolgreichem Test abschalten')

  } catch (error) {
    console.error('\n❌ MIGRATION FEHLGESCHLAGEN:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Migration starten
runMigration()
