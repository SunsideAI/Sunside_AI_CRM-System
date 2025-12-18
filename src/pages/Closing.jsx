import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { 
  Calendar, 
  Users,
  User as UserIcon,
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
  Edit3,
  Save,
  Filter,
  Send,
  FileText,
  Euro,
  Package
} from 'lucide-react'

// Paket-Optionen für Angebot
const PAKET_OPTIONS = [
  { 
    value: 'S', 
    label: 'Paket S (<500 Besucher)', 
    setup: 999, 
    retainer: 349,
    description: '999 € Setup + 349 €/Monat'
  },
  { 
    value: 'M', 
    label: 'Paket M (500-1000 Besucher)', 
    setup: 1199, 
    retainer: 449,
    description: '1.199 € Setup + 449 €/Monat'
  },
  { 
    value: 'L', 
    label: 'Paket L (1000-1500 Besucher)', 
    setup: 1499, 
    retainer: 549,
    description: '1.499 € Setup + 549 €/Monat'
  },
  { 
    value: 'XL', 
    label: 'Paket XL (>1500 Besucher)', 
    setup: 1799, 
    retainer: 649,
    description: '1.799 € Setup + 649 €/Monat'
  },
  { 
    value: 'individuell', 
    label: 'Individueller Preis', 
    setup: null, 
    retainer: null,
    description: 'Setup manuell eingeben'
  }
]

// Status-Optionen für Dropdown
const STATUS_OPTIONS = [
  { value: 'Lead', label: 'Lead', color: 'bg-blue-100 text-blue-700' },
  { value: 'Angebot', label: 'Angebot', color: 'bg-yellow-100 text-yellow-700' },
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
  const [viewMode, setViewMode] = useState('own') // 'own' oder 'all' (für Admins)
  
  // Angebot-View State (innerhalb des Modals)
  const [showAngebotView, setShowAngebotView] = useState(false)
  const [angebotData, setAngebotData] = useState({
    paket: '',
    setup: '',
    retainer: ''
  })
  const [sendingAngebot, setSendingAngebot] = useState(false)

  const LEADS_PER_PAGE = 10

  // Retainer aus Setup berechnen (Setup / 2.75, abgerundet auf gerade Beträge, max 10% nach unten)
  const calculateRetainer = (setup) => {
    if (!setup || isNaN(setup)) return ''
    const rawRetainer = setup / 2.75
    const evenRetainer = Math.floor(rawRetainer / 10) * 10 // Auf 10er abrunden
    const minRetainer = rawRetainer * 0.9 // Max 10% weniger
    // Wenn zu viel abgerundet, auf nächsten 10er aufrunden
    if (evenRetainer < minRetainer) {
      return Math.ceil(rawRetainer / 10) * 10
    }
    return evenRetainer
  }

  // Paket-Auswahl Handler
  const handlePaketChange = (paketValue) => {
    const paket = PAKET_OPTIONS.find(p => p.value === paketValue)
    if (paket) {
      if (paket.value === 'individuell') {
        setAngebotData({
          paket: paketValue,
          setup: '',
          retainer: ''
        })
      } else {
        setAngebotData({
          paket: paketValue,
          setup: paket.setup,
          retainer: paket.retainer
        })
      }
    }
  }

  // Setup ändern bei individuellem Preis
  const handleSetupChange = (value) => {
    const setup = parseFloat(value) || ''
    const retainer = setup ? calculateRetainer(setup) : ''
    setAngebotData(prev => ({
      ...prev,
      setup,
      retainer
    }))
  }

  // Angebot absenden
  const handleSendAngebot = async () => {
    if (!selectedLead || !angebotData.setup || !angebotData.retainer) return
    
    try {
      setSendingAngebot(true)
      
      // Hot Lead updaten mit Setup, Retainer und Status
      const response = await fetch('/.netlify/functions/hot-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotLeadId: selectedLead.id,
          updates: {
            setup: parseFloat(angebotData.setup),
            retainer: parseFloat(angebotData.retainer),
            status: 'Angebot'  // Zapier sendet dann das Angebot und setzt auf "Angebot versendet"
          }
        })
      })
      
      if (!response.ok) {
        throw new Error('Fehler beim Speichern')
      }
      
      // Lead in Liste aktualisieren
      setLeads(prev => prev.map(lead => 
        lead.id === selectedLead.id 
          ? { 
              ...lead, 
              setup: parseFloat(angebotData.setup),
              retainer: parseFloat(angebotData.retainer),
              status: 'Angebot'
            }
          : lead
      ))
      
      // Selected Lead auch aktualisieren
      setSelectedLead(prev => ({
        ...prev,
        setup: parseFloat(angebotData.setup),
        retainer: parseFloat(angebotData.retainer),
        status: 'Angebot'
      }))
      
      // View zurücksetzen
      setShowAngebotView(false)
      setAngebotData({ paket: '', setup: '', retainer: '' })
      
    } catch (err) {
      console.error('Fehler beim Senden des Angebots:', err)
      alert('Fehler beim Senden des Angebots')
    } finally {
      setSendingAngebot(false)
    }
  }

  useEffect(() => {
    loadLeads()
  }, [user, viewMode])

  const loadLeads = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)

      // Closer sehen nur eigene Leads
      // Admin: Je nach viewMode eigene oder alle
      const userName = user.vor_nachname || user.name
      let url = '/.netlify/functions/hot-leads'
      
      if (!isAdmin()) {
        // Closer: Immer nur eigene Leads (nach closerName filtern)
        url += `?closerName=${encodeURIComponent(userName)}`
      } else if (viewMode === 'own') {
        // Admin mit "Meine Leads": Nach closerName filtern
        url += `?closerName=${encodeURIComponent(userName)}`
      }
      // Admin mit "Alle Leads": Kein Filter, alle Hot Leads laden

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
    setShowAngebotView(false)
    setAngebotData({ paket: '', setup: '', retainer: '' })
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
        <span className="ml-3 text-gray-600">Leads werden geladen...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Closing
            {isAdmin() && viewMode === 'all' && ' (alle Leads)'}
          </h1>
          <p className="mt-1 text-gray-500">
            {viewMode === 'own' ? 'Deine Leads im Closing-Prozess' : 'Alle Leads im Closing-Prozess'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Toggle für Admins: Meine / Alle Leads */}
          {isAdmin() && (
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => { setViewMode('own'); setCurrentPage(1); }}
                className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'own' 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <UserIcon className="w-4 h-4 mr-1.5" />
                Meine Leads
              </button>
              <button
                onClick={() => { setViewMode('all'); setCurrentPage(1); }}
                className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'all' 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users className="w-4 h-4 mr-1.5" />
                Alle Leads
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

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

          {/* Aktualisieren */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Lead-Liste */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[600px]">
        <div>
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
                <div className={isAdmin() && viewMode === 'all' ? 'col-span-3' : 'col-span-3'}>Unternehmen</div>
                <div className="col-span-2">Ansprechpartner</div>
                <div className="col-span-2">Termin</div>
                <div className="col-span-2">Status</div>
                {isAdmin() && viewMode === 'all' ? (
                  <>
                    <div className="col-span-1">Closer</div>
                    <div className="col-span-1">Coldcaller</div>
                  </>
                ) : (
                  <div className="col-span-2">Coldcaller</div>
                )}
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

                      {/* Closer - nur bei "Alle Leads" für Admins */}
                      {isAdmin() && viewMode === 'all' && (
                        <div className="col-span-1 hidden md:block">
                          <p className="text-gray-600 text-sm">{safeString(lead.closerName) || '-'}</p>
                        </div>
                      )}

                      {/* Coldcaller */}
                      <div className={`hidden md:block ${isAdmin() && viewMode === 'all' ? 'col-span-1' : 'col-span-2'}`}>
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
      {selectedLead && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={closeModal}
          />

          {/* Modal Content */}
          <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-purple-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {safeString(selectedLead.unternehmen) || 'Lead Details'}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedLead.kategorie || 'Immobilienmakler'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body - Scrollbar hier */}
            <div className="flex-1 overflow-y-auto">
              {showAngebotView ? (
                /* ========================================
                   ANGEBOT VERSENDEN VIEW
                   ======================================== */
                <div className="px-6 py-6">
                  {/* Zurück-Link */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAngebotView(false)
                      setAngebotData({ paket: '', setup: '', retainer: '' })
                    }}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Zurück zur Übersicht
                  </button>

                  {/* Angebot Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <FileText className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Angebot konfigurieren</h3>
                      <p className="text-sm text-gray-500">Wähle ein Paket oder erstelle ein individuelles Angebot</p>
                    </div>
                  </div>

                  {/* Paket-Auswahl als Cards */}
                  <div className="space-y-3 mb-6">
                    {PAKET_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handlePaketChange(option.value)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                          angebotData.paket === option.value
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              angebotData.paket === option.value
                                ? 'border-green-500 bg-green-500'
                                : 'border-gray-300'
                            }`}>
                              {angebotData.paket === option.value && (
                                <div className="w-2 h-2 bg-white rounded-full" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{option.label}</p>
                              {option.value !== 'individuell' && (
                                <p className="text-sm text-gray-500">{option.description}</p>
                              )}
                            </div>
                          </div>
                          {option.value !== 'individuell' && (
                            <div className="text-right">
                              <p className="font-bold text-gray-900">{option.setup} €</p>
                              <p className="text-sm text-gray-500">+ {option.retainer} €/Mon</p>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Individuelle Preiseingabe */}
                  {angebotData.paket === 'individuell' && (
                    <div className="bg-gray-50 rounded-xl p-5 mb-6">
                      <h4 className="font-medium text-gray-900 mb-4">Individuellen Preis festlegen</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Setup-Gebühr (netto)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={angebotData.setup}
                              onChange={(e) => handleSetupChange(e.target.value)}
                              placeholder="z.B. 1500"
                              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">€</span>
                          </div>
                        </div>

                        {angebotData.setup && angebotData.retainer && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-700 mb-1">Automatisch berechneter Retainer</p>
                            <p className="text-sm text-blue-600">
                              {angebotData.setup} € / 2,75 = <span className="font-bold text-blue-800">{angebotData.retainer} €/Monat</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Zusammenfassung */}
                  {angebotData.setup && angebotData.retainer && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                      <h4 className="font-medium text-green-900 mb-4">Angebot Zusammenfassung</h4>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-white rounded-lg p-4 text-center">
                          <p className="text-sm text-gray-500 mb-1">Setup-Gebühr</p>
                          <p className="text-2xl font-bold text-gray-900">{angebotData.setup} €</p>
                          <p className="text-xs text-gray-400">einmalig, netto</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center">
                          <p className="text-sm text-gray-500 mb-1">Monatlicher Retainer</p>
                          <p className="text-2xl font-bold text-gray-900">{angebotData.retainer} €</p>
                          <p className="text-xs text-gray-400">pro Monat, netto</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-500 mb-1">Gesamtwert (12 Monate)</p>
                        <p className="text-3xl font-bold text-green-600">
                          {(parseFloat(angebotData.setup) + parseFloat(angebotData.retainer) * 12).toLocaleString('de-DE')} €
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ========================================
                   NORMALE LEAD-DETAIL-ANSICHT
                   ======================================== */
                <div className="px-6 py-6 space-y-6">
                  {/* Angebot versenden Button */}
                  {selectedLead.status === 'Lead' && !editMode && (
                    <button
                      type="button"
                      onClick={() => setShowAngebotView(true)}
                      className="w-full flex items-center justify-center px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Angebot versenden
                    </button>
                  )}

                  {/* Status */}
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
                        <p><span className="text-gray-500">Coldcaller:</span> <span className="text-gray-900">{safeString(selectedLead.setterName) || '-'}</span></p>
                        <p><span className="text-gray-500">Closer:</span> <span className="text-gray-900">{safeString(selectedLead.closerName) || '-'}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Deal-Werte */}
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

                  {/* Notizen */}
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
              )}
            </div>

            {/* Footer - unterschiedlich je nach View */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              {showAngebotView ? (
                /* Angebot-View Footer */
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAngebotView(false)
                      setAngebotData({ paket: '', setup: '', retainer: '' })
                    }}
                    disabled={sendingAngebot}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={handleSendAngebot}
                    disabled={!angebotData.setup || !angebotData.retainer || sendingAngebot}
                    className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sendingAngebot ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Wird gespeichert...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Angebot speichern
                      </>
                    )}
                  </button>
                </>
              ) : editMode ? (
                /* Edit-Mode Footer */
                <>
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Speichern
                  </button>
                </>
              ) : (
                /* Normal-View Footer */
                <>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Schließen
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Bearbeiten
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default Closing
