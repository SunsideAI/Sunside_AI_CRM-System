// Netlify Function: User-Verwaltung (CRUD)
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json'
}

const TABLE_NAME = 'User_Datenbank'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Server nicht konfiguriert' })
    }
  }

  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`

  try {
    switch (event.httpMethod) {
      case 'GET':
        return await getUsers(TABLE_URL, airtableHeaders)
      case 'POST':
        return await createUser(JSON.parse(event.body), TABLE_URL, airtableHeaders)
      case 'PATCH':
        return await updateUser(JSON.parse(event.body), TABLE_URL, airtableHeaders)
      case 'DELETE':
        return await deleteUser(JSON.parse(event.body), TABLE_URL, airtableHeaders)
      default:
        return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
    }
  } catch (error) {
    console.error('Users Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}

// GET - Alle User laden
async function getUsers(TABLE_URL, airtableHeaders) {
  // Basis-Felder die sicher existieren
  const url = `${TABLE_URL}?fields[]=Vor_Nachname&fields[]=E-Mail&fields[]=E-Mail_Geschäftlich&fields[]=Rolle&fields[]=Status&fields[]=Telefon&fields[]=Bundesland&fields[]=Google_Calendar_ID&fields[]=Passwort&fields[]=Onboarding&fields[]=Straße&fields[]=PLZ&fields[]=Ort`
  
  console.log('Fetching users from:', TABLE_URL)
  
  const response = await fetch(url, { headers: airtableHeaders })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Airtable Response Error:', response.status, errorText)
    throw new Error('Airtable Fehler: ' + response.status)
  }

  const data = await response.json()

  const users = data.records.map(record => ({
    id: record.id,
    vor_nachname: record.fields.Vor_Nachname || '',
    email: record.fields['E-Mail'] || '',
    email_geschaeftlich: record.fields['E-Mail_Geschäftlich'] || '',
    rolle: record.fields.Rolle || [],
    status: record.fields.Status !== false,
    telefon: record.fields.Telefon || '',
    strasse: record.fields['Straße'] || '',
    plz: record.fields.PLZ || '',
    ort: record.fields.Ort || '',
    bundesland: record.fields.Bundesland || '',
    google_calendar_id: record.fields.Google_Calendar_ID || '',
    onboarding: record.fields.Onboarding || '',
    hasPassword: !!(record.fields.Passwort && record.fields.Passwort.length > 0)
  }))

  users.sort((a, b) => a.vor_nachname.localeCompare(b.vor_nachname))

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ users })
  }
}

// POST - Neuen User erstellen
async function createUser(data, TABLE_URL, airtableHeaders) {
  const { vor_nachname, vorname, nachname, email, email_geschaeftlich, telefon, strasse, plz, ort, bundesland, rolle, onboarding } = data

  if (!vor_nachname || !email) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Name und E-Mail sind erforderlich' })
    }
  }

  // Prüfen ob E-Mail bereits existiert
  const checkUrl = `${TABLE_URL}?filterByFormula={E-Mail}="${email}"`
  const checkResponse = await fetch(checkUrl, { headers: airtableHeaders })
  const checkData = await checkResponse.json()

  if (checkData.records && checkData.records.length > 0) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'E-Mail existiert bereits' })
    }
  }

  // User erstellen
  const response = await fetch(TABLE_URL, {
    method: 'POST',
    headers: airtableHeaders,
    body: JSON.stringify({
      fields: {
        'Vor_Nachname': vor_nachname,
        'Vorname': vorname || null,
        'Name': nachname || null,
        'E-Mail': email,
        'E-Mail_Geschäftlich': email_geschaeftlich || null,
        'Telefon': telefon || null,
        'Straße': strasse || null,
        'PLZ': plz ? parseInt(plz, 10) : null,
        'Ort': ort || null,
        'Bundesland': bundesland || null,
        'Rolle': rolle || [],
        'Status': true,
        'Onboarding': onboarding || null
      }
    })
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error?.message || 'User konnte nicht erstellt werden')
  }

  const result = await response.json()

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      user: {
        id: result.id,
        vor_nachname: result.fields.Vor_Nachname,
        email: result.fields['E-Mail']
      }
    })
  }
}

// PATCH - User aktualisieren
async function updateUser(data, TABLE_URL, airtableHeaders) {
  const { id, ...updateData } = data

  if (!id) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'User ID ist erforderlich' })
    }
  }

  // Felder für Airtable mappen
  const fields = {}
  
  if (updateData.vor_nachname !== undefined) fields['Vor_Nachname'] = updateData.vor_nachname || null
  if (updateData.vorname !== undefined) fields['Vorname'] = updateData.vorname || null
  if (updateData.nachname !== undefined) fields['Name'] = updateData.nachname || null
  if (updateData.email !== undefined) fields['E-Mail'] = updateData.email
  if (updateData.email_geschaeftlich !== undefined) fields['E-Mail_Geschäftlich'] = updateData.email_geschaeftlich || null
  if (updateData.telefon !== undefined) fields['Telefon'] = updateData.telefon || null
  if (updateData.strasse !== undefined) fields['Straße'] = updateData.strasse || null
  if (updateData.plz !== undefined) fields['PLZ'] = updateData.plz ? parseInt(updateData.plz, 10) : null
  if (updateData.ort !== undefined) fields['Ort'] = updateData.ort || null
  if (updateData.bundesland !== undefined) fields['Bundesland'] = updateData.bundesland || null
  if (updateData.rolle !== undefined) fields['Rolle'] = updateData.rolle
  if (updateData.status !== undefined) fields['Status'] = updateData.status
  if (updateData.onboarding !== undefined) fields['Onboarding'] = updateData.onboarding || null
  if (updateData.google_calendar_id !== undefined) fields['Google_Calendar_ID'] = updateData.google_calendar_id || null

  const response = await fetch(`${TABLE_URL}/${id}`, {
    method: 'PATCH',
    headers: airtableHeaders,
    body: JSON.stringify({ fields })
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error?.message || 'User konnte nicht aktualisiert werden')
  }

  const result = await response.json()

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      user: {
        id: result.id,
        vor_nachname: result.fields.Vor_Nachname
      }
    })
  }
}

// DELETE - User deaktivieren (nicht löschen, nur Status auf false)
async function deleteUser(data, TABLE_URL, airtableHeaders) {
  const { id } = data

  if (!id) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'User ID ist erforderlich' })
    }
  }

  // User deaktivieren statt löschen
  const response = await fetch(`${TABLE_URL}/${id}`, {
    method: 'PATCH',
    headers: airtableHeaders,
    body: JSON.stringify({
      fields: {
        'Status': false
      }
    })
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error?.message || 'User konnte nicht deaktiviert werden')
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      message: 'User wurde deaktiviert'
    })
  }
}
