import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { 
  Users, 
  Plus, 
  Pencil, 
  X, 
  Check,
  Loader2,
  AlertCircle,
  Mail,
  Phone,
  GraduationCap,
  UserX,
  UserCheck,
  Search,
  RefreshCw,
  Target,
  MapPin
} from 'lucide-react'

// Bundesländer
const BUNDESLAENDER = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen'
]

// Rollen Optionen
const ROLLEN = ['Admin', 'Closer', 'Coldcaller']

// Modal Component mit Portal
function Modal({ isOpen, onClose, children, zIndex = 99999 }) {
  if (!isOpen) return null
  
  return createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      {/* Content */}
      <div className="relative">
        {children}
      </div>
    </div>,
    document.body
  )
}

function MitarbeiterVerwaltung() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form States
  const [formData, setFormData] = useState({
    vorname: '',
    nachname: '',
    email: '',
    email_geschaeftlich: '',
    telefon: '',
    strasse: '',
    plz: '',
    ort: '',
    bundesland: '',
    rolle: [],
    onboarding: ''
  })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/.netlify/functions/users')
      const data = await response.json()
      
      if (response.ok) {
        setUsers(data.users || [])
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      setError('Mitarbeiter konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  // Mitarbeiter hinzufügen
  const handleAdd = async () => {
    // Alle Felder validieren
    if (!formData.vorname || !formData.nachname || !formData.email || 
        !formData.email_geschaeftlich || !formData.telefon || 
        !formData.strasse || !formData.plz || !formData.ort || 
        !formData.bundesland || formData.rolle.length === 0) {
      setError('Bitte alle Felder ausfüllen und mindestens eine Rolle auswählen')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Bei Coldcaller automatisch Akquise-Pfad bereitstellen
      const initialOnboarding = formData.rolle.includes('Coldcaller')
        ? 'Akquise-Pfad bereitstellen'
        : ''

      // Vorname + Nachname kombinieren für Airtable
      const vor_nachname = `${formData.vorname} ${formData.nachname}`.trim()

      const response = await fetch('/.netlify/functions/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vor_nachname,
          vorname: formData.vorname,
          nachname: formData.nachname,
          email: formData.email,
          email_geschaeftlich: formData.email_geschaeftlich,
          telefon: formData.telefon,
          strasse: formData.strasse,
          plz: formData.plz,
          ort: formData.ort,
          bundesland: formData.bundesland,
          rolle: formData.rolle,
          onboarding: initialOnboarding
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      setSuccess(initialOnboarding 
        ? 'Mitarbeiter hinzugefügt! Akquise-Pfad wird automatisch bereitgestellt.'
        : 'Mitarbeiter erfolgreich hinzugefügt!')
      setShowAddModal(false)
      resetForm()
      loadUsers()

      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Mitarbeiter bearbeiten
  const handleEdit = async () => {
    if (!formData.vorname || !formData.nachname || !formData.email) {
      setError('Vorname, Nachname und E-Mail sind erforderlich')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Vorname + Nachname kombinieren für Airtable
      const vor_nachname = `${formData.vorname} ${formData.nachname}`.trim()

      const response = await fetch('/.netlify/functions/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedUser.id,
          vor_nachname,
          vorname: formData.vorname,
          nachname: formData.nachname,
          email: formData.email,
          email_geschaeftlich: formData.email_geschaeftlich,
          telefon: formData.telefon,
          strasse: formData.strasse,
          plz: formData.plz,
          ort: formData.ort,
          bundesland: formData.bundesland,
          rolle: formData.rolle,
          onboarding: formData.onboarding
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      setSuccess('Mitarbeiter erfolgreich aktualisiert!')
      setShowEditModal(false)
      resetForm()
      loadUsers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Mitarbeiter deaktivieren (kündigen)
  const handleDelete = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/.netlify/functions/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedUser.id })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      setSuccess('Mitarbeiter wurde deaktiviert')
      setShowDeleteModal(false)
      setShowEditModal(false)
      setSelectedUser(null)
      loadUsers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Closer-Pfad bereitstellen
  const setCloserPfad = async () => {
    setSaving(true)
    try {
      const response = await fetch('/.netlify/functions/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedUser.id,
          onboarding: 'Closer-Pfad bereitstellen'
        })
      })

      if (!response.ok) {
        throw new Error('Status konnte nicht geändert werden')
      }
      
      setSuccess(`Closer-Pfad für ${selectedUser.vor_nachname} wird bereitgestellt!`)
      setShowEditModal(false)
      loadUsers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Closer-Pfad konnte nicht bereitgestellt werden')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFormData({
      vorname: '',
      nachname: '',
      email: '',
      email_geschaeftlich: '',
      telefon: '',
      strasse: '',
      plz: '',
      ort: '',
      bundesland: '',
      rolle: [],
      onboarding: ''
    })
    setSelectedUser(null)
  }

  const openEditModal = (user) => {
    setSelectedUser(user)
    // Vor_Nachname in Vorname und Nachname splitten
    const nameParts = (user.vor_nachname || '').split(' ')
    const vorname = nameParts[0] || ''
    const nachname = nameParts.slice(1).join(' ') || ''
    
    setFormData({
      vorname,
      nachname,
      email: user.email || '',
      email_geschaeftlich: user.email_geschaeftlich || '',
      telefon: user.telefon || '',
      strasse: user.strasse || '',
      plz: user.plz || '',
      ort: user.ort || '',
      bundesland: user.bundesland || '',
      rolle: user.rolle || [],
      onboarding: user.onboarding || ''
    })
    setShowEditModal(true)
  }

  const toggleRolle = (rolle) => {
    setFormData(prev => ({
      ...prev,
      rolle: prev.rolle.includes(rolle)
        ? prev.rolle.filter(r => r !== rolle)
        : [...prev.rolle, rolle]
    }))
  }

  // Adresse formatieren für Anzeige
  const formatAdresse = (user) => {
    const parts = []
    if (user.strasse) parts.push(user.strasse)
    if (user.plz || user.ort) {
      parts.push([user.plz, user.ort].filter(Boolean).join(' '))
    }
    return parts.join(', ')
  }

  // Gefilterte User
  const filteredUsers = users.filter(user => 
    user.vor_nachname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Aktive und inaktive User trennen
  const activeUsers = filteredUsers.filter(u => u.status !== false)
  const inactiveUsers = filteredUsers.filter(u => u.status === false)

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
        <p className="text-gray-500">Lade Mitarbeiter...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Erfolg/Fehler Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
          <Check className="w-5 h-5 text-green-600 mr-3" />
          <span className="text-green-700">{success}</span>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <X className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )}

      {/* Header mit Suche und Aktionen */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Mitarbeiterverwaltung</h2>
              <p className="text-sm text-gray-500">{activeUsers.length} aktive Mitarbeiter</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Suche */}
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Suchen..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full sm:w-48"
              />
            </div>

            {/* Refresh */}
            <button
              onClick={loadUsers}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Aktualisieren"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            {/* Hinzufügen */}
            <button
              onClick={() => {
                resetForm()
                setShowAddModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Mitarbeiter</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mitarbeiter-Liste */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kontakt</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adresse</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rolle</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-purple-600 font-medium">
                          {user.vor_nachname?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{user.vor_nachname}</div>
                        {user.hasPassword && (
                          <span className="text-xs text-green-600">✓ Passwort gesetzt</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <div className="flex items-center text-gray-600">
                        <Mail className="w-3 h-3 mr-1" />
                        {user.email}
                      </div>
                      {user.telefon && (
                        <div className="flex items-center text-gray-500 mt-1">
                          <Phone className="w-3 h-3 mr-1" />
                          {user.telefon}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {formatAdresse(user) ? (
                      <span className="flex items-start text-sm text-gray-600">
                        <MapPin className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                        <span>{formatAdresse(user)}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {user.rolle?.map(rolle => (
                        <span 
                          key={rolle}
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            rolle === 'Admin' ? 'bg-purple-100 text-purple-700' :
                            rolle === 'Closer' ? 'bg-green-100 text-green-700' :
                            'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {rolle}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center text-sm text-green-600">
                      <UserCheck className="w-4 h-4 mr-1" /> Aktiv
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Bearbeiten"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {activeUsers.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    Keine Mitarbeiter gefunden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inaktive Mitarbeiter (eingeklappt) */}
      {inactiveUsers.length > 0 && (
        <details className="bg-white rounded-xl border border-gray-200">
          <summary className="px-6 py-4 cursor-pointer text-gray-600 hover:text-gray-900">
            <span className="font-medium">Inaktive Mitarbeiter ({inactiveUsers.length})</span>
          </summary>
          <div className="border-t border-gray-200">
            <table className="w-full">
              <tbody className="divide-y divide-gray-200">
                {inactiveUsers.map((user) => (
                  <tr key={user.id} className="bg-gray-50 opacity-60">
                    <td className="px-6 py-3">
                      <span className="text-gray-600">{user.vor_nachname}</span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{user.email}</td>
                    <td className="px-6 py-3">
                      {user.rolle?.map(rolle => (
                        <span key={rolle} className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full mr-1">
                          {rolle}
                        </span>
                      ))}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => {
                          fetch('/.netlify/functions/users', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: user.id, status: true })
                          }).then(() => {
                            loadUsers()
                            setSuccess('Mitarbeiter reaktiviert')
                            setTimeout(() => setSuccess(''), 3000)
                          })
                        }}
                        className="text-sm text-purple-600 hover:text-purple-800"
                      >
                        Reaktivieren
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
        <div className="bg-white rounded-xl w-[750px] max-w-[95vw] max-h-[95vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Neuer Mitarbeiter</h3>
              <button onClick={() => setShowAddModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Zeile 1: Vorname + Nachname + Telefon */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vorname *</label>
                <input
                  type="text"
                  value={formData.vorname}
                  onChange={(e) => setFormData({ ...formData, vorname: e.target.value })}
                  placeholder="Max"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nachname *</label>
                <input
                  type="text"
                  value={formData.nachname}
                  onChange={(e) => setFormData({ ...formData, nachname: e.target.value })}
                  placeholder="Mustermann"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon *</label>
                <input
                  type="tel"
                  value={formData.telefon}
                  onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                  placeholder="+49 176 12345678"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Zeile 2: E-Mails */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Private E-Mail *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="max@beispiel.de"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Geschäftliche E-Mail *</label>
                <input
                  type="email"
                  value={formData.email_geschaeftlich}
                  onChange={(e) => setFormData({ ...formData, email_geschaeftlich: e.target.value })}
                  placeholder="max@sunsideai.de"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Zeile 3: Adresse komplett */}
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Straße + Hausnr. *</label>
                <input
                  type="text"
                  value={formData.strasse}
                  onChange={(e) => setFormData({ ...formData, strasse: e.target.value })}
                  placeholder="Musterstraße 1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PLZ *</label>
                <input
                  type="text"
                  value={formData.plz}
                  onChange={(e) => setFormData({ ...formData, plz: e.target.value })}
                  placeholder="12345"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ort *</label>
                <input
                  type="text"
                  value={formData.ort}
                  onChange={(e) => setFormData({ ...formData, ort: e.target.value })}
                  placeholder="Berlin"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Zeile 4: Bundesland + Rollen */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bundesland *</label>
                <select
                  value={formData.bundesland}
                  onChange={(e) => setFormData({ ...formData, bundesland: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Bitte auswählen...</option>
                  {BUNDESLAENDER.map(bl => (
                    <option key={bl} value={bl}>{bl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rollen *</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ROLLEN.map(rolle => (
                    <button
                      key={rolle}
                      type="button"
                      onClick={() => toggleRolle(rolle)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        formData.rolle.includes(rolle)
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {rolle}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <GraduationCap className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">Automatisches Onboarding</p>
                  <p className="mt-1">Bei Coldcaller wird automatisch der Akquise-Pfad bereitgestellt.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Abbrechen
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Hinzufügen
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
        <div className="bg-white rounded-xl w-[750px] max-w-[95vw] max-h-[95vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Mitarbeiter bearbeiten</h3>
              <button onClick={() => setShowEditModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Zeile 1: Vorname + Nachname + Telefon */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vorname *</label>
                <input
                  type="text"
                  value={formData.vorname}
                  onChange={(e) => setFormData({ ...formData, vorname: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nachname *</label>
                <input
                  type="text"
                  value={formData.nachname}
                  onChange={(e) => setFormData({ ...formData, nachname: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon *</label>
                <input
                  type="tel"
                  value={formData.telefon}
                  onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Zeile 2: E-Mails */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Private E-Mail *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Geschäftliche E-Mail *</label>
                <input
                  type="email"
                  value={formData.email_geschaeftlich}
                  onChange={(e) => setFormData({ ...formData, email_geschaeftlich: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Zeile 3: Adresse komplett */}
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Straße + Hausnr. *</label>
                <input
                  type="text"
                  value={formData.strasse}
                  onChange={(e) => setFormData({ ...formData, strasse: e.target.value })}
                  placeholder="Musterstraße 1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PLZ *</label>
                <input
                  type="text"
                  value={formData.plz}
                  onChange={(e) => setFormData({ ...formData, plz: e.target.value })}
                  placeholder="12345"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ort *</label>
                <input
                  type="text"
                  value={formData.ort}
                  onChange={(e) => setFormData({ ...formData, ort: e.target.value })}
                  placeholder="Berlin"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Zeile 4: Bundesland + Rollen */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bundesland *</label>
                <select
                  value={formData.bundesland}
                  onChange={(e) => setFormData({ ...formData, bundesland: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Bitte auswählen...</option>
                  {BUNDESLAENDER.map(bl => (
                    <option key={bl} value={bl}>{bl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rollen *</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ROLLEN.map(rolle => (
                    <button
                      key={rolle}
                      type="button"
                      onClick={() => toggleRolle(rolle)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        formData.rolle.includes(rolle)
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {rolle}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Closer-Pfad bereitstellen */}
            {selectedUser?.onboarding !== 'Closer' && selectedUser?.onboarding !== 'Closer-Pfad bereitstellen' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start">
                    <Target className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                    <div className="text-sm text-green-700">
                      <p className="font-medium">Closer-Pfad bereitstellen</p>
                      <p className="mt-1">Startet das Closer-Onboarding für diesen Mitarbeiter.</p>
                    </div>
                  </div>
                  <button
                    onClick={setCloserPfad}
                    disabled={saving}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Starten
                  </button>
                </div>
              </div>
            )}

            {/* Onboarding Status anzeigen */}
            {selectedUser?.onboarding && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Aktueller Onboarding-Status:</span>{' '}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    selectedUser.onboarding.includes('Closer') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {selectedUser.onboarding}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200 flex justify-between">
            {/* Deaktivieren Button links */}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              <UserX className="w-4 h-4" />
              Deaktivieren
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={handleEdit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Speichern
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} zIndex={999999}>
        <div className="bg-white rounded-xl max-w-md w-full">
          <div className="p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
              <UserX className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-center mb-2">Mitarbeiter deaktivieren?</h3>
            <p className="text-gray-600 text-center">
              <strong>{selectedUser?.vor_nachname}</strong> wird deaktiviert und kann sich nicht mehr einloggen. 
              Die Daten bleiben erhalten und können später reaktiviert werden.
            </p>
          </div>

          <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Abbrechen
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
              Deaktivieren
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default MitarbeiterVerwaltung
