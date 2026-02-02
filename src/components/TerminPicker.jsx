import { useState, useEffect } from 'react'
import { Calendar, Clock, Loader2, Check, ChevronLeft, ChevronRight, Mail, Phone, Video, Users, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Helper: Lokales Datum als YYYY-MM-DD (ohne UTC-Konvertierung)
const toLocalDateString = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function TerminPicker({ lead, hotLeadId, onTerminBooked, onCancel }) {
  const { user } = useAuth()
  
  // Modus: Neuer Termin oder Neu-Terminierung eines bestehenden Hot Leads
  const isReschedule = !!hotLeadId
  
  // Calendly Event Types
  const [eventTypes, setEventTypes] = useState([])
  const [selectedType, setSelectedType] = useState(null) // 'video' oder 'phone'
  
  // Datum & Slots
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [slots, setSlots] = useState([])
  const [weekOffset, setWeekOffset] = useState(0)
  
  // Loading States
  const [loading, setLoading] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [booking, setBooking] = useState(false)
  
  // Status
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [bookedMeetingLink, setBookedMeetingLink] = useState(null)  // Video-Link nach Buchung
  const [validationErrors, setValidationErrors] = useState({})
  
  // Kontaktdaten
  const [contactEmail, setContactEmail] = useState(lead?.email || '')
  const [contactPhone, setContactPhone] = useState(lead?.telefon || '')
  const [ansprechpartnerVorname, setAnsprechpartnerVorname] = useState(lead?.ansprechpartnerVorname || '')
  const [ansprechpartnerNachname, setAnsprechpartnerNachname] = useState(lead?.ansprechpartnerNachname || '')
  const [unternehmensname, setUnternehmensname] = useState(lead?.unternehmensname || lead?.unternehmen || '')
  const [taetigkeit, setTaetigkeit] = useState('Immobilienmakler')
  const [problemstellung, setProblemstellung] = useState('')

  // Prüfen ob User selbst Closer sein kann
  const userRoles = user?.rolle || []
  const canSelfClose = userRoles.some(r => 
    r.toLowerCase() === 'closer' || 
    r.toLowerCase() === 'admin' ||
    r.toLowerCase() === 'coldcaller + closer'
  )

  // Calendly Event Types laden
  useEffect(() => {
    loadEventTypes()
  }, [])

  // Kontaktdaten aktualisieren wenn lead sich ändert (z.B. bei Reschedule)
  useEffect(() => {
    if (lead) {
      setContactEmail(lead.email || '')
      setContactPhone(lead.telefon || '')
      setAnsprechpartnerVorname(lead.ansprechpartnerVorname || '')
      setAnsprechpartnerNachname(lead.ansprechpartnerNachname || '')
      setUnternehmensname(lead.unternehmensname || lead.unternehmen || '')
    }
  }, [lead])

  // Slots laden wenn Typ und Datum gewählt
  useEffect(() => {
    if (selectedType && selectedDate) {
      loadSlots()
    }
  }, [selectedType, selectedDate])

  const loadEventTypes = async () => {
    setLoading(true)
    try {
      const response = await fetch('/.netlify/functions/calendar?action=calendly-event-types')
      const data = await response.json()
      
      if (response.ok && data.success) {
        setEventTypes(data.eventTypes)
      } else {
        setError('Fehler beim Laden der Terminarten')
      }
    } catch (err) {
      setError('Fehler beim Laden der Terminarten')
    } finally {
      setLoading(false)
    }
  }

  const loadSlots = async () => {
    if (!selectedType || !selectedDate) return
    
    // Event Type URI finden
    const eventType = eventTypes.find(et => et.type === selectedType)
    if (!eventType) {
      setError('Event Type nicht gefunden')
      return
    }
    
    setLoadingSlots(true)
    setSlots([])
    setSelectedSlot(null)
    setError('') // Error zurücksetzen bei neuem Laden
    
    try {
      // Datum als reinen String senden (YYYY-MM-DD) - Backend wendet deutsche Zeitzone an
      // So ist es unabhängig von der Browser-Zeitzone des Vertrieblers
      const response = await fetch(
        `/.netlify/functions/calendar?action=calendly-slots&eventTypeUri=${encodeURIComponent(eventType.uri)}&dateString=${selectedDate}`
      )
      const data = await response.json()
      
      if (response.ok) {
        // Erfolgreiche Antwort - auch wenn keine Slots verfügbar sind
        const availableSlots = data.slots || []
        
        // Nur zukünftige Slots filtern (Vergleich in UTC)
        const now = new Date()
        const futureSlots = availableSlots
          .filter(slot => new Date(slot.start) > now)
          .map(slot => {
            // Zeiten immer in deutscher Zeitzone anzeigen
            const startTime = new Date(slot.start)
            return {
              start: slot.start,
              startTime: startTime.toLocaleTimeString('de-DE', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'Europe/Berlin'  // Immer deutsche Zeit anzeigen
              }),
              inviteesRemaining: slot.inviteesRemaining
            }
          })
        setSlots(futureSlots)
        // Keine Fehlermeldung wenn keine Slots - das ist normal (z.B. Montag geblockt)
      } else {
        // Nur bei echtem API-Fehler (4xx, 5xx) eine Meldung zeigen
        console.error('Calendly API Fehler:', response.status, data)
        setError('Fehler beim Laden der Termine')
      }
    } catch (err) {
      console.error('Slot-Loading Fehler:', err)
      setError('Verbindungsfehler beim Laden der Termine')
    } finally {
      setLoadingSlots(false)
    }
  }

  const bookTermin = async (assignToPool) => {
    // Validierung mit visuellen Errors
    const errors = {}
    
    if (!ansprechpartnerVorname || !ansprechpartnerNachname) {
      errors.ansprechpartner = true
    }
    if (!contactEmail || !contactEmail.includes('@')) {
      errors.email = true
    }
    if (!contactPhone || contactPhone.length < 6) {
      errors.telefon = true
    }
    if (!unternehmensname) {
      errors.unternehmen = true
    }
    if (!problemstellung) {
      errors.problemstellung = true
    }
    if (!selectedSlot) {
      errors.slot = true
    }
    
    setValidationErrors(errors)
    
    if (Object.keys(errors).length > 0) {
      setError('Bitte alle Pflichtfelder ausfüllen')
      return
    }
    
    setBooking(true)
    setError('')
    
    const ansprechpartnerName = `${ansprechpartnerVorname} ${ansprechpartnerNachname}`.trim()
    const eventType = eventTypes.find(et => et.type === selectedType)
    
    try {
      // Calendly Termin erstellen
      const calendlyResponse = await fetch('/.netlify/functions/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calendly-book',
          eventTypeUri: eventType.uri,
          startTime: selectedSlot.start,
          inviteeName: ansprechpartnerName,
          inviteeEmail: contactEmail,
          inviteePhone: contactPhone,
          leadInfo: {
            ansprechpartner: ansprechpartnerName,
            firma: unternehmensname,
            stadt: lead?.stadt,
            telefon: contactPhone,
            kategorie: lead?.kategorie,
            taetigkeit: taetigkeit,
            problemstellung: problemstellung,
            terminart: selectedType,
            // Closer-Info
            assignToPool: assignToPool,
            closerName: assignToPool ? null : user?.vor_nachname,
            closerEmail: assignToPool ? null : (user?.email_geschaeftlich || user?.email),
            setterName: user?.vor_nachname,
            setterEmail: user?.email_geschaeftlich || user?.email
          }
        })
      })
      
      const calendlyData = await calendlyResponse.json()
      
      if (!calendlyResponse.ok || !calendlyData.success) {
        throw new Error(calendlyData.error || calendlyData.details || 'Calendly Buchung fehlgeschlagen')
      }

      // Meeting-Link für Video-Termine extrahieren
      const meetingLink = calendlyData.meetingLink || null
      console.log('Meeting-Link:', meetingLink)

      // Hot Lead in Airtable erstellen oder aktualisieren
      if (isReschedule && hotLeadId) {
        // Bestehenden Hot Lead aktualisieren (Neu-Terminierung)
        try {
          const updateResponse = await fetch('/.netlify/functions/hot-leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              hotLeadId: hotLeadId,
              updates: {
                terminDatum: selectedSlot.start,
                status: 'Lead', // Status zurücksetzen
                terminart: selectedType === 'video' ? 'Video' : 'Telefonisch',
                meetingLink: meetingLink  // Video-Link speichern
              }
            })
          })
          
          const updateData = await updateResponse.json()
          if (!updateResponse.ok) {
            console.error('Hot Lead Update fehlgeschlagen:', updateData)
          } else {
            console.log('Hot Lead aktualisiert:', hotLeadId)
          }
          
          // Kommentar im Original-Lead hinzufügen
          if (lead?.id) {
            const terminDatum = new Date(selectedSlot.start).toLocaleDateString('de-DE', {
              weekday: 'long',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Europe/Berlin'  // Immer deutsche Zeit
            })
            const terminTyp = selectedType === 'video' ? 'Video' : 'Telefonisch'
            const terminDetails = `Neuer Termin gebucht (nach Absage): ${terminDatum} Uhr (${terminTyp}) - ${problemstellung}`
            
            await fetch('/.netlify/functions/leads', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: lead.id,
                historyEntry: {
                  action: 'termin',
                  details: terminDetails,
                  userName: user?.vor_nachname || 'System'
                }
              })
            })
          }
        } catch (err) {
          console.error('Hot Lead Update fehlgeschlagen:', err)
        }
      }

      // Variable um Hot Lead ID für Closer-Benachrichtigung zu speichern
      let createdHotLeadId = null

      if (lead?.id && !isReschedule) {
        // Neuen Hot Lead erstellen
        try {
          const hotLeadResponse = await fetch('/.netlify/functions/hot-leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              originalLeadId: lead.id,
              setterName: user?.vor_nachname,
              closerName: assignToPool ? null : user?.vor_nachname, // Leer = Pool
              unternehmen: unternehmensname,
              terminDatum: selectedSlot.start,
              terminart: selectedType === 'video' ? 'Video' : 'Telefonisch',
              quelle: 'Cold Calling',
              infosErstgespraech: problemstellung,
              meetingLink: meetingLink  // Video-Link speichern
            })
          })

          const hotLeadData = await hotLeadResponse.json()
          if (!hotLeadResponse.ok) {
            // Duplikat-Prüfung: 409 = Hot Lead existiert bereits
            if (hotLeadResponse.status === 409) {
              setError('Für diesen Lead wurde bereits ein Beratungsgespräch gebucht. Bitte wähle einen anderen Lead.')
              setBooking(false)
              return
            }
            console.error('Hot Lead Erstellung fehlgeschlagen:', hotLeadData)
          } else {
            console.log('Hot Lead erstellt:', hotLeadData.hotLeadId)
            createdHotLeadId = hotLeadData.hotLeadId
          }
        } catch (err) {
          console.error('Hot Lead Erstellung fehlgeschlagen:', err)
        }

        // Original-Lead aktualisieren
        try {
          // Formatierter Termin-Text - immer deutsche Zeit
          const terminDatum = new Date(selectedSlot.start).toLocaleDateString('de-DE', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Berlin'  // Immer deutsche Zeit
          })
          const terminTyp = selectedType === 'video' ? 'Video' : 'Telefonisch'
          const terminDetails = `Termin gebucht: ${terminDatum} Uhr (${terminTyp}) - ${problemstellung}`
          
          // Prüfen ob Lead bereits kontaktiert war
          const warBereitsKontaktiert = lead?.kontaktiert === true
          
          // 1. Updates + ggf. "Als kontaktiert markiert" History-Eintrag
          const requestBody = {
            id: lead.id,
            updates: {
              ergebnis: 'Beratungsgespräch',
              kontaktiert: true,
              datum: toLocalDateString(new Date()),
              ansprechpartnerVorname: ansprechpartnerVorname,
              ansprechpartnerNachname: ansprechpartnerNachname,
              kategorie: taetigkeit  // Immobilienmakler oder Sachverständiger
            }
          }
          
          // Nur History-Eintrag wenn noch nicht kontaktiert
          if (!warBereitsKontaktiert) {
            requestBody.historyEntry = {
              action: 'kontaktiert',
              details: 'Als kontaktiert markiert',
              userName: user?.vor_nachname || 'System'
            }
          }
          
          await fetch('/.netlify/functions/leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          })
          
          // 2. Ergebnis-Eintrag
          await fetch('/.netlify/functions/leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: lead.id,
              historyEntry: {
                action: 'ergebnis',
                details: 'Ergebnis: Beratungsgespräch',
                userName: user?.vor_nachname || 'System'
              }
            })
          })
          
          // 3. Dann Termin-Details als separater History-Eintrag
          await fetch('/.netlify/functions/leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: lead.id,
              historyEntry: {
                action: 'termin',
                details: terminDetails,
                userName: user?.vor_nachname || 'System'
              }
            })
          })
        } catch (err) {
          console.error('Lead-Update fehlgeschlagen:', err)
        }
      }

      // Bei "An Closer vergeben": Benachrichtigung an alle Closer senden (Email + In-App)
      if (assignToPool && !isReschedule) {
        try {
          await fetch('/.netlify/functions/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'notify-closers',
              hotLeadId: createdHotLeadId,  // Hot Lead ID für System Message Verknüpfung
              termin: {
                datum: new Date(selectedSlot.start).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Europe/Berlin'  // Immer deutsche Zeit
                }),
                art: selectedType === 'video' ? 'Video (Google Meet)' : 'Telefonisch',
                unternehmen: unternehmensname,
                ansprechpartner: ansprechpartnerName,
                setter: user?.vor_nachname,
                meetingLink: meetingLink  // Video-Link für Closer
              }
            })
          })
          console.log('Closer-Benachrichtigungen gesendet (Email + In-App)')
        } catch (err) {
          console.error('Closer-Benachrichtigung fehlgeschlagen:', err)
          // Kein harter Fehler - Termin wurde trotzdem gebucht
        }
      }

      // Meeting-Link speichern für Anzeige
      if (meetingLink && selectedType === 'video') {
        setBookedMeetingLink(meetingLink)
      }
      
      setSuccess(true)
      
      // Auto-close nach 3s (länger wenn Video-Link vorhanden, damit User ihn kopieren kann)
      setTimeout(() => {
        if (onTerminBooked) {
          onTerminBooked({
            slot: selectedSlot,
            type: selectedType,
            assignedToPool: assignToPool,
            meetingLink: meetingLink
          })
        }
      }, meetingLink ? 5000 : 1500)

    } catch (err) {
      console.error('Buchungsfehler:', err)
      setError(err.message || 'Fehler bei der Terminbuchung')
    } finally {
      setBooking(false)
    }
  }

  // Wochentage berechnen
  const getWeekDays = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Start bei Montag dieser Woche + offset
    const monday = new Date(today)
    const dayOfWeek = monday.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    monday.setDate(monday.getDate() + diff + (weekOffset * 7))
    
    const days = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday)
      day.setDate(monday.getDate() + i)
      days.push(day)
    }
    return days
  }

  // Wochenbereich formatieren (z.B. "01. Februar - 07. Februar")
  const getWeekRange = () => {
    const days = getWeekDays()
    const monday = days[0]
    const sunday = days[6]
    
    const formatDay = (date) => {
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })
    }
    
    // Wenn gleicher Monat, nur einmal den Monat anzeigen
    if (monday.getMonth() === sunday.getMonth()) {
      return `${monday.getDate()}. - ${formatDay(sunday)}`
    }
    
    return `${formatDay(monday)} - ${formatDay(sunday)}`
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
  }

  const isToday = (date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isPast = (date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  // Success Screen
  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Termin gebucht!</h3>
        <p className="text-gray-500 mb-4">Der Termin wurde erfolgreich in Calendly erstellt.</p>
        
        {/* Video-Link anzeigen wenn vorhanden */}
        {bookedMeetingLink && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-800 mb-2">
              📹 Video-Einwahllink:
            </p>
            <div className="flex items-center gap-2 justify-center">
              <a 
                href={bookedMeetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline text-sm break-all"
              >
                {bookedMeetingLink}
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(bookedMeetingLink)
                  // Kurzes visuelles Feedback
                  const btn = document.activeElement
                  if (btn) {
                    btn.textContent = '✓'
                    setTimeout(() => { btn.textContent = '📋' }, 1000)
                  }
                }}
                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                title="Link kopieren"
              >
                📋
              </button>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Link wird automatisch in der Closing-Seite gespeichert
            </p>
          </div>
        )}
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Terminart wählen */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          1. Terminart wählen
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setSelectedType('video'); setSelectedDate(null); setSelectedSlot(null); setSlots([]); setError('') }}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedType === 'video'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Video className={`w-6 h-6 mx-auto mb-2 ${selectedType === 'video' ? 'text-purple-600' : 'text-gray-400'}`} />
            <p className={`font-medium ${selectedType === 'video' ? 'text-purple-700' : 'text-gray-700'}`}>Video</p>
            <p className="text-xs text-gray-500">Google Meet</p>
          </button>
          
          <button
            onClick={() => { setSelectedType('phone'); setSelectedDate(null); setSelectedSlot(null); setSlots([]); setError('') }}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedType === 'phone'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Phone className={`w-6 h-6 mx-auto mb-2 ${selectedType === 'phone' ? 'text-purple-600' : 'text-gray-400'}`} />
            <p className={`font-medium ${selectedType === 'phone' ? 'text-purple-700' : 'text-gray-700'}`}>Telefonisch</p>
            <p className="text-xs text-gray-500">Anruf</p>
          </button>
        </div>
      </div>

      {/* Step 2: Datum wählen */}
      {selectedType && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            2. Datum wählen
          </label>
          
          {/* Wochennavigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              disabled={weekOffset <= 0}
              className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-gray-700">
              {getWeekRange()}
            </span>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              disabled={weekOffset >= 8}
              className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Tage */}
          <div className="grid grid-cols-7 gap-1">
            {getWeekDays().map((day, idx) => {
              const dateStr = toLocalDateString(day)
              const past = isPast(day)
              const today = isToday(day)
              const selected = selectedDate === dateStr
              
              return (
                <button
                  key={idx}
                  onClick={() => { setSelectedDate(dateStr); setSelectedSlot(null); setError('') }}
                  disabled={past}
                  className={`p-2 rounded-lg text-center transition-all ${
                    selected
                      ? 'bg-purple-600 text-white'
                      : past
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : today
                          ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                          : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-xs font-medium">
                    {day.toLocaleDateString('de-DE', { weekday: 'short' })}
                  </div>
                  <div className="text-lg font-semibold">
                    {day.getDate()}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 3: Uhrzeit wählen */}
      {selectedDate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            3. Uhrzeit wählen
          </label>
          
          {loadingSlots ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <span className="ml-2 text-gray-500">Lade verfügbare Termine...</span>
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              Keine verfügbaren Termine an diesem Tag
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {slots.map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-2 rounded-lg text-sm font-medium transition-all ${
                    selectedSlot?.start === slot.start
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {slot.startTime}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Kontaktdaten */}
      {selectedSlot && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="font-medium text-gray-900">4. Kontaktdaten des Maklers</h4>
          
          {/* Ansprechpartner */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Vorname *</label>
              <input
                type="text"
                value={ansprechpartnerVorname}
                onChange={(e) => setAnsprechpartnerVorname(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Vorname"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nachname *</label>
              <input
                type="text"
                value={ansprechpartnerNachname}
                onChange={(e) => setAnsprechpartnerNachname(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nachname"
              />
            </div>
          </div>

          {/* Unternehmen */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Unternehmen *</label>
            <input
              type="text"
              value={unternehmensname}
              onChange={(e) => setUnternehmensname(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Firmenname"
            />
          </div>

          {/* Email & Telefon */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">E-Mail *</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="email@beispiel.de"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Telefon *</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="+49 123 456789"
              />
            </div>
          </div>

          {/* Tätigkeit */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tätigkeit</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTaetigkeit('Immobilienmakler')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  taetigkeit === 'Immobilienmakler'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Immobilienmakler
              </button>
              <button
                onClick={() => setTaetigkeit('Sachverständiger')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  taetigkeit === 'Sachverständiger'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Sachverständiger
              </button>
            </div>
          </div>

          {/* Problemstellung */}
          <div>
            <label className={`block text-xs mb-1 ${validationErrors.problemstellung ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
              Problemstellung & Ziele *
            </label>
            <textarea
              value={problemstellung}
              onChange={(e) => {
                setProblemstellung(e.target.value)
                if (validationErrors.problemstellung) {
                  setValidationErrors(prev => ({ ...prev, problemstellung: false }))
                }
              }}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none ${
                validationErrors.problemstellung ? 'border-red-500 bg-red-50' : ''
              }`}
              placeholder="Was sind die Herausforderungen und Ziele des Maklers?"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      {selectedSlot && (
        <div className="border-t pt-4 space-y-3">
          <p className="text-sm text-gray-600 text-center">
            Termin: <strong>{new Date(selectedSlot.start).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })}</strong> um <strong>{selectedSlot.startTime} Uhr</strong>
            {selectedType === 'video' ? ' (Video)' : ' (Telefon)'}
          </p>
          
          {isReschedule ? (
            /* Bei Neu-Terminierung: Nur ein Button */
            <button
              onClick={() => bookTermin(false)}
              disabled={booking}
              className="w-full flex items-center justify-center px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {booking ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Calendar className="w-5 h-5 mr-2" />
                  Neuen Termin buchen
                </>
              )}
            </button>
          ) : (
            /* Normale Buchung: Zwei Buttons */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* An Closer vergeben - für alle */}
              <button
                onClick={() => bookTermin(true)}
                disabled={booking}
                className={`flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors ${!canSelfClose ? 'col-span-2' : ''}`}
              >
                {booking ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Users className="w-5 h-5 mr-2" />
                    An Closer vergeben
                  </>
                )}
              </button>
              
              {/* Selbst übernehmen - nur für Closer sichtbar */}
              {canSelfClose && (
                <button
                  onClick={() => bookTermin(false)}
                  disabled={booking}
                  className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {booking ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <User className="w-5 h-5 mr-2" />
                      Ich übernehme das Closing
                    </>
                  )}
                </button>
              )}
            </div>
          )}
          
          <button
            onClick={onCancel}
            className="w-full py-2 text-gray-600 hover:text-gray-800"
          >
            Abbrechen
          </button>
        </div>
      )}

      {/* Abbrechen wenn noch kein Slot gewählt */}
      {!selectedSlot && (
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Abbrechen
          </button>
        </div>
      )}
    </div>
  )
}

export default TerminPicker
