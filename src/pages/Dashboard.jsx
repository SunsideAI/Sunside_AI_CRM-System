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
  PieChart as PieChartIcon
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts'

// Cache im localStorage
const CACHE_KEY = 'dashboard_cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5 Minuten

function getCache() {
  try {
    const stored = localStorage.getItem(CACHE_KEY)
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

function setCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
  } catch (e) {
    console.error('Cache write error:', e)
  }
}

function Dashboard() {
  const { user, hasRole } = useAuth()
  const [activeTab, setActiveTab] = useState('uebersicht')
  
  // Legacy helper functions for old dashboard code
  const isSetter = () => hasRole('Setter')
  const isCloser = () => hasRole('Closer')
  const isAdmin = () => hasRole('Admin')

  const tabs = [
    { id: 'uebersicht', name: 'Übersicht', icon: LayoutDashboard },
    { id: 'analytics', name: 'Analytics', icon: PieChartIcon }
  ]

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'uebersicht' && (
        <UebersichtTab user={user} isSetter={isSetter} isCloser={isCloser} isAdmin={isAdmin} />
      )}
      {activeTab === 'analytics' && (
        <AnalyticsTab user={user} hasRole={hasRole} isAdmin={isAdmin} isCloser={isCloser} isSetter={isSetter} />
      )}
    </div>
  )
}

// ==========================================
// ÜBERSICHT TAB (Altes Dashboard)
// ==========================================
function UebersichtTab({ user, isSetter, isCloser, isAdmin }) {
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
    const cached = getCache()
    
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
        setCache(result)
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
          <h1 className="text-2xl font-bold text-gray-900">
            Hallo, {user?.vorname || 'User'}! 👋
          </h1>
          <p className="mt-1 text-gray-500">
            Hier ist dein Überblick für heute.
          </p>
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
// ANALYTICS TAB (Neues Dashboard)
// ==========================================
function AnalyticsTab({ user, hasRole, isAdmin, isCloser, isSetter }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [closingStats, setClosingStats] = useState(null)
  const [settingStats, setSettingStats] = useState(null)
  const [dateRange, setDateRange] = useState('3months')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadAnalytics()
  }, [dateRange])

  const getDateRange = () => {
    const now = new Date()
    let startDate = null

    switch (dateRange) {
      case '1month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        break
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        break
      case '6months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
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

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      const { startDate, endDate } = getDateRange()
      const userEmail = user?.email_geschaeftlich || user?.email

      // Closing Stats laden (für Closer und Admins)
      if (isCloser() || isAdmin()) {
        const closingParams = new URLSearchParams({
          type: 'closing',
          admin: isAdmin().toString(),
          ...(userEmail && !isAdmin() && { email: userEmail }),
          ...(startDate && { startDate }),
          ...(endDate && { endDate })
        })

        const closingRes = await fetch(`/.netlify/functions/analytics?${closingParams}`)
        if (closingRes.ok) {
          const data = await closingRes.json()
          setClosingStats(data)
        }
      }

      // Setting Stats laden (für Setter und Admins)
      if (isSetter() || isAdmin()) {
        const settingParams = new URLSearchParams({
          type: 'setting',
          admin: isAdmin().toString(),
          ...(userEmail && !isAdmin() && { email: userEmail }),
          ...(startDate && { startDate }),
          ...(endDate && { endDate })
        })

        const settingRes = await fetch(`/.netlify/functions/analytics?${settingParams}`)
        if (settingRes.ok) {
          const data = await settingRes.json()
          setSettingStats(data)
        }
      }

    } catch (err) {
      console.error('Analytics Error:', err)
      setError('Fehler beim Laden der Analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    loadAnalytics()
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPercent = (value) => {
    return `${value.toFixed(1)}%`
  }

  const COLORS = ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#EC4899']

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">
            {isAdmin() ? 'Übersicht aller Vertriebsaktivitäten' : 
             isCloser() && isSetter() ? 'Deine Setting & Closing Performance' :
             isCloser() ? 'Deine Closing Performance' : 'Deine Setting Performance'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Zeitraum Filter */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="1month">Letzter Monat</option>
              <option value="3months">Letzte 3 Monate</option>
              <option value="6months">Letzte 6 Monate</option>
              <option value="year">Letztes Jahr</option>
              <option value="all">Gesamt</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Refresh Button */}
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

      {/* Closing Section */}
      {(isCloser() || isAdmin()) && closingStats && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600" />
            Closing Performance
          </h2>

          {/* Closing KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <KPICard
              title="Closing Quote"
              value={formatPercent(closingStats.summary.closingQuote)}
              icon={TrendingUp}
              color="purple"
              subtitle={`${closingStats.summary.gewonnen} von ${closingStats.summary.gewonnen + closingStats.summary.verloren}`}
            />
            <KPICard
              title="Umsatz Gesamt"
              value={formatCurrency(closingStats.summary.umsatzGesamt)}
              icon={DollarSign}
              color="green"
            />
            <KPICard
              title="Ø Umsatz"
              value={formatCurrency(closingStats.summary.umsatzDurchschnitt)}
              icon={BarChart3}
              color="blue"
            />
            <KPICard
              title="Gewonnen"
              value={closingStats.summary.gewonnen}
              icon={Award}
              color="green"
            />
            <KPICard
              title="Verloren"
              value={closingStats.summary.verloren}
              icon={XCircle}
              color="red"
            />
            <KPICard
              title="No-Show"
              value={closingStats.summary.noShow}
              icon={Clock}
              color="yellow"
            />
            <KPICard
              title="Offen"
              value={closingStats.summary.offen}
              icon={Target}
              color="gray"
            />
          </div>

          {/* Closing Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Umsatz Zeitverlauf */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Umsatz & Closings im Zeitverlauf</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={closingStats.zeitverlauf}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'umsatz' ? formatCurrency(value) : value,
                      name === 'umsatz' ? 'Umsatz' : 'Closings'
                    ]}
                  />
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
                      { name: 'Gewonnen', value: closingStats.summary.gewonnen },
                      { name: 'Verloren', value: closingStats.summary.verloren },
                      { name: 'Offen', value: closingStats.summary.offen },
                      { name: 'No-Show', value: closingStats.summary.noShow }
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per Closer Stats (Admin only) */}
          {isAdmin() && closingStats.perUser && closingStats.perUser.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Performance pro Closer</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={closingStats.perUser.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'umsatz' ? formatCurrency(value) : value,
                      name === 'umsatz' ? 'Umsatz' : name === 'gewonnen' ? 'Gewonnen' : 'Verloren'
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="gewonnen" name="Gewonnen" fill="#10B981" stackId="a" />
                  <Bar dataKey="verloren" name="Verloren" fill="#EF4444" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Setting Section */}
      {(isSetter() || isAdmin()) && settingStats && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Phone className="h-5 w-5 text-blue-600" />
            Setting Performance (Kaltakquise)
          </h2>

          {/* Setting KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPICard
              title="Einwahlen"
              value={settingStats.summary.einwahlen}
              icon={Phone}
              color="purple"
            />
            <KPICard
              title="Erreicht"
              value={settingStats.summary.erreicht}
              icon={Users}
              color="blue"
              subtitle={formatPercent(settingStats.summary.erreichQuote)}
            />
            <KPICard
              title="Erstgespräche"
              value={settingStats.summary.erstgespraech}
              icon={Calendar}
              color="green"
              subtitle={formatPercent(settingStats.summary.erstgespraechQuote)}
            />
            <KPICard
              title="Unterlagen"
              value={settingStats.summary.unterlagen}
              icon={Target}
              color="yellow"
              subtitle={formatPercent(settingStats.summary.unterlagenQuote)}
            />
            <KPICard
              title="Kein Interesse"
              value={settingStats.summary.keinInteresse}
              icon={XCircle}
              color="red"
            />
            <KPICard
              title="Nicht erreicht"
              value={settingStats.summary.nichtErreicht}
              icon={TrendingDown}
              color="gray"
            />
          </div>

          {/* Setting Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Funnel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Conversion Funnel</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart 
                  data={[
                    { name: 'Einwahlen', value: settingStats.summary.einwahlen, fill: '#7C3AED' },
                    { name: 'Erreicht', value: settingStats.summary.erreicht, fill: '#6366F1' },
                    { name: 'Erstgespräch', value: settingStats.summary.erstgespraech, fill: '#10B981' },
                    { name: 'Unterlagen', value: settingStats.summary.unterlagen, fill: '#F59E0B' }
                  ]}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {[
                      { fill: '#7C3AED' },
                      { fill: '#6366F1' },
                      { fill: '#10B981' },
                      { fill: '#F59E0B' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Aktivität Zeitverlauf */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Aktivität im Zeitverlauf</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={settingStats.zeitverlauf}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    name="Kontakte" 
                    stroke="#7C3AED" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!closingStats && !settingStats && !loading && (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Daten verfügbar</h3>
          <p className="text-gray-500">Es gibt noch keine Analytics-Daten für den ausgewählten Zeitraum.</p>
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
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
