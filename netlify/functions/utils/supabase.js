/**
 * Supabase Client Utility für Netlify Functions
 *
 * Verwendung:
 * const { supabase, queryWithRetry } = require('./utils/supabase')
 *
 * Beispiel Query:
 * const { data, error } = await supabase.from('leads').select('*')
 *
 * Mit Retry-Logik:
 * const { data, error } = await queryWithRetry(() =>
 *   supabase.from('leads').select('*')
 * )
 */

const { createClient } = require('@supabase/supabase-js')

// Supabase Credentials aus Environment Variables
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY // Service Role Key für Backend

// Validierung
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('WARNUNG: Supabase Environment Variables nicht gesetzt!')
  console.warn('Benötigt: SUPABASE_URL, SUPABASE_SERVICE_KEY')
}

// Supabase Client erstellen (Service Role für Backend-Operationen)
const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// =====================================================
// RATE LIMIT HANDLING
// =====================================================

const MAX_RETRIES = 3
const INITIAL_DELAY = 1000 // 1 Sekunde

/**
 * Sleep-Helper für Retry-Logik
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Query mit automatischem Retry bei Rate-Limit-Fehlern
 * Verwendet exponential backoff: 1s, 2s, 4s
 *
 * @param {Function} queryFn - Funktion die die Supabase-Query ausführt
 * @param {number} retries - Anzahl der Retry-Versuche
 * @returns {Promise<{data: any, error: any}>}
 */
async function queryWithRetry(queryFn, retries = MAX_RETRIES) {
  let lastError = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await queryFn()

      // Prüfe auf Rate-Limit-Fehler in der Supabase-Antwort
      if (result.error) {
        const errorMsg = result.error.message || ''
        const errorCode = result.error.code || ''

        // Rate limit oder Server-Fehler
        if (errorMsg.includes('rate limit') ||
            errorMsg.includes('too many requests') ||
            errorCode === '429' ||
            errorCode === 'PGRST301') {

          if (attempt < retries) {
            const delay = INITIAL_DELAY * Math.pow(2, attempt)
            console.log(`Rate limit (429), warte ${delay}ms... (Versuch ${attempt + 1}/${retries})`)
            await sleep(delay)
            continue
          }
        }

        // Temporäre Server-Fehler
        if (errorCode === '503' || errorCode === '502' || errorCode === '500') {
          if (attempt < retries) {
            const delay = INITIAL_DELAY * Math.pow(2, attempt)
            console.log(`Server error (${errorCode}), warte ${delay}ms... (Versuch ${attempt + 1}/${retries})`)
            await sleep(delay)
            continue
          }
        }
      }

      return result

    } catch (error) {
      lastError = error

      // Netzwerk-Fehler oder unerwartete Fehler
      if (attempt < retries) {
        const delay = INITIAL_DELAY * Math.pow(2, attempt)
        console.log(`Netzwerk-Fehler, warte ${delay}ms... (Versuch ${attempt + 1}/${retries})`)
        await sleep(delay)
        continue
      }
    }
  }

  // Alle Versuche fehlgeschlagen
  return {
    data: null,
    error: lastError || new Error(`Query fehlgeschlagen nach ${retries} Versuchen`)
  }
}

/**
 * Führt mehrere Queries parallel aus mit Rate-Limit-Schutz
 * Begrenzt auf maxConcurrent gleichzeitige Anfragen
 *
 * @param {Array<Function>} queryFns - Array von Query-Funktionen
 * @param {number} maxConcurrent - Maximale gleichzeitige Anfragen
 * @returns {Promise<Array<{data: any, error: any}>>}
 */
async function queryParallel(queryFns, maxConcurrent = 3) {
  const results = []

  for (let i = 0; i < queryFns.length; i += maxConcurrent) {
    const batch = queryFns.slice(i, i + maxConcurrent)
    const batchResults = await Promise.all(
      batch.map(fn => queryWithRetry(fn))
    )
    results.push(...batchResults)

    // Kleine Pause zwischen Batches um Rate-Limits zu vermeiden
    if (i + maxConcurrent < queryFns.length) {
      await sleep(100)
    }
  }

  return results
}

/**
 * Lädt alle Daten einer Tabelle mit Pagination und Rate-Limit-Schutz
 *
 * @param {string} table - Tabellenname
 * @param {string} select - Select-Klausel
 * @param {Object} filters - Filter als Objekt {column: value}
 * @param {number} pageSize - Seitengröße
 * @returns {Promise<{data: Array, error: any}>}
 */
async function fetchAllWithPagination(table, select = '*', filters = {}, pageSize = 1000) {
  let allRecords = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const result = await queryWithRetry(async () => {
      let query = supabase
        .from(table)
        .select(select)
        .range(page * pageSize, (page + 1) * pageSize - 1)

      // Filter anwenden
      for (const [column, value] of Object.entries(filters)) {
        if (value === true || value === false) {
          query = query.eq(column, value)
        } else if (value !== null && value !== undefined) {
          query = query.eq(column, value)
        }
      }

      return query
    })

    if (result.error) {
      return { data: allRecords, error: result.error }
    }

    if (!result.data || result.data.length === 0) {
      hasMore = false
    } else {
      allRecords = allRecords.concat(result.data)
      page++

      if (result.data.length < pageSize) {
        hasMore = false
      }
    }
  }

  return { data: allRecords, error: null }
}

// =====================================================
// HELPER FUNKTIONEN
// =====================================================

/**
 * Konvertiert Airtable-Style Record ID zu UUID
 * Falls die ID bereits eine UUID ist, wird sie zurückgegeben
 */
function normalizeId(id) {
  if (!id) return null
  // Wenn es bereits wie eine UUID aussieht
  if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return id
  }
  // Airtable IDs beginnen mit "rec" - diese müssen gemappt werden
  // Für Migration: ID-Mapping-Tabelle verwenden
  return id
}

/**
 * Standardisierte Error Response
 */
function errorResponse(statusCode, message, details = null) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify({
      error: message,
      details: details
    })
  }
}

/**
 * Standardisierte Success Response
 */
function successResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(data)
  }
}

/**
 * CORS Headers für OPTIONS Requests
 */
function corsResponse() {
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
    },
    body: ''
  }
}

/**
 * Paginierung Helper
 * Konvertiert offset/limit zu Supabase range
 */
function paginate(query, { offset = 0, limit = 100 } = {}) {
  return query.range(offset, offset + limit - 1)
}

/**
 * Supabase Error zu lesbarer Nachricht
 */
function formatSupabaseError(error) {
  if (!error) return null

  // Bekannte Error Codes
  const errorMessages = {
    '23505': 'Ein Eintrag mit diesen Daten existiert bereits',
    '23503': 'Verknüpfter Datensatz nicht gefunden',
    '42P01': 'Tabelle nicht gefunden',
    'PGRST116': 'Kein Ergebnis gefunden'
  }

  return errorMessages[error.code] || error.message || 'Unbekannter Fehler'
}

/**
 * Batch Insert mit Chunk-Verarbeitung
 * Supabase hat Limits für Batch-Operationen
 */
async function batchInsert(table, records, chunkSize = 100) {
  const results = []

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from(table)
      .insert(chunk)
      .select()

    if (error) {
      throw new Error(`Batch insert failed at chunk ${i / chunkSize}: ${error.message}`)
    }

    results.push(...(data || []))
  }

  return results
}

/**
 * Batch Update mit Chunk-Verarbeitung
 */
async function batchUpdate(table, records, chunkSize = 100) {
  const results = []

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize)

    for (const record of chunk) {
      const { id, ...updateData } = record
      const { data, error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error(`Update failed for ${id}: ${error.message}`)
        continue
      }

      results.push(data)
    }
  }

  return results
}

// =====================================================
// TABELLEN-SPEZIFISCHE HELPER
// =====================================================

/**
 * User nach E-Mail finden (für Login)
 */
async function findUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or(`email.eq.${email},email_geschaeftlich.eq.${email}`)
    .eq('status', true)
    .single()

  return { user: data, error }
}

/**
 * Leads mit zugewiesenen Usern laden
 */
async function getLeadsWithAssignments(filters = {}) {
  let query = supabase
    .from('leads_with_users')
    .select('*')

  // Filter anwenden
  if (filters.land) {
    query = query.eq('land', filters.land)
  }
  if (filters.kategorie) {
    query = query.eq('kategorie', filters.kategorie)
  }
  if (filters.bereits_kontaktiert !== undefined) {
    query = query.eq('bereits_kontaktiert', filters.bereits_kontaktiert)
  }
  if (filters.user_id) {
    query = query.contains('assigned_user_ids', [filters.user_id])
  }

  const { data, error } = await query

  return { leads: data, error }
}

/**
 * Hot Leads mit Setter/Closer Namen
 */
async function getHotLeadsWithUsers(filters = {}) {
  let query = supabase
    .from('hot_leads_with_users')
    .select('*')

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.setter_id) {
    query = query.eq('setter_id', filters.setter_id)
  }
  if (filters.closer_id) {
    query = query.eq('closer_id', filters.closer_id)
  }

  const { data, error } = await query.order('termin_beratungsgespraech', { ascending: true })

  return { hotLeads: data, error }
}

/**
 * System Messages für User
 */
async function getMessagesForUser(userId, { unreadOnly = false } = {}) {
  let query = supabase
    .from('system_messages')
    .select('*, hot_lead:hot_leads(*)')
    .eq('empfaenger_id', userId)
    .order('erstellt_am', { ascending: false })

  if (unreadOnly) {
    query = query.eq('gelesen', false)
  }

  const { data, error } = await query

  return { messages: data, error }
}

/**
 * Lead einem User zuweisen
 */
async function assignLeadToUser(leadId, userId) {
  const { data, error } = await supabase
    .from('lead_assignments')
    .insert({ lead_id: leadId, user_id: userId })
    .select()
    .single()

  return { assignment: data, error }
}

/**
 * Lead-Zuweisung entfernen
 */
async function unassignLeadFromUser(leadId, userId) {
  const { error } = await supabase
    .from('lead_assignments')
    .delete()
    .eq('lead_id', leadId)
    .eq('user_id', userId)

  return { error }
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  // Supabase Client
  supabase,

  // Rate Limit & Retry Helper
  queryWithRetry,
  queryParallel,
  fetchAllWithPagination,
  sleep,

  // Response Helper
  errorResponse,
  successResponse,
  corsResponse,

  // Query Helper
  paginate,
  formatSupabaseError,
  normalizeId,

  // Batch Operations
  batchInsert,
  batchUpdate,

  // Tabellen-spezifische Helper
  findUserByEmail,
  getLeadsWithAssignments,
  getHotLeadsWithUsers,
  getMessagesForUser,
  assignLeadToUser,
  unassignLeadFromUser
}
