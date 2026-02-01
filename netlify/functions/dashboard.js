// Dashboard Analytics API - Statistiken für das Dashboard - Supabase Version
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

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

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server nicht konfiguriert' })
    }
  }

  try {
    const params = event.queryStringParameters || {}
    const { userName, userId, userRole } = params

    // User-Map laden für Namen-Auflösung
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, vor_nachname, rollen')

    if (usersError) {
      console.error('Users Error:', usersError)
      throw new Error('Fehler beim Laden der User')
    }

    const userMap = {}
    users.forEach(user => {
      userMap[user.id] = {
        name: user.vor_nachname || 'Unbekannt',
        rolle: user.rollen || []
      }
    })

    // Alle Leads laden
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('id, bereits_kontaktiert, ergebnis, datum')

    if (leadsError) {
      console.error('Leads Error:', leadsError)
      throw new Error('Fehler beim Laden der Leads')
    }

    // Lead Assignments laden
    const { data: assignments, error: assignError } = await supabase
      .from('lead_assignments')
      .select('lead_id, user_id')

    if (assignError) {
      console.error('Assignments Error:', assignError)
    }

    // Assignments zu Map konvertieren (lead_id -> [user_ids])
    const assignmentMap = {}
    if (assignments) {
      assignments.forEach(a => {
        if (!assignmentMap[a.lead_id]) {
          assignmentMap[a.lead_id] = []
        }
        assignmentMap[a.lead_id].push(a.user_id)
      })
    }

    // Statistiken berechnen
    const stats = {
      gesamt: leadsData.length,
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
    leadsData.forEach(lead => {
      const kontaktiert = lead.bereits_kontaktiert === true
      const ergebnis = lead.ergebnis || ''
      const userIds = assignmentMap[lead.id] || []
      const datum = lead.datum ? new Date(lead.datum) : null

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
        const name = userMap[userId]?.name || userId
        if (!stats.proVertriebler[name]) {
          stats.proVertriebler[name] = { gesamt: 0, kontaktiert: 0, beratungsgespraech: 0 }
        }
        stats.proVertriebler[name].gesamt++
        if (kontaktiert) stats.proVertriebler[name].kontaktiert++
        if (ergebnis === 'Beratungsgespräch') stats.proVertriebler[name].beratungsgespraech++
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
