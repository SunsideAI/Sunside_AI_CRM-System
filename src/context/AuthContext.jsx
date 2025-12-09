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
        setUser(JSON.parse(storedUser))
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

  // Rollen-Mapping: Airtable "Coldcaller" → App "Setter"
  const normalizeRole = (role) => {
    if (role === 'Coldcaller') return 'Setter'
    return role
  }

  // Normalisierte Rollen
  const getNormalizedRoles = () => {
    if (!user?.rolle) return []
    return user.rolle.map(normalizeRole)
  }

  // Prüft ob User eine bestimmte Rolle hat
  const hasRole = (role) => {
    const normalizedRoles = getNormalizedRoles()
    // "Setter" matcht sowohl "Setter" als auch "Coldcaller"
    if (role === 'Setter') {
      return normalizedRoles.includes('Setter') || user?.rolle?.includes('Coldcaller')
    }
    return normalizedRoles.includes(role)
  }

  // Convenience-Funktionen
  const isAdmin = () => hasRole('Admin')
  const isSetter = () => hasRole('Setter')
  const isCloser = () => hasRole('Closer')

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    hasRole,
    isAdmin,
    isSetter,
    isCloser,
    getNormalizedRoles
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
