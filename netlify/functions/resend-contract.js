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

    // User-Daten unverändert an Zapier weiterleiten
    const response = await fetch('https://hooks.zapier.com/hooks/catch/21938164/ujr7e9w/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...user,
        timestamp: new Date().toISOString()
      })
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
