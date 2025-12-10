import { useState, useEffect } from 'react'
import { Calendar, Clock, User, Loader2, Check, ChevronLeft, ChevronRight, Mail, Phone } from 'lucide-react'

function TerminPicker({ lead, onTerminBooked, onCancel }) {
  const [closers, setClosers] = useState([])
  const [selectedCloser, setSelectedCloser] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  
  // Editierbare Kontaktdaten
  const [contactEmail, setContactEmail] = useState(lead?.email || '')
  const [contactPhone, setContactPhone] = useState(lead?.telefon || '')
  
  // Calendly Pflichtfelder
  const [unternehmensname, setUnternehmensname] = useState(lead?.unternehmensname || '')
  const [taetigkeit, setTaetigkeit] = useState('Makler') // Makler oder Sachverständiger
  const [problemstellung, setProblemstellung] = useState('')

  // Closer laden
  useEffect(() => {
    loadClosers()
  }, [])

  // Slots laden wenn Closer und Datum gewählt
  useEffect(() => {
    if (selectedCloser && selectedDate) {
      loadSlots()
    }
  }, [selectedCloser, selectedDate])

  const loadClosers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/.netlify/functions/users')
      const data = await response.json()
      
      if (response.ok) {
        // Nur Closer mit Google Calendar ID
        const closerUsers = data.users.filter(user => {
          const rollen = user.rolle || []
          const isCloser = rollen.some(r => 
            r.toLowerCase() === 'closer' || r.toLowerCase() === 'admin'
          )
          // Muss Google Calendar ID haben
          const hasCalendar = user.google_calendar_id || user.email
          return isCloser && hasCalendar
        })
        setClosers(closerUsers)
        
        // Wenn nur ein Closer, automatisch auswählen
        if (closerUsers.length === 1) {
          setSelectedCloser(closerUsers[0])
        }
      }
    } catch (err) {
      setError('Fehler beim Laden der Closer')
    } finally {
      setLoading(false)
    }
  }

  const loadSlots = async () => {
    if (!selectedCloser || !selectedDate) return
    
    setLoadingSlots(true)
    setSlots([])
    setSelectedSlot(null)
    
    try {
      const calendarId = selectedCloser.google_calendar_id || selectedCloser.email
      const response = await fetch(
        `/.netlify/functions/calendar?action=slots&calendarId=${encodeURIComponent(calendarId)}&date=${selectedDate}`
      )
      const data = await response.json()
      
      if (response.ok) {
        // Nur zukünftige Slots anzeigen
        const now = new Date()
        const futureSlots = data.freeSlots.filter(slot => new Date(slot.start) > now)
        setSlots(futureSlots)
      } else {
        setError('Fehler beim Laden der Termine')
      }
    } catch (err) {
      setError('Fehler beim Laden der Termine')
    } finally {
      setLoadingSlots(false)
    }
  }

  const bookTermin = async () => {
    if (!selectedCloser || !selectedSlot || !lead) return
    
    // Validierung
    if (!contactEmail || !contactEmail.includes('@')) {
      setError('Bitte gültige E-Mail-Adresse eingeben')
      return
    }
    if (!contactPhone || contactPhone.length < 6) {
      setError('Bitte gültige Telefonnummer eingeben')
      return
    }
    if (!unternehmensname) {
      setError('Bitte Unternehmensname eingeben')
      return
    }
    if (!problemstellung) {
      setError('Bitte Problemstellung & Ziele eingeben')
      return
    }
    
    setBooking(true)
    setError('')
    
    try {
      const calendarId = selectedCloser.google_calendar_id || selectedCloser.email
      
      // 1. Google Calendar Termin erstellen
      const gcalResponse = await fetch('/.netlify/functions/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: calendarId,
          title: `Beratungsgespräch: ${unternehmensname}`,
          description: `Unternehmen: ${unternehmensname}\nTätigkeit: ${taetigkeit}\nStadt: ${lead.stadt || '-'}\nTelefon: ${contactPhone}\nE-Mail: ${contactEmail}\n\nProblemstellung & Ziele:\n${problemstellung}\n\nGebucht über Sunside CRM`,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          leadId: lead.id
        })
      })
      
      const gcalData = await gcalResponse.json()
      
      if (!gcalResponse.ok || !gcalData.success) {
        throw new Error(gcalData.error || 'Google Calendar Fehler')
      }

      // 2. Calendly Termin erstellen (falls konfiguriert)
      try {
        const calendlyResponse = await fetch('/.netlify/functions/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'calendly-book',
            eventTypeUri: 'https://api.calendly.com/event_types/b7fa6cb8-8dcf-42f9-a8cf-9e73a776c57c',
            startTime: selectedSlot.start,
            inviteeName: unternehmensname,
            inviteeEmail: contactEmail,
            inviteePhone: contactPhone,
            leadInfo: {
              firma: unternehmensname,
              stadt: lead.stadt,
              telefon: contactPhone,
              kategorie: lead.kategorie,
              taetigkeit: taetigkeit,
              problemstellung: problemstellung,
              closerEmail: selectedCloser.email || selectedCloser.email_geschaeftlich
            }
          })
        })
        
        const calendlyData = await calendlyResponse.json()
        console.log('Calendly Booking Result:', calendlyData)
        
      } catch (calendlyError) {
        // Calendly-Fehler nur loggen, nicht abbrechen
        console.warn('Calendly Booking fehlgeschlagen:', calendlyError)
      }
      
      setSuccess(true)
      
      // Lead in Airtable aktualisieren
      await fetch('/.netlify/functions/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          updates: {
            ergebnis: 'Beratungsgespräch',
            kontaktiert: true,
            kommentar: `Termin gebucht: ${formatDate(selectedDate)} um ${selectedSlot.startTime} Uhr mit ${selectedCloser.vor_nachname}`
          }
        })
      })
      
      setTimeout(() => {
        onTerminBooked && onTerminBooked({
          date: selectedDate,
          time: selectedSlot.startTime,
          closer: selectedCloser.vor_nachname,
          eventLink: gcalData.event?.htmlLink
        })
      }, 1500)
      
    } catch (err) {
      setError(err.message || 'Fehler beim Buchen des Termins')
    } finally {
      setBooking(false)
    }
  }

  // Nächste 7 Werktage generieren
  const getWeekDays = () => {
    const days = []
    const today = new Date()
    today.setDate(today.getDate() + (weekOffset * 7))
    
    let count = 0
    let offset = weekOffset === 0 ? 0 : 0
    
    while (days.length < 5) {
      const date = new Date(today)
      date.setDate(today.getDate() + count + offset)
      
      // Wochenende überspringen
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        // Nur zukünftige Tage (oder heute)
        const now = new Date()
        now.setHours(0, 0, 0, 0)
        if (date >= now || weekOffset > 0) {
          days.push({
            date: date.toISOString().split('T')[0],
            dayName: date.toLocaleDateString('de-DE', { weekday: 'short' }),
            dayNumber: date.getDate(),
            month: date.toLocaleDateString('de-DE', { month: 'short' })
          })
        }
      }
      count++
      if (count > 14) break // Safety
    }
    
    return days
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('de-DE', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    })
  }

  const weekDays = getWeekDays()

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Termin gebucht!</h3>
        <p className="text-gray-600">
          {formatDate(selectedDate)} um {selectedSlot.startTime} Uhr
          <br />mit {selectedCloser.vor_nachname}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Beratungsgespräch buchen</h3>
        <p className="text-sm text-gray-500">Für: {lead?.unternehmensname}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Closer Auswahl */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <User className="w-4 h-4 inline mr-1" />
          Closer auswählen
        </label>
        {loading ? (
          <div className="flex items-center text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Laden...
          </div>
        ) : closers.length === 0 ? (
          <p className="text-gray-500 text-sm">Keine Closer mit Kalender gefunden</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {closers.map(closer => (
              <button
                key={closer.id}
                onClick={() => setSelectedCloser(closer)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedCloser?.id === closer.id
                    ? 'border-sunside-primary bg-purple-50 text-sunside-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{closer.vor_nachname}</div>
                <div className="text-xs text-gray-500">{closer.email}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Kontaktdaten für den Termin */}
      {selectedCloser && (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Kontaktdaten für den Termin <span className="text-red-500">*</span>
          </label>
          
          {/* E-Mail und Telefon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                <Mail className="w-3 h-3 inline mr-1" />
                E-Mail <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="E-Mail für Terminbestätigung"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none ${
                  !contactEmail || !contactEmail.includes('@') 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-gray-300'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                <Phone className="w-3 h-3 inline mr-1" />
                Telefon <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Telefonnummer"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none ${
                  !contactPhone || contactPhone.length < 6
                    ? 'border-red-300 bg-red-50' 
                    : 'border-gray-300'
                }`}
              />
            </div>
          </div>

          {/* Unternehmensname */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Unternehmensname <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={unternehmensname}
              onChange={(e) => setUnternehmensname(e.target.value)}
              placeholder="Name des Unternehmens"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none ${
                !unternehmensname ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
          </div>

          {/* Makler oder Sachverständiger */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">
              Tätigkeit <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="taetigkeit"
                  value="Makler"
                  checked={taetigkeit === 'Makler'}
                  onChange={(e) => setTaetigkeit(e.target.value)}
                  className="w-4 h-4 text-sunside-primary border-gray-300 focus:ring-sunside-primary"
                />
                <span className="ml-2 text-sm text-gray-700">Makler</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="taetigkeit"
                  value="Sachverständiger"
                  checked={taetigkeit === 'Sachverständiger'}
                  onChange={(e) => setTaetigkeit(e.target.value)}
                  className="w-4 h-4 text-sunside-primary border-gray-300 focus:ring-sunside-primary"
                />
                <span className="ml-2 text-sm text-gray-700">Sachverständiger</span>
              </label>
            </div>
          </div>

          {/* Problemstellung & Ziele */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Problemstellung & Ziele <span className="text-red-500">*</span>
            </label>
            <textarea
              value={problemstellung}
              onChange={(e) => setProblemstellung(e.target.value)}
              placeholder="Was sind die Herausforderungen und Ziele des Kunden?"
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none resize-none ${
                !problemstellung ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
          </div>
        </div>
      )}

      {/* Datum Auswahl */}
      {selectedCloser && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              <Calendar className="w-4 h-4 inline mr-1" />
              Datum auswählen
            </label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                disabled={weekOffset === 0}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setWeekOffset(weekOffset + 1)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {weekDays.map(day => (
              <button
                key={day.date}
                onClick={() => setSelectedDate(day.date)}
                className={`p-3 rounded-lg border text-center transition-all ${
                  selectedDate === day.date
                    ? 'border-sunside-primary bg-purple-50 text-sunside-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-xs text-gray-500">{day.dayName}</div>
                <div className="text-lg font-semibold">{day.dayNumber}</div>
                <div className="text-xs text-gray-500">{day.month}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Zeit Auswahl */}
      {selectedDate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Clock className="w-4 h-4 inline mr-1" />
            Uhrzeit auswählen
          </label>
          {loadingSlots ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Verfügbare Zeiten laden...
            </div>
          ) : slots.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">
              Keine freien Termine an diesem Tag
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {slots.map(slot => (
                <button
                  key={slot.start}
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    selectedSlot?.start === slot.start
                      ? 'border-sunside-primary bg-purple-50 text-sunside-primary font-medium'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {slot.startTime}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Abbrechen
        </button>
        <button
          onClick={bookTermin}
          disabled={
            !selectedCloser || 
            !selectedSlot || 
            booking || 
            !contactEmail || 
            !contactEmail.includes('@') || 
            !contactPhone || 
            contactPhone.length < 6 ||
            !unternehmensname ||
            !problemstellung
          }
          className="px-6 py-2 bg-sunside-primary text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {booking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Wird gebucht...
            </>
          ) : (
            'Termin buchen'
          )}
        </button>
      </div>
    </div>
  )
}

export default TerminPicker
