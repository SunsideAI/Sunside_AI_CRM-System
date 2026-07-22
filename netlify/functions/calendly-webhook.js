// Calendly Webhook Handler - Supabase Version
// Verarbeitet Events: invitee.canceled, invitee.created (bei Reschedule)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Calendly-Webhook-Signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// Simple in-memory cache for webhook deduplication (prevents duplicate events)
const processedEvents = new Map()
const EVENT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Datum formatieren
function formatDate(isoString) {
  if (!isoString) return 'Unbekannt'
  const date = new Date(isoString)
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin'
  })
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Server nicht konfiguriert' }) }
  }

  try {
    const payload = JSON.parse(event.body)

    console.log('=== Calendly Webhook received ===')
    console.log('Event:', payload.event)

    const eventType = payload.event
    const data = payload.payload

    // Deduplizierung: Event-URI als eindeutiger Identifier
    const eventUri = data?.uri || data?.scheduled_event?.uri || `${eventType}-${data?.email}-${Date.now()}`
    const eventKey = `${eventType}-${eventUri}`

    // Alte Einträge aufräumen
    const now = Date.now()
    for (const [key, timestamp] of processedEvents) {
      if (now - timestamp > EVENT_CACHE_TTL) {
        processedEvents.delete(key)
      }
    }

    // Prüfen ob Event bereits verarbeitet wurde
    if (processedEvents.has(eventKey)) {
      console.log('Duplikat-Event ignoriert:', eventKey)
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, message: 'Event bereits verarbeitet (Duplikat)' })
      }
    }

    // Event als verarbeitet markieren
    processedEvents.set(eventKey, now)

    // invitee.canceled (Termin abgesagt ODER verschoben)
    if (eventType === 'invitee.canceled') {
      const inviteeEmail = data.email
      const scheduledTime = data.scheduled_event?.start_time
      const cancellation = data.cancellation || {}
      const canceledBy = cancellation.canceled_by || 'Unbekannt'
      const cancellationReason = cancellation.reason || ''

      const questionsAndAnswers = data.questions_and_answers || []
      const unternehmensAnswer = questionsAndAnswers.find(q =>
        q.question?.toLowerCase().includes('unternehmen') ||
        q.question?.toLowerCase().includes('company')
      )
      const unternehmen = unternehmensAnswer?.answer || ''

      const isReschedule = data.rescheduled === true

      console.log('Cancel Event:', { email: inviteeEmail, unternehmen, isReschedule })

      if (isReschedule) {
        console.log('Ist Reschedule, warte auf invitee.created Event')
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ success: true, message: 'Reschedule erkannt' })
        }
      }

      // Echte Absage - Hot Lead finden (3 Fallback-Strategien wie in main)
      let hotLead = null
      // 1. Nach Termin-Zeit suchen
      if (scheduledTime) {
        hotLead = await findHotLeadByTermin(scheduledTime, inviteeEmail)
      }
      // 2. Nach E-Mail suchen (Fallback)
      if (!hotLead && inviteeEmail) {
        hotLead = await findHotLeadByEmail(inviteeEmail)
      }
      // 3. Nach Unternehmen suchen (letzter Fallback)
      if (!hotLead && unternehmen) {
        hotLead = await findHotLeadByUnternehmen(unternehmen)
      }

      if (hotLead) {
        const grund = cancellationReason
          ? `Abgesagt von ${canceledBy}: ${cancellationReason}`
          : `Abgesagt von ${canceledBy}`

        await updateHotLeadAbsage(hotLead.id, hotLead.originalLeadId, grund)
        await sendNotifications(hotLead, 'absage', { grund })
        console.log('Hot Lead Status auf abgesagt geaendert:', hotLead.id)
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, message: 'Absage verarbeitet', hotLeadId: hotLead?.id || null })
      }
    }

    // invitee.created (Neuer Termin / Reschedule)
    if (eventType === 'invitee.created') {
      const inviteeEmail = data.email
      const newScheduledTime = data.scheduled_event?.start_time

      const questionsAndAnswers = data.questions_and_answers || []
      const unternehmensAnswer = questionsAndAnswers.find(q =>
        q.question?.toLowerCase().includes('unternehmen') ||
        q.question?.toLowerCase().includes('company')
      )
      const unternehmen = unternehmensAnswer?.answer || ''

      // Custom Questions: "Problemstellung & Ziele" und "Makler oder Sachverständiger"
      // aus dem Calendly-Payload extrahieren, damit sie beim Direktbuchungs-Backfill
      // in leads.kommentar bzw. leads.kategorie landen.
      const problemAnswer = questionsAndAnswers.find(q => {
        const qLower = q.question?.toLowerCase() || ''
        return qLower.includes('problem') || qLower.includes('ziel')
      })
      const problemstellung = problemAnswer?.answer || ''

      const kategorieAnswer = questionsAndAnswers.find(q => {
        const qLower = q.question?.toLowerCase() || ''
        return qLower.includes('makler') || qLower.includes('sachverst') || qLower.includes('tätig')
      })
      const kategorieRaw = (kategorieAnswer?.answer || '').toLowerCase()
      const kategorieAusCalendly =
        kategorieRaw.includes('sachverst') ? 'Sachverständiger'
        : kategorieRaw.includes('makler') ? 'Immobilienmakler'
        : null

      const oldInvitee = data.old_invitee
      const isReschedule = !!oldInvitee

      console.log('Created Event:', { email: inviteeEmail, unternehmen, isReschedule, newTime: newScheduledTime, kategorie: kategorieAusCalendly, hatProblemstellung: !!problemstellung })

      if (isReschedule) {
        const oldScheduledTime = oldInvitee.scheduled_event?.start_time || oldInvitee.start_time

        // Hot Lead finden (3 Fallback-Strategien wie in main)
        let hotLead = null
        // 1. Nach altem Termin suchen
        if (oldScheduledTime) {
          hotLead = await findHotLeadByTermin(oldScheduledTime, inviteeEmail)
        }
        // 2. Nach E-Mail suchen (Fallback)
        if (!hotLead && inviteeEmail) {
          hotLead = await findHotLeadByEmail(inviteeEmail)
        }
        // 3. Nach Unternehmen suchen (letzter Fallback)
        if (!hotLead && unternehmen) {
          hotLead = await findHotLeadByUnternehmen(unternehmen)
        }

        if (hotLead) {
          console.log('Hot Lead gefunden für Verschiebung:', {
            id: hotLead.id,
            unternehmen: hotLead.unternehmen,
            setterId: hotLead.setterId,
            closerId: hotLead.closerId
          })
          await updateHotLeadTermin(hotLead.id, newScheduledTime, hotLead.originalLeadId, hotLead.termin)
          await sendNotifications(hotLead, 'verschiebung', { neuerTermin: newScheduledTime, alterTermin: hotLead.termin })
          console.log('Hot Lead Termin aktualisiert und Benachrichtigungen gesendet:', hotLead.id)
        } else {
          console.error('WARNUNG: Kein Hot Lead gefunden für Verschiebung!', {
            email: inviteeEmail,
            oldTime: oldScheduledTime,
            unternehmen
          })
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ success: true, message: 'Verschiebung verarbeitet', hotLeadId: hotLead?.id || null })
        }
      }

      console.log('Neue Buchung (invitee.created ohne old_invitee)')

      // Race-Condition-Puffer: CRM-Frontend legt Hot Lead in einem separaten POST an.
      // Der Calendly-Webhook kann davor bei uns eintreffen. Wir warten kurz, damit
      // ein CRM-erstellter Hot Lead in der DB sichtbar wird, bevor wir Direktbuchung annehmen.
      await new Promise(r => setTimeout(r, 3000))

      const existingHotLead = inviteeEmail ? await findHotLeadByEmail(inviteeEmail) : null

      if (existingHotLead) {
        // Zwei Fälle unterscheiden:
        // (a) Termin des bestehenden Hot Leads matcht ~ new time → CRM hat diesen
        //     Hot Lead grade für diese Buchung angelegt. Nichts zu tun.
        // (b) Termin unterscheidet sich → Kunde hat direkt gebucht, wir haben aber
        //     schon einen Hot Lead (z.B. aus einer früheren Absage). Behandeln
        //     wie eine Verschiebung: Hot Lead auf den neuen Slot patchen und
        //     Setter/Closer benachrichtigen.
        const existingMs = existingHotLead.termin ? new Date(existingHotLead.termin).getTime() : 0
        const newMs = new Date(newScheduledTime).getTime()
        const sameSlot = existingMs > 0 && Math.abs(newMs - existingMs) < 10 * 60 * 1000

        if (sameSlot) {
          console.log('Hot Lead existiert für denselben Slot (CRM-Buchung):', existingHotLead.id, existingHotLead.unternehmen)
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ success: true, message: 'Neue Buchung - Hot Lead vom CRM angelegt', hotLeadId: existingHotLead.id })
          }
        }

        console.log('Neuer Termin für bestehenden Hot Lead – Termin wird aktualisiert:', {
          hotLeadId: existingHotLead.id,
          alterTermin: existingHotLead.termin,
          neuerTermin: newScheduledTime
        })
        await updateHotLeadTermin(existingHotLead.id, newScheduledTime, existingHotLead.originalLeadId, existingHotLead.termin)
        await sendNotifications(existingHotLead, 'verschiebung', {
          neuerTermin: newScheduledTime,
          alterTermin: existingHotLead.termin
        })

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            message: 'Neuer Termin für bestehenden Hot Lead übernommen',
            hotLeadId: existingHotLead.id
          })
        }
      }

      // Kein Hot Lead → Direktbuchung (Kunde hat Calendly-Link direkt genutzt,
      // vorher kein CRM-Kontakt). Wir legen automatisch einen Pool-Hot-Lead an,
      // damit der Termin im CRM sichtbar ist und ein Closer sich ziehen kann.
      console.log('[Calendly] Direktbuchung erkannt - lege Pool-Hot-Lead an:', {
        email: inviteeEmail,
        time: newScheduledTime,
        unternehmen: unternehmen || '(nicht angegeben)'
      })

      // Namen aus Calendly-Payload extrahieren
      const inviteeFullName = data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim()
      const nameParts = inviteeFullName.split(/\s+/).filter(Boolean)
      const vorname = data.first_name || nameParts[0] || ''
      const nachname = data.last_name || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '')

      // Telefonnummer (Calendly liefert bei SMS-Reminder text_reminder_number)
      const inviteeTelefon = data.text_reminder_number || ''

      // Terminart aus Event-Location ableiten
      const eventLocation = data.scheduled_event?.location || {}
      const isVideoLocation =
        eventLocation.type === 'google_conference' ||
        eventLocation.type === 'zoom' ||
        eventLocation.type === 'microsoft_teams_conference' ||
        (typeof eventLocation.location === 'string' && eventLocation.location.includes('meet.google.com'))
      const terminart = isVideoLocation ? 'Video' : 'Telefonisch'
      const meetingLink =
        eventLocation.join_url ||
        (typeof eventLocation.location === 'string' && eventLocation.location.includes('http')
          ? eventLocation.location
          : null)

      // Schritt 1: Cold Lead in `leads` sicherstellen
      // Match auf leads.mail via Email. Wenn gefunden → als kontaktiert markieren
      // und Calendly-Notizen an den bestehenden Kommentar anhängen.
      // Sonst → neuen Cold Lead anlegen. Beide Wege liefern `leadId` für den
      // Hot-Lead-Insert im nächsten Schritt.
      //
      // Ohne leads-Eintrag ist der Kommentar-Verlauf (single source of truth in
      // leads.kommentar), die Follow-Up-Kette und diverse Ansichten nicht
      // funktional. Deshalb ist der Cold Lead Pflicht.
      const heuteISO = newScheduledTime.slice(0, 10) // YYYY-MM-DD
      let leadId = null
      let leadWasCreated = false

      // Calendly-Notiz bauen: Zeitstempel + Problemstellung/Ziele aus Custom Questions
      const calendlyKommentarZeilen = [
        `[Calendly Direktbuchung ${formatDate(newScheduledTime)}]`
      ]
      if (problemstellung) {
        calendlyKommentarZeilen.push(`Problemstellung & Ziele: ${problemstellung}`)
      }
      if (kategorieAusCalendly) {
        calendlyKommentarZeilen.push(`Tätigkeit laut Calendly: ${kategorieAusCalendly}`)
      }
      // Nur schreiben, wenn wir mindestens einen Zusatz-Inhalt haben - Header allein ist wertlos
      const calendlyKommentar = calendlyKommentarZeilen.length > 1
        ? calendlyKommentarZeilen.join('\n')
        : ''

      if (inviteeEmail) {
        const { data: matchedLead, error: matchErr } = await supabase
          .from('leads')
          .select('id, mail, kommentar')
          .ilike('mail', inviteeEmail)
          .limit(1)
          .maybeSingle()

        if (matchErr) {
          console.warn('Direktbuchung: Email-Match auf leads fehlgeschlagen:', matchErr.message)
        } else if (matchedLead) {
          leadId = matchedLead.id
          console.log('Direktbuchung matcht bestehenden Cold-Lead:', leadId)
          // Kommentar-Verlauf erhalten: neuen Calendly-Block oben anhängen
          const kommentarUpdate = calendlyKommentar
            ? {
                kommentar: matchedLead.kommentar
                  ? `${calendlyKommentar}\n\n${matchedLead.kommentar}`
                  : calendlyKommentar
              }
            : {}
          await supabase
            .from('leads')
            .update({
              bereits_kontaktiert: true,
              ergebnis: 'Beratungsgespräch',
              ...kommentarUpdate
            })
            .eq('id', leadId)
        }
      }

      if (!leadId) {
        // Neuen Cold Lead anlegen. Kategorie aus Calendly wenn vorhanden,
        // sonst Default Immobilienmakler (Kernmarkt) - lässt sich vom Setter
        // im CRM ändern.
        const { data: newLead, error: leadErr } = await supabase
          .from('leads')
          .insert({
            unternehmensname: unternehmen || inviteeFullName || '(Direktbuchung)',
            mail: inviteeEmail || null,
            telefonnummer: inviteeTelefon || null,
            ansprechpartner_vorname: vorname || null,
            ansprechpartner_nachname: nachname || null,
            kategorie: kategorieAusCalendly || 'Immobilienmakler',
            bereits_kontaktiert: true,
            ergebnis: 'Beratungsgespräch',
            datum: heuteISO,
            quelle: 'Calendly Direkt',
            kommentar: calendlyKommentar || null
          })
          .select('id')
          .single()

        if (leadErr) {
          console.error('[Calendly] Direktbuchung – Cold-Lead-Anlage fehlgeschlagen:', leadErr)
          await notifyAdminsOfDirectBooking({
            email: inviteeEmail,
            time: newScheduledTime,
            unternehmen,
            hotLeadId: null,
            error: `Cold-Lead-Anlage: ${leadErr.message}`
          })
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: 'Direktbuchung erkannt, Cold-Lead-Anlage fehlgeschlagen – Admins alarmiert'
            })
          }
        }

        leadId = newLead.id
        leadWasCreated = true
        console.log('[Calendly] Cold Lead für Direktbuchung angelegt:', leadId)
      }

      // Schritt 2: Hot Lead im Pool anlegen, verknüpft mit lead_id.
      const { data: newHotLead, error: insertErr } = await supabase
        .from('hot_leads')
        .insert({
          lead_id: leadId,
          unternehmen: unternehmen || inviteeFullName || '(Direktbuchung)',
          ansprechpartner_vorname: vorname || null,
          ansprechpartner_nachname: nachname || null,
          mail: inviteeEmail || null,
          telefonnummer: inviteeTelefon || null,
          termin_beratungsgespraech: newScheduledTime,
          terminart,
          meeting_link: meetingLink,
          status: 'Lead',
          quelle: 'Calendly Direkt',
          setter_id: null,
          closer_id: null
        })
        .select('id')
        .single()

      if (insertErr) {
        console.error('[Calendly] Direktbuchung – Hot-Lead-Anlage fehlgeschlagen:', insertErr)
        // Cold Lead existiert bereits (evtl. gerade angelegt) - hinweisen, damit
        // Admins Waise nicht übersehen.
        await notifyAdminsOfDirectBooking({
          email: inviteeEmail,
          time: newScheduledTime,
          unternehmen,
          hotLeadId: null,
          matchedLeadId: leadWasCreated ? null : leadId,
          leadId,
          error: `Hot-Lead-Anlage: ${insertErr.message}`
        })
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Direktbuchung erkannt, Hot-Lead-Anlage fehlgeschlagen – Admins alarmiert',
            leadId
          })
        }
      }

      console.log('[Calendly] Direktbuchung als Pool-Hot-Lead angelegt:', newHotLead.id, 'lead_id:', leadId)

      await notifyAdminsOfDirectBooking({
        email: inviteeEmail,
        time: newScheduledTime,
        unternehmen,
        hotLeadId: newHotLead.id,
        matchedLeadId: leadWasCreated ? null : leadId,
        leadId,
        leadWasCreated
      })

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: leadWasCreated
            ? 'Direktbuchung – Cold Lead und Hot Lead im Pool angelegt'
            : 'Direktbuchung – Hot Lead im Pool angelegt (Cold Lead existierte bereits)',
          hotLeadId: newHotLead.id,
          leadId,
          leadWasCreated
        })
      }
    }

    console.log('Unbekanntes Event ignoriert:', eventType)
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: 'Event ignoriert' })
    }

  } catch (err) {
    console.error('Calendly Webhook Error:', err)
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) }
  }
}

// Hot Lead anhand Unternehmen finden
async function findHotLeadByUnternehmen(unternehmen) {
  if (!unternehmen) return null

  console.log('Suche Hot Lead nach Unternehmen:', unternehmen)

  const { data: hotLeads, error } = await supabase
    .from('hot_leads')
    .select('id, unternehmen, termin_beratungsgespraech, setter_id, closer_id, lead_id')
    .neq('status', 'Abgesagt')
    .not('termin_beratungsgespraech', 'is', null)

  if (error || !hotLeads) return null

  const searchTerm = unternehmen.toLowerCase().trim()

  for (const record of hotLeads) {
    const recordUnternehmen = (record.unternehmen || '').toLowerCase().trim()
    if (recordUnternehmen === searchTerm ||
      recordUnternehmen.includes(searchTerm) ||
      searchTerm.includes(recordUnternehmen)) {
      console.log('Match gefunden:', record.unternehmen)
      return {
        id: record.id,
        unternehmen: record.unternehmen,
        termin: record.termin_beratungsgespraech,
        setterId: record.setter_id,
        closerId: record.closer_id,
        originalLeadId: record.lead_id
      }
    }
  }

  return null
}

// Hot Lead anhand Termin-Zeit finden
// WICHTIG: Bei mehreren Kandidaten im 10-Min-Fenster bevorzugen wir Email-Match,
// sonst kleinsten Zeit-Abstand. Sonst konnte bei parallelen Terminen (z.B. 2 Termine
// gleichzeitig für morgen) der falsche Hot Lead auf die neue Zeit verschoben werden
// → einer der Termine "verschwand" aus dem Kalender.
async function findHotLeadByTermin(terminDatum, email) {
  if (!terminDatum) return null

  console.log('Suche Hot Lead nach Termin:', terminDatum, 'Email:', email || '(keine)')

  const { data: hotLeads, error } = await supabase
    .from('hot_leads')
    .select(`
      id, unternehmen, termin_beratungsgespraech, setter_id, closer_id, lead_id, mail,
      original_lead:leads!hot_leads_lead_id_fkey(mail)
    `)
    .neq('status', 'Abgesagt')
    .not('termin_beratungsgespraech', 'is', null)

  if (error) {
    console.error('findHotLeadByTermin DB-Fehler:', error)
    return null
  }
  if (!hotLeads) return null

  const targetTime = new Date(terminDatum).getTime()
  const WINDOW_MS = 10 * 60 * 1000

  const candidates = hotLeads
    .map(record => ({
      record,
      timeDiff: Math.abs(new Date(record.termin_beratungsgespraech).getTime() - targetTime)
    }))
    .filter(c => c.timeDiff < WINDOW_MS)

  if (candidates.length === 0) return null

  let winner = null

  // 1. Bevorzuge Email-Match (verhindert falschen Match bei parallelen Terminen)
  if (email) {
    const emailLower = String(email).toLowerCase().trim()
    const emailMatches = candidates.filter(c =>
      (c.record.mail || '').toLowerCase() === emailLower ||
      (c.record.original_lead?.mail || '').toLowerCase() === emailLower
    )
    if (emailMatches.length > 0) {
      // Bei mehreren Email-Matches: kleinster Zeit-Abstand
      winner = emailMatches.reduce((best, curr) => curr.timeDiff < best.timeDiff ? curr : best)
      console.log('Match via Email + Termin:', winner.record.unternehmen)
    }
  }

  // 2. Fallback: kleinster Zeit-Abstand
  if (!winner) {
    winner = candidates.reduce((best, curr) => curr.timeDiff < best.timeDiff ? curr : best)
    if (candidates.length > 1) {
      console.warn(
        `[findHotLeadByTermin] WARNUNG: ${candidates.length} Kandidaten im 10-Min-Fenster ohne Email-Match.`,
        'Wähle kürzeste Zeit-Diff:', winner.record.unternehmen,
        '(', winner.timeDiff, 'ms)',
        'Alle Kandidaten:', candidates.map(c => ({ id: c.record.id, unternehmen: c.record.unternehmen, diff: c.timeDiff }))
      )
    } else {
      console.log('Match via Termin:', winner.record.unternehmen)
    }
  }

  return {
    id: winner.record.id,
    unternehmen: winner.record.unternehmen,
    termin: winner.record.termin_beratungsgespraech,
    setterId: winner.record.setter_id,
    closerId: winner.record.closer_id,
    originalLeadId: winner.record.lead_id
  }
}

// Hot Lead anhand E-Mail finden (Fallback wenn Termin/Unternehmen nicht matchen)
async function findHotLeadByEmail(email) {
  if (!email) return null

  console.log('Suche Hot Lead nach E-Mail:', email)

  // Erst in hot_leads.mail suchen
  const { data: directMatch, error: directError } = await supabase
    .from('hot_leads')
    .select('id, lead_id, unternehmen, mail, termin_beratungsgespraech, status, setter_id, closer_id')
    .eq('mail', email)
    .not('status', 'in', '(Abgeschlossen,Verloren)')
    .order('termin_beratungsgespraech', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (directError) {
    console.error('findHotLeadByEmail Direct Error:', directError)
  }

  if (directMatch) {
    console.log('E-Mail-Match in hot_leads gefunden:', directMatch.unternehmen)
    return {
      id: directMatch.id,
      unternehmen: directMatch.unternehmen,
      termin: directMatch.termin_beratungsgespraech,
      setterId: directMatch.setter_id,
      closerId: directMatch.closer_id,
      originalLeadId: directMatch.lead_id
    }
  }

  // Fallback: Über original_lead.mail suchen (Join)
  const { data: joinMatch, error: joinError } = await supabase
    .from('hot_leads')
    .select(`
      id, lead_id, unternehmen, termin_beratungsgespraech, status, setter_id, closer_id,
      original_lead:leads!hot_leads_lead_id_fkey(mail)
    `)
    .not('status', 'in', '(Abgeschlossen,Verloren)')
    .order('termin_beratungsgespraech', { ascending: false })

  if (joinError) {
    console.error('findHotLeadByEmail Join Error:', joinError)
    return null
  }

  // Manuell nach E-Mail filtern (weil Supabase kein Filter auf Join-Felder erlaubt)
  const matchingLead = (joinMatch || []).find(hl =>
    hl.original_lead?.mail?.toLowerCase() === email.toLowerCase()
  )

  if (matchingLead) {
    console.log('E-Mail-Match über original_lead gefunden:', matchingLead.unternehmen)
    return {
      id: matchingLead.id,
      unternehmen: matchingLead.unternehmen,
      termin: matchingLead.termin_beratungsgespraech,
      setterId: matchingLead.setter_id,
      closerId: matchingLead.closer_id,
      originalLeadId: matchingLead.lead_id
    }
  }

  console.log('Kein E-Mail-Match gefunden für:', email)
  return null
}

// Hot Lead bei Absage aktualisieren - NUR Status ändern, Termin behalten für Referenz
async function updateHotLeadAbsage(hotLeadId, originalLeadId, grund) {
  console.log('Aktualisiere Hot Lead Absage:', { hotLeadId, originalLeadId })

  // Nur Status ändern - termin_beratungsgespraech bleibt erhalten für Referenz
  const { error } = await supabase
    .from('hot_leads')
    .update({ status: 'Termin abgesagt' })
    .eq('id', hotLeadId)

  if (error) {
    console.error('Update Fehler:', error)
    return false
  }

  if (originalLeadId) {
    await updateOriginalLeadKommentar(originalLeadId, `TERMIN ABGESAGT: ${grund}`)
  }

  return true
}

// Hot Lead Termin aktualisieren
async function updateHotLeadTermin(hotLeadId, neuerTermin, originalLeadId, alterTermin) {
  console.log('Aktualisiere Hot Lead Termin:', { hotLeadId, neuerTermin })

  const { error } = await supabase
    .from('hot_leads')
    .update({ termin_beratungsgespraech: neuerTermin, status: 'Termin verschoben' })
    .eq('id', hotLeadId)

  if (error) {
    console.error('Update Fehler:', error)
    return false
  }

  if (originalLeadId) {
    const kommentar = `TERMIN VERSCHOBEN: ${formatDate(alterTermin)} → ${formatDate(neuerTermin)}`
    await updateOriginalLeadKommentar(originalLeadId, kommentar)
  }

  return true
}

// Kommentar im Original-Lead aktualisieren
async function updateOriginalLeadKommentar(leadId, neuerKommentar) {
  console.log('Aktualisiere Lead Kommentar:', leadId)

  const { data: lead } = await supabase
    .from('leads')
    .select('kommentar')
    .eq('id', leadId)
    .single()

  const existingComment = lead?.kommentar || ''
  const now = new Date()
  const timestamp = now.toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Berlin'
  })

  const newEntry = `[${timestamp}] ${neuerKommentar}`
  const newComment = existingComment ? `${newEntry}\n${existingComment}` : newEntry

  await supabase
    .from('leads')
    .update({ kommentar: newComment })
    .eq('id', leadId)
}

// System-Messages + E-Mails an Setter & Closer senden
async function sendNotifications(hotLead, eventType, details) {
  const { setterId, closerId, unternehmen } = hotLead

  let nachricht = ''
  let typ = 'Info'
  let titel = ''
  let emailIcon = '📬'
  let emailColor = '#3B82F6'

  if (eventType === 'absage') {
    titel = 'Termin abgesagt'
    nachricht = `Termin abgesagt: ${unternehmen}\n${details.grund || 'Kein Grund angegeben'}`
    typ = 'Termin abgesagt'
    emailIcon = '❌'
    emailColor = '#EF4444'
  } else if (eventType === 'verschiebung') {
    titel = 'Termin verschoben'
    nachricht = `Termin verschoben: ${unternehmen}\nNeuer Termin: ${formatDate(details.neuerTermin)}`
    typ = 'Termin verschoben'
    emailIcon = '🔄'
    emailColor = '#F59E0B'
  }

  // User-Daten laden für E-Mail-Versand
  const userIds = [setterId, closerId].filter(Boolean)
  // Duplikate entfernen (falls Setter === Closer)
  const uniqueUserIds = [...new Set(userIds)]
  let usersData = []

  if (uniqueUserIds.length > 0) {
    const { data } = await supabase
      .from('users')
      .select('id, vor_nachname, email, email_geschaeftlich')
      .in('id', uniqueUserIds)

    usersData = data || []
  }

  // Prüfen ob Setter und Closer dieselbe Person sind
  const samePersonSetterCloser = setterId && closerId && setterId === closerId

  // System-Message + E-Mail an Setter
  if (setterId) {
    console.log('Sende Benachrichtigung an Setter:', setterId)
    await createSystemMessage(setterId, titel, nachricht, typ, hotLead.id)
    const setterUser = usersData.find(u => u.id === setterId)
    if (setterUser) {
      console.log('Setter gefunden:', setterUser.vor_nachname, setterUser.email_geschaeftlich || setterUser.email)
      await sendNotificationEmail(setterUser, titel, nachricht, typ, emailIcon, emailColor, details, unternehmen)
    } else {
      console.error('Setter nicht in usersData gefunden:', setterId)
    }
  } else {
    console.log('Kein Setter zugewiesen - keine Setter-Benachrichtigung')
  }

  // System-Message + E-Mail an Closer (nur wenn nicht dieselbe Person wie Setter)
  if (closerId && !samePersonSetterCloser) {
    console.log('Sende Benachrichtigung an Closer:', closerId)
    await createSystemMessage(closerId, titel, nachricht, typ, hotLead.id)
    const closerUser = usersData.find(u => u.id === closerId)
    if (closerUser) {
      console.log('Closer gefunden:', closerUser.vor_nachname, closerUser.email_geschaeftlich || closerUser.email)
      await sendNotificationEmail(closerUser, titel, nachricht, typ, emailIcon, emailColor, details, unternehmen)
    } else {
      console.error('Closer nicht in usersData gefunden:', closerId)
    }
  } else if (samePersonSetterCloser) {
    console.log('Closer = Setter - keine doppelte Benachrichtigung')
  } else {
    console.log('Kein Closer zugewiesen - keine Closer-Benachrichtigung')
  }

  console.log('Benachrichtigungen verarbeitet')
}

// E-Mail-Benachrichtigung senden
async function sendNotificationEmail(user, titel, nachricht, typ, icon, color, details, unternehmen) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY nicht konfiguriert - keine E-Mail gesendet')
    return
  }

  const userEmail = user.email_geschaeftlich || user.email
  if (!userEmail) {
    console.log('Keine E-Mail-Adresse für User:', user.id)
    return
  }

  const userName = user.vor_nachname || 'User'

  // Details für E-Mail aufbereiten
  let detailsHtml = ''
  if (typ === 'Termin verschoben' && details.neuerTermin) {
    detailsHtml = `
      <tr>
        <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Alter Termin:</td>
        <td style="padding: 8px 0; color: #111827; font-size: 15px; text-decoration: line-through;">${formatDate(details.alterTermin)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Neuer Termin:</td>
        <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 15px;">${formatDate(details.neuerTermin)}</td>
      </tr>`
  } else if (typ === 'Termin abgesagt' && details.grund) {
    detailsHtml = `
      <tr>
        <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Grund:</td>
        <td style="padding: 8px 0; color: #111827; font-size: 15px;">${details.grund}</td>
      </tr>`
  }

  const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">${icon}</div>
      <h1 style="color: white; margin: 0; font-size: 24px;">${titel}</h1>
    </div>
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        Hallo ${userName},
      </p>
      <div style="background: ${color}15; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid ${color};">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6B7280; font-size: 14px; width: 120px;">Unternehmen:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 15px;">${unternehmen}</td>
          </tr>
          ${detailsHtml}
        </table>
      </div>
      <div style="text-align: center; margin-top: 25px;">
        <a href="https://crmsunsideai.netlify.app/closing" style="display: inline-block; background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Im CRM ansehen
        </a>
      </div>
      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 30px; margin-bottom: 0;">
        Sunside AI GbR | Schiefer Berg 3 | 38124 Braunschweig
      </p>
    </div>
  </div>
</body>
</html>`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Sunside CRM <noreply@sunsideai.de>',
        to: userEmail,
        subject: `${icon} ${titel}: ${unternehmen}`,
        html: emailHtml
      })
    })
    console.log('E-Mail gesendet an:', userEmail)
  } catch (err) {
    console.error('E-Mail-Fehler:', err)
  }
}

// System-Message erstellen
async function createSystemMessage(empfaengerId, titel, nachricht, typ, hotLeadId) {
  const messageId = `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

  await supabase
    .from('system_messages')
    .insert({
      message_id: messageId,
      empfaenger_id: empfaengerId,
      titel,
      nachricht,
      typ,
      hot_lead_id: hotLeadId || null,
      gelesen: false
    })
}

// Admin-Info bei Direktbuchung. Fälle:
// - hotLeadId gesetzt + leadWasCreated=true  → beides frisch angelegt (Info)
// - hotLeadId gesetzt + leadWasCreated=false → existierender Cold Lead + neuer Hot Lead (Info)
// - hotLeadId=null                            → Anlage fehlgeschlagen (Warnung)
async function notifyAdminsOfDirectBooking({
  email, time, unternehmen,
  hotLeadId, leadId, leadWasCreated, matchedLeadId,
  error
}) {
  try {
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, rollen')
      .eq('status', true)

    if (usersErr) {
      console.error('notifyAdminsOfDirectBooking: users load failed', usersErr)
      return
    }

    const admins = (users || []).filter(u =>
      (u.rollen || []).some(r => String(r).toLowerCase() === 'admin')
    )

    if (admins.length === 0) {
      console.warn('notifyAdminsOfDirectBooking: keine aktiven Admins gefunden')
      return
    }

    let titel, nachricht
    if (hotLeadId) {
      titel = 'Direktbuchung – Hot Lead im Pool angelegt'
      const leadHinweis = leadWasCreated
        ? `Neuer Cold Lead angelegt (id: ${leadId}) und mit dem Hot Lead verknüpft.\n`
        : `Verknüpft mit bestehendem Cold Lead (id: ${matchedLeadId || leadId}) via Email-Match.\n`
      nachricht =
        `Kunde hat direkt über Calendly gebucht. Ein Hot Lead wurde automatisch angelegt und liegt im Closer-Pool.\n\n` +
        `E-Mail: ${email || '(keine)'}\n` +
        `Unternehmen: ${unternehmen || '(nicht angegeben)'}\n` +
        `Termin: ${formatDate(time)}\n` +
        leadHinweis +
        `\nKein Handlungsbedarf – Closer können sich den Termin aus dem Pool ziehen.`
    } else {
      titel = 'Direktbuchung – automatische Anlage fehlgeschlagen'
      nachricht =
        `Kunde hat direkt über Calendly gebucht, aber die automatische Anlage ist fehlgeschlagen.\n\n` +
        `E-Mail: ${email || '(keine)'}\n` +
        `Unternehmen: ${unternehmen || '(nicht angegeben)'}\n` +
        `Termin: ${formatDate(time)}\n` +
        (leadId ? `Cold Lead angelegt: ${leadId} (Hot-Lead-Anlage schlug fehl - Waise!)\n` : '') +
        (error ? `Fehler: ${error}\n\n` : '\n') +
        `Bitte manuell nacharbeiten.`
    }

    for (const admin of admins) {
      await createSystemMessage(admin.id, titel, nachricht, 'Direktbuchung', hotLeadId || null)
    }
    console.log('Direktbuchungs-Info an', admins.length, 'Admin(s) gesendet (hotLeadId:', hotLeadId, ', leadId:', leadId, ')')
  } catch (err) {
    console.error('notifyAdminsOfDirectBooking Fehler:', err)
  }
}
