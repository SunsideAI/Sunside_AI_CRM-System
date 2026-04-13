import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // User aus localStorage laden
    const storedUser = localStorage.getItem('sunside_user')
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)

        // Preferences nachladen wenn nicht im Cache (z.B. nach Feature-Deploy oder AT-Änderung)
        if (parsedUser.preferences === undefined) {
          fetch(`/.netlify/functions/users?id=${parsedUser.id}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data && data.preferences !== undefined) {
                const updated = { ...parsedUser, preferences: data.preferences }
                setUser(updated)
                localStorage.setItem('sunside_user', JSON.stringify(updated))
              }
            })
            .catch(() => {})
        }
      } catch (e) {
        localStorage.removeItem('sunside_user')
      }
    }
    setLoading(false)
  }, [])

  const login = (userData) => {
    setUser(userData)
    localStorage.setItem('sunside_user', JSON.stringify(userData))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('sunside_user')
  }

  // Carl Klammer Präferenz speichern (lokal + Airtable)
  const updatePreferences = async (value) => {
    const updated = { ...user, preferences: value }
    setUser(updated)
    localStorage.setItem('sunside_user', JSON.stringify(updated))
    try {
      await fetch('/.netlify/functions/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, preferences: value })
      })
    } catch (err) {
      console.error('Fehler beim Speichern der Präferenz:', err)
    }
  }

  // Prüft ob User eine bestimmte Rolle hat
  const hasRole = (role) => {
    if (!user?.rolle) return false
    return user.rolle.includes(role)
  }

  // Convenience-Funktionen
  const isAdmin = () => hasRole('Admin')
  const isColdcaller = () => hasRole('Coldcaller')
  const isCloser = () => hasRole('Closer')

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    hasRole,
    isAdmin,
    isColdcaller,
    isCloser,
    updatePreferences
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
