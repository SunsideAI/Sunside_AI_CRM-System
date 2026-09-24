import { STATUS, anzeigeName } from '../../shared/status.js'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import LeadSchublade, { altbestand } from '../components/LeadSchublade'
import LeadTabelle from '../components/LeadTabelle'
import SpaltenWahl from '../components/SpaltenWahl'
import FilterWahl from '../components/FilterWahl'
import useTabelle from '../hooks/useTabelle'
import { zeileAusLead, sortiere } from '../utils/zeile'
import { filtern } from '../../shared/filter.js'
import { spaltenAus } from '../../shared/spalten.js'
import * as XLSX from 'xlsx'
import {
  RotateCcw,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Loader2,
  RefreshCw,
  Save,
  Download,
  ArrowUpDown
} from 'lucide-react'

// Follow-Up Status Optionen
const FOLLOW_UP_STATUS_OPTIONS = [
  { value: 'aktiv', label: 'Aktiv', color: 'bg-green-100 text-green-700' },
  { value: 'pausiert', label: 'Pausiert', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'abgeschlossen', label: 'Abgeschlossen', color: 'bg-gray-100 text-gray-700' }
]

// Hot-Lead Status Optionen
const HOT_LEAD_STATUS_OPTIONS = [
  { value: STATUS.BERATUNG_VEREINBART,  label: 'Beratungsgespräch vereinbart', color: 'bg-blue-100 text-blue-700' },
  { value: STATUS.BERATUNG_GEFUEHRT,    label: 'Beratungsgespräch geführt',    color: 'bg-sky-100 text-sky-700' },
  { value: STATUS.ABSCHLUSS_VEREINBART, label: 'Abschlussgespräch vereinbart', color: 'bg-indigo-100 text-indigo-700' },
  { value: STATUS.IM_ABSCHLUSS,         label: 'Im Abschluss',                 color: 'bg-secondary-container text-primary' },
  { value: STATUS.ANGEBOT_VERSCHICKT,   label: anzeigeName(STATUS.ANGEBOT_VERSCHICKT), color: 'bg-secondary-container text-primary' },
  { value: STATUS.WIRD_NACHGEFASST,     label: 'Wird nachgefasst',             color: 'bg-amber-100 text-amber-700' },
  { value: STATUS.NICHT_ERSCHIENEN,     label: 'Nicht erschienen',             color: 'bg-rose-100 text-rose-700' },
  { value: STATUS.TERMIN_ABGESAGT,      label: 'Termin abgesagt',              color: 'bg-orange-100 text-orange-700' },
  { value: STATUS.VERLOREN_WIEDERVORLAGE, label: 'Verloren, wiedervorlagefähig', color: 'bg-cyan-100 text-cyan-700' },
  { value: STATUS.VERLOREN_ENDGUELTIG,  label: 'Verloren, endgültig',          color: 'bg-red-100 text-red-700' }
]

// Tabellen-Spalten Konfiguration
// Termin-Filter Optionen
const TERMIN_FILTER_OPTIONS = [
  { value: 'all', label: 'Alle Termine' },
  { value: 'today', label: 'Heute' },
  { value: 'tomorrow', label: 'Morgen' },
  { value: 'week', label: 'Diese Woche' },
  { value: 'past', label: 'Vergangen' }
]

function FollowUp() {
  const { user, isAdmin } = useAuth()

  // State
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [closerFilter, setCloserFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [terminFilter, setTerminFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalLeads, setTotalLeads] = useState(0)
  const [closers, setClosers] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Sort State
  const [sortColumn, setSortColumn] = useState('termin') // Default: nach Beratungsgespräch
  const [sortDirection, setSortDirection] = useState('asc') // 'asc' oder 'desc'
  // Spalten und Filter des Benutzers, wie in den anderen Listen.
  const tabelle = useTabelle('followup')
  const [sortierung, setSortierung] = useState({ spalte: 'termin', ab: false })

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
      return new Date(dateStr).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
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

      // Sort-Spalten Mapping (Frontend → API)
      const sortColumnMap = {
        'termin': 'termin_beratungsgespraech',
        'bisWann': 'follow_up_datum',
        'unternehmen': 'unternehmen',
        'closer': 'unternehmen' // Fallback, da closer_name nicht direkt sortierbar
      }

      const params = new URLSearchParams()
      if (user?.id) params.append('userId', user.id)
      if (closerFilter !== 'all') params.append('closerId', closerFilter)
      if (statusFilter !== 'all') params.append('followUpStatus', statusFilter)
      if (searchTerm) params.append('search', searchTerm)
      // Die Liste kommt am Stück: Es sind einige hundert Kontakte, und
      // Filtern, Sortieren und Blättern passieren im Browser - so wie in
      // Setting und Closing, damit sich alles gleich anfühlt.
      params.append('sortBy', sortColumnMap[sortColumn] || 'termin_beratungsgespraech')
      params.append('sortDir', sortDirection)
      params.append('limit', '2000')
      params.append('offset', '0')

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
  }, [user?.id, closerFilter, statusFilter])

  useEffect(() => {
    if (user?.id) {
      const timer = setTimeout(() => {
        setCurrentPage(1)
        loadLeads()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [searchTerm])

  // Zeilen in die gemeinsame Sprache übersetzen, dann filtern, sortieren und
  // blättern - genau wie in Setting und Closing.
  const alleZeilen = leads.map(l => zeileAusLead('followup', l))
  const gefilterteZeilen = (() => {
    const gefiltert = filtern(alleZeilen, tabelle.filter, 'followup')
    const spalte = spaltenAus('followup', tabelle.spalten)
      .find(x => x.schluessel === sortierung.spalte)
    return spalte ? sortiere(gefiltert, spalte, sortierung.ab) : gefiltert
  })()
  const totalPages = Math.max(1, Math.ceil(gefilterteZeilen.length / LEADS_PER_PAGE))
  const sichereSeite = Math.min(currentPage, totalPages)
  const seitenZeilen = gefilterteZeilen.slice(
    (sichereSeite - 1) * LEADS_PER_PAGE, sichereSeite * LEADS_PER_PAGE)

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

  // Filter zurücksetzen
  const resetFilters = () => {
    setSearchTerm('')
    setCloserFilter('all')
    setStatusFilter('all')
    setTerminFilter('all')
    setCurrentPage(1)
  }

  const hasActiveFilters = searchTerm || closerFilter !== 'all' || statusFilter !== 'all' || terminFilter !== 'all'

  // Termin-Filter anwenden (client-side)
  const filterByTermin = (leadsToFilter) => {
    if (terminFilter === 'all') return leadsToFilter

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + 7)

    return leadsToFilter.filter(lead => {
      if (!lead.termin_beratungsgespraech) return false
      const termin = new Date(lead.termin_beratungsgespraech)
      termin.setHours(0, 0, 0, 0)

      switch (terminFilter) {
        case 'today':
          return termin.getTime() === today.getTime()
        case 'tomorrow':
          return termin.getTime() === tomorrow.getTime()
        case 'week':
          return termin >= today && termin <= weekEnd
        case 'past':
          return termin < today
        default:
          return true
      }
    })
  }

  // Spalte sortieren (Server-seitig - triggert Reload)
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Sort-Icon für Header
  const SortIcon = ({ column }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 text-outline opacity-50" />
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="w-4 h-4 text-primary" />
      : <ChevronDown className="w-4 h-4 text-primary" />
  }

  const filteredLeads = filterByTermin(leads)

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
    <div className="space-y-8">
      {/* Header */}
      <div className="seitenkopf">
        <div>
          <h1 className="text-headline-lg font-display text-on-surface">Follow-Up</h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            {totalLeads} Leads im Follow-Up
          </p>
        </div>

        {/* Aktualisieren, Export und Spaltenwahl standen im Filterkasten
            ueber der Tabelle. Sie gehoeren zur Seite, nicht zum Filter -
            also dorthin, wo jeder andere Tab sie auch hat. */}
        <div className="seitenkopf-bedienung">
          <div>

          <button
            onClick={() => loadLeads(true)}
            disabled={refreshing || loading}
            aria-label="Aktualisieren"
            title="Aktualisieren"
            className="kopf-knopf kopf-knopf-symbol"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exporting}
            title="Als Excel-Datei herunterladen"
            className="kopf-knopf"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline">Export</span>
          </button>

          </div>
        </div>
      </div>

      {/* Filter & Suche - gleiches Layout wie Closing/Opening */}
      <div className="card p-5 space-y-4">
        {/* Zeile 1: Suche + Buttons */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Firma, Name suchen..."
              className="input-field pl-10 pr-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

        </div>

        {/* Zeile 2: Filter */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Closer Filter - nur für Admins */}
          {isAdmin() && (
            <select
              value={closerFilter}
              onChange={(e) => { setCloserFilter(e.target.value); setCurrentPage(1) }}
              className="select-field w-full sm:w-auto sm:min-w-[140px] text-body-sm py-2.5"
            >
              <option value="all">Alle Closer</option>
              {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          {/* Beratungsgespräch Filter */}
          <select
            value={terminFilter}
            onChange={(e) => { setTerminFilter(e.target.value); setCurrentPage(1) }}
            className="select-field w-full sm:w-auto sm:min-w-[140px] text-body-sm py-2.5"
          >
            {TERMIN_FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Rechts, weil beides die Darstellung steuert. */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3 order-last">
            <FilterWahl stufe="followup" filter={tabelle.filter}
                        onAendern={tabelle.filterAendern} zeilen={alleZeilen}
                        speichert={tabelle.speichert} vollstaendig />
            <SpaltenWahl stufe="followup" auswahl={tabelle.spalten}
                         onAendern={tabelle.spaltenAendern} speichert={tabelle.speichert} />
          </div>

          {/* Follow-Up Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
            className="select-field w-full sm:w-auto sm:min-w-[140px] text-body-sm py-2.5"
          >
            <option value="all">Alle Status</option>
            {FOLLOW_UP_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* Filter zurücksetzen */}
          {hasActiveFilters && (
            <button onClick={resetFilters} className="text-primary text-body-sm hover:underline">
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Tabelle. min-h wie in den anderen Tabs - siehe Opening. */}
      <div className="card-elevated overflow-hidden min-h-[600px]">
        {/* Beim Nachladen bleibt die Liste stehen - sonst springt die Seite. */}
        {loading && gefilterteZeilen.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-on-surface-variant">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Wird geladen …
          </div>
        ) : (
          <div className={`transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
            <LeadTabelle
              stufe="followup"
              auswahl={tabelle.spalten}
              zeilen={seitenZeilen}
              leer="Kein Kontakt im Follow-Up mit diesen Kriterien."
              badgeFarbe={(wert, z, spalte) => {
                const liste = spalte.schluessel === 'fu_status'
                  ? FOLLOW_UP_STATUS_OPTIONS
                  : HOT_LEAD_STATUS_OPTIONS
                const schluessel = spalte.schluessel === 'fu_status' ? z.fu_status : z.statusWert
                return liste.find(o => o.value === schluessel)?.color
                  || 'bg-surface-container text-on-surface-variant'
              }}
              sortierung={sortierung}
              onSortierung={(spalte) => { setCurrentPage(1); setSortierung(x =>
                x.spalte === spalte ? { spalte, ab: !x.ab } : { spalte, ab: false }) }}
              onZeile={(z) => handleSelectLead(z.roh)}
            />
          </div>
        )}

        {/* Pagination */}
        {!loading && gefilterteZeilen.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant">
            <span className="text-body-sm text-on-surface-variant">
              Seite {sichereSeite} von {totalPages} · {gefilterteZeilen.length} Kontakte
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
      {/* Dieselbe Schublade wie in den anderen drei Tabs. Vorher stand hier
          ein eigenes Portal: Kontaktdaten als Liste ohne Überschrift, der
          Verlauf zugeklappt ganz oben, der Speichern-Knopf mittendrin. */}
      <LeadSchublade
        offen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        titel={selectedLead?.unternehmen || 'Kontakt'}
        untertitel={[selectedLead?.kategorie, selectedLead?.ort].filter(Boolean).join(' · ')}
        kontakt={{
          ansprechpartner: [selectedLead?.ansprechpartner_vorname, selectedLead?.ansprechpartner_nachname]
            .filter(Boolean).join(' '),
          statusFeld: selectedLead?.follow_up_status || 'Aktiv',
          telefon: selectedLead?.telefonnummer,
          email: selectedLead?.mail,
          website: selectedLead?.website,
          ort: selectedLead?.ort,
          rollen: { closer: selectedLead?.closer_name }
        }}
        termin={selectedLead?.termin_beratungsgespraech ? {
          datum: new Date(selectedLead.termin_beratungsgespraech).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
          }) + ' Uhr',
          art: 'Beratungsgespräch'
        } : null}
        verlauf={selectedLead && {
          hotLeadId: selectedLead.id,
          altbestand: altbestand(selectedLead.kommentar)
        }}
        arbeitsTitel="Follow-Up"
        arbeitsIcon={RotateCcw}
        fuss={selectedLead && (
          <button
            onClick={handleSaveLead}
            disabled={saving}
            className="fuss-haupt"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Speichern
          </button>
        )}
      >
        {selectedLead && (
          <>
            <div>
              <label className="feld-label">Status</label>
              <select
                value={editData.follow_up_status}
                onChange={(e) => setEditData(prev => ({ ...prev, follow_up_status: e.target.value }))}
                className="select-field"
              >
                {FOLLOW_UP_STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="feld-label">Nächster Schritt</label>
              <textarea
                value={editData.follow_up_naechster_schritt}
                onChange={(e) => setEditData(prev => ({ ...prev, follow_up_naechster_schritt: e.target.value }))}
                rows={2}
                className="textarea-field"
                placeholder="Was ist als nächstes zu tun?"
              />
            </div>

            <div>
              <label className="feld-label">Bis wann</label>
              <input
                type="date"
                value={editData.follow_up_datum}
                onChange={(e) => setEditData(prev => ({ ...prev, follow_up_datum: e.target.value }))}
                className="input-field"
              />
            </div>

            <div>
              <label className="feld-label">Neuer Kommentar</label>
              <textarea
                value={editData.neuerKommentar}
                onChange={(e) => setEditData(prev => ({ ...prev, neuerKommentar: e.target.value }))}
                rows={2}
                className="textarea-field"
                placeholder="Kommentar hinzufügen..."
              />
            </div>
          </>
        )}
      </LeadSchublade>
    </div>
  )
}

export default FollowUp
