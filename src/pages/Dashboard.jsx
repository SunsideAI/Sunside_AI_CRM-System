import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  Phone,
  Calendar,
  TrendingUp,
  TrendingDown,
  Users,
  ArrowRight,
  Loader2,
  RefreshCw,
  BarChart3,
  Target,
  DollarSign,
  Award,
  XCircle,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Filter,
  Search,
  X,
  Mail,
  Globe,
  MapPin,
  Building2,
  FileText,
  User,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Lightbulb,
  TrendingUp as TrendUp,
  GitCompare
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts'

// ==========================================
// CACHE HELPERS
// ==========================================
const CACHE_DURATION = 5 * 60 * 1000 // 5 Minuten

function getCache(key) {
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_DURATION) {
        return parsed.data
      }
    }
  } catch (e) {
    console.error('Cache read error:', e)
  }
  return null
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
  } catch (e) {
    console.error('Cache write error:', e)
  }
}

function Dashboard() {
  const { user, hasRole } = useAuth()
  const [activeView, setActiveView] = useState('uebersicht')
  
  const isColdcaller = () => hasRole('Coldcaller')
  const isCloser = () => hasRole('Closer')
  const isAdmin = () => hasRole('Admin')

  const showKaltakquiseTab = isColdcaller() || isAdmin()
  const showClosingTab = isCloser() || isAdmin()

  return (
    <div className="space-y-8">
      {/* Header mit Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-display text-on-surface">Dashboard</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {activeView === 'uebersicht' && 'Hier ist dein Überblick für heute.'}
            {activeView === 'kaltakquise' && 'Kaltakquise Performance-Analyse'}
            {activeView === 'closing' && 'Closing Performance-Analyse'}
          </p>
        </div>

        {/* Toggle Buttons - scrollable on mobile */}
        <div className="w-full sm:w-auto overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center bg-gray-100 rounded-lg p-1 min-w-max">
            <button
              onClick={() => setActiveView('uebersicht')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-md text-label-md sm:text-label-lg transition-all duration-250 whitespace-nowrap ${
                activeView === 'uebersicht'
                  ? 'bg-gradient-primary text-white shadow-glow-primary'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden xs:inline">Übersicht</span>
              <span className="xs:hidden">Start</span>
            </button>

            {showKaltakquiseTab && (
              <button
                onClick={() => setActiveView('kaltakquise')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-md text-label-md sm:text-label-lg transition-all duration-250 whitespace-nowrap ${
                  activeView === 'kaltakquise'
                    ? 'bg-gradient-primary text-white shadow-glow-primary'
                    : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
                }`}
              >
                <Phone className="h-4 w-4" />
                <span className="hidden sm:inline">Kaltakquise</span>
                <span className="sm:hidden">Akquise</span>
              </button>
            )}

            {showClosingTab && (
              <button
                onClick={() => setActiveView('closing')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-md text-label-md sm:text-label-lg transition-all duration-250 whitespace-nowrap ${
                  activeView === 'closing'
                    ? 'bg-gradient-primary text-white shadow-glow-primary'
                    : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
                }`}
              >
                <Target className="h-4 w-4" />
                Closing
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {activeView === 'uebersicht' && (
        <UebersichtContent user={user} isColdcaller={isColdcaller} isCloser={isCloser} isAdmin={isAdmin} />
      )}
      {activeView === 'kaltakquise' && (
        <KaltakquiseAnalytics user={user} isAdmin={isAdmin} />
      )}
      {activeView === 'closing' && (
        <ClosingAnalytics user={user} isAdmin={isAdmin} />
      )}
    </div>
  )
}

// ==========================================
// ÜBERSICHT CONTENT
// ==========================================
function UebersichtContent({ user, isColdcaller, isCloser, isAdmin }) {
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [data, setData] = useState({
    zugewiesenLeads: 0,
    callsHeute: 0,
    termineWoche: 0,
    abschluesseMonat: 0
  })

  useEffect(() => {
    // Nur laden wenn der User verfügbar ist
    if (user?.vor_nachname) {
      loadData()
    }
  }, [user?.vor_nachname])

  const loadData = async (forceRefresh = false) => {
    const cacheKey = `dashboard_uebersicht_${user?.vor_nachname || 'unknown'}`
    const cached = getCache(cacheKey)
    
    if (cached && !forceRefresh) {
      updateDataFromResult(cached)
      setInitialLoading(false)
      return
    }

    setLoading(true)
    if (!cached) setInitialLoading(true)

    try {
      const params = new URLSearchParams()
      params.append('userName', user?.vor_nachname || '')
      params.append('userRole', isAdmin() ? 'Admin' : isColdcaller() ? 'Coldcaller' : 'Closer')

      const response = await fetch(`/.netlify/functions/dashboard?${params.toString()}`)
      const result = await response.json()

      if (response.ok) {
        setCache(cacheKey, result)
        updateDataFromResult(result)
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  const updateDataFromResult = (result) => {
    const userStats = result.vertriebler?.find(v =>
      v.name?.toLowerCase().trim() === user?.vor_nachname?.toLowerCase().trim()
    )

    // Für Closers: zugewieseneHotLeads als Fallback nutzen
    const zugewiesene = userStats?.gesamt || result.zugewieseneHotLeads || 0

    setData({
      zugewiesenLeads: zugewiesene,
      callsHeute: result.heute || 0,
      termineWoche: result.termineWoche || 0,
      abschluesseMonat: result.abschluesseMonat || 0
    })
  }

  const stats = [
    {
      name: 'Zugewiesene Leads',
      value: initialLoading ? '...' : data.zugewiesenLeads.toLocaleString('de-DE'),
      icon: Users,
      color: 'bg-blue-500',
      show: isColdcaller() || isAdmin()
    },
    {
      name: 'Calls heute',
      value: initialLoading ? '...' : data.callsHeute.toLocaleString('de-DE'),
      icon: Phone,
      color: 'bg-green-500',
      show: isColdcaller() || isAdmin()
    },
    {
      name: 'Termine diese Woche',
      value: initialLoading ? '...' : data.termineWoche.toLocaleString('de-DE'),
      icon: Calendar,
      color: 'bg-purple-500',
      show: true
    },
    {
      name: 'Abschlüsse Monat',
      value: initialLoading ? '...' : data.abschluesseMonat.toLocaleString('de-DE'),
      icon: TrendingUp,
      color: 'bg-orange-500',
      show: isCloser() || isAdmin()
    }
  ].filter(stat => stat.show)

  const quickActions = [
    {
      name: 'Leads anrufen',
      description: 'Starte mit der Kaltakquise',
      path: '/kaltakquise',
      icon: Phone,
      color: 'text-green-600 bg-green-100',
      show: isColdcaller() || isAdmin()
    },
    {
      name: 'Closing vorbereiten',
      description: 'Nächste Termine ansehen',
      path: '/closing',
      icon: Calendar,
      color: 'text-purple-600 bg-purple-100',
      show: isCloser() || isAdmin()
    }
  ].filter(action => action.show)

  return (
    <div className="space-y-8">
      {/* Begrüßung */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-headline-sm font-display text-on-surface">
            Hallo, {user?.vorname || 'User'}!
          </h2>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={loading}
          className="flex items-center p-2.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-all duration-250"
          title="Daten aktualisieren"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Statistiken - Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={stat.name}
            className={`relative overflow-hidden rounded-xl p-6 transition-all duration-250 ${
              index === 0
                ? 'metric-card-primary'
                : 'metric-card hover:shadow-card-hover'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className={`text-label-md ${index === 0 ? 'text-white/80' : 'text-on-surface-variant'}`}>
                  {stat.name}
                </p>
                <p className={`mt-2 text-display-sm font-display ${index === 0 ? 'text-white' : 'text-on-surface'}`}>
                  {initialLoading ? (
                    <span className="inline-block w-8 h-8">
                      <Loader2 className={`w-6 h-6 animate-spin ${index === 0 ? 'text-white/50' : 'text-primary/30'}`} />
                    </span>
                  ) : (
                    stat.value
                  )}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${index === 0 ? 'bg-white/20' : 'bg-secondary-container'}`}>
                <stat.icon className={`w-5 h-5 ${index === 0 ? 'text-white' : 'text-primary'}`} />
              </div>
            </div>
            {/* Decorative gradient overlay for hero card */}
            {index === 0 && (
              <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl" />
            )}
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <div>
          <h2 className="text-title-lg font-display text-on-surface mb-4">Schnellzugriff</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {quickActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="flex items-center justify-between p-6 card hover:shadow-ambient-md transition-all duration-250 group"
              >
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-secondary-container">
                    <action.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="ml-4">
                    <h3 className="font-medium text-on-surface">{action.name}</h3>
                    <p className="text-body-sm text-on-surface-variant">{action.description}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-outline group-hover:text-primary group-hover:translate-x-1 transition-all duration-250" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Meine Leads im Closing - für alle Rollen */}
      {(isColdcaller() || isCloser() || isAdmin()) && (
        <MeineLeadsImClosing 
          userId={user?.id} 
          userName={user?.vor_nachname} 
          isColdcaller={isColdcaller}
          isCloser={isCloser}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}

// ==========================================
// MEINE LEADS IM CLOSING (für Coldcaller)
// ==========================================
// ==========================================
// MEINE LEADS IM CLOSING
// ==========================================
function MeineLeadsImClosing({ userId, userName, isColdcaller, isCloser, isAdmin }) {
  const [hotLeads, setHotLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedLead, setSelectedLead] = useState(null)
  
  const LEADS_PER_PAGE = 10

  useEffect(() => {
    if (userName) {
      loadHotLeads()
    } else {
      setLoading(false)
    }
  }, [userName])

  const loadHotLeads = async () => {
    if (!userName) {
      setLoading(false)
      return
    }
    
    try {
      // Beide Abfragen parallel: Als Closer UND als Setter (wie in Termine.jsx)
      const [closerResponse, setterResponse] = await Promise.all([
        fetch(`/.netlify/functions/hot-leads?closerName=${encodeURIComponent(userName)}`)
          .then(r => r.json())
          .catch(() => ({ hotLeads: [] })),
        fetch(`/.netlify/functions/hot-leads?setterName=${encodeURIComponent(userName)}`)
          .then(r => r.json())
          .catch(() => ({ hotLeads: [] }))
      ])
      
      // Kombinieren und Duplikate entfernen (basierend auf ID)
      const allLeads = [...(closerResponse.hotLeads || []), ...(setterResponse.hotLeads || [])]
      const uniqueLeads = allLeads.reduce((acc, lead) => {
        if (!acc.find(l => l.id === lead.id)) {
          acc.push(lead)
        }
        return acc
      }, [])
      
      // Sortieren: Neueste Termine zuerst
      const sortedLeads = uniqueLeads.sort((a, b) => {
        const dateA = a.terminDatum ? new Date(a.terminDatum) : new Date(0)
        const dateB = b.terminDatum ? new Date(b.terminDatum) : new Date(0)
        return dateB - dateA
      })
      setHotLeads(sortedLeads)
    } catch (err) {
      console.error('Hot Leads laden fehlgeschlagen:', err)
      setHotLeads([])
    } finally {
      setLoading(false)
    }
  }

  // Helper: Wert sicher in String konvertieren (Arrays und JSON-Array-Strings)
  const safeString = (value) => {
    if (!value) return ''

    // Echtes Array
    if (Array.isArray(value)) {
      return value.join(' ').trim()
    }

    // String prüfen
    const strValue = String(value).trim()

    // JSON-Array-String: '["value"]' oder '["val1", "val2"]'
    if (strValue.startsWith('[') && strValue.endsWith(']')) {
      try {
        const parsed = JSON.parse(strValue)
        if (Array.isArray(parsed)) {
          return parsed.join(' ').trim()
        }
      } catch (e) {
        // Kein gültiges JSON
      }
    }

    return strValue
  }

  // Gefilterte Leads
  const getFilteredLeads = () => {
    if (!searchTerm || !searchTerm.trim()) return hotLeads
    const search = searchTerm.toLowerCase().trim()
    return hotLeads.filter(lead => {
      const unternehmen = safeString(lead.unternehmen).toLowerCase()
      const vorname = safeString(lead.ansprechpartnerVorname).toLowerCase()
      const nachname = safeString(lead.ansprechpartnerNachname).toLowerCase()
      const email = safeString(lead.email).toLowerCase()
      const ort = safeString(lead.ort).toLowerCase()
      return unternehmen.includes(search) || 
             vorname.includes(search) || 
             nachname.includes(search) || 
             email.includes(search) || 
             ort.includes(search)
    })
  }

  const filteredLeads = getFilteredLeads()
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * LEADS_PER_PAGE
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + LEADS_PER_PAGE)

  // Suche Handler
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1)
  }

  const clearSearch = () => {
    setSearchTerm('')
    setCurrentPage(1)
  }

  // Pagination Handler
  const goToPreviousPage = () => {
    setCurrentPage(p => Math.max(1, p - 1))
  }

  const goToNextPage = () => {
    setCurrentPage(p => Math.min(totalPages, p + 1))
  }

  // Modal Handler
  const openModal = (lead) => {
    setSelectedLead(lead)
  }

  const closeModal = () => {
    setSelectedLead(null)
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
    switch (status) {
      case 'Lead': return 'badge-primary'
      case 'Angebot': return 'badge-warning'
      case 'Angebot versendet': return 'badge-secondary'
      case 'Abgeschlossen': return 'badge-success'
      case 'Termin abgesagt': return 'bg-warning-container text-warning'
      case 'Termin verschoben': return 'bg-warning-container text-warning'
      case 'Verloren': return 'badge-error'
      default: return 'bg-surface-container text-on-surface-variant'
    }
  }

  // Statistiken - Termin abgesagt/verschoben zählen als "offen" (müssen neu terminiert werden)
  const stats = {
    lead: hotLeads.filter(l => l.status === 'Lead' || l.status === 'Termin abgesagt' || l.status === 'Termin verschoben').length,
    angebot: hotLeads.filter(l => l.status === 'Angebot versendet' || l.status === 'Angebot').length,
    gewonnen: hotLeads.filter(l => l.status === 'Abgeschlossen').length
  }

  return (
    <div className="card-elevated overflow-hidden min-h-[600px]">
      {/* Header */}
      <div className="p-6 bg-surface-container/50">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center">
            <div className="p-2.5 bg-gradient-primary rounded-lg mr-3 shadow-glow-primary">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-title-lg font-display text-on-surface">Meine Leads im Closing</h2>
              <p className="text-body-sm text-on-surface-variant">
                {loading ? 'Lädt...' : `${hotLeads.length} Leads im Closing-Prozess`}
              </p>
            </div>
          </div>

          {/* Mini-Stats - Glass Cards */}
          <div className="flex gap-3">
            <div className="glass-panel px-4 py-2 text-center min-w-[70px]">
              <span className="block text-title-lg font-display text-secondary">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto text-secondary/50" /> : stats.lead}
              </span>
              <span className="text-label-sm text-on-surface-variant">Offen</span>
            </div>
            <div className="glass-panel px-4 py-2 text-center min-w-[70px]">
              <span className="block text-title-lg font-display text-primary">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary/50" /> : stats.angebot}
              </span>
              <span className="text-label-sm text-on-surface-variant">Angebot</span>
            </div>
            <div className="glass-panel px-4 py-2 text-center min-w-[70px]">
              <span className="block text-title-lg font-display text-success">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto text-success/50" /> : stats.gewonnen}
              </span>
              <span className="text-label-sm text-on-surface-variant">Gewonnen</span>
            </div>
          </div>
        </div>

        {/* Suchleiste - Ghost Style */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input
            type="text"
            placeholder="Lead suchen..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="input-field pl-10 pr-10"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Lead-Liste - feste Mindesthöhe um Layout-Sprünge zu vermeiden */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-on-surface-variant">Leads werden geladen...</p>
          </div>
        ) : paginatedLeads.length === 0 ? (
          <div className="p-8 text-center">
            <Target className="w-12 h-12 text-outline-variant mx-auto mb-4" />
            {searchTerm ? (
              <div>
                <p className="text-on-surface-variant">Keine Leads gefunden</p>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="text-primary hover:text-primary-container text-body-sm mt-2 transition-colors"
                >
                  Suche zurücksetzen
                </button>
              </div>
            ) : (
              <div>
                <p className="text-on-surface-variant">Noch keine Leads im Closing</p>
                <p className="text-body-sm text-outline mt-1">Buche Termine um Leads hierhin zu bringen</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-outline-variant">
              {paginatedLeads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => openModal(lead)}
                  className="p-4 cursor-pointer hover:bg-surface-container active:bg-surface-container-high transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-on-surface truncate">
                        {safeString(lead.unternehmen) || 'Unbekannt'}
                      </h3>
                      <p className="text-body-sm text-on-surface-variant truncate">
                        {lead.kategorie || 'Unternehmen'}
                      </p>
                      {lead.terminDatum && (
                        <p className="text-body-sm text-outline mt-1 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(lead.terminDatum)}
                        </p>
                      )}
                    </div>
                    <span className={`badge flex-shrink-0 ${getStatusStyle(lead.status)}`}>
                      {lead.status || 'Neu'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container">
                  <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Unternehmen
                  </th>
                  <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider hidden md:table-cell">
                    Ansprechpartner
                  </th>
                  <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">
                    Termin
                  </th>
                  <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">
                    Ort
                  </th>
                  <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.map((lead, index) => (
                  <tr
                    key={lead.id}
                    onClick={() => openModal(lead)}
                    className={`table-row cursor-pointer ${index % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'}`}
                  >
                    {/* Status-Indikator */}
                    <td className="px-4 py-4">
                      <div
                        className={`p-1.5 rounded-lg inline-flex ${
                          lead.status === 'Abgeschlossen'
                            ? 'bg-success-container text-success'
                            : lead.status === 'Verloren'
                            ? 'bg-error-container text-error'
                            : lead.status === 'Angebot' || lead.status === 'Angebot versendet'
                            ? 'bg-warning-container text-warning'
                            : 'bg-surface-container text-outline'
                        }`}
                      >
                        {lead.status === 'Abgeschlossen' ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : lead.status === 'Verloren' ? (
                          <AlertCircle className="w-5 h-5" />
                        ) : lead.status === 'Angebot' || lead.status === 'Angebot versendet' ? (
                          <FileText className="w-5 h-5" />
                        ) : (
                          <Calendar className="w-5 h-5" />
                        )}
                      </div>
                    </td>

                    {/* Unternehmen */}
                    <td className="px-4 py-4">
                      <div className="font-medium text-on-surface">{safeString(lead.unternehmen) || 'Unbekannt'}</div>
                      <div className="text-body-sm text-on-surface-variant">{lead.kategorie || 'Unternehmen'}</div>
                    </td>

                    {/* Ansprechpartner */}
                    <td className="px-4 py-4 hidden md:table-cell">
                      <div className="flex items-center text-on-surface-variant">
                        <User className="w-4 h-4 mr-1.5 text-outline" />
                        {safeString(lead.ansprechpartnerVorname)} {safeString(lead.ansprechpartnerNachname)}
                      </div>
                    </td>

                    {/* Termin */}
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <div className="flex items-center text-on-surface-variant">
                        <Calendar className="w-4 h-4 mr-1.5 text-outline" />
                        {lead.terminDatum ? formatDate(lead.terminDatum) : '—'}
                      </div>
                    </td>

                    {/* Ort */}
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <div className="flex items-center text-on-surface-variant">
                        <MapPin className="w-4 h-4 mr-1.5 text-outline" />
                        {safeString(lead.ort) || '—'}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-4">
                      <span className={`badge ${getStatusStyle(lead.status)}`}>
                        {lead.status || 'Unbekannt'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Pagination - shared for both views */}
            {filteredLeads.length > LEADS_PER_PAGE && (
              <div className="p-3 md:p-4 bg-surface-container/30 flex items-center justify-between">
                <span className="text-body-sm text-on-surface-variant">
                  {startIndex + 1}-{Math.min(startIndex + LEADS_PER_PAGE, filteredLeads.length)} von {filteredLeads.length}
                </span>
                <div className="flex items-center gap-1 md:gap-2">
                  <button
                    type="button"
                    onClick={goToPreviousPage}
                    disabled={safeCurrentPage === 1}
                    className="p-2 bg-surface-container-lowest rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
                  </button>
                  <span className="text-body-sm text-on-surface px-2">
                    {safeCurrentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={goToNextPage}
                    disabled={safeCurrentPage === totalPages}
                    className="p-2 bg-surface-container-lowest rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="modal-backdrop absolute inset-0"
            onClick={closeModal}
          />

          {/* Modal Content */}
          <div className="modal-content relative max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-primary rounded-lg">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-headline-sm font-display text-on-surface">{selectedLead.unternehmen || 'Lead Details'}</h2>
                  <p className="text-body-sm text-on-surface-variant">{selectedLead.kategorie || 'Hot Lead'}</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-surface-container rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto flex-1">
              {/* Kontaktdaten Grid - CI Style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {/* Telefon */}
                {safeString(selectedLead.telefon) ? (
                  <a
                    href={`tel:${safeString(selectedLead.telefon)}`}
                    className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Phone className="w-5 h-5 text-purple-600 mr-3" />
                    <span className="text-gray-900">{safeString(selectedLead.telefon)}</span>
                  </a>
                ) : (
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg text-gray-400">
                    <Phone className="w-5 h-5 mr-3" />
                    <span>Keine Telefonnummer</span>
                  </div>
                )}

                {/* E-Mail */}
                {safeString(selectedLead.email) ? (
                  <a
                    href={`mailto:${safeString(selectedLead.email)}`}
                    className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Mail className="w-5 h-5 text-purple-600 mr-3" />
                    <span className="text-gray-900 truncate">{safeString(selectedLead.email)}</span>
                  </a>
                ) : (
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg text-gray-400">
                    <Mail className="w-5 h-5 mr-3" />
                    <span>Keine E-Mail</span>
                  </div>
                )}

                {/* Website */}
                {safeString(selectedLead.website) ? (
                  <a
                    href={safeString(selectedLead.website).startsWith('http') ? safeString(selectedLead.website) : `https://${safeString(selectedLead.website)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Globe className="w-5 h-5 text-purple-600 mr-3" />
                    <span className="text-gray-900 truncate">{safeString(selectedLead.website)}</span>
                  </a>
                ) : (
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg text-gray-400">
                    <Globe className="w-5 h-5 mr-3" />
                    <span>Keine Website</span>
                  </div>
                )}

                {/* Standort */}
                <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <MapPin className="w-5 h-5 text-purple-600 mr-3" />
                  <span className="text-gray-900">
                    {[safeString(selectedLead.ort), safeString(selectedLead.bundesland)].filter(Boolean).join(', ') || 'Kein Standort'}
                  </span>
                </div>

                {/* Ansprechpartner */}
                {(safeString(selectedLead.ansprechpartnerVorname) || safeString(selectedLead.ansprechpartnerNachname)) && (
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <User className="w-5 h-5 text-purple-600 mr-3" />
                    <div>
                      <span className="text-xs text-gray-500">Ansprechpartner</span>
                      <p className="text-gray-900">{safeString(selectedLead.ansprechpartnerVorname)} {safeString(selectedLead.ansprechpartnerNachname)}</p>
                    </div>
                  </div>
                )}

                {/* Termin */}
                {selectedLead.terminDatum && (
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-purple-600 mr-3" />
                    <div>
                      <span className="text-xs text-gray-500">Termin</span>
                      <p className="text-gray-900">{formatDate(selectedLead.terminDatum)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Zuständig Box - CI Gradient Style */}
              {(selectedLead.setterName || selectedLead.closerName) && (
                <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <Users className="w-4 h-4 mr-2 text-purple-600" />
                    Zuständig
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedLead.setterName && (
                      <div className="bg-white p-3 rounded-lg shadow-sm">
                        <p className="text-xs text-gray-500">Coldcaller</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedLead.setterName}</p>
                      </div>
                    )}
                    {selectedLead.closerName && (
                      <div className="bg-white p-3 rounded-lg shadow-sm">
                        <p className="text-xs text-gray-500">Closer</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedLead.closerName}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Deal-Werte - CI Gradient Style */}
              {(selectedLead.setup > 0 || selectedLead.retainer > 0) && (
                <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <DollarSign className="w-4 h-4 mr-2 text-green-600" />
                    Deal-Details
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <p className="text-xs text-gray-500">Setup</p>
                      <p className="text-lg font-semibold text-gray-900">{formatMoney(selectedLead.setup)}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <p className="text-xs text-gray-500">Retainer</p>
                      <p className="text-lg font-semibold text-gray-900">{formatMoney(selectedLead.retainer)}/M</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <p className="text-xs text-gray-500">Laufzeit</p>
                      <p className="text-lg font-semibold text-gray-900">{selectedLead.laufzeit || '-'} Mon</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <p className="text-xs text-gray-500">Gesamt</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatMoney((selectedLead.setup || 0) + (selectedLead.retainer || 0) * (selectedLead.laufzeit || 1))}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status & Notizen */}
              <div className="space-y-4">
                <h3 className="text-title-md font-display text-on-surface">Status & Notizen</h3>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <span className={`badge ${getStatusStyle(selectedLead.status)}`}>
                    {selectedLead.status || 'Unbekannt'}
                  </span>
                  {selectedLead.terminart && (
                    <span className="badge badge-primary">
                      {selectedLead.terminart}
                    </span>
                  )}
                </div>

                {/* Notizen - formatiert wie in Closing */}
                <div className="bg-surface-container-lowest rounded-xl p-4 max-h-[200px] overflow-y-auto">
                  {selectedLead.kommentar ? (
                    <div className="space-y-3">
                      {(() => {
                        const lines = selectedLead.kommentar.split('\n').filter(line => line.trim())
                        const groups = []
                        let currentPlainGroup = []

                        lines.forEach((line) => {
                          const historyMatch = line.match(/^\[(\d{2}\.\d{2}\.\d{4}),?\s*(\d{2}:\d{2})\]\s*(.+)$/)

                          if (historyMatch) {
                            if (currentPlainGroup.length > 0) {
                              groups.push({ type: 'plain', lines: currentPlainGroup })
                              currentPlainGroup = []
                            }
                            groups.push({ type: 'history', match: historyMatch, line })
                          } else {
                            currentPlainGroup.push(line)
                          }
                        })

                        if (currentPlainGroup.length > 0) {
                          groups.push({ type: 'plain', lines: currentPlainGroup })
                        }

                        return groups.map((group, index) => {
                          if (group.type === 'history') {
                            const [, datum, zeit, rest] = group.match
                            const emojiMatch = rest.match(/^(📧|📅|✅|↩️|📋|👤|💬|🎯|📞|❌|✉️|📄)\s*(.+)$/)
                            const emoji = emojiMatch ? emojiMatch[1] : '📋'
                            let text = emojiMatch ? emojiMatch[2] : rest
                            const userMatch = text.match(/\(([^)]+)\)$/)
                            const userName = userMatch ? userMatch[1] : null
                            if (userMatch) text = text.replace(/\s*\([^)]+\)$/, '')

                            return (
                              <div key={index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-container transition-colors">
                                <span className="text-lg flex-shrink-0">{emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-body-sm text-on-surface">{text}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-label-sm text-outline">{datum}, {zeit}</span>
                                    {userName && (
                                      <span className="text-label-sm text-on-surface-variant">• {userName}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          } else {
                            return (
                              <div key={index} className="flex items-start gap-3 p-2">
                                <span className="text-lg flex-shrink-0">💬</span>
                                <div className="text-body-sm text-on-surface space-y-1">
                                  {group.lines.map((line, lineIdx) => (
                                    <p key={lineIdx}>{line}</p>
                                  ))}
                                </div>
                              </div>
                            )
                          }
                        })
                      })()}
                    </div>
                  ) : (
                    <p className="text-body-sm text-outline italic">Noch keine Notizen vorhanden</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-6 flex-shrink-0">
              <button
                onClick={closeModal}
                className="btn-primary w-full"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// KALTAKQUISE ANALYTICS (ehemals Setting)
// ==========================================
function KaltakquiseAnalytics({ user, isAdmin }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [dateRange, setDateRange] = useState('7days')
  const [selectedUser, setSelectedUser] = useState('all') // NEU: Vertriebler-Filter
  const [vertriebler, setVertriebler] = useState([]) // NEU: Liste aller Vertriebler
  const [refreshing, setRefreshing] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  // Vergleichsmodus
  const [compareMode, setCompareMode] = useState(false)
  const [compareDateRange, setCompareDateRange] = useState('lastWeek')
  const [compareStats, setCompareStats] = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)

  // Cache Key
  const getCacheKey = () => {
    const userPart = isAdmin() ? `admin_${selectedUser}` : (user?.vor_nachname || 'user')
    return `dashboard_kaltakquise_${dateRange}_${userPart}`
  }

  useEffect(() => {
    loadStats()
  }, [dateRange, selectedUser])

  // Auto-trigger AI analysis when stats are loaded
  useEffect(() => {
    if (stats?.summary && !aiAnalysis && !aiLoading) {
      fetchAiAnalysis()
    }
  }, [stats])

  // Erweiterte Zeitraum-Optionen
  const getDateRange = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let startDate = null

    // Lokale Datum-Formatierung (keine Zeitzonen-Konvertierung!)
    const formatDateLocal = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    switch (dateRange) {
      case 'today':
        startDate = today
        break
      case 'yesterday':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 1)
        return {
          startDate: formatDateLocal(startDate),
          endDate: formatDateLocal(startDate) // Nur gestern
        }
      case 'thisWeek':
        startDate = new Date(today)
        const dayOfWeek = startDate.getDay() || 7 // Sonntag = 7 statt 0
        startDate.setDate(startDate.getDate() - dayOfWeek + 1) // Montag dieser Woche
        break
      case 'lastWeek':
        const lastWeekEnd = new Date(today)
        const lastWeekDayOfWeek = lastWeekEnd.getDay() || 7 // Sonntag = 7 statt 0
        lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekDayOfWeek) // Letzter Sonntag
        const lastWeekStart = new Date(lastWeekEnd)
        lastWeekStart.setDate(lastWeekStart.getDate() - 6)
        return {
          startDate: formatDateLocal(lastWeekStart),
          endDate: formatDateLocal(lastWeekEnd)
        }
      case '7days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 7)
        break
      case '14days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 14)
        break
      case '30days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 30)
        break
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'lastMonth':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
        return {
          startDate: formatDateLocal(lastMonthStart),
          endDate: formatDateLocal(lastMonthEnd)
        }
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        break
      case 'all':
        startDate = null
        break
      default:
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 7)
    }

    return {
      startDate: startDate ? formatDateLocal(startDate) : null,
      endDate: formatDateLocal(today)
    }
  }

  const loadStats = async (forceRefresh = false) => {
    const cacheKey = getCacheKey()
    const cached = getCache(cacheKey)

    if (cached && !forceRefresh) {
      setStats(cached)
      if (cached.perUser) {
        setVertriebler(cached.perUser)
      }
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { startDate, endDate } = getDateRange()
      const userEmail = user?.email_geschaeftlich || user?.email
      const userName = user?.vor_nachname

      const params = new URLSearchParams({
        type: 'setting',
        admin: isAdmin().toString(),
        ...(userEmail && !isAdmin() && { email: userEmail }),
        ...(userName && !isAdmin() && { userName }),
        // NEU: Wenn Admin einen Vertriebler auswählt
        ...(isAdmin() && selectedUser !== 'all' && { filterUserName: selectedUser }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      })

      const res = await fetch(`/.netlify/functions/analytics?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCache(cacheKey, data)
        setStats(data)
        // Vertriebler-Liste NUR updaten wenn "Alle" ausgewählt ist
        // Sonst verlieren wir die vollständige Liste beim Filtern
        if (data.perUser && isAdmin() && selectedUser === 'all') {
          setVertriebler(data.perUser)
        }
      } else {
        throw new Error('Fehler beim Laden')
      }
    } catch (err) {
      console.error('Kaltakquise Analytics Error:', err)
      setError('Fehler beim Laden der Analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    loadStats(true)
    if (compareMode) {
      loadCompareStats()
    }
  }

  // Vergleichsdaten laden
  const loadCompareStats = async () => {
    setCompareLoading(true)
    try {
      const { startDate, endDate } = getDateRangeFor(compareDateRange)
      const userEmail = user?.email_geschaeftlich || user?.email
      const userName = user?.vor_nachname

      const params = new URLSearchParams({
        type: 'setting',
        admin: isAdmin().toString(),
        ...(userEmail && !isAdmin() && { email: userEmail }),
        ...(userName && !isAdmin() && { userName }),
        ...(isAdmin() && selectedUser !== 'all' && { filterUserName: selectedUser }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      })

      const res = await fetch(`/.netlify/functions/analytics?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCompareStats(data)
      }
    } catch (err) {
      console.error('Compare Stats Error:', err)
    } finally {
      setCompareLoading(false)
    }
  }

  // Flexible Datum-Berechnung für beliebigen Zeitraum
  const getDateRangeFor = (range) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let startDate = null

    const formatDateLocal = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    switch (range) {
      case 'today':
        startDate = today
        break
      case 'yesterday':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 1)
        return { startDate: formatDateLocal(startDate), endDate: formatDateLocal(startDate) }
      case 'thisWeek':
        startDate = new Date(today)
        const dayOfWeek = startDate.getDay() || 7
        startDate.setDate(startDate.getDate() - dayOfWeek + 1)
        break
      case 'lastWeek':
        const lastWeekEnd = new Date(today)
        const lastWeekDayOfWeek = lastWeekEnd.getDay() || 7
        lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekDayOfWeek)
        const lastWeekStart = new Date(lastWeekEnd)
        lastWeekStart.setDate(lastWeekStart.getDate() - 6)
        return { startDate: formatDateLocal(lastWeekStart), endDate: formatDateLocal(lastWeekEnd) }
      case '7days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 7)
        break
      case '14days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 14)
        break
      case '30days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 30)
        break
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'lastMonth':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
        return { startDate: formatDateLocal(lastMonthStart), endDate: formatDateLocal(lastMonthEnd) }
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        break
      case 'all':
        startDate = null
        break
      default:
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 7)
    }

    return {
      startDate: startDate ? formatDateLocal(startDate) : null,
      endDate: formatDateLocal(today)
    }
  }

  // Vergleichsmodus aktivieren/deaktivieren
  useEffect(() => {
    if (compareMode && stats) {
      loadCompareStats()
    } else {
      setCompareStats(null)
    }
  }, [compareMode, compareDateRange])

  // Berechnung der Abweichungen
  const getComparison = (currentValue, compareValue, inverted = false) => {
    if (!compareMode || compareStats === null || compareValue === undefined) return null
    const diff = currentValue - compareValue
    const percent = compareValue > 0 ? ((currentValue - compareValue) / compareValue) * 100 : (currentValue > 0 ? 100 : 0)
    return { diff, percent, inverted }
  }

  // AI-Analyse laden
  const fetchAiAnalysis = async () => {
    if (!stats?.summary) return

    setAiLoading(true)
    setAiError(null)
    setAiAnalysis(null)

    try {
      const dateRangeLabels = {
        'today': 'Heute',
        'yesterday': 'Gestern',
        '7days': 'Letzte 7 Tage',
        '14days': 'Letzte 14 Tage',
        '30days': 'Letzte 30 Tage',
        'thisWeek': 'Diese Woche',
        'lastWeek': 'Letzte Woche',
        'thisMonth': 'Dieser Monat',
        'lastMonth': 'Letzter Monat',
        '3months': 'Letzte 3 Monate',
        'all': 'Gesamter Zeitraum'
      }

      const response = await fetch('/.netlify/functions/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stats: {
            einwahlen: stats.summary?.einwahlen || 0,
            erreicht: stats.summary?.erreicht || 0,
            beratungsgespraech: stats.summary?.beratungsgespraech || 0,
            unterlagen: stats.summary?.unterlagen || 0,
            keinInteresse: stats.summary?.keinInteresse || 0,
            erreichtQuote: stats.summary?.erreichQuote || 0,
            beratungsgespraechQuote: stats.summary?.beratungsgespraechQuote || 0,
            unterlagenQuote: stats.summary?.unterlagenQuote || 0
          },
          dateRange: dateRangeLabels[dateRange] || dateRange
        })
      })

      if (!response.ok) {
        throw new Error('Fehler bei der AI-Analyse')
      }

      const data = await response.json()
      setAiAnalysis(data.analysis)
    } catch (err) {
      console.error('AI Analysis Error:', err)
      setAiError(err.message || 'Fehler bei der AI-Analyse')
    } finally {
      setAiLoading(false)
    }
  }

  const formatPercent = (value) => `${value.toFixed(1)}%`

  // Chart-Farben = exakt gleich wie KPICard Icon-Bubbles
  // Damit man die Zuordnung sofort erkennt
  const CHART_COLORS = {
    // Funnel (Bar Chart)
    einwahlen: '#7C3AED',          // Purple - wie KPICard color="purple"
    erreicht: '#3B82F6',           // Blue - wie KPICard color="blue"

    // Ergebnisse (Pie Chart)
    beratungsgespraech: '#10B981', // Green - wie KPICard color="green"
    unterlagen: '#F59E0B',         // Yellow/Amber - wie KPICard color="yellow"
    keinInteresse: '#EF4444',      // Red - wie KPICard color="red"
    nichtErreicht: '#8B8B9A',      // Gray - neutral
  }

  // Closing Farben
  const CLOSING_COLORS = {
    gewonnen: '#10B981',   // Emerald - Erfolg
    verloren: '#EC4899',   // Pink - komplementär zu Lila
    offen: '#8B8B9A',      // Neutral
    noShow: '#F59E0B'      // Amber - Warnung
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar - Glass Style */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-on-surface-variant">
          {isAdmin()
            ? (selectedUser === 'all' ? 'Übersicht aller Vertriebler' : `Performance: ${selectedUser}`)
            : 'Deine Kaltakquise Performance'
          }
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {/* Vertriebler-Filter für Admins */}
          {isAdmin() && vertriebler.length > 0 && (
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="select-field w-auto min-w-[160px]"
            >
              <option value="all">Alle Vertriebler</option>
              {vertriebler.map((v) => (
                <option key={v.id || v.name} value={v.name}>{v.name}</option>
              ))}
            </select>
          )}

          {/* Zeitraum-Filter */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="select-field w-auto min-w-[140px]"
          >
            <optgroup label="Tage">
              <option value="today">Heute</option>
              <option value="yesterday">Gestern</option>
              <option value="7days">Letzte 7 Tage</option>
              <option value="14days">Letzte 14 Tage</option>
              <option value="30days">Letzte 30 Tage</option>
            </optgroup>
            <optgroup label="Wochen">
              <option value="thisWeek">Diese Woche</option>
              <option value="lastWeek">Letzte Woche</option>
            </optgroup>
            <optgroup label="Monate">
              <option value="thisMonth">Dieser Monat</option>
              <option value="lastMonth">Letzter Monat</option>
              <option value="3months">Letzte 3 Monate</option>
            </optgroup>
            <optgroup label="Gesamt">
              <option value="all">Gesamter Zeitraum</option>
            </optgroup>
          </select>

          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              compareMode
                ? 'bg-primary text-white'
                : 'bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant'
            } shadow-ambient-sm`}
            title="Zeiträume vergleichen"
          >
            <GitCompare className="h-4 w-4" />
            <span className="text-label-sm hidden sm:inline">Vergleichen</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2.5 bg-surface-container-lowest rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50 shadow-ambient-sm"
          >
            <RefreshCw className={`h-5 w-5 text-on-surface-variant ${(refreshing || loading) ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Vergleichszeitraum-Auswahl */}
      {compareMode && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-primary-fixed/30 rounded-lg border border-primary/20">
          <GitCompare className="h-5 w-5 text-primary" />
          <span className="text-label-md text-on-surface">Vergleiche mit:</span>
          <select
            value={compareDateRange}
            onChange={(e) => setCompareDateRange(e.target.value)}
            className="select-field w-auto min-w-[160px]"
          >
            <optgroup label="Tage">
              <option value="yesterday">Gestern</option>
              <option value="7days">Letzte 7 Tage</option>
              <option value="14days">Letzte 14 Tage</option>
              <option value="30days">Letzte 30 Tage</option>
            </optgroup>
            <optgroup label="Wochen">
              <option value="lastWeek">Letzte Woche</option>
            </optgroup>
            <optgroup label="Monate">
              <option value="lastMonth">Letzter Monat</option>
              <option value="3months">Letzte 3 Monate</option>
            </optgroup>
          </select>
          {compareLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {compareStats && (
            <span className="text-label-sm text-outline ml-auto">
              Vergleichszeitraum: {compareStats.summary?.einwahlen || 0} Einwahlen
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="bg-error-container text-error px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && !refreshing ? (
        <div className="card p-6">
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-on-surface-variant">Analytics werden geladen...</p>
          </div>
        </div>
      ) : stats && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard title="Einwahlen" value={stats.summary?.einwahlen || 0} icon={Phone} color="purple" comparison={getComparison(stats.summary?.einwahlen || 0, compareStats?.summary?.einwahlen)} />
            <KPICard title="Erreicht" value={stats.summary?.erreicht || 0} icon={Users} color="blue" subtitle={formatPercent(stats.summary?.erreichQuote || 0)} comparison={getComparison(stats.summary?.erreicht || 0, compareStats?.summary?.erreicht)} />
            <KPICard title="Beratungsgespräch" value={stats.summary?.beratungsgespraech || 0} icon={Calendar} color="green" subtitle={formatPercent(stats.summary?.beratungsgespraechQuote || 0)} comparison={getComparison(stats.summary?.beratungsgespraech || 0, compareStats?.summary?.beratungsgespraech)} />
            <KPICard title="Unterlage/WV" value={stats.summary?.unterlagen || 0} icon={Target} color="yellow" subtitle={formatPercent(stats.summary?.unterlagenQuote || 0)} comparison={getComparison(stats.summary?.unterlagen || 0, compareStats?.summary?.unterlagen)} />
            <KPICard title="Kein Interesse" value={stats.summary?.keinInteresse || 0} icon={XCircle} color="red" subtitle={formatPercent(stats.summary?.keinInteresseQuote || 0)} comparison={getComparison(stats.summary?.keinInteresse || 0, compareStats?.summary?.keinInteresse, true)} />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Funnel */}
            <div className="card p-6">
              <h3 className="text-label-lg text-on-surface mb-4">Ergebnisse in Zahlen</h3>
              {(stats.summary?.einwahlen || 0) > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={[
                      { name: 'Einwahlen', value: stats.summary?.einwahlen || 0 },
                      { name: 'Erreicht', value: stats.summary?.erreicht || 0 },
                      { name: 'Beratungsgespräch', value: stats.summary?.beratungsgespraech || 0 },
                      { name: 'Unterlage/WV', value: stats.summary?.unterlagen || 0 }
                    ]}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E1E2EC" />
                    <XAxis type="number" tick={{ fill: '#44474F' }} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#44474F' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: 'none', borderRadius: '12px', boxShadow: '0 8px 40px rgba(21, 28, 39, 0.1)' }} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      <Cell fill={CHART_COLORS.einwahlen} />
                      <Cell fill={CHART_COLORS.erreicht} />
                      <Cell fill={CHART_COLORS.beratungsgespraech} />
                      <Cell fill={CHART_COLORS.unterlagen} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-outline">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Keine Einwahlen im Zeitraum</p>
                  </div>
                </div>
              )}
            </div>

            {/* Ergebnis Verteilung Pie */}
            <div className="card p-6">
              <h3 className="text-label-lg text-on-surface mb-4">Prozentuale Ergebnisse</h3>
              {(() => {
                const pieData = [
                  { name: 'Beratungsgespräch', value: stats.summary?.beratungsgespraech || 0, color: CHART_COLORS.beratungsgespraech },
                  { name: 'Unterlage/WV', value: stats.summary?.unterlagen || 0, color: CHART_COLORS.unterlagen },
                  { name: 'Kein Interesse', value: stats.summary?.keinInteresse || 0, color: CHART_COLORS.keinInteresse }
                ].filter(d => d.value > 0)

                return pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: 'none', borderRadius: '12px', boxShadow: '0 8px 40px rgba(21, 28, 39, 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-outline">
                  <div className="text-center">
                    <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-body-sm">Keine Ergebnisse im Zeitraum</p>
                  </div>
                </div>
              )
              })()}
            </div>
          </div>

          {/* KI-Analyse Section */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-label-lg text-on-surface">KI-Analyse</h3>
              </div>
              <button
                onClick={fetchAiAnalysis}
                disabled={aiLoading || !stats?.summary}
                className="btn-primary text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-50"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analysiere...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyse generieren
                  </>
                )}
              </button>
            </div>

            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-on-surface-variant">KI analysiert die Daten...</p>
                <p className="text-sm text-outline mt-1">Dies kann einige Sekunden dauern</p>
              </div>
            )}

            {aiError && (
              <div className="bg-error-container text-error px-4 py-3 rounded-lg">
                {aiError}
              </div>
            )}

            {!aiLoading && !aiAnalysis && !aiError && (
              <div className="flex flex-col items-center justify-center py-12 text-outline">
                <Sparkles className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-body-md">Klicke auf "Analyse generieren" für KI-Insights</p>
                <p className="text-sm mt-1">Basierend auf deinen aktuellen Statistiken</p>
              </div>
            )}

            {aiAnalysis && !aiLoading && (
              <div className="space-y-6">
                {/* Zusammenfassung */}
                <div className="bg-primary-container/30 rounded-lg p-4">
                  <p className="text-on-surface font-medium">{aiAnalysis.zusammenfassung}</p>
                </div>

                {/* Insights */}
                {aiAnalysis.insights?.length > 0 && (
                  <div>
                    <h4 className="text-label-md text-on-surface mb-3 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      Erkenntnisse
                    </h4>
                    <div className="space-y-3">
                      {aiAnalysis.insights.map((insight, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg p-4 border-l-4 ${
                            insight.typ === 'positiv'
                              ? 'bg-green-50 border-green-500'
                              : insight.typ === 'negativ'
                              ? 'bg-red-50 border-red-500'
                              : 'bg-gray-50 border-gray-400'
                          }`}
                        >
                          <p className="font-medium text-on-surface">{insight.titel}</p>
                          <p className="text-sm text-on-surface-variant mt-1">{insight.beschreibung}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prognosen */}
                {aiAnalysis.prognosen?.length > 0 && (
                  <div>
                    <h4 className="text-label-md text-on-surface mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Prognosen
                    </h4>
                    <div className="space-y-3">
                      {aiAnalysis.prognosen.map((prognose, idx) => (
                        <div key={idx} className="bg-surface-container rounded-lg p-4">
                          <p className="font-medium text-on-surface">{prognose.titel}</p>
                          <p className="text-sm text-on-surface-variant mt-1">{prognose.beschreibung}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empfehlungen */}
                {aiAnalysis.empfehlungen?.length > 0 && (
                  <div>
                    <h4 className="text-label-md text-on-surface mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Handlungsempfehlungen
                    </h4>
                    <ul className="space-y-2">
                      {aiAnalysis.empfehlungen.map((empfehlung, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-on-surface-variant">
                          <ArrowRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                          <span>{empfehlung}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Aktivität Zeitverlauf */}
          <div className="card p-6">
            <h3 className="text-label-lg text-on-surface mb-4">Einwahlen im Zeitverlauf</h3>
            {stats.zeitverlauf?.length > 0 && stats.zeitverlauf.some(z => (z.count || 0) > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={stats.zeitverlauf}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E1E2EC" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#44474F' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#44474F' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: 'none', borderRadius: '12px', boxShadow: '0 8px 40px rgba(21, 28, 39, 0.1)' }} />
                  <Legend />
                  <Line type="monotone" dataKey="count" name="Einwahlen" stroke="#460E74" strokeWidth={2} dot={{ r: 4, fill: '#460E74' }} activeDot={{ r: 6, fill: '#5E2C8C' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-outline">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-body-sm">Keine Aktivität im Zeitraum</p>
                </div>
              </div>
            )}
          </div>

          {/* Gestapeltes Balkendiagramm - Performance pro Vertriebler (Admin only) */}
          {isAdmin() && (
            <div className="card p-6">
              <h3 className="text-label-lg text-on-surface mb-4">
                {selectedUser === 'all' ? 'Ergebnisse pro Vertriebler (gestapelt)' : `Ergebnisse: ${selectedUser}`}
              </h3>
              {(() => {
                const perUserData = stats.perUser || []
                const chartData = selectedUser === 'all'
                  ? perUserData.slice(0, 20)
                  : perUserData.filter(u => u.name === selectedUser)

                return chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={selectedUser === 'all' ? Math.max(400, perUserData.length * 50) : 120}>
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ left: 20, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E1E2EC" />
                      <XAxis type="number" tick={{ fill: '#44474F' }} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={140}
                        tick={{ fontSize: 12, fill: '#44474F' }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#FFFFFF', border: 'none', borderRadius: '12px', boxShadow: '0 8px 40px rgba(21, 28, 39, 0.1)' }}
                        formatter={(value, name) => {
                          const labels = {
                            beratungsgespraech: 'Beratungsgespräch',
                            unterlagen: 'Unterlage/WV',
                            keinInteresse: 'Kein Interesse'
                          }
                          return [value, labels[name] || name]
                        }}
                      />
                      <Legend
                        formatter={(value) => {
                          const labels = {
                            beratungsgespraech: 'Beratungsgespräch',
                            unterlagen: 'Unterlage/WV',
                            keinInteresse: 'Kein Interesse'
                          }
                          return labels[value] || value
                        }}
                      />
                      <Bar dataKey="beratungsgespraech" stackId="a" fill={CHART_COLORS.beratungsgespraech} name="beratungsgespraech" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="unterlagen" stackId="a" fill={CHART_COLORS.unterlagen} name="unterlagen" />
                      <Bar dataKey="keinInteresse" stackId="a" fill={CHART_COLORS.keinInteresse} name="keinInteresse" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[150px] text-outline">
                    <div className="text-center">
                      <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-body-sm">Keine Daten im ausgewählten Zeitraum</p>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Einwahlen pro Vertriebler (Admin only) */}
          {isAdmin() && (
            <div className="card p-6">
              <h3 className="text-label-lg text-on-surface mb-4">
                {selectedUser === 'all' ? 'Einwahlen & Beratungsgespräche pro Vertriebler' : `Einwahlen & Beratungsgespräche: ${selectedUser}`}
              </h3>
              {(() => {
                const perUserData = stats.perUser || []
                const chartData = selectedUser === 'all'
                  ? perUserData.slice(0, 15)
                  : perUserData.filter(u => u.name === selectedUser)

                return chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={selectedUser === 'all' ? Math.max(300, perUserData.length * 40) : 100}>
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E1E2EC" />
                      <XAxis type="number" tick={{ fill: '#44474F' }} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fill: '#44474F' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: 'none', borderRadius: '12px', boxShadow: '0 8px 40px rgba(21, 28, 39, 0.1)' }} />
                      <Legend />
                      <Bar dataKey="einwahlen" name="Einwahlen" fill="#460E74" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="beratungsgespraech" name="Beratungsgespräch" fill="#10B981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[150px] text-outline">
                    <div className="text-center">
                      <Phone className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-body-sm">Keine Einwahlen im ausgewählten Zeitraum</p>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </>
      )}

      {!stats && !loading && (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-outline mx-auto mb-4" />
          <h3 className="text-title-lg font-display text-on-surface mb-2">Keine Daten verfügbar</h3>
          <p className="text-on-surface-variant">Es gibt noch keine Kaltakquise-Daten für den ausgewählten Zeitraum.</p>
        </div>
      )}
    </div>
  )
}

// ==========================================
// CLOSING ANALYTICS
// ==========================================
function ClosingAnalytics({ user, isAdmin }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [dateRange, setDateRange] = useState('30days')
  const [refreshing, setRefreshing] = useState(false)
  // Vergleichsmodus
  const [compareMode, setCompareMode] = useState(false)
  const [compareDateRange, setCompareDateRange] = useState('lastMonth')
  const [compareStats, setCompareStats] = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)

  const getCacheKey = () => {
    const userPart = isAdmin() ? 'admin' : (user?.email_geschaeftlich || user?.email || 'user')
    return `dashboard_closing_${dateRange}_${userPart}`
  }

  useEffect(() => {
    loadStats()
  }, [dateRange])

  const getDateRange = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let startDate = null

    switch (dateRange) {
      case '7days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 7)
        break
      case '14days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 14)
        break
      case '30days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 30)
        break
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        break
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        break
      default:
        startDate = null
    }

    return {
      startDate: startDate ? startDate.toISOString().split('T')[0] : null,
      endDate: now.toISOString().split('T')[0]
    }
  }

  const loadStats = async (forceRefresh = false) => {
    const cacheKey = getCacheKey()
    const cached = getCache(cacheKey)

    if (cached && !forceRefresh) {
      setStats(cached)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { startDate, endDate } = getDateRange()
      const userEmail = user?.email_geschaeftlich || user?.email
      const userName = user?.vor_nachname || user?.name

      const params = new URLSearchParams({
        type: 'closing',
        admin: isAdmin().toString(),
        ...(userName && !isAdmin() && { userName }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      })

      const res = await fetch(`/.netlify/functions/analytics?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCache(cacheKey, data)
        setStats(data)
      } else {
        throw new Error('Fehler beim Laden')
      }
    } catch (err) {
      console.error('Closing Analytics Error:', err)
      setError('Fehler beim Laden der Analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    loadStats(true)
    if (compareMode) {
      loadCompareStats()
    }
  }

  // Vergleichsdaten laden
  const loadCompareStats = async () => {
    setCompareLoading(true)
    try {
      const { startDate, endDate } = getDateRangeFor(compareDateRange)
      const userName = user?.vor_nachname || user?.name

      const params = new URLSearchParams({
        type: 'closing',
        admin: isAdmin().toString(),
        ...(userName && !isAdmin() && { userName }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      })

      const res = await fetch(`/.netlify/functions/analytics?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCompareStats(data)
      }
    } catch (err) {
      console.error('Compare Stats Error:', err)
    } finally {
      setCompareLoading(false)
    }
  }

  // Flexible Datum-Berechnung für beliebigen Zeitraum
  const getDateRangeFor = (range) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let startDate = null

    switch (range) {
      case '7days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 7)
        break
      case '14days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 14)
        break
      case '30days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 30)
        break
      case 'lastMonth':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
        return { startDate: lastMonthStart.toISOString().split('T')[0], endDate: lastMonthEnd.toISOString().split('T')[0] }
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        break
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        break
      default:
        startDate = null
    }

    return {
      startDate: startDate ? startDate.toISOString().split('T')[0] : null,
      endDate: now.toISOString().split('T')[0]
    }
  }

  // Vergleichsmodus aktivieren/deaktivieren
  useEffect(() => {
    if (compareMode && stats) {
      loadCompareStats()
    } else {
      setCompareStats(null)
    }
  }, [compareMode, compareDateRange])

  // Berechnung der Abweichungen
  const getComparison = (currentValue, compareValue, inverted = false) => {
    if (!compareMode || compareStats === null || compareValue === undefined) return null
    const diff = currentValue - compareValue
    const percent = compareValue > 0 ? ((currentValue - compareValue) / compareValue) * 100 : (currentValue > 0 ? 100 : 0)
    return { diff, percent, inverted }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPercent = (value) => `${value.toFixed(1)}%`

  // Closing Chart-Farben = exakt gleich wie KPICard Icon-Bubbles
  const CLOSING_COLOR_MAP = {
    'Gewonnen': '#10B981',  // Green - wie KPICard color="green"
    'Verloren': '#EF4444',  // Red - wie KPICard color="red"
    'No-Show': '#F59E0B',   // Yellow - wie KPICard color="yellow"
    'Offen': '#9CA3AF'      // Gray - wie KPICard color="gray"
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-on-surface-variant">
          {isAdmin() ? 'Übersicht aller Closer' : 'Deine Closing Performance'}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="select-field w-auto min-w-[140px]"
          >
            <option value="7days">Letzte 7 Tage</option>
            <option value="14days">Letzte 14 Tage</option>
            <option value="30days">Letzte 30 Tage</option>
            <option value="thisMonth">Dieser Monat</option>
            <option value="3months">Letzte 3 Monate</option>
            <option value="year">Letztes Jahr</option>
            <option value="all">Gesamt</option>
          </select>

          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              compareMode
                ? 'bg-primary text-white'
                : 'bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant'
            } shadow-ambient-sm`}
            title="Zeiträume vergleichen"
          >
            <GitCompare className="h-4 w-4" />
            <span className="text-label-sm hidden sm:inline">Vergleichen</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2.5 bg-surface-container-lowest rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50 shadow-ambient-sm"
          >
            <RefreshCw className={`h-5 w-5 text-on-surface-variant ${(refreshing || loading) ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Vergleichszeitraum-Auswahl */}
      {compareMode && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-primary-fixed/30 rounded-lg border border-primary/20">
          <GitCompare className="h-5 w-5 text-primary" />
          <span className="text-label-md text-on-surface">Vergleiche mit:</span>
          <select
            value={compareDateRange}
            onChange={(e) => setCompareDateRange(e.target.value)}
            className="select-field w-auto min-w-[160px]"
          >
            <option value="7days">Letzte 7 Tage</option>
            <option value="14days">Letzte 14 Tage</option>
            <option value="30days">Letzte 30 Tage</option>
            <option value="lastMonth">Letzter Monat</option>
            <option value="3months">Letzte 3 Monate</option>
            <option value="year">Letztes Jahr</option>
          </select>
          {compareLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {compareStats && (
            <span className="text-label-sm text-outline ml-auto">
              Vergleichszeitraum: {formatCurrency(compareStats.summary?.umsatzGesamt || 0)} Umsatz
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="bg-error-container text-error px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && !refreshing ? (
        <div className="card p-6">
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-on-surface-variant">Analytics werden geladen...</p>
          </div>
        </div>
      ) : stats && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <KPICard title="Closing Quote" value={formatPercent(stats.summary?.closingQuote || 0)} icon={TrendingUp} color="purple" subtitle={`${stats.summary?.gewonnen || 0} von ${(stats.summary?.gewonnen || 0) + (stats.summary?.verloren || 0)}`} comparison={getComparison(stats.summary?.closingQuote || 0, compareStats?.summary?.closingQuote)} />
            <KPICard title="Umsatz Gesamt" value={formatCurrency(stats.summary?.umsatzGesamt || 0)} icon={DollarSign} color="green" comparison={getComparison(stats.summary?.umsatzGesamt || 0, compareStats?.summary?.umsatzGesamt)} />
            <KPICard title="Ø Umsatz" value={formatCurrency(stats.summary?.umsatzDurchschnitt || 0)} icon={BarChart3} color="blue" comparison={getComparison(stats.summary?.umsatzDurchschnitt || 0, compareStats?.summary?.umsatzDurchschnitt)} />
            <KPICard title="Gewonnen" value={stats.summary?.gewonnen || 0} icon={Award} color="green" comparison={getComparison(stats.summary?.gewonnen || 0, compareStats?.summary?.gewonnen)} />
            <KPICard title="Verloren" value={stats.summary?.verloren || 0} icon={XCircle} color="red" comparison={getComparison(stats.summary?.verloren || 0, compareStats?.summary?.verloren, true)} />
            <KPICard title="No-Show" value={stats.summary?.noShow || 0} icon={Clock} color="yellow" comparison={getComparison(stats.summary?.noShow || 0, compareStats?.summary?.noShow, true)} />
            <KPICard title="Offen" value={stats.summary?.offen || 0} icon={Target} color="gray" comparison={getComparison(stats.summary?.offen || 0, compareStats?.summary?.offen)} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Umsatz Zeitverlauf */}
            <div className="card p-6">
              <h3 className="text-label-lg text-on-surface mb-4">Umsatz & Closings im Zeitverlauf</h3>
              {stats.zeitverlauf?.length > 0 && stats.zeitverlauf.some(d => (d.umsatz || 0) > 0 || (d.count || 0) > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.zeitverlauf}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E1E2EC" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#44474F' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#44474F' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#44474F' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FFFFFF', border: 'none', borderRadius: '12px', boxShadow: '0 8px 40px rgba(21, 28, 39, 0.1)' }}
                      formatter={(value, name) => {
                        if (name === 'umsatz' || name === 'Umsatz') {
                          return [formatCurrency(value), 'Umsatz']
                        }
                        return [value, 'Abschlüsse']
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="umsatz" name="Umsatz" fill="#460E74" radius={[8, 8, 0, 0]} />
                    <Bar yAxisId="right" dataKey="count" name="Abschlüsse" fill="#10B981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-outline">
                  <div className="text-center">
                    <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-body-sm">Keine Abschlüsse im ausgewählten Zeitraum</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Verteilung */}
            <div className="card p-6">
              <h3 className="text-label-lg text-on-surface mb-4">Status Verteilung</h3>
              {((stats.summary?.gewonnen || 0) > 0 || (stats.summary?.verloren || 0) > 0 || (stats.summary?.offen || 0) > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Gewonnen', value: stats.summary?.gewonnen || 0 },
                        { name: 'Verloren', value: stats.summary?.verloren || 0 },
                        { name: 'Offen', value: stats.summary?.offen || 0 },
                        { name: 'No-Show', value: stats.summary?.noShow || 0 }
                      ].filter(d => d.value > 0)}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {[
                        { name: 'Gewonnen', value: stats.summary?.gewonnen || 0 },
                        { name: 'Verloren', value: stats.summary?.verloren || 0 },
                        { name: 'Offen', value: stats.summary?.offen || 0 },
                        { name: 'No-Show', value: stats.summary?.noShow || 0 }
                      ].filter(d => d.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CLOSING_COLOR_MAP[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: 'none', borderRadius: '12px', boxShadow: '0 8px 40px rgba(21, 28, 39, 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-outline">
                  <div className="text-center">
                    <Target className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-body-sm">Keine Deals im ausgewählten Zeitraum</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Per Closer Stats (Admin only) */}
          {isAdmin() && (
            <div className="card p-6">
              <h3 className="text-label-lg text-on-surface mb-4">Performance pro Closer</h3>
              {stats.perUser && stats.perUser.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, stats.perUser.length * 50)}>
                  <BarChart data={stats.perUser.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E1E2EC" />
                    <XAxis type="number" tick={{ fill: '#44474F' }} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fill: '#44474F' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FFFFFF', border: 'none', borderRadius: '12px', boxShadow: '0 8px 40px rgba(21, 28, 39, 0.1)' }}
                      formatter={(value, name) => {
                        const labels = {
                          offen: 'Offen',
                          gewonnen: 'Gewonnen',
                          verloren: 'Verloren',
                          umsatz: 'Umsatz'
                        }
                        const label = labels[name] || name
                        const displayValue = name === 'umsatz' ? formatCurrency(value) : value
                        return [displayValue, label]
                      }}
                    />
                    <Legend />
                    <Bar dataKey="offen" name="Offen" fill="#9CA3AF" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="gewonnen" name="Gewonnen" fill="#10B981" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="verloren" name="Verloren" fill="#EF4444" stackId="a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[150px] text-outline">
                  <div className="text-center">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-body-sm">Keine Closer-Daten im ausgewählten Zeitraum</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!stats && !loading && (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-outline mx-auto mb-4" />
          <h3 className="text-title-lg font-display text-on-surface mb-2">Keine Daten verfügbar</h3>
          <p className="text-on-surface-variant">Es gibt noch keine Closing-Daten für den ausgewählten Zeitraum.</p>
        </div>
      )}
    </div>
  )
}

// ==========================================
// KPI Card Component
// ==========================================
function KPICard({ title, value, icon: Icon, color, subtitle, comparison }) {
  const colorClasses = {
    purple: 'bg-primary-fixed text-primary',
    green: 'bg-success-container text-success',
    blue: 'bg-secondary-container text-secondary',
    red: 'bg-error-container text-error',
    yellow: 'bg-warning-container text-warning',
    gray: 'bg-surface-container text-on-surface-variant'
  }

  const getComparisonDisplay = () => {
    if (!comparison || comparison.diff === undefined || comparison.diff === null) return null
    const { diff, percent, inverted } = comparison
    const isPositive = inverted ? diff < 0 : diff > 0
    const isNegative = inverted ? diff > 0 : diff < 0
    const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→'
    const colorClass = isPositive ? 'text-success' : isNegative ? 'text-error' : 'text-outline'
    const displayPercent = percent !== undefined ? `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%` : `${diff > 0 ? '+' : ''}${diff}`
    return (
      <span className={`text-label-sm font-medium ${colorClass}`}>
        {arrow} {displayPercent}
      </span>
    )
  }

  return (
    <div className="metric-card p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${colorClasses[color]} flex-shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-label-sm text-on-surface-variant leading-tight truncate">{title}</p>
          <div className="flex items-center gap-2">
            <p className="text-title-md font-display text-on-surface truncate">{value}</p>
            {getComparisonDisplay()}
          </div>
          {subtitle && <p className="text-label-sm text-outline truncate">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
