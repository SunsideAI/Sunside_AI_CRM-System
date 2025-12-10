import { useState, useEffect } from 'react'
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
  Info
} from 'lucide-react'

function EmailTemplateManager() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Editor State
  const [editMode, setEditMode] = useState(false) // 'create' | 'edit' | false
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form State
  const [formName, setFormName] = useState('')
  const [formBetreff, setFormBetreff] = useState('')
  const [formInhalt, setFormInhalt] = useState('')
  const [formAktiv, setFormAktiv] = useState(true)
  
  // Attachments State
  const [availableFiles, setAvailableFiles] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(false)

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    loadTemplates()
    loadAvailableFiles()
  }, [])

  // Verfügbare Dateien aus Dateien-Tabelle laden
  const loadAvailableFiles = async () => {
    setLoadingFiles(true)
    try {
      const response = await fetch('/.netlify/functions/files')
      const data = await response.json()
      
      if (response.ok) {
        setAvailableFiles(data.files || [])
      }
    } catch (err) {
      console.error('Dateien konnten nicht geladen werden:', err)
    } finally {
      setLoadingFiles(false)
    }
  }

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
    setSelectedFiles([])
    setEditingTemplate(null)
    setEditMode('create')
    setError('')
  }

  const openEditMode = (template) => {
    setFormName(template.name)
    setFormBetreff(template.betreff)
    setFormInhalt(template.inhalt)
    setFormAktiv(template.aktiv)
    // Bestehende Attachments als ausgewählt markieren
    setSelectedFiles(template.attachments?.map(att => att.url) || [])
    setEditingTemplate(template)
    setEditMode('edit')
    setError('')
  }

  const closeEditor = () => {
    setEditMode(false)
    setEditingTemplate(null)
    setSelectedFiles([])
    setError('')
  }

  // Datei an-/abwählen
  const toggleFile = (fileUrl) => {
    setSelectedFiles(prev => 
      prev.includes(fileUrl)
        ? prev.filter(url => url !== fileUrl)
        : [...prev, fileUrl]
    )
  }

  // Dateigröße formatieren
  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleSave = async () => {
    // Validierung
    if (!formName.trim()) {
      setError('Bitte Namen eingeben')
      return
    }
    if (!formBetreff.trim()) {
      setError('Bitte Betreff eingeben')
      return
    }
    if (!formInhalt.trim()) {
      setError('Bitte Inhalt eingeben')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Ausgewählte Dateien mit vollständigen Infos
      const attachments = selectedFiles.map(url => {
        const file = availableFiles.find(f => f.url === url)
        return file ? { url: file.url, filename: file.filename } : { url }
      })

      const payload = {
        name: formName,
        betreff: formBetreff,
        inhalt: formInhalt,
        aktiv: formAktiv,
        attachments: attachments
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

      {/* Editor Modal */}
      {editMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
                <div className="flex items-center gap-1 mb-2 p-2 bg-gray-50 rounded-t-lg border border-b-0 border-gray-300">
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = document.getElementById('template-inhalt')
                      const start = textarea.selectionStart
                      const end = textarea.selectionEnd
                      const text = formInhalt
                      
                      if (start !== end) {
                        // Text markiert - umschließen mit **
                        const selectedText = text.substring(start, end)
                        const newText = text.substring(0, start) + '**' + selectedText + '**' + text.substring(end)
                        setFormInhalt(newText)
                      } else {
                        // Nichts markiert - Platzhalter einfügen
                        const newText = text.substring(0, start) + '**Fettgedruckt**' + text.substring(end)
                        setFormInhalt(newText)
                      }
                      textarea.focus()
                    }}
                    className="px-3 py-1.5 text-sm font-bold bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                    title="Fettgedruckt"
                  >
                    B
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = document.getElementById('template-inhalt')
                      const start = textarea.selectionStart
                      const text = formInhalt
                      
                      // Finde Zeilenanfang
                      let lineStart = start
                      while (lineStart > 0 && text[lineStart - 1] !== '\n') {
                        lineStart--
                      }
                      
                      // Prüfe ob Zeile schon mit • beginnt
                      if (text.substring(lineStart, lineStart + 2) === '• ') {
                        // Bullet entfernen
                        const newText = text.substring(0, lineStart) + text.substring(lineStart + 2)
                        setFormInhalt(newText)
                      } else {
                        // Bullet hinzufügen
                        const newText = text.substring(0, lineStart) + '• ' + text.substring(lineStart)
                        setFormInhalt(newText)
                      }
                      textarea.focus()
                    }}
                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                    title="Aufzählung"
                  >
                    • Liste
                  </button>
                  
                  <div className="h-6 w-px bg-gray-300 mx-1" />
                  
                  <span className="text-xs text-gray-400 ml-2">
                    Tipp: Text markieren, dann auf B klicken
                  </span>
                </div>
                
                <textarea
                  id="template-inhalt"
                  value={formInhalt}
                  onChange={(e) => setFormInhalt(e.target.value)}
                  placeholder={`Guten Tag,\n\nvielen Dank für unser Gespräch.\n\nIm Anhang finden Sie wie besprochen unsere Unterlagen für {{firma}}.\n\nBei Fragen stehe ich Ihnen gerne zur Verfügung unter {{setter_telefon}} oder {{setter_email}}.\n\nIch freue mich auf Ihre Rückmeldung!`}
                  rows={14}
                  className="w-full px-4 py-3 border border-gray-300 rounded-b-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none resize-none font-mono text-sm"
                />
                
                <p className="text-xs text-gray-400 mt-1">
                  **text** = fettgedruckt, • am Zeilenanfang = Aufzählung
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

              {/* Datei-Auswahl */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📎 Anhänge auswählen
                </label>
                
                {loadingFiles ? (
                  <div className="flex items-center text-gray-500 text-sm py-4">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Dateien werden geladen...
                  </div>
                ) : availableFiles.length === 0 ? (
                  <div className="text-sm text-gray-500 py-4 px-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <p>Keine Dateien verfügbar.</p>
                    <p className="text-xs mt-1">Lade Dateien in die "Dateien"-Tabelle in Airtable hoch.</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto">
                    {availableFiles.map(file => (
                      <label
                        key={file.id}
                        className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedFiles.includes(file.url) ? 'bg-purple-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.url)}
                          onChange={() => toggleFile(file.url)}
                          className="w-4 h-4 text-sunside-primary border-gray-300 rounded focus:ring-sunside-primary"
                        />
                        <div className="ml-3 flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.name || file.filename}
                          </p>
                          <p className="text-xs text-gray-500">
                            {file.filename} {file.size && `• ${formatFileSize(file.size)}`}
                          </p>
                        </div>
                        {file.type?.includes('pdf') && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">PDF</span>
                        )}
                        {file.type?.includes('image') && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Bild</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                
                {selectedFiles.length > 0 && (
                  <p className="text-xs text-green-600 mt-2">
                    ✓ {selectedFiles.length} Datei{selectedFiles.length > 1 ? 'en' : ''} ausgewählt
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
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
        </div>
      )}
    </div>
  )
}

export default EmailTemplateManager
