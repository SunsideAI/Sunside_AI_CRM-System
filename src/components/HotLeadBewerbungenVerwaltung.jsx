import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  Loader2,
  Check,
  X,
  Clock,
  Target,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  CheckCircle,
  Calendar,
  Building2,
  User
} from 'lucide-react'

function HotLeadBewerbungenVerwaltung() {
  const { user } = useAuth()
  const [bewerbungen, setBewerbungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [processing, setProcessing] = useState(null)
  const [filterStatus, setFilterStatus] = useState('Offen')
  const [expandedId, setExpandedId] = useState(null)

  const [editKommentar, setEditKommentar] = useState({})

  const loadBewerbungen = async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        isAdmin: 'true',
        status: filterStatus === 'all' ? '' : filterStatus
      })

      const response = await fetch(`/.netlify/functions/hot-lead-applications?${params}`)

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Bewerbungen')
      }

      const data = await response.json()
      setBewerbungen(data.bewerbungen || [])

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBewerbungen()
  }, [filterStatus])

  const handleBewerbung = async (bewerbungId, status) => {
    setProcessing(bewerbungId)

    try {
      const kommentar = editKommentar[bewerbungId] || ''

      const response = await fetch('/.netlify/functions/hot-lead-applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bewerbungId,
          status,
          adminKommentar: kommentar,
          adminId: user.id
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Fehler beim Bearbeiten')
      }

      if (status === 'Genehmigt') {
        setSuccessMessage('Bewerbung genehmigt! Lead wurde dem Closer zugewiesen.')
      } else {
        setSuccessMessage('Bewerbung wurde abgelehnt.')
      }

      setTimeout(() => setSuccessMessage(''), 5000)

      await loadBewerbungen()
      setExpandedId(null)

    } catch (err) {
      setError(err.message)
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      'Offen': 'bg-amber-100 text-amber-700',
      'Genehmigt': 'bg-green-100 text-green-700',
      'Abgelehnt': 'bg-red-100 text-red-700'
    }
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-surface-container text-gray-700'}`}>
        {status}
      </span>
    )
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const offeneCount = bewerbungen.filter(b => b.status === 'Offen').length

  return (
    <div className="space-y-6">
      {/* Erfolgs-Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50">
          <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg shadow-lg">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-green-800 font-medium">{successMessage}</span>
            <button
              onClick={() => setSuccessMessage('')}
              className="ml-2 text-green-600 hover:text-green-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header mit Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-on-surface">Hot-Lead-Bewerbungen</h2>
          {offeneCount > 0 && (
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
              {offeneCount} offen
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white text-sm"
          >
            <option value="Offen">Offene Bewerbungen</option>
            <option value="all">Alle Bewerbungen</option>
            <option value="Genehmigt">Genehmigt</option>
            <option value="Abgelehnt">Abgelehnt</option>
          </select>

          <button
            onClick={loadBewerbungen}
            disabled={loading}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {/* Keine Bewerbungen */}
      {!loading && bewerbungen.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-outline-variant/15">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-on-surface-variant">
            {filterStatus === 'Offen' ? 'Keine offenen Bewerbungen' : 'Keine Bewerbungen gefunden'}
          </p>
        </div>
      )}

      {/* Bewerbungen Liste */}
      {!loading && bewerbungen.length > 0 && (
        <div className="bg-white rounded-xl border border-outline-variant/15 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {bewerbungen.map(bewerbung => (
              <div key={bewerbung.id} className="p-4">
                {/* Bewerbung Header */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(expandedId === bewerbung.id ? null : bewerbung.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Target className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-on-surface">{bewerbung.closerName}</p>
                      <p className="text-sm text-on-surface-variant">
                        {formatDate(bewerbung.erstelltAm)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-on-surface">{bewerbung.unternehmen}</p>
                      <p className="text-sm text-on-surface-variant flex items-center gap-1 justify-end">
                        <Calendar className="w-3 h-3" />
                        {formatDate(bewerbung.terminDatum)}
                      </p>
                    </div>
                    {getStatusBadge(bewerbung.status)}
                    {expandedId === bewerbung.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Kommentar vom Closer wenn vorhanden */}
                {bewerbung.kommentar && (
                  <div className="mt-3 ml-14 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-600">{bewerbung.kommentar}</p>
                    </div>
                  </div>
                )}

                {/* Expanded: Details & Bearbeitung */}
                {expandedId === bewerbung.id && (
                  <div className="mt-4 ml-14 space-y-4">
                    {/* Lead Details */}
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="text-sm font-medium text-purple-800 mb-3">Lead-Details</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-purple-600" />
                          <span className="text-gray-600">Unternehmen:</span>
                          <span className="font-medium">{bewerbung.unternehmen}</span>
                        </div>
                        {bewerbung.ansprechpartner && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-purple-600" />
                            <span className="text-gray-600">Ansprechpartner:</span>
                            <span className="font-medium">{bewerbung.ansprechpartner}</span>
                          </div>
                        )}
                        {bewerbung.stadt && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Ort:</span>
                            <span className="font-medium">{bewerbung.stadt}</span>
                          </div>
                        )}
                        {bewerbung.setterName && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Gebucht von:</span>
                            <span className="font-medium">{bewerbung.setterName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-purple-600" />
                          <span className="text-gray-600">Termin:</span>
                          <span className="font-medium">{formatDate(bewerbung.terminDatum)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bearbeitungsoptionen nur bei offenen Bewerbungen */}
                    {bewerbung.status === 'Offen' && (
                      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Kommentar (optional)
                          </label>
                          <input
                            type="text"
                            value={editKommentar[bewerbung.id] || ''}
                            onChange={(e) => setEditKommentar(prev => ({ ...prev, [bewerbung.id]: e.target.value }))}
                            placeholder="z.B. Grund für Ablehnung..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          />
                        </div>

                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => handleBewerbung(bewerbung.id, 'Abgelehnt')}
                            disabled={processing === bewerbung.id}
                            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            Ablehnen
                          </button>
                          <button
                            onClick={() => handleBewerbung(bewerbung.id, 'Genehmigt')}
                            disabled={processing === bewerbung.id}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            {processing === bewerbung.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            Genehmigen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bearbeitet Info */}
                {bewerbung.status !== 'Offen' && bewerbung.bearbeitetVonName && (
                  <div className="mt-3 ml-14 text-sm text-on-surface-variant">
                    Bearbeitet von {bewerbung.bearbeitetVonName} am {formatDate(bewerbung.bearbeitetAm)}
                    {bewerbung.adminKommentar && (
                      <span className="ml-2">• {bewerbung.adminKommentar}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <p className="text-sm text-purple-700">
          <strong>Info:</strong> Wenn du eine Bewerbung genehmigst, wird der Hot Lead automatisch
          dem Closer zugewiesen. Andere offene Bewerbungen für denselben Lead werden automatisch abgelehnt.
        </p>
      </div>
    </div>
  )
}

export default HotLeadBewerbungenVerwaltung
