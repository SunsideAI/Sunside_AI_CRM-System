// Billing-Dashboard API für Finanzen-Seite (nur Geschäftsführer)
// GET: Liest KPIs, aktive Verträge und alle Rechnungen

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  // Auth-Check: nur Geschäftsführer
  const userId = event.queryStringParameters?.user_id
  if (!userId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'User ID required' })
    }
  }

  const { data: authUser } = await supabase
    .from('users')
    .select('rollen')
    .eq('id', userId)
    .maybeSingle()

  if (!authUser || !authUser.rollen?.includes('Geschäftsführer')) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Forbidden — Geschäftsführer only' })
    }
  }

  try {
    // Parallel laden: Contracts mit Lead-Info, Invoices mit Lead-Info
    const [contractsRes, invoicesRes] = await Promise.all([
      supabase
        .from('billing_recurring')
        .select(`
          id, hot_lead_id, produkt, monthly_net_amount, tax_rate,
          start_date, end_date, next_invoice_date, status, created_at,
          hot_leads!inner(unternehmen)
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('billing_invoices')
        .select(`
          id, hot_lead_id, lexware_voucher_number, lexware_invoice_id,
          invoice_type, net_amount, gross_amount,
          voucher_date, due_date, status, paid_at,
          hot_leads!inner(unternehmen)
        `)
        .order('voucher_date', { ascending: false })
        .limit(100)
    ])

    if (contractsRes.error) {
      console.error('[billing-dashboard] Contracts error:', contractsRes.error)
    }
    if (invoicesRes.error) {
      console.error('[billing-dashboard] Invoices error:', invoicesRes.error)
    }

    const contracts = (contractsRes.data || []).map(c => ({
      ...c,
      unternehmen: c.hot_leads?.unternehmen || '–',
      monthly_gross_amount: Number((c.monthly_net_amount * (1 + (c.tax_rate || 19) / 100)).toFixed(2))
    }))

    const invoices = (invoicesRes.data || []).map(inv => {
      let daysOpen = null
      if (inv.paid_at && inv.voucher_date) {
        daysOpen = Math.floor((new Date(inv.paid_at) - new Date(inv.voucher_date)) / 86400000)
      } else if (['open', 'overdue', 'pending'].includes(inv.status)) {
        daysOpen = Math.floor((new Date() - new Date(inv.voucher_date)) / 86400000)
      }
      return {
        ...inv,
        unternehmen: inv.hot_leads?.unternehmen || '–',
        days_open: daysOpen
      }
    })

    // KPIs berechnen
    const activeContracts = contracts.filter(c => c.status === 'active')
    const mrrNet = activeContracts.reduce((sum, c) => sum + Number(c.monthly_net_amount || 0), 0)
    const mrrGross = activeContracts.reduce((sum, c) => sum + Number(c.monthly_gross_amount || 0), 0)
    const aktiveKunden = new Set(activeContracts.map(c => c.hot_lead_id)).size

    const openInvoices = invoices.filter(i => ['open', 'overdue'].includes(i.status))
    const offenerBetrag = openInvoices.reduce((sum, i) => sum + Number(i.gross_amount || 0), 0)
    const ueberfaelligCount = invoices.filter(i => i.status === 'overdue').length

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    const paidInvoices = invoices.filter(i => ['paid', 'paidoff'].includes(i.status))
    const umsatzMonat = paidInvoices
      .filter(i => new Date(i.voucher_date) >= startOfMonth)
      .reduce((sum, i) => sum + Number(i.gross_amount || 0), 0)
    const umsatzYtd = paidInvoices
      .filter(i => new Date(i.voucher_date) >= startOfYear)
      .reduce((sum, i) => sum + Number(i.gross_amount || 0), 0)

    // Bezahlte/Gesamt Rechnungen pro Vertrag zählen
    const contractsWithCounts = contracts.map(c => {
      const contractInvoices = invoices.filter(i => i.hot_lead_id === c.hot_lead_id)
      return {
        ...c,
        bezahlte_rechnungen: contractInvoices.filter(i => ['paid', 'paidoff'].includes(i.status)).length,
        gesamt_rechnungen: contractInvoices.length
      }
    })

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        kpis: {
          mrr_net: Number(mrrNet.toFixed(2)),
          mrr_gross: Number(mrrGross.toFixed(2)),
          aktive_kunden: aktiveKunden,
          offene_rechnungen_count: openInvoices.length,
          offener_betrag: Number(offenerBetrag.toFixed(2)),
          ueberfaellig_count: ueberfaelligCount,
          umsatz_monat: Number(umsatzMonat.toFixed(2)),
          umsatz_ytd: Number(umsatzYtd.toFixed(2))
        },
        contracts: contractsWithCounts,
        invoices
      })
    }
  } catch (err) {
    console.error('[billing-dashboard] Error:', err)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    }
  }
}
