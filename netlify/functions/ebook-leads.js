// E-Book Leads API - Supabase Version
// Empfängt Leads vom E-Book Funnel und verwaltet den E-Book Pool
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const RESEND_API_KEY = process.env.RESEND_API_KEY

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Content-Type': 'application/json'
}

// Alle Vertriebler (Setter) Emails laden
async function loadVertrieblerEmails() {
  try {
    const { data: users } = await supabase
      .from('users')
      .select('email_geschaeftlich, email, vor_nachname, rollen')
      .eq('status', true)

    return (users || [])
      .filter(u => {
        const rollen = u.rollen || []
        return rollen.some(r =>
          r.toLowerCase().includes('setter') ||
          r.toLowerCase().includes('coldcaller') ||
          r.toLowerCase() === 'admin'
        )
      })
      .map(u => ({
        email: u.email_geschaeftlich || u.email,
        name: u.vor_nachname || 'Vertriebler'
      }))
      .filter(v => v.email)
  } catch (err) {
    console.error('Fehler beim Laden der Vertriebler:', err)
    return []
  }
}

// Benachrichtigungs-Email an alle Vertriebler senden
async function notifyVertrieblers(vertriebler, leadData) {
  if (!RESEND_API_KEY || vertriebler.length === 0) {
    console.log('Keine Vertriebler-Benachrichtigung')
    return
  }

  const emailAddresses = vertriebler.map(v => v.email)

  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #F3F4F6; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Neuer E-Book Lead!</h1>
    </div>
    <div style="padding: 30px;">
      <p>Ein neuer Lead hat sich ueber das E-Book angemeldet!</p>
      <div style="background-color: #FEF3C7; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%;">
          <tr><td style="padding: 8px 0; color: #666;">Name:</td><td style="font-weight: bold;">${leadData.vorname} ${leadData.nachname}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Unternehmen:</td><td style="font-weight: bold;">${leadData.unternehmen || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">E-Mail:</td><td style="font-weight: bold;">${leadData.email}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Telefon:</td><td style="font-weight: bold;">${leadData.telefon || '-'}</td></tr>
        </table>
      </div>
      <div style="text-align: center; margin-top: 20px;">
        <a href="https://crm.sunside.ai/kaltakquise" style="display: inline-block; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Jetzt im E-Book Pool uebernehmen
        </a>
      </div>
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
        from: 'Sunside AI CRM <team@sunsideai.de>',
        to: emailAddresses,
        subject: `Neuer E-Book Lead: ${leadData.vorname} ${leadData.nachname} - ${leadData.unternehmen || 'Unbekannt'}`,
        html: htmlContent
      })
    })
    console.log('Vertriebler-Benachrichtigung gesendet')
  } catch (err) {
    console.error('Fehler beim Senden der Benachrichtigung:', err)
  }
}

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
    // GET: E-Book Pool Leads laden (ohne Vertriebler zugewiesen)
    if (event.httpMethod === 'GET') {
      // E-Book Leads ohne Assignment laden
      const { data: assignments } = await supabase
        .from('lead_assignments')
        .select('lead_id')

      const assignedLeadIds = (assignments || []).map(a => a.lead_id)

      let query = supabase
        .from('leads')
        .select('*')
        .eq('quelle', 'E-Book')
        .order('datum', { ascending: false })

      const { data: leads, error } = await query

      if (error) throw new Error(error.message)

      // Im Code filtern: Nur Leads ohne Assignment
      const poolLeads = (leads || [])
        .filter(lead => !assignedLeadIds.includes(lead.id))
        .map(record => ({
          id: record.id,
          unternehmensname: record.unternehmensname || '',
          ansprechpartnerVorname: record.ansprechpartner_vorname || '',
          ansprechpartnerNachname: record.ansprechpartner_nachname || '',
          kategorie: record.kategorie || '',
          email: record.mail || '',
          telefon: record.telefonnummer || '',
          ort: record.stadt || '',
          bundesland: record.bundesland || '',
          land: record.land || 'Deutschland',
          website: record.website || '',
          quelle: record.quelle || '',
          datum: record.datum || '',
          kommentar: record.kommentar || '',
          ergebnis: record.ergebnis || '',
          kontaktiert: record.bereits_kontaktiert === true
        }))

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ leads: poolLeads, count: poolLeads.length })
      }
    }

    // POST: Neuen E-Book Lead erstellen (Webhook vom Funnel)
    if (event.httpMethod === 'POST') {
      let parsedBody = {}
      try {
        parsedBody = JSON.parse(event.body)
      } catch (e) {
        console.log('Body is not JSON')
      }

      // Felder extrahieren
      let vorname, nachname, email, telefon, unternehmen, kategorie

      if (parsedBody[''] && typeof parsedBody[''] === 'string') {
        try {
          const dataObj = JSON.parse(parsedBody[''])
          vorname = dataObj.vorname
          nachname = dataObj.nachname
          email = dataObj.email
          telefon = dataObj.telefon
          unternehmen = dataObj.unternehmen
          kategorie = dataObj.kategorie
        } catch (e) {}
      } else if (parsedBody.email) {
        vorname = parsedBody.vorname
        nachname = parsedBody.nachname
        email = parsedBody.email
        telefon = parsedBody.telefon
        unternehmen = parsedBody.unternehmen
        kategorie = parsedBody.kategorie
      } else if (parsedBody.data && typeof parsedBody.data === 'object') {
        vorname = parsedBody.data.vorname
        nachname = parsedBody.data.nachname
        email = parsedBody.data.email
        telefon = parsedBody.data.telefon
        unternehmen = parsedBody.data.unternehmen
        kategorie = parsedBody.data.kategorie
      }

      if (!email) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'E-Mail ist erforderlich' })
        }
      }

      // Duplikat-Check
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .or(`mail.ilike.${email}${telefon ? `,telefonnummer.eq.${telefon}` : ''}`)
        .limit(1)

      if (existing && existing.length > 0) {
        return {
          statusCode: 409,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Lead bereits vorhanden',
            existingLeadId: existing[0].id
          })
        }
      }

      // Neuen Lead erstellen
      const now = new Date()
      const timestamp = now.toLocaleDateString('de-DE') + ', ' + now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

      const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
          unternehmensname: unternehmen || '',
          ansprechpartner_vorname: vorname || '',
          ansprechpartner_nachname: nachname || '',
          mail: email,
          telefonnummer: telefon || '',
          kategorie: kategorie === 'Sachverständiger' ? 'Sachverständiger' : 'Immobilienmakler',
          quelle: 'E-Book',
          datum: now.toISOString().split('T')[0],
          land: 'Deutschland',
          kommentar: `[${timestamp}] Lead ueber E-Book Funnel eingegangen`
        })
        .select()
        .single()

      if (error) throw new Error(error.message)

      console.log('E-Book Lead erstellt:', newLead.id)

      // Alle Vertriebler benachrichtigen
      const vertriebler = await loadVertrieblerEmails()
      await notifyVertrieblers(vertriebler, { vorname, nachname, email, telefon, unternehmen, kategorie })

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'E-Book Lead erfolgreich erstellt',
          leadId: newLead.id
        })
      }
    }

    // PATCH: Lead aus Pool übernehmen (Vertriebler zuweisen)
    if (event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body)
      const { leadId, vertrieblerName, vertrieblerId } = body
      const id = leadId || body.id

      if (!id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'leadId ist erforderlich' })
        }
      }

      if (!vertrieblerName && !vertrieblerId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'vertrieblerName oder vertrieblerId ist erforderlich' })
        }
      }

      // Vertriebler ID ermitteln
      let assigneeId = vertrieblerId
      if (!assigneeId && vertrieblerName) {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .ilike('vor_nachname', vertrieblerName)
          .limit(1)

        if (userData && userData.length > 0) {
          assigneeId = userData[0].id
        }
      }

      if (!assigneeId) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Vertriebler nicht gefunden' })
        }
      }

      // Assignment erstellen
      await supabase
        .from('lead_assignments')
        .insert({ lead_id: id, user_id: assigneeId })

      // Kommentar aktualisieren
      const { data: leadData } = await supabase
        .from('leads')
        .select('kommentar')
        .eq('id', id)
        .single()

      const currentKommentar = leadData?.kommentar || ''
      const now = new Date()
      const timestamp = now.toLocaleDateString('de-DE') + ', ' + now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      const newEntry = `[${timestamp}] Lead aus E-Book Pool uebernommen von ${vertrieblerName}`

      await supabase
        .from('leads')
        .update({ kommentar: `${newEntry}\n${currentKommentar}` })
        .eq('id', id)

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: `Lead wurde ${vertrieblerName} zugewiesen`
        })
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Methode nicht erlaubt' })
    }

  } catch (error) {
    console.error('E-Book Leads Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}
