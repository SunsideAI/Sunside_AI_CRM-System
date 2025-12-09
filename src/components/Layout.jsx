import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  LayoutDashboard, 
  Phone, 
  Target,
  Calendar,
  Settings, 
  LogOut,
  User,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'

function Layout() {
  const { user, logout, isSetter, isCloser, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Navigation Items basierend auf Rollen
  const navItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      show: true // Für alle
    },
    {
      name: 'Kaltakquise',
      path: '/kaltakquise',
      icon: Phone,
      show: isSetter() || isAdmin()
    },
    {
      name: 'Closing',
      path: '/closing',
      icon: Target,
      show: isCloser() || isAdmin()
    },
    {
      name: 'Termine',
      path: '/termine',
      icon: Calendar,
      show: true // Für alle
    },
    {
      name: 'Einstellungen',
      path: '/einstellungen',
      icon: Settings,
      show: isAdmin()
    }
  ].filter(item => item.show)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl font-bold text-sunside-primary">Sunside</span>
                <span className="text-2xl font-light text-gray-600"> CRM</span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-sunside-primary text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.name}
                </NavLink>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <NavLink 
                to="/profil"
                className={({ isActive }) =>
                  `hidden sm:flex items-center text-sm hover:text-sunside-primary transition-colors ${
                    isActive ? 'text-sunside-primary' : ''
                  }`
                }
              >
                <User className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-gray-700">{user?.vor_nachname || user?.vorname}</span>
                <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500">
                  {user?.rolle?.join(', ')}
                </span>
              </NavLink>
              
              <button
                onClick={handleLogout}
                className="hidden sm:flex items-center px-3 py-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-sunside-primary text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </NavLink>
              ))}
              <hr className="my-2" />
              <NavLink
                to="/profil"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-lg text-sm font-medium ${
                    isActive
                      ? 'bg-sunside-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <User className="w-5 h-5 mr-3" />
                Mein Profil
              </NavLink>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Logout
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout
