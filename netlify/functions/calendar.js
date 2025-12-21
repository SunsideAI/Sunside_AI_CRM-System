// Google Calendar API Integration
const { google } = require('googleapis')

// Service Account aus Environment Variable laden
function getAuthClient() {
  const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT)
  
  return new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/calendar']
  })
}

// Freie Slots für einen Tag berechnen
// WICHTIG: Alle Zeiten in Europe/Berlin!
function calculateFreeSlots(busyTimes, date, startHour = 7, endHour = 20, slotDuration = 45) {
  const slots = []
  const dateStr = date.toISOString().split('T')[0]
  
  // Offset für Europe/Berlin berechnen (MEZ = +01:00, MESZ = +02:00)
  // Wir nutzen einen Trick: Erstellen ein Datum und prüfen den Offset
  const testDate = new Date(dateStr + 'T12:00:00Z')
  const berlinOffset = getBerlinOffset(testDate)
  
  // Alle möglichen Slots generieren (7:00 - 20:00, 45 Min)
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += slotDuration) {
      // Prüfen ob der Slot noch vor 20:00 endet
      const endMinutes = hour * 60 + minute + slotDuration
      if (endMinutes > endHour * 60) continue
      
      // ISO-String MIT Zeitzone erstellen (Europe/Berlin)
      // Format: 2024-12-09T13:00:00+01:00
      const startTimeStr = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${berlinOffset}`
      const endHourCalc = Math.floor(endMinutes / 60)
      const endMinuteCalc = endMinutes % 60
      const endTimeStr = `${dateStr}T${String(endHourCalc).padStart(2, '0')}:${String(endMinuteCalc).padStart(2, '0')}:00${berlinOffset}`
      
      const slotStart = new Date(startTimeStr)
      const slotEnd = new Date(endTimeStr)
      
      // Prüfen ob Slot mit busy-Zeiten kollidiert
      const isBusy = busyTimes.some(busy => {
        const busyStart = new Date(busy.start)
        const busyEnd = new Date(busy.end)
        return (slotStart < busyEnd && slotEnd > busyStart)
      })
      
      if (!isBusy) {
        slots.push({
          // ISO-String mit korrekter Zeitzone für Google Calendar
          start: startTimeStr,
          end: endTimeStr,
          startTime: String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0'),
          endTime: String(endHourCalc).padStart(2, '0') + ':' + String(endMinuteCalc).padStart(2, '0')
        })
      }
    }
  }
  
  return slots
}

// Berechnet den Offset für Europe/Berlin (MEZ oder MESZ)
function getBerlinOffset(date) {
  // Sommerzeitregeln für EU: Letzter Sonntag im März bis letzter Sonntag im Oktober
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  
  // Letzter Sonntag im März
  const marchLast = new Date(Date.UTC(year, 2, 31))
  while (marchLast.getUTCDay() !== 0) marchLast.setUTCDate(marchLast.getUTCDate() - 1)
  
  // Letzter Sonntag im Oktober
  const octLast = new Date(Date.UTC(year, 9, 31))
  while (octLast.getUTCDay() !== 0) octLast.setUTCDate(octLast.getUTCDate() - 1)
  
  // MESZ (Sommerzeit): +02:00
  // MEZ (Winterzeit): +01:00
  const isSummerTime = date >= marchLast && date < octLast
  
  return isSummerTime ? '+02:00' : '+01:00'
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Google Service Account nicht konfiguriert' })
    }
  }

  try {
    const auth = getAuthClient()
    const calendar = google.calendar({ version: 'v3', auth })

    // GET: Freie Slots abrufen
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const { action, calendarId, date } = params

      if (action === 'test') {
        // Einfacher Test ob Kalender-Zugriff funktioniert
        const testCalendarId = calendarId || 'ppro1998@gmail.com'
        
        const response = await calendar.calendarList.list()
        
        // Versuche auf den spezifischen Kalender zuzugreifen
        try {
          const calResponse = await calendar.calendars.get({
            calendarId: testCalendarId
          })
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Kalender-Zugriff funktioniert!',
              calendar: {
                id: calResponse.data.id,
                summary: calResponse.data.summary,
                timeZone: calResponse.data.timeZone
              }
            })
          }
        } catch (calError) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: false,
              message: 'Kein Zugriff auf Kalender. Wurde er für den Service Account freigegeben?',
              calendarId: testCalendarId,
              error: calError.message
            })
          }
        }
      }

      // Calendly Test - Event Types abrufen
      if (action === 'calendly-test') {
        if (!process.env.CALENDLY_API_KEY) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'CALENDLY_API_KEY nicht konfiguriert' })
          }
        }

        try {
          // Erst User-Info abrufen
          const userResponse = await fetch('https://api.calendly.com/users/me', {
            headers: {
              'Authorization': `Bearer ${process.env.CALENDLY_API_KEY}`,
              'Content-Type': 'application/json'
            }
          })
          const userData = await userResponse.json()
          
          if (!userResponse.ok) {
            throw new Error(userData.message || 'Calendly User-Fehler')
          }

          const userUri = userData.resource.uri
          const orgUri = userData.resource.current_organization

          // Event Types abrufen
          const eventTypesResponse = await fetch(
            `https://api.calendly.com/event_types?organization=${encodeURIComponent(orgUri)}&active=true`,
            {
              headers: {
                'Authorization': `Bearer ${process.env.CALENDLY_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          )
          const eventTypesData = await eventTypesResponse.json()

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              user: {
                name: userData.resource.name,
                email: userData.resource.email,
                uri: userUri
              },
              organization: orgUri,
              eventTypes: eventTypesData.collection?.map(et => ({
                uri: et.uri,
                name: et.name,
                duration: et.duration,
                slug: et.slug,
                scheduling_url: et.scheduling_url
              })) || []
            })
          }
        } catch (calendlyError) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: 'Calendly Fehler', 
              details: calendlyError.message 
            })
          }
        }
      }

      // Calendly Event Types abrufen (für Video/Telefon Auswahl)
      if (action === 'calendly-event-types') {
        if (!process.env.CALENDLY_API_KEY) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'CALENDLY_API_KEY nicht konfiguriert' })
          }
        }

        try {
          // User-Info für Organization URI
          const userResponse = await fetch('https://api.calendly.com/users/me', {
            headers: {
              'Authorization': `Bearer ${process.env.CALENDLY_API_KEY}`,
              'Content-Type': 'application/json'
            }
          })
          const userData = await userResponse.json()
          
          if (!userResponse.ok) {
            throw new Error(userData.message || 'Calendly User-Fehler')
          }

          const orgUri = userData.resource.current_organization

          // Event Types abrufen
          const eventTypesResponse = await fetch(
            `https://api.calendly.com/event_types?organization=${encodeURIComponent(orgUri)}&active=true`,
            {
              headers: {
                'Authorization': `Bearer ${process.env.CALENDLY_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          )
          const eventTypesData = await eventTypesResponse.json()

          // Die zwei relevanten Event Types finden (Video + Telefon)
          const eventTypes = eventTypesData.collection?.map(et => ({
            uri: et.uri,
            name: et.name,
            slug: et.slug,
            duration: et.duration,
            scheduling_url: et.scheduling_url,
            // Video wenn "klon" im Slug oder "video"/"meet" im Namen
            type: (et.slug?.includes('klon') || et.name?.toLowerCase().includes('video') || et.name?.toLowerCase().includes('meet')) 
              ? 'video' 
              : 'phone'
          })) || []

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              eventTypes
            })
          }
        } catch (calendlyError) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: 'Calendly Fehler', 
              details: calendlyError.message 
            })
          }
        }
      }

      // Calendly verfügbare Slots abrufen
      if (action === 'calendly-slots') {
        if (!process.env.CALENDLY_API_KEY) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'CALENDLY_API_KEY nicht konfiguriert' })
          }
        }

        const eventTypeUri = params.eventTypeUri
        const startDate = params.startDate // ISO Format
        const endDate = params.endDate // ISO Format

        if (!eventTypeUri) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'eventTypeUri erforderlich' })
          }
        }

        try {
          // Start/End berechnen (Standard: ab jetzt, 14 Tage)
          const now = new Date()
          const start = startDate ? new Date(startDate) : now
          const end = endDate ? new Date(endDate) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

          // Verfügbare Zeiten abrufen
          const slotsUrl = new URL('https://api.calendly.com/event_type_available_times')
          slotsUrl.searchParams.append('event_type', eventTypeUri)
          slotsUrl.searchParams.append('start_time', start.toISOString())
          slotsUrl.searchParams.append('end_time', end.toISOString())

          const slotsResponse = await fetch(slotsUrl.toString(), {
            headers: {
              'Authorization': `Bearer ${process.env.CALENDLY_API_KEY}`,
              'Content-Type': 'application/json'
            }
          })
          const slotsData = await slotsResponse.json()

          if (!slotsResponse.ok) {
            throw new Error(slotsData.message || 'Calendly Slots-Fehler')
          }

          // Slots formatieren
          const slots = slotsData.collection?.map(slot => ({
            start: slot.start_time,
            status: slot.status, // 'available' oder 'unavailable'
            inviteesRemaining: slot.invitees_remaining
          })).filter(slot => slot.status === 'available') || []

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              eventTypeUri,
              startDate: start.toISOString(),
              endDate: end.toISOString(),
              slots
            })
          }
        } catch (calendlyError) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: 'Calendly Slots-Fehler', 
              details: calendlyError.message 
            })
          }
        }
      }

      // Termine für einen Zeitraum abrufen
      if (action === 'events') {
        if (!calendarId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'calendarId erforderlich' })
          }
        }

        // Standard: aktuelle Woche
        const startDate = date ? new Date(date) : new Date()
        startDate.setHours(0, 0, 0, 0)
        
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 7)
        endDate.setHours(23, 59, 59, 999)

        const eventsResponse = await calendar.events.list({
          calendarId: calendarId,
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 50
        })

        const events = eventsResponse.data.items?.map(event => ({
          id: event.id,
          title: event.summary || 'Kein Titel',
          description: event.description || '',
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          allDay: !event.start.dateTime,
          location: event.location || '',
          attendees: event.attendees?.map(a => ({
            email: a.email,
            name: a.displayName,
            status: a.responseStatus
          })) || [],
          htmlLink: event.htmlLink,
          // CRM-spezifische Daten aus extendedProperties
          leadId: event.extendedProperties?.private?.leadId || null,
          source: event.extendedProperties?.private?.source || null
        })) || []

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            calendarId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            events
          })
        }
      }

      if (action === 'slots') {
        // Freie Slots für ein Datum abrufen
        if (!calendarId || !date) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'calendarId und date erforderlich' })
          }
        }

        const queryDate = new Date(date)
        const timeMin = new Date(queryDate)
        timeMin.setHours(0, 0, 0, 0)
        const timeMax = new Date(queryDate)
        timeMax.setHours(23, 59, 59, 999)

        // FreeBusy Query
        const freeBusyResponse = await calendar.freebusy.query({
          requestBody: {
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            timeZone: 'Europe/Berlin',
            items: [{ id: calendarId }]
          }
        })

        const busyTimes = freeBusyResponse.data.calendars[calendarId]?.busy || []
        const freeSlots = calculateFreeSlots(busyTimes, queryDate)

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            date: date,
            calendarId: calendarId,
            busyCount: busyTimes.length,
            freeSlots: freeSlots
          })
        }
      }

      // Slots für mehrere Tage (für Kalender-Übersicht)
      if (action === 'week') {
        if (!calendarId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'calendarId erforderlich' })
          }
        }

        const startDate = date ? new Date(date) : new Date()
        const days = []

        for (let i = 0; i < 7; i++) {
          const currentDate = new Date(startDate)
          currentDate.setDate(startDate.getDate() + i)
          
          // Wochenende überspringen
          if (currentDate.getDay() === 0 || currentDate.getDay() === 6) continue

          const timeMin = new Date(currentDate)
          timeMin.setHours(0, 0, 0, 0)
          const timeMax = new Date(currentDate)
          timeMax.setHours(23, 59, 59, 999)

          const freeBusyResponse = await calendar.freebusy.query({
            requestBody: {
              timeMin: timeMin.toISOString(),
              timeMax: timeMax.toISOString(),
              timeZone: 'Europe/Berlin',
              items: [{ id: calendarId }]
            }
          })

          const busyTimes = freeBusyResponse.data.calendars[calendarId]?.busy || []
          const freeSlots = calculateFreeSlots(busyTimes, currentDate)

          days.push({
            date: currentDate.toISOString().split('T')[0],
            dayName: currentDate.toLocaleDateString('de-DE', { weekday: 'short' }),
            freeSlots: freeSlots
          })
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ calendarId, days })
        }
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Unbekannte action. Verfügbar: test, slots, week' })
      }
    }

    // POST: Termin erstellen
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body)
      const { action: postAction } = body

      // Calendly Termin erstellen
      if (postAction === 'calendly-book') {
        if (!process.env.CALENDLY_API_KEY) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'CALENDLY_API_KEY nicht konfiguriert' })
          }
        }

        const { eventTypeUri, startTime, inviteeName, inviteeEmail, inviteePhone, leadInfo } = body

        if (!eventTypeUri || !startTime || !inviteeName || !inviteeEmail) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'eventTypeUri, startTime, inviteeName, inviteeEmail erforderlich' })
          }
        }

        // Namen aufteilen für Calendly
        const nameParts = inviteeName.trim().split(' ')
        const firstName = nameParts[0] || inviteeName
        const lastName = nameParts.slice(1).join(' ') || firstName

        // Telefonnummer in E.164 Format konvertieren
        let formattedPhone = inviteePhone || '+49'
        if (formattedPhone && !formattedPhone.startsWith('+')) {
          // Deutsche Nummer: 0 am Anfang durch +49 ersetzen
          if (formattedPhone.startsWith('0')) {
            formattedPhone = '+49' + formattedPhone.substring(1)
          } else {
            formattedPhone = '+49' + formattedPhone
          }
        }
        // Leerzeichen und Bindestriche entfernen
        formattedPhone = formattedPhone.replace(/[\s\-]/g, '')

        try {
          // Erst: Event Type Details abrufen um die Custom Questions zu bekommen
          const eventTypeResponse = await fetch(eventTypeUri, {
            headers: {
              'Authorization': `Bearer ${process.env.CALENDLY_API_KEY}`,
              'Content-Type': 'application/json'
            }
          })
          const eventTypeData = await eventTypeResponse.json()
          console.log('Event Type:', JSON.stringify(eventTypeData, null, 2))

          // Custom Questions aus dem Event Type extrahieren
          const customQuestions = eventTypeData.resource?.custom_questions || []
          console.log('Custom Questions:', JSON.stringify(customQuestions, null, 2))

          // Antworten für die Custom Questions vorbereiten
          // Format: { question: "Name", answer: "Value", position: 0 }
          const questionsAndAnswers = []
          
          for (const question of customQuestions) {
            let answer = ''
            const questionName = question.name?.toLowerCase() || ''
            
            if (questionName.includes('unternehmen') || questionName.includes('company')) {
              answer = leadInfo?.firma || inviteeName
            } else if (questionName.includes('makler') || questionName.includes('sachverständiger') || questionName.includes('tätig')) {
              answer = leadInfo?.taetigkeit || 'Makler'
            } else if (questionName.includes('problem') || questionName.includes('ziel')) {
              answer = leadInfo?.problemstellung || 'Interesse an KI-gestützter Vertriebsassistenz'
            }
            
            if (answer) {
              questionsAndAnswers.push({
                question: question.name,
                answer: answer,
                position: question.position
              })
            }
          }
          
          console.log('Questions and Answers:', JSON.stringify(questionsAndAnswers, null, 2))

          // Calendly Scheduling API - POST /invitees
          const requestBody = {
            event_type: eventTypeUri,
            start_time: startTime,
            invitee: {
              name: `${firstName} ${lastName}`.trim(),
              first_name: firstName,
              last_name: lastName,
              email: inviteeEmail,
              timezone: 'Europe/Berlin',
              text_reminder_number: formattedPhone
            },
            questions_and_answers: questionsAndAnswers,
            location: {
              kind: 'outbound_call',
              location: formattedPhone
            },
            // Closer als zusätzlicher Teilnehmer
            event_guests: leadInfo?.closerEmail ? [leadInfo.closerEmail] : []
          }

          console.log('Calendly Request:', JSON.stringify(requestBody, null, 2))

          const response = await fetch('https://api.calendly.com/invitees', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.CALENDLY_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          })

          const data = await response.json()
          console.log('Calendly Response:', response.status, JSON.stringify(data, null, 2))

          if (!response.ok) {
            console.error('Calendly Error:', data)
            return {
              statusCode: response.status,
              headers,
              body: JSON.stringify({ 
                error: 'Calendly Buchung fehlgeschlagen',
                details: data.message || data.title || data
              })
            }
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Calendly Termin erstellt!',
              event: data
            })
          }

        } catch (calendlyError) {
          console.error('Calendly Booking Error:', calendlyError)
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: 'Calendly Fehler',
              details: calendlyError.message
            })
          }
        }
      }

      // Google Calendar Termin erstellen (bestehender Code)
      const { calendarId, title, description, startTime, endTime, attendees, leadId } = body

      if (!calendarId || !title || !startTime || !endTime) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'calendarId, title, startTime, endTime erforderlich' })
        }
      }

      const eventData = {
        summary: title,
        description: description || '',
        start: {
          dateTime: startTime,
          timeZone: 'Europe/Berlin'
        },
        end: {
          dateTime: endTime,
          timeZone: 'Europe/Berlin'
        },
        // Optional: Teilnehmer einladen
        attendees: attendees ? attendees.map(email => ({ email })) : [],
        // Lead-ID als Extended Property speichern
        extendedProperties: {
          private: {
            leadId: leadId || '',
            source: 'sunside-crm'
          }
        }
      }

      const response = await calendar.events.insert({
        calendarId: calendarId,
        requestBody: eventData,
        sendUpdates: attendees ? 'all' : 'none' // E-Mail an Teilnehmer
      })

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Termin erstellt!',
          event: {
            id: response.data.id,
            htmlLink: response.data.htmlLink,
            start: response.data.start,
            end: response.data.end
          }
        })
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Calendar API Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        details: error.response?.data || null
      })
    }
  }
}
