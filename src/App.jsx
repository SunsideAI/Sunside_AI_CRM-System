import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Layout
import Layout from './components/Layout'

// Pages
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Kaltakquise from './pages/Kaltakquise'
import Closing from './pages/Closing'
import Termine from './pages/Termine'
import Profil from './pages/Profil'
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
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} 
      />
      <Route 
        path="/passwort-vergessen" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} 
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="profil" element={<Profil />} />
        
        <Route 
          path="kaltakquise" 
          element={
            <ProtectedRoute allowedRoles={['Coldcaller', 'Admin']}>
              <Kaltakquise />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="closing" 
          element={
            <ProtectedRoute allowedRoles={['Closer', 'Admin']}>
              <Closing />
            </ProtectedRoute>
          } 
        />
        
        <Route path="termine" element={<Termine />} />
        
        <Route 
          path="einstellungen" 
          element={
            <ProtectedRoute allowedRoles={['Admin']}>
              <Einstellungen />
            </ProtectedRoute>
          } 
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
