import { useState, useEffect } from 'react'
import { Calendar, Clock, Loader2, Check, ChevronLeft, ChevronRight, Mail, Phone, Video, Users, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function TerminPicker({ lead, onTerminBooked, onCancel }) {
  const { user } = useAuth()
  
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
  const [validationErrors, setValidationErrors] = useState({})
  
  // Kontaktdaten
  const [contactEmail, setContactEmail] = useState(lead?.email || '')
  const [contactPhone, setContactPhone] = useState(lead?.telefon || '')
  const [ansprechpartnerVorname, setAnsprechpartnerVorname] = useState(lead?.ansprechpartnerVorname || '')
  const [ansprechpartnerNachname, setAnsprechpartnerNachname] = useState(lead?.ansprechpartnerNachname || '')
  const [unternehmensname, setUnternehmensname] = useState(lead?.unternehmensname || '')
  const [taetigkeit, setTaetigkeit] = useState('Makler')
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
    
    try {
      // Start: gewähltes Datum, End: gewähltes Datum + 1 Tag
      const startDate = new Date(selectedDate)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(selectedDate)
      endDate.setHours(23, 59, 59, 999)
      
      const response = await fetch(
        `/.netlify/functions/calendar?action=calendly-slots&eventTypeUri=${encodeURIComponent(eventType.uri)}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      )
      const data = await response.json()
      
      if (response.ok && data.success) {
        // Nur zukünftige Slots
        const now = new Date()
        const futureSlots = data.slots
          .filter(slot => new Date(slot.start) > now)
          .map(slot => {
            const startTime = new Date(slot.start)
            return {
              start: slot.start,
              startTime: startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
              inviteesRemaining: slot.inviteesRemaining
            }
          })
        setSlots(futureSlots)
        // Keine Fehlermeldung wenn keine Slots verfügbar - das ist normal (z.B. Montag geblockt)
      } else if (!response.ok) {
        // Nur bei echtem API-Fehler eine Meldung zeigen
        console.error('Calendly API Fehler:', data)
        setError('Fehler beim Laden der Termine')
      }
    } catch (err) {
      console.error('Slot-Loading Fehler:', err)
      setError('Fehler beim Laden der Termine')
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

      // Lead in Airtable aktualisieren (als Hot Lead markieren)
      if (lead?.id) {
        try {
          await fetch('/.netlify/functions/leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: lead.id,
              updates: {
                ergebnis: 'Beratungsgespräch',
                kontaktiert: true,
                datum: new Date().toISOString().split('T')[0],
                // Ansprechpartner aktualisieren falls geändert
                ansprechpartnerVorname: ansprechpartnerVorname,
                ansprechpartnerNachname: ansprechpartnerNachname
              }
            })
          })
        } catch (err) {
          console.error('Lead-Update fehlgeschlagen:', err)
        }
      }

      // Bei "An Closer vergeben": Email an alle Closer senden
      if (assignToPool) {
        try {
          await fetch('/.netlify/functions/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'notify-closers',
              termin: {
                datum: new Date(selectedSlot.start).toLocaleDateString('de-DE', { 
                  weekday: 'long', 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                art: selectedType === 'video' ? 'Video (Google Meet)' : 'Telefonisch',
                unternehmen: unternehmensname,
                ansprechpartner: ansprechpartnerName,
                setter: user?.vor_nachname
              }
            })
          })
        } catch (err) {
          console.error('Closer-Benachrichtigung fehlgeschlagen:', err)
          // Kein harter Fehler - Termin wurde trotzdem gebucht
        }
      }

      setSuccess(true)
      
      // Auto-close nach 1.5s
      setTimeout(() => {
        if (onTerminBooked) {
          onTerminBooked({
            slot: selectedSlot,
            type: selectedType,
            assignedToPool: assignToPool
          })
        }
      }, 1500)

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
        <p className="text-gray-500">Der Termin wurde erfolgreich in Calendly erstellt.</p>
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
            onClick={() => { setSelectedType('video'); setSelectedDate(null); setSelectedSlot(null); setSlots([]) }}
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
            onClick={() => { setSelectedType('phone'); setSelectedDate(null); setSelectedSlot(null); setSlots([]) }}
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
            <span className="text-sm text-gray-600">
              {weekOffset === 0 ? 'Diese Woche' : weekOffset === 1 ? 'Nächste Woche' : `In ${weekOffset} Wochen`}
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
              const dateStr = day.toISOString().split('T')[0]
              const past = isPast(day)
              const today = isToday(day)
              const selected = selectedDate === dateStr
              
              return (
                <button
                  key={idx}
                  onClick={() => { setSelectedDate(dateStr); setSelectedSlot(null) }}
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
                onClick={() => setTaetigkeit('Makler')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  taetigkeit === 'Makler'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Makler
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
            Termin: <strong>{new Date(selectedSlot.start).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })}</strong> um <strong>{selectedSlot.startTime} Uhr</strong>
            {selectedType === 'video' ? ' (Video)' : ' (Telefon)'}
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* An Closer vergeben - für alle */}
            <button
              onClick={() => bookTermin(true)}
              disabled={booking}
              className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
            
            {/* Selbst übernehmen - nur für Closer */}
            {canSelfClose ? (
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
            ) : (
              <button
                disabled
                className="flex items-center justify-center px-4 py-3 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed"
                title="Nur für Closer verfügbar"
              >
                <User className="w-5 h-5 mr-2" />
                Selbst übernehmen
              </button>
            )}
          </div>
          
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
