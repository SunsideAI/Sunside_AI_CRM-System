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
    const { hotLeadId, websiteUrl, firmenname, stadt } = JSON.parse(event.body)

    if (!hotLeadId || !websiteUrl) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'hotLeadId and websiteUrl required' })
      }
    }

    // Call SEO Tool API - correct endpoint: /api/v1/reports/generate
    const callbackUrl = `${process.env.CRM_PUBLIC_URL}/.netlify/functions/seo-analysis-callback`
    const seoToolUrl = `${process.env.SEO_TOOL_URL}/api/v1/reports/generate`

    console.log('Calling SEO Tool:', seoToolUrl, 'for lead:', hotLeadId)

    const response = await fetch(seoToolUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.SEO_TOOL_API_KEY
      },
      body: JSON.stringify({
        maklername: firmenname || 'Unbekannt',
        website_url: websiteUrl,
        stadt: stadt || '',
        plz: '',
        nur_fakten: true,
        custom_crm_deal_id: hotLeadId,
        callback_url: callbackUrl
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SEO Tool Error:', response.status, errorText)
      throw new Error(`SEO Tool Error: ${response.status}`)
    }

    const result = await response.json()
    console.log('SEO Tool Response:', result)

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'SEO-Analyse gestartet',
        report_id: result.report_id,
        status: result.status
      })
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
