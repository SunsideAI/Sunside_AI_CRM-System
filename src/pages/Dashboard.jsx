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
  User
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
const CACHE_VERSION = 'v4' // Increment to force cache refresh

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
    <div className="space-y-6">
      {/* Header mit Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-500">
            {activeView === 'uebersicht' && 'Hier ist dein Überblick für heute.'}
            {activeView === 'kaltakquise' && 'Kaltakquise Performance-Analyse'}
            {activeView === 'closing' && 'Closing Performance-Analyse'}
          </p>
        </div>

        {/* Toggle Buttons */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveView('uebersicht')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeView === 'uebersicht'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Übersicht
          </button>
          
          {showKaltakquiseTab && (
            <button
              onClick={() => setActiveView('kaltakquise')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeView === 'kaltakquise'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Phone className="h-4 w-4" />
              Kaltakquise
            </button>
          )}
          
          {showClosingTab && (
            <button
              onClick={() => setActiveView('closing')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeView === 'closing'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Target className="h-4 w-4" />
              Closing
            </button>
          )}
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
  const [hotLeadsCount, setHotLeadsCount] = useState({ total: 0, offen: 0, angebot: 0, gewonnen: 0 })

  useEffect(() => {
    loadData()
    // Für Closer/Admin: Auch Hot-Leads-Daten laden
    if (isCloser() || isAdmin()) {
      loadHotLeadsStats()
    }
  }, [])

  // Hot-Leads-Stats für Closer/Admins laden
  const loadHotLeadsStats = async () => {
    try {
      const params = new URLSearchParams()
      if (!isAdmin()) {
        params.append('userName', user?.vor_nachname || '')
      }
      const response = await fetch(`/.netlify/functions/hot-leads?${params.toString()}`)
      const result = await response.json()

      if (response.ok && result.leads) {
        const leads = result.leads
        const offen = leads.filter(l => l.status?.toLowerCase() === 'lead').length
        const angebot = leads.filter(l => l.status?.toLowerCase().includes('angebot')).length
        const gewonnen = leads.filter(l => l.status?.toLowerCase().includes('abgeschlossen')).length

        setHotLeadsCount({
          total: leads.length,
          offen,
          angebot,
          gewonnen
        })
      }
    } catch (err) {
      console.error('Hot-Leads Stats Error:', err)
    }
  }

  const loadData = async (forceRefresh = false) => {
    // Cache Key mit heutigem Datum für tägliche Invalidierung + Version
    const today = new Date().toISOString().split('T')[0]
    const cacheKey = `dashboard_uebersicht_${CACHE_VERSION}_${today}`
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
    // Für Admins: Globale Stats, für User: eigene Stats
    let zugewiesenLeads = 0
    let callsHeute = 0
    let termineWoche = 0

    if (isAdmin()) {
      // Admin sieht globale Statistiken
      // Zugewiesene Leads = Summe aller Vertriebler ODER Gesamtzahl
      const vertrieblerSum = result.vertriebler?.reduce((sum, v) => sum + (v.gesamt || 0), 0) || 0
      zugewiesenLeads = vertrieblerSum > 0 ? vertrieblerSum : (result.gesamt || 0)

      // Calls heute = Globale Kontakte heute
      callsHeute = result.heute || result.globalHeute || 0

      // Termine diese Woche = Alle Beratungsgespräche diese Woche
      termineWoche = result.vertriebler?.reduce((sum, v) => sum + (v.beratungsgespraech || 0), 0) || result.termineWoche || 0
    } else {
      // User sieht nur eigene Stats
      const userStats = result.vertriebler?.find(v => v.name === user?.vor_nachname)
      zugewiesenLeads = userStats?.gesamt || 0
      callsHeute = result.heute || 0
      termineWoche = result.termineWoche || 0
    }

    console.log('Dashboard updateDataFromResult:', {
      isAdmin: isAdmin(),
      zugewiesenLeads,
      callsHeute,
      termineWoche,
      resultGesamt: result.gesamt,
      resultHeute: result.heute,
      vertriebler: result.vertriebler?.length
    })

    setData({
      zugewiesenLeads,
      callsHeute,
      termineWoche,
      abschluesseMonat: 0
    })
  }

  // Dynamische Stats basierend auf Rolle
  const stats = [
    // Für Coldcaller: Zugewiesene Leads aus Kaltakquise
    {
      name: 'Zugewiesene Leads',
      value: initialLoading ? '...' : data.zugewiesenLeads.toLocaleString('de-DE'),
      icon: Users,
      color: 'bg-blue-500',
      show: isColdcaller() && !isCloser() && !isAdmin()
    },
    // Für Closer/Admin: Hot-Leads im Closing
    {
      name: 'Leads im Closing',
      value: initialLoading ? '...' : hotLeadsCount.total.toLocaleString('de-DE'),
      icon: Target,
      color: 'bg-blue-500',
      show: isCloser() || isAdmin()
    },
    // Für Coldcaller: Calls heute
    {
      name: 'Calls heute',
      value: initialLoading ? '...' : data.callsHeute.toLocaleString('de-DE'),
      icon: Phone,
      color: 'bg-green-500',
      show: isColdcaller() && !isCloser() && !isAdmin()
    },
    // Für Closer/Admin: Offene Leads
    {
      name: 'Offene Leads',
      value: initialLoading ? '...' : hotLeadsCount.offen.toLocaleString('de-DE'),
      icon: Clock,
      color: 'bg-yellow-500',
      show: isCloser() || isAdmin()
    },
    // Für Closer/Admin: Angebote
    {
      name: 'Angebote offen',
      value: initialLoading ? '...' : hotLeadsCount.angebot.toLocaleString('de-DE'),
      icon: FileText,
      color: 'bg-purple-500',
      show: isCloser() || isAdmin()
    },
    // Für alle: Abschlüsse/Gewonnen
    {
      name: 'Gewonnen',
      value: initialLoading ? '...' : hotLeadsCount.gewonnen.toLocaleString('de-DE'),
      icon: TrendingUp,
      color: 'bg-green-500',
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
          <h2 className="text-xl font-semibold text-gray-900">
            Hallo, {user?.vorname || 'User'}! 👋
          </h2>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={loading}
          className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="Daten aktualisieren"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Statistiken */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.name}</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  {initialLoading ? (
                    <span className="inline-block w-8 h-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                    </span>
                  ) : (
                    stat.value
                  )}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Schnellzugriff</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="flex items-center justify-between p-6 bg-white rounded-xl border border-gray-200 hover:border-purple-500 hover:shadow-md transition-all group"
              >
                <div className="flex items-center">
                  <div className={`p-3 rounded-lg ${action.color}`}>
                    <action.icon className="w-6 h-6" />
                  </div>
                  <div className="ml-4">
                    <h3 className="font-medium text-gray-900">{action.name}</h3>
                    <p className="text-sm text-gray-500">{action.description}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
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

  // Helper: Wert sicher in String konvertieren
  const safeString = (value) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value[0] || ''
    return String(value)
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
      case 'Lead': return 'bg-blue-100 text-blue-700'
      case 'Angebot': return 'bg-yellow-100 text-yellow-700'
      case 'Angebot versendet': return 'bg-purple-100 text-purple-700'
      case 'Abgeschlossen': return 'bg-green-100 text-green-700'
      case 'Termin abgesagt': return 'bg-orange-100 text-orange-700'
      case 'Termin verschoben': return 'bg-amber-100 text-amber-700'
      case 'Verloren': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  // Statistiken - Termin abgesagt/verschoben zählen als "offen" (müssen neu terminiert werden)
  const stats = {
    lead: hotLeads.filter(l => l.status === 'Lead' || l.status === 'Termin abgesagt' || l.status === 'Termin verschoben').length,
    angebot: hotLeads.filter(l => l.status === 'Angebot versendet' || l.status === 'Angebot').length,
    gewonnen: hotLeads.filter(l => l.status === 'Abgeschlossen').length
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          <span className="ml-2 text-gray-500">Lade Hot Leads...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[600px]">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg mr-3">
              <Target className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Meine Leads im Closing</h2>
              <p className="text-sm text-gray-500">{hotLeads.length} Leads im Closing-Prozess</p>
            </div>
          </div>
          
          {/* Mini-Stats */}
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <span className="block text-lg font-bold text-blue-600">{stats.lead}</span>
              <span className="text-gray-500">Offen</span>
            </div>
            <div className="text-center">
              <span className="block text-lg font-bold text-purple-600">{stats.angebot}</span>
              <span className="text-gray-500">Angebot</span>
            </div>
            <div className="text-center">
              <span className="block text-lg font-bold text-green-600">{stats.gewonnen}</span>
              <span className="text-gray-500">Gewonnen</span>
            </div>
          </div>
        </div>

        {/* Suchleiste - immer anzeigen */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Lead suchen..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Lead-Liste - feste Mindesthöhe um Layout-Sprünge zu vermeiden */}
      <div className="min-h-[400px]">
        {paginatedLeads.length === 0 ? (
          <div className="p-8 text-center">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            {searchTerm ? (
              <div>
                <p className="text-gray-500">Keine Leads gefunden</p>
                <button 
                  type="button"
                  onClick={clearSearch}
                  className="text-purple-600 hover:text-purple-700 text-sm mt-2"
                >
                  Suche zurücksetzen
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-500">Noch keine Leads im Closing</p>
                <p className="text-sm text-gray-400 mt-1">Buche Termine um Leads hierhin zu bringen</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Lead Rows */}
            <div className="divide-y divide-gray-100">
              {paginatedLeads.map((lead) => (
                <div 
                  key={lead.id} 
                  onClick={() => openModal(lead)}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900 truncate">{safeString(lead.unternehmen) || 'Unbekannt'}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(lead.status)}`}>
                          {lead.status || 'Unbekannt'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                        <span>{safeString(lead.ansprechpartnerVorname)} {safeString(lead.ansprechpartnerNachname)}</span>
                        {lead.terminDatum && <span>{formatDate(lead.terminDatum)}</span>}
                        {safeString(lead.ort) && <span>{safeString(lead.ort)}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-2 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {filteredLeads.length > LEADS_PER_PAGE && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {startIndex + 1}-{Math.min(startIndex + LEADS_PER_PAGE, filteredLeads.length)} von {filteredLeads.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goToPreviousPage}
                    disabled={safeCurrentPage === 1}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-700 px-2">
                  {safeCurrentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={goToNextPage}
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

      {/* Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={closeModal}
          />

          {/* Modal Content */}
          <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedLead.unternehmen || 'Lead Details'}</h2>
                <p className="text-sm text-gray-500">{selectedLead.kategorie || 'Hot Lead'}</p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-4 overflow-y-auto flex-1">
              {/* Kontaktdaten Grid */}
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
                      <span className="text-xs text-gray-400">Ansprechpartner</span>
                      <p className="text-gray-900">{safeString(selectedLead.ansprechpartnerVorname)} {safeString(selectedLead.ansprechpartnerNachname)}</p>
                    </div>
                  </div>
                )}

                {/* Termin */}
                {selectedLead.terminDatum && (
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-purple-600 mr-3" />
                    <div>
                      <span className="text-xs text-gray-400">Termin</span>
                      <p className="text-gray-900">{formatDate(selectedLead.terminDatum)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Zuständig Box */}
              {(selectedLead.setterName || selectedLead.closerName) && (
                <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
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

              {/* Deal-Werte */}
              {(selectedLead.setup > 0 || selectedLead.retainer > 0) && (
                <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <DollarSign className="w-4 h-4 mr-2 text-green-600" />
                    Deal-Details
                  </h4>
                  <div className="grid grid-cols-4 gap-4">
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
                <h3 className="font-medium text-gray-900">Status & Notizen</h3>
                
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(selectedLead.status)}`}>
                    {selectedLead.status || 'Unbekannt'}
                  </span>
                  {selectedLead.terminart && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                      {selectedLead.terminart}
                    </span>
                  )}
                </div>

                {/* Notizen */}
                {selectedLead.kommentar ? (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedLead.kommentar}</p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm italic">Noch keine Notizen vorhanden</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={closeModal}
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
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

  // Request-ID um Race Conditions zu verhindern
  const requestIdRef = React.useRef(0)

  // Cache Key - enthält heutiges Datum für tägliche Invalidierung + Version
  const getCacheKey = () => {
    const userPart = isAdmin() ? `admin_${selectedUser}` : (user?.vor_nachname || 'user')
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    return `dashboard_kaltakquise_${CACHE_VERSION}_${dateRange}_${userPart}_${today}`
  }

  useEffect(() => {
    loadStats()
  }, [dateRange, selectedUser])

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
        startDate.setDate(startDate.getDate() - startDate.getDay() + 1) // Montag
        break
      case 'lastWeek':
        const lastWeekEnd = new Date(today)
        lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay()) // Letzter Sonntag
        const lastWeekStart = new Date(lastWeekEnd)
        lastWeekStart.setDate(lastWeekStart.getDate() - 6)
        return {
          startDate: formatDateLocal(lastWeekStart),
          endDate: formatDateLocal(lastWeekEnd)
        }
      case '7days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 6) // Letzte 7 Tage inkl. heute
        break
      case '14days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 13) // Letzte 14 Tage inkl. heute
        break
      case '30days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 29) // Letzte 30 Tage inkl. heute
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
    // Neue Request-ID generieren - ältere Requests werden ignoriert
    const currentRequestId = ++requestIdRef.current

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

      // Prüfen ob dieser Request noch aktuell ist (Race Condition verhindern)
      if (currentRequestId !== requestIdRef.current) {
        console.log('Kaltakquise: Request abgebrochen (neuerer Request läuft)')
        return
      }

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
      // Nur Fehler setzen wenn dieser Request noch aktuell ist
      if (currentRequestId === requestIdRef.current) {
        console.error('Kaltakquise Analytics Error:', err)
        setError('Fehler beim Laden der Analytics')
      }
    } finally {
      // Nur Loading zurücksetzen wenn dieser Request noch aktuell ist
      if (currentRequestId === requestIdRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    loadStats(true)
  }

  const formatPercent = (value) => `${value.toFixed(1)}%`

  // Farben für Charts
  const RESULT_COLORS = {
    beratungsgespraech: '#10B981', // Grün
    unterlagen: '#F59E0B',    // Gelb
    keinInteresse: '#EF4444', // Rot
    nichtErreicht: '#6B7280'  // Grau
  }

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar - Erweitert für Admins */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          {isAdmin() 
            ? (selectedUser === 'all' ? 'Übersicht aller Vertriebler' : `Performance: ${selectedUser}`)
            : 'Deine Kaltakquise Performance'
          }
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {/* NEU: Vertriebler-Filter für Admins */}
          {isAdmin() && vertriebler.length > 0 && (
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Filter className="h-4 w-4 text-gray-400" />
              </div>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg pl-9 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">Alle Vertriebler</option>
                {vertriebler.map((v) => (
                  <option key={v.id || v.name} value={v.name}>{v.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          )}

          {/* Zeitraum-Filter - Erweitert */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {stats && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard title="Einwahlen" value={stats.summary?.einwahlen || 0} icon={Phone} color="purple" />
            <KPICard title="Erreicht" value={stats.summary?.erreicht || 0} icon={Users} color="blue" subtitle={formatPercent(stats.summary?.erreichQuote || 0)} />
            <KPICard title="Beratungsgespräch" value={stats.summary?.beratungsgespraech || 0} icon={Calendar} color="green" subtitle={formatPercent(stats.summary?.beratungsgespraechQuote || 0)} />
            <KPICard title="Unterlage/WV" value={stats.summary?.unterlagen || 0} icon={Target} color="yellow" subtitle={formatPercent(stats.summary?.unterlagenQuote || 0)} />
            <KPICard title="Kein Interesse" value={stats.summary?.keinInteresse || 0} icon={XCircle} color="red" subtitle={formatPercent(stats.summary?.keinInteresseQuote || 0)} />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Funnel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Ergebnisse in Zahlen</h3>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      <Cell fill="#7C3AED" />
                      <Cell fill="#6366F1" />
                      <Cell fill="#10B981" />
                      <Cell fill="#F59E0B" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-gray-400">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Keine Einwahlen im Zeitraum</p>
                  </div>
                </div>
              )}
            </div>

            {/* Ergebnis Verteilung Pie */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Prozentuale Ergebnisse</h3>
              {((stats.summary?.beratungsgespraech || 0) + (stats.summary?.unterlagen || 0) + (stats.summary?.keinInteresse || 0)) > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Beratungsgespräch', value: stats.summary?.beratungsgespraech || 0 },
                        { name: 'Unterlage/WV', value: stats.summary?.unterlagen || 0 },
                        { name: 'Kein Interesse', value: stats.summary?.keinInteresse || 0 }
                      ].filter(d => d.value > 0)}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell fill={RESULT_COLORS.beratungsgespraech} />
                      <Cell fill={RESULT_COLORS.unterlagen} />
                      <Cell fill={RESULT_COLORS.keinInteresse} />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-gray-400">
                  <div className="text-center">
                    <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Keine Ergebnisse im Zeitraum</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Aktivität Zeitverlauf */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Einwahlen im Zeitverlauf</h3>
            {stats.zeitverlauf?.length > 0 && stats.zeitverlauf.some(z => (z.count || 0) > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={stats.zeitverlauf}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" name="Einwahlen" stroke="#7C3AED" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-gray-400">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Keine Aktivität im Zeitraum</p>
                </div>
              </div>
            )}
          </div>

          {/* Gestapeltes Balkendiagramm - Performance pro Vertriebler (Admin only) */}
          {isAdmin() && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis type="number" />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={140} 
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip 
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
                      <Bar dataKey="beratungsgespraech" stackId="a" fill={RESULT_COLORS.beratungsgespraech} name="beratungsgespraech" />
                      <Bar dataKey="unterlagen" stackId="a" fill={RESULT_COLORS.unterlagen} name="unterlagen" />
                      <Bar dataKey="keinInteresse" stackId="a" fill={RESULT_COLORS.keinInteresse} name="keinInteresse" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[150px] text-gray-400">
                    <div className="text-center">
                      <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Keine Daten im ausgewählten Zeitraum</p>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Einwahlen pro Vertriebler (Admin only) */}
          {isAdmin() && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="einwahlen" name="Einwahlen" fill="#7C3AED" />
                      <Bar dataKey="beratungsgespraech" name="Beratungsgespräch" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[150px] text-gray-400">
                    <div className="text-center">
                      <Phone className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Keine Einwahlen im ausgewählten Zeitraum</p>
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
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Daten verfügbar</h3>
          <p className="text-gray-500">Es gibt noch keine Kaltakquise-Daten für den ausgewählten Zeitraum.</p>
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

  // Cache Key - enthält heutiges Datum für tägliche Invalidierung
  const getCacheKey = () => {
    const userPart = isAdmin() ? 'admin' : (user?.email_geschaeftlich || user?.email || 'user')
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    return `dashboard_closing_${CACHE_VERSION}_${dateRange}_${userPart}_${today}`
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
        startDate.setDate(startDate.getDate() - 6) // Letzte 7 Tage inkl. heute
        break
      case '14days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 13) // Letzte 14 Tage inkl. heute
        break
      case '30days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 29) // Letzte 30 Tage inkl. heute
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

  const COLORS = ['#10B981', '#EF4444', '#6B7280', '#F59E0B']

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {isAdmin() ? 'Übersicht aller Closer' : 'Deine Closing Performance'}
        </p>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="7days">Letzte 7 Tage</option>
              <option value="14days">Letzte 14 Tage</option>
              <option value="30days">Letzte 30 Tage</option>
              <option value="thisMonth">Dieser Monat</option>
              <option value="3months">Letzte 3 Monate</option>
              <option value="year">Letztes Jahr</option>
              <option value="all">Gesamt</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {stats && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <KPICard title="Closing Quote" value={formatPercent(stats.summary?.closingQuote || 0)} icon={TrendingUp} color="purple" subtitle={`${stats.summary?.gewonnen || 0} von ${(stats.summary?.gewonnen || 0) + (stats.summary?.verloren || 0)}`} />
            <KPICard title="Umsatz Gesamt" value={formatCurrency(stats.summary?.umsatzGesamt || 0)} icon={DollarSign} color="green" />
            <KPICard title="Ø Umsatz" value={formatCurrency(stats.summary?.umsatzDurchschnitt || 0)} icon={BarChart3} color="blue" />
            <KPICard title="Gewonnen" value={stats.summary?.gewonnen || 0} icon={Award} color="green" />
            <KPICard title="Verloren" value={stats.summary?.verloren || 0} icon={XCircle} color="red" />
            <KPICard title="No-Show" value={stats.summary?.noShow || 0} icon={Clock} color="yellow" />
            <KPICard title="Offen" value={stats.summary?.offen || 0} icon={Target} color="gray" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Umsatz Zeitverlauf */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Umsatz & Closings im Zeitverlauf</h3>
              {stats.zeitverlauf?.length > 0 && stats.zeitverlauf.some(d => (d.umsatz || 0) > 0 || (d.count || 0) > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.zeitverlauf}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'umsatz' || name === 'Umsatz') {
                          return [formatCurrency(value), 'Umsatz']
                        }
                        return [value, 'Abschlüsse']
                      }} 
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="umsatz" name="Umsatz" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="count" name="Abschlüsse" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-gray-400">
                  <div className="text-center">
                    <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Keine Abschlüsse im ausgewählten Zeitraum</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Verteilung */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Status Verteilung</h3>
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
                      {COLORS.map((color, index) => (<Cell key={`cell-${index}`} fill={color} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-gray-400">
                  <div className="text-center">
                    <Target className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Keine Deals im ausgewählten Zeitraum</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Per Closer Stats (Admin only) */}
          {isAdmin() && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Performance pro Closer</h3>
              {stats.perUser && stats.perUser.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, stats.perUser.length * 50)}>
                  <BarChart data={stats.perUser.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip 
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
                    <Bar dataKey="offen" name="Offen" fill="#6B7280" stackId="a" />
                    <Bar dataKey="gewonnen" name="Gewonnen" fill="#10B981" stackId="a" />
                    <Bar dataKey="verloren" name="Verloren" fill="#EF4444" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[150px] text-gray-400">
                  <div className="text-center">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Keine Closer-Daten im ausgewählten Zeitraum</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!stats && !loading && (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Daten verfügbar</h3>
          <p className="text-gray-500">Es gibt noch keine Closing-Daten für den ausgewählten Zeitraum.</p>
        </div>
      )}
    </div>
  )
}

// ==========================================
// KPI Card Component
// ==========================================
function KPICard({ title, value, icon: Icon, color, subtitle }) {
  const colorClasses = {
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    gray: 'bg-gray-50 text-gray-600'
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]} flex-shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 leading-tight">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
