// Netlify Function: User-Verwaltung (CRUD) - Supabase
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json'
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Server nicht konfiguriert' })
    }
  }

  try {
    switch (event.httpMethod) {
      case 'GET':
        return await getUsers()
      case 'POST':
        return await createUser(JSON.parse(event.body))
      case 'PATCH':
        return await updateUser(JSON.parse(event.body))
      case 'DELETE':
        return await deleteUser(JSON.parse(event.body))
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
async function getUsers() {
  console.log('Fetching users from Supabase')

  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('vor_nachname', { ascending: true })

  if (error) {
    console.error('Supabase Error:', error)
    throw new Error('Datenbank-Fehler: ' + error.message)
  }

  const mappedUsers = users.map(user => ({
    id: user.id,
    vor_nachname: user.vor_nachname || '',
    email: user.email || '',
    email_geschaeftlich: user.email_geschaeftlich || '',
    rolle: user.rollen || [],
    status: user.status === true,
    telefon: user.telefon || '',
    strasse: user.strasse || '',
    plz: user.plz || '',
    ort: user.ort || '',
    bundesland: user.bundesland || '',
    google_calendar_id: user.google_calendar_id || '',
    onboarding: user.onboarding || false,
    hasPassword: !!(user.password_hash && user.password_hash.length > 0)
  }))

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ users: mappedUsers })
  }
}

// POST - Neuen User erstellen
async function createUser(data) {
  const { vor_nachname, vorname, nachname, email, email_geschaeftlich, telefon, strasse, plz, ort, bundesland, rolle, onboarding } = data

  if (!email) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'E-Mail ist erforderlich' })
    }
  }

  // Prüfen ob E-Mail bereits existiert
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .ilike('email', email)
    .limit(1)

  if (existing && existing.length > 0) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'E-Mail existiert bereits' })
    }
  }

  // User erstellen
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      vorname: vorname || null,
      nachname: nachname || null,
      email: email,
      email_geschaeftlich: email_geschaeftlich || null,
      telefon: telefon || null,
      strasse: strasse || null,
      plz: plz || null,
      ort: ort || null,
      bundesland: bundesland || null,
      rollen: rolle || [],
      status: true,
      onboarding: onboarding || false
    })
    .select()
    .single()

  if (error) {
    console.error('Create User Error:', error)
    throw new Error(error.message || 'User konnte nicht erstellt werden')
  }

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      user: {
        id: newUser.id,
        vor_nachname: newUser.vor_nachname,
        email: newUser.email
      }
    })
  }
}

// PATCH - User aktualisieren
async function updateUser(data) {
  const { id, ...updateData } = data

  if (!id) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'User ID ist erforderlich' })
    }
  }

  // Felder für Supabase mappen
  const fields = {}

  if (updateData.vorname !== undefined) fields.vorname = updateData.vorname || null
  if (updateData.nachname !== undefined) fields.nachname = updateData.nachname || null
  if (updateData.email !== undefined) fields.email = updateData.email
  if (updateData.email_geschaeftlich !== undefined) fields.email_geschaeftlich = updateData.email_geschaeftlich || null
  if (updateData.telefon !== undefined) fields.telefon = updateData.telefon || null
  if (updateData.strasse !== undefined) fields.strasse = updateData.strasse || null
  if (updateData.plz !== undefined) fields.plz = updateData.plz || null
  if (updateData.ort !== undefined) fields.ort = updateData.ort || null
  if (updateData.bundesland !== undefined) fields.bundesland = updateData.bundesland || null
  if (updateData.rolle !== undefined) fields.rollen = updateData.rolle
  if (updateData.status !== undefined) fields.status = updateData.status
  if (updateData.onboarding !== undefined) fields.onboarding = updateData.onboarding || false
  if (updateData.google_calendar_id !== undefined) fields.google_calendar_id = updateData.google_calendar_id || null

  const { data: updatedUser, error } = await supabase
    .from('users')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Update User Error:', error)
    throw new Error(error.message || 'User konnte nicht aktualisiert werden')
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      user: {
        id: updatedUser.id,
        vor_nachname: updatedUser.vor_nachname
      }
    })
  }
}

// DELETE - User deaktivieren (nicht löschen, nur Status auf false)
async function deleteUser(data) {
  const { id } = data

  if (!id) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'User ID ist erforderlich' })
    }
  }

  // User deaktivieren statt löschen
  const { error } = await supabase
    .from('users')
    .update({ status: false })
    .eq('id', id)

  if (error) {
    console.error('Delete User Error:', error)
    throw new Error(error.message || 'User konnte nicht deaktiviert werden')
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
