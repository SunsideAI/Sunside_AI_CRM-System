import { useAuth } from '../context/AuthContext'
import { 
  Users, 
  Database, 
  Key,
  Bell,
  Shield
} from 'lucide-react'
import PasswordManager from '../components/PasswordManager'
import EmailTemplateManager from '../components/EmailTemplateManager'

function Einstellungen() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        <p className="mt-1 text-gray-500">
          Systemkonfiguration und Verwaltung
        </p>
      </div>

      {/* Admin Info */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
        <div className="flex items-center">
          <Shield className="w-8 h-8 text-purple-600 mr-4" />
          <div>
            <h3 className="font-medium text-purple-900">Admin-Bereich</h3>
            <p className="text-sm text-purple-700">
              Du bist als Admin angemeldet: {user?.vor_nachname || user?.vorname}
            </p>
          </div>
        </div>
      </div>

      {/* Password Manager */}
      <PasswordManager />

      {/* E-Mail Templates */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <EmailTemplateManager />
      </div>

      {/* Weitere Settings (Coming Soon) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            title: 'Benutzerverwaltung',
            icon: Users,
            description: 'User hinzufügen, Rollen verwalten',
            status: 'coming-soon'
          },
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
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden opacity-60"
          >
            <div className="absolute top-3 right-3">
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                Coming Soon
              </span>
            </div>
            
            <div className="flex items-start">
              <div className="p-3 bg-gray-100 rounded-lg">
                <group.icon className="w-6 h-6 text-gray-600" />
              </div>
              <div className="ml-4">
                <h3 className="font-medium text-gray-900">{group.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{group.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* System Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-medium text-gray-900 mb-4">System-Informationen</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Version</span>
            <span className="text-gray-900 font-medium">1.0.0 (MVP)</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Datenbank</span>
            <span className="text-gray-900 font-medium">Airtable</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Passwort-Sicherheit</span>
            <span className="text-green-600 font-medium">bcrypt (gehasht)</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Hot Leads</span>
            <span className="text-gray-900 font-medium">Notion (MVP)</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Hosting</span>
            <span className="text-gray-900 font-medium">Netlify</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Einstellungen
