import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Kaltakquise from './pages/Kaltakquise'
import Closing from './pages/Closing'
import Termine from './pages/Termine'
import Einstellungen from './pages/Einstellungen'
import Profil from './pages/Profil'

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, hasRole } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sunside-primary"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  // Wenn Rollen definiert sind, prüfe ob User eine davon hat
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAllowedRole = allowedRoles.some(role => hasRole(role))
    if (!hasAllowedRole) {
      return <Navigate to="/dashboard" replace />
    }
  }
  
  return children
}

// App Routes
function AppRoutes() {
  const { user } = useAuth()
  
  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" replace /> : <Login />} 
      />
      <Route 
        path="/passwort-vergessen" 
        element={user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} 
      />
      
      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/kaltakquise"
        element={
          <ProtectedRoute allowedRoles={['Admin', 'Setter']}>
            <Layout>
              <Kaltakquise />
            </Layout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/closing"
        element={
          <ProtectedRoute allowedRoles={['Admin', 'Closer']}>
            <Layout>
              <Closing />
            </Layout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/termine"
        element={
          <ProtectedRoute allowedRoles={['Admin', 'Closer']}>
            <Layout>
              <Termine />
            </Layout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/einstellungen"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <Layout>
              <Einstellungen />
            </Layout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/profil"
        element={
          <ProtectedRoute>
            <Layout>
              <Profil />
            </Layout>
          </ProtectedRoute>
        }
      />
      
      {/* Default Route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  )
}

export default App
