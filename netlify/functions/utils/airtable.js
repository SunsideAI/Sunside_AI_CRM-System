// Airtable Utility Functions mit Retry-Logik
// Löst das Rate-Limit-Problem (5 Requests/Sekunde)

const MAX_RETRIES = 4
const INITIAL_DELAY = 1000 // 1 Sekunde

/**
 * Fetch mit automatischem Retry bei Rate-Limit-Fehlern
 * Verwendet exponential backoff: 1s, 2s, 4s, 8s
 */
export async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  let lastError = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Rate Limit erreicht (429) oder Server überlastet (503)
      if (response.status === 429 || response.status === 503) {
        const retryAfter = response.headers.get('Retry-After')
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : INITIAL_DELAY * Math.pow(2, attempt)

        console.log(`[Airtable] Rate limit erreicht. Retry ${attempt + 1}/${retries} in ${delay}ms...`)

        if (attempt < retries) {
          await sleep(delay)
          continue
        }

        // Letzter Versuch fehlgeschlagen
        const errorBody = await response.text()
        throw new Error(`Rate limit nach ${retries} Versuchen: ${errorBody}`)
      }

      // Andere Fehler die einen Retry rechtfertigen (5xx)
      if (response.status >= 500 && attempt < retries) {
        const delay = INITIAL_DELAY * Math.pow(2, attempt)
        console.log(`[Airtable] Server-Fehler ${response.status}. Retry ${attempt + 1}/${retries} in ${delay}ms...`)
        await sleep(delay)
        continue
      }

      return response

    } catch (error) {
      lastError = error

      // Netzwerk-Fehler - Retry mit backoff
      if (attempt < retries && isRetryableError(error)) {
        const delay = INITIAL_DELAY * Math.pow(2, attempt)
        console.log(`[Airtable] Netzwerk-Fehler. Retry ${attempt + 1}/${retries} in ${delay}ms...`, error.message)
        await sleep(delay)
        continue
      }

      throw error
    }
  }

  throw lastError || new Error('Alle Retry-Versuche fehlgeschlagen')
}

/**
 * Hilfsfunktion: Sleep/Delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Prüft ob ein Fehler einen Retry rechtfertigt
 */
function isRetryableError(error) {
  const retryableMessages = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'socket hang up',
    'network',
    'fetch failed'
  ]

  const errorMessage = error.message?.toLowerCase() || ''
  return retryableMessages.some(msg => errorMessage.includes(msg.toLowerCase()))
}

/**
 * Airtable API Wrapper mit Retry
 */
export async function airtableFetch(baseId, table, options = {}) {
  const apiKey = process.env.AIRTABLE_API_KEY

  if (!apiKey || !baseId) {
    throw new Error('Airtable nicht konfiguriert')
  }

  const {
    method = 'GET',
    body = null,
    params = {},
    recordId = null
  } = options

  // URL bauen
  let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`

  if (recordId) {
    url += `/${recordId}`
  }

  // Query-Parameter anhängen
  const queryParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(key, v))
      } else {
        queryParams.append(key, value)
      }
    }
  })

  const queryString = queryParams.toString()
  if (queryString) {
    url += `?${queryString}`
  }

  // Fetch mit Retry
  const fetchOptions = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  }

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body)
  }

  const response = await fetchWithRetry(url, fetchOptions)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Airtable] Fehler ${response.status}:`, errorText)
    throw new Error(`Airtable Fehler: ${response.status} - ${errorText}`)
  }

  // Leere Antwort bei DELETE
  if (method === 'DELETE' && response.status === 200) {
    return { success: true }
  }

  return response.json()
}

/**
 * Alle Records aus einer Tabelle laden (mit Pagination)
 */
export async function airtableFetchAll(baseId, table, options = {}) {
  const { params = {}, fields = [] } = options

  let allRecords = []
  let offset = null

  do {
    const queryParams = { ...params, pageSize: '100' }

    // Felder hinzufügen
    if (fields.length > 0) {
      queryParams['fields[]'] = fields
    }

    if (offset) {
      queryParams.offset = offset
    }

    const data = await airtableFetch(baseId, table, { params: queryParams })

    allRecords = allRecords.concat(data.records || [])
    offset = data.offset

  } while (offset)

  return allRecords
}

/**
 * Request Queue für sequentielle Verarbeitung
 * Stellt sicher dass nicht mehr als 5 Requests/Sekunde an Airtable gehen
 */
class AirtableQueue {
  constructor() {
    this.queue = []
    this.processing = false
    this.lastRequestTime = 0
    this.minInterval = 200 // 200ms = max 5 requests/sekunde
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject })
      this.process()
    })
  }

  async process() {
    if (this.processing || this.queue.length === 0) return

    this.processing = true

    while (this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift()

      // Warten wenn nötig
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime

      if (timeSinceLastRequest < this.minInterval) {
        await sleep(this.minInterval - timeSinceLastRequest)
      }

      this.lastRequestTime = Date.now()

      try {
        const result = await fn()
        resolve(result)
      } catch (error) {
        reject(error)
      }
    }

    this.processing = false
  }
}

// Singleton Queue-Instanz
export const airtableQueue = new AirtableQueue()

export default {
  fetchWithRetry,
  airtableFetch,
  airtableFetchAll,
  airtableQueue
}
