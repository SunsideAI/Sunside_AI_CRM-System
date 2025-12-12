import { useState, useEffect, useCallback, useRef } from 'react'
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
  Send,
  Plus,
  AlertCircle
} from 'lucide-react'

// Ergebnis-Optionen (aus Airtable)
const ERGEBNIS_OPTIONEN = [
  { value: '', label: 'Kein Ergebnis', color: 'gray' },
  { value: 'Nicht erreicht', label: 'Nicht erreicht', color: 'yellow' },
  { value: 'Kein Interesse', label: 'Kein Interesse', color: 'red' },
  { value: 'Beratungsgespräch', label: 'Beratungsgespräch', color: 'green' },
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
    kommentar: '',
    ansprechpartnerVorname: '',
    ansprechpartnerNachname: '',
    neuerKommentar: '', // Für neuen manuellen Kommentar
    ansprechpartnerValidation: false // Für Validierung beim Button-Klick
  })
  
  // Auto-Save State
  const [autoSaving, setAutoSaving] = useState(false)
  const autoSaveTimeoutRef = useRef(null)

  // Lead-Anfragen State
  const [showAnfrageModal, setShowAnfrageModal] = useState(false)
  const [anfrageAnzahl, setAnfrageAnzahl] = useState(100)
  const [anfrageNachricht, setAnfrageNachricht] = useState('')
  const [anfrageSending, setAnfrageSending] = useState(false)
  const [offeneAnfrage, setOffeneAnfrage] = useState(null)
  const [anfrageError, setAnfrageError] = useState('')

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

  // Offene Lead-Anfrage laden
  useEffect(() => {
    const loadOffeneAnfrage = async () => {
      if (!user?.id) return
      try {
        const response = await fetch(`/.netlify/functions/lead-requests?userId=${user.id}&status=Offen&isAdmin=false`)
        if (response.ok) {
          const data = await response.json()
          if (data.anfragen && data.anfragen.length > 0) {
            setOffeneAnfrage(data.anfragen[0])
          } else {
            setOffeneAnfrage(null)
          }
        }
      } catch (err) {
        console.error('Fehler beim Laden der Anfrage:', err)
      }
    }
    loadOffeneAnfrage()
  }, [user?.id])

  // Lead-Anfrage senden
  const sendLeadAnfrage = async () => {
    if (!anfrageAnzahl || anfrageAnzahl < 1) {
      setAnfrageError('Bitte gib eine gültige Anzahl ein')
      return
    }

    setAnfrageSending(true)
    setAnfrageError('')

    try {
      const response = await fetch('/.netlify/functions/lead-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          anzahl: anfrageAnzahl,
          nachricht: anfrageNachricht
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Anfrage konnte nicht gesendet werden')
      }

      // Erfolg - Modal schließen und Status aktualisieren
      setShowAnfrageModal(false)
      setOffeneAnfrage({
        anfrageId: data.anfrage.anfrageId,
        anzahl: anfrageAnzahl,
        status: 'Offen',
        erstelltAm: new Date().toISOString()
      })
      setAnfrageAnzahl(100)
      setAnfrageNachricht('')

    } catch (err) {
      setAnfrageError(err.message)
    } finally {
      setAnfrageSending(false)
    }
  }

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
      kommentar: lead.kommentar,
      ansprechpartnerVorname: lead.ansprechpartnerVorname || '',
      ansprechpartnerNachname: lead.ansprechpartnerNachname || '',
      neuerKommentar: '',
      ansprechpartnerValidation: false
    })
    setEditMode(false)
    setShowTerminPicker(false)
    setShowEmailComposer(false)
  }

  // Auto-Save für Ansprechpartner-Felder (mit Debounce)
  const autoSaveAnsprechpartner = useCallback(async (leadId, vorname, nachname) => {
    setAutoSaving(true)
    try {
      await fetch('/.netlify/functions/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          updates: {
            ansprechpartnerVorname: vorname,
            ansprechpartnerNachname: nachname
          }
        })
      })
      
      // Lead in Liste aktualisieren
      setLeads(prev => prev.map(lead => 
        lead.id === leadId 
          ? { ...lead, ansprechpartnerVorname: vorname, ansprechpartnerNachname: nachname }
          : lead
      ))
      
      // Auch selectedLead aktualisieren
      if (selectedLead?.id === leadId) {
        setSelectedLead(prev => ({ 
          ...prev, 
          ansprechpartnerVorname: vorname, 
          ansprechpartnerNachname: nachname 
        }))
      }
    } catch (err) {
      console.error('Auto-Save Fehler:', err)
    } finally {
      setAutoSaving(false)
    }
  }, [selectedLead])

  // Handler für Ansprechpartner-Änderungen mit Debounce
  const handleAnsprechpartnerChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
    
    // Debounced Auto-Save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (selectedLead) {
        const vorname = field === 'ansprechpartnerVorname' ? value : editForm.ansprechpartnerVorname
        const nachname = field === 'ansprechpartnerNachname' ? value : editForm.ansprechpartnerNachname
        autoSaveAnsprechpartner(selectedLead.id, vorname, nachname)
      }
    }, 800) // 800ms Verzögerung
  }

  // Lead speichern
  const saveLead = async () => {
    if (!selectedLead) return
    setSaving(true)

    try {
      // History-Einträge sammeln
      const historyEntries = []
      
      // Ergebnis geändert?
      if (editForm.ergebnis !== selectedLead.ergebnis) {
        const ergebnisText = editForm.ergebnis || 'Kein Ergebnis'
        historyEntries.push({
          action: 'ergebnis',
          details: `Ergebnis: ${ergebnisText}`,
          userName: user?.name || 'Unbekannt'
        })
      }
      
      // Kontaktiert geändert?
      if (editForm.kontaktiert !== selectedLead.kontaktiert) {
        historyEntries.push({
          action: editForm.kontaktiert ? 'kontaktiert' : 'nicht_kontaktiert',
          details: editForm.kontaktiert ? 'Als kontaktiert markiert' : 'Als nicht kontaktiert zurückgesetzt',
          userName: user?.name || 'Unbekannt'
        })
      }
      
      // Neuer Kommentar hinzugefügt?
      if (editForm.neuerKommentar && editForm.neuerKommentar.trim()) {
        historyEntries.push({
          action: 'kommentar',
          details: editForm.neuerKommentar.trim(),
          userName: user?.name || 'Unbekannt'
        })
      }

      // Updates vorbereiten (ohne kommentar - wird über historyEntry gehandhabt)
      const updates = {
        kontaktiert: editForm.kontaktiert,
        ergebnis: editForm.ergebnis,
        ansprechpartnerVorname: editForm.ansprechpartnerVorname,
        ansprechpartnerNachname: editForm.ansprechpartnerNachname
      }

      // Wenn keine History-Einträge, normale Speicherung
      if (historyEntries.length === 0) {
        const response = await fetch('/.netlify/functions/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: selectedLead.id,
            updates
          })
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Fehler beim Speichern')
        }
      } else {
        // Jeden History-Eintrag nacheinander speichern
        let updatedKommentar = editForm.kommentar
        
        for (const entry of historyEntries) {
          const response = await fetch('/.netlify/functions/leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId: selectedLead.id,
              updates: historyEntries.indexOf(entry) === historyEntries.length - 1 ? updates : {},
              historyEntry: entry
            })
          })

          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error || 'Fehler beim Speichern')
          }
          
          const data = await response.json()
          updatedKommentar = data.lead?.kommentar || updatedKommentar
        }
        
        editForm.kommentar = updatedKommentar
      }

      // Lead in Liste aktualisieren
      setLeads(prev => prev.map(lead => 
        lead.id === selectedLead.id 
          ? { ...lead, ...updates, kommentar: editForm.kommentar }
          : lead
      ))

      // Modal aktualisieren und neuerKommentar leeren
      setSelectedLead(prev => ({ ...prev, ...updates, kommentar: editForm.kommentar }))
      setEditForm(prev => ({ ...prev, neuerKommentar: '', kommentar: editForm.kommentar }))
      setEditMode(false)

    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
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

        <div className="flex items-center gap-3">
          {/* Leads anfordern Button (für alle außer Admins optional) */}
          {!isAdmin() && (
            <button
              onClick={() => setShowAnfrageModal(true)}
              disabled={offeneAnfrage !== null}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                offeneAnfrage 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-sunside-primary text-white hover:bg-purple-700'
              }`}
            >
              <Plus className="w-4 h-4" />
              Leads anfordern
            </button>
          )}

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
      </div>

      {/* Offene Anfrage Banner */}
      {offeneAnfrage && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">
              Deine Anfrage über {offeneAnfrage.anzahl} Leads wird bearbeitet
            </p>
            <p className="text-sm text-amber-600">
              Gesendet am {new Date(offeneAnfrage.erstelltAm).toLocaleDateString('de-DE', { 
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
              })}
            </p>
          </div>
        </div>
      )}

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
                    Letzte Aktivität
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
                    {/* Status-Indikator (nur Anzeige, kein Klick) */}
                    <td className="px-4 py-3">
                      <div
                        className={`p-1.5 rounded-full inline-flex ${
                          lead.kontaktiert 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {lead.kontaktiert ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Phone className="w-5 h-5" />
                        )}
                      </div>
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

                    {/* Kommentar / Letzter Eintrag */}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {lead.kommentar ? (
                        (() => {
                          // Nur den ersten (neuesten) Eintrag anzeigen
                          const firstLine = lead.kommentar.split('\n')[0]
                          const historyMatch = firstLine.match(/^\[(\d{2}\.\d{2}\.\d{4}),?\s*(\d{2}:\d{2})\]\s*(.+)$/)
                          
                          if (historyMatch) {
                            const [, datum, zeit, rest] = historyMatch
                            // Icon und Text extrahieren
                            const iconMatch = rest.match(/^(📧|📅|✅|↩️|📋|👤|💬)\s*(.+)$/)
                            const icon = iconMatch ? iconMatch[1] : '📋'
                            let text = iconMatch ? iconMatch[2] : rest
                            // Username am Ende entfernen für kürzere Anzeige
                            text = text.replace(/\s*\([^)]+\)$/, '')
                            // Text kürzen
                            if (text.length > 30) text = text.substring(0, 30) + '...'
                            
                            return (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-xs font-mono">
                                  {datum.substring(0, 6)}
                                </span>
                                <span>{icon}</span>
                                <span className="text-gray-600 truncate max-w-[120px]">{text}</span>
                              </div>
                            )
                          } else {
                            // Alter Kommentar ohne History-Format
                            return (
                              <div className="flex items-center text-sm text-gray-600">
                                <MessageSquare className="w-4 h-4 mr-1.5 text-gray-400 flex-shrink-0" />
                                <span className="truncate max-w-[150px]">{firstLine}</span>
                              </div>
                            )
                          }
                        })()
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

              {/* Website-Statistiken - immer anzeigen */}
              <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <Building2 className="w-4 h-4 mr-2 text-purple-600" />
                  Website-Statistiken
                </h4>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-xs text-gray-500">Besucher/Monat</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedLead.monatlicheBesuche !== null && selectedLead.monatlicheBesuche !== undefined
                        ? selectedLead.monatlicheBesuche.toLocaleString('de-DE')
                        : '-'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-xs text-gray-500">Mehrwert</p>
                    <p className="text-lg font-semibold text-green-600">
                      {selectedLead.mehrwert !== null && selectedLead.mehrwert !== undefined
                        ? `${selectedLead.mehrwert.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`
                        : '-'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-xs text-gray-500">Absprungrate</p>
                    <p className={`text-lg font-semibold ${
                      selectedLead.absprungrate === null || selectedLead.absprungrate === undefined ? 'text-gray-400' :
                      (parseFloat(selectedLead.absprungrate) * 100) > 60 ? 'text-red-600' : 
                      (parseFloat(selectedLead.absprungrate) * 100) > 40 ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {selectedLead.absprungrate !== null && selectedLead.absprungrate !== undefined
                        ? `${Math.round(parseFloat(selectedLead.absprungrate) * 100)}%`
                        : '-'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-xs text-gray-500">Leads/Monat</p>
                    <p className="text-lg font-semibold text-blue-600">
                      {selectedLead.anzahlLeads !== null && selectedLead.anzahlLeads !== undefined
                        ? selectedLead.anzahlLeads
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status & Bearbeitung */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Status & Notizen</h3>

                {editMode ? (
                  // Bearbeitungsmodus
                  <div className="space-y-4">
                    {/* Ergebnis - setzt automatisch kontaktiert: true */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ergebnis</label>
                      <select
                        value={editForm.ergebnis}
                        onChange={(e) => {
                          const neuesErgebnis = e.target.value
                          setEditForm(prev => ({ 
                            ...prev, 
                            ergebnis: neuesErgebnis,
                            // Automatisch als kontaktiert markieren wenn Ergebnis gesetzt
                            kontaktiert: neuesErgebnis ? true : prev.kontaktiert
                          }))
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
                      >
                        {ERGEBNIS_OPTIONEN.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Ansprechpartner - PFLICHTFELD (vor den Buttons!) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ansprechpartner <span className="text-red-500">*</span>
                        {autoSaving && (
                          <span className="ml-2 text-xs text-gray-400 font-normal">
                            <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
                            Speichert...
                          </span>
                        )}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editForm.ansprechpartnerVorname}
                          onChange={(e) => {
                            handleAnsprechpartnerChange('ansprechpartnerVorname', e.target.value)
                            setEditForm(prev => ({ ...prev, ansprechpartnerValidation: false }))
                          }}
                          placeholder="Vorname *"
                          className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none ${
                            editForm.ansprechpartnerValidation && !editForm.ansprechpartnerVorname 
                              ? 'border-red-500 bg-red-50' 
                              : 'border-gray-300'
                          }`}
                        />
                        <input
                          type="text"
                          value={editForm.ansprechpartnerNachname}
                          onChange={(e) => {
                            handleAnsprechpartnerChange('ansprechpartnerNachname', e.target.value)
                            setEditForm(prev => ({ ...prev, ansprechpartnerValidation: false }))
                          }}
                          placeholder="Nachname *"
                          className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none ${
                            editForm.ansprechpartnerValidation && !editForm.ansprechpartnerNachname 
                              ? 'border-red-500 bg-red-50' 
                              : 'border-gray-300'
                          }`}
                        />
                      </div>
                    </div>
                      
                    {/* Termin buchen Button bei Beratungsgespräch */}
                    {editForm.ergebnis === 'Beratungsgespräch' && (
                      <button
                        onClick={() => {
                          if (!editForm.ansprechpartnerVorname || !editForm.ansprechpartnerNachname) {
                            // Felder rot markieren durch State-Update
                            setEditForm(prev => ({ ...prev, ansprechpartnerValidation: true }))
                            return
                          }
                          setShowTerminPicker(true)
                        }}
                        className="w-full flex items-center justify-center px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Termin mit Closer buchen
                      </button>
                    )}
                    
                    {/* Unterlagen senden Button */}
                    {showUnterlagenButton({ ergebnis: editForm.ergebnis }) && (
                      <button
                        onClick={() => {
                          if (!editForm.ansprechpartnerVorname || !editForm.ansprechpartnerNachname) {
                            // Felder rot markieren durch State-Update
                            setEditForm(prev => ({ ...prev, ansprechpartnerValidation: true }))
                            return
                          }
                          setShowEmailComposer(true)
                        }}
                        className="w-full flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Unterlagen senden
                      </button>
                    )}

                    {/* Neuer Kommentar */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Neuer Kommentar hinzufügen</label>
                      <textarea
                        value={editForm.neuerKommentar}
                        onChange={(e) => setEditForm(prev => ({ ...prev, neuerKommentar: e.target.value }))}
                        rows={2}
                        placeholder="Notiz hinzufügen..."
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

                    {(selectedLead.ansprechpartnerVorname || selectedLead.ansprechpartnerNachname) && (
                      <div className="flex items-center">
                        <UserIcon className="w-5 h-5 text-gray-400 mr-2" />
                        <span className="text-gray-700">
                          {[selectedLead.ansprechpartnerVorname, selectedLead.ansprechpartnerNachname].filter(Boolean).join(' ')}
                        </span>
                      </div>
                    )}

                    {/* History / Kommentar Anzeige */}
                    {selectedLead.kommentar && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center">
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Verlauf
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {selectedLead.kommentar.split('\n').filter(line => line.trim()).map((line, index) => {
                            // Parse History-Eintrag: [DD.MM.YYYY, HH:MM] ICON Text (Username)
                            const historyMatch = line.match(/^\[(\d{2}\.\d{2}\.\d{4}),?\s*(\d{2}:\d{2})\]\s*(.+)$/)
                            
                            if (historyMatch) {
                              const [, datum, zeit, rest] = historyMatch
                              // Icon und Text extrahieren
                              const iconMatch = rest.match(/^(📧|📅|✅|↩️|📋|👤|💬)\s*(.+)$/)
                              const icon = iconMatch ? iconMatch[1] : '📋'
                              const text = iconMatch ? iconMatch[2] : rest
                              
                              return (
                                <div key={index} className="flex items-start gap-2 text-sm">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-xs font-mono whitespace-nowrap">
                                    {datum}, {zeit}
                                  </span>
                                  <span className="text-base">{icon}</span>
                                  <span className="text-gray-700 flex-1">{text}</span>
                                </div>
                              )
                            } else {
                              // Alter Kommentar ohne History-Format
                              return (
                                <div key={index} className="flex items-start gap-2 text-sm">
                                  <span className="text-gray-600">{line}</span>
                                </div>
                              )
                            }
                          })}
                        </div>
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

      {/* Lead-Anfrage Modal */}
      {showAnfrageModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAnfrageModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Neue Leads anfordern</h2>
              <button
                onClick={() => setShowAnfrageModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Error */}
            {anfrageError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{anfrageError}</span>
              </div>
            )}

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anzahl Leads
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={anfrageAnzahl}
                  onChange={(e) => setAnfrageAnzahl(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
                />
                <p className="mt-1 text-sm text-gray-500">Empfohlen: 100-300 Leads</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nachricht (optional)
                </label>
                <textarea
                  value={anfrageNachricht}
                  onChange={(e) => setAnfrageNachricht(e.target.value)}
                  placeholder="z.B. Meine Liste ist fast durch..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAnfrageModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={sendLeadAnfrage}
                disabled={anfrageSending || anfrageAnzahl < 1}
                className="flex items-center gap-2 px-4 py-2 bg-sunside-primary text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {anfrageSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Anfrage senden
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}

export default Kaltakquise
