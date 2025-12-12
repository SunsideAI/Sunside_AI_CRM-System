// Analytics API für Setting und Closing Performance
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID

const headers = {
  'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json'
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

    if (type === 'closing') {
      const result = await getClosingStats({ isAdmin, userEmail, startDate, endDate, startDateStr, endDateStr })
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
// USER RECORD ID HOLEN
// ==========================================
async function getUserRecordId(userName) {
  if (!userName) return null
  
  const tableName = 'User_Datenbank'
  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`)
  url.searchParams.append('filterByFormula', `{Vor_Nachname} = "${userName}"`)
  url.searchParams.append('maxRecords', '1')

  const response = await fetch(url.toString(), { headers })
  const data = await response.json()

  if (data.records && data.records.length > 0) {
    return data.records[0].id
  }
  return null
}

// ==========================================
// CLOSING STATS (Hot Leads)
// ==========================================
async function getClosingStats({ isAdmin, userEmail, startDate, endDate, startDateStr, endDateStr }) {
  const tableName = 'Immobilienmakler_Hot_Leads'
  
  let allRecords = []
  let offset = null

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`)
    if (offset) {
      url.searchParams.append('offset', offset)
    }

    const response = await fetch(url.toString(), { headers })
    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message)
    }

    allRecords = allRecords.concat(data.records || [])
    offset = data.offset
  } while (offset)

  let gewonnen = 0
  let verloren = 0
  let noShow = 0
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
    
    // Datum-Felder
    // Hinzugefügt = Erstellungsdatum (für Filter und nicht-gewonnene)
    const hinzugefuegt = fields.Hinzugefügt || fields.Hinzugefuegt || fields['Hinzugefügt'] || fields.Hinzugefugt
    // Kunde_seit = Abschlussdatum (für gewonnene Deals in Timeline)
    const kundeSeit = fields.Kunde_seit || fields['Kunde_seit']
    
    // Closer E-Mail
    const closerEmail = fields.Weitere_Teilnehmer || fields['Weitere_Teilnehmer'] || ''

    // Prüfen ob es ein gewonnener Deal ist
    const istGewonnen = status.includes('abgeschlossen')

    // Datum-Filter basierend auf relevantem Datum
    // Für gewonnene: Kunde_seit, sonst Hinzugefügt
    const relevantDateStr = istGewonnen ? (kundeSeit || hinzugefuegt) : hinzugefuegt
    
    // String-Vergleich für YYYY-MM-DD Format
    if (startDateStr || endDateStr) {
      if (!relevantDateStr) continue // Kein Datum = überspringen bei aktivem Zeitfilter
      
      // Datum auf YYYY-MM-DD normalisieren falls nötig
      const dateOnly = relevantDateStr.split('T')[0]
      if (startDateStr && dateOnly < startDateStr) continue
      if (endDateStr && dateOnly > endDateStr) continue
    }

    // User-Filter (wenn nicht Admin)
    if (!isAdmin && userEmail && closerEmail) {
      if (!closerEmail.toLowerCase().includes(userEmail.toLowerCase())) continue
    }

    // Status kategorisieren
    if (istGewonnen) {
      gewonnen++
      const dealWert = setup + (retainer * laufzeit)
      umsatzGesamt += dealWert

      // Zeitverlauf: Kunde_seit für gewonnene Deals
      const timelineDateStr = kundeSeit || hinzugefuegt
      if (timelineDateStr) {
        const date = new Date(timelineDateStr)
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

      // Per User Stats (Admin)
      if (closerEmail && isAdmin) {
        if (!perUserMap[closerEmail]) {
          perUserMap[closerEmail] = { gewonnen: 0, verloren: 0, offen: 0, umsatz: 0 }
        }
        perUserMap[closerEmail].gewonnen++
        perUserMap[closerEmail].umsatz += dealWert
      }
    } 
    // Verloren
    else if (status === 'verloren') {
      verloren++
      if (closerEmail && isAdmin) {
        if (!perUserMap[closerEmail]) {
          perUserMap[closerEmail] = { gewonnen: 0, verloren: 0, offen: 0, umsatz: 0 }
        }
        perUserMap[closerEmail].verloren++
      }
    } 
    // Offen: "Lead", "Angebot versendet", oder alles andere
    else {
      offen++
      if (closerEmail && isAdmin) {
        if (!perUserMap[closerEmail]) {
          perUserMap[closerEmail] = { gewonnen: 0, verloren: 0, offen: 0, umsatz: 0 }
        }
        perUserMap[closerEmail].offen++
      }
    }
  }

  // Closing Quote berechnen (gewonnen / (gewonnen + verloren))
  const totalEntschieden = gewonnen + verloren
  const closingQuote = totalEntschieden > 0 ? (gewonnen / totalEntschieden) * 100 : 0

  // Zeitverlauf formatieren - mit Zeitraum-Parametern
  const zeitverlauf = formatZeitverlauf(zeitverlaufMap, startDate, endDate)

  // Per User formatieren und sortieren
  const perUser = Object.entries(perUserMap).map(([email, stats]) => ({
    email,
    name: extractNameFromEmail(email),
    ...stats
  })).sort((a, b) => b.umsatz - a.umsatz)

  return {
    summary: {
      gewonnen,
      verloren,
      noShow,
      offen,
      closingQuote,
      umsatzGesamt,
      umsatzDurchschnitt: gewonnen > 0 ? umsatzGesamt / gewonnen : 0
    },
    zeitverlauf,
    perUser: isAdmin ? perUser : []
  }
}

// ==========================================
// SETTING STATS (Kaltakquise Leads)
// ==========================================
async function getSettingStats({ isAdmin, userEmail, userName, filterUserName, startDate, endDate, startDateStr, endDateStr }) {
  const tableName = 'Immobilienmakler_Leads'
  
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

  // Alle Leads laden
  let allRecords = []
  let offset = null

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`)
    if (offset) {
      url.searchParams.append('offset', offset)
    }

    const response = await fetch(url.toString(), { headers })
    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message)
    }

    allRecords = allRecords.concat(data.records || [])
    offset = data.offset
  } while (offset)

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
    const fields = record.fields
    
    // Kontaktiert prüfen
    const kontaktiert = fields['Bereits kontaktiert'] || 
                        fields['Bereits_kontaktiert'] || 
                        fields.Bereits_kontaktiert ||
                        fields.kontaktiert ||
                        false

    if (!kontaktiert) continue

    const ergebnis = (fields.Ergebnis || '').toLowerCase()
    const datumRaw = fields.Datum
    const zugewiesenAn = fields['User_Datenbank'] || fields.User_Datenbank || []

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
    const istUnterlagen = ergebnis.includes('unterlage')
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
  
  const tableName = 'User_Datenbank'
  const names = {}

  let allUsers = []
  let offset = null

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`)
    if (offset) {
      url.searchParams.append('offset', offset)
    }

    const response = await fetch(url.toString(), { headers })
    const data = await response.json()

    if (data.records) {
      allUsers = allUsers.concat(data.records)
    }
    offset = data.offset
  } while (offset)

  for (const user of allUsers) {
    if (recordIds.includes(user.id)) {
      names[user.id] = user.fields.Vor_Nachname || user.fields['Vor_Nachname'] || 'Unbekannt'
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
