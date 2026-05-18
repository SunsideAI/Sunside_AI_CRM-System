import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  ExternalLink, RefreshCw, TrendingUp, TrendingDown, AlertCircle,
  Users, Euro, FileText, Clock, CheckCircle2, PieChart as PieIcon, BarChart3,
  Loader2, Receipt, ScrollText
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
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [activeView, setActiveView] = useState('analytics')

  useEffect(() => {
    if (!isGeschaeftsfuehrer()) {
      navigate('/dashboard')
      return
    }
    load()
  }, [])

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
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
      setRefreshing(false)
    }
  }

  if (!isGeschaeftsfuehrer()) return null

  if (error && !data) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <span className="font-semibold">Fehler:</span> {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header mit Toggle Bubbles */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-display text-on-surface">Finanzen</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {activeView === 'analytics' && 'Finanz-Analytics und KPIs'}
            {activeView === 'contracts' && 'Aktive Verträge und Abonnements'}
            {activeView === 'invoices' && 'Alle Rechnungen im Überblick'}
          </p>
        </div>

        {/* Toggle Buttons - Bubble Style */}
        <div className="w-full sm:w-auto overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center bg-gray-100 rounded-lg p-1 min-w-max">
            <button
              onClick={() => setActiveView('analytics')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-md text-label-md sm:text-label-lg transition-all duration-250 whitespace-nowrap ${
                activeView === 'analytics'
                  ? 'bg-gradient-primary text-white shadow-glow-primary'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
              <span className="sm:hidden">Stats</span>
            </button>

            <button
              onClick={() => setActiveView('contracts')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-md text-label-md sm:text-label-lg transition-all duration-250 whitespace-nowrap ${
                activeView === 'contracts'
                  ? 'bg-gradient-primary text-white shadow-glow-primary'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
              }`}
            >
              <ScrollText className="h-4 w-4" />
              <span className="hidden sm:inline">Verträge</span>
              <span className="sm:hidden">Verträge</span>
            </button>

            <button
              onClick={() => setActiveView('invoices')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-md text-label-md sm:text-label-lg transition-all duration-250 whitespace-nowrap ${
                activeView === 'invoices'
                  ? 'bg-gradient-primary text-white shadow-glow-primary'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
              }`}
            >
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Rechnungen</span>
              <span className="sm:hidden">RE</span>
            </button>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={() => load(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-on-surface-variant hover:text-primary hover:bg-primary-fixed/20 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${(refreshing || loading) ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      {/* Loading State */}
      {loading && !refreshing ? (
        <div className="card p-6">
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-on-surface-variant">Finanzdaten werden geladen...</p>
          </div>
        </div>
      ) : data && (
        <>
          {/* Content based on active view */}
          {activeView === 'analytics' && <AnalyticsTab data={data} />}
          {activeView === 'contracts' && (
            <div className="card overflow-hidden">
              <ContractsTable contracts={data.contracts || []} />
            </div>
          )}
          {activeView === 'invoices' && (
            <div className="card overflow-hidden">
              <InvoicesTable invoices={data.invoices || []} />
            </div>
          )}
        </>
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
    green: 'bg-success/10 text-success',
    blue: 'bg-primary/10 text-primary',
    amber: 'bg-warning/10 text-warning',
    red: 'bg-error/10 text-error',
    neutral: 'bg-on-surface/10 text-on-surface-variant'
  }
  return (
    <div className="metric-card hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">{label}</p>
          <p className="mt-2 text-headline-md font-bold text-on-surface">{value}</p>
          {subtitle && <p className="mt-1 text-body-sm text-on-surface-variant">{subtitle}</p>}
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
    <div className="card p-6">
      <div className="mb-4">
        <h3 className="text-label-lg font-semibold text-on-surface">{title}</h3>
        {subtitle && <p className="text-body-sm text-on-surface-variant mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center h-[280px] text-on-surface-variant">
      <Icon className="w-12 h-12 mb-2 opacity-50" />
      <p className="text-body-md">{message}</p>
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
