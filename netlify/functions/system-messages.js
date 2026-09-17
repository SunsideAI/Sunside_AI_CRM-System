// System Messages API - Supabase Version
// GET: Nachrichten für einen User laden
// POST: Neue Nachricht erstellen (+ Email senden)
// PATCH: Nachricht als gelesen markieren

import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'
import { hotLeadVerlangen, verboten } from './utils/zugriff.js'
import { systemMailSenden } from './utils/mailLayout.js'
import { crmNachricht } from './utils/mails.js'

// Die Typen aus dem message_type-Enum der Datenbank. Ein freier String liesse
// sich als Ueberschrift in die Mail schreiben.
const ERLAUBTE_TYPEN = [
  'Termin abgesagt', 'Termin verschoben', 'Lead gewonnen', 'Lead verloren',
  'Pool Update', 'Direktbuchung', 'termin_rescheduled', 'Info',
  // Fehlte: Das Closing schickt diesen Typ, wenn ein geplatzter Termin neu
  // gelegt wurde. Er stand nicht in der Liste, der Aufruf lief in ein 400,
  // und der Fehler wurde verschluckt - die Meldung kam also nie an.
  'no_show', 'no_show_rescheduled'
]

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Content-Type': 'application/json'
}

const RESEND_API_KEY = process.env.RESEND_API_KEY

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  // Identitaet kommt aus dem Sitzungs-Token, nicht aus der Anfrage.
  const zugang = anmeldungVerlangen(event)
  if (zugang.antwort) return zugang.antwort
  const angemeldet = zugang.nutzer


  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Server nicht konfiguriert' })
    }
  }

  try {
    // GET: Nachrichten für User laden
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      // Man liest das eigene Postfach. Vorher genuegte ?userId=<fremde ID>,
      // um die Nachrichten eines Kollegen zu lesen.
      const { unreadOnly } = params
      const userId = angemeldet.id

      console.log('Loading System Messages for userId:', userId)

      let query = supabase
        .from('system_messages')
        .select('*')
        .eq('empfaenger_id', userId)
        .order('erstellt_am', { ascending: false })

      if (unreadOnly === 'true') {
        query = query.eq('gelesen', false)
      }

      const { data: messages, error } = await query

      if (error) {
        throw new Error(error.message)
      }

      const formattedMessages = (messages || []).map(record => ({
        id: record.id,
        messageId: record.message_id,
        typ: record.typ,
        titel: record.titel,
        nachricht: record.nachricht,
        hotLeadId: record.hot_lead_id || null,
        gelesen: record.gelesen || false,
        erstelltAm: record.erstellt_am || new Date().toISOString()
      }))

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ messages: formattedMessages })
      }
    }

    // POST: Neue Nachricht erstellen + Email senden
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body)
      const {
        empfaengerId,
        typ,
        titel,
        nachricht,
        hotLeadId,
        sendEmail = true
      } = body

      // Diese Nachrichten verschicken Closer und Opener im normalen Ablauf
      // (Lead verloren, Termin abgesagt). Eine Admin-Sperre wuerde die
      // Benachrichtigungen abwuergen. Die Gefahr liegt woanders: Titel und Text
      // gingen ungeprueft in eine Mail vom System-Absender. Deshalb eine feste
      // Werteliste fuer den Typ und Maskierung statt einer Rollensperre.
      if (!ERLAUBTE_TYPEN.includes(typ)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: `Unbekannter Nachrichtentyp: ${typ}` })
        }
      }

      if (!empfaengerId || !typ || !titel) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'empfaengerId, typ und titel sind erforderlich' })
        }
      }

      // Nachrichten gehen zwischen den Beteiligten eines Kontakts hin und her.
      // Ohne diese Pruefung liess sich jedem Kollegen eine Mail vom
      // System-Absender schicken.
      if (!angemeldet.istAdmin) {
        if (!hotLeadId) return verboten('Nachrichten gehören zu einem Kontakt')
        const gesperrt = await hotLeadVerlangen(supabase, angemeldet, hotLeadId)
        if (gesperrt) return gesperrt
        const { data: kontakt } = await supabase
          .from('hot_leads').select('opener_id, setter_id, closer_id').eq('id', hotLeadId).maybeSingle()
        if (![kontakt?.opener_id, kontakt?.setter_id, kontakt?.closer_id].includes(empfaengerId)) {
          return verboten('Der Empfänger gehört nicht zu diesem Kontakt')
        }
      }

      const messageId = `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      console.log('Creating System Message:', { messageId, empfaengerId, typ, titel })

      // Nachricht erstellen
      const { data: createdMessage, error: createError } = await supabase
        .from('system_messages')
        .insert({
          message_id: messageId,
          empfaenger_id: empfaengerId,
          typ,
          titel,
          nachricht: nachricht || '',
          hot_lead_id: hotLeadId || null,
          gelesen: false
        })
        .select()
        .single()

      if (createError) {
        console.error('Supabase Error:', createError)
        throw new Error(createError.message)
      }

      console.log('Message created:', createdMessage.id)

      // Email an Empfänger senden
      if (sendEmail && RESEND_API_KEY) {
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('email, vor_nachname')
            .eq('id', empfaengerId)
            .single()

          if (userData?.email) {
            const userEmail = userData.email
            const { betreff, mail } = crmNachricht({ typ, titel, nachricht })
            await systemMailSenden({ an: userEmail, betreff, mail })

            console.log('Email sent to:', userEmail)
          }
        } catch (emailError) {
          console.error('Email-Fehler:', emailError)
        }
      }

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Nachricht erstellt',
          id: createdMessage.id,
          messageId: messageId
        })
      }
    }

    // PATCH: Nachricht als gelesen markieren
    if (event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body)
      // Als gelesen markiert man nur die eigenen Nachrichten.
      const { messageId, markAllRead } = body
      const userId = angemeldet.id

      if (markAllRead && userId) {
        const { data: updated, error } = await supabase
          .from('system_messages')
          .update({ gelesen: true })
          .eq('empfaenger_id', userId)
          .eq('gelesen', false)
          .select()

        if (error) {
          throw new Error(error.message)
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ success: true, updated: updated?.length || 0 })
        }
      }

      if (!messageId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'messageId ist erforderlich' })
        }
      }

      // Nur eigene Nachrichten. Ohne diese Bedingung liesse sich jede fremde
      // Nachricht als gelesen markieren, wenn man ihre ID kennt.
      const { error } = await supabase
        .from('system_messages')
        .update({ gelesen: true })
        .eq('id', messageId)
        .eq('empfaenger_id', userId)

      if (error) {
        throw new Error(error.message)
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true })
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('System Messages Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}
