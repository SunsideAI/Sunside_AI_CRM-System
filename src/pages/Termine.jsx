import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, User, Loader2, ExternalLink, Building2, Phone, Video, AlertCircle } from 'lucide-react'

function Termine() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [hotLeadTermine, setHotLeadTermine] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState(null)
  
  const calendarId = user?.google_calendar_id
  const userName = user?.vor_nachname || user?.name

  useEffect(() => {
    loadAllTermine()
  }, [currentDate, calendarId, userName])

  const loadAllTermine = async () => {
    setLoading(true)
    setError('')
    
    try {
      // Parallel laden: Google Calendar + Hot Leads
      const promises = []
      
      // Google Calendar Events (falls verbunden)
      if (calendarId) {
        const dateStr = currentDate.toISOString().split('T')[0]
        promises.push(
          fetch(`/.netlify/functions/calendar?action=events&calendarId=${encodeURIComponent(calendarId)}&date=${dateStr}`)
            .then(r => r.json())
            .then(data => ({ type: 'google', data }))
            .catch(() => ({ type: 'google', data: { events: [] } }))
        )
      }
      
      // Hot Leads des Closers laden
      if (userName) {
        promises.push(
          fetch(`/.netlify/functions/hot-leads?closerName=${encodeURIComponent(userName)}`)
            .then(r => r.json())
            .then(data => ({ type: 'hotleads', data }))
            .catch(() => ({ type: 'hotleads', data: { hotLeads: [] } }))
        )
      }
      
      const results = await Promise.all(promises)
      
      // Google Events setzen
      const googleResult = results.find(r => r.type === 'google')
      if (googleResult?.data?.events) {
        setEvents(googleResult.data.events)
      }
      
      // Hot Leads als Termine formatieren
      const hotLeadsResult = results.find(r => r.type === 'hotleads')
      if (hotLeadsResult?.data?.hotLeads) {
        const termine = hotLeadsResult.data.hotLeads
          .filter(lead => lead.terminDatum) // Nur mit Termin
          .filter(lead => lead.status !== 'Abgesagt') // Keine abgesagten
          .map(lead => ({
            id: `hotlead-${lead.id}`,
            hotLeadId: lead.id,
            title: lead.unternehmen || 'Beratungsgespräch',
            start: lead.terminDatum,
            end: new Date(new Date(lead.terminDatum).getTime() + 30 * 60000).toISOString(), // +30 Min
            source: 'beratungsgespraech',
            terminart: lead.terminart,
            status: lead.status,
            // Lead-Details
            unternehmen: lead.unternehmen,
            ansprechpartner: `${lead.ansprechpartnerVorname || ''} ${lead.ansprechpartnerNachname || ''}`.trim(),
            email: lead.email,
            telefon: lead.telefon,
            ort: lead.ort,
            kommentar: lead.kommentar,
            setterName: lead.setterName
          }))
        setHotLeadTermine(termine)
      }
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async () => {
    loadAllTermine()
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
    
    // Google Calendar Events
    const googleEvents = events.filter(event => {
      const eventDate = new Date(event.start).toISOString().split('T')[0]
      return eventDate === dateStr
    })
    
    // Hot Lead Termine
    const hotLeadEvents = hotLeadTermine.filter(event => {
      const eventDate = new Date(event.start).toISOString().split('T')[0]
      return eventDate === dateStr
    })
    
    // Kombinieren und nach Zeit sortieren
    return [...googleEvents, ...hotLeadEvents].sort((a, b) => 
      new Date(a.start) - new Date(b.start)
    )
  }

  const getEventColor = (event) => {
    if (event.source === 'beratungsgespraech') {
      // Beratungsgespräche grün
      return 'bg-green-100 border-green-300 text-green-800'
    }
    if (event.source === 'sunside-crm') {
      return 'bg-purple-100 border-purple-300 text-purple-800'
    }
    return 'bg-blue-100 border-blue-300 text-blue-800'
  }

  const getEventIcon = (event) => {
    if (event.source === 'beratungsgespraech') {
      return event.terminart === 'Video' 
        ? <Video className="w-3 h-3 mr-1" />
        : <Phone className="w-3 h-3 mr-1" />
    }
    return null
  }

  const weekDays = getWeekDays()
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]

  // Nur Warnung wenn kein Google Calendar UND keine Hot Leads
  const showCalendarWarning = !calendarId && hotLeadTermine.length === 0 && !loading

  return (
    <div className="p-6">
      {/* Warnung wenn kein Google Calendar verbunden */}
      {!calendarId && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-800 font-medium">Google Kalender nicht verbunden</p>
            <p className="text-yellow-700 text-sm">Nur Beratungsgespräche aus dem CRM werden angezeigt. Für alle Termine verbinde deinen Google Kalender im Profil.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Termine</h1>
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
            onClick={loadEvents}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Loader2 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
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
          <span>Beratungsgespräche</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-200 border border-purple-300"></div>
          <span>CRM-Termine</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-200 border border-blue-300"></div>
          <span>Andere Termine</span>
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

                    <div className="pt-3 border-t">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Beratungsgespräch
                      </span>
                      {selectedEvent.status && selectedEvent.status !== 'Lead' && (
                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Status: {selectedEvent.status}
                        </span>
                      )}
                    </div>
                  </>
                )}

                {/* Standard Google Calendar Infos */}
                {selectedEvent.source !== 'beratungsgespraech' && (
                  <>
                    {selectedEvent.location && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div className="text-gray-600">{selectedEvent.location}</div>
                      </div>
                    )}

                    {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="font-medium text-sm mb-1">Teilnehmer</div>
                          {selectedEvent.attendees.map((a, idx) => (
                            <div key={idx} className="text-sm text-gray-600">{a.name || a.email}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedEvent.description && (
                      <div className="pt-3 border-t">
                        <div className="text-sm font-medium text-gray-700 mb-1">Beschreibung</div>
                        <div className="text-sm text-gray-600 whitespace-pre-wrap">{selectedEvent.description}</div>
                      </div>
                    )}

                    {selectedEvent.source === 'sunside-crm' && (
                      <div className="pt-3 border-t">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Über CRM gebucht
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t">
                {selectedEvent.source === 'beratungsgespraech' && (
                  <a
                    href="/closing"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Building2 className="w-4 h-4" />
                    Zum Closing
                  </a>
                )}
                {selectedEvent.htmlLink && (
                  <a
                    href={selectedEvent.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-sunside-primary text-white rounded-lg hover:bg-purple-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Google Kalender
                  </a>
                )}
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
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
