import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, User, Loader2, ExternalLink } from 'lucide-react'

function Termine() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState(null)
  
  const calendarId = user?.google_calendar_id

  useEffect(() => {
    if (calendarId) {
      loadEvents()
    } else {
      setLoading(false)
    }
  }, [currentDate, calendarId])

  const loadEvents = async () => {
    if (!calendarId) return
    
    setLoading(true)
    setError('')
    
    try {
      const dateStr = currentDate.toISOString().split('T')[0]
      const response = await fetch(`/.netlify/functions/calendar?action=events&calendarId=${encodeURIComponent(calendarId)}&date=${dateStr}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Laden der Termine')
      }
      
      setEvents(data.events || [])
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
    return events.filter(event => {
      const eventDate = new Date(event.start).toISOString().split('T')[0]
      return eventDate === dateStr
    })
  }

  const getEventColor = (event) => {
    if (event.source === 'sunside-crm') {
      return 'bg-purple-100 border-purple-300 text-purple-800'
    }
    return 'bg-blue-100 border-blue-300 text-blue-800'
  }

  const weekDays = getWeekDays()
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]

  if (!calendarId) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <Calendar className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Kalender nicht verbunden</h2>
          <p className="text-yellow-700">
            Um deine Termine zu sehen, muss dein Google Kalender in deinem Profil hinterlegt sein.
            Wende dich an einen Admin.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
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
                          className={`w-full text-left p-2 rounded-lg border text-xs hover:shadow-md ${getEventColor(event)}`}
                        >
                          <div className="font-medium truncate">{event.title}</div>
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

      <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-gray-900">{selectedEvent.title}</h3>
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

                {selectedEvent.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div className="text-gray-600">{selectedEvent.location}</div>
                  </div>
                )}

                {selectedEvent.attendees?.length > 0 && (
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
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t">
                {selectedEvent.htmlLink && (
                  
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
