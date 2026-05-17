// Billing-Info API für BillingPanel
// GET: Liest billing_recurring, billing_contacts, billing_invoices für einen Lead

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

  const hotLeadId = event.queryStringParameters?.hot_lead_id
  if (!hotLeadId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'hot_lead_id required' })
    }
  }

  try {
    // Parallel: contract, contact, invoices laden
    const [contractRes, contactRes, invoicesRes] = await Promise.all([
      supabase
        .from('billing_recurring')
        .select('*')
        .eq('hot_lead_id', hotLeadId)
        .maybeSingle(),
      supabase
        .from('billing_contacts')
        .select('lexware_contact_id, lexware_customer_number, last_synced_at')
        .eq('hot_lead_id', hotLeadId)
        .maybeSingle(),
      supabase
        .from('billing_invoices')
        .select('*')
        .eq('hot_lead_id', hotLeadId)
        .order('voucher_date', { ascending: false })
    ])

    if (contractRes.error) {
      console.error('[billing-info] Contract error:', contractRes.error)
    }
    if (contactRes.error) {
      console.error('[billing-info] Contact error:', contactRes.error)
    }
    if (invoicesRes.error) {
      console.error('[billing-info] Invoices error:', invoicesRes.error)
    }

    // monthly_gross_amount berechnen (DB hat nur net + tax_rate)
    let contract = contractRes.data
    if (contract) {
      const taxRate = Number(contract.tax_rate || 19)
      const netAmount = Number(contract.monthly_net_amount || 0)
      const grossAmount = netAmount * (1 + taxRate / 100)
      contract = {
        ...contract,
        monthly_gross_amount: Number(grossAmount.toFixed(2))
      }
    }

    // Invoices mit days_open anreichern
    const invoices = (invoicesRes.data || []).map(inv => {
      let daysOpen = null

      if (inv.paid_at && inv.voucher_date) {
        // Bezahlt: Tage zwischen Rechnungsdatum und Zahlung
        daysOpen = Math.floor(
          (new Date(inv.paid_at) - new Date(inv.voucher_date)) / 86400000
        )
      } else if (['open', 'overdue', 'pending'].includes(inv.status)) {
        // Offen: Tage seit Rechnungsdatum
        daysOpen = Math.floor(
          (new Date() - new Date(inv.voucher_date)) / 86400000
        )
      }

      return { ...inv, days_open: daysOpen }
    })

    // KPI-Stats berechnen
    const totalInvoiced = invoices.reduce(
      (sum, i) => sum + Number(i.gross_amount || 0),
      0
    )
    const totalPaid = invoices
      .filter(i => ['paid', 'paidoff'].includes(i.status))
      .reduce((sum, i) => sum + Number(i.gross_amount || 0), 0)
    const totalOutstanding = invoices
      .filter(i => ['open', 'overdue'].includes(i.status))
      .reduce((sum, i) => sum + Number(i.gross_amount || 0), 0)
    const overdueCount = invoices.filter(i => i.status === 'overdue').length

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        contract,
        contact: contactRes.data,
        invoices,
        stats: {
          total_invoiced: Number(totalInvoiced.toFixed(2)),
          total_paid: Number(totalPaid.toFixed(2)),
          total_outstanding: Number(totalOutstanding.toFixed(2)),
          overdue_count: overdueCount
        }
      })
    }
  } catch (err) {
    console.error('[billing-info] Error:', err)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    }
  }
}
