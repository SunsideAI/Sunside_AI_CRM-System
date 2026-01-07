// Calendly API Integration (Google Calendar entfernt)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
}

exports.handler = async (event) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  // Calendly API Key prüfen
  if (!process.env.CALENDLY_API_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'CALENDLY_API_KEY nicht konfiguriert' })
    }
  }

  const calendlyHeaders = {
    'Authorization': `Bearer ${process.env.CALENDLY_API_KEY}`,
    'Content-Type': 'application/json'
  }

  try {
    // ==========================================
    // GET Requests
    // ==========================================
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const { action } = params

      // ----------------------------------------
      // calendly-test: API Verbindung testen
      // ----------------------------------------
      if (action === 'calendly-test') {
        try {
          const userResponse = await fetch('https://api.calendly.com/users/me', {
            headers: calendlyHeaders
          })
          const userData = await userResponse.json()
          
          if (!userResponse.ok) {
            throw new Error(userData.message || 'Calendly User-Fehler')
          }

          const orgUri = userData.resource.current_organization

          // Event Types abrufen
          const eventTypesResponse = await fetch(
            `https://api.calendly.com/event_types?organization=${encodeURIComponent(orgUri)}&active=true`,
            { headers: calendlyHeaders }
          )
          const eventTypesData = await eventTypesResponse.json()

          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: true,
              user: {
                name: userData.resource.name,
                email: userData.resource.email,
                uri: userData.resource.uri
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
        } catch (err) {
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Calendly Fehler', details: err.message })
          }
        }
      }

      // ----------------------------------------
      // calendly-event-types: Event Types abrufen
      // ----------------------------------------
      if (action === 'calendly-event-types') {
        try {
          // User-Info für Organization URI
          const userResponse = await fetch('https://api.calendly.com/users/me', {
            headers: calendlyHeaders
          })
          const userData = await userResponse.json()
          
          if (!userResponse.ok) {
            throw new Error(userData.message || 'Calendly User-Fehler')
          }

          const orgUri = userData.resource.current_organization

          // Event Types abrufen
          const eventTypesResponse = await fetch(
            `https://api.calendly.com/event_types?organization=${encodeURIComponent(orgUri)}&active=true`,
            { headers: calendlyHeaders }
          )
          const eventTypesData = await eventTypesResponse.json()

          // Die Event Types mit Video/Phone Typ-Erkennung
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
            headers: corsHeaders,
            body: JSON.stringify({ success: true, eventTypes })
          }
        } catch (err) {
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Calendly Fehler', details: err.message })
          }
        }
      }

      // ----------------------------------------
      // calendly-slots: Verfügbare Slots abrufen
      // ----------------------------------------
      if (action === 'calendly-slots') {
        const eventTypeUri = params.eventTypeUri
        const dateString = params.dateString  // Format: YYYY-MM-DD (reiner String, keine Zeitzone)
        // Fallback für alte Anfragen mit startDate/endDate
        const startDateParam = params.startDate
        const endDateParam = params.endDate

        if (!eventTypeUri) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'eventTypeUri erforderlich' })
          }
        }

        try {
          let start, end
          
          if (dateString) {
            // NEU: Datum als String empfangen, deutsche Zeitzone anwenden
            // So ist es unabhängig von der Browser-Zeitzone des Vertrieblers
            // Format: "2025-01-15" → "2025-01-15T00:00:00+01:00" (deutsche Zeit)
            
            // Deutsche Zeitzone: Im Winter UTC+1, im Sommer UTC+2
            // Wir nutzen eine einfache Berechnung für CET/CEST
            const [year, month, day] = dateString.split('-').map(Number)
            
            // Prüfen ob Sommerzeit (vereinfacht: letzter Sonntag März bis letzter Sonntag Oktober)
            const testDate = new Date(year, month - 1, day)
            const isSummerTime = (() => {
              // Letzter Sonntag im März
              const marchLast = new Date(year, 2, 31)
              while (marchLast.getDay() !== 0) marchLast.setDate(marchLast.getDate() - 1)
              // Letzter Sonntag im Oktober
              const octoberLast = new Date(year, 9, 31)
              while (octoberLast.getDay() !== 0) octoberLast.setDate(octoberLast.getDate() - 1)
              
              return testDate >= marchLast && testDate < octoberLast
            })()
            
            const offsetHours = isSummerTime ? 2 : 1  // CEST = +2, CET = +1
            
            // Start: 00:00 deutsche Zeit → UTC
            start = new Date(Date.UTC(year, month - 1, day, 0 - offsetHours, 0, 0))
            // Ende: 23:59 deutsche Zeit → UTC
            end = new Date(Date.UTC(year, month - 1, day, 23 - offsetHours, 59, 59))
            
            console.log(`Slots für ${dateString} (DE): ${start.toISOString()} - ${end.toISOString()}`)
          } else {
            // Fallback: alte Logik mit startDate/endDate Parametern
            const now = new Date()
            start = startDateParam ? new Date(startDateParam) : now
            end = endDateParam ? new Date(endDateParam) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
          }

          const slotsUrl = new URL('https://api.calendly.com/event_type_available_times')
          slotsUrl.searchParams.append('event_type', eventTypeUri)
          slotsUrl.searchParams.append('start_time', start.toISOString())
          slotsUrl.searchParams.append('end_time', end.toISOString())

          const slotsResponse = await fetch(slotsUrl.toString(), {
            headers: calendlyHeaders
          })
          const slotsData = await slotsResponse.json()

          if (!slotsResponse.ok) {
            throw new Error(slotsData.message || 'Calendly Slots-Fehler')
          }

          // Nur verfügbare Slots
          const slots = slotsData.collection?.map(slot => ({
            start: slot.start_time,
            status: slot.status,
            inviteesRemaining: slot.invitees_remaining
          })).filter(slot => slot.status === 'available') || []

          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: true,
              eventTypeUri,
              dateString: dateString || null,
              startDate: start.toISOString(),
              endDate: end.toISOString(),
              slots
            })
          }
        } catch (err) {
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Calendly Slots-Fehler', details: err.message })
          }
        }
      }

      // Unbekannte Action
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unbekannte Action', action })
      }
    }

    // ==========================================
    // POST Requests
    // ==========================================
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body)
      const { action: postAction } = body

      // ----------------------------------------
      // calendly-book: Termin buchen
      // ----------------------------------------
      if (postAction === 'calendly-book') {
        const { eventTypeUri, startTime, inviteeName, inviteeEmail, inviteePhone, leadInfo } = body

        if (!eventTypeUri || !startTime || !inviteeName || !inviteeEmail) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'eventTypeUri, startTime, inviteeName, inviteeEmail erforderlich' })
          }
        }

        // Namen aufteilen
        const nameParts = inviteeName.trim().split(' ')
        const firstName = nameParts[0] || inviteeName
        const lastName = nameParts.slice(1).join(' ') || firstName

        // Telefonnummer in E.164 Format
        let formattedPhone = inviteePhone || '+49'
        if (formattedPhone && !formattedPhone.startsWith('+')) {
          if (formattedPhone.startsWith('0')) {
            formattedPhone = '+49' + formattedPhone.substring(1)
          } else {
            formattedPhone = '+49' + formattedPhone
          }
        }
        formattedPhone = formattedPhone.replace(/[\s\-]/g, '')

        try {
          // Event Type Details abrufen für Custom Questions
          const eventTypeResponse = await fetch(eventTypeUri, {
            headers: calendlyHeaders
          })
          const eventTypeData = await eventTypeResponse.json()
          console.log('Event Type:', JSON.stringify(eventTypeData, null, 2))

          // Custom Questions
          const customQuestions = eventTypeData.resource?.custom_questions || []
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

          // Buchungs-Request
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
            event_guests: leadInfo?.closerEmail ? [leadInfo.closerEmail] : []
          }

          console.log('Calendly Request:', JSON.stringify(requestBody, null, 2))

          const response = await fetch('https://api.calendly.com/invitees', {
            method: 'POST',
            headers: calendlyHeaders,
            body: JSON.stringify(requestBody)
          })

          const data = await response.json()
          console.log('Calendly Response:', response.status, JSON.stringify(data, null, 2))

          if (!response.ok) {
            console.error('Calendly Error:', data)
            return {
              statusCode: response.status,
              headers: corsHeaders,
              body: JSON.stringify({ 
                error: 'Calendly Buchung fehlgeschlagen',
                details: data.message || data.title || data
              })
            }
          }

          // Meeting-Link extrahieren (für Video-Termine)
          let meetingLink = null
          
          // Versuche den Link aus der Event-Location zu bekommen
          if (data.resource?.event) {
            try {
              // Event-Details abrufen für den Meeting-Link
              const eventResponse = await fetch(data.resource.event, {
                headers: calendlyHeaders
              })
              const eventData = await eventResponse.json()
              console.log('Event Details:', JSON.stringify(eventData, null, 2))
              
              // Location kann den Google Meet Link enthalten
              const location = eventData.resource?.location
              if (location) {
                // Google Meet Link extrahieren
                if (location.type === 'google_conference' || location.type === 'custom') {
                  meetingLink = location.join_url || location.location
                } else if (typeof location === 'string' && location.includes('meet.google.com')) {
                  meetingLink = location
                }
              }
              
              // Fallback: Manchmal ist der Link in den Event-Details
              if (!meetingLink && eventData.resource?.conferencing) {
                meetingLink = eventData.resource.conferencing.join_url
              }
            } catch (eventErr) {
              console.error('Event-Details abrufen fehlgeschlagen:', eventErr)
            }
          }

          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: true,
              message: 'Calendly Termin erstellt!',
              event: data,
              meetingLink: meetingLink  // Link für Video-Termine
            })
          }

        } catch (err) {
          console.error('Calendly Booking Error:', err)
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Calendly Fehler', details: err.message })
          }
        }
      }

      // Unbekannte POST Action
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unbekannte POST Action', action: postAction })
      }
    }

    // Methode nicht erlaubt
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (err) {
    console.error('Calendar Function Error:', err)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    }
  }
}
