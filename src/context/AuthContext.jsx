import { createContext, useContext, useState, useEffect } from 'react'

// Context erstellen
const AuthContext = createContext(null)

// Provider Komponente
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Beim Start: User aus localStorage laden
  useEffect(() => {
    const savedUser = localStorage.getItem('sunside_user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  // Login Funktion
  const login = (userData) => {
    setUser(userData)
    localStorage.setItem('sunside_user', JSON.stringify(userData))
  }

  // Logout Funktion
  const logout = () => {
    setUser(null)
    localStorage.removeItem('sunside_user')
  }

  // Rollen-Check Funktionen
  const hasRole = (role) => {
    if (!user || !user.rolle) return false
    return user.rolle.includes(role)
  }

  const isSetter = () => hasRole('Setter')
  const isCloser = () => hasRole('Closer')
  const isAdmin = () => hasRole('Admin')

  const value = {
    user,
    loading,
    login,
    logout,
    hasRole,
    isSetter,
    isCloser,
    isAdmin,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom Hook für einfachen Zugriff
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden')
  }
  return context
}
