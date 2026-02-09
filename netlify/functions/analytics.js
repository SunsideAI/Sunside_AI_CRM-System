// Analytics API für Setting und Closing Performance
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID

const headers = {
  'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json'
}

// === RATE LIMIT SCHUTZ (verbessert) ===
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Throttle: Mindestabstand zwischen Requests (Airtable erlaubt 5 req/sec)
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 210 // 210ms ≈ 4.7 req/sec (knapp unter Airtable-Limit von 5/sec)

async function throttledFetch(url, options = {}) {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await sleep(MIN_REQUEST_INTERVAL - elapsed)
  }
  lastRequestTime = Date.now()
  return fetch(url, options)
}

async function fetchWithRetry(url, options = {}, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await throttledFetch(url, options)

      if (response.status === 429) {
        if (attempt >= maxRetries) {
          console.error(`Rate limit (429) nach ${maxRetries} Versuchen`)
          return response
        }
        const retryAfter = response.headers.get('Retry-After')
        // Exponential backoff mit Jitter: 2s, 4s, 8s, 16s, max 30s
        const baseDelay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(Math.pow(2, attempt + 1) * 1000, 30000)
        const jitter = Math.random() * 1000
        const delay = baseDelay + jitter
        console.log(`Rate limit (429), warte ${Math.round(delay)}ms... (Versuch ${attempt + 1}/${maxRetries})`)
        await sleep(delay)
        continue
      }

      return response
    } catch (err) {
      if (attempt === maxRetries) throw err
      const delay = Math.pow(2, attempt + 1) * 1000 + Math.random() * 1000
      await sleep(delay)
    }
  }
  throw new Error('Max retries exceeded')
}

// Cache für User-Namen (Record-ID -> Name)
let userNameCache = null
let userNameCacheTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 Minuten

// Analytics Result Cache (2 Minuten TTL) - vermeidet wiederholte Voll-Scans
const analyticsResultCache = new Map()
const RESULT_CACHE_TTL = 2 * 60 * 1000

function getAnalyticsCacheKey(params) {
  return `${params.type || 'setting'}|${params.admin}|${params.email}|${params.userName}|${params.filterUserName}|${params.startDate}|${params.endDate}`
}

async function loadUserNames() {
  // Cache prüfen
  if (userNameCache && (Date.now() - userNameCacheTime) < CACHE_DURATION) {
    return userNameCache
  }

  const USER_TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('User_Datenbank')}`
  
  try {
    const response = await fetchWithRetry(`${USER_TABLE_URL}?fields[]=Vor_Nachname`, { headers })
    
    if (!response.ok) {
      console.error('User-Namen laden fehlgeschlagen:', response.status)
      return {}
    }
    
    const data = await response.json()
    const nameMap = {}
    
    for (const record of data.records) {
      nameMap[record.id] = record.fields.Vor_Nachname || record.id
    }
    
    // Cache aktualisieren
    userNameCache = nameMap
    userNameCacheTime = Date.now()
    
    console.log('Analytics: User-Namen geladen:', Object.keys(nameMap).length, 'User')
    return nameMap
  } catch (err) {
    console.error('Fehler beim Laden der User-Namen:', err)
    return {}
  }
}

// Helper: Record-ID zu Name auflösen
function resolveUserName(field, userNames) {
  if (!field) return ''
  if (typeof field === 'string') {
    // Prüfen ob es eine Record-ID ist (beginnt mit "rec")
    if (field.startsWith('rec') && userNames[field]) {
      return userNames[field]
    }
    return field // Bereits ein Name
  }
  if (Array.isArray(field) && field.length > 0) {
    const id = field[0]
    return userNames[id] || id
  }
  return ''
}

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const params = event.queryStringParameters || {}
    const type = params.type || 'setting'
    const isAdmin = params.admin === 'true'
    const userEmail = params.email
    const userName = params.userName
    const filterUserName = params.filterUserName
    
    // Datum-Filter als Strings behalten (YYYY-MM-DD Format)
    // Das vermeidet Zeitzonen-Probleme komplett
    const startDateStr = params.startDate || null // z.B. "2025-12-12"
    const endDateStr = params.endDate || null     // z.B. "2025-12-12"
    
    // Für Funktionen die Date-Objekte brauchen (Zeitverlauf-Formatierung)
    const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : null
    const endDate = endDateStr ? new Date(endDateStr + 'T23:59:59') : null

    // Result Cache prüfen
    const cacheKey = getAnalyticsCacheKey(params)
    const cached = analyticsResultCache.get(cacheKey)
    if (cached && (Date.now() - cached.time) < RESULT_CACHE_TTL) {
      console.log('Analytics: Cache-Hit')
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: cached.body
      }
    }

    let result
    if (type === 'closing') {
      result = await getClosingStats({ isAdmin, userEmail, userName, startDate, endDate, startDateStr, endDateStr })
    } else {
      result = await getSettingStats({ isAdmin, userEmail, userName, filterUserName, startDate, endDate, startDateStr, endDateStr })
    }

    const body = JSON.stringify(result)

    // Result cachen
    analyticsResultCache.set(cacheKey, { body, time: Date.now() })
    // Alte Einträge aufräumen (max 50)
    if (analyticsResultCache.size > 50) {
      const oldestKey = analyticsResultCache.keys().next().value
      analyticsResultCache.delete(oldestKey)
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body
    }

  } catch (error) {
    console.error('Analytics Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}

// ==========================================
// USER RECORD ID HOLEN
// ==========================================
async function getUserRecordId(userName) {
  if (!userName) return null
  
  const tableName = 'User_Datenbank'
  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`)
  url.searchParams.append('filterByFormula', `{Vor_Nachname} = "${userName}"`)
  url.searchParams.append('maxRecords', '1')

  const response = await fetchWithRetry(url.toString(), { headers })
  const data = await response.json()

  if (data.records && data.records.length > 0) {
    return data.records[0].id
  }
  return null
}

// ==========================================
// CLOSING STATS (Hot Leads)
// ==========================================
async function getClosingStats({ isAdmin, userEmail, userName, startDate, endDate, startDateStr, endDateStr }) {
  const tableName = 'Immobilienmakler_Hot_Leads'
  
  console.log('getClosingStats - Params:', { isAdmin, userName, startDateStr, endDateStr })
  
  // User-Namen laden für Record-ID -> Name Auflösung
  const userNames = await loadUserNames()
  console.log('User-Namen geladen:', Object.keys(userNames).length)
  
  let allRecords = []
  let offset = null

  // Hot Leads: kein fields[]-Filter wegen unsicherer Feldnamen ('Kunde seit' vs 'Kunde_seit')
  // Tabelle ist klein genug, dass alle Felder geladen werden können
  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`)
    url.searchParams.append('pageSize', '100')
    if (offset) {
      url.searchParams.append('offset', offset)
    }

    const response = await fetchWithRetry(url.toString(), { headers })
    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message)
    }

    allRecords = allRecords.concat(data.records || [])
    offset = data.offset
  } while (offset)

  console.log('Hot Leads geladen:', allRecords.length)

  let gewonnen = 0
  let verloren = 0
  let angebotVersendet = 0
  let offen = 0
  let umsatzGesamt = 0
  const zeitverlaufMap = {}
  const perUserMap = {}

  for (const record of allRecords) {
    const fields = record.fields
    
    // Status auslesen und normalisieren
    const statusRaw = fields.Status || ''
    const status = statusRaw.toLowerCase().trim()
    
    // Umsatz-Felder - mit korrektem Währungs-Parsing
    const setup = parseCurrency(fields.Setup)
    const retainer = parseCurrency(fields.Retainer)
    const laufzeit = parseInt(fields.Laufzeit) || 6  // Standard: 6 Monate
    
    // Datum-Felder (korrigierte Feldnamen)
    // "Kunde seit" für Abschlussdatum, "Termin_Beratungsgespräch" als Fallback
    const kundeSeit = fields['Kunde seit'] || fields.Kunde_seit || null
    const terminDatum = fields.Termin_Beratungsgespräch || null
    
    // Closer - Record-ID zu Name auflösen
    const closerName = resolveUserName(fields.Closer, userNames)
    
    // Setter - Record-ID zu Name auflösen
    const setterName = resolveUserName(fields.Setter, userNames)

    // Prüfen ob es ein gewonnener Deal ist
    const istGewonnen = status.includes('abgeschlossen')

    // Datum-Filter basierend auf relevantem Datum
    // Für gewonnene: Kunde seit, sonst Termin_Beratungsgespräch
    const relevantDateStr = istGewonnen ? (kundeSeit || terminDatum) : terminDatum
    
    // String-Vergleich für YYYY-MM-DD Format
    if (startDateStr || endDateStr) {
      if (!relevantDateStr) {
        // Kein Datum vorhanden - Record trotzdem inkludieren wenn kein Zeitfilter
        // Bei aktivem Zeitfilter: überspringen nur wenn strikt gefiltert werden soll
      } else {
        // Datum auf YYYY-MM-DD normalisieren falls nötig
        const dateOnly = relevantDateStr.split('T')[0]
        if (startDateStr && dateOnly < startDateStr) continue
        if (endDateStr && dateOnly > endDateStr) continue
      }
    }

    // User-Filter (wenn nicht Admin) - nach Closer-Namen filtern
    // Closer sehen nur Records wo sie als Closer eingetragen sind
    if (!isAdmin && userName) {
      // Debug: Ersten paar Records loggen
      if (allRecords.indexOf(record) < 3) {
        console.log('Filter-Check:', {
          recordId: record.id,
          closerRaw: fields.Closer,
          closerResolved: closerName,
          userName: userName,
          match: closerName && closerName.toLowerCase().includes(userName.toLowerCase())
        })
      }
      if (!closerName || !closerName.toLowerCase().includes(userName.toLowerCase())) continue
    }

    // Status kategorisieren
    if (istGewonnen) {
      gewonnen++
      const dealWert = setup + (retainer * laufzeit)
      umsatzGesamt += dealWert

      // Zeitverlauf: Kunde seit für gewonnene Deals
      const timelineDateStr = kundeSeit || terminDatum
      if (timelineDateStr) {
        const date = new Date(timelineDateStr)
        if (!isNaN(date.getTime())) {
          // Tages-Key für kurze Zeiträume
          const dayKey = date.toISOString().split('T')[0]
          // Monats-Key für lange Zeiträume
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          
          // Beide Keys speichern
          if (!zeitverlaufMap[dayKey]) {
            zeitverlaufMap[dayKey] = { count: 0, umsatz: 0 }
          }
          zeitverlaufMap[dayKey].count++
          zeitverlaufMap[dayKey].umsatz += dealWert
          
          if (!zeitverlaufMap[monthKey]) {
            zeitverlaufMap[monthKey] = { count: 0, umsatz: 0 }
          }
          zeitverlaufMap[monthKey].count++
          zeitverlaufMap[monthKey].umsatz += dealWert
        }
      }

      // Per User Stats (Admin) - nach Closer-Namen gruppieren
      if (closerName && isAdmin) {
        if (!perUserMap[closerName]) {
          perUserMap[closerName] = { gewonnen: 0, verloren: 0, offen: 0, umsatz: 0 }
        }
        perUserMap[closerName].gewonnen++
        perUserMap[closerName].umsatz += dealWert
      }
    } 
    // Verloren
    else if (status === 'verloren') {
      verloren++
      if (closerName && isAdmin) {
        if (!perUserMap[closerName]) {
          perUserMap[closerName] = { gewonnen: 0, verloren: 0, offen: 0, umsatz: 0 }
        }
        perUserMap[closerName].verloren++
      }
    }
    // Angebot versendet
    else if (status.includes('angebot')) {
      angebotVersendet++
      if (closerName && isAdmin) {
        if (!perUserMap[closerName]) {
          perUserMap[closerName] = { gewonnen: 0, verloren: 0, offen: 0, umsatz: 0 }
        }
        perUserMap[closerName].offen++
      }
    }
    // Offen: "Lead" oder alles andere
    else {
      offen++
      if (closerName && isAdmin) {
        if (!perUserMap[closerName]) {
          perUserMap[closerName] = { gewonnen: 0, verloren: 0, offen: 0, umsatz: 0 }
        }
        perUserMap[closerName].offen++
      }
    }
  }

  // Closing Quote berechnen (gewonnen / (gewonnen + verloren))
  const totalEntschieden = gewonnen + verloren
  const closingQuote = totalEntschieden > 0 ? (gewonnen / totalEntschieden) * 100 : 0

  // Durchschnittlicher Umsatz pro Deal
  const umsatzDurchschnitt = gewonnen > 0 ? umsatzGesamt / gewonnen : 0

  // Zeitverlauf formatieren - mit Zeitraum-Parametern
  const zeitverlauf = formatZeitverlauf(zeitverlaufMap, startDate, endDate)

  // Per User: Namen aus User_Datenbank holen falls Record IDs verwendet wurden
  let perUser = []
  if (Object.keys(perUserMap).length > 0) {
    // Prüfen ob es Record IDs sind (starten mit "rec")
    const keys = Object.keys(perUserMap)
    const hasRecordIds = keys.some(k => k.startsWith('rec'))
    
    if (hasRecordIds) {
      // Namen aus User_Datenbank holen
      const userNames = await getUserNames(keys)
      perUser = Object.entries(perUserMap).map(([id, stats]) => ({
        name: userNames[id] || id, // Fallback auf ID wenn Name nicht gefunden
        ...stats
      }))
    } else {
      // Bereits Namen (Text-Felder)
      perUser = Object.entries(perUserMap).map(([name, stats]) => ({
        name,
        ...stats
      }))
    }
    
    // Nach Umsatz sortieren
    perUser.sort((a, b) => b.umsatz - a.umsatz)
  }

  return {
    summary: {
      gewonnen,
      verloren,
      angebotVersendet,
      noShow: 0,  // Deprecated, aber für Kompatibilität
      offen: offen + angebotVersendet,  // Lead + Angebot versendet
      closingQuote,
      umsatzGesamt,
      umsatzDurchschnitt
    },
    zeitverlauf,
    perUser
  }
}

// ==========================================
// SETTING STATS (Kaltakquise Leads)
// ==========================================
async function getSettingStats({ isAdmin, userEmail, userName, filterUserName, startDate, endDate, startDateStr, endDateStr }) {
  const leadsTableName = 'Immobilienmakler_Leads'
  const archivTableId = 'tbluaHfCySe8cSgSY' // Immobilienmakler_Leads_Archiv
  
  // User Record ID holen wenn nicht Admin
  let userRecordId = null
  if (!isAdmin && userName) {
    userRecordId = await getUserRecordId(userName)
  }
  
  // Admin filtert nach bestimmtem Vertriebler
  let filterUserRecordId = null
  if (isAdmin && filterUserName) {
    filterUserRecordId = await getUserRecordId(filterUserName)
  }

  // === Server-seitige Datum-Filterung (reduziert Seitenanzahl drastisch) ===
  // Wichtig: endDate + 1 Tag verwenden, weil Datum Zeitkomponenten haben kann
  // (z.B. 2026-02-09T14:30:00 ist "nach" 2026-02-09 Mitternacht)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  let dateFormula = null

  function nextDay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  if (startDateStr && dateRegex.test(startDateStr) && endDateStr && dateRegex.test(endDateStr)) {
    const endPlus1 = nextDay(endDateStr)
    dateFormula = `AND({Datum}, NOT(IS_BEFORE({Datum}, '${startDateStr}')), IS_BEFORE({Datum}, '${endPlus1}'))`
  } else if (startDateStr && dateRegex.test(startDateStr)) {
    dateFormula = `AND({Datum}, NOT(IS_BEFORE({Datum}, '${startDateStr}')))`
  } else if (endDateStr && dateRegex.test(endDateStr)) {
    const endPlus1 = nextDay(endDateStr)
    dateFormula = `AND({Datum}, IS_BEFORE({Datum}, '${endPlus1}'))`
  }

  // === 1. Aktive Leads laden ===
  let activeRecords = []
  let offset = null

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(leadsTableName)}`)
    url.searchParams.append('pageSize', '100')
    if (dateFormula) {
      url.searchParams.append('filterByFormula', dateFormula)
    }
    if (offset) {
      url.searchParams.append('offset', offset)
    }

    const response = await fetchWithRetry(url.toString(), { headers })
    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message)
    }

    activeRecords = activeRecords.concat(data.records || [])
    offset = data.offset
  } while (offset)

  // === 2. Archiv-Leads laden ===
  let archivRecords = []
  offset = null

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${archivTableId}`)
    url.searchParams.append('pageSize', '100')
    if (dateFormula) {
      url.searchParams.append('filterByFormula', dateFormula)
    }
    if (offset) {
      url.searchParams.append('offset', offset)
    }

    const response = await fetchWithRetry(url.toString(), { headers })
    const data = await response.json()

    if (data.error) {
      console.error('Archiv-Fehler:', data.error.message)
      // Archiv-Fehler ignorieren, weiter mit aktiven Leads
      break
    }

    archivRecords = archivRecords.concat(data.records || [])
    offset = data.offset
  } while (offset)

  console.log(`Analytics: ${activeRecords.length} aktive Leads, ${archivRecords.length} Archiv-Einträge`)

  // === 3. Daten normalisieren und kombinieren ===
  // Helper: kontaktiert kann "X", true, oder checkbox sein
  const isKontaktiert = (val) => val === true || val === 'X' || val === 'x' || val === 1

  // Aktive Leads: Felder direkt
  const normalizedActive = activeRecords.map(record => ({
    source: 'active',
    id: record.id,
    kontaktiert: isKontaktiert(
      record.fields['Bereits kontaktiert'] || 
      record.fields['Bereits_kontaktiert'] || 
      record.fields.Bereits_kontaktiert
    ),
    ergebnis: record.fields.Ergebnis || '',
    datum: record.fields.Datum || null,
    zugewiesenAn: record.fields['User_Datenbank'] || record.fields.User_Datenbank || []
  }))

  // Archiv-Leads: Gleiche Struktur wie aktive (Single Select für Bereits_kontaktiert)
  const normalizedArchiv = archivRecords.map(record => ({
    source: 'archiv',
    id: record.id,
    kontaktiert: isKontaktiert(record.fields.Bereits_kontaktiert),
    ergebnis: record.fields.Ergebnis || '',
    datum: record.fields.Datum || null,
    zugewiesenAn: record.fields.Vertriebler || [] // Im Archiv heißt es "Vertriebler"
  }))

  // === 4. Beide Datenquellen kombinieren ===
  const allRecords = [...normalizedActive, ...normalizedArchiv]

  // Stats berechnen
  let einwahlen = 0
  let erreicht = 0
  let beratungsgespraech = 0
  let unterlagen = 0
  let keinInteresse = 0
  let nichtErreicht = 0
  const zeitverlaufMap = {}
  const perUserMap = {}

  for (const record of allRecords) {
    // Kontaktiert prüfen (bereits normalisiert)
    if (!record.kontaktiert) continue

    const ergebnis = (record.ergebnis || '').toLowerCase()
    const datumRaw = record.datum
    const zugewiesenAn = record.zugewiesenAn

    // Datum-Filter (String-Vergleich für YYYY-MM-DD Format)
    // Wenn ein Zeitfilter aktiv ist, müssen Records ein Datum haben
    if (startDateStr || endDateStr) {
      if (!datumRaw) continue // Kein Datum = überspringen bei aktivem Zeitfilter
      
      // Datum auf YYYY-MM-DD normalisieren falls ISO-Format
      const datum = datumRaw.split('T')[0]
      if (startDateStr && datum < startDateStr) continue
      if (endDateStr && datum > endDateStr) continue
    }
    
    // Datum für Zeitverlauf (nach dem Filter)
    const datum = datumRaw

    // User-Filter: Nicht-Admin sieht nur eigene
    if (!isAdmin && userRecordId) {
      const assignedIds = Array.isArray(zugewiesenAn) ? zugewiesenAn : [zugewiesenAn]
      if (!assignedIds.includes(userRecordId)) continue
    }

    // Admin filtert nach bestimmtem Vertriebler
    if (isAdmin && filterUserRecordId) {
      const assignedIds = Array.isArray(zugewiesenAn) ? zugewiesenAn : [zugewiesenAn]
      if (!assignedIds.includes(filterUserRecordId)) continue
    }

    einwahlen++

    // Ergebnis kategorisieren
    const istNichtErreicht = ergebnis.includes('nicht erreicht')
    const istBeratungsgespraech = ergebnis.includes('beratungsgespräch') || ergebnis.includes('beratungsgespraech') || ergebnis.includes('termin')
    const istUnterlagen = ergebnis.includes('unterlage') || ergebnis.includes('wiedervorlage')
    const istKeinInteresse = ergebnis.includes('kein interesse') || ergebnis.includes('absage')

    if (istNichtErreicht) {
      nichtErreicht++
    } else {
      erreicht++
      
      if (istBeratungsgespraech) {
        beratungsgespraech++
      } else if (istUnterlagen) {
        unterlagen++
      } else if (istKeinInteresse) {
        keinInteresse++
      }
    }

    // Zeitverlauf
    if (datum) {
      const date = new Date(datum)
      // Tages-Key für kurze Zeiträume
      const dayKey = date.toISOString().split('T')[0]
      // Monats-Key für lange Zeiträume
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      // Beide Keys speichern
      if (!zeitverlaufMap[dayKey]) {
        zeitverlaufMap[dayKey] = { count: 0 }
      }
      zeitverlaufMap[dayKey].count++
      
      if (!zeitverlaufMap[monthKey]) {
        zeitverlaufMap[monthKey] = { count: 0 }
      }
      zeitverlaufMap[monthKey].count++
    }

    // Per User Stats (für Admins)
    if (isAdmin && zugewiesenAn && zugewiesenAn.length > 0) {
      const oderId = Array.isArray(zugewiesenAn) ? zugewiesenAn[0] : zugewiesenAn
      if (!perUserMap[oderId]) {
        perUserMap[oderId] = { 
          id: oderId,
          einwahlen: 0, 
          erreicht: 0, 
          beratungsgespraech: 0,
          unterlagen: 0,
          keinInteresse: 0,
          nichtErreicht: 0
        }
      }
      perUserMap[oderId].einwahlen++
      
      if (istNichtErreicht) {
        perUserMap[oderId].nichtErreicht++
      } else {
        perUserMap[oderId].erreicht++
        if (istBeratungsgespraech) {
          perUserMap[oderId].beratungsgespraech++
        } else if (istUnterlagen) {
          perUserMap[oderId].unterlagen++
        } else if (istKeinInteresse) {
          perUserMap[oderId].keinInteresse++
        }
      }
    }
  }

  // Quoten berechnen
  const erreichQuote = einwahlen > 0 ? (erreicht / einwahlen) * 100 : 0
  const beratungsgespraechQuote = erreicht > 0 ? (beratungsgespraech / erreicht) * 100 : 0
  const unterlagenQuote = erreicht > 0 ? (unterlagen / erreicht) * 100 : 0
  const keinInteresseQuote = erreicht > 0 ? (keinInteresse / erreicht) * 100 : 0

  // Zeitverlauf formatieren - mit Zeitraum-Parametern
  const zeitverlauf = formatZeitverlauf(zeitverlaufMap, startDate, endDate)

  // Per User: Namen aus User-Tabelle holen (für Admin)
  let perUser = []
  if (isAdmin && Object.keys(perUserMap).length > 0) {
    const userNames = await getUserNames(Object.keys(perUserMap))
    perUser = Object.values(perUserMap).map(stats => ({
      ...stats,
      name: userNames[stats.id] || `User ${String(stats.id).substring(0, 6)}`
    })).sort((a, b) => b.einwahlen - a.einwahlen)
  }

  return {
    summary: {
      einwahlen,
      erreicht,
      beratungsgespraech,
      unterlagen,
      keinInteresse,
      nichtErreicht,
      erreichQuote,
      beratungsgespraechQuote,
      unterlagenQuote,
      keinInteresseQuote
    },
    zeitverlauf,
    perUser
  }
}

// ==========================================
// USER NAMEN HOLEN (für Admin-Ansicht)
// ==========================================
async function getUserNames(recordIds) {
  if (!recordIds || recordIds.length === 0) return {}

  // Cached User-Namen verwenden statt erneut zu laden
  const allNames = await loadUserNames()
  const names = {}

  for (const id of recordIds) {
    if (allNames[id]) {
      names[id] = allNames[id]
    }
  }

  return names
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function formatZeitverlauf(map, startDate, endDate) {
  const result = []
  const now = new Date()
  
  // Standard: Letzte 6 Monate wenn kein Zeitraum angegeben
  const start = startDate || new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const end = endDate || now
  
  // Zeitraum in Tagen berechnen
  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
  
  // Granularität basierend auf Zeitraum wählen
  if (diffDays <= 1) {
    // Einzelner Tag: Keine Timeline nötig, aber für Konsistenz einen Eintrag
    const dayKey = start.toISOString().split('T')[0]
    const label = start.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
    result.push({
      period: dayKey,
      label,
      count: map[dayKey]?.count || 0,
      umsatz: map[dayKey]?.umsatz || 0
    })
  } else if (diffDays <= 14) {
    // Bis 14 Tage: Tages-Ansicht
    const currentDate = new Date(start)
    while (currentDate <= end) {
      const dayKey = currentDate.toISOString().split('T')[0]
      const label = currentDate.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' })
      
      result.push({
        period: dayKey,
        label,
        count: map[dayKey]?.count || 0,
        umsatz: map[dayKey]?.umsatz || 0
      })
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
  } else if (diffDays <= 60) {
    // Bis 60 Tage: Wochen-Ansicht
    const currentDate = new Date(start)
    // Auf Montag der Woche setzen
    const dayOfWeek = currentDate.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    currentDate.setDate(currentDate.getDate() + diff)
    
    while (currentDate <= end) {
      const weekEnd = new Date(currentDate)
      weekEnd.setDate(weekEnd.getDate() + 6)
      
      const weekKey = `${currentDate.getFullYear()}-W${getWeekNumber(currentDate)}`
      const label = `KW ${getWeekNumber(currentDate)}`
      
      // Alle Tage dieser Woche summieren
      let weekCount = 0
      let weekUmsatz = 0
      const tempDate = new Date(currentDate)
      for (let i = 0; i < 7; i++) {
        const dayKey = tempDate.toISOString().split('T')[0]
        weekCount += map[dayKey]?.count || 0
        weekUmsatz += map[dayKey]?.umsatz || 0
        tempDate.setDate(tempDate.getDate() + 1)
      }
      
      result.push({
        period: weekKey,
        label,
        count: weekCount,
        umsatz: weekUmsatz
      })
      
      currentDate.setDate(currentDate.getDate() + 7)
    }
  } else {
    // Über 60 Tage: Monats-Ansicht
    const currentDate = new Date(start.getFullYear(), start.getMonth(), 1)
    
    while (currentDate <= end) {
      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
      const label = currentDate.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
      
      result.push({
        period: monthKey,
        label,
        count: map[monthKey]?.count || 0,
        umsatz: map[monthKey]?.umsatz || 0
      })
      
      currentDate.setMonth(currentDate.getMonth() + 1)
    }
  }
  
  return result
}

// Kalenderwoche berechnen (ISO 8601)
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

// Währungswerte parsen (€1,000.00 → 1000)
function parseCurrency(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  
  // String: Währungszeichen und Whitespace entfernen
  let cleaned = String(value)
    .replace(/[€$£¥]/g, '')  // Währungszeichen
    .replace(/\s/g, '')       // Whitespace
    .trim()
  
  // Tausender-Kommas entfernen (1,000.00 → 1000.00)
  // Aber: Deutsches Format berücksichtigen (1.000,00 → 1000.00)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Internationales Format: 1,000.00
    if (cleaned.lastIndexOf(',') < cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/,/g, '')
    } 
    // Deutsches Format: 1.000,00
    else {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    }
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    // Nur Komma: könnte Dezimal sein (1000,50) oder Tausender (1,000)
    const parts = cleaned.split(',')
    if (parts[parts.length - 1].length === 2) {
      // Wahrscheinlich Dezimal: 1000,50
      cleaned = cleaned.replace(',', '.')
    } else {
      // Wahrscheinlich Tausender: 1,000
      cleaned = cleaned.replace(/,/g, '')
    }
  }
  
  const result = parseFloat(cleaned)
  return isNaN(result) ? 0 : result
}

function extractNameFromEmail(email) {
  if (!email) return 'Unbekannt'
  
  const local = email.split('@')[0]
  const parts = local.split(/[._-]/)
  
  return parts.map(part => 
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join(' ')
}
