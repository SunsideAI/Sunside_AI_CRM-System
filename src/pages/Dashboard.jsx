import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { 
  BarChart3, TrendingUp, TrendingDown, Users, Phone, 
  Target, DollarSign, Calendar, Award, XCircle, Clock,
  ChevronDown, RefreshCw
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts'

export default function Dashboard() {
  const { user, hasRole } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [closingStats, setClosingStats] = useState(null)
  const [settingStats, setSettingStats] = useState(null)
  const [dateRange, setDateRange] = useState('3months') // 1month, 3months, 6months, year, all
  const [refreshing, setRefreshing] = useState(false)

  const isAdmin = hasRole('Admin')
  const isCloser = hasRole('Closer')
  const isSetter = hasRole('Setter')

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
      if (isCloser || isAdmin) {
        const closingParams = new URLSearchParams({
          type: 'closing',
          admin: isAdmin.toString(),
          ...(userEmail && !isAdmin && { email: userEmail }),
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
      if (isSetter || isAdmin) {
        const settingParams = new URLSearchParams({
          type: 'setting',
          admin: isAdmin.toString(),
          ...(userEmail && !isAdmin && { email: userEmail }),
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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {isAdmin ? 'Übersicht aller Vertriebsaktivitäten' : 
             isCloser && isSetter ? 'Deine Setting & Closing Performance' :
             isCloser ? 'Deine Closing Performance' : 'Deine Setting Performance'}
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
      {(isCloser || isAdmin) && closingStats && (
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
          {isAdmin && closingStats.perUser && closingStats.perUser.length > 0 && (
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
      {(isSetter || isAdmin) && settingStats && (
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

// KPI Card Component
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
