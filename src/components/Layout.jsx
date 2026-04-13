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
  Clock,
  CheckCheck
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import Clippy from './Clippy'

function Layout({ children }) {
  const { user, logout, isColdcaller, isCloser, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationCount, setNotificationCount] = useState(0)

  const userMenuRef = useRef(null)
  const notificationRef = useRef(null)

  // Benachrichtigung als gelesen markieren (lokal + Airtable für System Messages)
  const markAsRead = useCallback(async (notificationId, isSystemMessage = false, airtableId = null, isReminder = false, terminId = null) => {
    const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]')
    if (!readNotifications.includes(notificationId)) {
      readNotifications.push(notificationId)
      localStorage.setItem('readNotifications', JSON.stringify(readNotifications))

      // UI aktualisieren
      setNotifications(prev => prev.map(n =>
        n.id === notificationId ? { ...n, unread: false } : n
      ))
      setNotificationCount(prev => Math.max(0, prev - 1))

      // System Message in Airtable als gelesen markieren
      if (isSystemMessage && airtableId) {
        try {
          await fetch('/.netlify/functions/system-messages', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId: airtableId })
          })
        } catch (err) {
          console.error('Fehler beim Markieren der System Message:', err)
        }
      }

      // Reminder dismisssen (für diese Session nicht mehr anzeigen)
      if (isReminder && terminId) {
        const dismissKey = notificationId.startsWith('wiedervorlage')
          ? `wiedervorlage-dismissed-${terminId}`
          : `termin-dismissed-${terminId}`
        localStorage.setItem(dismissKey, Date.now().toString())
      }
    }
  }, [])

  // Alle als gelesen markieren
  const markAllAsRead = useCallback(() => {
    const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]')
    const newRead = [...new Set([...readNotifications, ...notifications.map(n => n.id)])]
    localStorage.setItem('readNotifications', JSON.stringify(newRead))

    setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
    setNotificationCount(0)
  }, [notifications])

  // Benachrichtigungen laden (Lead-Anfragen + System Messages)
  useEffect(() => {
    const loadNotifications = async () => {
      if (!user?.id) return

      console.log('[Notifications] Loading notifications for user:', user.id, user.vor_nachname)

      try {
        // Gelesene Benachrichtigungen aus localStorage laden
        const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]')

        let allNotifications = []

        // 1. Lead-Anfragen laden (wie bisher)
        const params = new URLSearchParams({
          isAdmin: isAdmin() ? 'true' : 'false',
          userId: user.id
        })

        const anfragenResponse = await fetch(`/.netlify/functions/lead-requests?${params}`)
        console.log('[Notifications] Lead-Anfragen Response:', anfragenResponse.status)
        if (anfragenResponse.ok) {
          const data = await anfragenResponse.json()
          const anfragen = data.anfragen || []

          if (isAdmin()) {
            const anfragenNotifs = anfragen.map(a => {
              if (a.status === 'Offen') {
                return {
                  id: a.id,
                  type: 'anfrage',
                  title: `${a.userName} möchte ${a.anzahl} Leads`,
                  message: a.nachricht || 'Neue Lead-Anfrage',
                  time: a.erstelltAm,
                  unread: !readNotifications.includes(a.id),
                  link: '/einstellungen?tab=anfragen'
                }
              } else {
                return {
                  id: a.id,
                  type: a.status === 'Genehmigt' ? 'success' : a.status === 'Abgelehnt' ? 'rejected' : 'partial',
                  title: a.status === 'Genehmigt'
                    ? `${a.userName}: ${a.genehmigteAnzahl || a.anzahl} Leads genehmigt`
                    : a.status === 'Teilweise_Genehmigt'
                      ? `${a.userName}: ${a.genehmigteAnzahl}/${a.anzahl} Leads`
                      : `${a.userName}: Abgelehnt`,
                  message: a.adminKommentar || '',
                  time: a.bearbeitetAm || a.erstelltAm,
                  unread: !readNotifications.includes(a.id),
                  link: '/einstellungen?tab=anfragen'
                }
              }
            })
            allNotifications = [...allNotifications, ...anfragenNotifs]
          } else {
            const bearbeiteteAnfragen = anfragen.filter(a => a.status !== 'Offen')
            const anfragenNotifs = bearbeiteteAnfragen.map(a => ({
              id: a.id,
              type: a.status === 'Genehmigt' ? 'success' : a.status === 'Abgelehnt' ? 'rejected' : 'partial',
              title: a.status === 'Genehmigt'
                ? `${a.genehmigteAnzahl || a.anzahl} Leads genehmigt!`
                : a.status === 'Teilweise_Genehmigt'
                  ? `${a.genehmigteAnzahl} von ${a.anzahl} Leads genehmigt`
                  : `Anfrage über ${a.anzahl} Leads abgelehnt`,
              message: a.adminKommentar || (a.status === 'Genehmigt' ? 'Deine Leads sind bereit!' : ''),
              time: a.bearbeitetAm || a.erstelltAm,
              unread: !readNotifications.includes(a.id),
              link: '/kaltakquise'
            }))
            allNotifications = [...allNotifications, ...anfragenNotifs]
          }
        }

        // 2. System Messages laden
        const systemResponse = await fetch(`/.netlify/functions/system-messages?userId=${user.id}`)
        console.log('[Notifications] System Messages Response:', systemResponse.status)
        if (systemResponse.ok) {
          const systemData = await systemResponse.json()
          const systemMessages = systemData.messages || []

          const systemNotifs = systemMessages.map(msg => {
            let type = 'info'
            let link = '/dashboard'

            switch (msg.typ) {
              case 'Termin abgesagt':
                type = 'rejected'
                link = '/closing'
                break
              case 'Termin verschoben':
                type = 'warning'
                link = '/closing'
                break
              case 'Lead gewonnen':
                type = 'success'
                link = '/dashboard'
                break
              case 'Lead verloren':
                type = 'rejected'
                link = '/dashboard'
                break
              case 'Pool Update':
                type = 'info'
                link = msg.titel?.includes('Lead-Anfrage') ? '/einstellungen?tab=anfragen' : '/closing'
                break
            }

            return {
              id: `sys-${msg.id}`,
              type,
              title: msg.titel,
              message: msg.nachricht || '',
              time: msg.erstelltAm,
              unread: !msg.gelesen && !readNotifications.includes(`sys-${msg.id}`),
              link,
              isSystemMessage: true,
              airtableId: msg.id
            }
          })
          allNotifications = [...allNotifications, ...systemNotifs]
        }

        // 3. Termin-Erinnerungen laden
        const userName = user?.vor_nachname || user?.name
        if (userName) {
          try {
            const now = new Date()
            const in30Min = new Date(now.getTime() + 30 * 60 * 1000)
            const in15Min = new Date(now.getTime() + 15 * 60 * 1000)

            const [closerResponse, setterResponse] = await Promise.all([
              fetch(`/.netlify/functions/hot-leads?closerName=${encodeURIComponent(userName)}`)
                .then(r => r.json())
                .catch(() => ({ hotLeads: [] })),
              fetch(`/.netlify/functions/hot-leads?setterName=${encodeURIComponent(userName)}`)
                .then(r => r.json())
                .catch(() => ({ hotLeads: [] }))
            ])

            const hotLeads = [...(closerResponse.hotLeads || []), ...(setterResponse.hotLeads || [])]
              .filter((lead, idx, arr) => arr.findIndex(l => l.id === lead.id) === idx)

            const wvParams = new URLSearchParams({
              wiedervorlage: 'true',
              userId: user.id
            })
            const wvResponse = await fetch(`/.netlify/functions/leads?${wvParams}`)
            const wvData = wvResponse.ok ? await wvResponse.json() : { leads: [] }
            const wiedervorlagen = wvData.leads || []

            hotLeads.forEach(lead => {
              if (!lead.terminDatum) return
              const terminDate = new Date(lead.terminDatum)

              if (terminDate < now || terminDate > in30Min) return

              const dismissKey = `termin-dismissed-${lead.id}`
              const dismissedAt = localStorage.getItem(dismissKey)
              if (dismissedAt) {
                const dismissAge = Date.now() - parseInt(dismissedAt)
                if (dismissAge < 2 * 60 * 60 * 1000) return
                localStorage.removeItem(dismissKey)
              }

              const minutesUntil = Math.round((terminDate - now) / 60000)
              const isUrgent = terminDate <= in15Min
              const isMyClosing = lead.closerName === userName

              allNotifications.push({
                id: `termin-${lead.id}`,
                type: isUrgent ? 'urgent' : 'reminder',
                title: `${isMyClosing ? 'Closing' : 'Termin'} in ${minutesUntil} Min`,
                message: `${lead.unternehmen || 'Beratungsgespräch'}${lead.terminart ? ` (${lead.terminart})` : ''}`,
                time: new Date().toISOString(),
                unread: true,
                link: '/closing',
                isReminder: true,
                terminId: lead.id
              })
            })

            wiedervorlagen.forEach(lead => {
              if (!lead.wiedervorlageDatum) return
              const terminDate = new Date(lead.wiedervorlageDatum)

              if (terminDate < now || terminDate > in30Min) return

              const dismissKey = `wiedervorlage-dismissed-${lead.id}`
              const dismissedAt = localStorage.getItem(dismissKey)
              if (dismissedAt) {
                const dismissAge = Date.now() - parseInt(dismissedAt)
                if (dismissAge < 2 * 60 * 60 * 1000) return
                localStorage.removeItem(dismissKey)
              }

              const minutesUntil = Math.round((terminDate - now) / 60000)
              const isUrgent = terminDate <= in15Min

              allNotifications.push({
                id: `wiedervorlage-reminder-${lead.id}`,
                type: isUrgent ? 'urgent' : 'reminder',
                title: `Wiedervorlage in ${minutesUntil} Min`,
                message: lead.unternehmensname || 'Rückruf',
                time: new Date().toISOString(),
                unread: true,
                link: '/kaltakquise',
                isReminder: true,
                terminId: lead.id
              })
            })
          } catch (terminErr) {
            console.warn('Termin-Erinnerungen laden fehlgeschlagen:', terminErr)
          }
        }

        allNotifications.sort((a, b) => {
          if (a.isReminder && !b.isReminder) return -1
          if (!a.isReminder && b.isReminder) return 1
          return new Date(b.time) - new Date(a.time)
        })

        console.log('[Notifications] Total loaded:', allNotifications.length, 'Unread:', allNotifications.filter(n => n.unread).length)

        setNotifications(allNotifications)
        setNotificationCount(allNotifications.filter(n => n.unread).length)

      } catch (err) {
        console.error('Fehler beim Laden der Benachrichtigungen:', err)
      }
    }

    loadNotifications()
    const interval = setInterval(loadNotifications, 30000)
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

  // Navigation Items
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
      show: isColdcaller() || isAdmin()
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
    <div className="min-h-screen bg-surface">
      {/* Header - Glassmorphism */}
      <header className="glass-nav fixed top-0 left-0 right-0 z-50 shadow-ambient-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl font-display font-bold gradient-text">Sunside</span>
                <span className="text-2xl font-light text-on-surface-variant"> CRM</span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-250 ${
                      isActive
                        ? 'nav-item active'
                        : 'nav-item'
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

              {/* Benachrichtigungen */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setNotificationOpen(!notificationOpen)}
                  className="relative p-2.5 rounded-lg hover:bg-surface-container transition-all duration-200"
                >
                  <Bell className="w-5 h-5 text-on-surface-variant" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gradient-primary text-white text-xs font-bold rounded-full flex items-center justify-center shadow-glow-primary">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {notificationOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest rounded-xl shadow-ambient-lg overflow-hidden z-50 animate-scale-in">
                    <div className="p-4 bg-surface-container flex items-center justify-between">
                      <h3 className="font-display font-semibold text-on-surface">Benachrichtigungen</h3>
                      {notifications.some(n => n.unread) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            markAllAsRead()
                          }}
                          className="text-xs text-primary font-medium hover:text-primary-container flex items-center gap-1 transition-colors"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          Alle gelesen
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center">
                          <div className="w-12 h-12 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-3">
                            <Bell className="w-6 h-6 text-on-surface-variant" />
                          </div>
                          <p className="text-on-surface-variant text-sm">Keine Benachrichtigungen</p>
                        </div>
                      ) : (
                        notifications.map(notif => (
                          <div
                            key={notif.id}
                            className={`p-4 hover:bg-surface-container cursor-pointer transition-colors ${
                              notif.unread ? (notif.type === 'urgent' ? 'bg-error-container/30' : 'bg-primary-fixed/30') : ''
                            }`}
                            onClick={() => {
                              markAsRead(notif.id, notif.isSystemMessage, notif.airtableId, notif.isReminder, notif.terminId)
                              navigate(notif.link || (isAdmin() ? '/einstellungen?tab=anfragen' : '/kaltakquise'))
                              setNotificationOpen(false)
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                notif.type === 'success' ? 'bg-success-container' :
                                notif.type === 'rejected' ? 'bg-error-container' :
                                notif.type === 'pending' ? 'bg-warning-container' :
                                notif.type === 'partial' ? 'bg-warning-container' :
                                notif.type === 'warning' ? 'bg-warning-container' :
                                notif.type === 'info' ? 'bg-secondary-container' :
                                notif.type === 'urgent' ? 'bg-error-container animate-pulse' :
                                notif.type === 'reminder' ? 'bg-warning-container' :
                                'bg-primary-fixed'
                              }`}>
                                {notif.type === 'success' ? (
                                  <Check className="w-4 h-4 text-success" />
                                ) : notif.type === 'rejected' ? (
                                  <X className="w-4 h-4 text-error" />
                                ) : notif.type === 'urgent' ? (
                                  <Clock className="w-4 h-4 text-error" />
                                ) : notif.type === 'reminder' ? (
                                  <Bell className="w-4 h-4 text-warning" />
                                ) : notif.type === 'pending' ? (
                                  <Clock className="w-4 h-4 text-warning" />
                                ) : notif.type === 'partial' ? (
                                  <Check className="w-4 h-4 text-warning" />
                                ) : notif.type === 'warning' ? (
                                  <Clock className="w-4 h-4 text-warning" />
                                ) : notif.type === 'info' ? (
                                  <Bell className="w-4 h-4 text-secondary" />
                                ) : (
                                  <User className="w-4 h-4 text-primary" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-on-surface text-sm">{notif.title}</p>
                                {notif.message && (
                                  <p className="text-xs text-on-surface-variant truncate mt-0.5">{notif.message}</p>
                                )}
                                <p className="text-xs text-tertiary mt-1">{formatTime(notif.time)}</p>
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
                        className="block p-3 text-center text-sm font-medium text-primary hover:bg-surface-container transition-colors"
                      >
                        Alle Anfragen anzeigen
                      </NavLink>
                    )}
                  </div>
                )}
              </div>

              {/* User Dropdown - Desktop */}
              <div className="relative hidden sm:block" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-container transition-all duration-200"
                >
                  <div className="w-9 h-9 bg-gradient-primary rounded-lg flex items-center justify-center text-white font-semibold shadow-glow-primary">
                    {user?.vor_nachname?.charAt(0) || 'U'}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* User Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-surface-container-lowest rounded-xl shadow-ambient-lg overflow-hidden z-50 animate-scale-in">
                    {/* User Info */}
                    <div className="p-4 bg-surface-container">
                      <p className="font-display font-semibold text-on-surface">{user?.vor_nachname || user?.vorname}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{user?.rolle?.join(', ')}</p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <NavLink
                        to="/profil"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
                      >
                        <User className="w-4 h-4 mr-3 text-on-surface-variant" />
                        Mein Profil
                      </NavLink>

                      {isAdmin() && (
                        <NavLink
                          to="/einstellungen"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
                        >
                          <Settings className="w-4 h-4 mr-3 text-on-surface-variant" />
                          Einstellungen
                        </NavLink>
                      )}
                    </div>

                    {/* Logout */}
                    <div className="py-2">
                      <button
                        onClick={confirmLogout}
                        className="flex items-center w-full px-4 py-2.5 text-sm text-error hover:bg-error-container/30 transition-colors"
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
                className="md:hidden p-2 rounded-lg hover:bg-surface-container transition-colors"
              >
                {mobileMenuOpen ? <X className="w-6 h-6 text-on-surface" /> : <Menu className="w-6 h-6 text-on-surface" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-surface-container-lowest shadow-ambient-md animate-slide-up">
            <div className="px-4 py-4 space-y-2">
              {/* User Info Mobile */}
              <div className="flex items-center gap-3 px-4 py-3 mb-3 bg-surface-container rounded-xl">
                <div className="w-11 h-11 bg-gradient-primary rounded-lg flex items-center justify-center text-white font-semibold shadow-glow-primary">
                  {user?.vor_nachname?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="font-display font-semibold text-on-surface">{user?.vor_nachname}</p>
                  <p className="text-xs text-on-surface-variant">{user?.rolle?.join(', ')}</p>
                </div>
              </div>

              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'nav-item active'
                        : 'nav-item'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </NavLink>
              ))}

              <div className="divider-spacing" />

              <NavLink
                to="/profil"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive ? 'nav-item active' : 'nav-item'
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
                    `flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive ? 'nav-item active' : 'nav-item'
                    }`
                  }
                >
                  <Settings className="w-5 h-5 mr-3" />
                  Einstellungen
                </NavLink>
              )}

              <button
                onClick={confirmLogout}
                className="flex items-center w-full px-4 py-3 text-sm font-medium text-error hover:bg-error-container/30 rounded-lg transition-colors"
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
            className="modal-backdrop absolute inset-0"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="modal-content relative w-full max-w-sm animate-scale-in">
            <div className="text-center">
              <div className="w-14 h-14 bg-error-container rounded-xl flex items-center justify-center mx-auto mb-5">
                <LogOut className="w-7 h-7 text-error" />
              </div>
              <h3 className="text-xl font-display font-semibold text-on-surface mb-2">Abmelden?</h3>
              <p className="text-on-surface-variant mb-6">Willst du dich wirklich abmelden?</p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="btn-secondary flex-1"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 px-6 py-3 bg-error text-white rounded-md font-medium hover:bg-error/90 transition-colors"
                >
                  Abmelden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clippy - Der hilfreiche Assistent */}
      <Clippy />
    </div>
  )
}

export default Layout
