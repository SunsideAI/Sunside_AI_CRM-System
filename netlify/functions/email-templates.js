// Email Templates CRUD API - Supabase Version
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Gültige Kategorien
const VALID_CATEGORIES = ['Kaltakquise', 'Closing', 'Allgemein']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json'
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
    // GET: Alle aktiven Templates laden
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const includeInactive = params.all === 'true'
      const kategorie = params.kategorie

      let query = supabase
        .from('email_templates')
        .select(`
          *,
          email_template_attachments(id, url, filename, size, type)
        `)

      if (!includeInactive) {
        query = query.eq('aktiv', true)
      }

      if (kategorie) {
        query = query.or(`kategorie.eq.${kategorie},kategorie.eq.Allgemein,kategorie.is.null`)
      }

      const { data: templates, error } = await query

      if (error) {
        throw new Error(error.message)
      }

      const formattedTemplates = (templates || []).map(record => ({
        id: record.id,
        name: record.name || '',
        betreff: record.betreff || '',
        inhalt: record.inhalt || '',
        aktiv: record.aktiv !== false,
        kategorie: record.kategorie || 'Allgemein',
        attachments: (record.email_template_attachments || []).map(att => ({
          id: att.id,
          filename: att.filename,
          url: att.url,
          type: att.type,
          size: att.size
        }))
      }))

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ templates: formattedTemplates })
      }
    }

    // POST: Neues Template erstellen (Admin only)
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body)
      const { name, betreff, inhalt, aktiv = true, kategorie = 'Allgemein', attachments = [] } = body

      if (!name || !betreff || !inhalt) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Name, Betreff und Inhalt sind erforderlich' })
        }
      }

      // Template erstellen
      const { data: newTemplate, error } = await supabase
        .from('email_templates')
        .insert({
          name,
          betreff,
          inhalt,
          aktiv,
          kategorie: VALID_CATEGORIES.includes(kategorie) ? kategorie : 'Allgemein'
        })
        .select()
        .single()

      if (error) {
        throw new Error(error.message)
      }

      // Attachments hinzufügen wenn vorhanden
      if (attachments.length > 0 && newTemplate) {
        const attachmentRecords = attachments.map(att => ({
          template_id: newTemplate.id,
          url: att.url,
          filename: att.filename,
          size: att.size || 0,
          type: att.type || 'application/octet-stream'
        }))

        await supabase
          .from('email_template_attachments')
          .insert(attachmentRecords)
      }

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          template: {
            id: newTemplate.id,
            name: newTemplate.name,
            betreff: newTemplate.betreff,
            inhalt: newTemplate.inhalt,
            aktiv: newTemplate.aktiv,
            kategorie: newTemplate.kategorie || 'Allgemein',
            attachments: attachments
          }
        })
      }
    }

    // PATCH: Template aktualisieren (Admin only)
    if (event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body)
      const { id, name, betreff, inhalt, aktiv, kategorie, attachments } = body

      if (!id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Template ID erforderlich' })
        }
      }

      const fields = {}
      if (name !== undefined) fields.name = name
      if (betreff !== undefined) fields.betreff = betreff
      if (inhalt !== undefined) fields.inhalt = inhalt
      if (aktiv !== undefined) fields.aktiv = aktiv
      if (kategorie !== undefined) {
        fields.kategorie = VALID_CATEGORIES.includes(kategorie) ? kategorie : 'Allgemein'
      }

      const { data: updatedTemplate, error } = await supabase
        .from('email_templates')
        .update(fields)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw new Error(error.message)
      }

      // Attachments aktualisieren wenn vorhanden
      if (attachments !== undefined) {
        // Alte löschen
        await supabase
          .from('email_template_attachments')
          .delete()
          .eq('template_id', id)

        // Neue hinzufügen
        if (attachments.length > 0) {
          const attachmentRecords = attachments.map(att => ({
            template_id: id,
            url: att.url,
            filename: att.filename,
            size: att.size || 0,
            type: att.type || 'application/octet-stream'
          }))

          await supabase
            .from('email_template_attachments')
            .insert(attachmentRecords)
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          template: {
            id: updatedTemplate.id,
            name: updatedTemplate.name,
            betreff: updatedTemplate.betreff,
            inhalt: updatedTemplate.inhalt,
            aktiv: updatedTemplate.aktiv,
            kategorie: updatedTemplate.kategorie || 'Allgemein',
            attachments: attachments || []
          }
        })
      }
    }

    // DELETE: Template löschen (Admin only)
    if (event.httpMethod === 'DELETE') {
      const params = event.queryStringParameters || {}
      const { id } = params

      if (!id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Template ID erforderlich' })
        }
      }

      // Attachments werden durch CASCADE gelöscht
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id)

      if (error) {
        throw new Error(error.message)
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, deleted: id })
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Email Templates Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}
