// No-Show Benachrichtigungen
// Sendet In-App-Notification und E-Mail an Setter bei No-Show

import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'
import { hotLeadVerlangen, verboten } from './utils/zugriff.js'
import { systemMailSenden } from './utils/mailLayout.js'
import { nichtErschienen } from './utils/mails.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  // Diese Function las als einzige von 26 SUPABASE_SERVICE_ROLE_KEY - alle
  // anderen SUPABASE_SERVICE_KEY. Ist nur der gaengige Name gesetzt, bekam
  // der Client hier undefined und jede Abfrage scheiterte still. Beide Namen
  // werden akzeptiert, damit es unabhaengig von der Netlify-Konfiguration
  // laeuft.
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  // Identitaet kommt aus dem Sitzungs-Token, nicht aus der Anfrage.
  const zugang = anmeldungVerlangen(event)
  if (zugang.antwort) return zugang.antwort
  const angemeldet = zugang.nutzer


  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const {
      hotLeadId,
      setterId,
      closerId,
      // closerName kommt nicht mehr aus der Anfrage: Die Meldung "X hat als
      // nicht erschienen markiert" ist eine Urheberschaftsbehauptung und stand
      // jedem frei. Sie kommt jetzt aus dem Token.
      closerName: _ignoriert,
      unternehmen,
      ansprechpartner,
      terminDatum,
      noShowCount
    } = JSON.parse(event.body)

    if (!hotLeadId || !setterId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'hotLeadId und setterId sind erforderlich' })
      }
    }

    // Melden darf, wer am Kontakt beteiligt ist - und nur an jemanden, der
    // es auch ist. Vorher liess sich jedem Kollegen eine Mail schicken.
    const gesperrt = await hotLeadVerlangen(supabase, angemeldet, hotLeadId)
    if (gesperrt) return gesperrt
    const { data: kontakt } = await supabase
      .from('hot_leads').select('opener_id, setter_id, closer_id').eq('id', hotLeadId).maybeSingle()
    if (!angemeldet.istAdmin && ![kontakt?.opener_id, kontakt?.setter_id, kontakt?.closer_id].includes(setterId)) {
      return verboten('Der Empfänger gehört nicht zu diesem Kontakt')
    }

    // Setter-Daten laden
    const { data: setter, error: setterError } = await supabase
      .from('users')
      .select('id, vor_nachname, email, email_geschaeftlich')
      .eq('id', setterId)
      .single()

    if (setterError || !setter) {
      console.error('[notify-no-show] Setter nicht gefunden:', setterError)
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Setter nicht gefunden' })
      }
    }

    // 1. In-App-Benachrichtigung erstellen
    const messageId = `NOSHOW-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const titel = `Nicht erschienen: ${unternehmen}`
    const closerName = angemeldet.name || 'Ein Closer'

    const nachricht = `${closerName || 'Closer'} hat ${ansprechpartner || 'den Ansprechpartner'} (${unternehmen}) als nicht erschienen markiert. Bitte neuen Termin vereinbaren.`

    const { error: msgError } = await supabase
      .from('system_messages')
      .insert({
        message_id: messageId,
        empfaenger_id: setterId,
        typ: 'no_show',
        titel,
        nachricht,
        hot_lead_id: hotLeadId,
        gelesen: false
      })

    if (msgError) {
      console.error('[notify-no-show] Fehler beim Erstellen der System-Message:', msgError)
    } else {
      console.log('[notify-no-show] In-App-Benachrichtigung erstellt für Setter:', setter.vor_nachname)
    }

    // 2. E-Mail an Setter senden
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const setterEmail = setter.email_geschaeftlich || setter.email

    if (RESEND_API_KEY && setterEmail) {
      const terminFormatted = terminDatum
        ? new Date(terminDatum).toLocaleString('de-DE', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Berlin'
          }) + ' Uhr'
        : null

      const { betreff, mail } = nichtErschienen({
        gemeldetVon: closerName,
        unternehmen,
        ansprechpartner,
        termin: terminFormatted,
        anzahl: noShowCount
      })

      try {
        const emailResponse = await systemMailSenden({ an: setterEmail, betreff, mail })

        if (emailResponse.ok) {
          console.log('[notify-no-show] E-Mail gesendet an:', setterEmail)
        } else {
          const emailError = await emailResponse.text()
          console.error('[notify-no-show] E-Mail-Versand fehlgeschlagen:', emailError)
        }
      } catch (emailErr) {
        console.error('[notify-no-show] E-Mail-Fehler:', emailErr)
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: 'Notifications sent' })
    }

  } catch (err) {
    console.error('[notify-no-show] Fehler:', err)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    }
  }
}
