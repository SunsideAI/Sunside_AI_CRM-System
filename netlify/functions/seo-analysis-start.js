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

    // Env-Var-Check: bricht früh mit klarer Message ab wenn eine Variable fehlt
    const missing = ['SEO_TOOL_URL', 'SEO_TOOL_API_KEY', 'CRM_PUBLIC_URL']
      .filter(name => !process.env[name])
    if (missing.length > 0) {
      console.error('SEO Analysis: fehlende Env-Vars:', missing)
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'seo_env_missing',
          message: `Fehlende Netlify Env-Variablen: ${missing.join(', ')}. Bitte im Netlify Dashboard prüfen.`,
          missing
        })
      }
    }

    // Call SEO Tool API - correct endpoint: /api/v1/reports/generate
    const callbackUrl = `${process.env.CRM_PUBLIC_URL}/.netlify/functions/seo-analysis-callback`
    const seoToolUrl = `${process.env.SEO_TOOL_URL}/api/v1/reports/generate`

    console.log('Calling SEO Tool:', seoToolUrl, 'for lead:', hotLeadId)

    let response
    try {
      response = await fetch(seoToolUrl, {
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
    } catch (fetchErr) {
      // Netzwerk-Fehler (DNS, Timeout, Zertifikat, Railway offline)
      console.error('SEO Tool Fetch Error:', fetchErr.message)
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'seo_tool_unreachable',
          message: `SEO-Tool auf ${seoToolUrl} nicht erreichbar: ${fetchErr.message}`,
          url: seoToolUrl
        })
      }
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SEO Tool Error:', response.status, errorText)
      // Echten Fehler-Body an Frontend durchreichen statt zu verschlucken
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'seo_tool_error',
          message: `SEO-Tool antwortete mit ${response.status}: ${errorText.slice(0, 500)}`,
          upstreamStatus: response.status,
          upstreamBody: errorText.slice(0, 2000)
        })
      }
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
      body: JSON.stringify({
        error: 'seo_internal_error',
        message: error.message
      })
    }
  }
}
