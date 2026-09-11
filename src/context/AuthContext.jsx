import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // User aus localStorage laden
    const storedUser = localStorage.getItem('sunside_user')
    const storedToken = localStorage.getItem('sunside_token')
    // Eine Anmeldung ohne Token stammt aus der Zeit vor der serverseitigen
    // Pruefung und ist wertlos - solche Sitzungen werden verworfen.
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (e) {
        localStorage.removeItem('sunside_user')
        localStorage.removeItem('sunside_token')
      }
    } else if (storedUser) {
      localStorage.removeItem('sunside_user')
    }
    setLoading(false)
  }, [])

  const login = (userData, token) => {
    setUser(userData)
    localStorage.setItem('sunside_user', JSON.stringify(userData))
    // Das Token ist ab hier der einzige Identitaetsnachweis gegenueber dem
    // Server. Ohne Token laufen alle Aufrufe in ein 401.
    if (token) localStorage.setItem('sunside_token', token)
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('sunside_user')
    localStorage.removeItem('sunside_token')
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
  const isGeschaeftsfuehrer = () => hasRole('Geschäftsführer')

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
    isGeschaeftsfuehrer
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
