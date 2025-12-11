import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { 
  FileText, 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  Check,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Info,
  Link as LinkIcon,
  Edit3,
  Bold,
  List
} from 'lucide-react'

// Markdown zu HTML konvertieren (für Editor)
const markdownToHtml = (text) => {
  if (!text) return ''
  
  return text
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
  
  return html
    // Links zu Markdown
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, '[$2]($1)')
    // Strong/Bold zu **
    .replace(/<strong>([^<]+)<\/strong>/gi, '**$1**')
    .replace(/<b>([^<]+)<\/b>/gi, '**$1**')
    // <br> zu Zeilenumbruch
    .replace(/<br\s*\/?>/gi, '\n')
    // <div> zu Zeilenumbruch
    .replace(/<\/div><div>/gi, '\n')
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
    // Führende Zeilenumbrüche entfernen
    .replace(/^\n+/, '')
}

// Markdown-ähnlichen Text zu formatiertem HTML rendern (für Vorschau in Liste)
const renderFormattedPreview = (text) => {
  if (!text) return ''
  
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" class="text-purple-600 underline">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^• (.+)$/gm, '<span class="flex items-start"><span class="mr-2">•</span><span>$1</span></span>')
    .replace(/\n/g, '<br>')
}

function EmailTemplateManager() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Editor Ref
  const editorRef = useRef(null)

  // Editor State
  const [editMode, setEditMode] = useState(false) // 'create' | 'edit' | false
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Form State
  const [formName, setFormName] = useState('')
  const [formBetreff, setFormBetreff] = useState('')
  const [formInhalt, setFormInhalt] = useState('')
  const [formAktiv, setFormAktiv] = useState(true)
  
  // Attachments State
  const [formAttachments, setFormAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  
  // Link-Popup State
  const [showLinkPopup, setShowLinkPopup] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [savedSelection, setSavedSelection] = useState(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const response = await fetch('/.netlify/functions/email-templates?all=true')
      const data = await response.json()
      
      if (response.ok) {
        setTemplates(data.templates || [])
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      setError('Templates konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  const openCreateMode = () => {
    setFormName('')
    setFormBetreff('')
    setFormInhalt('')
    setFormAktiv(true)
    setFormAttachments([])
    setEditingTemplate(null)
    setEditMode('create')
    setShowPreview(false)
    setError('')
    setUploadError('')
    // Editor leeren (nach nächstem Render)
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = ''
    }, 0)
  }

  const openEditMode = (template) => {
    setFormName(template.name)
    setFormBetreff(template.betreff)
    // Markdown zu HTML konvertieren für Editor
    const htmlContent = markdownToHtml(template.inhalt)
    setFormInhalt(htmlContent)
    setFormAktiv(template.aktiv)
    // Bestehende Attachments laden
    setFormAttachments(template.attachments || [])
    setEditingTemplate(template)
    setEditMode('edit')
    setShowPreview(false)
    setError('')
    setUploadError('')
    // Editor-Inhalt setzen (nach nächstem Render)
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = htmlContent
    }, 0)
  }

  const closeEditor = () => {
    setEditMode(false)
    setEditingTemplate(null)
    setFormAttachments([])
    setShowPreview(false)
    setError('')
    setUploadError('')
  }

  // WYSIWYG Editor Funktionen
  const handleEditorInput = (e) => {
    setFormInhalt(e.target.innerHTML)
  }

  const formatBold = () => {
    document.execCommand('bold', false, null)
    editorRef.current?.focus()
  }

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
    editorRef.current?.focus()
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

  const insertLinkInEditor = () => {
    if (linkUrl && linkText) {
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
      } else if (editorRef.current) {
        // Fallback: Am Ende einfügen
        editorRef.current.appendChild(link)
        editorRef.current.appendChild(document.createTextNode(' '))
      }
      
      // State aktualisieren
      if (editorRef.current) {
        setFormInhalt(editorRef.current.innerHTML)
      }
      
      setShowLinkPopup(false)
      setLinkUrl('')
      setLinkText('')
      setSavedSelection(null)
      editorRef.current?.focus()
    }
  }

  // Datei hochladen
  const handleFileUpload = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setUploadError('')

    for (const file of files) {
      try {
        // File zu Base64 konvertieren
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        // Upload zu Cloudinary
        const response = await fetch('/.netlify/functions/upload-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: base64,
            filename: file.name
          })
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Upload fehlgeschlagen')
        }

        // Zur Attachment-Liste hinzufügen
        setFormAttachments(prev => [...prev, {
          id: result.file.id,
          url: result.file.url,
          filename: result.file.filename,
          type: result.file.type,
          size: result.file.size
        }])

      } catch (err) {
        console.error('Upload Error:', err)
        setUploadError(`Fehler beim Upload von ${file.name}: ${err.message}`)
      }
    }

    setUploading(false)
    // Input zurücksetzen
    e.target.value = ''
  }

  // Datei löschen
  const handleDeleteAttachment = async (attachment) => {
    // Aus der Liste entfernen
    setFormAttachments(prev => prev.filter(a => a.url !== attachment.url))
    
    // Optional: Auch von Cloudinary löschen (nur wenn es eine Cloudinary-URL ist)
    if (attachment.id && attachment.url?.includes('cloudinary')) {
      try {
        await fetch(`/.netlify/functions/upload-file?public_id=${encodeURIComponent(attachment.id)}`, {
          method: 'DELETE'
        })
      } catch (err) {
        console.error('Delete Error:', err)
      }
    }
  }

  // Dateigröße formatieren
  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleSave = async () => {
    // Inhalt aus Editor holen und zu Markdown konvertieren
    const editorContent = editorRef.current ? editorRef.current.innerHTML : formInhalt
    const markdownContent = htmlToMarkdown(editorContent)
    
    // Validierung
    if (!formName.trim()) {
      setError('Bitte Namen eingeben')
      return
    }
    if (!formBetreff.trim()) {
      setError('Bitte Betreff eingeben')
      return
    }
    if (!markdownContent.trim()) {
      setError('Bitte Inhalt eingeben')
      return
    }

    setSaving(true)
    setError('')

    try {
      const payload = {
        name: formName,
        betreff: formBetreff,
        inhalt: markdownContent, // Markdown für Backend
        aktiv: formAktiv,
        attachments: formAttachments.map(att => ({
          url: att.url,
          filename: att.filename
        }))
      }

      let response
      if (editMode === 'edit' && editingTemplate) {
        // Update
        response = await fetch('/.netlify/functions/email-templates', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTemplate.id, ...payload })
        })
      } else {
        // Create
        response = await fetch('/.netlify/functions/email-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      setSuccess(editMode === 'edit' ? 'Template aktualisiert!' : 'Template erstellt!')
      setTimeout(() => setSuccess(''), 3000)
      
      await loadTemplates()
      closeEditor()

    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (template) => {
    try {
      const response = await fetch(`/.netlify/functions/email-templates?id=${template.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }

      setSuccess('Template gelöscht!')
      setTimeout(() => setSuccess(''), 3000)
      setDeleteConfirm(null)
      
      await loadTemplates()

    } catch (err) {
      setError(err.message)
    }
  }

  const toggleAktiv = async (template) => {
    try {
      const response = await fetch('/.netlify/functions/email-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: template.id, 
          aktiv: !template.aktiv 
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }

      await loadTemplates()

    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-sunside-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">E-Mail Templates</h3>
          <p className="text-sm text-gray-500">
            Vorlagen für Unterlagen-E-Mails verwalten
          </p>
        </div>
        <button
          onClick={openCreateMode}
          className="flex items-center px-4 py-2 bg-sunside-primary text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Neues Template
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
          <button onClick={() => setError('')} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <Check className="w-4 h-4 mr-2" />
          {success}
        </div>
      )}

      {/* Platzhalter Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Verfügbare Platzhalter</p>
            <p className="text-sm text-blue-700 mt-1">
              <strong>Lead:</strong>{' '}
              <code className="bg-blue-100 px-1 rounded">{'{{firma}}'}</code>,{' '}
              <code className="bg-blue-100 px-1 rounded">{'{{stadt}}'}</code>
            </p>
            <p className="text-sm text-blue-700 mt-1">
              <strong>Absender:</strong>{' '}
              <code className="bg-blue-100 px-1 rounded">{'{{setter_name}}'}</code>,{' '}
              <code className="bg-blue-100 px-1 rounded">{'{{setter_vorname}}'}</code>,{' '}
              <code className="bg-blue-100 px-1 rounded">{'{{setter_email}}'}</code>,{' '}
              <code className="bg-blue-100 px-1 rounded">{'{{setter_telefon}}'}</code>
            </p>
          </div>
        </div>
      </div>

      {/* Template Liste */}
      {templates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Noch keine Templates vorhanden</p>
          <button
            onClick={openCreateMode}
            className="mt-3 text-sunside-primary hover:text-purple-700 font-medium"
          >
            Erstes Template erstellen
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(template => (
            <div
              key={template.id}
              className={`bg-white border rounded-lg p-4 ${
                template.aktiv ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                    {!template.aktiv && (
                      <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                        Inaktiv
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1 truncate">
                    Betreff: {template.betreff}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {template.inhalt.substring(0, 150)}...
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => toggleAktiv(template)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title={template.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                  >
                    {template.aktiv ? (
                      <Eye className="w-4 h-4 text-green-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => openEditMode(template)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Bearbeiten"
                  >
                    <Pencil className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(template)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal - Portal für Fullscreen */}
      {editMode && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white w-full h-full md:m-4 md:rounded-2xl md:max-w-4xl md:max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">
                {editMode === 'create' ? 'Neues Template erstellen' : 'Template bearbeiten'}
              </h3>
              <button onClick={closeEditor} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && (
                <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="z.B. Kundenstimmen"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail Betreff *
                </label>
                <input
                  type="text"
                  value={formBetreff}
                  onChange={(e) => setFormBetreff(e.target.value)}
                  placeholder="z.B. Erfolgsgeschichten unserer Kunden"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail Inhalt *
                </label>
                
                {/* Formatierungs-Toolbar */}
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-t-lg border border-b-0 border-gray-300">
                  <button
                    type="button"
                    onClick={formatBold}
                    className="p-2 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                    title="Fettgedruckt (Strg+B)"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  
                  <button
                    type="button"
                    onClick={formatList}
                    className="p-2 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                    title="Aufzählung"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  
                  <div className="relative">
                    <button
                      type="button"
                      onClick={openLinkPopup}
                      className="p-2 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                      title="Link einfügen"
                    >
                      <LinkIcon className="w-4 h-4" />
                    </button>
                    
                    {/* Link-Popup */}
                    {showLinkPopup && (
                      <div className="absolute top-full left-0 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-72">
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={linkText}
                            onChange={(e) => setLinkText(e.target.value)}
                            placeholder="Anzeigename"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sunside-primary outline-none"
                            autoFocus
                          />
                          <input
                            type="url"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sunside-primary outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowLinkPopup(false)
                                setSavedSelection(null)
                              }}
                              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                            >
                              Abbrechen
                            </button>
                            <button
                              type="button"
                              onClick={insertLinkInEditor}
                              disabled={!linkUrl || !linkText}
                              className="px-3 py-1.5 text-sm bg-sunside-primary text-white rounded hover:bg-purple-700 disabled:opacity-50"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-b-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none min-h-[336px] max-h-[400px] overflow-y-auto"
                  style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt', lineHeight: '1.4' }}
                  data-placeholder="E-Mail-Text eingeben..."
                />
                <style>{`
                  [contenteditable]:empty:before {
                    content: attr(data-placeholder);
                    color: #9ca3af;
                    pointer-events: none;
                  }
                `}</style>
                
                <p className="text-xs text-gray-400 mt-1">
                  Platzhalter: {'{{firma}}'}, {'{{stadt}}'}, {'{{setter_name}}'}, {'{{setter_vorname}}'}, {'{{setter_email}}'}, {'{{setter_telefon}}'}
                </p>
              </div>

              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formAktiv}
                  onChange={(e) => setFormAktiv(e.target.checked)}
                  className="w-4 h-4 text-sunside-primary border-gray-300 rounded focus:ring-sunside-primary"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Template aktiv (in Dropdown sichtbar)
                </span>
              </label>

              {/* Datei-Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📎 Anhänge
                </label>
                
                {/* Upload-Error */}
                {uploadError && (
                  <div className="flex items-center p-3 mb-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                    {uploadError}
                  </div>
                )}
                
                {/* Hochgeladene Dateien */}
                {formAttachments.length > 0 && (
                  <div className="border border-gray-200 rounded-lg divide-y mb-3">
                    {formAttachments.map((att, index) => (
                      <div
                        key={att.url || index}
                        className="flex items-center p-3 hover:bg-gray-50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {att.filename || 'Datei'}
                          </p>
                          {att.size && (
                            <p className="text-xs text-gray-500">
                              {formatFileSize(att.size)}
                            </p>
                          )}
                        </div>
                        
                        {/* Typ-Badge */}
                        {att.type?.includes('pdf') || att.filename?.toLowerCase().endsWith('.pdf') ? (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded mr-3">PDF</span>
                        ) : att.type?.includes('image') ? (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mr-3">Bild</span>
                        ) : null}
                        
                        {/* Löschen-Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Entfernen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Upload-Bereich */}
                <label className={`
                  flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer
                  transition-colors
                  ${uploading 
                    ? 'border-purple-300 bg-purple-50' 
                    : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                  }
                `}>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
                  />
                  
                  {uploading ? (
                    <>
                      <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-2" />
                      <span className="text-sm text-purple-600">Wird hochgeladen...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600">Dateien hochladen</span>
                      <span className="text-xs text-gray-400 mt-1">
                        PDF, Word, Excel, Bilder • Klicken oder Drag & Drop
                      </span>
                    </>
                  )}
                </label>
                
                {formAttachments.length > 0 && (
                  <p className="text-xs text-green-600 mt-2">
                    ✓ {formAttachments.length} Datei{formAttachments.length > 1 ? 'en' : ''} angehängt
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={closeEditor}
                className="px-4 py-2.5 text-gray-700 hover:text-gray-900 font-medium"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center px-6 py-2.5 bg-sunside-primary text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {editMode === 'create' ? 'Erstellen' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Template löschen?
            </h3>
            <p className="text-gray-500 mb-6">
              Möchtest du das Template "{deleteConfirm.name}" wirklich löschen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default EmailTemplateManager
