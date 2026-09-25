import { STATUS } from '../../shared/status.js'
import { UEBERGABE_1, uebergabePruefen, zielAbleiten, BRANCHE } from '../../shared/felder.js'
import { istSetter, istCloser, istLeitung } from '../../shared/rollen.js'
import UebergabeFelder from './UebergabeFelder'
import { useState, useEffect, useRef } from 'react'
import { Calendar, Clock, Loader2, Check, ChevronLeft, ChevronRight, Mail, Phone, Video, Users, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Helper: Lokales Datum als YYYY-MM-DD (ohne UTC-Konvertierung)
const toLocalDateString = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// `zweck` sagt, wofuer gebucht wird: 'beratung' oder 'abschluss'. Ohne
// Angabe verhaelt sich der Waehler wie vorher und zeigt alle Terminarten.
//
// Das ist keine Bequemlichkeit. Die Terminart wurde bisher allein ueber
// 'video' oder 'phone' gesucht - sobald es mehr als einen Zweck gibt, trifft
// diese Suche je nach Reihenfolge der Calendly-Antwort die falsche, und ein
// Beratungsgespraech landet still im Abschluss-Kalender.
// `nurBuchen` gibt den Termin nach der Calendly-Buchung an den Aufrufer
// zurueck, statt den Hot Lead selbst zu schreiben. Das braucht die Uebergabe
// an den Closer: Dort muessen Termin UND die zwoelf Felder in EINEM Zug zum
// Server, sonst laeuft das Gate ins Leere und der Kontakt bleibt halb
// geschrieben zurueck.
// Die Art des Gesprächs steht nicht zur Wahl: Das Beratungsgespräch führt der
// Setter am Telefon, das Abschlussgespräch der Closer per Video (Mailstrecken
// Teil E: „das Closing läuft per Video, das Setting per Telefon"). Einem Zweck
// können mehrere Calendly-Terminarten zugeordnet sein, weil der Webhook auch
// Direktbuchungen einsortieren muss; hier steht, welche davon gebucht wird.
const ART_JE_ZWECK = { beratung: 'phone', abschluss: 'video' }

// `zusatz` sind Felder, die der Aufrufer in den Terminwähler hängt (im Setting
// die Angaben aus dem Beratungsgespräch). `vorPruefung` läuft davor und gibt
// eine Meldung zurück, wenn etwas fehlt: Gebucht wird erst, wenn alles steht,
// sonst entsteht ein Termin im Kalender des Kunden, zu dem es im CRM nichts
// gibt.
function TerminPicker({ lead, hotLeadId, onTerminBooked, onCancel, zweck = null, nurBuchen = false,
                        zusatz = null, vorPruefung = null, knopfText = null }) {
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
  // Taetigkeit und Problemstellung wurden hier frueher eigens abgefragt -
  // und weiter unten in der Uebergabe an den Setter noch einmal, als
  // Berufsgruppe, Ziel und Schmerzpunkt. Zweimal dieselbe Frage, zwei
  // Antworten, die auseinanderlaufen koennen. Die Uebergabe gewinnt: Sie ist
  // praeziser (drei Werte statt zwei, Ziel und Schmerzpunkt getrennt) und
  // steuert Mail, Video und SMS. Hier wird nur noch abgeleitet.
  // Übergabe 1: was der Opener im Erstanruf aufnimmt. Ohne diese Angaben
  // nimmt das Backend die Buchung nicht an - sie steuern Mail, Video und SMS.
  const [uebergabe1, setUebergabe1] = useState({
    mobilnummer: lead?.telefon || ''
  })
  const [uebergabeOffen, setUebergabeOffen] = useState([])
  // Fehler beim Buchen stehen beim Knopf, nicht ganz oben: Wer unten auf
  // "Termin buchen" drueckt, sieht eine Meldung am Kopf der Maske nicht -
  // genau das stand im Testbericht.
  const [buchFehler, setBuchFehler] = useState('')
  const fehlerRef = useRef(null)

  // Der Hinweis nuetzt nichts, wenn er unter dem Bildrand steht: Nach einem
  // Fehlversuch holt die Maske ihn in den Blick.
  useEffect(() => {
    if (buchFehler) fehlerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [buchFehler])

  // 'Makler' heisst in der Lead-Kategorie seit jeher 'Immobilienmakler'.
  const taetigkeit = uebergabe1.berufsgruppe === BRANCHE.SV
    ? 'Sachverständiger'
    : uebergabe1.berufsgruppe === BRANCHE.ANDERE
      ? (uebergabe1.branche_andere?.trim() || 'Sonstige')
      : 'Immobilienmakler'

  // Die Mehrfachauswahl des Openers ergibt das Arbeits-Ziel, das Mail, Video
  // und Zahlenblock steuert. Abgeleitet wird an einer Stelle, in felder.js.
  const zielStand = zielAbleiten(uebergabe1)

  // Was frueher in einem Freitextfeld stand, steht jetzt in zwei Feldern.
  // Zusammengesetzt ergibt es denselben Satz fuer Kommentar und Calendly.
  const problemstellung = [
    (uebergabe1.ziele || []).length > 0 && `Ziel: ${(zielStand.ziel ? [zielStand.ziel] : uebergabe1.ziele).join(', ')}`,
    uebergabe1.schmerzpunkt_wortlaut && `„${uebergabe1.schmerzpunkt_wortlaut}"`
  ].filter(Boolean).join('. ')

  // Prüfen ob User selbst Closer sein kann
  const userRoles = user?.rolle || []

  // Wer den Termin legt, ist im neuen Prozess der Opener - nicht automatisch
  // auch der Setter. Nur wer die Setter-Rolle trägt, kann das Gespräch selbst
  // übernehmen; sonst geht es in den Setter-Pool.
  // Beim Beratungsgespräch braucht es die Setter-Rolle, beim
  // Abschlussgespräch die des Closers. Wer beides in einer Person ist, soll
  // den Termin, den er gerade selbst legt, auch selbst halten dürfen - wer
  // die Rolle nicht hat, sieht die Frage gar nicht erst, und der Server
  // weist sie zusätzlich ab.
  const fuerAbschluss = zweck === 'abschluss'
  const kannSelbstHalten = fuerAbschluss
    ? (istCloser(userRoles) || istLeitung(userRoles))
    : (istSetter(userRoles) || istLeitung(userRoles))
  const kannSelbstSetten = kannSelbstHalten
  const [setzeSelbst, setSetzeSelbst] = useState(false)

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
        let arten = data.eventTypes || []

        // Auf den Zweck einschraenken, sofern zugeordnet ist. Ist fuer diesen
        // Zweck nichts zugeordnet, bleibt es bei allen - sonst haette eine
        // fehlende Einstellung zur Folge, dass gar nichts buchbar ist.
        if (zweck) {
          try {
            const e = await fetch('/.netlify/functions/einstellungen').then(r => r.json())
            const karte = JSON.parse(e?.einstellungen?.calendly_terminart_zuordnung?.wert || '{}')
            const passend = arten.filter(a => karte[a.uri] === zweck)
            if (passend.length) arten = passend
          } catch {
            // Zuordnung nicht lesbar: lieber alle zeigen als nichts.
          }
        }

        // Bleiben mehrere übrig, entscheidet die Art des Gesprächs. Gibt es
        // die erwartete Art nicht (umbenannt, gelöscht), bleibt die Auswahl
        // stehen: lieber einmal fragen als gar nicht buchen können.
        if (zweck && arten.length > 1 && ART_JE_ZWECK[zweck]) {
          const bevorzugt = arten.filter(a => a.type === ART_JE_ZWECK[zweck])
          if (bevorzugt.length) arten = bevorzugt
        }

        setEventTypes(arten)

        // Bleibt nach dem Einschraenken genau eine Terminart uebrig, gibt es
        // nichts zu waehlen: Sie wird gesetzt, Schritt 1 entfaellt.
        //
        // Das ist der ganze Mechanismus hinter "Setting nur telefonisch":
        // Dem Zweck 'beratung' ist nur die Telefon-Terminart zugeordnet, also
        // sieht der Opener direkt den Kalender. Beim Abschlussgespraech gilt
        // dasselbe - dort ist es die Video-Terminart. Wer die Zuordnung
        // aendert, aendert damit auch die Auswahl; im Code steht keine Regel,
        // die man zusaetzlich nachziehen muesste.
        if (arten.length === 1) {
          setSelectedType(arten[0].type)
        }
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

  // Kein `assignToPool` mehr. Im alten Modell buchte der Coldcaller und
  // entschied dabei, ob er das Closing selbst uebernimmt - der Closer stand
  // also schon vor dem ersten Gespraech fest.
  //
  // Im OSC-Prozess gibt es an dieser Stelle gar keine Closer-Entscheidung:
  // Das Beratungsgespraech haelt der SETTER, und der Closer wird erst nach
  // dessen Uebergabe aus dem Closer-Pool besetzt. Wer hier einen Closer
  // eintraegt, ueberspringt Pool, Bewerbung und Uebergabe 2.
  //
  // Bleibt eine Frage: Haelt der Buchende das Gespraech selbst (wenn er die
  // Setter-Rolle hat), oder geht es in den Setter-Pool? Die beantwortet das
  // Haekchen darueber.
  const bookTermin = async () => {
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
    if (!selectedSlot) {
      errors.slot = true
    }
    
    setValidationErrors(errors)
    
    if (Object.keys(errors).length > 0) {
      setBuchFehler('Bitte alle Pflichtfelder ausfüllen')
      return
    }

    // Was der Aufrufer zusätzlich verlangt, ebenfalls vor der Buchung.
    if (vorPruefung) {
      const meldung = vorPruefung()
      if (meldung) { setBuchFehler(meldung); return }
    }

    // Die Uebergabe wird hier geprueft, VOR der Buchung.
    //
    // Vorher stand hier, das Backend weise die Buchung ohne diese Felder ab -
    // das tut es auch, nur eben nachdem Calendly den Termin schon angelegt
    // hat. Im Test entstand so ein Termin im Kalender des Kunden, zu dem es
    // im CRM keinen Kontakt gibt, und der Opener sah nur "Buchung
    // fehlgeschlagen". Ein Termin, den niemand kennt, ist schlimmer als eine
    // Fehlermeldung.
    if (!isReschedule && !nurBuchen) {
      const pruefung = uebergabePruefen(uebergabe1, UEBERGABE_1)
      if (!pruefung.vollstaendig) {
        setUebergabeOffen(pruefung.offen)
        setBuchFehler('Zum Buchen fehlen noch Angaben aus dem Erstanruf: '
          + pruefung.offen.map(o => o.name).join(', '))
        return
      }
      setUebergabeOffen([])
    }
    
    setBooking(true)
    setBuchFehler('')
    
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
            // Der Closer steht hier noch nicht fest - er kommt nach der
            // Uebergabe des Setters aus dem Closer-Pool.
            assignToPool: true,
            closerName: null,
            closerEmail: null,
            setterName: (kannSelbstSetten && setzeSelbst) ? user?.vor_nachname : null,
            openerName: user?.vor_nachname,
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

      // Der Aufrufer schreibt selbst: Termin zurueckgeben und hier aufhoeren.
      if (nurBuchen) {
        onTerminBooked?.({
          start: selectedSlot.start,
          meetingLink,
          terminart: selectedType === 'video' ? 'Video' : 'Telefonisch',
          // Der Aufrufer schreibt selbst - er braucht die Antwort mit.
          selbstHalten: Boolean(kannSelbstHalten && setzeSelbst)
        })
        setBooking(false)
        return
      }

      // Hot Lead in Airtable erstellen oder aktualisieren
      if (isReschedule && hotLeadId) {
        // Bestehenden Hot Lead aktualisieren (Neu-Terminierung)
        try {
          const updateResponse = await fetch('/.netlify/functions/hot-leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              hotLeadId: hotLeadId,
              // Welcher Termin neu gelegt wird, sagt der Zweck. Vorher schrieb
              // dieser Pfad immer das Beratungsgespraech - ein neu gelegtes
              // Abschlussgespraech haette den Termin der Stufe davor
              // ueberschrieben und den Kontakt eine Stufe zurueckgeworfen.
              updates: zweck === 'abschluss'
                ? {
                    termin_abschlussgespraech: selectedSlot.start,
                    meeting_link_abschluss: meetingLink || null,
                    status: STATUS.ABSCHLUSS_VEREINBART
                  }
                : {
                    terminDatum: selectedSlot.start,
                    status: STATUS.BERATUNG_VEREINBART, // Termin neu gelegt
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
              // Leer = geht in den Setter-Pool. Wer bucht, ist der Opener;
              // Setter wird man nur, wenn man die Rolle hat und es ausdrücklich
              // will - sonst füllte sich der Pool nie.
              setterName: (kannSelbstSetten && setzeSelbst) ? user?.vor_nachname : null,
              openerName: user?.vor_nachname,
              closerName: null, // Der Closer wird erst nach Uebergabe 2 besetzt
              unternehmen: unternehmensname,
              terminDatum: selectedSlot.start,
              terminart: selectedType === 'video' ? 'Video' : 'Telefonisch',
              quelle: 'Cold Calling',
              infosErstgespraech: problemstellung,
              meetingLink: meetingLink,
              // Kontaktdaten mit übergeben - damit der Calendly-Webhook den
              // Hot Lead per Email matchen kann und keinen Duplikat-Eintrag anlegt.
              mail: contactEmail || null,
              telefonnummer: contactPhone || null,
              ansprechpartnerVorname: ansprechpartnerVorname || null,
              ansprechpartnerNachname: ansprechpartnerNachname || null,
              ort: lead?.stadt || lead?.ort || null,
              ...uebergabe1,
              ...zielStand
            })
          })

          const hotLeadData = await hotLeadResponse.json()
          if (!hotLeadResponse.ok) {
            // 422 = Übergabe unvollständig. Die fehlenden Felder werden im
            // Formular markiert, statt nur eine Fehlermeldung zu zeigen.
            if (hotLeadResponse.status === 422 && hotLeadData.error === 'uebergabe_unvollstaendig') {
              setUebergabeOffen(hotLeadData.offen || [])
              setBuchFehler(`${hotLeadData.message} Fehlend: `
                + (hotLeadData.offen || []).map(o => o.name).join(', '))
              setBooking(false)
              return
            }

            // 409 = Für diesen Lead existiert bereits ein Hot Lead.
            // Bisher: Fehler → Calendly-Termin blieb orphan zurück.
            // Jetzt: User fragen, ob bestehender Hot Lead auf neuen Slot umgebucht werden soll.
            if (hotLeadResponse.status === 409) {
              const existingId = hotLeadData.existingHotLeadId
              if (!existingId) {
                setBuchFehler('Für diesen Lead existiert bereits ein Beratungsgespräch, aber der bestehende Eintrag konnte nicht ermittelt werden. Bitte einen anderen Lead wählen.')
                setBooking(false)
                return
              }
              const shouldReschedule = window.confirm(
                'Für diesen Lead existiert bereits ein Beratungsgespräch im CRM.\n\n' +
                'Soll der bestehende Termin auf den neu gewählten Slot verschoben werden?\n\n' +
                'ACHTUNG: Der alte Calendly-Termin wird NICHT automatisch abgesagt - bitte manuell prüfen.'
              )
              if (!shouldReschedule) {
                setBuchFehler('Abgebrochen. Der Calendly-Termin wurde gebucht, aber nicht ins CRM übernommen. Bitte den Calendly-Termin manuell absagen, falls nicht mehr benötigt.')
                setBooking(false)
                return
              }
              // Bestehenden Hot Lead auf neuen Slot patchen
              try {
                const patchResponse = await fetch('/.netlify/functions/hot-leads', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    hotLeadId: existingId,
                    updates: {
                      terminDatum: selectedSlot.start,
                      terminart: selectedType === 'video' ? 'Video' : 'Telefonisch',
                      meetingLink: meetingLink,
                      status: STATUS.BERATUNG_VEREINBART
                    }
                  })
                })
                if (!patchResponse.ok) {
                  const patchErr = await patchResponse.json().catch(() => ({}))
                  throw new Error(patchErr.message || patchErr.error || `HTTP ${patchResponse.status}`)
                }
                console.log('Bestehender Hot Lead auf neuen Slot verschoben:', existingId)
                createdHotLeadId = existingId
              } catch (patchErr) {
                setBuchFehler('Update des bestehenden Hot Leads fehlgeschlagen: ' + patchErr.message)
                setBooking(false)
                return
              }
            } else if (hotLeadResponse.status === 400 && (hotLeadData.error === 'setter_not_found' || hotLeadData.error === 'closer_not_found')) {
              // 400 mit setter_not_found / closer_not_found:
              // Calendly-Termin ist schon gebucht, aber Hot Lead konnte nicht erstellt werden.
              // User muss den Fehler sehen, sonst "verschwindet" der Termin aus seinem CRM-Kalender.
              setBuchFehler(hotLeadData.message || 'Setter oder Closer konnte nicht zugewiesen werden. Termin nicht gespeichert.')
              setBooking(false)
              return
            } else {
              console.error('Hot Lead Erstellung fehlgeschlagen:', hotLeadData)
            }
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

      // Geht der Termin in den Setter-Pool, sollen die Setter davon erfahren.
      // Haelt der Buchende das Gespraech selbst, gibt es nichts zu verteilen.
      if (!isReschedule && !(kannSelbstSetten && setzeSelbst)) {
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
            assignedToPool: !(kannSelbstSetten && setzeSelbst),
            meetingLink: meetingLink,
            // Für das Empfehlungsfenster: welcher Kontakt entstanden ist und
            // was der Opener aufgenommen hat. Daraus wählt das CRM die
            // Segment-Mail und füllt ihre Platzhalter.
            hotLeadId: createdHotLeadId,
            kontakt: createdHotLeadId ? {
              ...uebergabe1,
              ...zielStand,
              ansprechpartner_vorname: ansprechpartnerVorname,
              ansprechpartner_nachname: ansprechpartnerNachname,
              ort: lead?.stadt || lead?.ort || null
            } : null
          })
        }
      }, meetingLink ? 5000 : 1500)

    } catch (err) {
      console.error('Buchungsfehler:', err)
      setBuchFehler(err.message || 'Fehler bei der Terminbuchung')
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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

      {/* Schritt 1 entfaellt, wenn nur eine Terminart in Frage kommt — dann
          gibt es nichts zu entscheiden, und eine Auswahl mit einer Antwort
          ist keine Auswahl, sondern eine Huerde. */}
      {eventTypes.length > 1 && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          1. Terminart wählen
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setSelectedType('video'); setSelectedDate(null); setSelectedSlot(null); setSlots([]); setError('') }}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedType === 'video'
                ? 'border-secondary bg-primary-fixed/30'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Video className={`w-6 h-6 mx-auto mb-2 ${selectedType === 'video' ? 'text-primary' : 'text-gray-400'}`} />
            <p className={`font-medium ${selectedType === 'video' ? 'text-primary' : 'text-gray-700'}`}>Video</p>
            <p className="text-xs text-gray-500">Google Meet</p>
          </button>
          
          <button
            onClick={() => { setSelectedType('phone'); setSelectedDate(null); setSelectedSlot(null); setSlots([]); setError('') }}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedType === 'phone'
                ? 'border-secondary bg-primary-fixed/30'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Phone className={`w-6 h-6 mx-auto mb-2 ${selectedType === 'phone' ? 'text-primary' : 'text-gray-400'}`} />
            <p className={`font-medium ${selectedType === 'phone' ? 'text-primary' : 'text-gray-700'}`}>Telefonisch</p>
            <p className="text-xs text-gray-500">Anruf</p>
          </button>
        </div>
      </div>
      )}

      {/* Datum wählen */}
      {selectedType && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {eventTypes.length > 1 ? '2. Datum wählen' : 'Datum wählen'}
          </label>

          {/* Steht die Terminart fest, sagt die Maske trotzdem, was gebucht
              wird. Sonst weiß der Opener erst nach dem Absenden, ob der Kunde
              angerufen wird oder einen Meet-Link bekommt. */}
          {eventTypes.length === 1 && (
            <p className="flex items-center gap-1.5 -mt-1 mb-3 text-xs text-on-surface-variant">
              {selectedType === 'phone' ? <Phone className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              {eventTypes[0].name}
              {selectedType === 'phone' ? ', telefonisch' : ', per Google Meet'}
            </p>
          )}
          
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
                      ? 'bg-primary text-white'
                      : past
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : today
                          ? 'bg-primary-fixed/30 text-primary hover:bg-secondary-container'
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
            {eventTypes.length > 1 ? '3. Uhrzeit wählen' : 'Uhrzeit wählen'}
          </label>
          
          {loadingSlots ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
                      ? 'bg-primary text-white'
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
          <h4 className="font-medium text-gray-900">
            {eventTypes.length > 1 ? '4. Kontaktdaten des Maklers' : 'Kontaktdaten des Maklers'}
          </h4>
          
          {/* Ansprechpartner */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Vorname *</label>
              <input
                type="text"
                value={ansprechpartnerVorname}
                onChange={(e) => setAnsprechpartnerVorname(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Vorname"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nachname *</label>
              <input
                type="text"
                value={ansprechpartnerNachname}
                onChange={(e) => setAnsprechpartnerNachname(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="email@beispiel.de"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Telefon *</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="+49 123 456789"
              />
            </div>
          </div>

          {/* Was der Aufrufer mitgibt: im Setting die Angaben aus dem
              Beratungsgespräch, davor die Kontaktdaten. */}
          {zusatz && <div className="border-t pt-4">{zusatz}</div>}

          {/* Übergabe an den Setter. Im Setting übernimmt `zusatz` diese Rolle. */}
          {!nurBuchen && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-1">
              {eventTypes.length > 1 ? '5. Übergabe an den Setter' : 'Übergabe an den Setter'}
            </h4>
            <p className="text-xs text-gray-500 mb-4">
              Diese Angaben steuern, welche Mail und welches Video der Kunde bekommt
              und ob die Erinnerung vor dem Termin zugestellt werden kann.
            </p>
            <UebergabeFelder
              bereich={UEBERGABE_1}
              werte={uebergabe1}
              onChange={(w) => { setUebergabe1(w); setUebergabeOffen([]) }}
              offen={uebergabeOffen}
            />
          </div>
          )}
        </div>
      )}

      {/* Actions */}
      {selectedSlot && (
        <div className="border-t pt-4 space-y-3">
          <p className="text-sm text-gray-600 text-center">
            Termin: <strong>{new Date(selectedSlot.start).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })}</strong> um <strong>{selectedSlot.startTime} Uhr</strong>
            {selectedType === 'video' ? ' (Video)' : ' (Telefon)'}
          </p>
          
          {/* Wer bucht, kann das Gespräch selbst halten - sofern er die Rolle
              dafür trägt. Ohne Haken geht es in den Pool der nächsten Stufe. */}
          {!isReschedule && kannSelbstHalten && (
            <label className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={setzeSelbst}
                onChange={e => setSetzeSelbst(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary"
              />
              <span className="text-gray-700">
                {fuerAbschluss
                  ? 'Ich halte das Abschlussgespräch selbst'
                  : 'Ich halte das Beratungsgespräch selbst'}
                <span className="block text-xs text-gray-500">
                  Ohne Haken geht der Termin in den {fuerAbschluss ? 'Closer' : 'Setter'}-Pool
                  und wird dort besetzt.
                </span>
              </span>
            </label>
          )}

          {buchFehler && (
            <div ref={fehlerRef} className="p-3 mb-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {buchFehler}
            </div>
          )}

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
            /* Ein Knopf. Die Frage "wer haelt das Gespraech" beantwortet das
               Haekchen darueber; eine Closer-Frage gibt es hier nicht mehr. */
            <button
              onClick={() => bookTermin()}
              disabled={booking}
              className="w-full flex items-center justify-center px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-container disabled:opacity-50 transition-colors"
            >
              {booking ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Calendar className="w-5 h-5 mr-2" />
                  {(kannSelbstHalten && setzeSelbst && knopfText)
                    ? knopfText.replace('an den Closer übergeben', 'selbst übernehmen')
                    : knopfText || ((kannSelbstSetten && setzeSelbst)
                    ? 'Termin buchen und selbst übernehmen'
                    : 'Termin buchen und an den Setter-Pool geben')}
                </>
              )}
            </button>
          )}
          
          {/* Nur wo es einen Weg zurueck gibt; im gefuehrten Ablauf steht er
              in der Fussleiste. */}
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full py-2 text-gray-600 hover:text-gray-800"
            >
              Abbrechen
            </button>
          )}
        </div>
      )}

      {/* Abbrechen wenn noch kein Slot gewählt */}
      {!selectedSlot && onCancel && (
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
