import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  Globe, 
  Building2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink
} from 'lucide-react'

function Kaltakquise() {
  const { user } = useAuth()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const leadsPerPage = 25

  // Leads laden
  useEffect(() => {
    loadLeads()
  }, [currentPage])

  const loadLeads = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(
        `/.netlify/functions/leads?page=${currentPage}&limit=${leadsPerPage}&userId=${user?.id || ''}`
      )
      
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Leads')
      }
      
      const data = await response.json()
      setLeads(data.leads || [])
      setTotalRecords(data.total || 0)
    } catch (err) {
      setError(err.message)
      // Demo-Daten für Entwicklung
      setLeads([
        {
          id: '1',
          unternehmensname: '3A Immobilien Halle',
          stadt: 'Halle (Saale)',
          kategorie: 'Immobilienmakler',
          mail: 'info@3a-halle.de',
          website: 'https://www.3a-halle.de/',
          telefonnummer: '+49 345 2093310',
          ergebnis: '',
          kommentar: ''
        },
        {
          id: '2',
          unternehmensname: 'A1 Immobilien GmbH',
          stadt: 'Halle (Saale)',
          kategorie: 'Immobilienmakler',
          mail: 'info@a1-immo.de',
          website: 'http://www.a1-immo.de/',
          telefonnummer: '+49 345 6817660',
          ergebnis: '',
          kommentar: ''
        },
        {
          id: '3',
          unternehmensname: 'ABITA Immobilienmanagement GmbH',
          stadt: 'Halberstadt',
          kategorie: 'Immobilienagentur',
          mail: 'info@abita-immobilien.de',
          website: 'http://www.abita-immobilien.de/',
          telefonnummer: '+49 3941 570410',
          ergebnis: '',
          kommentar: ''
        }
      ])
      setTotalRecords(3)
    } finally {
      setLoading(false)
    }
  }

  // Gefilterte Leads
  const filteredLeads = leads.filter(lead =>
    lead.unternehmensname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.stadt?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(totalRecords / leadsPerPage)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kaltakquise</h1>
          <p className="mt-1 text-gray-500">
            {totalRecords} Leads zugewiesen
          </p>
        </div>
      </div>

      {/* Suche & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Suche nach Firma oder Stadt..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
          />
        </div>
        <button className="flex items-center px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <Filter className="w-5 h-5 mr-2 text-gray-500" />
          Filter
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          <p className="text-sm">⚠️ API nicht verfügbar - zeige Demo-Daten</p>
        </div>
      )}

      {/* Leads Liste */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-sunside-primary animate-spin" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Keine Leads gefunden</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredLeads.map((lead) => (
              <div
                key={lead.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Lead Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {lead.unternehmensname}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {lead.stadt}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                        {lead.kategorie}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {lead.telefonnummer && (
                      <a
                        href={`tel:${lead.telefonnummer}`}
                        className="flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                        title="Anrufen"
                      >
                        <Phone className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline text-sm font-medium">Anrufen</span>
                      </a>
                    )}
                    {lead.mail && (
                      <a
                        href={`mailto:${lead.mail}`}
                        className="p-2 text-gray-500 hover:text-sunside-primary hover:bg-gray-100 rounded-lg transition-colors"
                        title="E-Mail senden"
                      >
                        <Mail className="w-5 h-5" />
                      </a>
                    )}
                    {lead.website && (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-500 hover:text-sunside-primary hover:bg-gray-100 rounded-lg transition-colors"
                        title="Website öffnen"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">
              Seite {currentPage} von {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Kaltakquise
