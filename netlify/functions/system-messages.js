// System Messages API - Supabase Version
// GET: Nachrichten für einen User laden
// POST: Neue Nachricht erstellen (+ Email senden)
// PATCH: Nachricht als gelesen markieren

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Content-Type': 'application/json'
}

const RESEND_API_KEY = process.env.RESEND_API_KEY

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

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
      const { userId, unreadOnly } = params

      if (!userId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'userId ist erforderlich' })
        }
      }

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

      if (!empfaengerId || !typ || !titel) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'empfaengerId, typ und titel sind erforderlich' })
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
            const userName = userData.vor_nachname || 'User'
            const userEmail = userData.email

            const icons = {
              'Termin abgesagt': '❌',
              'Termin verschoben': '🔄',
              'Lead gewonnen': '🎉',
              'Lead verloren': '😔',
              'Pool Update': '📢'
            }
            const icon = icons[typ] || '📬'

            const colors = {
              'Termin abgesagt': { bg: '#FEE2E2', text: '#991B1B', gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' },
              'Termin verschoben': { bg: '#FEF3C7', text: '#92400E', gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' },
              'Lead gewonnen': { bg: '#D1FAE5', text: '#065F46', gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' },
              'Lead verloren': { bg: '#FEE2E2', text: '#991B1B', gradient: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)' },
              'Pool Update': { bg: '#DBEAFE', text: '#1E40AF', gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' }
            }
            const color = colors[typ] || colors['Pool Update']

            const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: ${color.gradient}; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">${icon} ${titel}</h1>
    </div>
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        Hallo ${userName},
      </p>
      ${nachricht ? `
      <div style="background: ${color.bg}; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <p style="color: ${color.text}; margin: 0; font-size: 15px; line-height: 1.6;">
          ${nachricht}
        </p>
      </div>
      ` : ''}
      <div style="text-align: center; margin-top: 25px;">
        <a href="https://crm.sunside.ai/${typ.includes('Termin') ? 'closing' : typ.includes('Lead') ? 'dashboard' : ''}"
           style="display: inline-block; background: ${color.gradient}; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Im CRM ansehen →
        </a>
      </div>
      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 30px; margin-bottom: 0;">
        Sunside AI CRM System
      </p>
    </div>
  </div>
</body>
</html>`

            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'Sunside AI <noreply@sunside.ai>',
                to: userEmail,
                subject: `${icon} ${titel}`,
                html: emailHtml
              })
            })

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
      const { messageId, markAllRead, userId } = body

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

      const { error } = await supabase
        .from('system_messages')
        .update({ gelesen: true })
        .eq('id', messageId)

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
