import { useState, useEffect } from 'react'
import { ExternalLink, RefreshCw, FileText, AlertCircle, CheckCircle2, Clock } from 'lucide-react'

const LEXWARE_INVOICE_URL = 'https://app.lexware.de/permalink/invoices/view'
const LEXWARE_CONTACT_URL = 'https://app.lexware.de/permalink/contacts/view'

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

const TYPE_LABELS = {
  erstrechnung: 'Erstrechnung',
  retainer: 'Monatliche Rechnung',
  manual: 'Manuell'
}

const CONTRACT_STATUS = {
  active: { label: 'Aktiv', color: 'bg-green-100 text-green-700' },
  paused: { label: 'Pausiert', color: 'bg-yellow-100 text-yellow-700' },
  cancelled: { label: 'Gekündigt', color: 'bg-red-100 text-red-700' },
  completed: { label: 'Abgeschlossen', color: 'bg-gray-100 text-gray-700' }
}

function formatEUR(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0)
}

function formatDate(d) {
  if (!d) return '–'
  return new Date(d).toLocaleDateString('de-DE')
}

export default function BillingPanel({ leadId, leadStatus }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  async function load() {
    if (!leadId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/.netlify/functions/billing-info?hot_lead_id=${leadId}`)
      if (!res.ok) throw new Error('Billing-Daten konnten nicht geladen werden')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [leadId])

  if (leadStatus !== 'Abgeschlossen') return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 my-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span>💰</span> Billing
        </h3>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-colors"
          title="Aktualisieren"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-8 text-gray-500">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
          Lade Billing-Daten…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          <span className="font-semibold">⚠️ Fehler:</span> {error}
        </div>
      )}

      {/* No Data */}
      {!loading && !error && data && !data.contract && data.invoices?.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
          <p className="font-semibold text-yellow-900 mb-1">⏳ Keine Billing-Daten</p>
          <p className="text-yellow-800">
            Die Bridge wurde noch nicht für diesen Lead getriggert. Die Rechnungserstellung
            läuft normalerweise automatisch nach dem Abschluss.
          </p>
        </div>
      )}

      {/* Data loaded */}
      {!loading && !error && data && (data.contract || data.invoices?.length > 0) && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <KPI label="Gesamt fakturiert" value={formatEUR(data.stats?.total_invoiced)} />
            <KPI label="Bezahlt" value={formatEUR(data.stats?.total_paid)} positive />
            <KPI
              label="Offen"
              value={formatEUR(data.stats?.total_outstanding)}
              warning={data.stats?.total_outstanding > 0}
            />
            <KPI
              label="Überfällig"
              value={data.stats?.overdue_count || 0}
              alert={data.stats?.overdue_count > 0}
            />
          </div>

          {/* Vertrag */}
          {data.contract && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <span>📋</span> Vertrag
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Field label="Produkt" value={data.contract.produkt} />
                <Field label="Monatlich (netto)" value={formatEUR(data.contract.monthly_net_amount)} />
                <Field label="Monatlich (brutto)" value={formatEUR(data.contract.monthly_gross_amount)} />
                <Field label="Laufzeit" value={data.contract.laufzeit_months ? `${data.contract.laufzeit_months} Monate` : '–'} />
                <Field label="Vertragsbeginn" value={formatDate(data.contract.start_date)} />
                <Field label="Vertragsende" value={formatDate(data.contract.end_date)} />
                <Field label="Nächste Rechnung" value={formatDate(data.contract.next_invoice_date)} />
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Status</div>
                  <ContractStatusBadge status={data.contract.status} />
                </div>
                {data.contact?.lexware_contact_id && (
                  <Field
                    label="Lexware-Kunde"
                    value={
                      <a
                        href={`${LEXWARE_CONTACT_URL}/${data.contact.lexware_contact_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:underline inline-flex items-center gap-1"
                      >
                        #{data.contact.lexware_customer_number || 'Öffnen'}
                        <ExternalLink size={12} />
                      </a>
                    }
                  />
                )}
              </div>
            </div>
          )}

          {/* Rechnungs-Tabelle */}
          {data.invoices?.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <span>🧾</span> Rechnungen ({data.invoices.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="pb-2 pr-3">RE-Nr</th>
                      <th className="pb-2 pr-3">Typ</th>
                      <th className="pb-2 pr-3">Datum</th>
                      <th className="pb-2 pr-3 text-right">Brutto</th>
                      <th className="pb-2 pr-3">Fällig</th>
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2 pr-3">Bezahlt am</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map(inv => {
                      const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft
                      const Icon = cfg.icon
                      return (
                        <tr key={inv.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-2.5 pr-3 font-medium">
                            {inv.lexware_voucher_number || '–'}
                          </td>
                          <td className="py-2.5 pr-3 text-gray-600">
                            {TYPE_LABELS[inv.invoice_type] || inv.invoice_type}
                          </td>
                          <td className="py-2.5 pr-3">
                            {formatDate(inv.voucher_date)}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-medium">
                            {formatEUR(inv.gross_amount)}
                          </td>
                          <td className="py-2.5 pr-3">
                            {formatDate(inv.due_date)}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                              <Icon size={12} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-gray-600">
                            {inv.paid_at ? formatDate(inv.paid_at) : '–'}
                            {inv.days_open !== null && inv.paid_at && (
                              <span className="text-xs text-gray-400 ml-1">
                                ({inv.days_open}d)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5">
                            {inv.lexware_invoice_id && (
                              <a
                                href={`${LEXWARE_INVOICE_URL}/${inv.lexware_invoice_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 hover:text-purple-700 inline-flex items-center gap-1"
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
            </div>
          )}
        </>
      )}
    </div>
  )
}

function KPI({ label, value, positive, warning, alert }) {
  const colorClass = alert
    ? 'text-red-700 bg-red-50 border-red-200'
    : warning
      ? 'text-orange-700 bg-orange-50 border-orange-200'
      : positive
        ? 'text-green-700 bg-green-50 border-green-200'
        : 'text-gray-700 bg-gray-50 border-gray-200'

  return (
    <div className={`rounded-lg p-3 border ${colorClass}`}>
      <div className="text-xs opacity-75">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="font-medium">{value || '–'}</div>
    </div>
  )
}

function ContractStatusBadge({ status }) {
  const cfg = CONTRACT_STATUS[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}
