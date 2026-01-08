// E-Book Leads API - Empfängt Leads vom E-Book Funnel und verwaltet den E-Book Pool
const RESEND_API_KEY = process.env.RESEND_API_KEY

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Content-Type': 'application/json'
}

// Alle Vertriebler (Coldcaller) laden
async function loadVertrieblerEmails(airtableHeaders, baseId) {
  try {
    const url = `https://api.airtable.com/v0/${baseId}/User_Datenbank?filterByFormula=OR(FIND("Coldcaller", ARRAYJOIN({Rolle}, ",")), FIND("Admin", ARRAYJOIN({Rolle}, ",")))`
    const response = await fetch(url, { headers: airtableHeaders })
    const data = await response.json()
    
    return data.records
      .filter(r => r.fields['E-Mail'] || r.fields['E-Mail_Geschäftlich'])
      .map(r => ({
        email: r.fields['E-Mail_Geschäftlich'] || r.fields['E-Mail'],
        name: r.fields.Vor_Nachname || 'Vertriebler'
      }))
  } catch (err) {
    console.error('Fehler beim Laden der Vertriebler:', err)
    return []
  }
}

// Benachrichtigungs-Email an alle Vertriebler senden
async function notifyVertrieblers(vertriebler, leadData) {
  if (!RESEND_API_KEY || vertriebler.length === 0) {
    console.log('Keine Vertriebler-Benachrichtigung (kein API Key oder keine Vertriebler)')
    return
  }

  const emailAddresses = vertriebler.map(v => v.email)
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; background-color: #F3F4F6; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🔥 Neuer E-Book Lead!</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">
        Ein warmer Lead wartet im Pool
      </p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <p style="color: #374151; margin: 0 0 20px 0; font-size: 15px;">
        Ein neuer Lead hat sich über das E-Book angemeldet und wartet darauf, kontaktiert zu werden!
      </p>
      
      <!-- Lead-Details Box -->
      <div style="background-color: #FEF3C7; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #F59E0B;">
        <h3 style="margin: 0 0 15px 0; color: #92400E; font-size: 16px;">Lead-Details</h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666666; width: 140px;">👤 Name:</td>
            <td style="padding: 8px 0; color: #333333; font-weight: 600;">${leadData.vorname} ${leadData.nachname}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666666;">🏢 Unternehmen:</td>
            <td style="padding: 8px 0; color: #333333; font-weight: 600;">${leadData.unternehmen || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666666;">📧 E-Mail:</td>
            <td style="padding: 8px 0; color: #333333; font-weight: 600;">${leadData.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666666;">📞 Telefon:</td>
            <td style="padding: 8px 0; color: #333333; font-weight: 600;">${leadData.telefon || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666666;">🏷️ Kategorie:</td>
            <td style="padding: 8px 0; color: #333333; font-weight: 600;">${leadData.kategorie || 'Immobilienmakler'}</td>
          </tr>
        </table>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://crmsunsideai.netlify.app/kaltakquise" 
           style="display: inline-block; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Jetzt im E-Book Pool übernehmen →
        </a>
      </div>
      
      <p style="margin: 20px 0 0 0; color: #888888; font-size: 13px; text-align: center;">
        ⚡ Wer zuerst kommt, mahlt zuerst!
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #F9FAFB; padding: 20px 30px; border-top: 1px solid #E5E7EB;">
      <div style="text-align: center;">
        <img src="https://onecdn.io/media/8c3e476c-82b3-4db6-8cbe-85b46cd452d0/full" 
             alt="Sunside AI" width="120" style="margin-bottom: 10px;">
        <p style="margin: 0; color: #888888; font-size: 12px;">
          Diese E-Mail wurde automatisch vom Sunside AI CRM versendet.
        </p>
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
        subject: `🔥 Neuer E-Book Lead: ${leadData.vorname} ${leadData.nachname} - ${leadData.unternehmen || 'Unbekannt'}`,
        html: htmlContent
      })
    })
    console.log('Vertriebler-Benachrichtigung gesendet an:', emailAddresses.length, 'Empfänger')
  } catch (err) {
    console.error('Fehler beim Senden der Benachrichtigung:', err)
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
  const LEADS_TABLE = 'Immobilienmakler_Leads'

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Airtable nicht konfiguriert' })
    }
  }

  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(LEADS_TABLE)}`

  // ==========================================
  // GET: E-Book Pool Leads laden (ohne Vertriebler zugewiesen)
  // ==========================================
  if (event.httpMethod === 'GET') {
    try {
      // Filter: Quelle = "E-Book" UND User_Datenbank ist leer (Pool)
      const filterFormula = `AND({Quelle} = "E-Book", OR({User_Datenbank} = BLANK(), {User_Datenbank} = ""))`
      
      const url = `${TABLE_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=Datum&sort[0][direction]=desc`
      
      const response = await fetch(url, { headers: airtableHeaders })
      
      if (!response.ok) {
        const error = await response.json()
        console.error('Airtable Error:', error)
        throw new Error('Fehler beim Laden der E-Book Leads')
      }

      const data = await response.json()
      
      const leads = data.records.map(record => ({
        id: record.id,
        unternehmensname: record.fields.Unternehmensname || '',
        ansprechpartnerVorname: record.fields.Ansprechpartner_Vorname || '',
        ansprechpartnerNachname: record.fields.Ansprechpartner_Nachname || '',
        kategorie: record.fields.Kategorie || '',
        email: record.fields.Mail || '',
        telefon: record.fields.Telefonnummer || '',
        ort: record.fields.Ort || '',
        bundesland: record.fields.Bundesland || '',
        land: record.fields.Land || 'Deutschland',
        website: record.fields.Website || '',
        quelle: record.fields.Quelle || '',
        datum: record.fields.Datum || '',
        kommentar: record.fields.Kommentar || '',
        ergebnis: record.fields.Ergebnis || '',
        kontaktiert: record.fields['Bereits_kontaktiert'] === 'X'
      }))

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          leads,
          count: leads.length
        })
      }
    } catch (err) {
      console.error('GET Error:', err)
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: err.message })
      }
    }
  }

  // ==========================================
  // POST: Neuen E-Book Lead erstellen (Webhook vom Funnel)
  // ==========================================
  if (event.httpMethod === 'POST') {
    try {
      console.log('=== INCOMING WEBHOOK ===')
      console.log('Raw event.body:', event.body)
      
      let parsedBody = {}
      try {
        parsedBody = JSON.parse(event.body)
      } catch (e) {
        console.log('Body is not JSON')
      }
      
      console.log('Parsed body keys:', Object.keys(parsedBody))
      console.log('Parsed body:', JSON.stringify(parsedBody))
      
      // Extrahiere die Felder - probiere verschiedene Strukturen
      let vorname, nachname, email, telefon, unternehmen, kategorie
      
      // Möglichkeit 1: Direkte Felder im Body (email direkt vorhanden)
      if (parsedBody.email) {
        console.log('Format: Direct fields')
        vorname = parsedBody.vorname
        nachname = parsedBody.nachname
        email = parsedBody.email
        telefon = parsedBody.telefon
        unternehmen = parsedBody.unternehmen
        kategorie = parsedBody.kategorie
      }
      // Möglichkeit 2: data ist ein Objekt mit email
      else if (parsedBody.data && typeof parsedBody.data === 'object' && parsedBody.data.email) {
        console.log('Format: data is object with email')
        vorname = parsedBody.data.vorname
        nachname = parsedBody.data.nachname
        email = parsedBody.data.email
        telefon = parsedBody.data.telefon
        unternehmen = parsedBody.data.unternehmen
        kategorie = parsedBody.data.kategorie
      }
      // Möglichkeit 3: data ist ein JSON-String
      else if (parsedBody.data && typeof parsedBody.data === 'string') {
        console.log('Format: data is string, length:', parsedBody.data.length)
        console.log('Data string preview:', parsedBody.data.substring(0, 200))
        
        // Versuche JSON zu parsen
        let dataStr = parsedBody.data.trim()
        
        // Falls es mit { anfängt, ist es JSON
        if (dataStr.startsWith('{')) {
          try {
            const dataObj = JSON.parse(dataStr)
            console.log('Parsed data object:', JSON.stringify(dataObj))
            vorname = dataObj.vorname
            nachname = dataObj.nachname
            email = dataObj.email
            telefon = dataObj.telefon
            unternehmen = dataObj.unternehmen
            kategorie = dataObj.kategorie
          } catch (e) {
            console.log('Could not parse data as JSON:', e.message)
          }
        }
      }
      
      // Möglichkeit 4: Felder sind direkt im Body aber mit anderen Namen
      if (!email) {
        console.log('Trying alternative field names...')
        email = parsedBody.Email || parsedBody.EMAIL || parsedBody.e_mail || parsedBody['e-mail']
        vorname = parsedBody.Vorname || parsedBody.VORNAME || parsedBody.first_name || parsedBody.firstName
        nachname = parsedBody.Nachname || parsedBody.NACHNAME || parsedBody.last_name || parsedBody.lastName
        telefon = parsedBody.Telefon || parsedBody.TELEFON || parsedBody.phone || parsedBody.Phone
        unternehmen = parsedBody.Unternehmen || parsedBody.UNTERNEHMEN || parsedBody.company || parsedBody.Company
        kategorie = parsedBody.Kategorie || parsedBody.KATEGORIE || parsedBody.category
      }
      
      console.log('Final extracted fields:', { vorname, nachname, email, telefon, unternehmen, kategorie })

      // Validierung
      if (!email) {
        console.log('ERROR: No email found!')
        console.log('Full parsedBody for debugging:', JSON.stringify(parsedBody, null, 2))
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'E-Mail ist erforderlich',
            debug: {
              receivedKeys: Object.keys(parsedBody),
              hasData: !!parsedBody.data,
              dataType: typeof parsedBody.data
            }
          })
        }
      }

      // Duplikat-Check: Email oder Telefon bereits vorhanden?
      let duplicateFilter = `{Mail} = "${email}"`
      if (telefon) {
        duplicateFilter = `OR({Mail} = "${email}", {Telefonnummer} = "${telefon}")`
      }
      
      const duplicateCheck = await fetch(
        `${TABLE_URL}?filterByFormula=${encodeURIComponent(duplicateFilter)}&maxRecords=1`,
        { headers: airtableHeaders }
      )
      const duplicateData = await duplicateCheck.json()
      
      if (duplicateData.records && duplicateData.records.length > 0) {
        console.log('Duplikat gefunden:', duplicateData.records[0].id)
        return {
          statusCode: 409, // Conflict
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Lead bereits vorhanden',
            existingLeadId: duplicateData.records[0].id,
            message: 'Ein Lead mit dieser E-Mail oder Telefonnummer existiert bereits.'
          })
        }
      }

      // Neuen Lead erstellen
      const newLeadFields = {
        'Unternehmensname': unternehmen || '',
        'Ansprechpartner_Vorname': vorname || '',
        'Ansprechpartner_Nachname': nachname || '',
        'Mail': email,
        'Telefonnummer': telefon || '',
        'Kategorie': kategorie === 'Sachverständiger' ? 'Sachverständiger' : 'Immobilienmakler',
        'Quelle': 'E-Book',
        'Datum': new Date().toISOString().split('T')[0],
        'Land': 'Deutschland',
        'Kommentar': `[${new Date().toLocaleDateString('de-DE')}, ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}] 📚 Lead über E-Book Funnel eingegangen`
        // User_Datenbank bleibt leer = Pool
      }

      const createResponse = await fetch(TABLE_URL, {
        method: 'POST',
        headers: airtableHeaders,
        body: JSON.stringify({ fields: newLeadFields })
      })

      if (!createResponse.ok) {
        const error = await createResponse.json()
        console.error('Airtable Create Error:', error)
        throw new Error('Fehler beim Erstellen des Leads')
      }

      const createdLead = await createResponse.json()
      console.log('E-Book Lead erstellt:', createdLead.id)

      // Alle Vertriebler benachrichtigen
      const vertriebler = await loadVertrieblerEmails(airtableHeaders, AIRTABLE_BASE_ID)
      await notifyVertrieblers(vertriebler, {
        vorname: vorname || '',
        nachname: nachname || '',
        email,
        telefon: telefon || '',
        unternehmen: unternehmen || '',
        kategorie: kategorie || 'Immobilienmakler'
      })

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'E-Book Lead erfolgreich erstellt',
          leadId: createdLead.id
        })
      }
    } catch (err) {
      console.error('POST Error:', err)
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: err.message })
      }
    }
  }

  // ==========================================
  // PATCH: Lead aus Pool übernehmen (Vertriebler zuweisen)
  // ==========================================
  if (event.httpMethod === 'PATCH') {
    try {
      const body = JSON.parse(event.body)
      const { leadId, vertrieblerName, vertrieblerId } = body

      // leadId oder id akzeptieren
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

      // Vertriebler ID ermitteln falls nur Name gegeben
      let assigneeId = vertrieblerId
      if (!assigneeId && vertrieblerName) {
        // User-ID anhand des Namens finden
        const userUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/User_Datenbank?filterByFormula={Vor_Nachname} = "${vertrieblerName}"&maxRecords=1`
        const userResponse = await fetch(userUrl, { headers: airtableHeaders })
        const userData = await userResponse.json()
        
        if (userData.records && userData.records.length > 0) {
          assigneeId = userData.records[0].id
        }
      }

      // Lead aktualisieren - Vertriebler zuweisen
      const updateFields = {}
      
      if (assigneeId) {
        updateFields['User_Datenbank'] = [assigneeId]
      } else if (vertrieblerName) {
        // Fallback: Name als Text (sollte nicht passieren)
        console.warn('Vertriebler-ID nicht gefunden, verwende Name:', vertrieblerName)
      }

      // History-Eintrag hinzufügen
      const leadResponse = await fetch(`${TABLE_URL}/${id}`, { headers: airtableHeaders })
      const leadData = await leadResponse.json()
      const currentKommentar = leadData.fields?.Kommentar || ''
      
      const timestamp = `[${new Date().toLocaleDateString('de-DE')}, ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}]`
      const newEntry = `${timestamp} 👤 Lead aus E-Book Pool übernommen von ${vertrieblerName}`
      updateFields['Kommentar'] = `${newEntry}\n${currentKommentar}`

      const updateResponse = await fetch(`${TABLE_URL}/${id}`, {
        method: 'PATCH',
        headers: airtableHeaders,
        body: JSON.stringify({ fields: updateFields })
      })

      if (!updateResponse.ok) {
        const error = await updateResponse.json()
        console.error('Airtable Update Error:', error)
        throw new Error('Fehler beim Zuweisen des Leads')
      }

      const updatedLead = await updateResponse.json()

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: `Lead wurde ${vertrieblerName} zugewiesen`,
          lead: updatedLead
        })
      }
    } catch (err) {
      console.error('PATCH Error:', err)
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: err.message })
      }
    }
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Methode nicht erlaubt' })
  }
}
