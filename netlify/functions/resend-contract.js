// Vertrag erneut senden - Proxy zu Zapier Webhook
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
    const userData = JSON.parse(event.body)

    // Zapier Webhook aufrufen
    const response = await fetch('https://hooks.zapier.com/hooks/catch/21938164/ujr7e9w/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    })

    if (!response.ok) {
      throw new Error(`Zapier returned ${response.status}`)
    }

    console.log('Contract resend webhook triggered for:', userData.name)

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
