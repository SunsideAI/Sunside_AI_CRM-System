import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDashboardCache } from '../context/DashboardCacheContext'
import { 
  Phone, 
  Calendar, 
  TrendingUp, 
  Users,
  ArrowRight,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { Link } from 'react-router-dom'

function Dashboard() {
  const { user, isSetter, isCloser, isAdmin } = useAuth()
  const { cache, loading, fetchDashboardData, refreshInBackground, isCacheValid } = useDashboardCache()
  const [data, setData] = useState({
    zugewiesenLeads: 0,
    callsHeute: 0,
    termineWoche: 0,
    abschluesseMonat: 0
  })
  const [initialLoading, setInitialLoading] = useState(!cache)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const userName = user?.vor_nachname || ''
    const userRole = isAdmin() ? 'Admin' : isSetter() ? 'Setter' : 'Closer'

    // Wenn Cache vorhanden, sofort anzeigen
    if (cache) {
      updateDataFromResult(cache)
      setInitialLoading(false)
      
      // Im Hintergrund aktualisieren wenn Cache älter als 1 Minute
      if (!isCacheValid) {
        refreshInBackground(userName, userRole)
      }
    } else {
      // Kein Cache - normal laden
      setInitialLoading(true)
      const result = await fetchDashboardData(userName, userRole)
      if (result) {
        updateDataFromResult(result)
      }
      setInitialLoading(false)
    }
  }

  // Cache-Updates beobachten
  useEffect(() => {
    if (cache) {
      updateDataFromResult(cache)
    }
  }, [cache])

  const updateDataFromResult = (result) => {
    const userStats = result.vertriebler?.find(v => v.name === user?.vor_nachname)
    
    setData({
      zugewiesenLeads: userStats?.gesamt || 0,
      callsHeute: result.heute || 0,
      termineWoche: result.termineWoche || 0,
      abschluesseMonat: 0
    })
  }

  const handleManualRefresh = async () => {
    const userName = user?.vor_nachname || ''
    const userRole = isAdmin() ? 'Admin' : isSetter() ? 'Setter' : 'Closer'
    await fetchDashboardData(userName, userRole, true) // force refresh
  }

  // Statistik-Karten mit echten Daten
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

  // Quick Actions basierend auf Rolle
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
          onClick={handleManualRefresh}
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
                className="flex items-center justify-between p-6 bg-white rounded-xl border border-gray-200 hover:border-sunside-primary hover:shadow-md transition-all group"
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
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-sunside-primary group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
