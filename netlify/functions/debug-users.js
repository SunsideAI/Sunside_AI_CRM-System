// Debug: Prüft User-ID Konsistenz zwischen users und lead_assignments
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  try {
    // 1. Alle User laden
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, vor_nachname, email, email_geschaeftlich')
      .order('vor_nachname')

    // 2. Alle einzigartigen user_ids aus lead_assignments
    const { data: assignments } = await supabase
      .from('lead_assignments')
      .select('user_id')

    const assignmentUserIds = [...new Set((assignments || []).map(a => a.user_id))]

    // 3. Prüfen welche User Assignments haben
    const usersWithAssignments = []
    const usersWithoutAssignments = []
    const orphanedAssignmentUserIds = []

    for (const user of allUsers || []) {
      const hasAssignments = assignmentUserIds.includes(user.id)
      if (hasAssignments) {
        // Zähle Assignments
        const count = (assignments || []).filter(a => a.user_id === user.id).length
        usersWithAssignments.push({ ...user, assignmentCount: count })
      } else {
        usersWithoutAssignments.push(user)
      }
    }

    // 4. Finde Assignment user_ids die keinem User zugeordnet sind
    const allUserIds = (allUsers || []).map(u => u.id)
    for (const assignUserId of assignmentUserIds) {
      if (!allUserIds.includes(assignUserId)) {
        orphanedAssignmentUserIds.push(assignUserId)
      }
    }

    // 5. Finde Duplikate (gleicher Name, verschiedene IDs)
    const nameGroups = {}
    for (const user of allUsers || []) {
      const name = user.vor_nachname || 'Unbekannt'
      if (!nameGroups[name]) nameGroups[name] = []
      nameGroups[name].push(user)
    }
    const duplicates = Object.entries(nameGroups)
      .filter(([name, users]) => users.length > 1)
      .map(([name, users]) => ({ name, users }))

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        summary: {
          totalUsers: allUsers?.length || 0,
          totalAssignments: assignments?.length || 0,
          uniqueUserIdsInAssignments: assignmentUserIds.length,
          usersWithAssignments: usersWithAssignments.length,
          usersWithoutAssignments: usersWithoutAssignments.length,
          orphanedAssignmentUserIds: orphanedAssignmentUserIds.length,
          duplicateNames: duplicates.length
        },
        duplicates,
        orphanedAssignmentUserIds,
        usersWithAssignments,
        usersWithoutAssignments
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
