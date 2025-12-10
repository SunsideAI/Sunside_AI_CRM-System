import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Shield,
  Key,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react'

// Markdown-Links aus E-Mail entfernen: [email](mailto:email) → email
function cleanEmail(email) {
  if (!email) return ''
  // Match: [text](mailto:email) oder [text](url)
  const markdownMatch = email.match(/\[([^\]]+)\]\([^)]+\)/)
  if (markdownMatch) {
    return markdownMatch[1] // Nur den Text zwischen [] zurückgeben
  }
  return email
}

function Profil() {
  const { user } = useAuth()
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })

    // Validierung
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Neues Passwort muss mindestens 8 Zeichen haben' })
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwörter stimmen nicht überein' })
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/.netlify/functions/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentPassword,
          newPassword
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Ändern des Passworts')
      }

      setMessage({ type: 'success', text: 'Passwort erfolgreich geändert!' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)

    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mein Profil</h1>
        <p className="mt-1 text-gray-500">
          Deine Kontoinformationen und Einstellungen
        </p>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`flex items-center p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-700' 
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <Check className="w-5 h-5 mr-2" />
          ) : (
            <AlertCircle className="w-5 h-5 mr-2" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-sunside-secondary to-sunside-primary p-6">
          <div className="flex items-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-semibold text-white">{user?.vor_nachname}</h2>
              <div className="flex flex-wrap gap-2 mt-1">
                {user?.rolle?.map((role) => (
                  <span 
                    key={role}
                    className="px-2 py-0.5 bg-white/20 rounded text-xs text-white"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          <div className="flex items-center text-gray-600">
            <Mail className="w-5 h-5 mr-3 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">E-Mail</p>
              <p className="text-gray-900">{cleanEmail(user?.email) || cleanEmail(user?.email_geschaeftlich)}</p>
            </div>
          </div>

          {user?.email_geschaeftlich && cleanEmail(user?.email) !== cleanEmail(user?.email_geschaeftlich) && (
            <div className="flex items-center text-gray-600">
              <Mail className="w-5 h-5 mr-3 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Geschäftliche E-Mail</p>
                <p className="text-gray-900">{cleanEmail(user?.email_geschaeftlich)}</p>
              </div>
            </div>
          )}

          {user?.telefon && (
            <div className="flex items-center text-gray-600">
              <Phone className="w-5 h-5 mr-3 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Telefon</p>
                <p className="text-gray-900">{user?.telefon}</p>
              </div>
            </div>
          )}

          {user?.ort && (
            <div className="flex items-center text-gray-600">
              <MapPin className="w-5 h-5 mr-3 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Standort</p>
                <p className="text-gray-900">{user?.ort}{user?.bundesland ? `, ${user?.bundesland}` : ''}</p>
              </div>
            </div>
          )}

          <div className="flex items-center text-gray-600">
            <Shield className="w-5 h-5 mr-3 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Rollen</p>
              <p className="text-gray-900">{user?.rolle?.join(', ')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Key className="w-5 h-5 text-gray-400 mr-3" />
            <h3 className="font-medium text-gray-900">Passwort ändern</h3>
          </div>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="text-sm text-sunside-primary hover:text-purple-700 font-medium"
            >
              Ändern
            </button>
          )}
        </div>

        {showPasswordForm ? (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Aktuelles Passwort
              </label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Neues Passwort
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Neues Passwort bestätigen
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false)
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setMessage({ type: '', text: '' })
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center px-4 py-2.5 bg-sunside-primary text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Speichern'
                )}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-gray-500">
            Ändere dein Passwort regelmäßig für mehr Sicherheit.
          </p>
        )}
      </div>
    </div>
  )
}

export default Profil
