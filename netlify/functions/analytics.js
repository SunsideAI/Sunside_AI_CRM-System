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
    const type = params.type || 'setting' // 'setting' oder 'closing'
    const isAdmin = params.admin === 'true'
    const userEmail = params.email
    const startDate = params.startDate
    const endDate = params.endDate

    if (type === 'closing') {
      const result = await getClosingStats({ isAdmin, userEmail, startDate, endDate })
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result)
      }
    } else {
      const result = await getSettingStats({ isAdmin, userEmail, startDate, endDate })
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
async function getClosingStats({ isAdmin, userEmail, startDate, endDate }) {
  const tableName = 'Immobilienmakler_Hot_Leads'
  
  // Filter bauen
  let filterParts = []
  
  if (!isAdmin && userEmail) {
    filterParts.push(`FIND("${userEmail}", {Weitere_Teilnehmer})`)
  }
  
  if (startDate) {
    filterParts.push(`IS_AFTER({Hinzugefügt}, "${startDate}")`)
  }
  
  if (endDate) {
    filterParts.push(`IS_BEFORE({Hinzugefügt}, "${endDate}")`)
  }

  const filterFormula = filterParts.length > 0 
    ? `AND(${filterParts.join(', ')})` 
    : ''

  // Alle Hot Leads laden
  let allRecords = []
  let offset = null

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`)
    if (filterFormula) {
      url.searchParams.append('filterByFormula', filterFormula)
    }
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
    const hinzugefuegt = fields.Hinzugefügt || fields.Hinzugefuegt
    const closerEmail = fields.Weitere_Teilnehmer

    // Status zählen
    if (status.includes('abgeschlossen') || status.includes('gewonnen')) {
      gewonnen++
      const dealWert = setup + (retainer * laufzeit)
      umsatzGesamt += dealWert

      // Zeitverlauf (nur für gewonnene)
      if (hinzugefuegt) {
        const date = new Date(hinzugefuegt)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (!zeitverlaufMap[monthKey]) {
          zeitverlaufMap[monthKey] = { count: 0, umsatz: 0 }
        }
        zeitverlaufMap[monthKey].count++
        zeitverlaufMap[monthKey].umsatz += dealWert
      }

      // Per User Stats
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

  // Closing Quote berechnen
  const totalEntschieden = gewonnen + verloren
  const closingQuote = totalEntschieden > 0 ? (gewonnen / totalEntschieden) * 100 : 0

  // Zeitverlauf formatieren (letzte 6 Monate)
  const zeitverlauf = formatZeitverlauf(zeitverlaufMap)

  // Per User formatieren
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
async function getSettingStats({ isAdmin, userEmail, startDate, endDate }) {
  const tableName = 'Immobilienmakler_Leads'
  
  // Filter: Nur kontaktierte Leads
  let filterParts = ['{Bereits kontaktiert} = TRUE()']
  
  if (startDate) {
    filterParts.push(`IS_AFTER({Datum}, "${startDate}")`)
  }
  
  if (endDate) {
    filterParts.push(`IS_BEFORE({Datum}, "${endDate}")`)
  }

  const filterFormula = `AND(${filterParts.join(', ')})`

  // Alle kontaktierten Leads laden
  let allRecords = []
  let offset = null

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`)
    url.searchParams.append('filterByFormula', filterFormula)
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
    const ergebnis = (fields.Ergebnis || '').toLowerCase()
    const datum = fields.Datum
    const zugewiesenAn = fields.Zugewiesen_an || fields['Zugewiesen an'] || []

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
      const oderId = zugewiesenAn[0] // Erster zugewiesener User
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

  // Zeitverlauf formatieren
  const zeitverlauf = formatZeitverlauf(zeitverlaufMap)

  // Per User formatieren
  const perUser = Object.values(perUserMap).map(stats => ({
    ...stats,
    name: `User ${stats.id.substring(0, 6)}`
  })).sort((a, b) => b.einwahlen - a.einwahlen)

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
    perUser: isAdmin ? perUser : []
  }
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
