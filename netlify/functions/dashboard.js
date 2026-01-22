// Dashboard Analytics API - Statistiken für das Dashboard
import { fetchWithRetry } from './utils/airtable.js'

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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
  const LEADS_TABLE = 'Immobilienmakler_Leads'
  const USERS_TABLE = 'User_Datenbank'

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server nicht konfiguriert' })
    }
  }

  try {
    const params = event.queryStringParameters || {}
    const { userName, userRole } = params

    // User-Map laden
    const usersUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(USERS_TABLE)}?fields[]=Vor_Nachname&fields[]=Rolle`
    const usersResponse = await fetchWithRetry(usersUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
    })
    const usersData = await usersResponse.json()
    
    const userMap = {}
    usersData.records.forEach(record => {
      userMap[record.id] = {
        name: record.fields.Vor_Nachname || 'Unbekannt',
        rolle: record.fields.Rolle || []
      }
    })

    // Alle Leads laden (mit Pagination)
    let allLeads = []
    let offset = null
    
    do {
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(LEADS_TABLE)}?pageSize=100`
      url += `&fields[]=Bereits_kontaktiert&fields[]=Ergebnis&fields[]=User_Datenbank&fields[]=Datum`
      
      if (offset) {
        url += `&offset=${offset}`
      }

      const response = await fetchWithRetry(url, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
      })
      
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Leads')
      }

      const data = await response.json()
      allLeads = allLeads.concat(data.records)
      offset = data.offset
    } while (offset)

    // Statistiken berechnen
    const stats = {
      gesamt: allLeads.length,
      kontaktiert: 0,
      nichtKontaktiert: 0,
      ergebnisse: {
        'Nicht erreicht': 0,
        'Kein Interesse': 0,
        'Beratungsgespräch': 0,
        'Unterlage bereitstellen': 0,
        'Kein Ergebnis': 0
      },
      proVertriebler: {},
      dieseWoche: 0,
      diesenMonat: 0
    }

    // Datum-Helper
    const heute = new Date()
    const startOfToday = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate())
    
    const startOfWeek = new Date(heute)
    startOfWeek.setDate(heute.getDate() - heute.getDay() + 1) // Montag
    startOfWeek.setHours(0, 0, 0, 0)
    
    const startOfMonth = new Date(heute.getFullYear(), heute.getMonth(), 1)

    // Stats für aktuellen User
    let userHeute = 0
    let userWoche = 0

    // Leads durchgehen
    allLeads.forEach(record => {
      const kontaktiert = record.fields['Bereits_kontaktiert'] === 'X'
      const ergebnis = record.fields.Ergebnis || ''
      const userIds = record.fields.User_Datenbank || []
      const datum = record.fields.Datum ? new Date(record.fields.Datum) : null

      // Prüfen ob Lead diesem User zugewiesen ist
      const userNames = userIds.map(id => userMap[id]?.name || '')
      const isUserLead = userName && userNames.includes(userName)

      // Kontaktiert zählen
      if (kontaktiert) {
        stats.kontaktiert++
        
        // Diese Woche / Monat (global)
        if (datum) {
          if (datum >= startOfWeek) stats.dieseWoche++
          if (datum >= startOfMonth) stats.diesenMonat++
          
          // User-spezifisch
          if (isUserLead) {
            if (datum >= startOfToday) userHeute++
            if (datum >= startOfWeek && ergebnis === 'Beratungsgespräch') userWoche++
          }
        }
      } else {
        stats.nichtKontaktiert++
      }

      // Ergebnisse zählen
      if (ergebnis && stats.ergebnisse.hasOwnProperty(ergebnis)) {
        stats.ergebnisse[ergebnis]++
      } else if (kontaktiert && !ergebnis) {
        stats.ergebnisse['Kein Ergebnis']++
      }

      // Pro Vertriebler
      userIds.forEach(userId => {
        const userName = userMap[userId]?.name || userId
        if (!stats.proVertriebler[userName]) {
          stats.proVertriebler[userName] = { gesamt: 0, kontaktiert: 0, beratungsgespraech: 0 }
        }
        stats.proVertriebler[userName].gesamt++
        if (kontaktiert) stats.proVertriebler[userName].kontaktiert++
        if (ergebnis === 'Beratungsgespräch') stats.proVertriebler[userName].beratungsgespraech++
      })
    })

    // Vertriebler als Array sortiert nach kontaktiert
    const vertrieblerArray = Object.entries(stats.proVertriebler)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.kontaktiert - a.kontaktiert)

    // Conversion Rate berechnen
    const conversionRate = stats.kontaktiert > 0 
      ? ((stats.ergebnisse['Beratungsgespräch'] / stats.kontaktiert) * 100).toFixed(1)
      : 0

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        gesamt: stats.gesamt,
        kontaktiert: stats.kontaktiert,
        nichtKontaktiert: stats.nichtKontaktiert,
        dieseWoche: stats.dieseWoche,
        diesenMonat: stats.diesenMonat,
        heute: userHeute,
        termineWoche: userWoche,
        ergebnisse: stats.ergebnisse,
        vertriebler: vertrieblerArray,
        conversionRate: parseFloat(conversionRate)
      })
    }

  } catch (error) {
    console.error('Dashboard Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    }
  }
}
