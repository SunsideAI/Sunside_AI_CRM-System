import { STATUS, IST_VERLOREN } from '../../shared/status.js'
import { istOpener, istSetter, ROLLE } from '../../shared/rollen.js'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  ClipboardList,
  History,
  PhoneOff,
  User as UserIcon,
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
  GitCompare,
  CalendarCheck,
  CalendarX,
  Send,
  Hourglass,
  UserCheck
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Verlauf from '../components/Verlauf'
import {
  HeroKennzahl, Kennzahl, Vergleich, DiagrammKarte, LeerZustand, REIHE, STATUS_FARBE
} from '../components/Kennzahlen'
import { altbestand } from '../components/LeadSchublade'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts'

// ==========================================
// DATE RANGE UTILITIES
// ==========================================

// Lokale Datum-Formatierung (keine Zeitzonen-Konvertierung!)
const formatDateLocal = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Smart defaults: Natürliche Vorperiode für jeden Zeitraum
const SMART_COMPARE_DEFAULTS = {
  'today': 'yesterday',
  'yesterday': '7days',
  'thisWeek': 'lastWeek',
  'lastWeek': '7days',
  '7days': '14days',
  '14days': '30days',
  '30days': '3months',
  'thisMonth': 'lastMonth',
  'lastMonth': '3months',
  '3months': 'year',
  'year': 'all',
  'all': '3months'
}

// Labels für Zeiträume
const DATE_RANGE_LABELS = {
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
  'year': 'Letztes Jahr',
  'all': 'Gesamter Zeitraum'
}

// Zentrale Funktion für Datumsberechnung
function computeDateRange(rangeKey) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let startDate = null
  let endDate = today

  switch (rangeKey) {
    case 'today':
      startDate = today
      break
    case 'yesterday':
      startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 1)
      endDate = startDate
      break
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
      return {
        startDate: formatDateLocal(lastWeekStart),
        endDate: formatDateLocal(lastWeekEnd)
      }
    case '7days':
      startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 6)
      break
    case '14days':
      startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 13)
      break
    case '30days':
      startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 29)
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
    case 'year':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
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
    endDate: formatDateLocal(endDate)
  }
}

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

  // Der Aktualisieren-Knopf gehoert in die Kopfzeile, die Ladefunktion in den
  // Inhalt darunter. Der Inhalt traegt sie hier ein.
  //
  // Ein Ref, kein Zustand: Der erste Versuch hob dafuer `loading` des Inhalts
  // mit hoch, und der Knopf blieb dauerhaft deaktiviert, weil der Zustand
  // oben nicht mehr nachgezogen wurde. Der Ref loest kein Neuzeichnen aus und
  // kann darum auch nicht veralten; ob gerade geladen wird, weiss der Knopf
  // von seinem eigenen Aufruf.
  const aktualisierenRef = useRef(null)
  const [laedt, setLaedt] = useState(false)

  const meldeAktualisieren = (fn) => { aktualisierenRef.current = fn }

  const anstossen = async () => {
    if (!aktualisierenRef.current) return
    setLaedt(true)
    try { await aktualisierenRef.current() } finally { setLaedt(false) }
  }
  
  // Opener und Coldcaller sind dieselbe Aufgabe. Ohne istOpener() waere ein
  // Opener in den Kennzahlen als Closer gezaehlt worden - stillschweigend.
  const isColdcaller = () => istOpener(user?.rolle)
  const isCloser = () => hasRole('Closer')
  const isAdmin = () => hasRole('Admin')
  const isSetterNutzer = () => istSetter(user?.rolle)

  // Jede Stufe sieht ihre eigene Auswertung, die Leitung alle. Wer zwei
  // Rollen traegt, bekommt beide Reiter. Der Server prueft dasselbe noch
  // einmal - die Reiter sind nur die Bequemlichkeit.
  const showOpeningTab = isColdcaller() || isAdmin()
  const showSettingTab = isSetterNutzer() || isAdmin()
  const showClosingTab = isCloser() || isAdmin()

  return (
    <div className="space-y-8">
      {/* Header mit Toggle */}
      <div className="seitenkopf">
        <div>
          <h1 className="text-headline-lg font-display text-on-surface">Dashboard</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {activeView === 'uebersicht' && 'Hier ist dein Überblick für heute.'}
            {activeView === 'opening' && 'Opening Performance-Analyse'}
            {activeView === 'setting' && 'Setting Performance-Analyse'}
            {activeView === 'closing' && 'Closing Performance-Analyse'}
          </p>
        </div>

        {/* Umschalter und Aktualisieren in EINER Zeile rechts neben dem Titel. */}
        <div className="seitenkopf-bedienung">
          <div>
          <div className="umschalter">
            <button
              onClick={() => setActiveView('uebersicht')}
              className={`umschalter-knopf gap-2 ${
                activeView === 'uebersicht'
                  ? 'aktiv'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden xs:inline">Übersicht</span>
              <span className="xs:hidden">Start</span>
            </button>

            {showOpeningTab && (
              <button
                onClick={() => setActiveView('opening')}
                className={`umschalter-knopf gap-2 ${
                  activeView === 'opening'
                    ? 'aktiv'
                    : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
                }`}
              >
                <Phone className="h-4 w-4" />
                <span className="hidden sm:inline">Opening</span>
                <span className="sm:hidden">Akquise</span>
              </button>
            )}

            {showSettingTab && (
              <button
                onClick={() => setActiveView('setting')}
                className={`umschalter-knopf gap-2 ${
                  activeView === 'setting'
                    ? 'aktiv'
                    : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
                }`}
              >
                <CalendarCheck className="h-4 w-4" />
                Setting
              </button>
            )}

            {showClosingTab && (
              <button
                onClick={() => setActiveView('closing')}
                className={`umschalter-knopf gap-2 ${
                  activeView === 'closing'
                    ? 'aktiv'
                    : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
                }`}
              >
                <Target className="h-4 w-4" />
                Closing
              </button>
            )}
          </div>

          <button
              onClick={anstossen}
              disabled={laedt}
              aria-label="Aktualisieren"
              title="Aktualisieren"
              className="kopf-knopf kopf-knopf-symbol"
            >
              <RefreshCw className={`w-4 h-4 ${laedt ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeView === 'uebersicht' && (
        <UebersichtContent user={user} isColdcaller={isColdcaller} isCloser={isCloser} isAdmin={isAdmin}
          meldeAktualisieren={meldeAktualisieren} />
      )}
      {activeView === 'opening' && (
        <OpeningAnalytics user={user} isAdmin={isAdmin} meldeAktualisieren={meldeAktualisieren} />
      )}
      {activeView === 'setting' && showSettingTab && (
        <SettingAnalytics user={user} isAdmin={isAdmin} meldeAktualisieren={meldeAktualisieren} />
      )}
      {activeView === 'closing' && (
        <ClosingAnalytics user={user} isAdmin={isAdmin} meldeAktualisieren={meldeAktualisieren} />
      )}
    </div>
  )
}

// ==========================================
// ÜBERSICHT CONTENT
// ==========================================
function UebersichtContent({ user, isColdcaller, isCloser, isAdmin, meldeAktualisieren }) {
  // Der Setter kam im Dashboard bisher gar nicht vor: Er passte in keine der
  // Bedingungen und sah deshalb genau eine Kachel in einem Raster fuer vier.
  // Die Zahlen dafuer liefert die Schnittstelle laengst mit.
  const istSetterNutzer = () => istSetter(user?.rolle)

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [data, setData] = useState({
    zugewiesenLeads: 0,
    callsHeute: 0,
    termineWoche: 0,
    abschluesseMonat: 0,
    meineHotLeads: 0
  })

  useEffect(() => {
    // Nur laden wenn der User verfügbar ist
    if (user?.vor_nachname) {
      loadData()
    }
  }, [user?.vor_nachname])

  // Der Aktualisieren-Knopf steht im Seitenkopf, die Ladefunktion hier. Ohne
  // Abhaengigkeitsliste: nach jedem Zeichnen neu eintragen, damit die Funktion
  // nie auf einen alten Stand zeigt. Ein Ref zieht kein Neuzeichnen nach sich,
  // eine Schleife entsteht dadurch also nicht.
  useEffect(() => {
    meldeAktualisieren?.(() => loadData(true))
  })

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
      // Ein Setter wurde hier als Closer gemeldet - die Kette kannte ihn
      // schlicht nicht. Heute wertet die Function die Rolle zwar nicht aus,
      // aber eine falsche Angabe wartet nur darauf, irgendwann zu wirken.
      params.append('userRole', isAdmin() ? 'Admin'
        : isColdcaller() ? ROLLE.COLDCALLER
        : istSetter(user?.rolle) ? ROLLE.SETTER
        : ROLLE.CLOSER)

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
      abschluesseMonat: result.abschluesseMonat || 0,
      meineHotLeads: result.zugewieseneHotLeads || 0
    })
  }

  const stats = [
    {
      name: 'Zugewiesene Leads',
      value: data.zugewiesenLeads.toLocaleString('de-DE'),
      subtitle: 'in deiner Liste',
      icon: Users,
      color: 'neutral',
      show: isColdcaller() || isAdmin()
    },
    {
      name: 'Calls heute',
      value: data.callsHeute.toLocaleString('de-DE'),
      subtitle: 'seit Mitternacht',
      icon: Phone,
      color: 'neutral',
      show: isColdcaller() || isAdmin()
    },
    {
      name: 'Termine diese Woche',
      value: data.termineWoche.toLocaleString('de-DE'),
      subtitle: 'Montag bis Sonntag',
      icon: Calendar,
      color: 'neutral',
      show: true
    },
    {
      name: 'Meine Beratungsgespräche',
      value: data.meineHotLeads.toLocaleString('de-DE'),
      subtitle: 'offen im Setting',
      icon: Users,
      color: 'neutral',
      show: istSetterNutzer()
    },
    {
      // Die Schnittstelle zaehlt Gewonnene, an denen man als Closer ODER
      // als Setter haengt - die Zahl stimmt fuer beide Rollen.
      name: 'Abschlüsse Monat',
      value: data.abschluesseMonat.toLocaleString('de-DE'),
      subtitle: 'gewonnen in diesem Monat',
      icon: TrendingUp,
      color: 'neutral',
      show: isCloser() || istSetterNutzer() || isAdmin()
    }
  ].filter(stat => stat.show)

  const quickActions = [
    {
      name: 'Leads anrufen',
      description: 'Starte mit dem Opening',
      path: '/opening',
      icon: Phone,
      color: 'text-green-600 bg-green-100',
      show: isColdcaller() || isAdmin()
    },
    {
      name: 'Beratungsgespräche führen',
      description: 'Halten, dokumentieren, übergeben',
      path: '/setting',
      icon: Users,
      color: 'text-primary bg-secondary-container',
      // isAdmin() fehlte als einziger der drei Schnellzugriffe: Opening und
      // Closing standen einem Admin offen, Setting nicht. Der Tab war da, nur
      // der Weg dorthin vom Dashboard aus nicht.
      show: istSetterNutzer() || isAdmin()
    },
    {
      name: 'Closing vorbereiten',
      description: 'Nächste Termine ansehen',
      path: '/closing',
      icon: Calendar,
      color: 'text-primary bg-secondary-container',
      show: isCloser() || isAdmin()
    }
  ].filter(action => action.show)

  return (
    <div className="space-y-8">
      {/* Begrüßung */}
      {/* Kennzahlen - dieselben Kacheln wie in Finanzen, Opening und Closing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          index === 0 ? (
            <HeroKennzahl
              key={stat.name}
              label={stat.name}
              value={stat.value}
              subtitle={stat.subtitle}
              icon={stat.icon}
              laedt={initialLoading}
            />
          ) : (
            <Kennzahl
              key={stat.name}
              label={stat.name}
              value={stat.value}
              subtitle={stat.subtitle}
              icon={stat.icon}
              color={stat.color}
              laedt={initialLoading}
            />
          )
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

      {/* Absicht: Opener und Setter sollen sehen, was in der naechsten Phase
          mit den Kontakten geschieht, die sie uebergeben haben. Deshalb
          bewusst fuer alle Rollen. */}
      {(isColdcaller() || isCloser() || istSetterNutzer() || isAdmin()) && (
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
      // Drei Abfragen parallel: als Closer, als Setter UND als Opener.
      // Der Opener fehlte hier. Vor dem Umbau fiel das nicht auf, weil
      // setter_id auf den zeigte, der den Termin gebucht hatte - also auf
      // den Opener. Seit dem Umbau meint setter_id wirklich den Setter, und
      // der Opener haengt an opener_id. Ohne die dritte Abfrage saehe genau
      // die Rolle hier nichts, fuer die der Block gedacht ist.
      const [closerResponse, setterResponse, openerResponse] = await Promise.all([
        fetch(`/.netlify/functions/hot-leads?closerName=${encodeURIComponent(userName)}`)
          .then(r => r.json())
          .catch(() => ({ hotLeads: [] })),
        fetch(`/.netlify/functions/hot-leads?setterName=${encodeURIComponent(userName)}`)
          .then(r => r.json())
          .catch(() => ({ hotLeads: [] })),
        fetch(`/.netlify/functions/hot-leads?openerName=${encodeURIComponent(userName)}`)
          .then(r => r.json())
          .catch(() => ({ hotLeads: [] }))
      ])

      // Kombinieren und Duplikate entfernen (basierend auf ID)
      const allLeads = [...(closerResponse.hotLeads || []), ...(setterResponse.hotLeads || []),
                        ...(openerResponse.hotLeads || [])]
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
      case STATUS.BERATUNG_VEREINBART:  return 'badge-primary'
      case STATUS.BERATUNG_GEFUEHRT:    return 'badge-primary'
      case STATUS.ABSCHLUSS_VEREINBART: return 'badge-primary'
      case STATUS.IM_ABSCHLUSS:         return 'badge-secondary'
      case STATUS.ANGEBOT_ANGEFORDERT:  return 'badge-warning'
      case STATUS.ANGEBOT_VERSCHICKT:   return 'badge-secondary'
      case STATUS.WIRD_NACHGEFASST:     return 'bg-warning-container text-warning'
      case STATUS.GEWONNEN:             return 'badge-success'
      case STATUS.NICHT_ERSCHIENEN:     return 'bg-warning-container text-warning'
      case STATUS.TERMIN_ABGESAGT:      return 'bg-warning-container text-warning'
      case STATUS.VERLOREN_WIEDERVORLAGE: return 'badge-error'
      case STATUS.VERLOREN_ENDGUELTIG:  return 'badge-error'
      default: return 'bg-surface-container text-on-surface-variant'
    }
  }

  // Statistiken - alles vor dem Angebot zaehlt als laufend; abgesagte und
  // geplatzte Termine gehoeren dazu, weil sie neu terminiert werden muessen.
  const LAUFEND = [
    STATUS.BERATUNG_VEREINBART, STATUS.BERATUNG_GEFUEHRT,
    STATUS.ABSCHLUSS_VEREINBART, STATUS.IM_ABSCHLUSS,
    STATUS.WIRD_NACHGEFASST, STATUS.TERMIN_ABGESAGT, STATUS.NICHT_ERSCHIENEN
  ]
  const stats = {
    lead: hotLeads.filter(l => LAUFEND.includes(l.status)).length,
    angebot: hotLeads.filter(l => l.status === STATUS.ANGEBOT_VERSCHICKT || l.status === STATUS.ANGEBOT_ANGEFORDERT).length,
    gewonnen: hotLeads.filter(l => l.status === STATUS.GEWONNEN).length
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

          {/* Mini-Stats - Glass Cards.
              flex-wrap ist hier kein Schoenheitsfehler-Schutz, sondern noetig:
              Drei Plaettchen zu je rund 102 px plus Abstaende brauchen mehr
              Platz, als die Karte auf einem 390 px breiten Bildschirm innen
              hat. Die Karte hat overflow-hidden - ohne Umbruch wurden die
              Zahlen schlicht abgeschnitten, und zwar unerreichbar, weil
              nichts daran waagerecht scrollbar ist. */}
          <div className="flex flex-wrap gap-3">
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
                          lead.status === STATUS.GEWONNEN
                            ? 'bg-success-container text-success'
                            : IST_VERLOREN.includes(lead.status)
                            ? 'bg-error-container text-error'
                            : lead.status === STATUS.ANGEBOT_ANGEFORDERT || lead.status === STATUS.ANGEBOT_VERSCHICKT
                            ? 'bg-warning-container text-warning'
                            : 'bg-surface-container text-outline'
                        }`}
                      >
                        {lead.status === STATUS.GEWONNEN ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : IST_VERLOREN.includes(lead.status) ? (
                          <AlertCircle className="w-5 h-5" />
                        ) : lead.status === STATUS.ANGEBOT_ANGEFORDERT || lead.status === STATUS.ANGEBOT_VERSCHICKT ? (
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

      {/* Detail Drawer - Slide-in von rechts */}
      {selectedLead && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-scrim/50"
            onClick={closeModal}
          />

          {/* Drawer Content */}
          <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-surface shadow-xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="sticky top-0 bg-surface border-b border-outline-variant px-6 py-4 flex items-center justify-between z-10 flex-shrink-0">
              <div className="min-w-0 pr-4">
                <h2 className="text-title-lg font-semibold text-on-surface truncate">{selectedLead.unternehmen || 'Lead Details'}</h2>
                {[selectedLead.kategorie, selectedLead.ort].filter(Boolean).length > 0 && (
                  <p className="text-body-sm text-on-surface-variant truncate mt-0.5">
                    {[selectedLead.kategorie, selectedLead.ort].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-surface-container rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* KONTAKTDATEN Section */}
              <div className="space-y-3">
                <h3 className="abschnitt-titel flex items-center gap-2">
                    <UserIcon className="w-4 h-4" />
                    Kontaktdaten
                  </h3>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-body-sm text-on-surface-variant">Ansprechpartner</p>
                    <p className="text-body-md text-on-surface">
                      {(safeString(selectedLead.ansprechpartnerVorname) || safeString(selectedLead.ansprechpartnerNachname))
                        ? `${safeString(selectedLead.ansprechpartnerVorname)} ${safeString(selectedLead.ansprechpartnerNachname)}`.trim()
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-body-sm text-on-surface-variant">Kategorie</p>
                    <p className="text-body-md text-on-surface">{selectedLead.kategorie || 'Hot Lead'}</p>
                  </div>
                </div>

                {/* Contact Buttons (Pill Style) */}
                <div className="flex flex-wrap gap-2">
                  {safeString(selectedLead.telefon) && (
                    <a
                      href={`tel:${safeString(selectedLead.telefon)}`}
                      className="flex items-center gap-2 px-3 py-2 bg-surface-container rounded-lg hover:bg-surface-container-high transition-colors"
                    >
                      <Phone className="h-4 w-4 text-primary" />
                      <span className="text-body-sm">{safeString(selectedLead.telefon)}</span>
                    </a>
                  )}
                  {safeString(selectedLead.email) && (
                    <a
                      href={`mailto:${safeString(selectedLead.email)}`}
                      className="flex items-center gap-2 px-3 py-2 bg-surface-container rounded-lg hover:bg-surface-container-high transition-colors"
                    >
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="text-body-sm truncate max-w-[180px]">{safeString(selectedLead.email)}</span>
                    </a>
                  )}
                  {safeString(selectedLead.website) && (
                    <a
                      href={safeString(selectedLead.website).startsWith('http') ? safeString(selectedLead.website) : `https://${safeString(selectedLead.website)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-surface-container rounded-lg hover:bg-surface-container-high transition-colors"
                    >
                      <Globe className="h-4 w-4 text-primary" />
                      <span className="text-body-sm">Website</span>
                    </a>
                  )}
                  {(safeString(selectedLead.ort) || safeString(selectedLead.bundesland)) && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-surface-container rounded-lg">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="text-body-sm">
                        {[safeString(selectedLead.ort), safeString(selectedLead.bundesland)].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Setter/Closer Tags */}
                <div className="flex flex-wrap gap-2">
                  {selectedLead.setterName && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-label-sm">
                      Setter: {selectedLead.setterName}
                    </span>
                  )}
                  {selectedLead.closerName && (
                    <span className="px-2 py-1 bg-secondary-container text-primary rounded-full text-label-sm">
                      Closer: {selectedLead.closerName}
                    </span>
                  )}
                </div>
              </div>

              {/* TERMIN Section */}
              {selectedLead.terminDatum && (
                <div className="space-y-3 abschnitt-trenner">
                  <h3 className="abschnitt-titel flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Termin
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-body-sm text-on-surface-variant">Datum & Uhrzeit</p>
                      <p className="text-body-md text-on-surface">{formatDate(selectedLead.terminDatum)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* DEAL-DETAILS Section */}
              {(selectedLead.setup > 0 || selectedLead.retainer > 0) && (
                <div className="space-y-3 abschnitt-trenner">
                  <h3 className="abschnitt-titel flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Deal-Details
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant">
                    <div>
                      <p className="text-label-sm text-on-surface-variant">Setup</p>
                      <p className="text-title-md font-semibold text-on-surface">{formatMoney(selectedLead.setup)}</p>
                    </div>
                    <div>
                      <p className="text-label-sm text-on-surface-variant">Retainer</p>
                      <p className="text-title-md font-semibold text-on-surface">{formatMoney(selectedLead.retainer)}/Mon</p>
                    </div>
                    <div>
                      <p className="text-label-sm text-on-surface-variant">Laufzeit</p>
                      <p className="text-title-md font-semibold text-on-surface">{selectedLead.laufzeit || '-'} Mon</p>
                    </div>
                    <div>
                      <p className="text-label-sm text-on-surface-variant">Gesamtwert</p>
                      <p className="text-title-md font-semibold text-success">
                        {formatMoney((selectedLead.setup || 0) + (selectedLead.retainer || 0) * (selectedLead.laufzeit || 1))}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* STATUS & NOTIZEN Section */}
              <div className="space-y-3 abschnitt-trenner">
                <h3 className="abschnitt-titel flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    Status
                  </h3>

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

              </div>

              {/* Der Verlauf als eigener Abschnitt, zuletzt - wie in jeder
                  anderen Schublade. Hier stand bis eben die dritte Kopie des
                  handgebauten Kommentar-Zerlegers; die Zeitleiste kann
                  dasselbe und mehr. */}
              <div className="space-y-3 abschnitt-trenner">
                <h3 className="abschnitt-titel flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Verlauf
                </h3>

                <Verlauf hotLeadId={selectedLead.id} leadId={selectedLead.originalLeadId} />

                {altbestand(selectedLead.kommentar) && (
                  <>
                    <div className="text-label-sm text-on-surface-variant">
                      Ältere Notizen ohne Datum
                    </div>
                    <div className="bg-surface-container-lowest rounded-xl p-4 max-h-[200px] overflow-y-auto">
                      <p className="text-body-sm text-on-surface whitespace-pre-line">
                        {altbestand(selectedLead.kommentar)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Fussleiste wie in jeder anderen Schublade. Von hier ging es
                bisher gar nicht weiter - man musste schliessen und im
                richtigen Tab neu suchen. */}
            <div className="schublade-fuss">
              <Link
                to="/closing"
                state={{ openLeadId: selectedLead.id }}
                onClick={closeModal}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors"
              >
                <Target className="w-4 h-4" /> Im Closing öffnen
              </Link>
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
function OpeningAnalytics({ user, isAdmin, meldeAktualisieren }) {
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

  // Cache Keys
  const getCacheKey = () => {
    const userPart = isAdmin() ? `admin_${selectedUser}` : (user?.vor_nachname || 'user')
    return `dashboard_v2_opening_${dateRange}_${userPart}`
  }

  const getCompareCacheKey = () => {
    const userPart = isAdmin() ? `admin_${selectedUser}` : (user?.vor_nachname || 'user')
    return `dashboard_v2_opening_compare_${compareDateRange}_${userPart}`
  }

  // Prüfen ob Zeiträume identisch sind
  const isIdenticalPeriod = dateRange === compareDateRange

  useEffect(() => {
    loadStats()
  }, [dateRange, selectedUser])

  // Smart Defaults: Bei Änderung des Hauptzeitraums den Vergleichszeitraum anpassen
  useEffect(() => {
    if (compareMode && SMART_COMPARE_DEFAULTS[dateRange]) {
      const suggested = SMART_COMPARE_DEFAULTS[dateRange]
      if (suggested !== compareDateRange && suggested !== dateRange) {
        setCompareDateRange(suggested)
      }
    }
  }, [dateRange])

  // AI-Analyse invalidieren wenn sich Filter ändern
  useEffect(() => {
    if (aiAnalysis) {
      setAiAnalysis(null)
    }
  }, [dateRange, selectedUser, compareMode, compareDateRange])

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

      const { startDate, endDate } = computeDateRange(dateRange)

      const params = new URLSearchParams({
        type: 'opening',
        ...(isAdmin() && selectedUser !== 'all' && { filterUserName: selectedUser }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      })

      const res = await fetch(`/.netlify/functions/analytics?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCache(cacheKey, data)
        setStats(data)
        if (data.perUser && isAdmin() && selectedUser === 'all') {
          setVertriebler(data.perUser)
        }
      } else {
        throw new Error('Fehler beim Laden')
      }
    } catch (err) {
      console.error('Opening Analytics Error:', err)
      setError('Fehler beim Laden der Analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Der Aktualisieren-Knopf steht in der Kopfzeile der Seite. Nach jedem
  // Zeichnen eintragen, damit die Funktion nie auf einen alten Stand zeigt.
  useEffect(() => { meldeAktualisieren?.(() => handleRefresh()) })

  const handleRefresh = () => {
    setRefreshing(true)
    loadStats(true)
    if (compareMode) {
      loadCompareStats(true)
    }
  }

  // Vergleichsdaten laden (mit Caching)
  const loadCompareStats = async (forceRefresh = false) => {
    if (isIdenticalPeriod) {
      setCompareStats(null)
      return
    }

    const cacheKey = getCompareCacheKey()
    const cached = getCache(cacheKey)

    if (cached && !forceRefresh) {
      setCompareStats(cached)
      return
    }

    setCompareLoading(true)
    try {
      const { startDate, endDate } = computeDateRange(compareDateRange)

      const params = new URLSearchParams({
        type: 'opening',
        ...(isAdmin() && selectedUser !== 'all' && { filterUserName: selectedUser }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      })

      const res = await fetch(`/.netlify/functions/analytics?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCache(cacheKey, data)
        setCompareStats(data)
      }
    } catch (err) {
      console.error('Compare Stats Error:', err)
    } finally {
      setCompareLoading(false)
    }
  }

  // Vergleichsmodus: Bei jeder relevanten Änderung neu laden
  useEffect(() => {
    if (compareMode && stats && !isIdenticalPeriod) {
      loadCompareStats()
    } else {
      setCompareStats(null)
    }
  }, [compareMode, compareDateRange, dateRange, selectedUser])

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
            nichtErreicht: stats.summary?.nichtErreicht || 0,
            erreichQuote: stats.summary?.erreichQuote || 0,
            beratungsgespraechQuote: stats.summary?.beratungsgespraechQuote || 0,
            unterlagenQuote: stats.summary?.unterlagenQuote || 0,
            keinInteresseQuote: stats.summary?.keinInteresseQuote || 0
          },
          zeitverlauf: stats.zeitverlauf || [],
          compareStats: compareMode && compareStats ? {
            label: DATE_RANGE_LABELS[compareDateRange] || compareDateRange,
            summary: compareStats.summary || null
          } : null,
          perUser: isAdmin() ? (stats.perUser || []).slice(0, 8).map(u => ({
            name: u.name,
            einwahlen: u.einwahlen,
            erreicht: u.erreicht,
            beratungsgespraech: u.beratungsgespraech,
            keinInteresse: u.keinInteresse
          })) : null,
          dateRange: DATE_RANGE_LABELS[dateRange] || dateRange,
          context: {
            userName: isAdmin()
              ? (selectedUser === 'all' ? 'Team-Übersicht' : selectedUser)
              : user?.vor_nachname,
            isTeam: isAdmin() && selectedUser === 'all',
            teamSize: isAdmin() ? (stats.perUser?.length || 0) : null
          }
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
  // Der Trichter ist eine REIHE: Einwahl → erreicht → Termin → Unterlage.
  // Eine Leiter aus der Hausfarbe zeigt das Gefaelle; vier verschiedene
  // Farbtoene behaupteten vier gleichrangige Kategorien.
  //
  // Die Ergebnisse dagegen SIND Ausgaenge, also duerfen sie Statusfarben
  // tragen - aber nur sie.
  const CHART_COLORS = {
    einwahlen:          REIHE[0],
    erreicht:           REIHE[1],
    beratungsgespraech: STATUS_FARBE.gut,
    unterlagen:         STATUS_FARBE.warnung,
    keinInteresse:      STATUS_FARBE.schlecht,
    nichtErreicht:      STATUS_FARBE.neutral
  }

  // Closing Farben
  // Verloren war Pink - die siebte Farbe im Bild, und ausgerechnet fuer den
  // schlechtesten Ausgang eine Farbe, die nichts davon sagt.
  const CLOSING_COLORS = {
    gewonnen: STATUS_FARBE.gut,
    verloren: STATUS_FARBE.schlecht,
    offen:    STATUS_FARBE.neutral,
    noShow:   STATUS_FARBE.warnung
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar - Glass Style */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-on-surface-variant">
          {isAdmin()
            ? (selectedUser === 'all' ? 'Übersicht aller Vertriebler' : `Performance: ${selectedUser}`)
            : 'Deine Opening-Performance'
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
            aria-label="Zeiträume vergleichen"
            title="Zeiträume vergleichen"
            className={`kopf-knopf kopf-knopf-symbol ${
              compareMode ? 'bg-primary text-white hover:bg-primary' : ''
            }`}
          >
            <GitCompare className="w-4 h-4" />
          </button>

        </div>
      </div>

      {/* Vergleichszeitraum-Auswahl */}
      {compareMode && (
        <div className={`flex flex-wrap items-center gap-3 p-4 rounded-lg border ${
          isIdenticalPeriod
            ? 'bg-warning-container/30 border-warning/30'
            : 'bg-primary-fixed/30 border-primary/20'
        }`}>
          <GitCompare className={`h-5 w-5 ${isIdenticalPeriod ? 'text-warning' : 'text-primary'}`} />
          <span className="text-label-md text-on-surface">Vergleiche mit:</span>
          <select
            value={compareDateRange}
            onChange={(e) => setCompareDateRange(e.target.value)}
            className="select-field w-auto min-w-[160px]"
          >
            {Object.entries(DATE_RANGE_LABELS)
              .filter(([key]) => key !== dateRange)
              .map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))
            }
          </select>
          {compareLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {isIdenticalPeriod && (
            <span className="text-label-sm text-warning font-medium">
              ⚠️ Gleicher Zeitraum gewählt
            </span>
          )}
          {compareStats && !isIdenticalPeriod && (
            <span className="text-label-sm text-outline ml-auto">
              {DATE_RANGE_LABELS[compareDateRange]}: {compareStats.summary?.einwahlen || 0} Einwahlen
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
          {/* Kennzahlen im selben Raster wie im Finanzen-Dashboard: vier je
              Reihe, die wichtigste gefuellt. Vorher lagen fuenf gequetschte
              Kacheln in einer Zeile, mit abgeschnittenen Beschriftungen. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <HeroKennzahl
              label="Einwahlen"
              value={stats.summary?.einwahlen || 0}
              subtitle={DATE_RANGE_LABELS[dateRange]}
              icon={Phone}
              vergleich={compareStats
                ? <Vergleich hell {...(getComparison(stats.summary?.einwahlen || 0, compareStats?.summary?.einwahlen) || {})} />
                : null}
            />
            <Kennzahl
              label="Erreicht" value={stats.summary?.erreicht || 0}
              subtitle={`${formatPercent(stats.summary?.erreichQuote || 0)} der Einwahlen`}
              icon={Users} color="neutral"
              vergleich={<Vergleich {...(getComparison(stats.summary?.erreicht || 0, compareStats?.summary?.erreicht) || {})} />}
            />
            <Kennzahl
              label="Beratungsgespräch" value={stats.summary?.beratungsgespraech || 0}
              subtitle={`${formatPercent(stats.summary?.beratungsgespraechQuote || 0)} der Erreichten`}
              icon={Calendar} color="gut"
              vergleich={<Vergleich {...(getComparison(stats.summary?.beratungsgespraech || 0, compareStats?.summary?.beratungsgespraech) || {})} />}
            />
            <Kennzahl
              label="Unterlage/WV" value={stats.summary?.unterlagen || 0}
              subtitle={`${formatPercent(stats.summary?.unterlagenQuote || 0)} der Erreichten`}
              icon={Target} color="neutral"
              vergleich={<Vergleich {...(getComparison(stats.summary?.unterlagen || 0, compareStats?.summary?.unterlagen) || {})} />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Kennzahl
              label="Kein Interesse" value={stats.summary?.keinInteresse || 0}
              subtitle={`${formatPercent(stats.summary?.keinInteresseQuote || 0)} der Erreichten`}
              icon={XCircle} color="schlecht"
              vergleich={<Vergleich inverted {...(getComparison(stats.summary?.keinInteresse || 0, compareStats?.summary?.keinInteresse, true) || {})} />}
            />
            <Kennzahl
              label="Nicht erreicht" value={stats.summary?.nichtErreicht || 0}
              subtitle={(stats.summary?.ungueltig || 0) > 0
                ? `dazu ${stats.summary.ungueltig} ungültige Nummern`
                : 'niemand am Apparat'}
              icon={PhoneOff} color="neutral"
            />
            <Kennzahl
              label="Erreichquote" value={formatPercent(stats.summary?.erreichQuote || 0)}
              subtitle="Erreichte je Einwahl"
              icon={TrendingUp} color="neutral"
            />
            <Kennzahl
              label="Terminquote" value={formatPercent(stats.summary?.beratungsgespraechQuote || 0)}
              subtitle="Gespräche je Erreichtem"
              icon={Target} color="neutral"
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Funnel */}
            <div className="card p-6">
              <h3 className="text-label-lg font-semibold text-on-surface">Ergebnisse in Zahlen</h3>
              <p className="text-body-sm text-on-surface-variant mt-0.5 mb-4">Von der Einwahl bis zum Termin</p>
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
              <h3 className="text-label-lg font-semibold text-on-surface">Prozentuale Ergebnisse</h3>
              <p className="text-body-sm text-on-surface-variant mt-0.5 mb-4">Anteile der erreichten Kontakte</p>
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
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h3 className="text-label-lg font-semibold text-on-surface flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  KI-Analyse
                </h3>
                <p className="text-body-sm text-on-surface-variant mt-0.5">
                  Auffälligkeiten in den Zahlen dieses Zeitraums
                </p>
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
                    {aiAnalysis ? 'Neu analysieren' : 'Analyse generieren'}
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
                {/* Zusammenfassung - Hero Card */}
                <div className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-primary via-primary to-primary/80">
                  <div className="relative z-10">
                    <p className="text-white/80 text-label-sm mb-1">Zusammenfassung</p>
                    <p className="text-white text-body-lg font-medium leading-relaxed">{aiAnalysis.zusammenfassung}</p>
                  </div>
                  <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                  <div className="absolute -left-4 -top-4 w-20 h-20 rounded-full bg-white/5 blur-xl" />
                </div>

                {/* Insights - Grid Layout */}
                {aiAnalysis.insights?.length > 0 && (
                  <div>
                    <h4 className="text-label-md text-on-surface mb-3 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      Erkenntnisse
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {aiAnalysis.insights.map((insight, idx) => (
                        <div
                          key={idx}
                          className={`rounded-xl p-4 border ${
                            insight.typ === 'positiv'
                              ? 'bg-green-50 border-green-200'
                              : insight.typ === 'negativ'
                              ? 'bg-red-50 border-red-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg flex-shrink-0 ${
                              insight.typ === 'positiv'
                                ? 'bg-green-100'
                                : insight.typ === 'negativ'
                                ? 'bg-red-100'
                                : 'bg-gray-100'
                            }`}>
                              {insight.typ === 'positiv' ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : insight.typ === 'negativ' ? (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              ) : (
                                <Lightbulb className="h-4 w-4 text-gray-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-on-surface text-sm">{insight.titel}</p>
                                {insight.impact && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    insight.impact === 'hoch'
                                      ? 'bg-primary/10 text-primary'
                                      : insight.impact === 'mittel'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {insight.impact}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-on-surface-variant mt-1">{insight.beschreibung}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trend Section */}
                {aiAnalysis.trend && (
                  <div className="border-t border-outline-variant pt-5">
                    <h4 className="text-label-md text-on-surface mb-3 flex items-center gap-2">
                      {aiAnalysis.trend.richtung === 'steigend' ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : aiAnalysis.trend.richtung === 'fallend' ? (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-gray-500" />
                      )}
                      Trend
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        aiAnalysis.trend.richtung === 'steigend'
                          ? 'bg-green-100 text-green-700'
                          : aiAnalysis.trend.richtung === 'fallend'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {aiAnalysis.trend.richtung}
                      </span>
                    </h4>
                    <p className="text-on-surface-variant">{aiAnalysis.trend.beschreibung}</p>
                  </div>
                )}

                {/* Empfehlungen - Cards mit Priorität */}
                {aiAnalysis.empfehlungen?.length > 0 && (
                  <div>
                    <h4 className="text-label-md text-on-surface mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Handlungsempfehlungen
                    </h4>
                    <div className="space-y-3">
                      {aiAnalysis.empfehlungen.map((empfehlung, idx) => {
                        const text = typeof empfehlung === 'string' ? empfehlung : empfehlung.text
                        const prio = typeof empfehlung === 'object' ? empfehlung.prioritaet : null
                        return (
                          <div key={idx} className="flex items-start gap-3 p-4 bg-surface-container rounded-xl">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">{idx + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {prio && (
                                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                    prio === 'hoch'
                                      ? 'bg-red-100 text-red-700'
                                      : prio === 'mittel'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      prio === 'hoch'
                                        ? 'bg-red-500'
                                        : prio === 'mittel'
                                        ? 'bg-yellow-500'
                                        : 'bg-gray-400'
                                    }`} />
                                    {prio}
                                  </span>
                                )}
                              </div>
                              <p className="text-on-surface-variant mt-1">{text}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Aktivität Zeitverlauf */}
          <div className="card p-6">
            <h3 className="text-label-lg font-semibold text-on-surface">Einwahlen im Zeitverlauf</h3>
              <p className="text-body-sm text-on-surface-variant mt-0.5 mb-4">Anrufe je Tag im gewählten Zeitraum</p>
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
              <h3 className="text-label-lg font-semibold text-on-surface">
                {selectedUser === 'all' ? 'Ergebnisse pro Vertriebler (gestapelt)' : `Ergebnisse: ${selectedUser}`}
              </h3>
              <p className="text-body-sm text-on-surface-variant mt-0.5 mb-4">
                Beratungsgespräch, Unterlage und Absage je Person
              </p>
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
              <h3 className="text-label-lg font-semibold text-on-surface">
                {selectedUser === 'all' ? 'Einwahlen & Beratungsgespräche pro Vertriebler' : `Einwahlen & Beratungsgespräche: ${selectedUser}`}
              </h3>
              <p className="text-body-sm text-on-surface-variant mt-0.5 mb-4">
                Aufwand und Ertrag nebeneinander
              </p>
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
                      <Bar dataKey="beratungsgespraech" name="Beratungsgespräch" fill={STATUS_FARBE.gut} radius={[0, 4, 4, 0]} />
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
          <p className="text-on-surface-variant">Es gibt noch keine Opening-Daten für den ausgewählten Zeitraum.</p>
        </div>
      )}
    </div>
  )
}

// ==========================================
// SETTING ANALYTICS
// ==========================================
//
// Die mittlere Stufe: das Beratungsgespräch. Gezählt wird je gelegtem
// Beratungstermin, datiert auf den Termin. Die Frage an diese Seite ist
// nicht "wie viel Umsatz", sondern: Kommen die Leute, und wie viele davon
// gehen weiter ins Abschlussgespräch?

const SETTING_AUSGAENGE = [
  { key: 'uebergeben', name: 'An Closing übergeben', farbe: STATUS_FARBE.gut },
  { key: 'nachfassen', name: 'Wird nachgefasst',     farbe: REIHE[1] },
  { key: 'gefuehrt',   name: 'Geführt, Schritt offen', farbe: REIHE[3] },
  { key: 'verloren',   name: 'Verloren',             farbe: STATUS_FARBE.schlecht },
  { key: 'noShow',     name: 'Nicht erschienen',     farbe: STATUS_FARBE.warnung },
  { key: 'abgesagt',   name: 'Abgesagt',             farbe: STATUS_FARBE.neutral },
  { key: 'ohneAusgang', name: 'Ausgang nicht eingetragen', farbe: '#C9C6D0' },
  { key: 'anstehend',  name: 'Anstehend',            farbe: REIHE[4] }
]

const TOOLTIP_STIL = { backgroundColor: '#FFFFFF', border: 'none', borderRadius: '12px', boxShadow: '0 8px 40px rgba(21, 28, 39, 0.1)' }

function SettingAnalytics({ user, isAdmin, meldeAktualisieren }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [dateRange, setDateRange] = useState('30days')
  const [selectedUser, setSelectedUser] = useState('all')
  const [setterListe, setSetterListe] = useState([])
  const [compareMode, setCompareMode] = useState(false)
  const [compareDateRange, setCompareDateRange] = useState('3months')
  const [compareStats, setCompareStats] = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)

  const isIdenticalPeriod = dateRange === compareDateRange
  const wer = () => (isAdmin() ? `admin_${selectedUser}` : (user?.id || 'user'))

  const laden = async (bereich, forceRefresh) => {
    const cacheKey = `dashboard_v2_setting_${bereich}_${wer()}`
    const cached = getCache(cacheKey)
    if (cached && !forceRefresh) return cached

    const { startDate, endDate } = computeDateRange(bereich)
    const params = new URLSearchParams({
      type: 'setter',
      ...(isAdmin() && selectedUser !== 'all' && { filterUserId: selectedUser }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate })
    })
    const res = await fetch(`/.netlify/functions/analytics?${params}`)
    if (!res.ok) throw new Error('Fehler beim Laden')
    const data = await res.json()
    setCache(cacheKey, data)
    return data
  }

  const loadStats = async (forceRefresh = false) => {
    try {
      setLoading(true)
      setError(null)
      const data = await laden(dateRange, forceRefresh)
      setStats(data)
      if (isAdmin() && selectedUser === 'all') setSetterListe(data.perUser || [])
    } catch (err) {
      console.error('Setting Analytics Error:', err)
      setError('Fehler beim Laden der Analytics')
    } finally {
      setLoading(false)
    }
  }

  const loadCompareStats = async (forceRefresh = false) => {
    if (isIdenticalPeriod) { setCompareStats(null); return }
    setCompareLoading(true)
    try {
      setCompareStats(await laden(compareDateRange, forceRefresh))
    } catch (err) {
      console.error('Compare Stats Error:', err)
    } finally {
      setCompareLoading(false)
    }
  }

  useEffect(() => { loadStats() }, [dateRange, selectedUser])

  useEffect(() => {
    if (compareMode && SMART_COMPARE_DEFAULTS[dateRange]) {
      const suggested = SMART_COMPARE_DEFAULTS[dateRange]
      if (suggested !== compareDateRange && suggested !== dateRange) setCompareDateRange(suggested)
    }
  }, [dateRange])

  useEffect(() => {
    if (compareMode && !isIdenticalPeriod) loadCompareStats()
    else setCompareStats(null)
  }, [compareMode, compareDateRange, dateRange, selectedUser])

  // Der Aktualisieren-Knopf steht in der Kopfzeile der Seite.
  useEffect(() => {
    meldeAktualisieren?.(() => Promise.all([
      loadStats(true),
      compareMode ? loadCompareStats(true) : null
    ]))
  })

  const getComparison = (currentValue, compareValue, inverted = false) => {
    if (!compareMode || compareStats === null || compareValue === undefined) return null
    const diff = currentValue - compareValue
    const percent = compareValue > 0 ? (diff / compareValue) * 100 : (currentValue > 0 ? 100 : 0)
    return { diff, percent, inverted }
  }

  const formatPercent = (value) => `${(value || 0).toFixed(1)}%`
  const z = stats?.summary || {}
  const vergleich = (key, inverted = false) =>
    <Vergleich {...(getComparison(z[key] || 0, compareStats?.summary?.[key], inverted) || {})} inverted={inverted} />

  const verteilung = SETTING_AUSGAENGE
    .map(a => ({ ...a, value: z[a.key] || 0 }))
    .filter(a => a.value > 0)

  const gewaehlterName = setterListe.find(s => s.id === selectedUser)?.name

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-on-surface-variant">
          {isAdmin()
            ? (selectedUser === 'all' ? 'Übersicht aller Setter' : `Performance: ${gewaehlterName || 'Setter'}`)
            : 'Deine Setting-Performance'}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {isAdmin() && setterListe.length > 0 && (
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="select-field w-auto min-w-[160px]"
              aria-label="Setter wählen"
            >
              <option value="all">Alle Setter</option>
              {setterListe.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="select-field w-auto min-w-[140px]"
            aria-label="Zeitraum"
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
              <option value="year">Letztes Jahr</option>
            </optgroup>
            <optgroup label="Gesamt">
              <option value="all">Gesamter Zeitraum</option>
            </optgroup>
          </select>

          <button
            onClick={() => setCompareMode(!compareMode)}
            aria-label="Zeiträume vergleichen"
            title="Zeiträume vergleichen"
            className={`kopf-knopf kopf-knopf-symbol ${compareMode ? 'bg-primary text-white hover:bg-primary' : ''}`}
          >
            <GitCompare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {compareMode && (
        <div className={`flex flex-wrap items-center gap-3 p-4 rounded-lg border ${
          isIdenticalPeriod ? 'bg-warning-container/30 border-warning/30' : 'bg-primary-fixed/30 border-primary/20'
        }`}>
          <GitCompare className={`h-5 w-5 ${isIdenticalPeriod ? 'text-warning' : 'text-primary'}`} />
          <span className="text-label-md text-on-surface">Vergleiche mit:</span>
          <select
            value={compareDateRange}
            onChange={(e) => setCompareDateRange(e.target.value)}
            className="select-field w-auto min-w-[160px]"
          >
            {Object.entries(DATE_RANGE_LABELS)
              .filter(([key]) => key !== dateRange)
              .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          {compareLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {compareStats && !isIdenticalPeriod && (
            <span className="text-label-sm text-outline ml-auto">
              {DATE_RANGE_LABELS[compareDateRange]}: {compareStats.summary?.termine || 0} Beratungstermine
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="bg-error-container text-error px-4 py-3 rounded-lg">{error}</div>
      )}

      {loading && !stats ? (
        <div className="card p-6">
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-on-surface-variant">Analytics werden geladen...</p>
          </div>
        </div>
      ) : stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <HeroKennzahl
              label="Beratungstermine"
              value={z.termine || 0}
              subtitle={DATE_RANGE_LABELS[dateRange]}
              icon={Calendar}
              laedt={loading}
              vergleich={compareStats
                ? <Vergleich hell {...(getComparison(z.termine || 0, compareStats?.summary?.termine) || {})} />
                : null}
            />
            <Kennzahl
              label="Stattgefunden" value={z.stattgefunden || 0}
              subtitle={`Erscheinungsquote ${formatPercent(z.erscheinungsQuote)}`}
              icon={UserCheck} color="neutral" laedt={loading}
              vergleich={vergleich('stattgefunden')}
            />
            <Kennzahl
              label="An Closing übergeben" value={z.uebergeben || 0}
              subtitle={`${formatPercent(z.uebergabeQuote)} der Gespräche`}
              icon={Send} color="gut" laedt={loading}
              vergleich={vergleich('uebergeben')}
            />
            <Kennzahl
              label="Nicht erschienen" value={z.noShow || 0}
              subtitle="Kunde kam nicht"
              icon={CalendarX} color="warnung" laedt={loading}
              vergleich={vergleich('noShow', true)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Kennzahl
              label="Erscheinungsquote" value={formatPercent(z.erscheinungsQuote)}
              subtitle="erschienen je fälligem Termin"
              icon={TrendingUp} color="neutral" laedt={loading}
              vergleich={vergleich('erscheinungsQuote')}
            />
            <Kennzahl
              label="Übergabequote" value={formatPercent(z.uebergabeQuote)}
              subtitle="Abschlusstermin je Gespräch"
              icon={Target} color="neutral" laedt={loading}
              vergleich={vergleich('uebergabeQuote')}
            />
            <Kennzahl
              label="Abgesagt" value={z.abgesagt || 0}
              subtitle="vorher abgesagt"
              icon={XCircle} color="neutral" laedt={loading}
              vergleich={vergleich('abgesagt', true)}
            />
            <Kennzahl
              label="Ausgang fehlt" value={z.ohneAusgang || 0}
              subtitle={`Termin vorbei, nichts eingetragen · ${z.anstehend || 0} anstehend`}
              icon={Hourglass} color={(z.ohneAusgang || 0) > 0 ? 'warnung' : 'neutral'} laedt={loading}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DiagrammKarte title="Beratungstermine im Zeitverlauf" subtitle="Je Termin-Datum: stattgefunden, geplatzt, offen">
              {stats.zeitverlauf?.some(d => (d.count || 0) > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.zeitverlauf}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E1E2EC" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#44474F' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#44474F' }} />
                    <Tooltip contentStyle={TOOLTIP_STIL} cursor={{ fill: 'rgba(70, 14, 116, 0.04)' }} />
                    <Legend />
                    <Bar dataKey="stattgefunden" name="Stattgefunden" stackId="t" fill={REIHE[0]} />
                    <Bar dataKey="geplatzt" name="Geplatzt" stackId="t" fill={STATUS_FARBE.warnung} />
                    <Bar dataKey="offen" name="Offen" stackId="t" fill={REIHE[3]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <LeerZustand icon={Calendar} message="Keine Beratungstermine im Zeitraum" hoehe="h-[250px]" />
              )}
            </DiagrammKarte>

            <DiagrammKarte title="Wie die Gespräche ausgingen" subtitle="Jeder Beratungstermin genau einmal">
              {verteilung.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={verteilung} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {verteilung.map(a => <Cell key={a.key} fill={a.farbe} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STIL} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <LeerZustand icon={Target} message="Keine Beratungstermine im Zeitraum" hoehe="h-[250px]" />
              )}
            </DiagrammKarte>
          </div>

          {isAdmin() && selectedUser === 'all' && (
            <DiagrammKarte title="Performance pro Setter" subtitle="Termine je Person nach Ausgang">
              {stats.perUser?.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(200, Math.min(stats.perUser.length, 10) * 50)}>
                    <BarChart data={stats.perUser.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E1E2EC" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: '#44474F' }} />
                      <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12, fill: '#44474F' }} />
                      <Tooltip contentStyle={TOOLTIP_STIL} cursor={{ fill: 'rgba(70, 14, 116, 0.04)' }} />
                      <Legend />
                      <Bar dataKey="uebergeben" name="Übergeben" stackId="p" fill={STATUS_FARBE.gut} />
                      <Bar dataKey="nachfassen" name="Nachfassen" stackId="p" fill={REIHE[1]} />
                      <Bar dataKey="gefuehrt" name="Schritt offen" stackId="p" fill={REIHE[3]} />
                      <Bar dataKey="verloren" name="Verloren" stackId="p" fill={STATUS_FARBE.schlecht} />
                      <Bar dataKey="noShow" name="Nicht erschienen" stackId="p" fill={STATUS_FARBE.warnung} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-body-sm">
                      <thead>
                        <tr className="text-left text-label-sm uppercase tracking-wide text-on-surface-variant border-b border-outline-variant/50">
                          <th className="py-2 pr-4 font-medium">Setter</th>
                          <th className="py-2 px-2 font-medium text-right">Termine</th>
                          <th className="py-2 px-2 font-medium text-right">Stattgefunden</th>
                          <th className="py-2 px-2 font-medium text-right">Übergeben</th>
                          <th className="py-2 px-2 font-medium text-right">No-Show</th>
                          <th className="py-2 px-2 font-medium text-right">Erscheinung</th>
                          <th className="py-2 pl-2 font-medium text-right">Übergabe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.perUser.map(p => (
                          <tr key={p.id} className="border-b border-outline-variant/30 last:border-0">
                            <td className="py-2 pr-4 text-on-surface">{p.name}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{p.termine}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{p.stattgefunden}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{p.uebergeben}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{p.noShow}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{formatPercent(p.erscheinungsQuote)}</td>
                            <td className="py-2 pl-2 text-right tabular-nums">{formatPercent(p.uebergabeQuote)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <LeerZustand icon={Users} message="Keine Setter-Daten im Zeitraum" hoehe="h-[150px]" />
              )}
            </DiagrammKarte>
          )}
        </>
      )}
    </div>
  )
}

// ==========================================
// CLOSING ANALYTICS
// ==========================================
function ClosingAnalytics({ user, isAdmin, meldeAktualisieren }) {
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

  // Cache Keys
  const getCacheKey = () => {
    const userPart = isAdmin() ? 'admin' : (user?.email_geschaeftlich || user?.email || 'user')
    return `dashboard_v2_closing_${dateRange}_${userPart}`
  }

  const getCompareCacheKey = () => {
    const userPart = isAdmin() ? 'admin' : (user?.email_geschaeftlich || user?.email || 'user')
    return `dashboard_v2_closing_compare_${compareDateRange}_${userPart}`
  }

  // Prüfen ob Zeiträume identisch sind
  const isIdenticalPeriod = dateRange === compareDateRange

  useEffect(() => {
    loadStats()
  }, [dateRange])

  // Smart Defaults: Bei Änderung des Hauptzeitraums den Vergleichszeitraum anpassen
  useEffect(() => {
    if (compareMode && SMART_COMPARE_DEFAULTS[dateRange]) {
      const suggested = SMART_COMPARE_DEFAULTS[dateRange]
      if (suggested !== compareDateRange && suggested !== dateRange) {
        setCompareDateRange(suggested)
      }
    }
  }, [dateRange])

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

      const { startDate, endDate } = computeDateRange(dateRange)

      const params = new URLSearchParams({
        type: 'closing',
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

  // Der Aktualisieren-Knopf steht in der Kopfzeile der Seite. Nach jedem
  // Zeichnen eintragen, damit die Funktion nie auf einen alten Stand zeigt.
  useEffect(() => { meldeAktualisieren?.(() => handleRefresh()) })

  const handleRefresh = () => {
    setRefreshing(true)
    loadStats(true)
    if (compareMode) {
      loadCompareStats(true)
    }
  }

  // Vergleichsdaten laden (mit Caching)
  const loadCompareStats = async (forceRefresh = false) => {
    if (isIdenticalPeriod) {
      setCompareStats(null)
      return
    }

    const cacheKey = getCompareCacheKey()
    const cached = getCache(cacheKey)

    if (cached && !forceRefresh) {
      setCompareStats(cached)
      return
    }

    setCompareLoading(true)
    try {
      const { startDate, endDate } = computeDateRange(compareDateRange)

      const params = new URLSearchParams({
        type: 'closing',
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      })

      const res = await fetch(`/.netlify/functions/analytics?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCache(cacheKey, data)
        setCompareStats(data)
      }
    } catch (err) {
      console.error('Compare Stats Error:', err)
    } finally {
      setCompareLoading(false)
    }
  }

  // Vergleichsmodus: Bei jeder relevanten Änderung neu laden
  useEffect(() => {
    if (compareMode && stats && !isIdenticalPeriod) {
      loadCompareStats()
    } else {
      setCompareStats(null)
    }
  }, [compareMode, compareDateRange, dateRange])

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
    'Gewonnen': STATUS_FARBE.gut,
    'Verloren': STATUS_FARBE.schlecht,
    'No-Show':  STATUS_FARBE.warnung,
    'Offen':    STATUS_FARBE.neutral
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
            aria-label="Zeiträume vergleichen"
            title="Zeiträume vergleichen"
            className={`kopf-knopf kopf-knopf-symbol ${
              compareMode ? 'bg-primary text-white hover:bg-primary' : ''
            }`}
          >
            <GitCompare className="w-4 h-4" />
          </button>

        </div>
      </div>

      {/* Vergleichszeitraum-Auswahl */}
      {compareMode && (
        <div className={`flex flex-wrap items-center gap-3 p-4 rounded-lg border ${
          isIdenticalPeriod
            ? 'bg-warning-container/30 border-warning/30'
            : 'bg-primary-fixed/30 border-primary/20'
        }`}>
          <GitCompare className={`h-5 w-5 ${isIdenticalPeriod ? 'text-warning' : 'text-primary'}`} />
          <span className="text-label-md text-on-surface">Vergleiche mit:</span>
          <select
            value={compareDateRange}
            onChange={(e) => setCompareDateRange(e.target.value)}
            className="select-field w-auto min-w-[160px]"
          >
            {Object.entries(DATE_RANGE_LABELS)
              .filter(([key]) => key !== dateRange)
              .map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))
            }
          </select>
          {compareLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {isIdenticalPeriod && (
            <span className="text-label-sm text-warning font-medium">
              ⚠️ Gleicher Zeitraum gewählt
            </span>
          )}
          {compareStats && !isIdenticalPeriod && (
            <span className="text-label-sm text-outline ml-auto">
              {DATE_RANGE_LABELS[compareDateRange]}: {formatCurrency(compareStats.summary?.umsatzGesamt || 0)} Umsatz
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
          {/* Vier je Reihe wie im Finanzen-Dashboard. Sieben Kacheln in einer
              Zeile liessen aus "Umsatz Gesamt" ein "Umsatz Ges…" werden. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <HeroKennzahl
              label="Umsatz gesamt"
              value={formatCurrency(stats.summary?.umsatzGesamt || 0)}
              subtitle={DATE_RANGE_LABELS[dateRange]}
              icon={DollarSign}
              vergleich={compareStats
                ? <Vergleich hell {...(getComparison(stats.summary?.umsatzGesamt || 0, compareStats?.summary?.umsatzGesamt) || {})} />
                : null}
            />
            <Kennzahl
              label="Closing-Quote" value={formatPercent(stats.summary?.closingQuote || 0)}
              subtitle={`${stats.summary?.gewonnen || 0} von ${(stats.summary?.gewonnen || 0) + (stats.summary?.verloren || 0)} entschieden`}
              icon={TrendingUp} color="neutral"
              vergleich={<Vergleich {...(getComparison(stats.summary?.closingQuote || 0, compareStats?.summary?.closingQuote) || {})} />}
            />
            <Kennzahl
              label="Ø Umsatz" value={formatCurrency(stats.summary?.umsatzDurchschnitt || 0)}
              subtitle="je Abschluss"
              icon={BarChart3} color="neutral"
              vergleich={<Vergleich {...(getComparison(stats.summary?.umsatzDurchschnitt || 0, compareStats?.summary?.umsatzDurchschnitt) || {})} />}
            />
            <Kennzahl
              label="Gewonnen" value={stats.summary?.gewonnen || 0}
              subtitle="Abschlüsse im Zeitraum"
              icon={Award} color="gut"
              vergleich={<Vergleich {...(getComparison(stats.summary?.gewonnen || 0, compareStats?.summary?.gewonnen) || {})} />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Kennzahl
              label="Verloren" value={stats.summary?.verloren || 0}
              subtitle="endgültig abgesagt"
              icon={XCircle} color="schlecht"
              vergleich={<Vergleich inverted {...(getComparison(stats.summary?.verloren || 0, compareStats?.summary?.verloren, true) || {})} />}
            />
            <Kennzahl
              label="No-Show" value={stats.summary?.noShow || 0}
              subtitle="nicht erschienen"
              icon={Clock} color="warnung"
              vergleich={<Vergleich inverted {...(getComparison(stats.summary?.noShow || 0, compareStats?.summary?.noShow, true) || {})} />}
            />
            <Kennzahl
              label="Offen" value={stats.summary?.offen || 0}
              subtitle="noch in Arbeit"
              icon={Target} color="neutral"
              vergleich={<Vergleich {...(getComparison(stats.summary?.offen || 0, compareStats?.summary?.offen) || {})} />}
            />
            <Kennzahl
              label="Entschieden" value={(stats.summary?.gewonnen || 0) + (stats.summary?.verloren || 0)}
              subtitle="gewonnen oder verloren"
              icon={CheckCircle} color="neutral"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Umsatz Zeitverlauf */}
            <div className="card p-6">
              <h3 className="text-label-lg font-semibold text-on-surface">Umsatz & Closings im Zeitverlauf</h3>
              <p className="text-body-sm text-on-surface-variant mt-0.5 mb-4">Abschlüsse und Umsatz je Tag</p>
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
                    <Bar yAxisId="right" dataKey="count" name="Abschlüsse" fill={STATUS_FARBE.gut} radius={[8, 8, 0, 0]} />
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
              <h3 className="text-label-lg font-semibold text-on-surface">Status Verteilung</h3>
              <p className="text-body-sm text-on-surface-variant mt-0.5 mb-4">Alle Kontakte im Closing nach Stand</p>
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

          {/* Aktuelle Leads pro Closer (Admin only) */}
          {isAdmin() && stats.leadsProCloser && stats.leadsProCloser.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Balkendiagramm - Alle Leads mit Status */}
              <div className="card p-6">
                <h3 className="text-label-lg font-semibold text-on-surface">Alle Leads pro Closer</h3>
                <p className="text-body-sm text-on-surface-variant mt-0.5 mb-4">Komplette Verteilung nach Status</p>
                <ResponsiveContainer width="100%" height={Math.max(250, stats.leadsProCloser.length * 50)}>
                  <BarChart data={stats.leadsProCloser} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E1E2EC" />
                    <XAxis type="number" tick={{ fill: '#44474F' }} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: '#44474F' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FFFFFF', border: 'none', borderRadius: '12px', boxShadow: '0 8px 40px rgba(21, 28, 39, 0.1)' }}
                      formatter={(value, name) => {
                        const labels = {
                          aktiv: 'Aktiv (offen)',
                          abgeschlossen: 'Abgeschlossen',
                          verloren: 'Verloren'
                        }
                        return [value, labels[name] || name]
                      }}
                    />
                    <Legend />
                    <Bar dataKey="aktiv" name="Aktiv" fill="#460E74" stackId="a" />
                    <Bar dataKey="abgeschlossen" name="Abgeschlossen" fill={STATUS_FARBE.gut} stackId="a" />
                    <Bar dataKey="verloren" name="Verloren" fill={STATUS_FARBE.schlecht} stackId="a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Kuchendiagramm - Prozentuale Verteilung ALLER Leads */}
              <div className="card p-6">
                <h3 className="text-label-lg font-semibold text-on-surface">Verteilung aller Leads</h3>
                <p className="text-body-sm text-on-surface-variant mt-0.5 mb-4">
                  Alle {stats.leadsProCloser.reduce((sum, c) => sum + c.gesamt, 0)} Hot Leads im System
                </p>
                {(() => {
                  // Die Leiter hat fuenf Sprossen. Wer darunter liegt, wuerde
                  // sonst als eine von sieben gleich grauen Scheiben stehen -
                  // ununterscheidbar. Zusammengefasst sagt der Kuchen mehr.
                  const sortiert = stats.leadsProCloser
                    .filter(c => c.gesamt > 0)
                    .sort((a, b) => b.gesamt - a.gesamt)
                  const vorne = sortiert.slice(0, REIHE.length)
                  const rest = sortiert.slice(REIHE.length)
                  const restSumme = rest.reduce((n, c) => n + c.gesamt, 0)
                  const kuchen = restSumme > 0
                    ? [...vorne, { name: `${rest.length} weitere`, gesamt: restSumme }]
                    : vorne
                  return (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={kuchen}
                      dataKey="gesamt"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={100}
                      paddingAngle={2}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ stroke: '#44474F', strokeWidth: 1 }}
                    >
                      {/* Zehn frei erfundene Farbtoene behaupteten zehn
                          verschiedene Bedeutungen. Personen unterscheiden sich
                          aber nur in der Menge - also die Leiter aus der
                          Hausfarbe, und wer darunter liegt, wird grau. */}
                      {kuchen.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index < REIHE.length ? REIHE[index] : STATUS_FARBE.neutral}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FFFFFF', border: 'none', borderRadius: '12px', boxShadow: '0 8px 40px rgba(21, 28, 39, 0.1)' }}
                      formatter={(value, name, props) => {
                        const total = stats.leadsProCloser.reduce((sum, c) => sum + c.gesamt, 0)
                        const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0
                        return [`${value} Leads (${percent}%)`, props.payload.name]
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Per Closer Stats (Admin only) */}
          {isAdmin() && (
            <div className="card p-6">
              <h3 className="text-label-lg font-semibold text-on-surface">Performance pro Closer</h3>
              <p className="text-body-sm text-on-surface-variant mt-0.5 mb-4">Offen, gewonnen und verloren je Person</p>
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
                    <Bar dataKey="offen" name="Offen" fill={STATUS_FARBE.neutral} stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="gewonnen" name="Gewonnen" fill={STATUS_FARBE.gut} stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="verloren" name="Verloren" fill={STATUS_FARBE.schlecht} stackId="a" radius={[0, 4, 4, 0]} />
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

export default Dashboard
