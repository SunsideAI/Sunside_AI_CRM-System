import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { 
  Calendar, 
  Clock,
  Users,
  XCircle,
  Target,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Phone,
  Mail,
  Globe,
  MapPin,
  Building2,
  FileText,
  Edit3,
  Save,
  Award,
  Filter
} from 'lucide-react'

// Status-Optionen für Dropdown
const STATUS_OPTIONS = [
  { value: 'Lead', label: 'Lead', color: 'bg-blue-100 text-blue-700' },
  { value: 'Angebot versendet', label: 'Angebot versendet', color: 'bg-purple-100 text-purple-700' },
  { value: 'Abgeschlossen', label: 'Abgeschlossen', color: 'bg-green-100 text-green-700' },
  { value: 'Verloren', label: 'Verloren', color: 'bg-red-100 text-red-700' }
]

function Closing() {
  const { user, isAdmin } = useAuth()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedLead, setSelectedLead] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const LEADS_PER_PAGE = 10

  useEffect(() => {
    loadLeads()
  }, [user])

  const loadLeads = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)

      // Für Closer: Nur eigene Leads, für Admin: Alle
      const closerName = isAdmin() ? '' : (user.vor_nachname || user.name)
      const url = closerName 
        ? `/.netlify/functions/hot-leads?closerName=${encodeURIComponent(closerName)}`
        : '/.netlify/functions/hot-leads'

      const response = await fetch(url)
      const data = await response.json()

      if (response.ok && data.hotLeads) {
        // Sortieren: Neueste Termine zuerst
        const sortedLeads = data.hotLeads.sort((a, b) => {
          const dateA = a.terminDatum ? new Date(a.terminDatum) : new Date(0)
          const dateB = b.terminDatum ? new Date(b.terminDatum) : new Date(0)
          return dateB - dateA
        })
        setLeads(sortedLeads)
      } else {
        setError(data.error || 'Fehler beim Laden')
        setLeads([])
      }
    } catch (err) {
      console.error('Leads laden fehlgeschlagen:', err)
      setError('Verbindungsfehler')
      setLeads([])
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadLeads()
    setRefreshing(false)
  }

  // Helper Funktionen
  const safeString = (value) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value[0] || ''
    return String(value)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return '-'
    }
  }

  const formatMoney = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    }).format(value || 0)
  }

  const getStatusStyle = (status) => {
    const option = STATUS_OPTIONS.find(o => o.value === status)
    return option?.color || 'bg-gray-100 text-gray-700'
  }

  // Filter-Logik
  const getFilteredLeads = () => {
    let filtered = leads

    // Status-Filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter)
    }

    // Suche
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(lead => {
        return safeString(lead.unternehmen).toLowerCase().includes(search) ||
               safeString(lead.ansprechpartnerVorname).toLowerCase().includes(search) ||
               safeString(lead.ansprechpartnerNachname).toLowerCase().includes(search) ||
               safeString(lead.email).toLowerCase().includes(search) ||
               safeString(lead.ort).toLowerCase().includes(search)
      })
    }

    return filtered
  }

  const filteredLeads = getFilteredLeads()
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * LEADS_PER_PAGE
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + LEADS_PER_PAGE)

  // Statistiken
  const stats = {
    lead: leads.filter(l => l.status === 'Lead').length,
    angebot: leads.filter(l => l.status === 'Angebot versendet').length,
    gewonnen: leads.filter(l => l.status === 'Abgeschlossen').length,
    verloren: leads.filter(l => l.status === 'Verloren').length,
    gesamt: leads.length
  }

  // Event Handlers
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1)
  }

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value)
    setCurrentPage(1)
  }

  const openModal = (lead) => {
    setSelectedLead(lead)
    setEditData({
      status: lead.status || 'Lead',
      setup: lead.setup || 0,
      retainer: lead.retainer || 0,
      laufzeit: lead.laufzeit || 6,
      kommentar: lead.kommentar || ''
    })
    setEditMode(false)
  }

  const closeModal = () => {
    setSelectedLead(null)
    setEditMode(false)
    setEditData({})
  }

  const handleEditChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!selectedLead) return

    try {
      setSaving(true)

      const response = await fetch('/.netlify/functions/hot-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedLead.id,
          status: editData.status,
          setup: parseFloat(editData.setup) || 0,
          retainer: parseFloat(editData.retainer) || 0,
          laufzeit: parseInt(editData.laufzeit) || 6,
          kommentar: editData.kommentar
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Lokale Liste aktualisieren
        setLeads(prev => prev.map(l => 
          l.id === selectedLead.id 
            ? { ...l, ...editData }
            : l
        ))
        setSelectedLead(prev => ({ ...prev, ...editData }))
        setEditMode(false)
      } else {
        alert('Fehler beim Speichern: ' + (data.error || 'Unbekannt'))
      }
    } catch (err) {
      console.error('Speichern fehlgeschlagen:', err)
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-3 text-gray-600">Lade Leads...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Closing</h1>
          <p className="mt-1 text-gray-500">
            {isAdmin() ? 'Alle Leads im Closing-Prozess' : 'Deine Leads im Closing-Prozess'}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Statistik-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Gesamt</span>
            <Target className="w-5 h-5 text-gray-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{stats.gesamt}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Lead</span>
            <Clock className="w-5 h-5 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-600">{stats.lead}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Angebot</span>
            <FileText className="w-5 h-5 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-purple-600">{stats.angebot}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Gewonnen</span>
            <Award className="w-5 h-5 text-green-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-green-600">{stats.gewonnen}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Verloren</span>
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-red-600">{stats.verloren}</p>
        </div>
      </div>

      {/* Filter & Suche */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Suche */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Firma, Name, Ort suchen..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Status-Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white appearance-none min-w-[180px]"
            >
              <option value="all">Alle Status</option>
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lead-Liste */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="min-h-[500px]">
          {paginatedLeads.length === 0 ? (
            <div className="p-12 text-center">
              <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              {searchTerm || statusFilter !== 'all' ? (
                <div>
                  <p className="text-gray-500 text-lg">Keine Leads gefunden</p>
                  <button 
                    type="button"
                    onClick={() => { setSearchTerm(''); setStatusFilter('all'); setCurrentPage(1); }}
                    className="text-purple-600 hover:text-purple-700 mt-2"
                  >
                    Filter zurücksetzen
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-gray-500 text-lg">Noch keine Leads im Closing</p>
                  <p className="text-gray-400 mt-1">Leads erscheinen hier sobald Termine gebucht werden</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Tabellen-Header */}
              <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-500">
                <div className="col-span-3">Unternehmen</div>
                <div className="col-span-2">Ansprechpartner</div>
                <div className="col-span-2">Termin</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Setter</div>
                <div className="col-span-1"></div>
              </div>

              {/* Lead Rows */}
              <div className="divide-y divide-gray-100">
                {paginatedLeads.map((lead) => (
                  <div 
                    key={lead.id} 
                    onClick={() => openModal(lead)}
                    className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="md:grid md:grid-cols-12 md:gap-4 md:items-center">
                      {/* Unternehmen */}
                      <div className="col-span-3">
                        <p className="font-medium text-gray-900">{safeString(lead.unternehmen) || 'Unbekannt'}</p>
                        <p className="text-sm text-gray-500 md:hidden mt-1">
                          {safeString(lead.ansprechpartnerVorname)} {safeString(lead.ansprechpartnerNachname)}
                        </p>
                      </div>

                      {/* Ansprechpartner */}
                      <div className="col-span-2 hidden md:block">
                        <p className="text-gray-700">
                          {safeString(lead.ansprechpartnerVorname)} {safeString(lead.ansprechpartnerNachname)}
                        </p>
                      </div>

                      {/* Termin */}
                      <div className="col-span-2 hidden md:block">
                        <p className="text-gray-600 text-sm">{formatDate(lead.terminDatum)}</p>
                      </div>

                      {/* Status */}
                      <div className="col-span-2 mt-2 md:mt-0">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusStyle(lead.status)}`}>
                          {lead.status || 'Unbekannt'}
                        </span>
                      </div>

                      {/* Setter */}
                      <div className="col-span-2 hidden md:block">
                        <p className="text-gray-600 text-sm">{safeString(lead.setterName) || '-'}</p>
                      </div>

                      {/* Pfeil */}
                      <div className="col-span-1 hidden md:flex justify-end">
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {filteredLeads.length > LEADS_PER_PAGE && (
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {startIndex + 1}-{Math.min(startIndex + LEADS_PER_PAGE, filteredLeads.length)} von {filteredLeads.length} Leads
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safeCurrentPage === 1}
                      className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-700 px-3">
                      Seite {safeCurrentPage} von {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage === totalPages}
                      className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail/Edit Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={closeModal}
          />

          {/* Modal Content */}
          <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-purple-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {safeString(selectedLead.unternehmen) || 'Lead Details'}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedLead.kategorie || 'Immobilienmakler'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!editMode ? (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="flex items-center px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    Bearbeiten
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-1" />
                    )}
                    Speichern
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-6 space-y-6">
              {/* Status (editierbar) */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Status</label>
                {editMode ? (
                  <select
                    value={editData.status}
                    onChange={(e) => handleEditChange('status', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  >
                    {STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${getStatusStyle(selectedLead.status)}`}>
                    {selectedLead.status || 'Unbekannt'}
                  </span>
                )}
              </div>

              {/* Kontaktdaten Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Ansprechpartner */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-3">Ansprechpartner</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-900">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>{safeString(selectedLead.ansprechpartnerVorname)} {safeString(selectedLead.ansprechpartnerNachname)}</span>
                    </div>
                    {safeString(selectedLead.email) && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <a href={`mailto:${safeString(selectedLead.email)}`} className="text-purple-600 hover:underline">
                          {safeString(selectedLead.email)}
                        </a>
                      </div>
                    )}
                    {safeString(selectedLead.telefon) && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <a href={`tel:${safeString(selectedLead.telefon)}`} className="text-purple-600 hover:underline">
                          {safeString(selectedLead.telefon)}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Standort & Web */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-3">Standort & Web</h4>
                  <div className="space-y-2">
                    {(safeString(selectedLead.ort) || safeString(selectedLead.bundesland)) && (
                      <div className="flex items-center gap-2 text-gray-900">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>{[safeString(selectedLead.ort), safeString(selectedLead.bundesland)].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                    {safeString(selectedLead.website) && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <a 
                          href={safeString(selectedLead.website).startsWith('http') ? safeString(selectedLead.website) : `https://${safeString(selectedLead.website)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:underline truncate"
                        >
                          {safeString(selectedLead.website)}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Termin & Zuständig */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-3">Termin</h4>
                  <div className="flex items-center gap-2 text-gray-900">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{formatDate(selectedLead.terminDatum)}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-3">Zuständig</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">Setter:</span> <span className="text-gray-900">{safeString(selectedLead.setterName) || '-'}</span></p>
                    <p><span className="text-gray-500">Closer:</span> <span className="text-gray-900">{safeString(selectedLead.closerName) || '-'}</span></p>
                  </div>
                </div>
              </div>

              {/* Deal-Werte (editierbar) */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-3">Deal-Details</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  {editMode ? (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Setup (€)</label>
                        <input
                          type="number"
                          value={editData.setup}
                          onChange={(e) => handleEditChange('setup', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                          min="0"
                          step="100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Retainer (€/Mon)</label>
                        <input
                          type="number"
                          value={editData.retainer}
                          onChange={(e) => handleEditChange('retainer', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                          min="0"
                          step="100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Laufzeit (Monate)</label>
                        <input
                          type="number"
                          value={editData.laufzeit}
                          onChange={(e) => handleEditChange('laufzeit', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                          min="1"
                          max="36"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <span className="block text-sm text-gray-500">Setup</span>
                        <span className="text-lg font-semibold text-gray-900">{formatMoney(selectedLead.setup)}</span>
                      </div>
                      <div>
                        <span className="block text-sm text-gray-500">Retainer</span>
                        <span className="text-lg font-semibold text-gray-900">{formatMoney(selectedLead.retainer)}/Mon</span>
                      </div>
                      <div>
                        <span className="block text-sm text-gray-500">Laufzeit</span>
                        <span className="text-lg font-semibold text-gray-900">{selectedLead.laufzeit || 6} Monate</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Gesamtwert */}
                  <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                    <span className="text-sm text-gray-500">Gesamtwert: </span>
                    <span className="text-xl font-bold text-green-600">
                      {formatMoney(
                        (editMode ? parseFloat(editData.setup) || 0 : selectedLead.setup || 0) + 
                        (editMode ? parseFloat(editData.retainer) || 0 : selectedLead.retainer || 0) * 
                        (editMode ? parseInt(editData.laufzeit) || 6 : selectedLead.laufzeit || 6)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notizen (editierbar) */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-3">Notizen</h4>
                {editMode ? (
                  <textarea
                    value={editData.kommentar}
                    onChange={(e) => handleEditChange('kommentar', e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                    placeholder="Notizen zum Lead..."
                  />
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 min-h-[100px]">
                    {selectedLead.kommentar ? (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedLead.kommentar}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Keine Notizen vorhanden</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              {editMode && (
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
              )}
              <button
                type="button"
                onClick={editMode ? handleSave : closeModal}
                disabled={saving}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {editMode ? (saving ? 'Speichern...' : 'Speichern') : 'Schließen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Closing
