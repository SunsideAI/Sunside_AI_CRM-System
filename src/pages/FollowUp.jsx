import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import * as XLSX from 'xlsx'
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
  MessageSquare,
  List,
  Columns,
  Circle,
  CheckCircle,
  GripVertical,
  Download
} from 'lucide-react'

// Kanban Spalten
const KANBAN_COLUMNS = [
  { id: 'offen', title: 'Offen', icon: Circle, color: 'bg-blue-500' },
  { id: 'in_bearbeitung', title: 'In Bearbeitung', icon: Clock, color: 'bg-amber-500' },
  { id: 'erledigt', title: 'Erledigt', icon: CheckCircle, color: 'bg-green-500' }
]

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
  const { user, isAdmin, isCloser } = useAuth()

  // View Mode: Liste oder Kanban
  const [viewMode, setViewMode] = useState('liste')

  // Liste State
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

  // Kanban State
  const [kanbanActions, setKanbanActions] = useState([])
  const [kanbanLoading, setKanbanLoading] = useState(false)
  const [draggedAction, setDraggedAction] = useState(null)
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

  // Inline Edit State für Aktionen im Drawer
  const [editingActionId, setEditingActionId] = useState(null)
  const [editingActionData, setEditingActionData] = useState({})
  const [deletingActionId, setDeletingActionId] = useState(null)

  // Kanban Action Edit Modal State
  const [selectedKanbanAction, setSelectedKanbanAction] = useState(null)
  const [kanbanActionDeleting, setKanbanActionDeleting] = useState(false)
  const [loadingLeadId, setLoadingLeadId] = useState(null)

  // Export State
  const [exporting, setExporting] = useState(false)

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

  // Hot-Lead Status Filter ist jetzt server-seitig

  // Daten laden
  const loadLeads = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true)
      else setLoading(true)

      const params = new URLSearchParams()
      if (user?.id) params.append('userId', user.id)
      if (closerFilter !== 'all') params.append('closerId', closerFilter)
      if (statusFilter !== 'all') params.append('followUpStatus', statusFilter)
      if (hotLeadStatusFilter !== 'all') params.append('hotLeadStatus', hotLeadStatusFilter)
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
    if (viewMode === 'liste') {
      loadLeads()
    }
  }, [currentPage, closerFilter, statusFilter, faelligkeitFilter, hotLeadStatusFilter, viewMode])

  // Debounced Search (nur für Liste)
  useEffect(() => {
    if (viewMode === 'liste') {
      const timer = setTimeout(() => {
        setCurrentPage(1)
        loadLeads()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [searchTerm])

  // ==========================================
  // KANBAN Functions
  // ==========================================

  // Kanban Actions laden
  const loadKanbanActions = useCallback(async () => {
    if (!user?.id) return

    setKanbanLoading(true)
    try {
      const params = new URLSearchParams({
        kanban: 'true',
        userId: user.id
      })

      const response = await fetch(`/.netlify/functions/follow-up?${params.toString()}`)

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Fehler beim Laden')
      }

      const data = await response.json()
      setKanbanActions(data.actions || [])
    } catch (err) {
      console.error('Kanban load error:', err)
      setError(err.message)
    } finally {
      setKanbanLoading(false)
    }
  }, [user?.id])

  // Kanban laden wenn Tab wechselt
  useEffect(() => {
    if (viewMode === 'kanban') {
      loadKanbanActions()
    }
  }, [viewMode, loadKanbanActions])

  // Kanban Drag & Drop Handler
  const handleDragStart = (action) => {
    setDraggedAction(action)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = async (e, newStatus) => {
    e.preventDefault()
    if (!draggedAction || draggedAction.kanban_status === newStatus) {
      setDraggedAction(null)
      return
    }

    // Optimistic Update
    setKanbanActions(prev =>
      prev.map(a => a.id === draggedAction.id
        ? { ...a, kanban_status: newStatus }
        : a
      )
    )

    try {
      const response = await fetch('/.netlify/functions/follow-up', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          actionId: draggedAction.id,
          updates: { kanban_status: newStatus }
        })
      })

      if (!response.ok) {
        // Revert on error
        loadKanbanActions()
      }
    } catch (err) {
      console.error('Kanban update error:', err)
      loadKanbanActions()
    }

    setDraggedAction(null)
  }

  // Lead aus Kanban-Karte öffnen
  const openLeadFromKanban = async (hotLeadId) => {
    if (!hotLeadId) return

    // Erst im Cache suchen
    const cachedLead = leads.find(l => l.id === hotLeadId)
    if (cachedLead) {
      handleSelectLead(cachedLead)
      setLoadingLeadId(null)
      return
    }

    // Lead spezifisch vom Server laden
    try {
      const params = new URLSearchParams({
        userId: user.id,
        leadId: hotLeadId
      })
      const response = await fetch(`/.netlify/functions/follow-up?${params.toString()}`)
      const data = await response.json()

      if (data.lead) {
        handleSelectLead(data.lead)
      } else if (data.leads?.length > 0) {
        const foundLead = data.leads.find(l => l.id === hotLeadId)
        if (foundLead) {
          handleSelectLead(foundLead)
        }
      }
    } catch (err) {
      console.error('Lead load error:', err)
    } finally {
      setLoadingLeadId(null)
    }
  }

  // Lead auswählen und Edit-Data initialisieren
  const handleSelectLead = (lead) => {
    setSelectedLead(lead)
    setEditData({
      follow_up_status: lead.follow_up_status || 'aktiv',
      follow_up_naechster_schritt: lead.follow_up_naechster_schritt || '',
      follow_up_datum: lead.follow_up_datum || '',
      neuerKommentar: ''
    })
    setNewAction({ typ: 'todo', beschreibung: '', faelligAm: '' })
  }

  // Lead-Daten speichern
  const handleSaveLead = async () => {
    if (!selectedLead) return

    try {
      setSaving(true)

      const { neuerKommentar, ...updates } = editData

      const response = await fetch('/.netlify/functions/follow-up', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          hotLeadId: selectedLead.id,
          updates,
          neuerKommentar: neuerKommentar?.trim() || null,
          userName: user?.vor_nachname || 'Follow-Up'
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Fehler beim Speichern')
      }

      const data = await response.json()
      const updatedKommentar = data.lead?.kommentar || selectedLead.kommentar

      // Local state updaten
      setLeads(prev => prev.map(l =>
        l.id === selectedLead.id ? { ...l, ...updates, kommentar: updatedKommentar } : l
      ))
      setSelectedLead(prev => ({ ...prev, ...updates, kommentar: updatedKommentar }))
      setEditData(prev => ({ ...prev, neuerKommentar: '' }))
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

  // Inline-Edit für Aktionen starten
  const handleStartEditAction = (action) => {
    setEditingActionId(action.id)
    setEditingActionData({
      typ: action.typ || 'todo',
      beschreibung: action.beschreibung || '',
      faellig_am: action.faellig_am ? action.faellig_am.split('T')[0] : ''
    })
  }

  // Inline-Edit abbrechen
  const handleCancelEditAction = () => {
    setEditingActionId(null)
    setEditingActionData({})
  }

  // Inline-Edit speichern
  const handleSaveEditAction = async () => {
    if (!editingActionId) return

    try {
      setSaving(true)

      const response = await fetch('/.netlify/functions/follow-up', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          actionId: editingActionId,
          updates: {
            typ: editingActionData.typ,
            beschreibung: editingActionData.beschreibung,
            faellig_am: editingActionData.faellig_am || null
          }
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Fehler beim Speichern')
      }

      // Local state updaten
      setSelectedLead(prev => ({
        ...prev,
        letzte_aktionen: (prev.letzte_aktionen || []).map(a =>
          a.id === editingActionId
            ? { ...a, ...editingActionData }
            : a
        )
      }))

      setEditingActionId(null)
      setEditingActionData({})
    } catch (err) {
      console.error('Save action error:', err)
      alert('Fehler beim Speichern: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Aktion löschen
  const handleDeleteAction = async (actionId) => {
    try {
      const response = await fetch('/.netlify/functions/follow-up', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          actionId
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Fehler beim Löschen')
      }

      // Local state updaten
      setSelectedLead(prev => ({
        ...prev,
        letzte_aktionen: (prev.letzte_aktionen || []).filter(a => a.id !== actionId)
      }))

      setDeletingActionId(null)
      setEditingActionId(null)
    } catch (err) {
      console.error('Delete action error:', err)
      alert('Fehler beim Löschen: ' + err.message)
    }
  }

  // Kanban Action Modal speichern
  const handleSaveKanbanAction = async () => {
    if (!selectedKanbanAction) return

    try {
      setSaving(true)

      const response = await fetch('/.netlify/functions/follow-up', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          actionId: selectedKanbanAction.id,
          updates: {
            typ: selectedKanbanAction.typ,
            beschreibung: selectedKanbanAction.beschreibung,
            faellig_am: selectedKanbanAction.faellig_am || null,
            kanban_status: selectedKanbanAction.kanban_status
          }
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Fehler beim Speichern')
      }

      // Local state updaten
      setKanbanActions(prev =>
        prev.map(a => a.id === selectedKanbanAction.id ? { ...a, ...selectedKanbanAction } : a)
      )

      setSelectedKanbanAction(null)
    } catch (err) {
      console.error('Save kanban action error:', err)
      alert('Fehler beim Speichern: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Kanban Action löschen
  const handleDeleteKanbanAction = async () => {
    if (!selectedKanbanAction) return

    try {
      const response = await fetch('/.netlify/functions/follow-up', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          actionId: selectedKanbanAction.id
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Fehler beim Löschen')
      }

      // Local state updaten
      setKanbanActions(prev => prev.filter(a => a.id !== selectedKanbanAction.id))
      setSelectedKanbanAction(null)
      setKanbanActionDeleting(false)
    } catch (err) {
      console.error('Delete kanban action error:', err)
      alert('Fehler beim Löschen: ' + err.message)
    }
  }

  // Excel Export
  const handleExportExcel = async () => {
    try {
      setExporting(true)

      // Alle Daten mit aktuellen Filtern laden (ohne Pagination)
      const params = new URLSearchParams()
      if (user?.id) params.append('userId', user.id)
      if (closerFilter !== 'all') params.append('closerId', closerFilter)
      if (statusFilter !== 'all') params.append('followUpStatus', statusFilter)
      if (hotLeadStatusFilter !== 'all') params.append('hotLeadStatus', hotLeadStatusFilter)
      if (searchTerm) params.append('search', searchTerm)
      params.append('limit', '1000')
      params.append('offset', '0')

      const response = await fetch(`/.netlify/functions/follow-up?${params.toString()}`)
      const data = await response.json()
      const exportLeads = data.leads || []

      if (exportLeads.length === 0) {
        alert('Keine Daten zum Exportieren vorhanden.')
        return
      }

      // Daten für Excel aufbereiten
      const excelData = exportLeads.map(lead => ({
        'Unternehmen': lead.unternehmen || '',
        'Ansprechpartner': `${lead.ansprechpartner_vorname || ''} ${lead.ansprechpartner_nachname || ''}`.trim(),
        'Telefon': lead.telefonnummer || '',
        'E-Mail': lead.mail || '',
        'Website': lead.website || '',
        'Closer': lead.closer_name || '',
        'Setter': lead.setter_name || '',
        'Hot-Lead Status': lead.status || '',
        'Follow-Up Status': lead.follow_up_status || 'aktiv',
        'Nächster Schritt': lead.follow_up_naechster_schritt || '',
        'Fällig am': lead.follow_up_datum ? formatDate(lead.follow_up_datum) : '',
        'Letzte Aktion': lead.letzte_aktionen?.[0]?.beschreibung || '',
        'Kommentar': lead.kommentar || ''
      }))

      // Excel erstellen
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Follow-Up Leads')

      // Spaltenbreiten anpassen
      const colWidths = [
        { wch: 30 }, // Unternehmen
        { wch: 25 }, // Ansprechpartner
        { wch: 18 }, // Telefon
        { wch: 30 }, // E-Mail
        { wch: 25 }, // Website
        { wch: 18 }, // Closer
        { wch: 18 }, // Setter
        { wch: 18 }, // Hot-Lead Status
        { wch: 15 }, // Follow-Up Status
        { wch: 35 }, // Nächster Schritt
        { wch: 12 }, // Fällig am
        { wch: 40 }, // Letzte Aktion
        { wch: 40 }  // Kommentar
      ]
      worksheet['!cols'] = colWidths

      // Dateiname mit Datum
      const dateStr = new Date().toISOString().split('T')[0]
      const fileName = `Follow-Up_Export_${dateStr}.xlsx`

      // Download
      XLSX.writeFile(workbook, fileName)

    } catch (err) {
      console.error('Export error:', err)
      alert('Fehler beim Export: ' + err.message)
    } finally {
      setExporting(false)
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
    <div className="space-y-6">
      {/* Header mit Tab-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-display text-on-surface">
            Follow-Up
          </h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {isAdmin()
              ? `${totalLeads} Lead${totalLeads !== 1 ? 's' : ''} im Follow-Up-Prozess`
              : `${totalLeads} deiner Leads im Follow-Up`
            }
          </p>
        </div>

        {/* Tab-Navigation */}
        <div className="flex items-center bg-surface-container rounded-xl p-1 shadow-ambient-sm">
          {/* Liste Tab */}
          <button
            onClick={() => setViewMode('liste')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-label-lg font-medium transition-all duration-200 ${
              viewMode === 'liste'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <List className="w-4 h-4" />
            Liste
          </button>

          {/* Kanban Tab */}
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-label-lg font-medium transition-all duration-200 ${
              viewMode === 'kanban'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <Columns className="w-4 h-4" />
            Kanban
            {kanbanActions.filter(a => (a.kanban_status || 'offen') === 'offen').length > 0 && (
              <span className={`min-w-[20px] text-center px-1.5 py-0.5 text-label-sm rounded-full ${
                viewMode === 'kanban'
                  ? 'bg-on-primary/20 text-on-primary'
                  : 'bg-primary text-on-primary'
              }`}>
                {kanbanActions.filter(a => (a.kanban_status || 'offen') === 'offen').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-error-container rounded-xl p-4 text-error">
          {error}
        </div>
      )}

      {/* ==================== LISTE VIEW ==================== */}
      {viewMode === 'liste' && (
        <>
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
                title="Aktualisieren"
              >
                <RefreshCw className={`w-5 h-5 text-on-surface-variant ${refreshing ? 'animate-spin' : ''}`} />
              </button>

              {/* Excel Export */}
              <button
                onClick={handleExportExcel}
                disabled={exporting}
                className="flex items-center gap-2 px-3 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-ambient-sm disabled:opacity-50"
                title="Als Excel exportieren"
              >
                {exporting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                <span className="hidden sm:inline text-label-md">Export</span>
              </button>
            </div>

            {/* Zeile 2: Filter - responsive grid on mobile */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
              {/* Closer Filter - nur für Admins */}
              {isAdmin() && (
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
              )}

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
        ) : leads.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant">
            <RotateCcw className="w-10 h-10 mx-auto mb-3 text-outline-variant" />
            <p className="text-title-md mb-1">Keine Leads gefunden</p>
            <p className="text-body-sm text-outline">
              Keine Leads mit diesen Filterkriterien im Follow-Up.
            </p>
          </div>
        ) : (
        <div className="divide-y divide-outline-variant">
          {leads.map((lead) => {
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
        {!loading && leads.length > 0 && totalPages > 1 && (
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
            ) : leads.length === 0 ? (
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
            {leads.map((lead, index) => {
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
        {!loading && leads.length > 0 && totalPages > 1 && (
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
        </>
      )}

      {/* ==================== KANBAN VIEW ==================== */}
      {viewMode === 'kanban' && (
        <div className="space-y-4">
          {/* Kanban Header */}
          <div className="flex items-center justify-between">
            <p className="text-body-md text-on-surface-variant">
              {kanbanActions.length} Aufgabe{kanbanActions.length !== 1 ? 'n' : ''} insgesamt
            </p>
            <button
              onClick={loadKanbanActions}
              disabled={kanbanLoading}
              className="p-2.5 bg-surface-container-lowest rounded-lg hover:bg-surface-container transition-colors shadow-ambient-sm"
            >
              <RefreshCw className={`w-5 h-5 text-on-surface-variant ${kanbanLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Kanban Board */}
          {kanbanLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-on-surface-variant">Aufgaben werden geladen...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {KANBAN_COLUMNS.map(column => {
                const columnActions = kanbanActions.filter(a => (a.kanban_status || 'offen') === column.id)
                const ColumnIcon = column.icon

                return (
                  <div
                    key={column.id}
                    className="bg-surface-container rounded-xl p-4 min-h-[400px]"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, column.id)}
                  >
                    {/* Column Header */}
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-outline-variant">
                      <div className={`w-3 h-3 rounded-full ${column.color}`} />
                      <h3 className="font-medium text-on-surface">{column.title}</h3>
                      <span className="ml-auto px-2 py-0.5 bg-surface-container-high rounded-full text-label-sm text-on-surface-variant">
                        {columnActions.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="space-y-3">
                      {columnActions.map(action => {
                        const ActionIcon = getActionIcon(action.typ)
                        const actionIsOverdue = action.faellig_am && new Date(action.faellig_am) < new Date()

                        return (
                          <div
                            key={action.id}
                            draggable
                            onDragStart={() => handleDragStart(action)}
                            onClick={() => setSelectedKanbanAction(action)}
                            className={`
                              bg-surface rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing
                              border-l-4 ${actionIsOverdue && column.id !== 'erledigt' ? 'border-error' : 'border-transparent'}
                              hover:shadow-md transition-all duration-200
                              ${draggedAction?.id === action.id ? 'opacity-50 scale-95' : ''}
                            `}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-shrink-0 mt-0.5">
                                <GripVertical className="w-4 h-4 text-outline-variant" />
                              </div>
                              <ActionIcon className="w-4 h-4 text-on-surface-variant mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-on-surface truncate">
                                  {action.hot_lead?.unternehmen || 'Unbekannt'}
                                </p>
                                <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5">
                                  {action.beschreibung}
                                </p>
                                {action.faellig_am && (
                                  <p className={`text-xs mt-1.5 flex items-center gap-1 ${
                                    actionIsOverdue && column.id !== 'erledigt' ? 'text-error font-medium' : 'text-on-surface-variant'
                                  }`}>
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(action.faellig_am)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {columnActions.length === 0 && (
                        <div className="text-center py-8 text-on-surface-variant">
                          <ColumnIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-body-sm">Keine Aufgaben</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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

                {/* Neuer Kommentar */}
                <div>
                  <label className="block text-body-sm text-on-surface-variant mb-1">Neuer Kommentar</label>
                  <textarea
                    value={editData.neuerKommentar || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, neuerKommentar: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary resize-none"
                    placeholder="Kommentar hinzufügen..."
                  />
                </div>

                {/* Kommentar-History */}
                {selectedLead.kommentar && (
                  <div>
                    <label className="block text-body-sm text-on-surface-variant mb-1">Kommentar-Verlauf</label>
                    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 max-h-48 overflow-y-auto">
                      {selectedLead.kommentar.split('\n').filter(line => line.trim()).map((line, idx) => (
                        <p key={idx} className="text-body-sm text-on-surface py-0.5 border-b border-outline-variant/30 last:border-0">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

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
                    const isEditing = editingActionId === action.id
                    const isDeleting = deletingActionId === action.id

                    return (
                      <div
                        key={action.id}
                        className={`rounded-lg ${
                          action.erledigt ? 'bg-surface-container-lowest opacity-60' : 'bg-surface-container'
                        }`}
                      >
                        {/* Normal View */}
                        {!isEditing && (
                          <div className="flex items-start gap-3 p-3">
                            <div
                              className={`p-2 rounded-lg cursor-pointer ${action.erledigt ? 'bg-green-100' : 'bg-primary-container'} hover:ring-2 hover:ring-primary/30`}
                              onClick={() => handleStartEditAction(action)}
                              title="Klicken zum Bearbeiten"
                            >
                              <ActionIcon className={`h-4 w-4 ${action.erledigt ? 'text-green-700' : 'text-primary'}`} />
                            </div>
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => handleStartEditAction(action)}
                              title="Klicken zum Bearbeiten"
                            >
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
                              onClick={(e) => { e.stopPropagation(); handleToggleActionDone(action.id, action.erledigt) }}
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
                        )}

                        {/* Edit Mode */}
                        {isEditing && (
                          <div className="p-3 space-y-3 border-2 border-primary rounded-lg">
                            <div className="grid grid-cols-2 gap-3">
                              <select
                                value={editingActionData.typ}
                                onChange={(e) => setEditingActionData(prev => ({ ...prev, typ: e.target.value }))}
                                className="px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:border-primary text-body-sm"
                              >
                                {ACTION_TYP_OPTIONS.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                              <input
                                type="date"
                                value={editingActionData.faellig_am || ''}
                                onChange={(e) => setEditingActionData(prev => ({ ...prev, faellig_am: e.target.value }))}
                                className="px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:border-primary text-body-sm"
                              />
                            </div>
                            <textarea
                              value={editingActionData.beschreibung}
                              onChange={(e) => setEditingActionData(prev => ({ ...prev, beschreibung: e.target.value }))}
                              rows={2}
                              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:border-primary resize-none text-body-sm"
                            />
                            <div className="flex items-center justify-between gap-2">
                              {/* Delete Button / Confirmation */}
                              {!isDeleting ? (
                                <button
                                  onClick={() => setDeletingActionId(action.id)}
                                  className="px-3 py-1.5 text-error text-body-sm hover:bg-error-container rounded-lg"
                                >
                                  Löschen
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-body-sm text-error">Wirklich löschen?</span>
                                  <button
                                    onClick={() => handleDeleteAction(action.id)}
                                    className="px-2 py-1 bg-error text-on-error text-label-sm rounded"
                                  >
                                    Ja
                                  </button>
                                  <button
                                    onClick={() => setDeletingActionId(null)}
                                    className="px-2 py-1 bg-surface-container text-on-surface text-label-sm rounded"
                                  >
                                    Nein
                                  </button>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={handleCancelEditAction}
                                  className="px-3 py-1.5 text-on-surface-variant hover:bg-surface-container rounded-lg text-body-sm"
                                >
                                  Abbrechen
                                </button>
                                <button
                                  onClick={handleSaveEditAction}
                                  disabled={saving}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 text-body-sm"
                                >
                                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                  Speichern
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
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

      {/* Kanban Action Edit Drawer */}
      {selectedKanbanAction && createPortal(
        <div
          className="fixed inset-0 bg-scrim/50 z-50"
          onClick={() => { setSelectedKanbanAction(null); setKanbanActionDeleting(false) }}
        >
          <div
            className="absolute right-0 top-0 h-full w-full max-w-md bg-surface shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="sticky top-0 bg-surface border-b border-outline-variant px-6 py-4 flex items-center justify-between">
              <h2 className="text-title-lg font-semibold text-on-surface">
                Aufgabe bearbeiten
              </h2>
              <button
                onClick={() => { setSelectedKanbanAction(null); setKanbanActionDeleting(false) }}
                className="p-2 rounded-lg hover:bg-surface-container"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Lead-Info (readonly) */}
              <div className="flex items-center gap-3 p-3 bg-surface-container rounded-lg">
                <Building2 className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-label-sm text-on-surface-variant">Lead</p>
                  <p className="text-body-md font-medium text-on-surface">{selectedKanbanAction.hot_lead?.unternehmen || 'Unbekannt'}</p>
                </div>
              </div>

              {/* Formular */}
              <div className="space-y-4">
                {/* Typ */}
                <div>
                  <label className="block text-body-sm text-on-surface-variant mb-1">Typ</label>
                  <select
                    value={selectedKanbanAction.typ || 'todo'}
                    onChange={(e) => setSelectedKanbanAction(prev => ({ ...prev, typ: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary"
                  >
                    {ACTION_TYP_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Beschreibung */}
                <div>
                  <label className="block text-body-sm text-on-surface-variant mb-1">Beschreibung</label>
                  <textarea
                    value={selectedKanbanAction.beschreibung || ''}
                    onChange={(e) => setSelectedKanbanAction(prev => ({ ...prev, beschreibung: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary resize-none"
                  />
                </div>

                {/* Fällig am */}
                <div>
                  <label className="block text-body-sm text-on-surface-variant mb-1">Fällig am</label>
                  <input
                    type="date"
                    value={selectedKanbanAction.faellig_am ? selectedKanbanAction.faellig_am.split('T')[0] : ''}
                    onChange={(e) => setSelectedKanbanAction(prev => ({ ...prev, faellig_am: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-body-sm text-on-surface-variant mb-1">Status</label>
                  <select
                    value={selectedKanbanAction.kanban_status || 'offen'}
                    onChange={(e) => setSelectedKanbanAction(prev => ({ ...prev, kanban_status: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary"
                  >
                    {KANBAN_COLUMNS.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Speichern Button */}
              <button
                onClick={handleSaveKanbanAction}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Speichern
              </button>

              {/* Weitere Aktionen */}
              <div className="border-t border-outline-variant pt-4 space-y-3">
                <button
                  onClick={async () => {
                    const leadId = selectedKanbanAction.hot_lead_id
                    setLoadingLeadId(leadId)
                    await openLeadFromKanban(leadId)
                    setSelectedKanbanAction(null)
                    setKanbanActionDeleting(false)
                  }}
                  disabled={loadingLeadId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-primary hover:bg-primary-container rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingLeadId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                  {loadingLeadId ? 'Wird geladen...' : 'Lead öffnen'}
                </button>

                {/* Delete */}
                {!kanbanActionDeleting ? (
                  <button
                    onClick={() => setKanbanActionDeleting(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-error hover:bg-error-container rounded-lg transition-colors"
                  >
                    Aufgabe löschen
                  </button>
                ) : (
                  <div className="p-3 bg-error-container rounded-lg space-y-3">
                    <p className="text-body-sm text-error text-center">Aufgabe wirklich löschen?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setKanbanActionDeleting(false)}
                        className="flex-1 px-3 py-2 bg-surface text-on-surface rounded-lg text-body-sm"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={handleDeleteKanbanAction}
                        className="flex-1 px-3 py-2 bg-error text-on-error rounded-lg text-body-sm"
                      >
                        Ja, löschen
                      </button>
                    </div>
                  </div>
                )}
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
