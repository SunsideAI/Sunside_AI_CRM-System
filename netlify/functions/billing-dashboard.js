// Billing-Dashboard API für Finanzen-Seite (nur Geschäftsführer)
// GET: Liest KPIs, aktive Verträge, Rechnungen und Analytics-Daten

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

function getWeekNumber(d) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7)
  const week1 = new Date(date.getFullYear(), 0, 4)
  return Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7) + 1
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
        .limit(200)
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

    const now = new Date()

    // === KPIs berechnen ===
    // MRR: nur aktive Verträge mit monthly_net_amount > 0 (keine 0€-Serien)
    const activeContracts = contracts.filter(c => c.status === 'active' && Number(c.monthly_net_amount || 0) > 0)
    const mrrNet = activeContracts.reduce((sum, c) => sum + Number(c.monthly_net_amount || 0), 0)
    const mrrGross = activeContracts.reduce((sum, c) => sum + Number(c.monthly_gross_amount || 0), 0)
    const aktiveKunden = new Set(activeContracts.map(c => c.hot_lead_id)).size

    // Offene Beträge: ohne Reminder-Belege
    const openInvoices = invoices.filter(i =>
      ['open', 'overdue'].includes(i.status) &&
      !['reminder', 'provision'].includes(i.invoice_type)
    )
    const offenerBetrag = openInvoices.reduce((sum, i) => sum + Number(i.gross_amount || 0), 0)
    const ueberfaelligCount = invoices.filter(i =>
      i.status === 'overdue' &&
      !['reminder', 'provision'].includes(i.invoice_type)
    ).length

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    // Umsatz: nur echte Rechnungen (ohne Reminder/Provision)
    const revenueInvoiceTypes = ['erstrechnung', 'retainer', 'one_time', 'manual']
    const paidInvoices = invoices.filter(i =>
      ['paid', 'paidoff'].includes(i.status) &&
      revenueInvoiceTypes.includes(i.invoice_type)
    )
    const umsatzMonat = paidInvoices
      .filter(i => new Date(i.voucher_date) >= startOfMonth)
      .reduce((sum, i) => sum + Number(i.gross_amount || 0), 0)
    const umsatzYtd = paidInvoices
      .filter(i => new Date(i.voucher_date) >= startOfYear)
      .reduce((sum, i) => sum + Number(i.gross_amount || 0), 0)

    // NEU: Provisions-Einnahmen YTD
    const provisionInvoices = invoices.filter(i =>
      ['paid', 'paidoff'].includes(i.status) &&
      i.invoice_type === 'provision'
    )
    const provisionYtd = provisionInvoices
      .filter(i => new Date(i.voucher_date) >= startOfYear)
      .reduce((sum, i) => sum + Number(i.gross_amount || 0), 0)

    // === Time-Series: MRR-Verlauf über 12 Monate ===
    const mrrHistory = []
    for (let i = 11; i >= 0; i--) {
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      const monthLabel = monthEnd.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
      // Nur Verträge mit monthly_net_amount > 0
      const activeAtDate = contracts.filter(c => {
        const start = new Date(c.start_date)
        const end = c.end_date ? new Date(c.end_date) : null
        return start <= monthEnd && (!end || end >= monthEnd) &&
               c.status === 'active' && Number(c.monthly_net_amount || 0) > 0
      })
      const mrrAtDate = activeAtDate.reduce((sum, c) => sum + Number(c.monthly_net_amount || 0), 0)
      mrrHistory.push({
        month: monthLabel,
        mrr_net: Number(mrrAtDate.toFixed(2)),
        mrr_gross: Number((mrrAtDate * 1.19).toFixed(2)),
        customers: activeAtDate.length
      })
    }

    // MRR change vs last month
    const mrrCurrentMonth = mrrHistory[mrrHistory.length - 1]?.mrr_net || 0
    const mrrPrevMonth = mrrHistory[mrrHistory.length - 2]?.mrr_net || 0
    const mrrChangePct = mrrPrevMonth > 0
      ? Number(((mrrCurrentMonth - mrrPrevMonth) / mrrPrevMonth * 100).toFixed(1))
      : (mrrCurrentMonth > 0 ? 100 : 0)

    // === Time-Series: Umsatz pro Monat (12 Monate, gestackt) ===
    // Nur echte Umsätze: erstrechnung, retainer, one_time, manual (KEINE reminder/provision)
    const revenueHistory = []
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      const monthLabel = monthDate.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
      const paidThisMonth = invoices.filter(inv => {
        if (!['paid', 'paidoff'].includes(inv.status)) return false
        if (!inv.paid_at) return false
        if (!revenueInvoiceTypes.includes(inv.invoice_type)) return false
        const paidDate = new Date(inv.paid_at)
        return paidDate >= monthDate && paidDate <= monthEnd
      })
      const erstrechnung = paidThisMonth
        .filter(i => i.invoice_type === 'erstrechnung')
        .reduce((sum, i) => sum + Number(i.gross_amount || 0), 0)
      const retainer = paidThisMonth
        .filter(i => i.invoice_type === 'retainer')
        .reduce((sum, i) => sum + Number(i.gross_amount || 0), 0)
      const oneTime = paidThisMonth
        .filter(i => ['one_time', 'manual'].includes(i.invoice_type))
        .reduce((sum, i) => sum + Number(i.gross_amount || 0), 0)
      revenueHistory.push({
        month: monthLabel,
        erstrechnung: Number(erstrechnung.toFixed(2)),
        retainer: Number(retainer.toFixed(2)),
        one_time: Number(oneTime.toFixed(2)),
        total: Number((erstrechnung + retainer + oneTime).toFixed(2))
      })
    }

    // === Pie-Chart: Status-Verteilung ===
    const statusDistribution = [
      { name: 'Bezahlt', value: invoices.filter(i => ['paid', 'paidoff'].includes(i.status)).length, color: '#10B981' },
      { name: 'Offen', value: invoices.filter(i => i.status === 'open').length, color: '#3B82F6' },
      { name: 'Überfällig', value: invoices.filter(i => i.status === 'overdue').length, color: '#EF4444' },
      { name: 'Entwurf', value: invoices.filter(i => ['draft', 'pending'].includes(i.status)).length, color: '#8B8B9A' },
      { name: 'Storniert', value: invoices.filter(i => i.status === 'voided').length, color: '#F59E0B' }
    ].filter(s => s.value > 0)

    // === Forecast: nächste 5 Wochen erwartete Eingänge ===
    const forecast = []
    for (let week = 0; week < 5; week++) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() + (week * 7))
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)
      const weekLabel = `KW ${getWeekNumber(weekStart)}`
      const expectedInflow = contracts
        .filter(c => c.status === 'active' && c.next_invoice_date)
        .filter(c => {
          const nextDate = new Date(c.next_invoice_date)
          return nextDate >= weekStart && nextDate <= weekEnd
        })
        .reduce((sum, c) => sum + Number(c.monthly_gross_amount || 0), 0)
      forecast.push({
        week: weekLabel,
        expected: Number(expectedInflow.toFixed(2))
      })
    }

    // === Avg days to payment (letzte 30 Tage) ===
    const last30Days = new Date(now - 30 * 86400000)
    const paidLast30 = invoices.filter(i =>
      ['paid', 'paidoff'].includes(i.status) &&
      i.paid_at && new Date(i.paid_at) >= last30Days
    )
    const avgDaysToPayment = paidLast30.length > 0
      ? Math.round(paidLast30.reduce((sum, i) => {
          const days = Math.floor((new Date(i.paid_at) - new Date(i.voucher_date)) / 86400000)
          return sum + days
        }, 0) / paidLast30.length)
      : null

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
          mrr_change_pct: mrrChangePct,
          aktive_kunden: aktiveKunden,
          offene_rechnungen_count: openInvoices.length,
          offener_betrag: Number(offenerBetrag.toFixed(2)),
          ueberfaellig_count: ueberfaelligCount,
          umsatz_monat: Number(umsatzMonat.toFixed(2)),
          umsatz_ytd: Number(umsatzYtd.toFixed(2)),
          provision_ytd: Number(provisionYtd.toFixed(2)),
          avg_days_to_payment: avgDaysToPayment
        },
        analytics: {
          mrr_history: mrrHistory,
          revenue_history: revenueHistory,
          status_distribution: statusDistribution,
          forecast: forecast
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
