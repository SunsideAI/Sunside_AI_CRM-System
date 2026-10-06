import { Phone, Mail, Globe, MapPin, User as UserIcon } from 'lucide-react'

/**
 * Die Kontaktdaten zum Ändern.
 *
 * Dieselben Felder, dieselbe Beschriftung und dieselben Eingabekästen wie im
 * Opening: Name über dem Feld, Symbol links, E-Mail als Pflicht. Vorher gab es
 * das nur dort — im Setting standen die Daten fest, und wer eine falsche
 * Nummer hatte, musste den Kontakt in einem anderen Tab suchen.
 *
 * Die Anrede gehört dazu, seit Calendly sie als Pflichtfeld abfragt: Ohne
 * sie scheitert die Terminbuchung, und zwar mit einer Meldung aus Calendly,
 * die am Bildschirm niemandem sagt, was zu tun ist.
 *
 * Die Werte hält der Aufrufer; hier wird nur gezeigt und gemeldet.
 */
export default function KontaktFelder({
  werte, onChange, mailFehlt = false, nameFehlt = false, anredeFehlt = false, notiz = null
}) {
  const setze = (feld) => (e) => onChange({ ...werte, [feld]: e.target.value })

  return (
    <div className="grid grid-cols-1 gap-3">
      <label className="feld-label -mb-2">
        Ansprechpartner{nameFehlt && <span className="text-red-500"> *</span>}
        {notiz}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Calendly fragt die Anrede als Pflichtfeld ab: Fehlt sie, weist es
            die Buchung ab. Sie steht deshalb vorn, nicht als Nachtrag. */}
        <div className={`input-field-icon${anredeFehlt && !werte.anrede ? ' fehlt' : ''}`}>
          <UserIcon className={`h-4 w-4 flex-shrink-0 ${anredeFehlt && !werte.anrede ? 'text-red-500' : 'text-primary'}`} />
          <select value={werte.anrede || ''} onChange={setze('anrede')}
                  className="bg-transparent w-full outline-none">
            <option value="">Anrede …</option>
            <option value="Herr">Herr</option>
            <option value="Frau">Frau</option>
          </select>
        </div>
        <div className={`input-field-icon${nameFehlt && !werte.vorname ? ' fehlt' : ''}`}>
          <UserIcon className="h-4 w-4 text-primary flex-shrink-0" />
          <input value={werte.vorname || ''} onChange={setze('vorname')} placeholder="Vorname" />
        </div>
        <div className={`input-field-icon${nameFehlt && !werte.nachname ? ' fehlt' : ''}`}>
          <UserIcon className="h-4 w-4 text-primary flex-shrink-0" />
          <input value={werte.nachname || ''} onChange={setze('nachname')} placeholder="Nachname" />
        </div>
      </div>
      {nameFehlt && (
        <p className="text-xs text-red-500 -mt-1">
          Vor- und Nachname sind Pflicht, bevor ein Termin gebucht wird.
        </p>
      )}
      {anredeFehlt && !werte.anrede && (
        <p className="text-xs text-red-500 -mt-1">
          Die Anrede ist in Calendly ein Pflichtfeld. Ohne sie weist Calendly
          die Buchung ab. Bitte Herr oder Frau wählen - geraten wird nicht.
        </p>
      )}

      <label className="feld-label -mb-2">Telefon</label>
      <div className="input-field-icon">
        <Phone className="h-4 w-4 text-primary flex-shrink-0" />
        <input type="tel" value={werte.telefon || ''} onChange={setze('telefon')}
               placeholder="Telefonnummer eingeben..." />
      </div>

      <label className="feld-label -mb-2">E-Mail <span className="text-red-500">*</span></label>
      <div className={`input-field-icon${mailFehlt ? ' fehlt' : ''}`}>
        <Mail className={`h-4 w-4 flex-shrink-0 ${mailFehlt ? 'text-red-500' : 'text-primary'}`} />
        <input type="email" value={werte.email || ''} onChange={setze('email')}
               placeholder="E-Mail eingeben..." />
      </div>
      {mailFehlt && (
        <p className="text-xs text-red-500 -mt-1">
          Ohne E-Mail geht weder eine Terminbestätigung noch eine Nachfass-Mail
          raus. Eine hinterlegte Adresse lässt sich deshalb nicht leeren.
        </p>
      )}

      <label className="feld-label -mb-2">Website</label>
      <div className="input-field-icon">
        <Globe className="h-4 w-4 text-primary flex-shrink-0" />
        <input type="url" value={werte.website || ''} onChange={setze('website')}
               placeholder="Website eingeben..." />
      </div>

      <label className="feld-label -mb-2">Ort</label>
      <div className="input-field-icon">
        <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
        <input value={werte.ort || ''} onChange={setze('ort')} placeholder="Ort eingeben..." />
      </div>
    </div>
  )
}
