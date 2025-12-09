import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { 
  Key, 
  Check, 
  AlertCircle, 
  Eye, 
  EyeOff,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldX
} from 'lucide-react'

function PasswordManager() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })

  // User laden
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const response = await fetch('/.netlify/functions/users')
      const data = await response.json()
      setUsers(data.users || [])
    } catch (err) {
      console.error('Fehler beim Laden der User:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })

    // Validierung
    if (!selectedUser) {
      setMessage({ type: 'error', text: 'Bitte wähle einen User aus' })
      return
    }

    if (password.length < 8) {
      setMessage({ type: 'error', text: 'Passwort muss mindestens 8 Zeichen haben' })
      return
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwörter stimmen nicht überein' })
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/.netlify/functions/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser,
          password: password,
          adminId: user?.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Setzen des Passworts')
      }

      setMessage({ type: 'success', text: 'Passwort erfolgreich gesetzt!' })
      setPassword('')
      setConfirmPassword('')
      setSelectedUser('')
      
      // User-Liste neu laden um hasPassword zu aktualisieren
      loadUsers()

    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  const selectedUserData = users.find(u => u.id === selectedUser)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center mb-6">
        <Key className="w-6 h-6 text-sunside-primary mr-3" />
        <h2 className="text-lg font-semibold text-gray-900">Passwort-Verwaltung</h2>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`flex items-center p-4 mb-6 rounded-lg ${
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* User Dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            User auswählen
          </label>
          {loadingUsers ? (
            <div className="flex items-center text-gray-500">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Lade User...
            </div>
          ) : (
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
            >
              <option value="">-- User wählen --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.vor_nachname} ({u.email}) {u.hasPassword ? '✓' : '⚠️'}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* User Info */}
        {selectedUserData && (
          <div className={`flex items-center p-4 rounded-lg ${
            selectedUserData.hasPassword 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-yellow-50 border border-yellow-200'
          }`}>
            {selectedUserData.hasPassword ? (
              <>
                <ShieldCheck className="w-5 h-5 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-800">Passwort bereits gesetzt</p>
                  <p className="text-xs text-green-600">Ein neues Passwort überschreibt das alte.</p>
                </div>
              </>
            ) : (
              <>
                <ShieldX className="w-5 h-5 text-yellow-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Kein Passwort gesetzt</p>
                  <p className="text-xs text-yellow-600">User kann sich noch nicht einloggen.</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Passwort */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Neues Passwort
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 8 Zeichen"
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Passwort bestätigen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Passwort bestätigen
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Passwort wiederholen"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !selectedUser || !password || !confirmPassword}
          className="w-full flex items-center justify-center px-4 py-3 bg-sunside-primary text-white font-medium rounded-lg hover:bg-purple-700 focus:ring-4 focus:ring-purple-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Key className="w-5 h-5 mr-2" />
              Passwort setzen
            </>
          )}
        </button>
      </form>

      {/* User Liste mit Status */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Passwort-Status aller User</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {users.map((u) => (
            <div 
              key={u.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center">
                {u.hasPassword ? (
                  <ShieldCheck className="w-4 h-4 text-green-500 mr-2" />
                ) : (
                  <ShieldX className="w-4 h-4 text-yellow-500 mr-2" />
                )}
                <span className="text-sm text-gray-700">{u.vor_nachname}</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                u.hasPassword 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {u.hasPassword ? 'Aktiv' : 'Kein Passwort'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PasswordManager
