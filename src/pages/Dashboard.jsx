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
  LayoutDashboard,
  Filter
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
  
  const isSetter = () => hasRole('Setter')
  const isCloser = () => hasRole('Closer')
  const isAdmin = () => hasRole('Admin')

  const showKaltakquiseTab = isSetter() || isAdmin()
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
        <UebersichtContent user={user} isSetter={isSetter} isCloser={isCloser} isAdmin={isAdmin} />
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
function UebersichtContent({ user, isSetter, isCloser, isAdmin }) {
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [data, setData] = useState({
    zugewiesenLeads: 0,
    callsHeute: 0,
    termineWoche: 0,
    abschluesseMonat: 0
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async (forceRefresh = false) => {
    const cacheKey = 'dashboard_uebersicht'
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
      params.append('userRole', isAdmin() ? 'Admin' : isSetter() ? 'Setter' : 'Closer')

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
    const userStats = result.vertriebler?.find(v => v.name === user?.vor_nachname)
    
    setData({
      zugewiesenLeads: userStats?.gesamt || 0,
      callsHeute: result.heute || 0,
      termineWoche: result.termineWoche || 0,
      abschluesseMonat: 0
    })
  }

  const stats = [
    {
      name: 'Zugewiesene Leads',
      value: initialLoading ? '...' : data.zugewiesenLeads.toLocaleString('de-DE'),
      icon: Users,
      color: 'bg-blue-500',
      show: isSetter() || isAdmin()
    },
    {
      name: 'Calls heute',
      value: initialLoading ? '...' : data.callsHeute.toLocaleString('de-DE'),
      icon: Phone,
      color: 'bg-green-500',
      show: isSetter() || isAdmin()
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
      show: isSetter() || isAdmin()
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

  // Cache Key
  const getCacheKey = () => {
    const userPart = isAdmin() ? `admin_${selectedUser}` : (user?.vor_nachname || 'user')
    return `dashboard_kaltakquise_${dateRange}_${userPart}`
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
            <KPICard title="Einwahlen" value={stats.summary.einwahlen} icon={Phone} color="purple" />
            <KPICard title="Erreicht" value={stats.summary.erreicht} icon={Users} color="blue" subtitle={formatPercent(stats.summary.erreichQuote)} />
            <KPICard title="Beratung" value={stats.summary.beratungsgespraech} icon={Calendar} color="green" subtitle={formatPercent(stats.summary.beratungsgespraechQuote)} />
            <KPICard title="Unterlagen" value={stats.summary.unterlagen} icon={Target} color="yellow" subtitle={formatPercent(stats.summary.unterlagenQuote)} />
            <KPICard title="Kein Interesse" value={stats.summary.keinInteresse} icon={XCircle} color="red" subtitle={formatPercent(stats.summary.keinInteresseQuote || 0)} />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Funnel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Ergebnisse in Zahlen</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart 
                  data={[
                    { name: 'Einwahlen', value: stats.summary.einwahlen },
                    { name: 'Erreicht', value: stats.summary.erreicht },
                    { name: 'Beratung', value: stats.summary.beratungsgespraech },
                    { name: 'Unterlagen', value: stats.summary.unterlagen }
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
            </div>

            {/* Ergebnis Verteilung Pie */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Prozentuale Ergebnisse</h3>
              {(stats.summary.beratungsgespraech + stats.summary.unterlagen + stats.summary.keinInteresse) > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Beratung', value: stats.summary.beratungsgespraech },
                        { name: 'Unterlagen', value: stats.summary.unterlagen },
                        { name: 'Kein Interesse', value: stats.summary.keinInteresse }
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
          </div>

          {/* Gestapeltes Balkendiagramm - Performance pro Vertriebler (Admin only) */}
          {isAdmin() && stats.perUser && stats.perUser.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
                {selectedUser === 'all' ? 'Ergebnisse pro Vertriebler (gestapelt)' : `Ergebnisse: ${selectedUser}`}
              </h3>
              {(() => {
                const chartData = selectedUser === 'all' 
                  ? stats.perUser.slice(0, 20)
                  : stats.perUser.filter(u => u.name === selectedUser)
                
                return chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={selectedUser === 'all' ? Math.max(400, stats.perUser.length * 50) : 120}>
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
                            beratungsgespraech: 'Beratung',
                            unterlagen: 'Unterlagen',
                            keinInteresse: 'Kein Interesse'
                          }
                          return [value, labels[name] || name]
                        }}
                      />
                      <Legend 
                        formatter={(value) => {
                          const labels = {
                            beratungsgespraech: 'Beratung',
                            unterlagen: 'Unterlagen',
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
                  <div className="flex items-center justify-center h-[120px] text-gray-400">
                    <p className="text-sm">Keine Daten für diesen Vertriebler</p>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Einwahlen pro Vertriebler (Admin only) */}
          {isAdmin() && stats.perUser && stats.perUser.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
                {selectedUser === 'all' ? 'Einwahlen & Beratungen pro Vertriebler' : `Einwahlen & Beratungen: ${selectedUser}`}
              </h3>
              {(() => {
                const chartData = selectedUser === 'all' 
                  ? stats.perUser.slice(0, 15)
                  : stats.perUser.filter(u => u.name === selectedUser)
                
                return chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={selectedUser === 'all' ? Math.max(300, stats.perUser.length * 40) : 100}>
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="einwahlen" name="Einwahlen" fill="#7C3AED" />
                      <Bar dataKey="beratungsgespraech" name="Beratung" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[100px] text-gray-400">
                    <p className="text-sm">Keine Daten für diesen Vertriebler</p>
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

      const params = new URLSearchParams({
        type: 'closing',
        admin: isAdmin().toString(),
        ...(userEmail && !isAdmin() && { email: userEmail }),
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
            <KPICard title="Closing Quote" value={formatPercent(stats.summary.closingQuote)} icon={TrendingUp} color="purple" subtitle={`${stats.summary.gewonnen} von ${stats.summary.gewonnen + stats.summary.verloren}`} />
            <KPICard title="Umsatz Gesamt" value={formatCurrency(stats.summary.umsatzGesamt)} icon={DollarSign} color="green" />
            <KPICard title="Ø Umsatz" value={formatCurrency(stats.summary.umsatzDurchschnitt)} icon={BarChart3} color="blue" />
            <KPICard title="Gewonnen" value={stats.summary.gewonnen} icon={Award} color="green" />
            <KPICard title="Verloren" value={stats.summary.verloren} icon={XCircle} color="red" />
            <KPICard title="No-Show" value={stats.summary.noShow} icon={Clock} color="yellow" />
            <KPICard title="Offen" value={stats.summary.offen} icon={Target} color="gray" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Umsatz Zeitverlauf */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Umsatz & Closings im Zeitverlauf</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.zeitverlauf}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value, name) => [name === 'umsatz' ? formatCurrency(value) : value, name === 'umsatz' ? 'Umsatz' : 'Closings']} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="umsatz" name="Umsatz" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="count" name="Closings" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Status Verteilung */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Status Verteilung</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Gewonnen', value: stats.summary.gewonnen },
                      { name: 'Verloren', value: stats.summary.verloren },
                      { name: 'Offen', value: stats.summary.offen },
                      { name: 'No-Show', value: stats.summary.noShow }
                    ].filter(d => d.value > 0)}
                    cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {COLORS.map((color, index) => (<Cell key={`cell-${index}`} fill={color} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per Closer Stats (Admin only) */}
          {isAdmin() && stats.perUser && stats.perUser.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Performance pro Closer</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.perUser.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value, name) => [name === 'umsatz' ? formatCurrency(value) : value, name === 'umsatz' ? 'Umsatz' : name === 'gewonnen' ? 'Gewonnen' : 'Verloren']} />
                  <Legend />
                  <Bar dataKey="gewonnen" name="Gewonnen" fill="#10B981" stackId="a" />
                  <Bar dataKey="verloren" name="Verloren" fill="#EF4444" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
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
