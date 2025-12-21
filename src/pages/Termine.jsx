import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Calendar, ChevronLeft, ChevronRight, Clock, User, Loader2, Building2, Phone, Video, RefreshCw } from 'lucide-react'

function Termine() {
  const { user } = useAuth()
  const [termine, setTermine] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState(null)
  
  const userName = user?.vor_nachname || user?.name

  useEffect(() => {
    loadTermine()
  }, [currentDate, userName])

  const loadTermine = async () => {
    if (!userName) {
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      // Beide Abfragen parallel: Als Closer UND als Setter
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
      
      // Als Termine formatieren
      const formattedTermine = uniqueLeads
        .filter(lead => lead.terminDatum) // Nur mit Termin
        .filter(lead => lead.status !== 'Abgesagt' && lead.status !== 'Termin abgesagt') // Keine abgesagten
        .map(lead => {
          const isMyClosing = lead.closerName === userName
          const isMyBooking = lead.setterName === userName
          
          return {
            id: `hotlead-${lead.id}`,
            hotLeadId: lead.id,
            title: lead.unternehmen || 'Beratungsgespräch',
            start: lead.terminDatum,
            end: new Date(new Date(lead.terminDatum).getTime() + 30 * 60000).toISOString(), // +30 Min
            source: 'beratungsgespraech',
            terminart: lead.terminart,
            status: lead.status,
            // Rolle des Users für diesen Termin
            isMyClosing,
            isMyBooking,
            // Lead-Details
            unternehmen: lead.unternehmen,
            ansprechpartner: `${lead.ansprechpartnerVorname || ''} ${lead.ansprechpartnerNachname || ''}`.trim(),
            email: lead.email,
            telefon: lead.telefon,
            ort: lead.ort,
            kommentar: lead.kommentar,
            setterName: lead.setterName,
            closerName: lead.closerName
          }
        })
      
      setTermine(formattedTermine)
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + (direction * 7))
    setCurrentDate(newDate)
  }

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateLong = (date) => {
    return new Date(date).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const getWeekDays = () => {
    const days = []
    const start = new Date(currentDate)
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1)
    start.setDate(diff)
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      days.push(date)
    }
    return days
  }

  const getEventsForDay = (date) => {
    const dateStr = date.toISOString().split('T')[0]
    
    return termine
      .filter(event => {
        const eventDate = new Date(event.start).toISOString().split('T')[0]
        return eventDate === dateStr
      })
      .sort((a, b) => new Date(a.start) - new Date(b.start))
  }

  const getEventColor = (event) => {
    // Mein Closing (ich bin Closer) = Grün
    if (event.isMyClosing) {
      return 'bg-green-100 border-green-300 text-green-800'
    }
    // Meine Buchung (ich bin Setter, aber nicht Closer) = Lila
    if (event.isMyBooking && !event.isMyClosing) {
      return 'bg-purple-100 border-purple-300 text-purple-800'
    }
    return 'bg-blue-100 border-blue-300 text-blue-800'
  }

  const getEventIcon = (event) => {
    return event.terminart === 'Video' 
      ? <Video className="w-3 h-3 mr-1" />
      : <Phone className="w-3 h-3 mr-1" />
  }

  const weekDays = getWeekDays()
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meine Termine</h1>
          <p className="text-gray-500 text-sm">
            {formatDateLong(weekStart)} - {formatDateLong(weekEnd)}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Heute
          </button>
          <div className="flex items-center border border-gray-300 rounded-lg">
            <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-gray-50 rounded-l-lg">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-gray-50 rounded-r-lg">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={loadTermine}
            disabled={loading}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200">
          {weekDays.map((date, idx) => {
            const isToday = date.toDateString() === new Date().toDateString()
            return (
              <div key={idx} className={`p-3 text-center border-r last:border-r-0 ${isToday ? 'bg-purple-50' : ''}`}>
                <div className="text-xs text-gray-500 uppercase">
                  {date.toLocaleDateString('de-DE', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-semibold ${isToday ? 'text-sunside-primary' : 'text-gray-900'}`}>
                  {date.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-sunside-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-7 min-h-[400px]">
            {weekDays.map((date, idx) => {
              const dayEvents = getEventsForDay(date)
              const isToday = date.toDateString() === new Date().toDateString()
              const isWeekend = date.getDay() === 0 || date.getDay() === 6
              
              return (
                <div key={idx} className={`border-r last:border-r-0 p-2 ${isToday ? 'bg-purple-50/50' : isWeekend ? 'bg-gray-50' : ''}`}>
                  {dayEvents.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-4">Keine Termine</div>
                  ) : (
                    <div className="space-y-1">
                      {dayEvents.map(event => (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`w-full text-left p-2 rounded-lg border text-xs hover:shadow-md transition-shadow ${getEventColor(event)}`}
                        >
                          <div className="font-medium truncate flex items-center">
                            {getEventIcon(event)}
                            {event.title}
                          </div>
                          {!event.allDay && (
                            <div className="text-[10px] opacity-75">
                              {formatTime(event.start)} - {formatTime(event.end)}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-200 border border-green-300"></div>
          <span>Mein Closing</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-200 border border-purple-300"></div>
          <span>Von mir gebucht</span>
        </div>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedEvent.title}</h3>
                  {selectedEvent.source === 'beratungsgespraech' && (
                    <span className={`inline-flex items-center mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                      selectedEvent.terminart === 'Video' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {selectedEvent.terminart === 'Video' ? <Video className="w-3 h-3 mr-1" /> : <Phone className="w-3 h-3 mr-1" />}
                      {selectedEvent.terminart || 'Telefonisch'}
                    </span>
                  )}
                </div>
                <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="font-medium">{formatDateLong(selectedEvent.start)}</div>
                    {!selectedEvent.allDay && (
                      <div className="text-gray-600">{formatTime(selectedEvent.start)} - {formatTime(selectedEvent.end)}</div>
                    )}
                  </div>
                </div>

                {/* Beratungsgespräch-spezifische Infos */}
                {selectedEvent.source === 'beratungsgespraech' && (
                  <>
                    {selectedEvent.ansprechpartner && (
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="font-medium text-sm">Ansprechpartner</div>
                          <div className="text-gray-600">{selectedEvent.ansprechpartner}</div>
                        </div>
                      </div>
                    )}

                    {selectedEvent.unternehmen && (
                      <div className="flex items-start gap-3">
                        <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="font-medium text-sm">Unternehmen</div>
                          <div className="text-gray-600">{selectedEvent.unternehmen}</div>
                          {selectedEvent.ort && <div className="text-gray-500 text-sm">{selectedEvent.ort}</div>}
                        </div>
                      </div>
                    )}

                    {selectedEvent.telefon && (
                      <div className="flex items-start gap-3">
                        <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <a href={`tel:${selectedEvent.telefon}`} className="text-purple-600 hover:underline">
                            {selectedEvent.telefon}
                          </a>
                        </div>
                      </div>
                    )}

                    {selectedEvent.kommentar && (
                      <div className="pt-3 border-t">
                        <div className="text-sm font-medium text-gray-700 mb-1">Notizen / Problemstellung</div>
                        <div className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">{selectedEvent.kommentar}</div>
                      </div>
                    )}

                    {selectedEvent.setterName && (
                      <div className="text-sm text-gray-500">
                        Gebucht von: {selectedEvent.setterName}
                      </div>
                    )}

                    <div className="pt-3 border-t flex flex-wrap gap-2">
                      {selectedEvent.isMyClosing && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Mein Closing
                        </span>
                      )}
                      {selectedEvent.isMyBooking && !selectedEvent.isMyClosing && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Von mir gebucht
                        </span>
                      )}
                      {selectedEvent.closerName && selectedEvent.isMyBooking && !selectedEvent.isMyClosing && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Closer: {selectedEvent.closerName}
                        </span>
                      )}
                      {!selectedEvent.closerName && selectedEvent.isMyBooking && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Noch kein Closer
                        </span>
                      )}
                      {selectedEvent.status && selectedEvent.status !== 'Lead' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Status: {selectedEvent.status}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t">
                {selectedEvent.isMyClosing && (
                  <a
                    href="/closing"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Building2 className="w-4 h-4" />
                    Zum Closing
                  </a>
                )}
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Termine
