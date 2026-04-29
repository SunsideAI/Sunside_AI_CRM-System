import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import {
  RotateCcw,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Phone,
  Mail,
  Globe,
  Building2,
  Save,
  Filter,
  FileText,
  CheckSquare,
  Users,
  Calendar,
  AlertTriangle,
  Check,
  Plus,
  Clock,
  MessageSquare
} from 'lucide-react'

// Follow-Up Status Optionen
const FOLLOW_UP_STATUS_OPTIONS = [
  { value: 'aktiv', label: 'Aktiv', color: 'bg-green-100 text-green-700' },
  { value: 'pausiert', label: 'Pausiert', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'abgeschlossen', label: 'Abgeschlossen', color: 'bg-gray-100 text-gray-700' }
]

// Action-Typ Optionen
const ACTION_TYP_OPTIONS = [
  { value: 'mail_gesendet', label: 'Mail gesendet', icon: Mail },
  { value: 'anruf', label: 'Anruf', icon: Phone },
  { value: 'todo', label: 'Todo', icon: CheckSquare },
  { value: 'notiz', label: 'Notiz', icon: FileText },
  { value: 'closer_meeting', label: 'Closer-Meeting', icon: Users }
]

// Fälligkeits-Filter Optionen
const FAELLIGKEIT_OPTIONS = [
  { value: 'all', label: 'Alle' },
  { value: 'overdue', label: 'Überfällig' },
  { value: 'today', label: 'Heute fällig' },
  { value: 'week', label: 'Diese Woche' },
  { value: 'next7', label: 'Nächste 7 Tage' }
]

// Hot-Lead Status Optionen (für Filter und Badge)
const HOT_LEAD_STATUS_OPTIONS = [
  { value: 'Lead', label: 'Lead', color: 'bg-blue-100 text-blue-700' },
  { value: 'Verloren', label: 'Verloren', color: 'bg-red-100 text-red-700' },
  { value: 'Angebot versendet', label: 'Angebot versendet', color: 'bg-purple-100 text-purple-700' },
  { value: 'Termin abgesagt', label: 'Termin abgesagt', color: 'bg-orange-100 text-orange-700' },
  { value: 'Termin verschoben', label: 'Termin verschoben', color: 'bg-amber-100 text-amber-700' },
  { value: 'Wiedervorlage', label: 'Wiedervorlage', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'Geplant', label: 'Geplant', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'Im Closing', label: 'Im Closing', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'Angebot', label: 'Angebot', color: 'bg-yellow-100 text-yellow-700' }
]

function FollowUp() {
  const { user } = useAuth()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [closerFilter, setCloserFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [faelligkeitFilter, setFaelligkeitFilter] = useState('all')
  const [hotLeadStatusFilter, setHotLeadStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalLeads, setTotalLeads] = useState(0)
  const [closers, setClosers] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Drawer Edit State
  const [editData, setEditData] = useState({})

  // New Action State
  const [newAction, setNewAction] = useState({
    typ: 'todo',
    beschreibung: '',
    faelligAm: ''
  })
  const [addingAction, setAddingAction] = useState(false)

  const LEADS_PER_PAGE = 20

  // Datum-Helpers
  const today = new Date().toISOString().split('T')[0]

  const getWeekEnd = () => {
    const d = new Date()
    const day = d.getDay()
    const diff = 7 - day
    d.setDate(d.getDate() + diff)
    return d.toISOString().split('T')[0]
  }

  const getNext7Days = () => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  }

  // Client-seitig gefilterte Leads (für Hot-Lead Status Filter)
  const filteredLeads = hotLeadStatusFilter === 'all'
    ? leads
    : leads.filter(lead => lead.status === hotLeadStatusFilter)

  // Daten laden
  const loadLeads = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true)
      else setLoading(true)

      const params = new URLSearchParams()
      if (user?.id) params.append('userId', user.id)
      if (closerFilter !== 'all') params.append('closerId', closerFilter)
      if (statusFilter !== 'all') params.append('followUpStatus', statusFilter)
      if (searchTerm) params.append('search', searchTerm)
      params.append('limit', LEADS_PER_PAGE.toString())
      params.append('offset', ((currentPage - 1) * LEADS_PER_PAGE).toString())

      // Fälligkeits-Filter
      if (faelligkeitFilter === 'overdue') {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        params.append('faelligBis', yesterday.toISOString().split('T')[0])
      } else if (faelligkeitFilter === 'today') {
        params.append('faelligBis', today)
      } else if (faelligkeitFilter === 'week') {
        params.append('faelligBis', getWeekEnd())
      } else if (faelligkeitFilter === 'next7') {
        params.append('faelligBis', getNext7Days())
      }

      const response = await fetch(`/.netlify/functions/follow-up?${params.toString()}`)

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Fehler beim Laden')
      }

      const data = await response.json()
      setLeads(data.leads || [])
      setTotalLeads(data.total || 0)
      setClosers(data.closers || [])
      setError(null)
    } catch (err) {
      console.error('Load error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadLeads()
  }, [currentPage, closerFilter, statusFilter, faelligkeitFilter])

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      loadLeads()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Lead auswählen und Edit-Data initialisieren
  const handleSelectLead = (lead) => {
    setSelectedLead(lead)
    setEditData({
      follow_up_status: lead.follow_up_status || 'aktiv',
      follow_up_naechster_schritt: lead.follow_up_naechster_schritt || '',
      follow_up_datum: lead.follow_up_datum || '',
      kommentar: lead.kommentar || ''
    })
    setNewAction({ typ: 'todo', beschreibung: '', faelligAm: '' })
  }

  // Lead-Daten speichern
  const handleSaveLead = async () => {
    if (!selectedLead) return

    try {
      setSaving(true)

      const response = await fetch('/.netlify/functions/follow-up', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          hotLeadId: selectedLead.id,
          updates: editData
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Fehler beim Speichern')
      }

      // Local state updaten
      setLeads(prev => prev.map(l =>
        l.id === selectedLead.id ? { ...l, ...editData } : l
      ))
      setSelectedLead(prev => ({ ...prev, ...editData }))
    } catch (err) {
      console.error('Save error:', err)
      alert('Fehler beim Speichern: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Neue Action hinzufügen
  const handleAddAction = async () => {
    if (!selectedLead || !newAction.beschreibung.trim()) return

    try {
      setAddingAction(true)

      const response = await fetch('/.netlify/functions/follow-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          hotLeadId: selectedLead.id,
          typ: newAction.typ,
          beschreibung: newAction.beschreibung.trim(),
          faelligAm: newAction.faelligAm || null,
          erstelltVon: user?.id || null
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Fehler beim Hinzufügen')
      }

      const { action } = await response.json()

      // Local state updaten
      setSelectedLead(prev => ({
        ...prev,
        letzte_aktionen: [
          {
            ...action,
            erstellt_von_name: user?.vor_nachname || 'Du'
          },
          ...(prev.letzte_aktionen || []).slice(0, 4)
        ]
      }))

      setNewAction({ typ: 'todo', beschreibung: '', faelligAm: '' })
    } catch (err) {
      console.error('Add action error:', err)
      alert('Fehler beim Hinzufügen: ' + err.message)
    } finally {
      setAddingAction(false)
    }
  }

  // Action als erledigt markieren
  const handleToggleActionDone = async (actionId, currentErledigt) => {
    try {
      const response = await fetch('/.netlify/functions/follow-up', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          actionId,
          updates: { erledigt: !currentErledigt }
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Fehler beim Aktualisieren')
      }

      // Local state updaten
      setSelectedLead(prev => ({
        ...prev,
        letzte_aktionen: (prev.letzte_aktionen || []).map(a =>
          a.id === actionId ? { ...a, erledigt: !currentErledigt } : a
        )
      }))
    } catch (err) {
      console.error('Toggle error:', err)
    }
  }

  // Formatierung
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isOverdue = (dateStr) => {
    if (!dateStr) return false
    return new Date(dateStr) < new Date(today)
  }

  // Pagination
  const totalPages = Math.ceil(totalLeads / LEADS_PER_PAGE)

  // Action Icon Helper
  const getActionIcon = (typ) => {
    const option = ACTION_TYP_OPTIONS.find(o => o.value === typ)
    return option?.icon || FileText
  }


  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-display text-on-surface">
            Follow-Up
          </h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {totalLeads} Lead{totalLeads !== 1 ? 's' : ''} im Follow-Up-Prozess
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-error-container rounded-xl p-4 text-error">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="card p-5 space-y-4">
        {/* Zeile 1: Suche + Refresh */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
            <input
              type="text"
              placeholder="Firma, Name suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={() => loadLeads(true)}
            disabled={refreshing}
            className="p-2.5 bg-surface-container-lowest rounded-lg hover:bg-surface-container transition-colors shadow-ambient-sm"
          >
            <RefreshCw className={`w-5 h-5 text-on-surface-variant ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Zeile 2: Filter - responsive grid on mobile */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
          {/* Closer Filter */}
          <select
            value={closerFilter}
            onChange={(e) => { setCloserFilter(e.target.value); setCurrentPage(1) }}
            className="select-field w-full sm:w-auto sm:min-w-[140px] text-body-sm py-2.5"
          >
            <option value="all">Alle Closer</option>
            {closers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Hot-Lead Status Filter */}
          <select
            value={hotLeadStatusFilter}
            onChange={(e) => { setHotLeadStatusFilter(e.target.value); setCurrentPage(1) }}
            className="select-field w-full sm:w-auto sm:min-w-[140px] text-body-sm py-2.5"
          >
            <option value="all">Alle Hot-Lead Status</option>
            {HOT_LEAD_STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Follow-Up Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
            className="select-field w-full sm:w-auto sm:min-w-[140px] text-body-sm py-2.5"
          >
            <option value="all">Alle Follow-Up Status</option>
            {FOLLOW_UP_STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Fälligkeit Filter */}
          <select
            value={faelligkeitFilter}
            onChange={(e) => { setFaelligkeitFilter(e.target.value); setCurrentPage(1) }}
            className="select-field w-full sm:w-auto sm:min-w-[140px] text-body-sm py-2.5"
          >
            {FAELLIGKEIT_OPTIONS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          {/* Reset Filter Button */}
          {(closerFilter !== 'all' || statusFilter !== 'all' || faelligkeitFilter !== 'all' || hotLeadStatusFilter !== 'all') && (
            <button
              onClick={() => {
                setCloserFilter('all')
                setStatusFilter('all')
                setFaelligkeitFilter('all')
                setHotLeadStatusFilter('all')
                setCurrentPage(1)
              }}
              className="px-3 py-2 text-body-sm text-error hover:bg-error-container rounded-lg transition-colors flex items-center gap-1 col-span-2 sm:col-span-1"
            >
              <X className="w-4 h-4" />
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Mobile: Card-Layout */}
      <div className="md:hidden card-elevated overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-on-surface-variant">Leads werden geladen...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant">
            <RotateCcw className="w-10 h-10 mx-auto mb-3 text-outline-variant" />
            <p className="text-title-md mb-1">Keine Leads gefunden</p>
            <p className="text-body-sm text-outline">
              Keine Leads mit diesen Filterkriterien im Follow-Up.
            </p>
          </div>
        ) : (
        <div className="divide-y divide-outline-variant">
          {filteredLeads.map((lead) => {
            const overdue = isOverdue(lead.follow_up_datum)
            const lastAction = lead.letzte_aktionen?.[0]
            const ActionIcon = lastAction ? getActionIcon(lastAction.typ) : null
            const statusOption = FOLLOW_UP_STATUS_OPTIONS.find(s => s.value === lead.follow_up_status)
            const hotLeadStatusOption = HOT_LEAD_STATUS_OPTIONS.find(s => s.value === lead.status)

            return (
              <div
                key={lead.id}
                onClick={() => handleSelectLead(lead)}
                className={`p-4 cursor-pointer hover:bg-surface-container active:bg-surface-container-high transition-colors ${overdue ? 'border-l-4 border-error' : ''}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-medium text-on-surface truncate">{lead.unternehmen || '-'}</div>
                    <div className="text-body-sm text-on-surface-variant">
                      {lead.ansprechpartner_vorname} {lead.ansprechpartner_nachname}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 flex-shrink-0">
                    {hotLeadStatusOption && (
                      <span className={`px-2 py-1 rounded-full text-label-sm ${hotLeadStatusOption.color}`}>
                        {hotLeadStatusOption.label}
                      </span>
                    )}
                    {statusOption && (
                      <span className={`px-2 py-1 rounded-full text-label-sm ${statusOption.color}`}>
                        {statusOption.label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-body-sm">
                  <div>
                    <span className="text-on-surface-variant">Closer:</span>
                    <span className="ml-1 text-on-surface">{lead.closer_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant">Fällig:</span>
                    <span className={`ml-1 ${overdue ? 'text-error font-medium' : 'text-on-surface'}`}>
                      {formatDate(lead.follow_up_datum)}
                    </span>
                  </div>
                </div>

                {lead.follow_up_naechster_schritt && (
                  <div className="mt-2 text-body-sm text-on-surface-variant line-clamp-2">
                    {lead.follow_up_naechster_schritt}
                  </div>
                )}

                {lastAction && (
                  <div className="mt-2 flex items-center gap-2 text-body-sm text-on-surface-variant">
                    <ActionIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{lastAction.beschreibung?.substring(0, 40)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        )}

        {/* Mobile Pagination */}
        {!loading && filteredLeads.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant">
            <span className="text-body-sm text-on-surface-variant">
              Seite {currentPage} von {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop: Table-Layout */}
      <div className="hidden md:block card-elevated overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-container">
              <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Unternehmen</th>
              <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Closer</th>
              <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Hot-Lead Status</th>
              <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Follow-Up Status</th>
              <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Nächster Schritt</th>
              <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Fällig am</th>
              <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Letzte Aktion</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-16">
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                    <p className="text-on-surface-variant">Leads werden geladen...</p>
                  </div>
                </td>
              </tr>
            ) : filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12">
                  <div className="text-center text-on-surface-variant">
                    <RotateCcw className="w-10 h-10 mx-auto mb-3 text-outline-variant" />
                    <p className="text-title-md mb-1">Keine Leads gefunden</p>
                    <p className="text-body-sm text-outline">
                      Keine Leads mit diesen Filterkriterien im Follow-Up.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              <>
            {filteredLeads.map((lead, index) => {
              const overdue = isOverdue(lead.follow_up_datum)
              const lastAction = lead.letzte_aktionen?.[0]
              const ActionIcon = lastAction ? getActionIcon(lastAction.typ) : null

              return (
                <tr
                  key={lead.id}
                  onClick={() => handleSelectLead(lead)}
                  className={`
                    cursor-pointer transition-colors
                    ${index % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'}
                    ${overdue ? 'bg-red-50/30' : ''}
                    hover:bg-primary-fixed/20
                  `}
                >
                  <td className="px-4 py-4">
                    <div className="font-medium text-on-surface">{lead.unternehmen || '-'}</div>
                    <div className="text-body-sm text-on-surface-variant">
                      {lead.ansprechpartner_vorname} {lead.ansprechpartner_nachname}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-body-md text-on-surface">
                    {lead.closer_name || '-'}
                  </td>
                  <td className="px-4 py-4">
                    {HOT_LEAD_STATUS_OPTIONS.find(s => s.value === lead.status) ? (
                      <span className={`px-2 py-1 rounded-full text-label-sm ${
                        HOT_LEAD_STATUS_OPTIONS.find(s => s.value === lead.status)?.color
                      }`}>
                        {HOT_LEAD_STATUS_OPTIONS.find(s => s.value === lead.status)?.label}
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-label-sm bg-gray-100 text-gray-700">
                        {lead.status || '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {FOLLOW_UP_STATUS_OPTIONS.find(s => s.value === lead.follow_up_status) ? (
                      <span className={`px-2 py-1 rounded-full text-label-sm ${
                        FOLLOW_UP_STATUS_OPTIONS.find(s => s.value === lead.follow_up_status)?.color
                      }`}>
                        {FOLLOW_UP_STATUS_OPTIONS.find(s => s.value === lead.follow_up_status)?.label}
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-label-sm bg-gray-100 text-gray-700">
                        -
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-body-md text-on-surface max-w-[200px] truncate">
                    {lead.follow_up_naechster_schritt || '-'}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-body-md ${overdue ? 'text-error font-medium' : 'text-on-surface'}`}>
                      {formatDate(lead.follow_up_datum)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {lastAction ? (
                      <div className="flex items-center gap-2">
                        <ActionIcon className="h-4 w-4 text-on-surface-variant" />
                        <span className="text-body-sm text-on-surface-variant truncate max-w-[150px]">
                          {lastAction.beschreibung?.substring(0, 50)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-body-sm text-on-surface-variant">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
            </>
            )}
          </tbody>
        </table>

        {/* Pagination - Desktop */}
        {!loading && filteredLeads.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant">
            <span className="text-body-sm text-on-surface-variant">
              Seite {currentPage} von {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedLead && createPortal(
        <div
          className="fixed inset-0 bg-scrim/50 z-50"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="absolute right-0 top-0 h-full w-full max-w-xl bg-surface shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="sticky top-0 bg-surface border-b border-outline-variant px-6 py-4 flex items-center justify-between">
              <h2 className="text-title-lg font-semibold text-on-surface">
                {selectedLead.unternehmen}
              </h2>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-2 rounded-lg hover:bg-surface-container"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Stammdaten */}
              <div className="space-y-3">
                <h3 className="text-label-lg font-medium text-on-surface-variant uppercase tracking-wide">
                  Kontaktdaten
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-body-sm text-on-surface-variant">Ansprechpartner</span>
                    <p className="text-body-md text-on-surface">
                      {selectedLead.ansprechpartner_vorname} {selectedLead.ansprechpartner_nachname}
                    </p>
                  </div>
                  <div>
                    <span className="text-body-sm text-on-surface-variant">Status</span>
                    <p className="text-body-md text-on-surface">{selectedLead.status}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {selectedLead.telefonnummer && (
                    <a
                      href={`tel:${selectedLead.telefonnummer}`}
                      className="flex items-center gap-2 px-3 py-2 bg-surface-container rounded-lg hover:bg-surface-container-high"
                    >
                      <Phone className="h-4 w-4 text-primary" />
                      <span className="text-body-sm">{selectedLead.telefonnummer}</span>
                    </a>
                  )}
                  {selectedLead.mail && (
                    <a
                      href={`mailto:${selectedLead.mail}`}
                      className="flex items-center gap-2 px-3 py-2 bg-surface-container rounded-lg hover:bg-surface-container-high"
                    >
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="text-body-sm">{selectedLead.mail}</span>
                    </a>
                  )}
                  {selectedLead.website && (
                    <a
                      href={selectedLead.website.startsWith('http') ? selectedLead.website : `https://${selectedLead.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-surface-container rounded-lg hover:bg-surface-container-high"
                    >
                      <Globe className="h-4 w-4 text-primary" />
                      <span className="text-body-sm">Website</span>
                    </a>
                  )}
                </div>

                <div className="flex gap-2 mt-2">
                  {selectedLead.setter_name && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-label-sm">
                      Setter: {selectedLead.setter_name}
                    </span>
                  )}
                  {selectedLead.closer_name && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-label-sm">
                      Closer: {selectedLead.closer_name}
                    </span>
                  )}
                </div>
              </div>

              {/* Follow-Up Steuerung */}
              <div className="space-y-4 border-t border-outline-variant pt-6">
                <h3 className="text-label-lg font-medium text-on-surface-variant uppercase tracking-wide">
                  Follow-Up Steuerung
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-body-sm text-on-surface-variant mb-1">Status</label>
                    <select
                      value={editData.follow_up_status || 'aktiv'}
                      onChange={(e) => setEditData(prev => ({ ...prev, follow_up_status: e.target.value }))}
                      className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary"
                    >
                      {FOLLOW_UP_STATUS_OPTIONS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-body-sm text-on-surface-variant mb-1">Fällig am</label>
                    <input
                      type="date"
                      value={editData.follow_up_datum || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, follow_up_datum: e.target.value }))}
                      className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-body-sm text-on-surface-variant mb-1">Nächster Schritt</label>
                  <textarea
                    value={editData.follow_up_naechster_schritt || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, follow_up_naechster_schritt: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary resize-none"
                    placeholder="Was ist der nächste Schritt?"
                  />
                </div>

                <div>
                  <label className="block text-body-sm text-on-surface-variant mb-1">Kommentar</label>
                  <textarea
                    value={editData.kommentar || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, kommentar: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary resize-none"
                    placeholder="Allgemeiner Kommentar zum Lead..."
                  />
                </div>

                <button
                  onClick={handleSaveLead}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Speichern
                </button>
              </div>

              {/* Action Timeline */}
              <div className="space-y-4 border-t border-outline-variant pt-6">
                <h3 className="text-label-lg font-medium text-on-surface-variant uppercase tracking-wide">
                  Aktionen
                </h3>

                {/* Timeline */}
                <div className="space-y-3">
                  {(selectedLead.letzte_aktionen || []).map((action) => {
                    const ActionIcon = getActionIcon(action.typ)
                    return (
                      <div
                        key={action.id}
                        className={`flex items-start gap-3 p-3 rounded-lg ${
                          action.erledigt ? 'bg-surface-container-lowest opacity-60' : 'bg-surface-container'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${action.erledigt ? 'bg-green-100' : 'bg-primary-container'}`}>
                          <ActionIcon className={`h-4 w-4 ${action.erledigt ? 'text-green-700' : 'text-primary'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-body-md ${action.erledigt ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                            {action.beschreibung}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-body-sm text-on-surface-variant">
                            {action.erstellt_von_name && <span>von {action.erstellt_von_name}</span>}
                            <span>{formatDateTime(action.created_at)}</span>
                            {action.faellig_am && (
                              <span className={isOverdue(action.faellig_am) && !action.erledigt ? 'text-error' : ''}>
                                • Fällig: {formatDate(action.faellig_am)}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleActionDone(action.id, action.erledigt)}
                          className={`p-2 rounded-lg ${
                            action.erledigt
                              ? 'bg-green-100 text-green-700'
                              : 'bg-surface-container-high hover:bg-primary-container'
                          }`}
                          title={action.erledigt ? 'Als offen markieren' : 'Als erledigt markieren'}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}

                  {(!selectedLead.letzte_aktionen || selectedLead.letzte_aktionen.length === 0) && (
                    <p className="text-body-sm text-on-surface-variant text-center py-4">
                      Noch keine Aktionen vorhanden
                    </p>
                  )}
                </div>

                {/* Neue Aktion */}
                <div className="mt-4 p-4 bg-surface-container-lowest rounded-lg border border-outline-variant space-y-3">
                  <h4 className="text-label-md font-medium text-on-surface">Neue Aktion</h4>

                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={newAction.typ}
                      onChange={(e) => setNewAction(prev => ({ ...prev, typ: e.target.value }))}
                      className="px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:border-primary"
                    >
                      {ACTION_TYP_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>

                    {newAction.typ === 'todo' && (
                      <input
                        type="date"
                        value={newAction.faelligAm}
                        onChange={(e) => setNewAction(prev => ({ ...prev, faelligAm: e.target.value }))}
                        className="px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:border-primary"
                        placeholder="Fällig am"
                      />
                    )}
                  </div>

                  <textarea
                    value={newAction.beschreibung}
                    onChange={(e) => setNewAction(prev => ({ ...prev, beschreibung: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:border-primary resize-none"
                    placeholder="Beschreibung..."
                  />

                  <button
                    onClick={handleAddAction}
                    disabled={addingAction || !newAction.beschreibung.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {addingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Hinzufügen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default FollowUp
