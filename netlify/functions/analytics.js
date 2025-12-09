// Analytics Function - Closing & Setting Statistics
export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server nicht konfiguriert' })
      }
    }

    const params = event.queryStringParameters || {}
    const type = params.type || 'closing' // 'closing' oder 'setting'
    const userEmail = params.email || null // Filter für spezifischen User
    const isAdmin = params.admin === 'true' // Admin sieht alles
    const startDate = params.startDate || null
    const endDate = params.endDate || null

    let stats = {}

    if (type === 'closing') {
      stats = await getClosingStats(AIRTABLE_API_KEY, AIRTABLE_BASE_ID, userEmail, isAdmin, startDate, endDate)
    } else if (type === 'setting') {
      stats = await getSettingStats(AIRTABLE_API_KEY, AIRTABLE_BASE_ID, userEmail, isAdmin, startDate, endDate)
    } else if (type === 'combined') {
      const closing = await getClosingStats(AIRTABLE_API_KEY, AIRTABLE_BASE_ID, userEmail, isAdmin, startDate, endDate)
      const setting = await getSettingStats(AIRTABLE_API_KEY, AIRTABLE_BASE_ID, userEmail, isAdmin, startDate, endDate)
      stats = { closing, setting }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(stats)
    }

  } catch (error) {
    console.error('Analytics Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Fehler beim Laden der Analytics' })
    }
  }
}

// Closing Statistics aus Hot_Leads
async function getClosingStats(apiKey, baseId, userEmail, isAdmin, startDate, endDate) {
  const tableName = 'Immobilienmakler_Hot_Leads'
  
  // Alle Hot Leads laden
  let allRecords = []
  let offset = null

  do {
    let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?pageSize=100`
    if (offset) url += `&offset=${offset}`

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })

    if (!response.ok) {
      throw new Error(`Airtable API Error: ${response.status}`)
    }

    const data = await response.json()
    allRecords = allRecords.concat(data.records)
    offset = data.offset
  } while (offset)

  // Filter nach User (wenn nicht Admin)
  let records = allRecords
  if (!isAdmin && userEmail) {
    records = allRecords.filter(r => {
      const teilnehmer = r.fields.Weitere_Teilnehmer || ''
      return teilnehmer.toLowerCase().includes(userEmail.toLowerCase())
    })
  }

  // Filter nach Datum
  if (startDate || endDate) {
    records = records.filter(r => {
      const recordDate = r.fields.Hinzugefügt || r.fields['Kunde seit']
      if (!recordDate) return true
      const date = new Date(recordDate)
      if (startDate && date < new Date(startDate)) return false
      if (endDate && date > new Date(endDate)) return false
      return true
    })
  }

  // Status-Kategorien
  const gewonnen = records.filter(r => (r.fields.Status || '').includes('Abgeschlossen'))
  const verloren = records.filter(r => r.fields.Status === 'Verloren')
  const noShow = records.filter(r => r.fields.Status === 'No-Show')
  const offen = records.filter(r => r.fields.Status === 'Lead' || r.fields.Status === 'Angebot versendet')

  // Umsatz berechnen
  let umsatzGesamt = 0
  gewonnen.forEach(r => {
    const setup = parseFloat(r.fields.Setup) || 0
    const retainer = parseFloat(r.fields.Retainer) || 0
    const laufzeit = parseFloat(r.fields.Laufzeit) || 12 // Default 12 Monate
    umsatzGesamt += setup + (retainer * laufzeit)
  })

  const umsatzDurchschnitt = gewonnen.length > 0 ? umsatzGesamt / gewonnen.length : 0

  // Closing Quote
  const totalEntschieden = gewonnen.length + verloren.length
  const closingQuote = totalEntschieden > 0 ? (gewonnen.length / totalEntschieden) * 100 : 0

  // Zeitverlauf (letzten 6 Monate)
  const zeitverlauf = getZeitverlauf(gewonnen, 'Kunde seit')

  // Pro Closer Statistik (für Admins)
  const perCloser = isAdmin ? getPerUserStats(allRecords, 'Weitere_Teilnehmer') : null

  return {
    summary: {
      gewonnen: gewonnen.length,
      verloren: verloren.length,
      noShow: noShow.length,
      offen: offen.length,
      closingQuote: Math.round(closingQuote * 10) / 10,
      umsatzGesamt: Math.round(umsatzGesamt * 100) / 100,
      umsatzDurchschnitt: Math.round(umsatzDurchschnitt * 100) / 100
    },
    zeitverlauf,
    perUser: perCloser
  }
}

// Setting Statistics aus Immobilienmakler_Leads
async function getSettingStats(apiKey, baseId, userEmail, isAdmin, startDate, endDate) {
  const tableName = 'Immobilienmakler_Leads'
  
  // Gefilterte Leads laden (nur kontaktierte)
  let formula = '{Bereits kontaktiert}=TRUE()'
  
  // User-Filter
  if (!isAdmin && userEmail) {
    // Annahme: User_Datenbank ist verknüpft oder Vertriebler-Feld
    formula = `AND({Bereits kontaktiert}=TRUE())`
  }

  let allRecords = []
  let offset = null

  do {
    let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?pageSize=100`
    url += `&filterByFormula=${encodeURIComponent(formula)}`
    if (offset) url += `&offset=${offset}`

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })

    if (!response.ok) {
      throw new Error(`Airtable API Error: ${response.status}`)
    }

    const data = await response.json()
    allRecords = allRecords.concat(data.records)
    offset = data.offset
  } while (offset)

  // Filter nach Datum
  let records = allRecords
  if (startDate || endDate) {
    records = records.filter(r => {
      const recordDate = r.fields.Datum
      if (!recordDate) return true
      const date = new Date(recordDate)
      if (startDate && date < new Date(startDate)) return false
      if (endDate && date > new Date(endDate)) return false
      return true
    })
  }

  // Ergebnis-Kategorien basierend auf dem Ergebnis-Feld
  const einwahlen = records.length
  const erreicht = records.filter(r => {
    const ergebnis = (r.fields.Ergebnis || '').toLowerCase()
    return !ergebnis.includes('nicht erreicht') && ergebnis !== ''
  }).length

  const erstgespraech = records.filter(r => {
    const ergebnis = (r.fields.Ergebnis || '').toLowerCase()
    return ergebnis.includes('erstgespräch') || ergebnis.includes('termin')
  }).length

  const unterlagen = records.filter(r => {
    const ergebnis = (r.fields.Ergebnis || '').toLowerCase()
    return ergebnis.includes('unterlagen')
  }).length

  const keinInteresse = records.filter(r => {
    const ergebnis = (r.fields.Ergebnis || '').toLowerCase()
    return ergebnis.includes('kein interesse') || ergebnis.includes('absage')
  }).length

  const nichtErreicht = records.filter(r => {
    const ergebnis = (r.fields.Ergebnis || '').toLowerCase()
    return ergebnis.includes('nicht erreicht')
  }).length

  // Quoten berechnen
  const erreichQuote = einwahlen > 0 ? (erreicht / einwahlen) * 100 : 0
  const erstgespraechQuote = erreicht > 0 ? (erstgespraech / erreicht) * 100 : 0
  const unterlagenQuote = erreicht > 0 ? (unterlagen / erreicht) * 100 : 0

  // Zeitverlauf
  const zeitverlauf = getZeitverlauf(records, 'Datum')

  // Pro Setter Statistik (für Admins)
  const perSetter = isAdmin ? getPerUserStatsFromLink(allRecords) : null

  return {
    summary: {
      einwahlen,
      erreicht,
      erstgespraech,
      unterlagen,
      keinInteresse,
      nichtErreicht,
      erreichQuote: Math.round(erreichQuote * 10) / 10,
      erstgespraechQuote: Math.round(erstgespraechQuote * 10) / 10,
      unterlagenQuote: Math.round(unterlagenQuote * 10) / 10
    },
    zeitverlauf,
    perUser: perSetter
  }
}

// Hilfsfunktion: Zeitverlauf berechnen (letzte 6 Monate)
function getZeitverlauf(records, dateField) {
  const months = {}
  const now = new Date()

  // Letzte 6 Monate initialisieren
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months[key] = { count: 0, umsatz: 0 }
  }

  records.forEach(r => {
    const dateValue = r.fields[dateField]
    if (!dateValue) return

    const date = new Date(dateValue)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (months[key]) {
      months[key].count++
      const setup = parseFloat(r.fields.Setup) || 0
      const retainer = parseFloat(r.fields.Retainer) || 0
      const laufzeit = parseFloat(r.fields.Laufzeit) || 12
      months[key].umsatz += setup + (retainer * laufzeit)
    }
  })

  return Object.entries(months).map(([month, data]) => ({
    month,
    label: formatMonthLabel(month),
    count: data.count,
    umsatz: Math.round(data.umsatz * 100) / 100
  }))
}

// Hilfsfunktion: Per User Stats (für Admins) - aus E-Mail Feld
function getPerUserStats(records, emailField) {
  const userStats = {}

  records.forEach(r => {
    const email = r.fields[emailField] || 'Nicht zugewiesen'
    const userKey = email.toLowerCase().trim()
    
    if (!userStats[userKey]) {
      userStats[userKey] = {
        email: email,
        name: extractNameFromEmail(email),
        gewonnen: 0,
        verloren: 0,
        offen: 0,
        umsatz: 0
      }
    }

    const status = r.fields.Status || ''
    if (status.includes('Abgeschlossen')) {
      userStats[userKey].gewonnen++
      const setup = parseFloat(r.fields.Setup) || 0
      const retainer = parseFloat(r.fields.Retainer) || 0
      const laufzeit = parseFloat(r.fields.Laufzeit) || 12
      userStats[userKey].umsatz += setup + (retainer * laufzeit)
    } else if (status === 'Verloren') {
      userStats[userKey].verloren++
    } else {
      userStats[userKey].offen++
    }
  })

  return Object.values(userStats)
    .filter(u => u.email !== 'Nicht zugewiesen')
    .sort((a, b) => b.umsatz - a.umsatz)
}

// Hilfsfunktion: Per User Stats aus Link-Feld
function getPerUserStatsFromLink(records) {
  const userStats = {}

  records.forEach(r => {
    // User_Datenbank ist ein Link-Feld, kommt als Array
    const userLinks = r.fields.User_Datenbank || []
    const userId = userLinks[0] || 'Nicht zugewiesen'
    
    if (!userStats[userId]) {
      userStats[userId] = {
        id: userId,
        einwahlen: 0,
        erreicht: 0,
        erstgespraech: 0
      }
    }

    userStats[userId].einwahlen++
    
    const ergebnis = (r.fields.Ergebnis || '').toLowerCase()
    if (!ergebnis.includes('nicht erreicht')) {
      userStats[userId].erreicht++
    }
    if (ergebnis.includes('erstgespräch') || ergebnis.includes('termin')) {
      userStats[userId].erstgespraech++
    }
  })

  return Object.values(userStats)
    .filter(u => u.id !== 'Nicht zugewiesen')
    .sort((a, b) => b.einwahlen - a.einwahlen)
}

// Hilfsfunktion: Name aus E-Mail extrahieren
function extractNameFromEmail(email) {
  if (!email || !email.includes('@')) return email
  const localPart = email.split('@')[0]
  return localPart
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

// Hilfsfunktion: Monat formatieren
function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-')
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`
}
