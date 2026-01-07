import { useState, useEffect, useRef } from 'react'
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
  FileSpreadsheet,
  Bold,
  List,
  Link as LinkIcon
} from 'lucide-react'

// Markdown zu HTML konvertieren (für Template-Laden)
const markdownToHtml = (text) => {
  if (!text) return ''
  const str = String(text)
  
  return str
    // Markdown-Links: [Text](URL) zu klickbarem Link
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" style="color: #7c3aed; text-decoration: underline;">$1</a>')
    // Fettdruck: **text** zu <strong>
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Bullet Points am Zeilenanfang
    .replace(/^• (.+)$/gm, '• $1')
    // Zeilenumbrüche zu <br>
    .replace(/\n/g, '<br>')
}

// HTML zu Markdown konvertieren (für Speichern)
const htmlToMarkdown = (html) => {
  if (!html) return ''
  const str = String(html)
  
  return str
    // Links zu Markdown
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, '[$2]($1)')
    // Strong/Bold zu **
    .replace(/<strong>([^<]+)<\/strong>/gi, '**$1**')
    .replace(/<b>([^<]+)<\/b>/gi, '**$1**')
    // <br> zu Zeilenumbruch
    .replace(/<br\s*\/?>/gi, '\n')
    // <p> Tags behandeln (contenteditable erstellt oft <p> statt <div>)
    .replace(/<\/p>\s*<p>/gi, '\n\n')  // Absatz-Wechsel = doppelter Zeilenumbruch
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n')
    // <div> zu Zeilenumbruch (erst </div><div>, dann einzelne)
    .replace(/<\/div>\s*<div>/gi, '\n')
    .replace(/<div>/gi, '\n')
    .replace(/<\/div>/gi, '')
    // Restliche HTML-Tags entfernen
    .replace(/<[^>]+>/g, '')
    // &nbsp; zu Leerzeichen
    .replace(/&nbsp;/g, ' ')
    // HTML Entities decodieren
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // Mehrfache Zeilenumbrüche auf maximal 2 reduzieren
    .replace(/\n{3,}/g, '\n\n')
    // Führende/Trailing Zeilenumbrüche entfernen
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
}

function EmailComposer({ lead, user, onClose, onSent, inline = false, kategorie = null }) {
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  
  // Link-Popup State
  const [showLinkPopup, setShowLinkPopup] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [savedSelection, setSavedSelection] = useState(null) // Selection speichern
  const editorRef = useRef(null)
  const modalEditorRef = useRef(null)

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
  }, [kategorie])

  // E-Mail aus Lead-Daten extrahieren (Markdown-Link bereinigen)
  useEffect(() => {
    if (lead?.email) {
      setEmpfaenger(cleanEmail(lead.email))
    }
  }, [lead])

  const loadTemplates = async () => {
    try {
      // Optional nach Kategorie filtern
      const url = kategorie 
        ? `/.netlify/functions/email-templates?kategorie=${kategorie}`
        : '/.netlify/functions/email-templates'
      const response = await fetch(url)
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
      // Editor leeren
      if (editorRef.current) editorRef.current.innerHTML = ''
      if (modalEditorRef.current) modalEditorRef.current.innerHTML = ''
      setAttachments([])
      setSelectedAttachments([])
      return
    }

    const template = templates.find(t => t.id === templateId)
    if (template) {
      setBetreff(replacePlaceholders(template.betreff))
      const htmlContent = markdownToHtml(replacePlaceholders(template.inhalt))
      setInhalt(htmlContent)
      // Editor-Inhalt setzen
      if (editorRef.current) editorRef.current.innerHTML = htmlContent
      if (modalEditorRef.current) modalEditorRef.current.innerHTML = htmlContent
      
      // Attachments setzen und alle standardmäßig auswählen
      const templateAttachments = template.attachments || []
      setAttachments(templateAttachments)
      setSelectedAttachments(templateAttachments.map(a => a.id))
    }
  }

  // Editor-Inhalt aktualisieren
  const handleEditorInput = (e) => {
    setInhalt(e.target.innerHTML)
  }

  // Fett formatieren
  const formatBold = () => {
    document.execCommand('bold', false, null)
  }

  // Liste einfügen
  const formatList = () => {
    const selection = window.getSelection()
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const bullet = document.createTextNode('• ')
      range.insertNode(bullet)
      range.setStartAfter(bullet)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  // Link-Popup öffnen und Selection speichern
  const openLinkPopup = () => {
    const selection = window.getSelection()
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      setSavedSelection(range.cloneRange())
      setLinkText(selection.toString() || '')
    }
    setLinkUrl('')
    setShowLinkPopup(true)
  }

  // Link einfügen mit gespeicherter Selection
  const insertLink = () => {
    if (linkUrl && linkText) {
      const editor = inline ? editorRef.current : modalEditorRef.current
      
      // Link-Element erstellen
      const link = document.createElement('a')
      link.href = linkUrl
      link.style.color = '#7c3aed'
      link.style.textDecoration = 'underline'
      link.textContent = linkText
      
      if (savedSelection) {
        // Gespeicherte Selection verwenden
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(savedSelection)
        
        savedSelection.deleteContents()
        savedSelection.insertNode(link)
        
        // Cursor nach dem Link
        savedSelection.setStartAfter(link)
        savedSelection.collapse(true)
        selection.removeAllRanges()
        selection.addRange(savedSelection)
      } else if (editor) {
        // Fallback: Am Ende einfügen
        editor.appendChild(link)
        editor.appendChild(document.createTextNode(' '))
      }
      
      // State aktualisieren
      if (editor) {
        setInhalt(editor.innerHTML)
      }
      
      setShowLinkPopup(false)
      setLinkUrl('')
      setLinkText('')
      setSavedSelection(null)
    }
  }

  // Inhalt für Senden vorbereiten (HTML zu Markdown für Backend)
  const getContentForSend = () => {
    const editor = inline ? editorRef.current : modalEditorRef.current
    if (editor) {
      return htmlToMarkdown(editor.innerHTML)
    }
    return htmlToMarkdown(inhalt)
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
    
    // Debug: Lead- und User-Daten ausgeben
    console.log('Lead-Daten für Platzhalter:', lead)
    console.log('User-Daten für Platzhalter:', user)
    
    // Hot Leads haben andere Feldnamen als normale Leads
    const firma = lead?.unternehmensname || lead?.unternehmen || ''
    const stadt = lead?.stadt || lead?.ort || ''
    
    const replacements = {
      // Firma/Unternehmen (Lead)
      '{{firma}}': firma,
      '{{unternehmen}}': firma,
      
      // Ort (Lead)
      '{{stadt}}': stadt,
      '{{ort}}': stadt,
      
      // Lead Kontakt
      '{{lead_email}}': cleanEmail(lead?.email) || '',
      '{{lead_telefon}}': lead?.telefon || '',
      
      // Ansprechpartner (Lead)
      '{{ansprechpartner}}': `${lead?.ansprechpartnerVorname || ''} ${lead?.ansprechpartnerNachname || ''}`.trim() || '',
      '{{ansprechpartner_vorname}}': lead?.ansprechpartnerVorname || '',
      '{{ansprechpartner_nachname}}': lead?.ansprechpartnerNachname || '',
      
      // Coldcaller/Absender (User)
      '{{setter_name}}': user?.vor_nachname || '',
      '{{setter_vorname}}': (user?.vor_nachname || '').split(' ')[0] || '',
      '{{setter_nachname}}': (user?.vor_nachname || '').split(' ').slice(1).join(' ') || '',
      '{{setter_email}}': user?.email_geschaeftlich || user?.email || '',
      '{{setter_telefon}}': user?.telefon || '',
      
      // Aliase für einfachere Nutzung
      '{{mein_name}}': user?.vor_nachname || '',
      '{{meine_email}}': user?.email_geschaeftlich || user?.email || '',
      '{{mein_telefon}}': user?.telefon || ''
    }

    let result = text
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder, 'gi'), value)
    }
    
    return result
  }

  // Markdown-Link aus E-Mail entfernen
  const cleanEmail = (email) => {
    if (!email) return ''
    // Sicherstellen, dass email ein String ist
    const emailStr = String(email)
    const match = emailStr.match(/\[([^\]]+)\]\([^)]+\)/)
    return match ? match[1] : emailStr
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
    
    // Inhalt aus Editor holen
    const contentToSend = getContentForSend()
    if (!contentToSend.trim()) {
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
          content: contentToSend,
          senderName: user?.vor_nachname,
          senderEmail: user?.email_geschaeftlich || user?.email,
          senderTelefon: user?.telefon,
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
      <div className={inline ? "text-center py-8" : "fixed inset-0 flex items-center justify-center z-[10000] p-4"}>
        <div className={inline ? "" : "bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl"}>
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

  // Inline Modus - Layout wie TerminPicker
  if (inline) {
    return (
      <div className="space-y-4">
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
            Vorlage auswählen
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none bg-white"
          >
            <option value="">-- Keine Vorlage (Freitext) --</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name}
                {template.attachments?.length > 0 && ` (${template.attachments.length} Anhänge)`}
              </option>
            ))}
          </select>
        </div>

        {/* Empfänger */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">An</label>
          <input
            type="email"
            value={empfaenger}
            onChange={(e) => setEmpfaenger(e.target.value)}
            placeholder="empfaenger@email.de"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
          />
        </div>

        {/* Betreff */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Betreff</label>
          <input
            type="text"
            value={betreff}
            onChange={(e) => setBetreff(e.target.value)}
            placeholder="Betreff der E-Mail"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
          />
        </div>

        {/* Inhalt - WYSIWYG Editor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nachricht</label>
          
          {/* Formatierungs-Toolbar */}
          <div className="flex items-center gap-1 p-1.5 bg-gray-50 rounded-t-lg border border-b-0 border-gray-300">
            <button
              type="button"
              onClick={formatBold}
              className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100"
              title="Fettgedruckt (Strg+B)"
            >
              <Bold className="w-4 h-4" />
            </button>
            
            <button
              type="button"
              onClick={formatList}
              className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100"
              title="Aufzählung"
            >
              <List className="w-4 h-4" />
            </button>
            
            <div className="relative">
              <button
                type="button"
                onClick={openLinkPopup}
                className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100"
                title="Link einfügen"
              >
                <LinkIcon className="w-4 h-4" />
              </button>
              
              {/* Link-Popup */}
              {showLinkPopup && (
                <div className="absolute top-full left-0 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-64">
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={linkText}
                      onChange={(e) => setLinkText(e.target.value)}
                      placeholder="Anzeigename"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sunside-primary outline-none"
                      autoFocus
                    />
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sunside-primary outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowLinkPopup(false)
                          setSavedSelection(null)
                        }}
                        className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        onClick={insertLink}
                        disabled={!linkUrl || !linkText}
                        className="px-2 py-1 text-xs bg-sunside-primary text-white rounded hover:bg-purple-700 disabled:opacity-50"
                      >
                        Einfügen
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* WYSIWYG Editor */}
          <div
            ref={editorRef}
            contentEditable
            onInput={handleEditorInput}
            className="w-full px-4 py-3 border border-gray-300 rounded-b-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none min-h-[144px] max-h-[200px] overflow-y-auto"
            style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt', lineHeight: '1.4' }}
            data-placeholder="E-Mail-Text eingeben oder Vorlage auswählen..."
          />
          <style>{`
            [contenteditable]:empty:before {
              content: attr(data-placeholder);
              color: #9ca3af;
              pointer-events: none;
            }
          `}</style>
        </div>

        {/* Signatur Vorschau */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <p className="text-xs text-gray-400 mb-2">Signatur (wird automatisch angehängt)</p>
          <div className="text-sm text-gray-700" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt' }}>
            <p className="mb-1">Mit freundlichen Grüßen</p>
            <p className="font-semibold">{user?.vor_nachname || 'Sunside AI Team'}</p>
            <p className="text-gray-600 mb-3">KI-Entwicklung für Immobilienmakler</p>
            
            <img 
              src="https://onecdn.io/media/8c3e476c-82b3-4db6-8cbe-85b46cd452d0/full" 
              alt="Sunside AI" 
              className="h-8 mb-2"
            />
            
            <div className="flex gap-2 mb-3">
              <img 
                src="https://onecdn.io/media/a8cea175-8fcb-4f91-9d6f-f53479a9a7fe/full" 
                alt="Instagram" 
                className="w-6 h-6"
              />
              <img 
                src="https://onecdn.io/media/10252e19-d770-418d-8867-2ec8236c8d86/full" 
                alt="Website" 
                className="w-6 h-6"
              />
            </div>
            
            <p className="font-semibold text-xs">Sunside AI GbR</p>
            <p className="text-xs text-gray-600">
              Schiefer Berg 3 | 38124 Braunschweig | Deutschland<br />
              E-Mail: {user?.email_geschaeftlich || user?.email || 'contact@sunsideai.de'} | Tel: {user?.telefon || '+49 176 56039050'}<br />
              <span className="text-purple-600">www.sunsideai.de</span> | 
              <span className="text-purple-600 ml-1">Jetzt Termin buchen</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">Geschäftsführung: Paul Probodziak und Niklas Schwerin</p>
            
            <div className="flex gap-2 mt-2">
              <img 
                src="https://onecdn.io/media/9de8d686-0a97-42a7-b7a6-8cf0fa4c6e95/full" 
                alt="Coursera Badge" 
                className="h-12"
              />
              <img 
                src="https://onecdn.io/media/2c4b8d13-4b19-4898-bd71-9b52f053ee57/full" 
                alt="Make Badge" 
                className="h-12"
              />
            </div>
            <p className="text-xs text-gray-600 mt-1 italic"><strong>Wir sind zertifizierte IBM KI-Entwickler und Make Automatisierungsexperten.</strong></p>
          </div>
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anhänge ({selectedAttachments.length} ausgewählt)
            </label>
            <div className="space-y-2">
              {attachments.map(att => {
                const FileIcon = getFileIcon(att.type)
                const isSelected = selectedAttachments.includes(att.id)
                return (
                  <label key={att.id} className={`flex items-center p-3 border rounded-lg cursor-pointer ${isSelected ? 'border-sunside-primary bg-purple-50' : 'border-gray-200'}`}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleAttachment(att.id)} className="w-4 h-4 text-sunside-primary" />
                    <FileIcon className={`w-5 h-5 ml-3 ${isSelected ? 'text-sunside-primary' : 'text-gray-400'}`} />
                    <span className="ml-3 text-sm truncate">{att.filename}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions - wie TerminPicker */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !empfaenger || !betreff || !inhalt}
            className="px-6 py-2 bg-sunside-primary text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Wird gesendet...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {selectedAttachments.length > 0 ? `E-Mail senden (${selectedAttachments.length})` : 'E-Mail senden'}
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
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

          {/* Inhalt - WYSIWYG Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nachricht
            </label>
            
            {/* Formatierungs-Toolbar */}
            <div className="flex items-center gap-1 p-1.5 bg-gray-50 rounded-t-lg border border-b-0 border-gray-300">
              <button
                type="button"
                onClick={formatBold}
                className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100"
                title="Fettgedruckt (Strg+B)"
              >
                <Bold className="w-4 h-4" />
              </button>
              
              <button
                type="button"
                onClick={formatList}
                className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100"
                title="Aufzählung"
              >
                <List className="w-4 h-4" />
              </button>
              
              <div className="relative">
                <button
                  type="button"
                  onClick={openLinkPopup}
                  className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Link einfügen"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>
                
                {/* Link-Popup */}
                {showLinkPopup && (
                  <div className="absolute top-full left-0 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-64">
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={linkText}
                        onChange={(e) => setLinkText(e.target.value)}
                        placeholder="Anzeigename"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sunside-primary outline-none"
                        autoFocus
                      />
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sunside-primary outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowLinkPopup(false)
                            setSavedSelection(null)
                          }}
                          className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                        >
                          Abbrechen
                        </button>
                        <button
                          type="button"
                          onClick={insertLink}
                          disabled={!linkUrl || !linkText}
                          className="px-2 py-1 text-xs bg-sunside-primary text-white rounded hover:bg-purple-700 disabled:opacity-50"
                        >
                          Einfügen
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* WYSIWYG Editor */}
            <div
              ref={modalEditorRef}
              contentEditable
              onInput={handleEditorInput}
              className="w-full px-4 py-3 border border-gray-300 rounded-b-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none min-h-[240px] max-h-[300px] overflow-y-auto"
              style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt', lineHeight: '1.4' }}
              data-placeholder="E-Mail-Text eingeben oder Vorlage auswählen..."
            />
            <p className="text-xs text-gray-400 mt-1">
              Platzhalter: {'{{ansprechpartner}}'}, {'{{ansprechpartner_vorname}}'}, {'{{firma}}'}, {'{{stadt}}'}, {'{{setter_name}}'}, {'{{setter_vorname}}'}, {'{{setter_email}}'}, {'{{setter_telefon}}'}
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
