import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export const handler = async (event) => {
  // Allow both POST and GET for flexibility
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    // Parse body from POST or query params from GET
    let data
    if (event.httpMethod === 'POST') {
      data = JSON.parse(event.body)
    } else {
      data = event.queryStringParameters || {}
    }

    const {
      report_id,
      status,
      pdf_url,
      custom_crm_deal_id,
      error: toolError
    } = data

    console.log('SEO Callback received:', { report_id, status, custom_crm_deal_id, pdf_url: pdf_url ? 'present' : 'missing' })

    // Use custom_crm_deal_id as the hot lead ID
    const hotLeadId = custom_crm_deal_id

    if (!hotLeadId) {
      console.error('No custom_crm_deal_id in callback')
      return { statusCode: 400, body: JSON.stringify({ error: 'custom_crm_deal_id required' }) }
    }

    // Check if report failed
    if (status === 'failed' || !pdf_url) {
      console.error('SEO Report failed:', toolError)
      return { statusCode: 200, body: JSON.stringify({ success: true, note: 'Report failed, no PDF to store' }) }
    }

    // Download PDF from the provided URL
    console.log('Downloading PDF from:', pdf_url)
    const pdfResponse = await fetch(pdf_url)
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.status}`)
    }
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer())

    // Get lead info for filename
    const { data: leadData, error: fetchError } = await supabase
      .from('hot_leads')
      .select('attachments, unternehmen, lead_id')
      .eq('id', hotLeadId)
      .single()

    if (fetchError) {
      console.error('Fetch Lead Error:', fetchError)
      throw new Error('Konnte Lead-Daten nicht abrufen')
    }

    // Generate filename
    const fileId = uuidv4()
    const timestamp = new Date().toISOString().split('T')[0]
    const safeName = (leadData?.unternehmen || 'Lead').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_').substring(0, 50)
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

    const currentAttachments = leadData?.attachments || []

    // Add new attachment with SEO category
    const newAttachment = {
      id: fileId,
      url: publicUrl,
      filename: filename,
      size: pdfBuffer.length,
      type: 'application/pdf',
      category: 'seo_analysis',
      report_id: report_id,
      created_at: new Date().toISOString()
    }

    // Update lead with new attachment
    const { error: updateError } = await supabase
      .from('hot_leads')
      .update({
        attachments: [...currentAttachments, newAttachment]
      })
      .eq('id', hotLeadId)

    if (updateError) {
      console.error('Update Error:', updateError)
      throw new Error('Konnte Lead nicht aktualisieren')
    }

    // Add automatic comment to the original lead
    if (leadData?.lead_id) {
      try {
        // Get current comment from leads table
        const { data: originalLead } = await supabase
          .from('leads')
          .select('kommentar')
          .eq('id', leadData.lead_id)
          .single()

        const now = new Date()
        const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        const newComment = `[${dateStr} ${timeStr}] SEO-Analyse wurde erstellt und als PDF angehängt.`

        const existingComment = originalLead?.kommentar || ''
        const updatedComment = existingComment
          ? `${existingComment}\n\n${newComment}`
          : newComment

        await supabase
          .from('leads')
          .update({ kommentar: updatedComment })
          .eq('id', leadData.lead_id)

        console.log('Comment added to lead:', leadData.lead_id)
      } catch (commentError) {
        console.error('Comment Error (non-fatal):', commentError)
      }
    }

    console.log(`SEO Analysis PDF stored for lead ${hotLeadId}: ${publicUrl}`)

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
