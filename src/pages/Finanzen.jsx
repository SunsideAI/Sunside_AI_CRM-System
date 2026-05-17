import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, RefreshCw, TrendingUp, AlertCircle, Users, Euro, FileText, Clock, CheckCircle2 } from 'lucide-react'

const LEXWARE_INVOICE_URL = 'https://app.lexware.de/permalink/invoices/view'

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
  const [activeTab, setActiveTab] = useState('contracts')

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

  const k = data.kpis || {}

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

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPI label="MRR (netto)" value={formatEUR(k.mrr_net)} icon={TrendingUp} />
        <KPI label="MRR (brutto)" value={formatEUR(k.mrr_gross)} icon={Euro} />
        <KPI label="Aktive Kunden" value={k.aktive_kunden || 0} icon={Users} />
        <KPI label="Umsatz Monat" value={formatEUR(k.umsatz_monat)} icon={Euro} positive />
        <KPI label="Umsatz YTD" value={formatEUR(k.umsatz_ytd)} icon={TrendingUp} positive />
        <KPI label="Offen" value={formatEUR(k.offener_betrag)} icon={AlertCircle} warning={k.offene_rechnungen_count > 0} />
        <KPI label="Offene Rechnungen" value={k.offene_rechnungen_count || 0} icon={FileText} warning={k.offene_rechnungen_count > 0} />
        <KPI label="Überfällig" value={k.ueberfaellig_count || 0} icon={AlertCircle} alert={k.ueberfaellig_count > 0} />
      </div>

      {/* Tabs */}
      <div className="border-b mb-4 flex gap-4">
        <button
          onClick={() => setActiveTab('contracts')}
          className={`pb-2 px-1 transition-colors ${activeTab === 'contracts' ? 'border-b-2 border-purple-600 text-purple-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Aktive Verträge ({data.contracts?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-2 px-1 transition-colors ${activeTab === 'invoices' ? 'border-b-2 border-purple-600 text-purple-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Alle Rechnungen ({data.invoices?.length || 0})
        </button>
      </div>

      {/* Tab-Inhalt */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {activeTab === 'contracts' ? (
          <ContractsTable contracts={data.contracts || []} />
        ) : (
          <InvoicesTable invoices={data.invoices || []} />
        )}
      </div>
    </div>
  )
}

function KPI({ label, value, icon: Icon, positive, warning, alert }) {
  const colorClass = alert
    ? 'text-red-700 bg-red-50 border-red-200'
    : warning
      ? 'text-orange-700 bg-orange-50 border-orange-200'
      : positive
        ? 'text-green-700 bg-green-50 border-green-200'
        : 'text-gray-700 bg-gray-50 border-gray-200'

  return (
    <div className={`rounded-lg p-3 border ${colorClass}`}>
      <div className="text-xs opacity-75 flex items-center gap-1">
        {Icon && <Icon size={12} />} {label}
      </div>
      <div className="text-lg font-bold mt-1">{value}</div>
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
