import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import TerminPicker from '../components/TerminPicker'
import EmailComposer from '../components/EmailComposer'
import {
  Search,
  Filter,
  Phone,
  Mail,
  Globe,
  MapPin,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  RefreshCw,
  Users,
  User as UserIcon,
  Send
} from 'lucide-react'

// Ergebnis-Optionen (aus Airtable)
const ERGEBNIS_OPTIONEN = [
  { value: '', label: 'Kein Ergebnis', color: 'gray' },
  { value: 'Nicht erreicht', label: 'Nicht erreicht', color: 'yellow' },
  { value: 'Kein Interesse', label: 'Kein Interesse', color: 'red' },
  { value: 'Erstgespräch', label: 'Erstgespräch', color: 'green' },
  { value: 'Unterlage bereitstellen', label: 'Unterlage bereitstellen', color: 'blue' }
]

function getErgebnisColor(ergebnis) {
  const option = ERGEBNIS_OPTIONEN.find(o => o.value === ergebnis)
  const colors = {
    gray: 'bg-gray-100 text-gray-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    orange: 'bg-orange-100 text-orange-700'
  }
  return colors[option?.color || 'gray']
}

function Kaltakquise() {
  const { user, isAdmin } = useAuth()
  
  // State
  const [leads, setLeads] = useState([])
  const [users, setUsers] = useState([]) // Liste aller Vertriebler für Filter
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterContacted, setFilterContacted] = useState('all') // 'all', 'true', 'false'
  const [filterResult, setFilterResult] = useState('all')
  const [filterVertriebler, setFilterVertriebler] = useState('all') // NEU: Vertriebler-Filter
  const [viewMode, setViewMode] = useState('own') // 'all' oder 'own' (für Admins)
  const [offset, setOffset] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [pageHistory, setPageHistory] = useState([])
  
  // Modal State
  const [selectedLead, setSelectedLead] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showTerminPicker, setShowTerminPicker] = useState(false)
  const [showEmailComposer, setShowEmailComposer] = useState(false)
  const [editForm, setEditForm] = useState({
    kontaktiert: false,
    ergebnis: '',
    kommentar: ''
  })

  // Leads laden
  const loadLeads = useCallback(async (newOffset = null, addToHistory = false) => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      params.append('userName', user?.vor_nachname || '')
      params.append('userRole', isAdmin() ? 'Admin' : 'Setter')
      params.append('view', viewMode)
      params.append('limit', '50')
      
      if (search) params.append('search', search)
      if (filterContacted !== 'all') params.append('contacted', filterContacted)
      if (filterResult !== 'all') params.append('result', filterResult)
      if (filterVertriebler !== 'all') params.append('vertriebler', filterVertriebler)
      if (newOffset) params.append('offset', newOffset)

      const response = await fetch(`/.netlify/functions/leads?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Laden')
      }

      setLeads(data.leads)
      setHasMore(data.hasMore)
      
      // User-Liste für Filter speichern (nur beim ersten Laden)
      if (data.users && data.users.length > 0) {
        setUsers(data.users)
      }
      
      if (addToHistory && offset) {
        setPageHistory(prev => [...prev, offset])
      }
      setOffset(data.offset)

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user?.vor_nachname, isAdmin, viewMode, search, filterContacted, filterResult, filterVertriebler, offset])

  // Initial laden
  useEffect(() => {
    loadLeads()
  }, [viewMode, search, filterContacted, filterResult, filterVertriebler])

  // Suche mit Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setOffset(null)
      setPageHistory([])
    }, 500)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Nächste Seite
  const nextPage = () => {
    if (hasMore && offset) {
      loadLeads(offset, true)
    }
  }

  // Vorherige Seite
  const prevPage = () => {
    if (pageHistory.length > 0) {
      const newHistory = [...pageHistory]
      const prevOffset = newHistory.pop()
      setPageHistory(newHistory)
      loadLeads(newHistory[newHistory.length - 1] || null, false)
    }
  }

  // Lead auswählen
  const openLead = (lead) => {
    setSelectedLead(lead)
    setEditForm({
      kontaktiert: lead.kontaktiert,
      ergebnis: lead.ergebnis,
      kommentar: lead.kommentar
    })
    setEditMode(false)
    setShowTerminPicker(false)
    setShowEmailComposer(false)
  }

  // Lead speichern
  const saveLead = async () => {
    if (!selectedLead) return
    setSaving(true)

    try {
      const response = await fetch('/.netlify/functions/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          updates: editForm
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Speichern')
      }

      // Lead in Liste aktualisieren
      setLeads(prev => prev.map(lead => 
        lead.id === selectedLead.id 
          ? { ...lead, ...editForm }
          : lead
      ))

      // Modal aktualisieren
      setSelectedLead(prev => ({ ...prev, ...editForm }))
      setEditMode(false)

    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Quick-Action: Als kontaktiert markieren
  const markAsContacted = async (lead, e) => {
    e.stopPropagation()
    
    try {
      const response = await fetch('/.netlify/functions/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          updates: { kontaktiert: !lead.kontaktiert }
        })
      })

      if (!response.ok) {
        throw new Error('Fehler beim Aktualisieren')
      }

      // Lead in Liste aktualisieren
      setLeads(prev => prev.map(l => 
        l.id === lead.id 
          ? { ...l, kontaktiert: !l.kontaktiert }
          : l
      ))

    } catch (err) {
      alert(err.message)
    }
  }

  // Prüfen ob "Unterlagen senden" Button angezeigt werden soll
  const showUnterlagenButton = (lead) => {
    if (!lead?.ergebnis) return false
    const ergebnis = lead.ergebnis.toLowerCase()
    return ergebnis.includes('unterlage') || ergebnis.includes('unterlagen')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kaltakquise</h1>
          <p className="mt-1 text-gray-500">
            {leads.length} Leads geladen
            {isAdmin() && viewMode === 'all' && ' (alle Leads)'}
          </p>
        </div>

        {/* Admin: Toggle zwischen allen und eigenen Leads */}
        {isAdmin() && (
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => { setViewMode('own'); setOffset(null); setPageHistory([]); setFilterVertriebler('all'); setLeads([]); }}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'own' 
                  ? 'bg-white text-sunside-primary shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserIcon className="w-4 h-4 mr-1.5" />
              Meine Leads
            </button>
            <button
              onClick={() => { setViewMode('all'); setOffset(null); setPageHistory([]); setLeads([]); }}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'all' 
                  ? 'bg-white text-sunside-primary shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4 mr-1.5" />
              Alle Leads
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Suche */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Firma oder Stadt suchen..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
            />
          </div>

          {/* Filter: Kontaktiert */}
          <select
            value={filterContacted}
            onChange={(e) => { setFilterContacted(e.target.value); setOffset(null); setPageHistory([]); setLeads([]); }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none bg-white"
          >
            <option value="all">Alle Status</option>
            <option value="false">Nicht kontaktiert</option>
            <option value="true">Bereits kontaktiert</option>
          </select>

          {/* Filter: Ergebnis */}
          <select
            value={filterResult}
            onChange={(e) => { setFilterResult(e.target.value); setOffset(null); setPageHistory([]); setLeads([]); }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none bg-white"
          >
            <option value="all">Alle Ergebnisse</option>
            {ERGEBNIS_OPTIONEN.filter(o => o.value).map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          {/* Filter: Vertriebler (nur für Admins bei "Alle Leads") */}
          {isAdmin() && viewMode === 'all' && (
            <select
              value={filterVertriebler}
              onChange={(e) => { setFilterVertriebler(e.target.value); setOffset(null); setPageHistory([]); setLeads([]); }}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none bg-white"
            >
              <option value="all">Alle Vertriebler</option>
              {users.map(u => (
                <option key={u.id} value={u.name}>{u.name}</option>
              ))}
            </select>
          )}

          {/* Refresh */}
          <button
            onClick={() => loadLeads()}
            disabled={loading}
            className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Tabelle */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-sunside-primary mb-4" />
            <p className="text-gray-500">Leads werden geladen...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Keine Leads gefunden</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Unternehmen
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                    Standort
                  </th>
                  {/* Vertriebler-Spalte nur bei "Alle Leads" */}
                  {isAdmin() && viewMode === 'all' && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                      Vertriebler
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                    Kontakt
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ergebnis
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden xl:table-cell">
                    Kommentar
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr 
                    key={lead.id}
                    onClick={() => openLead(lead)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    {/* Status */}
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => markAsContacted(lead, e)}
                        className={`p-1.5 rounded-full transition-colors ${
                          lead.kontaktiert 
                            ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {lead.kontaktiert ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Phone className="w-5 h-5" />
                        )}
                      </button>
                    </td>

                    {/* Unternehmen */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{lead.unternehmensname}</div>
                      <div className="text-sm text-gray-500">{lead.kategorie}</div>
                    </td>

                    {/* Standort */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center text-gray-600">
                        <MapPin className="w-4 h-4 mr-1.5 text-gray-400" />
                        {lead.stadt}
                      </div>
                    </td>

                    {/* Vertriebler - nur bei "Alle Leads" */}
                    {isAdmin() && viewMode === 'all' && (
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {lead.zugewiesenAn && lead.zugewiesenAn.length > 0 ? (
                          <div className="flex items-center text-gray-600">
                            <UserIcon className="w-4 h-4 mr-1.5 text-gray-400" />
                            <span className="truncate max-w-[150px]">
                              {lead.zugewiesenAn.join(', ')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                    )}

                    {/* Kontakt */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="space-y-1">
                        {lead.telefon && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                            {lead.telefon}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                            <span className="truncate max-w-[150px]">{lead.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Ergebnis */}
                    <td className="px-4 py-3">
                      {lead.ergebnis ? (
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getErgebnisColor(lead.ergebnis)}`}>
                          {lead.ergebnis}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>

                    {/* Kommentar */}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {lead.kommentar ? (
                        <div className="flex items-center text-sm text-gray-600">
                          <MessageSquare className="w-4 h-4 mr-1.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">{lead.kommentar}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {(hasMore || pageHistory.length > 0) && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <button
              onClick={prevPage}
              disabled={pageHistory.length === 0}
              className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Zurück
            </button>
            <span className="text-sm text-gray-500">
              Seite {pageHistory.length + 1}
            </span>
            <button
              onClick={nextPage}
              disabled={!hasMore}
              className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Weiter
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        )}
      </div>

      {/* Lead Detail Modal - Portal rendert direkt in body */}
      {selectedLead && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedLead.unternehmensname}</h2>
                <p className="text-sm text-gray-500">{selectedLead.kategorie}</p>
              </div>
              <button
                onClick={() => { setSelectedLead(null); setShowTerminPicker(false); setShowEmailComposer(false); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-200px)]">
              {showTerminPicker ? (
                // Termin-Picker anzeigen
                <TerminPicker
                  lead={selectedLead}
                  onTerminBooked={(termin) => {
                    setShowTerminPicker(false)
                    setSelectedLead(null)
                    setEditMode(false)
                    loadLeads() // Leads neu laden
                  }}
                  onCancel={() => setShowTerminPicker(false)}
                />
              ) : showEmailComposer ? (
                // Email Composer anzeigen
                <EmailComposer
                  lead={selectedLead}
                  user={user}
                  inline={true}
                  onClose={() => setShowEmailComposer(false)}
                  onSent={(info) => {
                    console.log('E-Mail gesendet:', info)
                    setShowEmailComposer(false)
                    setSelectedLead(null)
                    loadLeads()
                  }}
                />
              ) : (
                <>
              {/* Kontaktdaten */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {selectedLead.telefon && (
                  <a 
                    href={`tel:${selectedLead.telefon}`}
                    className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Phone className="w-5 h-5 text-sunside-primary mr-3" />
                    <span className="text-gray-900">{selectedLead.telefon}</span>
                  </a>
                )}
                {selectedLead.email && (
                  <a 
                    href={`mailto:${selectedLead.email}`}
                    className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Mail className="w-5 h-5 text-sunside-primary mr-3" />
                    <span className="text-gray-900 truncate">{selectedLead.email}</span>
                  </a>
                )}
                {selectedLead.website && (
                  <a 
                    href={selectedLead.website.startsWith('http') ? selectedLead.website : `https://${selectedLead.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Globe className="w-5 h-5 text-sunside-primary mr-3" />
                    <span className="text-gray-900 truncate">{selectedLead.website}</span>
                  </a>
                )}
                <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <MapPin className="w-5 h-5 text-sunside-primary mr-3" />
                  <span className="text-gray-900">{selectedLead.stadt}</span>
                </div>
                {/* Vertriebler anzeigen wenn vorhanden */}
                {selectedLead.zugewiesenAn && selectedLead.zugewiesenAn.length > 0 && (
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <UserIcon className="w-5 h-5 text-sunside-primary mr-3" />
                    <div>
                      <span className="text-xs text-gray-400">Zugewiesen an</span>
                      <p className="text-gray-900">{selectedLead.zugewiesenAn.join(', ')}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status & Bearbeitung */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Status & Notizen</h3>

                {editMode ? (
                  // Bearbeitungsmodus
                  <div className="space-y-4">
                    {/* Kontaktiert */}
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editForm.kontaktiert}
                        onChange={(e) => setEditForm(prev => ({ ...prev, kontaktiert: e.target.checked }))}
                        className="w-5 h-5 text-sunside-primary rounded border-gray-300 focus:ring-sunside-primary"
                      />
                      <span className="ml-3 text-gray-700">Bereits kontaktiert</span>
                    </label>

                    {/* Ergebnis */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ergebnis</label>
                      <select
                        value={editForm.ergebnis}
                        onChange={(e) => setEditForm(prev => ({ ...prev, ergebnis: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
                      >
                        {ERGEBNIS_OPTIONEN.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      
                      {/* Termin buchen Button bei Erstgespräch */}
                      {editForm.ergebnis === 'Erstgespräch' && (
                        <button
                          onClick={() => setShowTerminPicker(true)}
                          className="mt-3 w-full flex items-center justify-center px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          Termin mit Closer buchen
                        </button>
                      )}
                      
                      {/* Unterlagen senden Button */}
                      {showUnterlagenButton({ ergebnis: editForm.ergebnis }) && (
                        <button
                          onClick={() => setShowEmailComposer(true)}
                          className="mt-3 w-full flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Unterlagen senden
                        </button>
                      )}
                    </div>

                    {/* Kommentar */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kommentar</label>
                      <textarea
                        value={editForm.kommentar}
                        onChange={(e) => setEditForm(prev => ({ ...prev, kommentar: e.target.value }))}
                        rows={3}
                        placeholder="Notizen zum Gespräch..."
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  // Anzeigemodus
                  <div className="space-y-3">
                    <div className="flex items-center">
                      {selectedLead.kontaktiert ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400 mr-2" />
                      )}
                      <span className={selectedLead.kontaktiert ? 'text-green-700' : 'text-gray-500'}>
                        {selectedLead.kontaktiert ? 'Bereits kontaktiert' : 'Noch nicht kontaktiert'}
                      </span>
                      {selectedLead.datum && (
                        <span className="ml-2 text-sm text-gray-400">
                          ({new Date(selectedLead.datum).toLocaleDateString('de-DE')})
                        </span>
                      )}
                    </div>

                    {selectedLead.ergebnis && (
                      <div className="flex items-center">
                        <Clock className="w-5 h-5 text-gray-400 mr-2" />
                        <span className={`px-2.5 py-1 rounded-full text-sm font-medium ${getErgebnisColor(selectedLead.ergebnis)}`}>
                          {selectedLead.ergebnis}
                        </span>
                      </div>
                    )}

                    {selectedLead.kommentar && (
                      <div className="flex items-start">
                        <MessageSquare className="w-5 h-5 text-gray-400 mr-2 mt-0.5" />
                        <p className="text-gray-700 whitespace-pre-line">{selectedLead.kommentar}</p>
                      </div>
                    )}

                    {!selectedLead.kontaktiert && !selectedLead.ergebnis && !selectedLead.kommentar && (
                      <p className="text-gray-400 italic">Noch keine Notizen vorhanden</p>
                    )}
                  </div>
                )}
              </div>
                </>
              )}
            </div>

            {/* Modal Footer - nur zeigen wenn weder TerminPicker noch EmailComposer */}
            {!showTerminPicker && !showEmailComposer && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                {editMode ? (
                  <>
                    <button
                      onClick={() => setEditMode(false)}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={saveLead}
                      disabled={saving}
                      className="flex items-center px-4 py-2 bg-sunside-primary text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Speichern
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setSelectedLead(null); setShowTerminPicker(false); setShowEmailComposer(false); }}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Schließen
                    </button>
                    <button
                      onClick={() => setEditMode(true)}
                      className="px-4 py-2 bg-sunside-primary text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Bearbeiten
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}

export default Kaltakquise
