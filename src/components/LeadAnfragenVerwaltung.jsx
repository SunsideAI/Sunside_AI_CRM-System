import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  Loader2,
  Check,
  X,
  Clock,
  Users,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  CheckCircle
} from 'lucide-react'

function LeadAnfragenVerwaltung() {
  const { user } = useAuth()
  const [anfragen, setAnfragen] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('') // Erfolgs-Toast
  const [processing, setProcessing] = useState(null) // ID der Anfrage die bearbeitet wird
  const [filterStatus, setFilterStatus] = useState('Offen')
  const [expandedId, setExpandedId] = useState(null)
  
  // Bearbeitungs-State
  const [editAnzahl, setEditAnzahl] = useState({})
  const [editKommentar, setEditKommentar] = useState({})

  // Anfragen laden
  const loadAnfragen = async () => {
    setLoading(true)
    setError('')
    
    try {
      const params = new URLSearchParams({
        isAdmin: 'true',
        status: filterStatus === 'all' ? '' : filterStatus
      })
      
      const response = await fetch(`/.netlify/functions/lead-requests?${params}`)
      
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Anfragen')
      }
      
      const data = await response.json()
      setAnfragen(data.anfragen || [])
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnfragen()
  }, [filterStatus])

  // Anfrage bearbeiten
  const handleAnfrage = async (anfrageId, status) => {
    setProcessing(anfrageId)
    
    try {
      const genehmigteAnzahl = editAnzahl[anfrageId] || anfragen.find(a => a.id === anfrageId)?.anzahl
      const kommentar = editKommentar[anfrageId] || ''
      
      // Status bestimmen
      let finalStatus = status
      if (status === 'Genehmigt') {
        const originalAnzahl = anfragen.find(a => a.id === anfrageId)?.anzahl
        if (genehmigteAnzahl < originalAnzahl) {
          finalStatus = 'Teilweise_Genehmigt'
        }
      }
      
      const response = await fetch('/.netlify/functions/lead-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anfrageId,
          status: finalStatus,
          genehmigteAnzahl: status === 'Abgelehnt' ? 0 : genehmigteAnzahl,
          adminKommentar: kommentar,
          adminId: user.id
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Fehler beim Bearbeiten')
      }
      
      const data = await response.json()
      
      // Erfolgsmeldung mit Anzahl zugewiesener Leads
      if (status !== 'Abgelehnt' && data.zugewieseneLeads > 0) {
        setSuccessMessage(`${data.zugewieseneLeads} Leads wurden erfolgreich zugewiesen!`)
      } else if (status !== 'Abgelehnt' && data.zugewieseneLeads === 0) {
        setSuccessMessage('Anfrage genehmigt, aber keine freien Leads verfügbar.')
      } else if (status === 'Abgelehnt') {
        setSuccessMessage('Anfrage wurde abgelehnt.')
      }
      
      // Toast nach 5 Sekunden ausblenden
      setTimeout(() => setSuccessMessage(''), 5000)
      
      // Erfolgreich - Liste neu laden
      await loadAnfragen()
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
      'Teilweise_Genehmigt': 'bg-orange-100 text-orange-700',
      'Abgelehnt': 'bg-red-100 text-red-700'
    }
    const labels = {
      'Offen': 'Offen',
      'Genehmigt': 'Genehmigt',
      'Teilweise_Genehmigt': 'Teilweise',
      'Abgelehnt': 'Abgelehnt'
    }
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    )
  }

  const offeneCount = anfragen.filter(a => a.status === 'Offen').length

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
          <h2 className="text-lg font-semibold text-gray-900">Lead-Anfragen</h2>
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
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none bg-white text-sm"
          >
            <option value="Offen">Offene Anfragen</option>
            <option value="all">Alle Anfragen</option>
            <option value="Genehmigt">Genehmigt</option>
            <option value="Abgelehnt">Abgelehnt</option>
          </select>
          
          <button
            onClick={loadAnfragen}
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
          <Loader2 className="w-8 h-8 text-sunside-primary animate-spin" />
        </div>
      )}

      {/* Keine Anfragen */}
      {!loading && anfragen.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {filterStatus === 'Offen' ? 'Keine offenen Anfragen' : 'Keine Anfragen gefunden'}
          </p>
        </div>
      )}

      {/* Anfragen Liste */}
      {!loading && anfragen.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {anfragen.map(anfrage => (
              <div key={anfrage.id} className="p-4">
                {/* Anfrage Header */}
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(expandedId === anfrage.id ? null : anfrage.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{anfrage.userName}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(anfrage.erstelltAm).toLocaleDateString('de-DE', {
                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{anfrage.anzahl} Leads</p>
                      {anfrage.genehmigteAnzahl !== null && anfrage.genehmigteAnzahl !== anfrage.anzahl && (
                        <p className="text-sm text-gray-500">→ {anfrage.genehmigteAnzahl} genehmigt</p>
                      )}
                    </div>
                    {getStatusBadge(anfrage.status)}
                    {expandedId === anfrage.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Nachricht wenn vorhanden */}
                {anfrage.nachricht && (
                  <div className="mt-3 ml-14 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-600">{anfrage.nachricht}</p>
                    </div>
                  </div>
                )}

                {/* Expanded: Bearbeitungsoptionen */}
                {expandedId === anfrage.id && anfrage.status === 'Offen' && (
                  <div className="mt-4 ml-14 p-4 bg-gray-50 rounded-lg space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Anzahl genehmigen
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={anfrage.anzahl}
                          value={editAnzahl[anfrage.id] ?? anfrage.anzahl}
                          onChange={(e) => setEditAnzahl(prev => ({ ...prev, [anfrage.id]: parseInt(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kommentar (optional)
                        </label>
                        <input
                          type="text"
                          value={editKommentar[anfrage.id] || ''}
                          onChange={(e) => setEditKommentar(prev => ({ ...prev, [anfrage.id]: e.target.value }))}
                          placeholder="z.B. Erst nach Rücksprache..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => handleAnfrage(anfrage.id, 'Abgelehnt')}
                        disabled={processing === anfrage.id}
                        className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Ablehnen
                      </button>
                      <button
                        onClick={() => handleAnfrage(anfrage.id, 'Genehmigt')}
                        disabled={processing === anfrage.id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {processing === anfrage.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Genehmigen
                      </button>
                    </div>
                  </div>
                )}

                {/* Bearbeitet Info */}
                {anfrage.status !== 'Offen' && anfrage.bearbeitetVonName && (
                  <div className="mt-3 ml-14 text-sm text-gray-500">
                    Bearbeitet von {anfrage.bearbeitetVonName} am {new Date(anfrage.bearbeitetAm).toLocaleDateString('de-DE')}
                    {anfrage.adminKommentar && (
                      <span className="ml-2">• {anfrage.adminKommentar}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm text-green-700">
          <strong>✓ Automatische Zuweisung:</strong> Nach dem Genehmigen werden die Leads automatisch 
          aus dem Pool der freien Leads dem Vertriebler zugewiesen.
        </p>
      </div>
    </div>
  )
}

export default LeadAnfragenVerwaltung
