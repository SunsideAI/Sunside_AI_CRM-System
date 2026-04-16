// File Upload zu Supabase Storage (ersetzt Cloudinary)
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const BUCKET_NAME = 'attachments'

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders }
  }

  // Prüfen ob Supabase konfiguriert ist
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Supabase nicht konfiguriert' })
    }
  }

  try {
    // POST: Datei hochladen
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body)
      const { file, filename } = body // file = base64 data URL

      if (!file) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Keine Datei übermittelt' })
        }
      }

      // Base64 Data URL parsen: "data:application/pdf;base64,JVBERi..."
      const matches = file.match(/^data:([^;]+);base64,(.+)$/)
      if (!matches) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Ungültiges Dateiformat' })
        }
      }

      const mimeType = matches[1]
      const base64Data = matches[2]
      const buffer = Buffer.from(base64Data, 'base64')

      // Dateiendung ermitteln
      const extMap = {
        'application/pdf': 'pdf',
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
      }
      const ext = extMap[mimeType] || filename?.split('.').pop() || 'bin'

      // Eindeutigen Dateinamen generieren
      const safeFilename = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
      const uniqueId = randomUUID()
      const storagePath = `crm/${uniqueId}_${safeFilename}`

      // Bucket erstellen falls nicht vorhanden (nur beim ersten Mal nötig)
      const { data: buckets } = await supabase.storage.listBuckets()
      if (!buckets?.find(b => b.name === BUCKET_NAME)) {
        await supabase.storage.createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: 10 * 1024 * 1024 // 10MB
        })
      }

      // Datei hochladen
      const { data, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false
        })

      if (uploadError) {
        console.error('Supabase Storage Error:', uploadError)
        throw new Error(uploadError.message)
      }

      // Öffentliche URL generieren
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath)

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          file: {
            id: storagePath, // Pfad als ID für späteres Löschen
            url: urlData.publicUrl,
            filename: filename || 'file',
            type: ext,
            size: buffer.length
          }
        })
      }
    }

    // DELETE: Datei löschen
    if (event.httpMethod === 'DELETE') {
      const params = event.queryStringParameters || {}
      const { public_id } = params // Bei Supabase ist das der Storage-Pfad

      if (!public_id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'public_id (Dateipfad) erforderlich' })
        }
      }

      // Datei löschen
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([public_id])

      if (deleteError) {
        console.error('Delete Error:', deleteError)
        // Nicht als Fehler werfen - Datei existiert evtl. nicht mehr
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, deleted: public_id })
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Upload Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}
