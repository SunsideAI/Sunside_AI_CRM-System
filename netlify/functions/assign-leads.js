// Admin-Funktion: Leads einem User zuweisen
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
    // GET: Zeige aktuelle Zuordnungen
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const { userId } = params

      // Alle User mit Anzahl ihrer Assignments
      const { data: users } = await supabase
        .from('users')
        .select('id, vor_nachname, email')
        .order('vor_nachname')

      // Zähle Assignments pro User
      const { data: assignments } = await supabase
        .from('lead_assignments')
        .select('user_id')

      const assignmentCounts = {}
      assignments?.forEach(a => {
        assignmentCounts[a.user_id] = (assignmentCounts[a.user_id] || 0) + 1
      })

      const usersWithCounts = users?.map(u => ({
        ...u,
        assignmentCount: assignmentCounts[u.id] || 0
      }))

      // Falls userId angegeben, zeige dessen Leads
      let userLeads = []
      if (userId) {
        const { data: userAssignments } = await supabase
          .from('lead_assignments')
          .select('lead_id, leads(id, unternehmensname)')
          .eq('user_id', userId)
          .limit(20)

        userLeads = userAssignments?.map(a => ({
          leadId: a.lead_id,
          unternehmen: a.leads?.unternehmensname
        })) || []
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          users: usersWithCounts,
          userLeads,
          totalAssignments: assignments?.length || 0
        }, null, 2)
      }
    }

    // POST: Weise Leads zu
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body)
      const { userId, leadIds, assignAll, limit } = body

      if (!userId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'userId ist erforderlich' })
        }
      }

      // Prüfe ob User existiert
      const { data: user } = await supabase
        .from('users')
        .select('id, vor_nachname')
        .eq('id', userId)
        .single()

      if (!user) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'User nicht gefunden' })
        }
      }

      let leadsToAssign = []

      if (assignAll) {
        // Alle Leads ohne Zuweisung finden
        const { data: allLeads } = await supabase
          .from('leads')
          .select('id')
          .limit(limit || 100)

        const { data: existingAssignments } = await supabase
          .from('lead_assignments')
          .select('lead_id')

        const assignedLeadIds = new Set(existingAssignments?.map(a => a.lead_id) || [])
        leadsToAssign = allLeads?.filter(l => !assignedLeadIds.has(l.id)).map(l => l.id) || []
      } else if (leadIds && leadIds.length > 0) {
        leadsToAssign = leadIds
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'leadIds oder assignAll erforderlich' })
        }
      }

      if (leadsToAssign.length === 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Keine Leads zum Zuweisen', assigned: 0 })
        }
      }

      // Erstelle Assignments
      const newAssignments = leadsToAssign.map(leadId => ({
        lead_id: leadId,
        user_id: userId
      }))

      const { error } = await supabase
        .from('lead_assignments')
        .upsert(newAssignments, { onConflict: 'lead_id,user_id' })

      if (error) {
        throw new Error(error.message)
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `${leadsToAssign.length} Leads an ${user.vor_nachname} zugewiesen`,
          assigned: leadsToAssign.length
        })
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    }
  }
}
