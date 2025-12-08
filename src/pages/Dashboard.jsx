import { useAuth } from '../context/AuthContext'
import { 
  Phone, 
  Calendar, 
  TrendingUp, 
  Users,
  ArrowRight
} from 'lucide-react'
import { Link } from 'react-router-dom'

function Dashboard() {
  const { user, isSetter, isCloser, isAdmin } = useAuth()

  // Statistik-Karten (später mit echten Daten)
  const stats = [
    {
      name: 'Zugewiesene Leads',
      value: '—',
      icon: Users,
      color: 'bg-blue-500',
      show: isSetter() || isAdmin()
    },
    {
      name: 'Calls heute',
      value: '—',
      icon: Phone,
      color: 'bg-green-500',
      show: isSetter() || isAdmin()
    },
    {
      name: 'Termine diese Woche',
      value: '—',
      icon: Calendar,
      color: 'bg-purple-500',
      show: true
    },
    {
      name: 'Abschlüsse Monat',
      value: '—',
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hallo, {user?.vorname || 'User'}! 👋
        </h1>
        <p className="mt-1 text-gray-500">
          Hier ist dein Überblick für heute.
        </p>
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
                <p className="mt-1 text-3xl font-bold text-gray-900">{stat.value}</p>
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

      {/* Info Box für Entwicklung */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-medium text-blue-900">🚧 In Entwicklung</h3>
        <p className="mt-1 text-sm text-blue-700">
          Das Dashboard wird mit echten Daten aus Airtable befüllt, sobald die API-Verbindung steht.
          Aktuell siehst du die Grundstruktur.
        </p>
      </div>
    </div>
  )
}

export default Dashboard
