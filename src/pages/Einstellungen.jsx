import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSearchParams } from 'react-router-dom'
import { 
  Users, 
  Database, 
  Bell,
  Shield,
  Settings,
  UserCog,
  Inbox
} from 'lucide-react'
import PasswordManager from '../components/PasswordManager'
import EmailTemplateManager from '../components/EmailTemplateManager'
import MitarbeiterVerwaltung from '../components/MitarbeiterVerwaltung'
import LeadAnfragenVerwaltung from '../components/LeadAnfragenVerwaltung'

function Einstellungen() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || 'mitarbeiter'
  const [activeTab, setActiveTab] = useState(initialTab)

  // Update tab when URL changes
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    if (tabFromUrl && ['mitarbeiter', 'anfragen', 'system'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [searchParams])

  return (
    <div className="space-y-6">
      {/* Header mit Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-display text-on-surface">Einstellungen</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {activeTab === 'mitarbeiter' && 'Mitarbeiter verwalten und Onboarding'}
            {activeTab === 'anfragen' && 'Lead-Anfragen der Vertriebler bearbeiten'}
            {activeTab === 'system' && 'Systemkonfiguration und Verwaltung'}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-surface-container rounded-lg p-1">
          <button
            onClick={() => setActiveTab('mitarbeiter')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-label-lg transition-all ${
              activeTab === 'mitarbeiter'
                ? 'bg-gradient-primary text-white shadow-glow-primary'
                : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
            }`}
          >
            <UserCog className="h-4 w-4" />
            Mitarbeiter
          </button>

          <button
            onClick={() => setActiveTab('anfragen')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-label-lg transition-all ${
              activeTab === 'anfragen'
                ? 'bg-gradient-primary text-white shadow-glow-primary'
                : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
            }`}
          >
            <Inbox className="h-4 w-4" />
            Lead-Anfragen
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-label-lg transition-all ${
              activeTab === 'system'
                ? 'bg-gradient-primary text-white shadow-glow-primary'
                : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
            }`}
          >
            <Settings className="h-4 w-4" />
            System
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'mitarbeiter' && (
        <MitarbeiterVerwaltung />
      )}

      {activeTab === 'anfragen' && (
        <LeadAnfragenVerwaltung />
      )}

      {activeTab === 'system' && (
        <SystemeinstellungenContent user={user} />
      )}
    </div>
  )
}

// Systemeinstellungen (bisheriger Inhalt)
function SystemeinstellungenContent({ user }) {
  return (
    <div className="space-y-6">
      {/* Admin Info */}
      <div className="ai-highlight">
        <div className="flex items-center">
          <div className="p-2 bg-gradient-primary rounded-lg mr-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-on-surface">Admin-Bereich</h3>
            <p className="text-body-sm text-on-surface-variant">
              Du bist als Admin angemeldet: {user?.vor_nachname || user?.vorname}
            </p>
          </div>
        </div>
      </div>

      {/* Password Manager */}
      <PasswordManager />

      {/* E-Mail Templates */}
      <div className="card">
        <EmailTemplateManager />
      </div>

      {/* Weitere Settings (Coming Soon) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            title: 'Datenbank',
            icon: Database,
            description: 'Airtable-Verbindung konfigurieren',
            status: 'coming-soon'
          },
          {
            title: 'Benachrichtigungen',
            icon: Bell,
            description: 'E-Mail-Benachrichtigungen konfigurieren',
            status: 'coming-soon'
          }
        ].map((group) => (
          <div
            key={group.title}
            className="card relative overflow-hidden opacity-60"
          >
            <div className="absolute top-3 right-3">
              <span className="badge badge-secondary text-label-sm">
                Coming Soon
              </span>
            </div>

            <div className="flex items-start">
              <div className="p-3 bg-surface-container rounded-lg">
                <group.icon className="w-6 h-6 text-on-surface-variant" />
              </div>
              <div className="ml-4">
                <h3 className="font-medium text-on-surface">{group.title}</h3>
                <p className="mt-1 text-body-sm text-on-surface-variant">{group.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* System Info */}
      <div className="card">
        <h3 className="font-medium text-on-surface mb-4">System-Informationen</h3>
        <div className="space-y-3 text-body-sm">
          <div className="flex justify-between py-2 border-b border-outline-variant/15">
            <span className="text-on-surface-variant">Version</span>
            <span className="text-on-surface font-medium">1.0.0 (MVP)</span>
          </div>
          <div className="flex justify-between py-2 border-b border-outline-variant/15">
            <span className="text-on-surface-variant">Datenbank</span>
            <span className="text-on-surface font-medium">Supabase</span>
          </div>
          <div className="flex justify-between py-2 border-b border-outline-variant/15">
            <span className="text-on-surface-variant">Passwort-Sicherheit</span>
            <span className="text-success font-medium">bcrypt (gehasht)</span>
          </div>
          <div className="flex justify-between py-2 border-b border-outline-variant/15">
            <span className="text-on-surface-variant">Hot Leads</span>
            <span className="text-on-surface font-medium">Notion (MVP)</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-on-surface-variant">Hosting</span>
            <span className="text-on-surface font-medium">Netlify</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Einstellungen
