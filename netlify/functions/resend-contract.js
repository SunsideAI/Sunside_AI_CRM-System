// Vertrag erneut senden - Holt User-Daten aus Supabase und sendet an Zapier
// READ-ONLY: Modifiziert keine Daten, nur Lesen + Forward an Zapier
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { userId } = JSON.parse(event.body)

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId fehlt' })
      }
    }

    // Frische User-Daten aus Supabase lesen (READ-ONLY)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      console.error('User load error:', userError)
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User nicht gefunden' })
      }
    }

    // User-Daten explizit für Zapier formatieren
    const zapierPayload = {
      id: user.id,
      vorname: user.vorname || '',
      nachname: user.nachname || '',
      vor_nachname: user.vor_nachname || '',
      email: user.email || '',
      email_geschaeftlich: user.email_geschaeftlich || '',
      telefon: user.telefon || '',
      strasse: user.strasse || '',
      plz: user.plz || '',
      ort: user.ort || '',
      bundesland: user.bundesland || '',
      rollen: Array.isArray(user.rollen) ? user.rollen.join(', ') : '',
      status: user.status ? 'aktiv' : 'inaktiv',
      onboarding: user.onboarding ? 'ja' : 'nein',
      google_calendar_id: user.google_calendar_id || '',
      airtable_id: user.airtable_id || '',
      created_at: user.created_at || '',
      updated_at: user.updated_at || '',
      timestamp: new Date().toISOString()
    }

    console.log('Sending to Zapier:', JSON.stringify(zapierPayload, null, 2))

    const response = await fetch('https://hooks.zapier.com/hooks/catch/21938164/ujr7e9w/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zapierPayload)
    })

    if (!response.ok) {
      throw new Error(`Zapier returned ${response.status}`)
    }

    console.log('Contract resend webhook triggered for:', user.vor_nachname)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Vertrag wird versendet' })
    }

  } catch (error) {
    console.error('Resend contract error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    }
  }
}
