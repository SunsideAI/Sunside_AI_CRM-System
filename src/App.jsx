import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Layout
import Layout from './components/Layout'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Kaltakquise from './pages/Kaltakquise'
import Closing from './pages/Closing'
import Einstellungen from './pages/Einstellungen'

// Protected Route Komponente
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, hasRole, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sunside-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Wenn Rollen definiert sind, prüfen
  if (allowedRoles.length > 0) {
    const hasAccess = allowedRoles.some(role => hasRole(role))
    if (!hasAccess) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return children
}

function App() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      {/* Login Route */}
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} 
      />

      {/* Protected Routes mit Layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Redirect von / zu /dashboard */}
        <Route index element={<Navigate to="/dashboard" replace />} />
        
        {/* Dashboard - für alle */}
        <Route path="dashboard" element={<Dashboard />} />
        
        {/* Kaltakquise - nur Setter und Admin */}
        <Route 
          path="kaltakquise" 
          element={
            <ProtectedRoute allowedRoles={['Setter', 'Admin']}>
              <Kaltakquise />
            </ProtectedRoute>
          } 
        />
        
        {/* Closing - nur Closer und Admin */}
        <Route 
          path="closing" 
          element={
            <ProtectedRoute allowedRoles={['Closer', 'Admin']}>
              <Closing />
            </ProtectedRoute>
          } 
        />
        
        {/* Einstellungen - nur Admin */}
        <Route 
          path="einstellungen" 
          element={
            <ProtectedRoute allowedRoles={['Admin']}>
              <Einstellungen />
            </ProtectedRoute>
          } 
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
