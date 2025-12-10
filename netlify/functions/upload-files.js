// File Upload zu Cloudinary
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders }
  }

  // Prüfen ob Cloudinary konfiguriert ist
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Cloudinary nicht konfiguriert' })
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

      // Timestamp für Signatur
      const timestamp = Math.round(Date.now() / 1000)
      
      // Ordner für Organisation
      const folder = 'crm-attachments'
      
      // Signatur erstellen (für authentifizierten Upload)
      const crypto = await import('crypto')
      const signatureString = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`
      const signature = crypto.createHash('sha1').update(signatureString).digest('hex')

      // Upload zu Cloudinary
      const formData = new URLSearchParams()
      formData.append('file', file)
      formData.append('api_key', CLOUDINARY_API_KEY)
      formData.append('timestamp', timestamp.toString())
      formData.append('signature', signature)
      formData.append('folder', folder)
      
      // Resource type basierend auf Dateiformat
      const isPdf = file.includes('application/pdf') || filename?.toLowerCase().endsWith('.pdf')
      const resourceType = isPdf ? 'raw' : 'auto'

      const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      })

      const result = await response.json()

      if (result.error) {
        console.error('Cloudinary Error:', result.error)
        throw new Error(result.error.message)
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          file: {
            id: result.public_id,
            url: result.secure_url,
            filename: filename || result.original_filename || 'file',
            type: result.format || result.resource_type,
            size: result.bytes
          }
        })
      }
    }

    // DELETE: Datei löschen
    if (event.httpMethod === 'DELETE') {
      const params = event.queryStringParameters || {}
      const { public_id } = params

      if (!public_id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'public_id erforderlich' })
        }
      }

      const timestamp = Math.round(Date.now() / 1000)
      
      // Signatur für Löschung
      const crypto = await import('crypto')
      const signatureString = `public_id=${public_id}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`
      const signature = crypto.createHash('sha1').update(signatureString).digest('hex')

      // Lösch-Request
      const formData = new URLSearchParams()
      formData.append('public_id', public_id)
      formData.append('api_key', CLOUDINARY_API_KEY)
      formData.append('timestamp', timestamp.toString())
      formData.append('signature', signature)

      // Versuche als raw und als image zu löschen
      const deleteUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/destroy`
      
      const response = await fetch(deleteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      })

      const result = await response.json()

      // Falls raw nicht klappt, versuche image
      if (result.result !== 'ok') {
        const imageDeleteUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`
        await fetch(imageDeleteUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        })
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
