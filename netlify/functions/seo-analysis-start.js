import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { hotLeadId, websiteUrl, firmenname } = JSON.parse(event.body)

    if (!hotLeadId || !websiteUrl) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'hotLeadId and websiteUrl required' })
      }
    }

    // Call external SEO tool - it will callback with the PDF when done
    const callbackUrl = `${process.env.CRM_PUBLIC_URL}/.netlify/functions/seo-analysis-callback`

    const response = await fetch(process.env.SEO_TOOL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SEO_TOOL_API_KEY}`
      },
      body: JSON.stringify({
        url: websiteUrl,
        callback_url: callbackUrl,
        reference_id: hotLeadId,
        company_name: firmenname || 'Unbekannt'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SEO Tool Error:', response.status, errorText)
      throw new Error(`SEO Tool Error: ${response.status}`)
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: 'SEO-Analyse gestartet' })
    }
  } catch (error) {
    console.error('SEO Analysis Start Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}
