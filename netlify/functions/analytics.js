// Analytics API für Setting und Closing Performance - Supabase Version
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
}

// User-Map laden für Namen-Auflösung
async function loadUserMap() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, vor_nachname')

  if (error) {
    console.error('Failed to load users:', error)
    return {}
  }

  const userMap = {}
  users.forEach(user => {
    userMap[user.id] = user.vor_nachname || 'Unbekannt'
  })
  return userMap
}

// User ID nach Name finden
async function getUserIdByName(userName) {
  if (!userName) return null

  const { data, error } = await supabase
    .from('users')
    .select('id')
    .ilike('vor_nachname', userName)
    .limit(1)

  if (error || !data || data.length === 0) return null
  return data[0].id
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Server nicht konfiguriert' })
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
    const startDateStr = params.startDate || null
    const endDateStr = params.endDate || null

    // Für Funktionen die Date-Objekte brauchen (Zeitverlauf-Formatierung)
    const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : null
    const endDate = endDateStr ? new Date(endDateStr + 'T23:59:59') : null

    if (type === 'closing') {
      const result = await getClosingStats({ isAdmin, userEmail, userName, startDate, endDate, startDateStr, endDateStr })
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result)
      }
    } else {
      const result = await getSettingStats({ isAdmin, userEmail, userName, filterUserName, startDate, endDate, startDateStr, endDateStr })
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result)
      }
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
// CLOSING STATS (Hot Leads)
// ==========================================
async function getClosingStats({ isAdmin, userEmail, userName, startDate, endDate, startDateStr, endDateStr }) {
  console.log('getClosingStats - Params:', { isAdmin, userName, startDateStr, endDateStr })

  // User-Map laden
  const userMap = await loadUserMap()

  // Alle Hot Leads laden mit User-Joins
  const { data: allRecords, error } = await supabase
    .from('hot_leads')
    .select(`
      *,
      setter:users!hot_leads_setter_id_fkey(id, vor_nachname),
      closer:users!hot_leads_closer_id_fkey(id, vor_nachname)
    `)

  if (error) {
    throw new Error(error.message)
  }

  console.log('Hot Leads geladen:', allRecords.length)

  let gewonnen = 0
  let verloren = 0
  let angebotVersendet = 0
  let offen = 0
  let umsatzGesamt = 0
  const zeitverlaufMap = {}
  const perUserMap = {}

  for (const record of allRecords) {
    // Status auslesen und normalisieren
    const statusRaw = record.status || ''
    const status = statusRaw.toLowerCase().trim()

    // Umsatz-Felder
    const setup = parseCurrency(record.setup)
    const retainer = parseCurrency(record.retainer)
    const laufzeit = parseInt(record.laufzeit) || 6

    // Datum-Felder
    const kundeSeit = record.kunde_seit || null
    const terminDatum = record.termin_beratungsgespraech || null

    // Closer-Name
    const closerName = record.closer?.vor_nachname || ''
    const closerId = record.closer_id

    // Prüfen ob es ein gewonnener Deal ist
    const istGewonnen = status.includes('abgeschlossen')

    // Datum-Filter basierend auf relevantem Datum
    const relevantDateStr = istGewonnen ? (kundeSeit || terminDatum) : terminDatum

    if (startDateStr || endDateStr) {
      if (relevantDateStr) {
        const dateOnly = relevantDateStr.split('T')[0]
        if (startDateStr && dateOnly < startDateStr) continue
        if (endDateStr && dateOnly > endDateStr) continue
      }
    }

    // User-Filter (wenn nicht Admin)
    if (!isAdmin && userName) {
      if (!closerName || !closerName.toLowerCase().includes(userName.toLowerCase())) continue
    }

    // Status kategorisieren
    if (istGewonnen) {
      gewonnen++
      const dealWert = setup + (retainer * laufzeit)
      umsatzGesamt += dealWert

      // Zeitverlauf
      const timelineDateStr = kundeSeit || terminDatum
      if (timelineDateStr) {
        const date = new Date(timelineDateStr)
        if (!isNaN(date.getTime())) {
          const dayKey = date.toISOString().split('T')[0]
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

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

      // Per User Stats (Admin)
      if (closerName && isAdmin) {
        if (!perUserMap[closerName]) {
          perUserMap[closerName] = { gewonnen: 0, verloren: 0, offen: 0, umsatz: 0 }
        }
        perUserMap[closerName].gewonnen++
        perUserMap[closerName].umsatz += dealWert
      }
    } else if (status === 'verloren') {
      verloren++
      if (closerName && isAdmin) {
        if (!perUserMap[closerName]) {
          perUserMap[closerName] = { gewonnen: 0, verloren: 0, offen: 0, umsatz: 0 }
        }
        perUserMap[closerName].verloren++
      }
    } else if (status.includes('angebot')) {
      angebotVersendet++
      if (closerName && isAdmin) {
        if (!perUserMap[closerName]) {
          perUserMap[closerName] = { gewonnen: 0, verloren: 0, offen: 0, umsatz: 0 }
        }
        perUserMap[closerName].offen++
      }
    } else {
      offen++
      if (closerName && isAdmin) {
        if (!perUserMap[closerName]) {
          perUserMap[closerName] = { gewonnen: 0, verloren: 0, offen: 0, umsatz: 0 }
        }
        perUserMap[closerName].offen++
      }
    }
  }

  // Closing Quote berechnen
  const totalEntschieden = gewonnen + verloren
  const closingQuote = totalEntschieden > 0 ? (gewonnen / totalEntschieden) * 100 : 0

  // Durchschnittlicher Umsatz pro Deal
  const umsatzDurchschnitt = gewonnen > 0 ? umsatzGesamt / gewonnen : 0

  // Zeitverlauf formatieren
  const zeitverlauf = formatZeitverlauf(zeitverlaufMap, startDate, endDate)

  // Per User sortieren
  const perUser = Object.entries(perUserMap)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.umsatz - a.umsatz)

  return {
    summary: {
      gewonnen,
      verloren,
      angebotVersendet,
      noShow: 0,
      offen: offen + angebotVersendet,
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
  // User-IDs ermitteln falls nötig
  let userRecordId = null
  if (!isAdmin && userName) {
    userRecordId = await getUserIdByName(userName)
  }

  let filterUserRecordId = null
  if (isAdmin && filterUserName) {
    filterUserRecordId = await getUserIdByName(filterUserName)
  }

  // User-Map laden
  const userMap = await loadUserMap()

  // Aktive Leads laden - NUR kontaktierte (bereits_kontaktiert = true)
  const { data: activeRecords, error: activeError } = await supabase
    .from('leads')
    .select('id, bereits_kontaktiert, ergebnis, datum')
    .eq('bereits_kontaktiert', true)

  if (activeError) {
    throw new Error(activeError.message)
  }

  // Lead Assignments laden (kein Default-Limit)
  const { data: assignments, error: assignError } = await supabase
    .from('lead_assignments')
    .select('lead_id, user_id')
    .range(0, 50000)

  // Assignments zu Map
  const assignmentMap = {}
  if (assignments) {
    assignments.forEach(a => {
      if (!assignmentMap[a.lead_id]) {
        assignmentMap[a.lead_id] = []
      }
      assignmentMap[a.lead_id].push(a.user_id)
    })
  }

  // Archiv-Leads laden
  const { data: archivRecords, error: archivError } = await supabase
    .from('lead_archive')
    .select('id, bereits_kontaktiert, ergebnis, datum, user_id')

  // Debug-Logging
  console.log(`Analytics: ${activeRecords?.length || 0} kontaktierte Leads geladen, ${archivRecords?.length || 0} Archiv-Einträge`)

  // Helper: Boolean-Wert flexibel prüfen (jeder truthy Wert)
  const isTruthy = (val) => !!val

  // Daten normalisieren - alle activeRecords sind bereits kontaktiert (durch Filter)
  const normalizedActive = (activeRecords || []).map(record => ({
    source: 'active',
    id: record.id,
    kontaktiert: true,
    ergebnis: record.ergebnis || '',
    datum: record.datum || null,
    zugewiesenAn: assignmentMap[record.id] || []
  }))

  const normalizedArchiv = (archivRecords || []).map(record => ({
    source: 'archiv',
    id: record.id,
    kontaktiert: isTruthy(record.bereits_kontaktiert),
    ergebnis: record.ergebnis || '',
    datum: record.datum || null,
    zugewiesenAn: record.user_id ? [record.user_id] : []
  }))

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
    if (!record.kontaktiert) continue

    const ergebnis = (record.ergebnis || '').toLowerCase()
    const datumRaw = record.datum
    const zugewiesenAn = record.zugewiesenAn

    // Datum-Filter
    if (startDateStr || endDateStr) {
      if (!datumRaw) continue
      const datum = datumRaw.split('T')[0]
      if (startDateStr && datum < startDateStr) continue
      if (endDateStr && datum > endDateStr) continue
    }

    // User-Filter
    if (!isAdmin && userRecordId) {
      if (!zugewiesenAn.includes(userRecordId)) continue
    }

    if (isAdmin && filterUserRecordId) {
      if (!zugewiesenAn.includes(filterUserRecordId)) continue
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
      if (istBeratungsgespraech) beratungsgespraech++
      else if (istUnterlagen) unterlagen++
      else if (istKeinInteresse) keinInteresse++
    }

    // Zeitverlauf
    if (datumRaw) {
      const date = new Date(datumRaw)
      const dayKey = date.toISOString().split('T')[0]
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

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
      const oderId = zugewiesenAn[0]
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
        if (istBeratungsgespraech) perUserMap[oderId].beratungsgespraech++
        else if (istUnterlagen) perUserMap[oderId].unterlagen++
        else if (istKeinInteresse) perUserMap[oderId].keinInteresse++
      }
    }
  }

  // Quoten berechnen
  const erreichQuote = einwahlen > 0 ? (erreicht / einwahlen) * 100 : 0
  const beratungsgespraechQuote = erreicht > 0 ? (beratungsgespraech / erreicht) * 100 : 0
  const unterlagenQuote = erreicht > 0 ? (unterlagen / erreicht) * 100 : 0
  const keinInteresseQuote = erreicht > 0 ? (keinInteresse / erreicht) * 100 : 0

  // Zeitverlauf formatieren
  const zeitverlauf = formatZeitverlauf(zeitverlaufMap, startDate, endDate)

  // Per User mit Namen
  const perUser = Object.values(perUserMap)
    .map(stats => ({
      ...stats,
      name: userMap[stats.id] || `User ${String(stats.id).substring(0, 6)}`
    }))
    .sort((a, b) => b.einwahlen - a.einwahlen)

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
// HELPER FUNCTIONS
// ==========================================

function formatZeitverlauf(map, startDate, endDate) {
  const result = []
  const now = new Date()

  const start = startDate || new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const end = endDate || now

  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))

  if (diffDays <= 1) {
    const dayKey = start.toISOString().split('T')[0]
    const label = start.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
    result.push({
      period: dayKey,
      label,
      count: map[dayKey]?.count || 0,
      umsatz: map[dayKey]?.umsatz || 0
    })
  } else if (diffDays <= 14) {
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
    const currentDate = new Date(start)
    const dayOfWeek = currentDate.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    currentDate.setDate(currentDate.getDate() + diff)

    while (currentDate <= end) {
      const weekKey = `${currentDate.getFullYear()}-W${getWeekNumber(currentDate)}`
      const label = `KW ${getWeekNumber(currentDate)}`

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

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

function parseCurrency(value) {
  if (!value) return 0
  if (typeof value === 'number') return value

  let cleaned = String(value)
    .replace(/[€$£¥]/g, '')
    .replace(/\s/g, '')
    .trim()

  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') < cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/,/g, '')
    } else {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    }
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    const parts = cleaned.split(',')
    if (parts[parts.length - 1].length === 2) {
      cleaned = cleaned.replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  }

  const result = parseFloat(cleaned)
  return isNaN(result) ? 0 : result
}
