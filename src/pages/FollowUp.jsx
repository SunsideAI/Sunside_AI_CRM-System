import { useState, useEffect } from 'react'
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
  Calendar,
  Download,
  Settings,
  Eye,
  EyeOff,
  MessageSquare
} from 'lucide-react'

// Follow-Up Status Optionen
const FOLLOW_UP_STATUS_OPTIONS = [
  { value: 'aktiv', label: 'Aktiv', color: 'bg-green-100 text-green-700' },
  { value: 'pausiert', label: 'Pausiert', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'abgeschlossen', label: 'Abgeschlossen', color: 'bg-gray-100 text-gray-700' }
]

// Hot-Lead Status Optionen
const HOT_LEAD_STATUS_OPTIONS = [
  { value: 'Lead', label: 'Lead', color: 'bg-blue-100 text-blue-700' },
  { value: 'Verloren', label: 'Verloren', color: 'bg-red-100 text-red-700' },
  { value: 'Angebot versendet', label: 'Angebot versendet', color: 'bg-purple-100 text-purple-700' },
  { value: 'Termin abgesagt', label: 'Termin abgesagt', color: 'bg-orange-100 text-orange-700' },
  { value: 'Termin verschoben', label: 'Termin verschoben', color: 'bg-amber-100 text-amber-700' },
  { value: 'Wiedervorlage', label: 'Wiedervorlage', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'Im Closing', label: 'Im Closing', color: 'bg-indigo-100 text-indigo-700' }
]

// Tabellen-Spalten Konfiguration
const TABLE_COLUMNS = [
  { id: 'unternehmen', label: 'Unternehmen', default: true, required: true },
  { id: 'closer', label: 'Closer', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'naechsterSchritt', label: 'Nächster Schritt', default: true },
  { id: 'bisWann', label: 'Bis wann', default: true },
  { id: 'kommentar', label: 'Kommentar', default: true }
]

const getDefaultVisibleColumns = () => {
  try {
    const saved = localStorage.getItem('followup_visible_columns_v2')
    if (saved) return JSON.parse(saved)
  } catch (e) {}
  return TABLE_COLUMNS.filter(c => c.default).map(c => c.id)
}

function FollowUp() {
  const { user, isAdmin } = useAuth()

  // State
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [closerFilter, setCloserFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalLeads, setTotalLeads] = useState(0)
  const [closers, setClosers] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(getDefaultVisibleColumns)
  const [showColumnSettings, setShowColumnSettings] = useState(false)

  // Edit State
  const [editData, setEditData] = useState({
    follow_up_status: 'aktiv',
    follow_up_naechster_schritt: '',
    follow_up_datum: '',
    neuerKommentar: ''
  })

  const LEADS_PER_PAGE = 20

  // Datum formatieren
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('de-DE')
    } catch {
      return '-'
    }
  }

  // Prüfen ob überfällig
  const isOverdue = (dateStr) => {
    if (!dateStr) return false
    const date = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

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
      params.append('sortBy', 'follow_up_datum')
      params.append('sortDir', 'asc')
      params.append('limit', LEADS_PER_PAGE.toString())
      params.append('offset', ((currentPage - 1) * LEADS_PER_PAGE).toString())

      const response = await fetch(`/.netlify/functions/follow-up?${params.toString()}`)
      const data = await response.json()

      setLeads(data.leads || [])
      setTotalLeads(data.total || 0)
      setClosers(data.closers || [])
    } catch (err) {
      console.error('Load error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (user?.id) loadLeads()
  }, [user?.id, closerFilter, statusFilter, currentPage])

  useEffect(() => {
    if (user?.id) {
      const timer = setTimeout(() => {
        setCurrentPage(1)
        loadLeads()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [searchTerm])

  const totalPages = Math.ceil(totalLeads / LEADS_PER_PAGE)

  // Lead auswählen
  const handleSelectLead = async (lead) => {
    setSelectedLead(lead)
    setEditData({
      follow_up_status: lead.follow_up_status || 'aktiv',
      follow_up_naechster_schritt: lead.follow_up_naechster_schritt || '',
      follow_up_datum: lead.follow_up_datum?.split('T')[0] || '',
      neuerKommentar: ''
    })

    // Vollständige Daten nachladen
    try {
      const params = new URLSearchParams({ userId: user.id, leadId: lead.id })
      const response = await fetch(`/.netlify/functions/follow-up?${params.toString()}`)
      const data = await response.json()
      if (data.lead) {
        setSelectedLead(data.lead)
        setEditData({
          follow_up_status: data.lead.follow_up_status || 'aktiv',
          follow_up_naechster_schritt: data.lead.follow_up_naechster_schritt || '',
          follow_up_datum: data.lead.follow_up_datum?.split('T')[0] || '',
          neuerKommentar: ''
        })
      }
    } catch (err) {
      console.error('Load lead error:', err)
    }
  }

  // Lead speichern
  const handleSaveLead = async () => {
    if (!selectedLead) return

    try {
      setSaving(true)
      const { neuerKommentar, ...updates } = editData

      const response = await fetch('/.netlify/functions/follow-up', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

      // State updaten
      setLeads(prev => prev.map(l =>
        l.id === selectedLead.id ? { ...l, ...updates, kommentar: data.lead?.kommentar } : l
      ))
      setSelectedLead(prev => ({ ...prev, ...updates, kommentar: data.lead?.kommentar }))
      setEditData(prev => ({ ...prev, neuerKommentar: '' }))
    } catch (err) {
      console.error('Save error:', err)
      alert('Fehler beim Speichern: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Excel Export
  const handleExportExcel = async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams()
      if (user?.id) params.append('userId', user.id)
      if (closerFilter !== 'all') params.append('closerId', closerFilter)
      if (statusFilter !== 'all') params.append('followUpStatus', statusFilter)
      if (searchTerm) params.append('search', searchTerm)
      params.append('limit', '1000')

      const response = await fetch(`/.netlify/functions/follow-up?${params.toString()}`)
      const data = await response.json()
      const exportLeads = data.leads || []

      if (exportLeads.length === 0) {
        alert('Keine Daten zum Exportieren.')
        return
      }

      const excelData = exportLeads.map(lead => ({
        'Unternehmen': lead.unternehmen || '',
        'Ansprechpartner': `${lead.ansprechpartner_vorname || ''} ${lead.ansprechpartner_nachname || ''}`.trim(),
        'Telefon': lead.telefonnummer || '',
        'E-Mail': lead.mail || '',
        'Closer': lead.closer_name || '',
        'Status': lead.status || '',
        'Follow-Up Status': lead.follow_up_status || 'aktiv',
        'Nächster Schritt': lead.follow_up_naechster_schritt || '',
        'Bis wann': lead.follow_up_datum ? formatDate(lead.follow_up_datum) : '',
        'Kommentar': lead.kommentar || ''
      }))

      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Follow-Up')

      const dateStr = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `Follow-Up_${dateStr}.xlsx`)
    } catch (err) {
      console.error('Export error:', err)
      alert('Fehler beim Export')
    } finally {
      setExporting(false)
    }
  }

  // Spalten-Sichtbarkeit
  const toggleColumn = (columnId) => {
    const column = TABLE_COLUMNS.find(c => c.id === columnId)
    if (column?.required) return
    setVisibleColumns(prev => {
      const newColumns = prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
      localStorage.setItem('followup_visible_columns_v2', JSON.stringify(newColumns))
      return newColumns
    })
  }

  const isColumnVisible = (columnId) => visibleColumns.includes(columnId)

  // Filter zurücksetzen
  const resetFilters = () => {
    setSearchTerm('')
    setCloserFilter('all')
    setStatusFilter('all')
    setCurrentPage(1)
  }

  const hasActiveFilters = searchTerm || closerFilter !== 'all' || statusFilter !== 'all'

  // Kommentar-History parsen
  const parseKommentar = (kommentar) => {
    if (!kommentar) return []
    const lines = kommentar.split('\n').filter(line => line.trim())

    return lines.map((line, index) => {
      const historyMatch = line.match(/^\[(\d{2}\.\d{2}\.\d{4}),?\s*(\d{2}:\d{2})\]\s*(.+)$/)
      if (historyMatch) {
        const [, datum, zeit, rest] = historyMatch
        const emojiMatch = rest.match(/^(📧|📅|✅|↩️|📋|👤|💬|🎯|📞|❌|✉️|📄|🔔|💰|🎉|🔄)\s*(.+)$/)
        const emoji = emojiMatch ? emojiMatch[1] : '💬'
        let text = emojiMatch ? emojiMatch[2] : rest
        const userMatch = text.match(/\(([^)]+)\)$/)
        const userName = userMatch ? userMatch[1] : null
        if (userMatch) text = text.replace(/\s*\([^)]+\)$/, '')
        return { type: 'history', datum, zeit, emoji, text, userName, key: index }
      }
      return { type: 'plain', text: line, key: index }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display-sm font-bold text-on-surface">Follow-Up</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            {totalLeads} Leads im Follow-Up
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card-elevated p-4 space-y-4">
        {/* Suche & Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Firma, Name suchen..."
              className="input-field w-full pl-10"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => loadLeads(true)}
              className="p-2.5 bg-surface-container-lowest rounded-lg hover:bg-surface-container"
              title="Aktualisieren"
            >
              <RefreshCw className={`w-5 h-5 text-on-surface-variant ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              <span className="hidden sm:inline">Export</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowColumnSettings(!showColumnSettings)}
                className={`p-2.5 rounded-lg ${showColumnSettings ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest hover:bg-surface-container'}`}
              >
                <Settings className="w-5 h-5" />
              </button>
              {showColumnSettings && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColumnSettings(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-surface rounded-xl shadow-xl border border-outline-variant z-50">
                    <div className="px-4 py-3 border-b border-outline-variant">
                      <p className="text-label-lg font-medium">Spalten</p>
                    </div>
                    <div className="py-2">
                      {TABLE_COLUMNS.map(col => (
                        <button
                          key={col.id}
                          onClick={() => toggleColumn(col.id)}
                          disabled={col.required}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container ${col.required ? 'opacity-50' : ''}`}
                        >
                          {isColumnVisible(col.id) ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-outline" />}
                          <span>{col.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin() && (
            <select
              value={closerFilter}
              onChange={(e) => { setCloserFilter(e.target.value); setCurrentPage(1) }}
              className="select-field"
            >
              <option value="all">Alle Closer</option>
              {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
            className="select-field"
          >
            <option value="all">Alle Status</option>
            {FOLLOW_UP_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {hasActiveFilters && (
            <button onClick={resetFilters} className="text-primary text-body-sm hover:underline">
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Tabelle */}
      <div className="card-elevated overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-container">
              {isColumnVisible('unternehmen') && <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Unternehmen</th>}
              {isColumnVisible('closer') && <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Closer</th>}
              {isColumnVisible('status') && <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Status</th>}
              {isColumnVisible('naechsterSchritt') && <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Nächster Schritt</th>}
              {isColumnVisible('bisWann') && <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Bis wann</th>}
              {isColumnVisible('kommentar') && <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Kommentar</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-16 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-on-surface-variant">Lädt...</p>
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-12 text-center">
                  <RotateCcw className="w-10 h-10 mx-auto mb-3 text-outline-variant" />
                  <p className="text-title-md mb-1">Keine Leads gefunden</p>
                </td>
              </tr>
            ) : (
              leads.map((lead, index) => {
                const overdue = isOverdue(lead.follow_up_datum)
                return (
                  <tr
                    key={lead.id}
                    onClick={() => handleSelectLead(lead)}
                    className={`cursor-pointer transition-colors hover:bg-primary-fixed/20 ${index % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'} ${overdue ? 'bg-red-50/30' : ''}`}
                  >
                    {isColumnVisible('unternehmen') && (
                      <td className="px-4 py-4">
                        <div className="font-medium text-on-surface">{lead.unternehmen || '-'}</div>
                        <div className="text-body-sm text-on-surface-variant">
                          {lead.ansprechpartner_vorname} {lead.ansprechpartner_nachname}
                        </div>
                      </td>
                    )}
                    {isColumnVisible('closer') && (
                      <td className="px-4 py-4 text-body-md">{lead.closer_name || '-'}</td>
                    )}
                    {isColumnVisible('status') && (
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-label-sm ${FOLLOW_UP_STATUS_OPTIONS.find(s => s.value === lead.follow_up_status)?.color || 'bg-gray-100 text-gray-700'}`}>
                          {FOLLOW_UP_STATUS_OPTIONS.find(s => s.value === lead.follow_up_status)?.label || 'Aktiv'}
                        </span>
                      </td>
                    )}
                    {isColumnVisible('naechsterSchritt') && (
                      <td className="px-4 py-4 text-body-md max-w-[200px] truncate">
                        {lead.follow_up_naechster_schritt || '-'}
                      </td>
                    )}
                    {isColumnVisible('bisWann') && (
                      <td className="px-4 py-4">
                        <span className={overdue ? 'text-error font-medium' : ''}>
                          {formatDate(lead.follow_up_datum)}
                        </span>
                      </td>
                    )}
                    {isColumnVisible('kommentar') && (
                      <td className="px-4 py-4 max-w-[250px]">
                        <span className="text-body-sm text-on-surface-variant line-clamp-2">
                          {lead.kommentar?.split('\n')[0]?.substring(0, 60) || '-'}
                        </span>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
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

      {/* Drawer */}
      {selectedLead && createPortal(
        <div className="fixed inset-0 bg-scrim/50 z-50 flex justify-end" onClick={() => setSelectedLead(null)}>
          <div
            className="w-full max-w-lg bg-surface h-full overflow-y-auto shadow-xl animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-surface border-b border-outline-variant px-6 py-4 flex items-center justify-between">
              <h2 className="text-title-lg font-semibold">{selectedLead.unternehmen}</h2>
              <button onClick={() => setSelectedLead(null)} className="p-2 rounded-lg hover:bg-surface-container">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Kontakt-Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <Building2 className="w-4 h-4" />
                  <span>{selectedLead.ansprechpartner_vorname} {selectedLead.ansprechpartner_nachname}</span>
                </div>
                {selectedLead.telefonnummer && (
                  <a href={`tel:${selectedLead.telefonnummer}`} className="flex items-center gap-2 text-primary hover:underline">
                    <Phone className="w-4 h-4" />
                    <span>{selectedLead.telefonnummer}</span>
                  </a>
                )}
                {selectedLead.mail && (
                  <a href={`mailto:${selectedLead.mail}`} className="flex items-center gap-2 text-primary hover:underline">
                    <Mail className="w-4 h-4" />
                    <span>{selectedLead.mail}</span>
                  </a>
                )}
                {selectedLead.website && (
                  <a href={selectedLead.website.startsWith('http') ? selectedLead.website : `https://${selectedLead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                    <Globe className="w-4 h-4" />
                    <span>Website</span>
                  </a>
                )}
                {selectedLead.closer_name && (
                  <div className="text-body-sm text-on-surface-variant">
                    Closer: {selectedLead.closer_name}
                  </div>
                )}
              </div>

              {/* Follow-Up Felder */}
              <div className="space-y-4 border-t border-outline-variant pt-6">
                <h3 className="text-label-lg font-medium text-on-surface-variant uppercase tracking-wide">
                  Follow-Up
                </h3>

                {/* Status */}
                <div>
                  <label className="block text-body-sm text-on-surface-variant mb-1">Status</label>
                  <select
                    value={editData.follow_up_status}
                    onChange={(e) => setEditData(prev => ({ ...prev, follow_up_status: e.target.value }))}
                    className="select-field w-full"
                  >
                    {FOLLOW_UP_STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Nächster Schritt */}
                <div>
                  <label className="block text-body-sm text-on-surface-variant mb-1">Nächster Schritt</label>
                  <textarea
                    value={editData.follow_up_naechster_schritt}
                    onChange={(e) => setEditData(prev => ({ ...prev, follow_up_naechster_schritt: e.target.value }))}
                    rows={2}
                    className="input-field w-full resize-none"
                    placeholder="Was ist als nächstes zu tun?"
                  />
                </div>

                {/* Bis wann */}
                <div>
                  <label className="block text-body-sm text-on-surface-variant mb-1">Bis wann</label>
                  <input
                    type="date"
                    value={editData.follow_up_datum}
                    onChange={(e) => setEditData(prev => ({ ...prev, follow_up_datum: e.target.value }))}
                    className="input-field w-full"
                  />
                </div>

                {/* Neuer Kommentar */}
                <div>
                  <label className="block text-body-sm text-on-surface-variant mb-1">Neuer Kommentar</label>
                  <textarea
                    value={editData.neuerKommentar}
                    onChange={(e) => setEditData(prev => ({ ...prev, neuerKommentar: e.target.value }))}
                    rows={2}
                    className="input-field w-full resize-none"
                    placeholder="Kommentar hinzufügen..."
                  />
                </div>

                {/* Speichern */}
                <button
                  onClick={handleSaveLead}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Speichern
                </button>
              </div>

              {/* Kommentar-Historie */}
              <div className="space-y-4 border-t border-outline-variant pt-6">
                <h3 className="text-label-lg font-medium text-on-surface-variant uppercase tracking-wide flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Kommentare
                </h3>

                <div className="bg-surface-container-lowest rounded-lg p-4 max-h-64 overflow-y-auto">
                  {selectedLead.kommentar ? (
                    <div className="space-y-3">
                      {parseKommentar(selectedLead.kommentar).map(entry => (
                        entry.type === 'history' ? (
                          <div key={entry.key} className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-container">
                            <span className="text-lg">{entry.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-body-sm text-on-surface">{entry.text}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-label-sm text-outline">{entry.datum}, {entry.zeit}</span>
                                {entry.userName && <span className="text-label-sm text-on-surface-variant">• {entry.userName}</span>}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div key={entry.key} className="flex items-start gap-3 p-2">
                            <span className="text-lg">📝</span>
                            <p className="text-body-sm text-on-surface-variant">{entry.text}</p>
                          </div>
                        )
                      ))}
                    </div>
                  ) : (
                    <p className="text-body-sm text-outline italic">Noch keine Kommentare</p>
                  )}
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
