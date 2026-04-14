// Fix: User-ID in lead_assignments aktualisieren
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  try {
    const params = event.queryStringParameters || {}
    const { search, fix, oldUserId, newUserId } = params

    // Alle User laden
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, vor_nachname, email')
      .order('vor_nachname')

    // Alle Assignments mit User-Info laden
    const { data: assignments } = await supabase
      .from('lead_assignments')
      .select('user_id, lead_id')

    // Gruppiere nach user_id
    const assignmentsByUser = {}
    assignments?.forEach(a => {
      if (!assignmentsByUser[a.user_id]) {
        assignmentsByUser[a.user_id] = { count: 0, leadIds: [] }
      }
      assignmentsByUser[a.user_id].count++
      if (assignmentsByUser[a.user_id].leadIds.length < 5) {
        assignmentsByUser[a.user_id].leadIds.push(a.lead_id)
      }
    })

    // User-Map erstellen
    const userMap = {}
    allUsers?.forEach(u => {
      userMap[u.id] = u
    })

    // Zeige alle user_ids mit Assignments und deren Namen
    const assignmentDetails = Object.entries(assignmentsByUser).map(([userId, data]) => {
      const user = userMap[userId]
      return {
        user_id: userId,
        name: user?.vor_nachname || '⚠️ NICHT IN USERS-TABELLE',
        email: user?.email || '-',
        assignmentCount: data.count,
        existsInUsersTable: !!user
      }
    })

    // Filter nach Name wenn search angegeben
    let filtered = assignmentDetails
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = assignmentDetails.filter(a =>
        a.name.toLowerCase().includes(searchLower) ||
        a.user_id.includes(search)
      )
    }

    // Finde alle User mit dem gesuchten Namen (für Duplikat-Erkennung)
    let matchingUsers = []
    if (search) {
      const searchLower = search.toLowerCase()
      matchingUsers = allUsers?.filter(u =>
        u.vor_nachname?.toLowerCase().includes(searchLower)
      ) || []
    }

    // FIX: Aktualisiere user_id in lead_assignments
    if (fix === 'true' && oldUserId && newUserId) {
      // Prüfe ob newUserId existiert
      const newUser = userMap[newUserId]
      if (!newUser) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Neue User-ID existiert nicht in users-Tabelle' })
        }
      }

      // Update alle Assignments von oldUserId zu newUserId
      const { data: updated, error } = await supabase
        .from('lead_assignments')
        .update({ user_id: newUserId })
        .eq('user_id', oldUserId)
        .select()

      if (error) {
        throw new Error(error.message)
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `${updated?.length || 0} Assignments von ${oldUserId} auf ${newUserId} (${newUser.vor_nachname}) aktualisiert`,
          updatedCount: updated?.length || 0
        })
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        info: 'Füge ?search=Paul hinzu um nach Namen zu filtern. Füge ?fix=true&oldUserId=X&newUserId=Y hinzu um IDs zu migrieren.',
        totalAssignments: assignments?.length || 0,
        uniqueUserIds: Object.keys(assignmentsByUser).length,
        matchingUsers: matchingUsers,
        assignmentsFiltered: filtered,
        allAssignmentsByUser: search ? undefined : assignmentDetails
      }, null, 2)
    }

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    }
  }
}
