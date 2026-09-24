import { STATUS, anzeigeName } from '../../shared/status.js'
import LeadSchublade from '../components/LeadSchublade'
import SetterPool from '../components/SetterPool'
import EmailComposer from '../components/EmailComposer'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Verlauf from '../components/Verlauf'
import { Calendar, ChevronLeft, ChevronRight, Clock, User, Users, Loader2, Building2, Phone, Video, RefreshCw, CalendarDays, CalendarRange, PhoneCall, X, Mail } from 'lucide-react'

function Termine() {
  const { user, isAdmin } = useAuth()
  const routerNavigate = useNavigate()
  const [termine, setTermine] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState(null)
  // Mail-Modul ohne Stufen-Sperre: F23 verlangt ausdruecklich, dass Opener
  // und Setter in JEDER Stufe schreiben koennen, in jeder Ansicht.
  const [mailOffen, setMailOffen] = useState(false)
  
  // View Mode: own = Meine Termine, all = Alle Termine (nur Admin)
  const [viewMode, setViewMode] = useState('own')
  // Calendar Mode: week = Wochenansicht, month = Monatsansicht
  const [calendarMode, setCalendarMode] = useState('week')
  
  const userName = user?.vor_nachname || user?.name

  useEffect(() => {
    loadTermine()
  }, [currentDate, userName, viewMode])

  const loadTermine = async () => {
    if (!userName && viewMode === 'own') {
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      let allLeads = []
      
      if (viewMode === 'all' && isAdmin()) {
        // Admin: Alle Hot Leads laden
        const response = await fetch('/.netlify/functions/hot-leads')
        const data = await response.json()
        allLeads = data.hotLeads || []
      } else {
        // Normale User: eigene Termine aus allen drei Rollen. Der Opener kommt
        // dazu, weil setter_id nach dem Umbau auf den zeigt, der das
        // Beratungsgespräch hält - nicht mehr auf den, der gebucht hat. Ohne
        // den dritten Abruf verlöre der Opener seine gelegten Termine.
        const hole = (feld) =>
          fetch(`/.netlify/functions/hot-leads?${feld}=${encodeURIComponent(userName)}`)
            .then(r => r.json())
            .catch(() => ({ hotLeads: [] }))

        const [closerResponse, setterResponse, openerResponse] = await Promise.all([
          hole('closerName'), hole('setterName'), hole('openerName')
        ])

        // Kombinieren und Duplikate entfernen
        const combined = [
          ...(closerResponse.hotLeads || []),
          ...(setterResponse.hotLeads || []),
          ...(openerResponse.hotLeads || [])
        ]
        allLeads = combined.reduce((acc, lead) => {
          if (!acc.find(l => l.id === lead.id)) {
            acc.push(lead)
          }
          return acc
        }, [])
      }
      
      // Wiedervorlagen für den User laden
      let wiedervorlagen = []
      try {
        const wiedervorlageParams = new URLSearchParams({
          wiedervorlage: 'true'
        })

        // Für Admins in "Alle" Ansicht: Alle Wiedervorlagen laden
        if (viewMode === 'all' && isAdmin()) {
          wiedervorlageParams.set('view', 'all')
          wiedervorlageParams.set('userRole', 'Admin')
        } else {
          // "Meine" Ansicht: Nur Wiedervorlagen für zugewiesene Leads
          if (user?.id) {
            wiedervorlageParams.set('userId', user.id)
          }
        }

        console.log('Wiedervorlagen laden mit params:', wiedervorlageParams.toString())
        const wvResponse = await fetch(`/.netlify/functions/leads?${wiedervorlageParams}`)
        if (wvResponse.ok) {
          const wvData = await wvResponse.json()
          wiedervorlagen = wvData.leads || []
          console.log('Wiedervorlagen geladen:', wiedervorlagen.length, wiedervorlagen)
        } else {
          console.error('Wiedervorlagen Response nicht OK:', wvResponse.status)
        }
      } catch (wvErr) {
        console.warn('Wiedervorlagen laden fehlgeschlagen:', wvErr)
      }
      
      // Hot Leads als Termine formatieren
      const formattedTermine = allLeads
        .filter(lead => lead.terminDatum) // Nur mit Termin
        .map(lead => {
          const isMyClosing = lead.closerName === userName
          // Wer das Beratungsgespräch hält ...
          const isMySetting = lead.setterName === userName
          // ... und wer den Termin gelegt hat. Bis zum Umbau derselbe Mensch,
          // danach zwei verschiedene.
          const isMyBooking = lead.openerName === userName || lead.setterName === userName
          
          return {
            id: `hotlead-${lead.id}`,
            hotLeadId: lead.id,
            title: lead.unternehmen || 'Beratungsgespräch',
            start: lead.terminDatum,
            end: new Date(new Date(lead.terminDatum).getTime() + 30 * 60000).toISOString(), // +30 Min
            source: 'beratungsgespraech',
            terminart: lead.terminart,
            status: lead.status,
            isMyClosing,
            isMyBooking,
            isMySetting,
            unternehmen: lead.unternehmen,
            ansprechpartner: `${lead.ansprechpartnerVorname || ''} ${lead.ansprechpartnerNachname || ''}`.trim(),
            email: lead.email,
            telefon: lead.telefon,
            ort: lead.ort,
            kommentar: lead.kommentar,
            setterName: lead.setterName,
            closerName: lead.closerName,
            // Der vollstaendige Datensatz, damit die Setter-Ansicht die
            // Uebergabe-Felder vorbefuellen kann.
            lead
          }
        })
      
      // Wiedervorlagen als Termine formatieren
      const formattedWiedervorlagen = wiedervorlagen
        .filter(lead => lead.wiedervorlageDatum)
        .map(lead => ({
          id: `wiedervorlage-${lead.id}`,
          leadId: lead.id,
          title: lead.unternehmensname || 'Wiedervorlage',
          start: lead.wiedervorlageDatum,
          end: new Date(new Date(lead.wiedervorlageDatum).getTime() + 15 * 60000).toISOString(), // +15 Min
          source: 'wiedervorlage',
          unternehmen: lead.unternehmensname,
          ansprechpartner: `${lead.ansprechpartnerVorname || ''} ${lead.ansprechpartnerNachname || ''}`.trim(),
          email: lead.email,
          telefon: lead.telefon,
          ort: lead.stadt,
          kommentar: lead.kommentar,
          zugewiesenAn: lead.zugewiesenAn
        }))
      
      setTermine([...formattedTermine, ...formattedWiedervorlagen])
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Navigation
  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + (direction * 7))
    setCurrentDate(newDate)
  }

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + direction)
    setCurrentDate(newDate)
  }

  const navigate = (direction) => {
    if (calendarMode === 'week') {
      navigateWeek(direction)
    } else {
      navigateMonth(direction)
    }
  }

  // Formatierung
  const formatTime = (dateStr, source) => {
    const date = new Date(dateStr)
    // Prüfen ob es eine "Mitternacht UTC" Zeit ist (alte DATE-Einträge ohne echte Uhrzeit)
    // Diese werden zu 00:00 UTC konvertiert, was 01:00 deutscher Zeit entspricht
    if (source === 'wiedervorlage') {
      const utcHours = date.getUTCHours()
      const utcMinutes = date.getUTCMinutes()
      if (utcHours === 0 && utcMinutes === 0) {
        return '-'  // Keine echte Uhrzeit gesetzt
      }
    }
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Berlin'  // Immer deutsche Zeit anzeigen
    })
  }

  const formatDateLong = (date) => {
    return new Date(date).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Berlin'  // Immer deutsche Zeit anzeigen
    })
  }

  // Wochenansicht Helpers
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

  // Monatsansicht Helpers
  const getMonthDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    // Erster Tag des Monats
    const firstDay = new Date(year, month, 1)
    // Letzter Tag des Monats
    const lastDay = new Date(year, month + 1, 0)
    
    // Tage vom vorherigen Monat (für vollständige Woche)
    const startWeekday = firstDay.getDay() || 7 // Montag = 1
    const daysFromPrevMonth = startWeekday - 1
    
    const days = []
    
    // Vorherige Monatstage
    for (let i = daysFromPrevMonth; i > 0; i--) {
      const date = new Date(year, month, 1 - i)
      days.push({ date, isCurrentMonth: false })
    }
    
    // Aktuelle Monatstage
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }
    
    // Nächste Monatstage (für vollständige Wochen)
    const remaining = 42 - days.length // 6 Wochen x 7 Tage
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
    }
    
    return days
  }

  // Helper function to get local date string without UTC conversion
  const toLocalDateString = (date) => {
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getEventsForDay = (date) => {
    const dateStr = toLocalDateString(date)

    return termine
      .filter(event => {
        const eventDate = toLocalDateString(new Date(event.start))
        return eventDate === dateStr
      })
      .sort((a, b) => new Date(a.start) - new Date(b.start))
  }

  const getEventColor = (event) => {
    // Status-basierte Farben haben Priorität
    const status = event.status?.toLowerCase() || ''

    // Abgesagt = Rot
    if (status.includes('abgesagt')) {
      return 'bg-red-100 border-red-300 text-red-700'
    }

    // Verschoben = Gelb/Amber
    if (status.includes('verschoben')) {
      return 'bg-amber-100 border-amber-300 text-amber-800'
    }

    // Wiedervorlage = Orange
    if (event.source === 'wiedervorlage') {
      return 'bg-orange-100 border-orange-300 text-orange-800'
    }

    if (viewMode === 'all') {
      // In "Alle Termine" Ansicht: Farbe nach Closer
      if (event.closerName) {
        return 'bg-green-100 border-green-300 text-green-800'
      }
      return 'bg-amber-100 border-amber-300 text-amber-800' // Kein Closer = Pool
    }

    // Mein Closing (ich bin Closer) = Grün
    if (event.isMyClosing) {
      return 'bg-green-100 border-green-300 text-green-800'
    }
    // Meine Buchung (ich bin Setter, aber nicht Closer) = Lila
    if (event.isMyBooking && !event.isMyClosing) {
      return 'bg-secondary-container border-primary-fixed-dim text-primary'
    }
    return 'bg-blue-100 border-blue-300 text-blue-800'
  }

  // Prüfen ob Termin abgesagt ist (für Durchstreichung)
  const isEventCancelled = (event) => {
    const status = event.status?.toLowerCase() || ''
    return status.includes('abgesagt')
  }

  const getEventIcon = (event) => {
    // Wiedervorlage = Telefon mit Klingel
    if (event.source === 'wiedervorlage') {
      return <PhoneCall className="w-3 h-3 mr-1" />
    }
    return event.terminart === 'Video' 
      ? <Video className="w-3 h-3 mr-1" />
      : <Phone className="w-3 h-3 mr-1" />
  }

  const weekDays = getWeekDays()
  const monthDays = getMonthDays()
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]

  // Header Text je nach Modus
  const getHeaderDateText = () => {
    if (calendarMode === 'week') {
      return `${weekStart.toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })} - ${weekEnd.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`
    }
    return currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="seitenkopf">
        <div>
          <h1 className="text-headline-lg font-display text-on-surface">
            {viewMode === 'all' ? 'Alle Termine' : 'Meine Termine'}
          </h1>
          <p className="text-body-md text-on-surface-variant mt-2">{getHeaderDateText()}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle - nur für Admins */}
          {isAdmin() && (
            <div className="umschalter">
              <button
                onClick={() => setViewMode('own')}
                className={`umschalter-knopf ${
                  viewMode === 'own'
                    ? 'aktiv'
                    : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
                }`}
              >
                <User className="w-4 h-4 mr-1.5" />
                Meine
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`umschalter-knopf ${
                  viewMode === 'all'
                    ? 'aktiv'
                    : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
                }`}
              >
                <Users className="w-4 h-4 mr-1.5" />
                Alle
              </button>
            </div>
          )}

          {/* Calendar Mode Toggle */}
          <div className="umschalter">
            <button
              onClick={() => setCalendarMode('week')}
              className={`umschalter-knopf ${
                calendarMode === 'week'
                  ? 'aktiv'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
              }`}
            >
              <CalendarRange className="w-4 h-4 mr-1.5" />
              Woche
            </button>
            <button
              onClick={() => setCalendarMode('month')}
              className={`umschalter-knopf ${
                calendarMode === 'month'
                  ? 'aktiv'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
              }`}
            >
              <CalendarDays className="w-4 h-4 mr-1.5" />
              Monat
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentDate(new Date())}
              className="kopf-knopf"
            >
              Heute
            </button>
            {/* Vor und zurueck teilen sich eine Huelle - sie gehoeren zusammen.
                Die Hoehe ist dieselbe wie bei allem anderen in dieser Zeile. */}
            <div className="flex items-center h-9 bg-surface-container-lowest rounded-lg shadow-ambient-sm">
              <button onClick={() => navigate(-1)} aria-label="Zurück"
                      className="flex items-center justify-center w-9 h-9 hover:bg-surface-container rounded-l-lg transition-colors">
                <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
              </button>
              <button onClick={() => navigate(1)} aria-label="Weiter"
                      className="flex items-center justify-center w-9 h-9 hover:bg-surface-container rounded-r-lg transition-colors">
                <ChevronRight className="w-4 h-4 text-on-surface-variant" />
              </button>
            </div>
            <button
              onClick={loadTermine}
              disabled={loading}
              aria-label="Aktualisieren"
              title="Aktualisieren"
              className="kopf-knopf kopf-knopf-symbol"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-error-container rounded-xl p-4 text-error">
          {error}
        </div>
      )}

      {/* Beratungsgespräche, für die noch kein Setter eingeteilt ist */}
      <SetterPool onGeaendert={loadTermine} />

      {/* Kalender */}
      <div className="card-elevated overflow-hidden">
        {/* Wochentage Header */}
        <div className="grid grid-cols-7 bg-surface-container">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day, idx) => (
            <div key={idx} className="p-3 text-center text-label-sm font-medium text-on-surface-variant uppercase">
              {day}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : calendarMode === 'week' ? (
          /* ========== WOCHENANSICHT ========== */
          <>
            {/* Datum-Header für Woche */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {weekDays.map((date, idx) => {
                const isToday = date.toDateString() === new Date().toDateString()
                return (
                  <div key={idx} className={`p-3 text-center border-r last:border-r-0 ${isToday ? 'bg-primary-fixed/30' : ''}`}>
                    <div className={`text-lg font-semibold ${isToday ? 'text-primary' : 'text-gray-900'}`}>
                      {date.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Termine Grid für Woche */}
            <div className="grid grid-cols-7 min-h-[400px]">
              {weekDays.map((date, idx) => {
                const dayEvents = getEventsForDay(date)
                const isToday = date.toDateString() === new Date().toDateString()
                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                
                return (
                  <div key={idx} className={`border-r last:border-r-0 p-2 ${isToday ? 'bg-primary-fixed/20' : isWeekend ? 'bg-gray-50' : ''}`}>
                    {dayEvents.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-4">Keine Termine</div>
                    ) : (
                      <div className="space-y-1">
                        {dayEvents.map(event => (
                          <button
                            key={event.id}
                            onClick={() => setSelectedEvent(event)}
                            className={`w-full text-left p-2 rounded-lg border text-xs hover:shadow-md transition-shadow ${getEventColor(event)} ${isEventCancelled(event) ? 'opacity-60' : ''}`}
                          >
                            <div className={`font-medium truncate flex items-center ${isEventCancelled(event) ? 'line-through' : ''}`}>
                              {getEventIcon(event)}
                              {event.title}
                            </div>
                            <div className={`text-[10px] opacity-75 ${isEventCancelled(event) ? 'line-through' : ''}`}>
                              {formatTime(event.start, event.source)}
                            </div>
                            {viewMode === 'all' && event.closerName && (
                              <div className="text-[10px] opacity-75 truncate">
                                {event.closerName}
                              </div>
                            )}
                            {isEventCancelled(event) && (
                              <div className="text-[9px] font-medium mt-0.5">ABGESAGT</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          /* ========== MONATSANSICHT ========== */
          <div className="grid grid-cols-7">
            {monthDays.map((dayInfo, idx) => {
              const { date, isCurrentMonth } = dayInfo
              const dayEvents = getEventsForDay(date)
              const isToday = date.toDateString() === new Date().toDateString()
              const isWeekend = date.getDay() === 0 || date.getDay() === 6
              
              return (
                <div 
                  key={idx} 
                  className={`min-h-[100px] border-b border-r p-1 ${
                    !isCurrentMonth ? 'bg-gray-50 text-gray-400' : 
                    isToday ? 'bg-primary-fixed/30' : 
                    isWeekend ? 'bg-gray-50/50' : ''
                  }`}
                >
                  <div className={`text-sm font-medium mb-1 px-1 ${
                    isToday ? 'text-primary' : 
                    !isCurrentMonth ? 'text-gray-400' : 'text-gray-700'
                  }`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(event => (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] truncate hover:shadow-sm transition-shadow ${getEventColor(event)} ${isEventCancelled(event) ? 'opacity-60 line-through' : ''}`}
                      >
                        <span className="font-medium">{formatTime(event.start, event.source)}</span> {event.title}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-gray-500 px-1">
                        +{dayEvents.length - 3} weitere
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Legende */}
      <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-600">
        {viewMode === 'own' ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-200 border border-green-300"></div>
              <span>Mein Closing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-primary-fixed-dim border border-primary-fixed-dim"></div>
              <span>Von mir gebucht</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-200 border border-orange-300"></div>
              <span>Wiedervorlage</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-200 border border-green-300"></div>
              <span>Mit Closer</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-200 border border-amber-300"></div>
              <span>Im Pool (kein Closer)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-200 border border-orange-300"></div>
              <span>Wiedervorlage</span>
            </div>
          </>
        )}
        {/* Status-Legende (immer anzeigen) */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-200 border border-red-300"></div>
          <span className="line-through">Abgesagt</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-200 border border-amber-300"></div>
          <span>Verschoben</span>
        </div>
      </div>

      {/* Der Kalender zeigt, was ansteht - gearbeitet wird in den Tabs.
          Deshalb steht hier nur, was zum Termin zu wissen ist: wer, wann, wie
          und wer dabei ist. Die Dokumentation des Gesprächs stand früher mit
          in dieser Schublade; sie gehört ins Setting und ist dort seit dem
          Umbau auch geführt. */}
      <LeadSchublade
        offen={Boolean(selectedEvent)}
        onClose={() => { setSelectedEvent(null); setMailOffen(false) }}
        titel={selectedEvent?.title || 'Termin'}
        untertitel={[
          selectedEvent?.source === 'wiedervorlage' ? 'Wiedervorlage' : 'Beratungsgespräch',
          selectedEvent?.ort
        ].filter(Boolean).join(' · ')}
        kontakt={selectedEvent ? {
          ansprechpartner: selectedEvent.ansprechpartner || null,
          statusFeld: selectedEvent.status ? anzeigeName(selectedEvent.status) : null,
          telefon: selectedEvent.telefon,
          email: selectedEvent.email,
          website: selectedEvent.lead?.website,
          ort: selectedEvent.ort,
          rollen: {
            opener: selectedEvent.lead?.openerName,
            setter: selectedEvent.setterName,
            closer: selectedEvent.closerName
          }
        } : {}}
        termin={selectedEvent ? {
          datum: selectedEvent.start
            ? new Date(selectedEvent.start).toLocaleString('de-DE', {
                weekday: 'long', day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
              })
              + (selectedEvent.end
                ? ' – ' + new Date(selectedEvent.end).toLocaleTimeString('de-DE', {
                    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
                  })
                : '')
              + ' Uhr'
            : null,
          art: selectedEvent.source === 'wiedervorlage'
            ? 'Wiedervorlage, telefonisch'
            : (selectedEvent.terminart || 'Telefonisch'),
          link: selectedEvent.lead?.meeting_link,
          // Die Kennzeichen aus der Kalenderfarbe, damit die Schublade
          // dasselbe sagt wie der Eintrag im Raster.
          zusatz: (
            <div className="flex flex-wrap gap-2">
              {selectedEvent.isMyClosing && (
                <span className="px-2.5 py-1 rounded-full text-label-sm bg-success-container text-success">
                  Mein Closing
                </span>
              )}
              {selectedEvent.isMySetting && (
                <span className="px-2.5 py-1 rounded-full text-label-sm bg-secondary-container text-primary">
                  Mein Beratungsgespräch
                </span>
              )}
              {selectedEvent.isMyBooking && !selectedEvent.isMyClosing && !selectedEvent.isMySetting && (
                <span className="px-2.5 py-1 rounded-full text-label-sm bg-primary-fixed text-primary">
                  Von mir gebucht
                </span>
              )}
              {selectedEvent.source === 'beratungsgespraech' && !selectedEvent.closerName && (
                <span className="px-2.5 py-1 rounded-full text-label-sm bg-surface-container text-on-surface-variant">
                  Abschlussgespräch noch ohne Closer
                </span>
              )}
              {selectedEvent.zugewiesenAn && (
                <span className="px-2.5 py-1 rounded-full text-label-sm bg-surface-container text-on-surface-variant">
                  Zugewiesen an {selectedEvent.zugewiesenAn}
                </span>
              )}
            </div>
          )
        } : null}
        verlauf={selectedEvent ? {
          hotLeadId: selectedEvent.hotLeadId,
          leadId: selectedEvent.leadId || selectedEvent.lead?.originalLeadId
        } : null}
        arbeitsTitel="E-Mail an den Kontakt"
        arbeitsIcon={Mail}
        fuss={selectedEvent && (
          <>
            <button onClick={() => setMailOffen(o => !o)} className="fuss-neben">
              <Mail className="w-4 h-4" /> E-Mail an den Kontakt
            </button>
            {/* Gearbeitet wird in der Stufe, zu der der Termin gehört. */}
            <button
              onClick={() => {
                const ziel = selectedEvent.source === 'wiedervorlage' ? '/opening'
                  : selectedEvent.isMyClosing ? '/closing' : '/setting'
                setSelectedEvent(null); setMailOffen(false)
                routerNavigate(ziel, { state: { openLeadId: selectedEvent.hotLeadId } })
              }}
              className="fuss-haupt"
            >
              <Building2 className="w-4 h-4" />
              {selectedEvent.source === 'wiedervorlage' ? 'Im Opening öffnen'
                : selectedEvent.isMyClosing ? 'Im Closing öffnen' : 'Im Setting öffnen'}
            </button>
          </>
        )}
      >
        {selectedEvent && mailOffen && (
          <EmailComposer
            hotLeadId={selectedEvent.hotLeadId}
            lead={{
              id: selectedEvent.lead?.originalLeadId || selectedEvent.leadId || selectedEvent.hotLeadId,
              unternehmensname: selectedEvent.unternehmen,
              email: selectedEvent.email,
              telefon: selectedEvent.telefon,
              ort: selectedEvent.ort,
              ansprechpartnerVorname: selectedEvent.lead?.ansprechpartnerVorname,
              ansprechpartnerNachname: selectedEvent.lead?.ansprechpartnerNachname
            }}
            user={user}
            inline={true}
            kategorie="Setting"
            onClose={() => setMailOffen(false)}
            onSent={() => setMailOffen(false)}
          />
        )}
      </LeadSchublade>

    </div>
  )
}

export default Termine
