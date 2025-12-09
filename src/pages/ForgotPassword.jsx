import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/.netlify/functions/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ein Fehler ist aufgetreten')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sunside-secondary to-sunside-primary px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">
            Sunside <span className="font-light">CRM</span>
          </h1>
          <p className="mt-2 text-white/70">Passwort zurücksetzen</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {submitted ? (
            // Success State
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">E-Mail gesendet!</h2>
              <p className="text-gray-600 mb-6">
                Falls ein Konto mit dieser E-Mail existiert, haben wir dir ein neues Passwort gesendet.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Prüfe auch deinen Spam-Ordner.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full px-4 py-3 bg-sunside-primary text-white font-medium rounded-lg hover:bg-purple-700 transition-all"
              >
                Zurück zum Login
              </Link>
            </div>
          ) : (
            // Form
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-sunside-primary" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Passwort vergessen?</h2>
                <p className="text-gray-600 mt-2">
                  Gib deine E-Mail ein und wir senden dir ein neues Passwort.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  E-Mail Adresse
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@sunsideai.de"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent transition-all outline-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-3 bg-sunside-primary text-white font-medium rounded-lg hover:bg-purple-700 focus:ring-4 focus:ring-purple-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-2" />
                    Neues Passwort anfordern
                  </>
                )}
              </button>

              {/* Back Link */}
              <Link
                to="/login"
                className="flex items-center justify-center text-sm text-gray-600 hover:text-sunside-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Zurück zum Login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
