import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  ExternalLink, RefreshCw, TrendingUp, TrendingDown, AlertCircle,
  Users, Euro, FileText, Clock, CheckCircle2, PieChart as PieIcon, BarChart3
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts'

const LEXWARE_INVOICE_URL = 'https://app.lexware.de/permalink/invoices/view'

const CHART_COLORS = {
  primary: '#7C3AED',
  primaryLight: '#A78BFA',
  blue: '#3B82F6',
  green: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  neutral: '#8B8B9A'
}

function formatEUR(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0)
}

function formatDate(d) {
  if (!d) return '–'
  return new Date(d).toLocaleDateString('de-DE')
}

const STATUS_CONFIG = {
  pending: { label: 'Wird erstellt', color: 'bg-gray-100 text-gray-700', icon: Clock },
  draft: { label: 'Entwurf', color: 'bg-gray-100 text-gray-700', icon: FileText },
  open: { label: 'Offen', color: 'bg-blue-100 text-blue-700', icon: Clock },
  paid: { label: 'Bezahlt', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  paidoff: { label: 'Verrechnet', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  overdue: { label: 'Überfällig', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  voided: { label: 'Storniert', color: 'bg-yellow-100 text-yellow-700', icon: FileText },
  failed: { label: 'Fehlgeschlagen', color: 'bg-red-100 text-red-700', icon: AlertCircle }
}

const CONTRACT_STATUS = {
  active: { label: 'Aktiv', color: 'bg-green-100 text-green-700' },
  paused: { label: 'Pausiert', color: 'bg-yellow-100 text-yellow-700' },
  cancelled: { label: 'Gekündigt', color: 'bg-red-100 text-red-700' },
  completed: { label: 'Abgeschlossen', color: 'bg-gray-100 text-gray-700' }
}

const TYPE_LABELS = {
  erstrechnung: 'Erstrechnung',
  retainer: 'Monatliche Rechnung',
  manual: 'Manuell'
}

export default function Finanzen() {
  const { user, isGeschaeftsfuehrer } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('analytics')

  useEffect(() => {
    if (!isGeschaeftsfuehrer()) {
      navigate('/dashboard')
      return
    }
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/.netlify/functions/billing-dashboard?user_id=${user.id}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Lade-Fehler')
      }
      setData(await res.json())
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isGeschaeftsfuehrer()) return null

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
        <span className="text-gray-600">Lade Finanzdaten…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <span className="font-semibold">Fehler:</span> {error}
        </div>
      </div>
    )
  }

  if (!data) return <div className="p-8 text-gray-500">Keine Daten verfügbar</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanzen</h1>
          <p className="text-sm text-gray-500">Übersicht über alle Rechnungen, Verträge und KPIs</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Aktualisieren"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6 flex gap-4">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-2 px-1 transition-colors ${activeTab === 'analytics' ? 'border-b-2 border-purple-600 text-purple-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📊 Analytics
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={`pb-2 px-1 transition-colors ${activeTab === 'contracts' ? 'border-b-2 border-purple-600 text-purple-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📋 Aktive Verträge ({data.contracts?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-2 px-1 transition-colors ${activeTab === 'invoices' ? 'border-b-2 border-purple-600 text-purple-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          🧾 Alle Rechnungen ({data.invoices?.length || 0})
        </button>
      </div>

      {/* Tab-Inhalt */}
      {activeTab === 'analytics' ? (
        <AnalyticsTab data={data} />
      ) : activeTab === 'contracts' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <ContractsTable contracts={data.contracts || []} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <InvoicesTable invoices={data.invoices || []} />
        </div>
      )}
    </div>
  )
}

function AnalyticsTab({ data }) {
  const k = data.kpis || {}
  const a = data.analytics || {}

  return (
    <div className="space-y-6">
      {/* TOP-ROW: 4 Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <HeroKPI
          label="MRR (brutto)"
          value={formatEUR(k.mrr_gross)}
          change={k.mrr_change_pct}
          icon={TrendingUp}
        />
        <StandardKPI
          label="Umsatz Monat"
          value={formatEUR(k.umsatz_monat)}
          subtitle={new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
          icon={Euro}
          color="green"
        />
        <StandardKPI
          label="Umsatz YTD"
          value={formatEUR(k.umsatz_ytd)}
          subtitle={`Jahr ${new Date().getFullYear()}`}
          icon={TrendingUp}
          color="green"
        />
        <StandardKPI
          label="Aktive Kunden"
          value={k.aktive_kunden || 0}
          subtitle="aktuell"
          icon={Users}
          color="blue"
        />
      </div>

      {/* BOTTOM-ROW: 4 Operations KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StandardKPI
          label="Offener Betrag"
          value={formatEUR(k.offener_betrag)}
          subtitle={`${k.offene_rechnungen_count || 0} Rechnungen`}
          icon={Clock}
          color="amber"
        />
        <StandardKPI
          label="Überfällig"
          value={k.ueberfaellig_count || 0}
          subtitle={k.ueberfaellig_count > 0 ? 'sofort prüfen' : 'alles gut'}
          icon={AlertCircle}
          color={k.ueberfaellig_count > 0 ? 'red' : 'neutral'}
        />
        <StandardKPI
          label="Ø Tage bis Zahlung"
          value={k.avg_days_to_payment !== null ? `${k.avg_days_to_payment} Tage` : '–'}
          subtitle="letzte 30 Tage"
          icon={Clock}
          color="neutral"
        />
        <StandardKPI
          label="MRR-Wachstum"
          value={k.mrr_change_pct !== undefined ? (k.mrr_change_pct >= 0 ? `+${k.mrr_change_pct}%` : `${k.mrr_change_pct}%`) : '–'}
          subtitle="vs. Vormonat"
          icon={k.mrr_change_pct >= 0 ? TrendingUp : TrendingDown}
          color={k.mrr_change_pct >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* CHARTS-ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MRR-Entwicklung */}
        <ChartCard title="MRR-Entwicklung" subtitle="Letzte 12 Monate, netto">
          {(a.mrr_history || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={a.mrr_history}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${v}€`} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => formatEUR(v)}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Area
                  type="monotone"
                  dataKey="mrr_net"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  fill="url(#mrrGrad)"
                  name="MRR netto"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={BarChart3} message="Noch keine MRR-Daten" />
          )}
        </ChartCard>

        {/* Umsatz pro Monat (stacked) */}
        <ChartCard title="Umsatz pro Monat" subtitle="Letzte 12 Monate, brutto">
          {(a.revenue_history || []).some(r => r.total > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={a.revenue_history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${v}€`} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => formatEUR(v)}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="erstrechnung" stackId="a" fill={CHART_COLORS.primary} name="Erstrechnung" />
                <Bar dataKey="retainer" stackId="a" fill={CHART_COLORS.blue} name="Retainer" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={BarChart3} message="Noch keine Zahlungen" />
          )}
        </ChartCard>
      </div>

      {/* CHARTS-ROW 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status-Verteilung */}
        <ChartCard title="Rechnungs-Status" subtitle={`${data.invoices?.length || 0} Rechnungen gesamt`}>
          {(a.status_distribution || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={a.status_distribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {a.status_distribution.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={PieIcon} message="Noch keine Rechnungen" />
          )}
        </ChartCard>

        {/* Forecast nächste 5 Wochen */}
        <ChartCard title="Forecast" subtitle="Erwartete Eingänge nächste 5 Wochen, brutto">
          {(a.forecast || []).some(f => f.expected > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={a.forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${v}€`} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => formatEUR(v)}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="expected" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} name="Erwartet" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={BarChart3} message="Keine geplanten Rechnungen" />
          )}
        </ChartCard>
      </div>
    </div>
  )
}

function HeroKPI({ label, value, change, icon: Icon }) {
  return (
    <div className="relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-purple-600 to-purple-700 text-white">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wide text-white/80">{label}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          {change !== undefined && change !== null && (
            <p className="mt-1 text-sm text-white/80">
              {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% vs. Vormonat
            </p>
          )}
        </div>
        <div className="p-3 rounded-lg bg-white/20">
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl" />
    </div>
  )
}

function StandardKPI({ label, value, subtitle, icon: Icon, color = 'neutral' }) {
  const colorClasses = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    neutral: 'bg-gray-100 text-gray-700'
  }
  return (
    <div className="rounded-xl p-6 bg-white border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center h-[280px] text-gray-400">
      <Icon className="w-12 h-12 mb-2 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

function ContractsTable({ contracts }) {
  if (contracts.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        Keine aktiven Verträge vorhanden
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
            <th className="px-4 py-3 font-medium">Kunde</th>
            <th className="px-4 py-3 font-medium">Produkt</th>
            <th className="px-4 py-3 font-medium text-right">Monatlich (netto)</th>
            <th className="px-4 py-3 font-medium text-right">Monatlich (brutto)</th>
            <th className="px-4 py-3 font-medium">Vertragsbeginn</th>
            <th className="px-4 py-3 font-medium">Vertragsende</th>
            <th className="px-4 py-3 font-medium">Nächste Rechnung</th>
            <th className="px-4 py-3 font-medium text-right">Bezahlt/Gesamt</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map(c => {
            const statusCfg = CONTRACT_STATUS[c.status] || CONTRACT_STATUS.active
            return (
              <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.unternehmen}</td>
                <td className="px-4 py-3 text-gray-600">{c.produkt || '–'}</td>
                <td className="px-4 py-3 text-right">{formatEUR(c.monthly_net_amount)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatEUR(c.monthly_gross_amount)}</td>
                <td className="px-4 py-3">{formatDate(c.start_date)}</td>
                <td className="px-4 py-3">{formatDate(c.end_date)}</td>
                <td className="px-4 py-3">{formatDate(c.next_invoice_date)}</td>
                <td className="px-4 py-3 text-right">{c.bezahlte_rechnungen}/{c.gesamt_rechnungen}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function InvoicesTable({ invoices }) {
  if (invoices.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        Keine Rechnungen vorhanden
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
            <th className="px-4 py-3 font-medium">RE-Nr</th>
            <th className="px-4 py-3 font-medium">Kunde</th>
            <th className="px-4 py-3 font-medium">Typ</th>
            <th className="px-4 py-3 font-medium">Datum</th>
            <th className="px-4 py-3 font-medium text-right">Brutto</th>
            <th className="px-4 py-3 font-medium">Fällig</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Bezahlt am</th>
            <th className="px-4 py-3 font-medium">Tage</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(inv => {
            const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft
            const Icon = cfg.icon
            return (
              <tr key={inv.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{inv.lexware_voucher_number || '–'}</td>
                <td className="px-4 py-3">{inv.unternehmen}</td>
                <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[inv.invoice_type] || inv.invoice_type}</td>
                <td className="px-4 py-3">{formatDate(inv.voucher_date)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatEUR(inv.gross_amount)}</td>
                <td className="px-4 py-3">{formatDate(inv.due_date)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                    <Icon size={12} />
                    {cfg.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{inv.paid_at ? formatDate(inv.paid_at) : '–'}</td>
                <td className="px-4 py-3 text-gray-500">
                  {inv.days_open !== null ? `${inv.days_open}d` : '–'}
                </td>
                <td className="px-4 py-3">
                  {inv.lexware_invoice_id && (
                    <a
                      href={`${LEXWARE_INVOICE_URL}/${inv.lexware_invoice_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-700"
                      title="In Lexware öffnen"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
