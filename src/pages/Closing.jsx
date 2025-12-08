import { useAuth } from '../context/AuthContext'
import { 
  Calendar, 
  Clock,
  User,
  Video,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'

function Closing() {
  const { user } = useAuth()

  // Placeholder Termine (später aus Notion/Airtable)
  const termine = [
    {
      id: 1,
      firma: 'ABC Immobilien GmbH',
      ansprechpartner: 'Max Mustermann',
      datum: '2025-12-09',
      uhrzeit: '10:00',
      status: 'anstehend',
      link: 'https://zoom.us/...'
    },
    {
      id: 2,
      firma: 'XYZ Makler',
      ansprechpartner: 'Erika Musterfrau',
      datum: '2025-12-09',
      uhrzeit: '14:00',
      status: 'anstehend',
      link: 'https://zoom.us/...'
    }
  ]

  const getStatusBadge = (status) => {
    switch (status) {
      case 'anstehend':
        return (
          <span className="flex items-center px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3 mr-1" />
            Anstehend
          </span>
        )
      case 'abgeschlossen':
        return (
          <span className="flex items-center px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3 mr-1" />
            Abgeschlossen
          </span>
        )
      case 'noshow':
        return (
          <span className="flex items-center px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3 mr-1" />
            No-Show
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Closing</h1>
        <p className="mt-1 text-gray-500">
          Deine Termine und Abschlüsse
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-blue-900">Notion-Integration ausstehend</h3>
            <p className="mt-1 text-sm text-blue-700">
              Die Hot Leads und Termine werden aktuell noch in Notion verwaltet. 
              Sobald die Integration steht, siehst du hier deine echten Daten.
            </p>
          </div>
        </div>
      </div>

      {/* Termine Heute */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <Calendar className="w-5 h-5 inline mr-2" />
          Termine heute
        </h2>

        <div className="space-y-4">
          {termine.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Keine Termine für heute</p>
            </div>
          ) : (
            termine.map((termin) => (
              <div
                key={termin.id}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">{termin.firma}</h3>
                      {getStatusBadge(termin.status)}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span className="flex items-center">
                        <User className="w-4 h-4 mr-1" />
                        {termin.ansprechpartner}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {termin.uhrzeit} Uhr
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={termin.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center px-4 py-2 bg-sunside-primary text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Meeting beitreten
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pipeline Übersicht */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline</h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Im Closing', count: '—', color: 'bg-yellow-100 text-yellow-700' },
            { label: 'Angebot gesendet', count: '—', color: 'bg-blue-100 text-blue-700' },
            { label: 'Gewonnen', count: '—', color: 'bg-green-100 text-green-700' },
            { label: 'Verloren', count: '—', color: 'bg-red-100 text-red-700' }
          ].map((stage) => (
            <div
              key={stage.label}
              className="bg-white rounded-xl border border-gray-200 p-4 text-center"
            >
              <p className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${stage.color}`}>
                {stage.label}
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{stage.count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Closing
