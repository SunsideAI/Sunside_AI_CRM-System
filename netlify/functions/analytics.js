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
    const startDate = params.startDate ? new Date(params.startDate) : null
    const endDate = params.endDate ? new Date(params.endDate) : null

    if (type === 'closing') {
      const result = await getClosingStats({ isAdmin, userEmail, startDate, endDate })
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result)
      }
    } else {
      const result = await getSettingStats({ isAdmin, userEmail, userName, startDate, endDate })
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
async function getClosingStats({ isAdmin, userEmail, startDate, endDate }) {
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
    const status = (fields.Status || '').toLowerCase()
    const setup = parseFloat(fields.Setup) || 0
    const retainer = parseFloat(fields.Retainer) || 0
    const laufzeit = parseInt(fields.Laufzeit) || 1
    const hinzugefuegt = fields.Hinzugefügt || fields.Hinzugefuegt || fields['Hinzugefügt']
    const closerEmail = fields.Weitere_Teilnehmer || fields['Weitere_Teilnehmer']

    if (hinzugefuegt) {
      const recordDate = new Date(hinzugefuegt)
      if (startDate && recordDate < startDate) continue
      if (endDate && recordDate > endDate) continue
    }

    if (!isAdmin && userEmail && closerEmail) {
      if (!closerEmail.toLowerCase().includes(userEmail.toLowerCase())) continue
    }

    if (status.includes('abgeschlossen') || status.includes('gewonnen')) {
      gewonnen++
      const dealWert = setup + (retainer * laufzeit)
      umsatzGesamt += dealWert

      if (hinzugefuegt) {
        const date = new Date(hinzugefuegt)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (!zeitverlaufMap[monthKey]) {
          zeitverlaufMap[monthKey] = { count: 0, umsatz: 0 }
        }
        zeitverlaufMap[monthKey].count++
        zeitverlaufMap[monthKey].umsatz += dealWert
      }

      if (closerEmail && isAdmin) {
        if (!perUserMap[closerEmail]) {
          perUserMap[closerEmail] = { gewonnen: 0, verloren: 0, offen: 0, umsatz: 0 }
        }
        perUserMap[closerEmail].gewonnen++
        perUserMap[closerEmail].umsatz += dealWert
      }
    } else if (status.includes('verloren')) {
      verloren++
      if (closerEmail && isAdmin) {
        if (!perUserMap[closerEmail]) {
          perUserMap[closerEmail] = { gewonnen: 0, verloren: 0, offen: 0, umsatz: 0 }
        }
        perUserMap[closerEmail].verloren++
      }
    } else if (status.includes('no-show') || status.includes('no show')) {
      noShow++
    } else {
      offen++
      if (closerEmail && isAdmin) {
        if (!perUserMap[closerEmail]) {
          perUserMap[closerEmail] = { gewonnen: 0, verloren: 0, offen: 0, umsatz: 0 }
        }
        perUserMap[closerEmail].offen++
      }
    }
  }

  const totalEntschieden = gewonnen + verloren
  const closingQuote = totalEntschieden > 0 ? (gewonnen / totalEntschieden) * 100 : 0

  const zeitverlauf = formatZeitverlauf(zeitverlaufMap)

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
async function getSettingStats({ isAdmin, userEmail, userName, startDate, endDate }) {
  const tableName = 'Immobilienmakler_Leads'
  
  // User Record ID holen wenn nicht Admin
  let userRecordId = null
  if (!isAdmin && userName) {
    userRecordId = await getUserRecordId(userName)
    console.log('User Record ID für', userName, ':', userRecordId)
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
  let erstgespraech = 0
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
    const datum = fields.Datum
    
    // KORREKTUR: Das Feld heißt "User_Datenbank", nicht "Zugewiesen an"
    const zugewiesenAn = fields['User_Datenbank'] || fields.User_Datenbank || []

    // Datum-Filter
    if (datum) {
      const recordDate = new Date(datum)
      if (startDate && recordDate < startDate) continue
      if (endDate && recordDate > endDate) continue
    }

    // User-Filter: Prüfen ob der User zugewiesen ist
    if (!isAdmin && userRecordId) {
      const assignedIds = Array.isArray(zugewiesenAn) ? zugewiesenAn : [zugewiesenAn]
      if (!assignedIds.includes(userRecordId)) continue
    }

    einwahlen++

    // Ergebnis kategorisieren
    if (ergebnis.includes('nicht erreicht')) {
      nichtErreicht++
    } else {
      erreicht++
      
      if (ergebnis.includes('erstgespräch') || ergebnis.includes('erstgespraech') || ergebnis.includes('termin')) {
        erstgespraech++
      } else if (ergebnis.includes('unterlage')) {
        unterlagen++
      } else if (ergebnis.includes('kein interesse') || ergebnis.includes('absage')) {
        keinInteresse++
      }
    }

    // Zeitverlauf
    if (datum) {
      const date = new Date(datum)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
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
          erstgespraech: 0 
        }
      }
      perUserMap[oderId].einwahlen++
      if (!ergebnis.includes('nicht erreicht')) {
        perUserMap[oderId].erreicht++
        if (ergebnis.includes('erstgespräch') || ergebnis.includes('erstgespraech') || ergebnis.includes('termin')) {
          perUserMap[oderId].erstgespraech++
        }
      }
    }
  }

  // Quoten berechnen
  const erreichQuote = einwahlen > 0 ? (erreicht / einwahlen) * 100 : 0
  const erstgespraechQuote = erreicht > 0 ? (erstgespraech / erreicht) * 100 : 0
  const unterlagenQuote = erreicht > 0 ? (unterlagen / erreicht) * 100 : 0

  const zeitverlauf = formatZeitverlauf(zeitverlaufMap)

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
      erstgespraech,
      unterlagen,
      keinInteresse,
      nichtErreicht,
      erreichQuote,
      erstgespraechQuote,
      unterlagenQuote
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

function formatZeitverlauf(map) {
  const result = []
  const now = new Date()
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
    
    result.push({
      month: monthKey,
      label,
      count: map[monthKey]?.count || 0,
      umsatz: map[monthKey]?.umsatz || 0
    })
  }
  
  return result
}

function extractNameFromEmail(email) {
  if (!email) return 'Unbekannt'
  
  const local = email.split('@')[0]
  const parts = local.split(/[._-]/)
  
  return parts.map(part => 
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join(' ')
}
