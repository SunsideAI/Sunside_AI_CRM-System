import { useState, useEffect } from 'react'
import { 
  Mail, 
  Send, 
  X, 
  Loader2, 
  Check, 
  AlertCircle,
  FileText,
  User,
  ChevronDown,
  Paperclip,
  File,
  Image,
  FileSpreadsheet
} from 'lucide-react'

function EmailComposer({ lead, user, onClose, onSent }) {
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // E-Mail Felder (alle editierbar)
  const [empfaenger, setEmpfaenger] = useState(lead?.email || '')
  const [betreff, setBetreff] = useState('')
  const [inhalt, setInhalt] = useState('')
  
  // Attachments
  const [attachments, setAttachments] = useState([])
  const [selectedAttachments, setSelectedAttachments] = useState([])

  // Templates laden
  useEffect(() => {
    loadTemplates()
  }, [])

  // E-Mail aus Lead-Daten extrahieren (Markdown-Link bereinigen)
  useEffect(() => {
    if (lead?.email) {
      setEmpfaenger(cleanEmail(lead.email))
    }
  }, [lead])

  const loadTemplates = async () => {
    try {
      const response = await fetch('/.netlify/functions/email-templates')
      const data = await response.json()
      
      if (response.ok) {
        setTemplates(data.templates || [])
      }
    } catch (err) {
      console.error('Templates laden fehlgeschlagen:', err)
    } finally {
      setLoading(false)
    }
  }

  // Template auswählen und Platzhalter ersetzen
  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId)
    
    if (!templateId) {
      setBetreff('')
      setInhalt('')
      setAttachments([])
      setSelectedAttachments([])
      return
    }

    const template = templates.find(t => t.id === templateId)
    if (template) {
      setBetreff(replacePlaceholders(template.betreff))
      setInhalt(replacePlaceholders(template.inhalt))
      
      // Attachments setzen und alle standardmäßig auswählen
      const templateAttachments = template.attachments || []
      setAttachments(templateAttachments)
      setSelectedAttachments(templateAttachments.map(a => a.id))
    }
  }

  // Attachment auswählen/abwählen
  const toggleAttachment = (attachmentId) => {
    setSelectedAttachments(prev => {
      if (prev.includes(attachmentId)) {
        return prev.filter(id => id !== attachmentId)
      } else {
        return [...prev, attachmentId]
      }
    })
  }

  // Platzhalter im Text ersetzen
  const replacePlaceholders = (text) => {
    if (!text) return ''
    
    const replacements = {
      '{{firma}}': lead?.unternehmensname || lead?.firma || '',
      '{{ansprechpartner}}': getAnsprechpartner(),
      '{{vorname}}': lead?.vorname || '',
      '{{nachname}}': lead?.nachname || '',
      '{{stadt}}': lead?.stadt || '',
      '{{bundesland}}': lead?.bundesland || '',
      '{{setter_name}}': user?.vor_nachname || '',
      '{{setter_vorname}}': user?.vor_nachname?.split(' ')[0] || '',
      '{{setter_email}}': user?.email_geschaeftlich || user?.email || '',
      '{{setter_telefon}}': user?.telefon || ''
    }

    let result = text
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder, 'g'), value)
    }
    
    return result
  }

  // Ansprechpartner aus Lead extrahieren
  const getAnsprechpartner = () => {
    if (lead?.vorname && lead?.nachname) {
      return `${lead.vorname} ${lead.nachname}`
    }
    if (lead?.ansprechpartner) return lead.ansprechpartner
    if (lead?.nachname) return lead.nachname
    return ''
  }

  // Markdown-Link aus E-Mail entfernen
  const cleanEmail = (email) => {
    if (!email) return ''
    const match = email.match(/\[([^\]]+)\]\([^)]+\)/)
    return match ? match[1] : email
  }

  // Datei-Icon basierend auf Typ
  const getFileIcon = (type) => {
    if (!type) return File
    if (type.includes('image')) return Image
    if (type.includes('spreadsheet') || type.includes('excel')) return FileSpreadsheet
    if (type.includes('pdf')) return FileText
    return File
  }

  // Dateigröße formatieren
  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // E-Mail senden
  const handleSend = async () => {
    setError('')

    // Validierung
    if (!empfaenger || !empfaenger.includes('@')) {
      setError('Bitte gültige Empfänger-E-Mail eingeben')
      return
    }
    if (!betreff.trim()) {
      setError('Bitte Betreff eingeben')
      return
    }
    if (!inhalt.trim()) {
      setError('Bitte E-Mail-Text eingeben')
      return
    }

    setSending(true)

    try {
      // Nur ausgewählte Attachments senden
      const attachmentsToSend = attachments.filter(a => selectedAttachments.includes(a.id))

      const response = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: empfaenger,
          subject: betreff,
          content: inhalt,
          senderName: user?.vor_nachname,
          senderEmail: user?.email_geschaeftlich || user?.email,
          replyTo: user?.email_geschaeftlich || user?.email,
          leadId: lead?.id,
          templateName: templates.find(t => t.id === selectedTemplate)?.name || 'Individuell',
          userId: user?.id,
          attachments: attachmentsToSend
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'E-Mail konnte nicht gesendet werden')
      }

      setSuccess(true)
      
      // Nach 1.5s schließen
      setTimeout(() => {
        onSent && onSent({
          empfaenger,
          betreff,
          template: templates.find(t => t.id === selectedTemplate)?.name,
          attachmentCount: attachmentsToSend.length
        })
        onClose()
      }, 1500)

    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  // Erfolgs-Ansicht
  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            E-Mail gesendet!
          </h3>
          <p className="text-gray-500">
            Die E-Mail wurde erfolgreich an {empfaenger} gesendet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
              <Mail className="w-5 h-5 text-sunside-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Unterlagen senden
              </h2>
              <p className="text-sm text-gray-500">
                {lead?.unternehmensname || lead?.firma || 'Lead'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Error */}
          {error && (
            <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Template Auswahl */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText className="w-4 h-4 inline mr-1" />
              Vorlage auswählen
            </label>
            <div className="relative">
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg appearance-none focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none bg-white"
              >
                <option value="">-- Keine Vorlage (Freitext) --</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.attachments?.length > 0 && ` (${template.attachments.length} Anhänge)`}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Empfänger */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              An
            </label>
            <input
              type="email"
              value={empfaenger}
              onChange={(e) => setEmpfaenger(e.target.value)}
              placeholder="empfaenger@email.de"
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none ${
                empfaenger && !empfaenger.includes('@') ? 'border-red-300' : 'border-gray-300'
              }`}
            />
          </div>

          {/* Betreff */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Betreff
            </label>
            <input
              type="text"
              value={betreff}
              onChange={(e) => setBetreff(e.target.value)}
              placeholder="Betreff der E-Mail"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
            />
          </div>

          {/* Inhalt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nachricht
            </label>
            <textarea
              value={inhalt}
              onChange={(e) => setInhalt(e.target.value)}
              placeholder="E-Mail-Text eingeben oder Vorlage auswählen..."
              rows={10}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none resize-none font-mono text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Platzhalter: {'{{firma}}'}, {'{{ansprechpartner}}'}, {'{{stadt}}'}, {'{{setter_name}}'}, {'{{setter_email}}'}
            </p>
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Paperclip className="w-4 h-4 inline mr-1" />
                Anhänge ({selectedAttachments.length} von {attachments.length} ausgewählt)
              </label>
              <div className="space-y-2">
                {attachments.map(att => {
                  const FileIcon = getFileIcon(att.type)
                  const isSelected = selectedAttachments.includes(att.id)
                  
                  return (
                    <label
                      key={att.id}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-sunside-primary bg-purple-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAttachment(att.id)}
                        className="w-4 h-4 text-sunside-primary border-gray-300 rounded focus:ring-sunside-primary"
                      />
                      <FileIcon className={`w-5 h-5 ml-3 ${isSelected ? 'text-sunside-primary' : 'text-gray-400'}`} />
                      <div className="ml-3 flex-1 min-w-0">
                        <p className={`text-sm truncate ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                          {att.filename}
                        </p>
                        {att.size && (
                          <p className="text-xs text-gray-400">{formatFileSize(att.size)}</p>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Absender Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center text-sm text-gray-600">
              <User className="w-4 h-4 mr-2 text-gray-400" />
              <span className="font-medium">Absender:</span>
              <span className="ml-2">
                {user?.vor_nachname} &lt;{user?.email_geschaeftlich || user?.email}&gt;
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-gray-700 hover:text-gray-900 font-medium"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !empfaenger || !betreff || !inhalt}
            className="flex items-center px-6 py-2.5 bg-sunside-primary text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Wird gesendet...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {selectedAttachments.length > 0 
                  ? `Senden (${selectedAttachments.length} Anhänge)` 
                  : 'E-Mail senden'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EmailComposer
