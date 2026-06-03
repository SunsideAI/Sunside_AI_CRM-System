import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { reference_id, pdf_url, pdf_base64, company_name } = JSON.parse(event.body)

    if (!reference_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'reference_id required' }) }
    }

    if (!pdf_url && !pdf_base64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'pdf_url or pdf_base64 required' }) }
    }

    // Download PDF from external URL or use base64
    let pdfBuffer
    if (pdf_base64) {
      pdfBuffer = Buffer.from(pdf_base64, 'base64')
    } else {
      const pdfResponse = await fetch(pdf_url)
      if (!pdfResponse.ok) {
        throw new Error(`Failed to download PDF: ${pdfResponse.status}`)
      }
      pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer())
    }

    // Generate filename
    const fileId = uuidv4()
    const timestamp = new Date().toISOString().split('T')[0]
    const safeName = (company_name || 'Lead').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_').substring(0, 50)
    const filename = `SEO_Analyse_${safeName}_${timestamp}.pdf`
    const storagePath = `crm/${fileId}_${filename}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError)
      throw new Error('Konnte PDF nicht hochladen')
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('attachments')
      .getPublicUrl(storagePath)

    const publicUrl = urlData.publicUrl

    // Get current attachments from hot lead
    const { data: leadData, error: fetchError } = await supabase
      .from('hot_leads')
      .select('attachments')
      .eq('id', reference_id)
      .single()

    if (fetchError) {
      console.error('Fetch Lead Error:', fetchError)
      throw new Error('Konnte Lead-Daten nicht abrufen')
    }

    const currentAttachments = leadData?.attachments || []

    // Add new attachment with SEO category
    const newAttachment = {
      id: fileId,
      url: publicUrl,
      filename: filename,
      size: pdfBuffer.length,
      type: 'application/pdf',
      category: 'seo_analysis',
      created_at: new Date().toISOString()
    }

    // Update lead with new attachment
    const { error: updateError } = await supabase
      .from('hot_leads')
      .update({
        attachments: [...currentAttachments, newAttachment]
      })
      .eq('id', reference_id)

    if (updateError) {
      console.error('Update Error:', updateError)
      throw new Error('Konnte Lead nicht aktualisieren')
    }

    console.log(`SEO Analysis PDF stored for lead ${reference_id}: ${publicUrl}`)

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, attachment_id: fileId })
    }
  } catch (error) {
    console.error('SEO Callback Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}
