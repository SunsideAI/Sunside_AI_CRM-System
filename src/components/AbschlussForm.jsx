import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { deriveBillingMode, BILLING_MODE_LABELS } from '../utils/billingMode'

const LAENDER = [
  { code: 'DE', name: 'Deutschland' },
  { code: 'AT', name: 'Österreich' },
  { code: 'CH', name: 'Schweiz' },
  { code: 'NL', name: 'Niederlande' },
  { code: 'BE', name: 'Belgien' },
  { code: 'LU', name: 'Luxemburg' },
  { code: 'FR', name: 'Frankreich' },
  { code: 'IT', name: 'Italien' },
  { code: 'ES', name: 'Spanien' },
  { code: 'PL', name: 'Polen' },
]

const ANREDE_OPTIONS = [
  { value: '', label: 'Bitte wählen...' },
  { value: 'Firma', label: 'Firma' },
  { value: 'Herr', label: 'Herr' },
  { value: 'Frau', label: 'Frau' },
]

export default function AbschlussForm({ lead, onCancel, onSubmit, isLoading }) {
  const [form, setForm] = useState({
    // Sektion 1 - Rechnungsempfänger
    rechnung_anrede: '',
    rechnung_firma: '',
    ansprechpartner_vorname: '',
    ansprechpartner_nachname: '',
    rechnung_email: '',
    telefonnummer: '',
    // Sektion 2 - Rechnungsadresse
    rechnung_strasse: '',
    rechnung_zusatz: '',
    rechnung_plz: '',
    rechnung_ort: '',
    rechnung_land: 'DE',
    // Sektion 3 - Steuerdaten
    ust_id: '',
    steuernummer: '',
    // Sektion 4 - Vertrag
    vertragsbeginn: new Date().toISOString().slice(0, 10),
    zahlungsziel_tage: 14,
    retainer_start_offset_months: 0,
    billing_mode: 'auto',
    // Sektion 5 - Notiz
    billing_notes: '',
  })

  const [errors, setErrors] = useState({})
  const [showSteuerdaten, setShowSteuerdaten] = useState(false)

  // Initialisieren mit Lead-Daten
  useEffect(() => {
    if (lead) {
      setForm({
        rechnung_anrede: lead.rechnung_anrede || '',
        rechnung_firma: lead.rechnung_firma || lead.unternehmen || '',
        ansprechpartner_vorname: lead.ansprechpartnerVorname || lead.ansprechpartner_vorname || '',
        ansprechpartner_nachname: lead.ansprechpartnerNachname || lead.ansprechpartner_nachname || '',
        rechnung_email: lead.rechnung_email || lead.email || '',
        telefonnummer: lead.telefonnummer || lead.telefon || '',
        rechnung_strasse: lead.rechnung_strasse || '',
        rechnung_zusatz: lead.rechnung_zusatz || '',
        rechnung_plz: lead.rechnung_plz || '',
        rechnung_ort: lead.rechnung_ort || '',
        rechnung_land: lead.rechnung_land || 'DE',
        ust_id: lead.ust_id || '',
        steuernummer: lead.steuernummer || '',
        vertragsbeginn: lead.vertragsbeginn || new Date().toISOString().slice(0, 10),
        zahlungsziel_tage: lead.zahlungsziel_tage || 14,
        retainer_start_offset_months: lead.retainer_start_offset_months || 0,
        billing_mode: lead.billing_mode || 'auto',
        billing_notes: lead.billing_notes || '',
      })
      setErrors({})
    }
  }, [lead])

  // Pre-Check: Ist das Angebot komplett?
  const angebotComplete =
    lead?.produktDienstleistung?.length > 0 &&
    (Number(lead?.setup) > 0 || Number(lead?.retainer) > 0) &&
    Number(lead?.laufzeit) > 0

  // Dynamisches Label für Firma/Name
  const firmaLabel =
    form.rechnung_anrede === 'Firma'
      ? 'Firmenname'
      : form.rechnung_anrede === 'Herr' || form.rechnung_anrede === 'Frau'
        ? 'Name auf Rechnung'
        : 'Empfänger auf Rechnung'

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }))
  }

  function validate() {
    const e = {}

    // Sektion 1 - Rechnungsempfänger
    if (!form.rechnung_anrede) e.rechnung_anrede = 'Pflichtfeld'
    if (!form.rechnung_firma || form.rechnung_firma.length < 2)
      e.rechnung_firma = 'Pflichtfeld (mind. 2 Zeichen)'
    if (!form.rechnung_email) e.rechnung_email = 'Pflichtfeld'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.rechnung_email))
      e.rechnung_email = 'Ungültige E-Mail'

    // Sektion 2 - Rechnungsadresse
    if (!form.rechnung_strasse) e.rechnung_strasse = 'Pflichtfeld'
    if (!form.rechnung_plz) e.rechnung_plz = 'Pflichtfeld'
    else if (form.rechnung_plz.length < 4 || form.rechnung_plz.length > 10)
      e.rechnung_plz = '4-10 Zeichen'
    if (!form.rechnung_ort) e.rechnung_ort = 'Pflichtfeld'
    if (!form.rechnung_land) e.rechnung_land = 'Pflichtfeld'

    // Sektion 4 - Vertrag
    if (!form.vertragsbeginn) e.vertragsbeginn = 'Pflichtfeld'
    if (!form.zahlungsziel_tage || form.zahlungsziel_tage < 1 || form.zahlungsziel_tage > 90)
      e.zahlungsziel_tage = '1-90 Tage'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!angebotComplete) return
    if (!validate()) return
    onSubmit({
      status: 'Abgeschlossen',
      ...form,
    })
  }

  const inputClass = "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
  const inputErrorClass = "w-full px-4 py-3 border border-red-400 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"
  const errorTextClass = "text-red-500 text-xs mt-1"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-green-100 rounded-xl">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Lead abschließen</h3>
          <p className="text-sm text-gray-500">Rechnungsdaten für automatische Abrechnung erfassen</p>
        </div>
      </div>

      {/* Pre-Check - Angebots-Daten */}
      {angebotComplete ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="font-semibold text-green-900 mb-2 flex items-center gap-2">
            <span className="text-lg">✓</span> Angebots-Daten (bereit zum Abschluss)
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm text-green-800">
            <div><span className="text-green-600">Produkt:</span> {lead.produktDienstleistung?.join(', ') || '-'}</div>
            <div><span className="text-green-600">Setup:</span> {Number(lead.setup || 0).toLocaleString('de-DE')} €</div>
            <div><span className="text-green-600">Retainer:</span> {Number(lead.retainer || 0).toLocaleString('de-DE')} € / Monat</div>
            <div><span className="text-green-600">Laufzeit:</span> {lead.laufzeit} Monate</div>
          </div>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="font-semibold text-red-900 flex items-center gap-2">
            <span className="text-lg">⚠️</span> Angebot unvollständig
          </p>
          <p className="text-red-800 text-sm mt-1">
            Bitte erst das Angebot ausfüllen (Produkt, Setup, Retainer, Laufzeit), bevor der Lead abgeschlossen wird.
          </p>
        </div>
      )}

      {/* Sektion 1: Rechnungsempfänger */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Rechnungsempfänger</h3>

        {/* Anrede */}
        <div>
          <label className={labelClass}>Anrede *</label>
          <select
            value={form.rechnung_anrede}
            onChange={(e) => setField('rechnung_anrede', e.target.value)}
            className={errors.rechnung_anrede ? inputErrorClass : inputClass}
          >
            {ANREDE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errors.rechnung_anrede && <p className={errorTextClass}>{errors.rechnung_anrede}</p>}
        </div>

        {/* Firma/Name */}
        <div>
          <label className={labelClass}>{firmaLabel} *</label>
          <input
            type="text"
            value={form.rechnung_firma}
            onChange={(e) => setField('rechnung_firma', e.target.value)}
            className={errors.rechnung_firma ? inputErrorClass : inputClass}
            placeholder={form.rechnung_anrede === 'Firma' ? 'z.B. Muster GmbH' : 'z.B. Max Mustermann'}
          />
          {errors.rechnung_firma && <p className={errorTextClass}>{errors.rechnung_firma}</p>}
        </div>

        {/* Ansprechpartner */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Ansprechpartner Vorname</label>
            <input
              type="text"
              value={form.ansprechpartner_vorname}
              onChange={(e) => setField('ansprechpartner_vorname', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Ansprechpartner Nachname</label>
            <input
              type="text"
              value={form.ansprechpartner_nachname}
              onChange={(e) => setField('ansprechpartner_nachname', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* E-Mail und Telefon */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Rechnungs-E-Mail *</label>
            <input
              type="email"
              value={form.rechnung_email}
              onChange={(e) => setField('rechnung_email', e.target.value)}
              className={errors.rechnung_email ? inputErrorClass : inputClass}
              placeholder="rechnung@firma.de"
            />
            {errors.rechnung_email && <p className={errorTextClass}>{errors.rechnung_email}</p>}
          </div>
          <div>
            <label className={labelClass}>Telefon</label>
            <input
              type="tel"
              value={form.telefonnummer}
              onChange={(e) => setField('telefonnummer', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Sektion 2: Rechnungsadresse */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Rechnungsadresse</h3>

        {/* Strasse */}
        <div>
          <label className={labelClass}>Straße + Hausnummer *</label>
          <input
            type="text"
            value={form.rechnung_strasse}
            onChange={(e) => setField('rechnung_strasse', e.target.value)}
            className={errors.rechnung_strasse ? inputErrorClass : inputClass}
            placeholder="Musterstraße 123"
          />
          {errors.rechnung_strasse && <p className={errorTextClass}>{errors.rechnung_strasse}</p>}
        </div>

        {/* Zusatz */}
        <div>
          <label className={labelClass}>Adresszusatz (Suite, Etage)</label>
          <input
            type="text"
            value={form.rechnung_zusatz}
            onChange={(e) => setField('rechnung_zusatz', e.target.value)}
            className={inputClass}
            placeholder="z.B. 3. OG, Büro 301"
          />
        </div>

        {/* PLZ und Ort */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>PLZ *</label>
            <input
              type="text"
              value={form.rechnung_plz}
              onChange={(e) => setField('rechnung_plz', e.target.value)}
              className={errors.rechnung_plz ? inputErrorClass : inputClass}
              placeholder="12345"
            />
            {errors.rechnung_plz && <p className={errorTextClass}>{errors.rechnung_plz}</p>}
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Ort *</label>
            <input
              type="text"
              value={form.rechnung_ort}
              onChange={(e) => setField('rechnung_ort', e.target.value)}
              className={errors.rechnung_ort ? inputErrorClass : inputClass}
              placeholder="Musterstadt"
            />
            {errors.rechnung_ort && <p className={errorTextClass}>{errors.rechnung_ort}</p>}
          </div>
        </div>

        {/* Land */}
        <div>
          <label className={labelClass}>Land *</label>
          <select
            value={form.rechnung_land}
            onChange={(e) => setField('rechnung_land', e.target.value)}
            className={errors.rechnung_land ? inputErrorClass : inputClass}
          >
            {LAENDER.map(land => (
              <option key={land.code} value={land.code}>{land.name}</option>
            ))}
          </select>
          {errors.rechnung_land && <p className={errorTextClass}>{errors.rechnung_land}</p>}
        </div>
      </div>

      {/* Sektion 3: Steuerdaten (Collapsible) */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowSteuerdaten(!showSteuerdaten)}
          className="flex items-center justify-between w-full text-lg font-semibold text-gray-900 border-b pb-2"
        >
          <span>Steuerdaten (optional)</span>
          {showSteuerdaten ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>

        {showSteuerdaten && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className={labelClass}>USt-IdNr</label>
              <input
                type="text"
                value={form.ust_id}
                onChange={(e) => setField('ust_id', e.target.value)}
                className={inputClass}
                placeholder="DE123456789"
              />
            </div>
            <div>
              <label className={labelClass}>Steuernummer</label>
              <input
                type="text"
                value={form.steuernummer}
                onChange={(e) => setField('steuernummer', e.target.value)}
                className={inputClass}
                placeholder="12/345/67890"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sektion 4: Vertrag */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Vertragsdaten</h3>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Vertragsbeginn *</label>
            <input
              type="date"
              value={form.vertragsbeginn}
              onChange={(e) => setField('vertragsbeginn', e.target.value)}
              className={errors.vertragsbeginn ? inputErrorClass : inputClass}
            />
            {errors.vertragsbeginn && <p className={errorTextClass}>{errors.vertragsbeginn}</p>}
          </div>
          <div>
            <label className={labelClass}>Zahlungsziel (Tage) *</label>
            <input
              type="number"
              min="1"
              max="90"
              value={form.zahlungsziel_tage}
              onChange={(e) => setField('zahlungsziel_tage', parseInt(e.target.value) || 14)}
              className={errors.zahlungsziel_tage ? inputErrorClass : inputClass}
            />
            {errors.zahlungsziel_tage && <p className={errorTextClass}>{errors.zahlungsziel_tage}</p>}
          </div>
          <div>
            <label className={labelClass}>Retainer Gratis-Monate</label>
            <input
              type="number"
              min="0"
              max="12"
              value={form.retainer_start_offset_months}
              onChange={(e) => setField('retainer_start_offset_months', parseInt(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Billing-Modus */}
        <div>
          <label className={labelClass}>Abrechnungsmodell</label>
          <select
            value={form.billing_mode}
            onChange={(e) => setField('billing_mode', e.target.value)}
            className={inputClass}
          >
            <option value="auto">{BILLING_MODE_LABELS.auto}</option>
            <option value="provision_partner">{BILLING_MODE_LABELS.provision_partner}</option>
            <option value="manual_external">{BILLING_MODE_LABELS.manual_external}</option>
            <option value="reference">{BILLING_MODE_LABELS.reference}</option>
          </select>
          {form.billing_mode === 'auto' && (() => {
            const derived = deriveBillingMode(lead?.setup, lead?.retainer)
            return (
              <p className="text-xs text-gray-500 mt-1">
                Wird als <span className="font-medium text-gray-700">{BILLING_MODE_LABELS[derived]}</span> abgerechnet
                {derived === 'none' && ' – bitte Setup und/oder Retainer im Angebot setzen'}.
              </p>
            )
          })()}
          {form.billing_mode === 'provision_partner' && (
            <p className="text-xs text-purple-600 mt-1">
              🤝 Keine monatliche Rechnung. Provisionen werden separat abgerechnet.
            </p>
          )}
          {form.billing_mode === 'manual_external' && (
            <p className="text-xs text-blue-600 mt-1">
              📄 Rechnung wird außerhalb des CRM erstellt (z.B. per Steuerberater-Tool).
            </p>
          )}
          {form.billing_mode === 'reference' && (
            <p className="text-xs text-gray-600 mt-1">
              🎁 Referenzkunde – keine Rechnungsstellung.
            </p>
          )}
        </div>
      </div>

      {/* Sektion 5: Billing-Notiz */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Interne Notiz</h3>
        <div>
          <label className={labelClass}>Billing-Notiz (intern, nicht auf Rechnung)</label>
          <textarea
            value={form.billing_notes}
            onChange={(e) => setField('billing_notes', e.target.value)}
            className={`${inputClass} resize-y min-h-[80px]`}
            placeholder="Optionale interne Notizen zur Abrechnung..."
          />
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSubmit}
          disabled={!angebotComplete || isLoading}
          className={`px-6 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
            angebotComplete && !isLoading
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Wird abgeschlossen...</span>
            </>
          ) : (
            'Lead jetzt abschließen'
          )}
        </button>
      </div>
    </div>
  )
}
