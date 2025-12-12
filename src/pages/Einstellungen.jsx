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
  X,
  Bell,
  ChevronDown,
  Check,
  Clock
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

function Layout({ children }) {
  const { user, logout, isSetter, isCloser, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationCount, setNotificationCount] = useState(0)
  
  const userMenuRef = useRef(null)
  const notificationRef = useRef(null)

  // Benachrichtigungen laden
  useEffect(() => {
    const loadNotifications = async () => {
      if (!user?.id) return
      
      try {
        // Für Admins: Offene Anfragen von allen
        // Für andere: Eigene Anfragen mit Status-Updates
        const params = new URLSearchParams({
          isAdmin: isAdmin() ? 'true' : 'false',
          userId: user.id
        })
        
        if (isAdmin()) {
          params.set('status', 'Offen')
        }
        
        const response = await fetch(`/.netlify/functions/lead-requests?${params}`)
        if (response.ok) {
          const data = await response.json()
          const anfragen = data.anfragen || []
          
          if (isAdmin()) {
            // Admin sieht offene Anfragen
            setNotifications(anfragen.map(a => ({
              id: a.id,
              type: 'anfrage',
              title: `${a.userName} möchte ${a.anzahl} Leads`,
              message: a.nachricht || 'Neue Lead-Anfrage',
              time: a.erstelltAm,
              unread: true
            })))
            setNotificationCount(anfragen.length)
          } else {
            // Vertriebler sehen ihre Anfragen-Status
            const updates = anfragen.filter(a => a.status !== 'Offen')
            setNotifications(anfragen.map(a => ({
              id: a.id,
              type: a.status === 'Offen' ? 'pending' : a.status === 'Genehmigt' ? 'success' : a.status === 'Abgelehnt' ? 'rejected' : 'partial',
              title: a.status === 'Offen' 
                ? `Anfrage über ${a.anzahl} Leads läuft` 
                : a.status === 'Genehmigt' 
                  ? `${a.genehmigteAnzahl || a.anzahl} Leads genehmigt!`
                  : a.status === 'Teilweise_Genehmigt'
                    ? `${a.genehmigteAnzahl} von ${a.anzahl} Leads genehmigt`
                    : `Anfrage abgelehnt`,
              message: a.adminKommentar || '',
              time: a.bearbeitetAm || a.erstelltAm,
              unread: a.status !== 'Offen'
            })))
            // Zeige Badge für bearbeitete Anfragen
            setNotificationCount(updates.length)
          }
        }
      } catch (err) {
        console.error('Fehler beim Laden der Benachrichtigungen:', err)
      }
    }
    
    loadNotifications()
    const interval = setInterval(loadNotifications, 60000)
    return () => clearInterval(interval)
  }, [user?.id, isAdmin])

  // Klick außerhalb schließt Dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setNotificationOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const confirmLogout = () => {
    setUserMenuOpen(false)
    setMobileMenuOpen(false)
    setShowLogoutConfirm(true)
  }

  // Navigation Items - Einstellungen NICHT mehr hier
  const navItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      show: true
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
      show: true
    }
  ].filter(item => item.show)

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'Gerade eben'
    if (diffMins < 60) return `vor ${diffMins} Min`
    if (diffHours < 24) return `vor ${diffHours} Std`
    return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`
  }

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

            {/* Right Side: Bell + User Dropdown */}
            <div className="flex items-center space-x-2">
              
              {/* Benachrichtigungen - für ALLE */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setNotificationOpen(!notificationOpen)}
                  className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {notificationOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
                    <div className="p-3 border-b border-gray-100 bg-gray-50">
                      <h3 className="font-semibold text-gray-900">Benachrichtigungen</h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p>Keine Benachrichtigungen</p>
                        </div>
                      ) : (
                        notifications.map(notif => (
                          <div 
                            key={notif.id}
                            className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                              notif.unread ? 'bg-purple-50' : ''
                            }`}
                            onClick={() => {
                              if (isAdmin()) {
                                navigate('/einstellungen?tab=anfragen')
                              }
                              setNotificationOpen(false)
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-full ${
                                notif.type === 'success' ? 'bg-green-100' :
                                notif.type === 'rejected' ? 'bg-red-100' :
                                notif.type === 'pending' ? 'bg-amber-100' :
                                notif.type === 'partial' ? 'bg-orange-100' :
                                'bg-purple-100'
                              }`}>
                                {notif.type === 'success' ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : notif.type === 'rejected' ? (
                                  <X className="w-4 h-4 text-red-600" />
                                ) : notif.type === 'pending' ? (
                                  <Clock className="w-4 h-4 text-amber-600" />
                                ) : notif.type === 'partial' ? (
                                  <Check className="w-4 h-4 text-orange-600" />
                                ) : (
                                  <User className="w-4 h-4 text-purple-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 text-sm">{notif.title}</p>
                                {notif.message && (
                                  <p className="text-xs text-gray-500 truncate">{notif.message}</p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">{formatTime(notif.time)}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {isAdmin() && notifications.length > 0 && (
                      <NavLink
                        to="/einstellungen?tab=anfragen"
                        onClick={() => setNotificationOpen(false)}
                        className="block p-3 text-center text-sm text-sunside-primary hover:bg-gray-50 border-t border-gray-100"
                      >
                        Alle Anfragen anzeigen →
                      </NavLink>
                    )}
                  </div>
                )}
              </div>

              {/* User Dropdown - Desktop */}
              <div className="relative hidden sm:block" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-sunside-primary rounded-full flex items-center justify-center text-white font-medium">
                    {user?.vor_nachname?.charAt(0) || 'U'}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* User Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
                    {/* User Info */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                      <p className="font-semibold text-gray-900">{user?.vor_nachname || user?.vorname}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{user?.rolle?.join(', ')}</p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <NavLink
                        to="/profil"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <User className="w-4 h-4 mr-3 text-gray-400" />
                        Mein Profil
                      </NavLink>

                      {isAdmin() && (
                        <NavLink
                          to="/einstellungen"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <Settings className="w-4 h-4 mr-3 text-gray-400" />
                          Einstellungen
                        </NavLink>
                      )}
                    </div>

                    {/* Logout */}
                    <div className="border-t border-gray-100 py-2">
                      <button
                        onClick={confirmLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="w-4 h-4 mr-3" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>

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
              {/* User Info Mobile */}
              <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-sunside-primary rounded-full flex items-center justify-center text-white font-medium">
                  {user?.vor_nachname?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user?.vor_nachname}</p>
                  <p className="text-xs text-gray-500">{user?.rolle?.join(', ')}</p>
                </div>
              </div>

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

              {isAdmin() && (
                <NavLink
                  to="/einstellungen"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-sunside-primary text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <Settings className="w-5 h-5 mr-3" />
                  Einstellungen
                </NavLink>
              )}
              
              <button
                onClick={confirmLogout}
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
          {children || <Outlet />}
        </div>
      </main>

      {/* Logout Bestätigung Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Abmelden?</h3>
              <p className="text-gray-500 mb-6">Willst du dich wirklich abmelden?</p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Abmelden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Layout
