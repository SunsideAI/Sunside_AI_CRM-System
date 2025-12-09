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
function calculateFreeSlots(busyTimes, date, startHour = 7, endHour = 20, slotDuration = 45) {
  const slots = []
  const dateStr = date.toISOString().split('T')[0]
  
  // Alle möglichen Slots generieren (7:00 - 20:00, 45 Min)
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += slotDuration) {
      // Prüfen ob der Slot noch vor 20:00 endet
      const endMinutes = hour * 60 + minute + slotDuration
      if (endMinutes > endHour * 60) continue
      
      const slotStart = new Date(dateStr + 'T' + 
        String(hour).padStart(2, '0') + ':' + 
        String(minute).padStart(2, '0') + ':00')
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000)
      
      // Prüfen ob Slot mit busy-Zeiten kollidiert
      const isBusy = busyTimes.some(busy => {
        const busyStart = new Date(busy.start)
        const busyEnd = new Date(busy.end)
        return (slotStart < busyEnd && slotEnd > busyStart)
      })
      
      if (!isBusy) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          startTime: String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0'),
          endTime: String(Math.floor(endMinutes / 60)).padStart(2, '0') + ':' + String(endMinutes % 60).padStart(2, '0')
        })
      }
    }
  }
  
  return slots
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
