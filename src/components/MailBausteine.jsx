import { useState } from 'react'
import { Sparkles, Loader2, Plus, FileText, ChevronDown, Info } from 'lucide-react'

// Textvorschläge für die Mail, gebaut aus der Übergabe des Setters.
//
// Die gute Mail vor einem Abschlussgespräch spiegelt dem Kunden seine eigenen
// Zahlen zurück - "rund 25 Anfragen im Jahr, fast alle über Ihr Netzwerk,
// Ziel 40". Genau das steht im CRM, nur eben in Feldern und nicht in Sätzen.
//
// Darum: Anlass wählen, Vorschläge holen, Bausteine einzeln übernehmen. Wer
// nichts davon mag, schreibt weiter selbst - nichts wird automatisch gesendet.
// Unter „Grundlage" steht, welche Angaben verwendet wurden; was dort fehlt,
// darf auch im Text nicht auftauchen.

const ANLAESSE = [
  ['vorbereitung', 'Vor dem Abschlussgespräch'],
  ['unterlagen', 'Unterlagen nachsenden'],
  ['angebot', 'Angebot erklären'],
  ['nachfassen', 'Nachfassen'],
  ['neuer_termin', 'Neuer Termin nach Platzer'],
  ['onboarding', 'Nach dem Abschluss']
]

export default function MailBausteine({ hotLeadId, onBetreff, onEinfuegen, onEntwurf }) {
  const [anlass, setAnlass] = useState('vorbereitung')
  const [hinweis, setHinweis] = useState('')
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState('')
  const [ergebnis, setErgebnis] = useState(null)
  const [grundlageOffen, setGrundlageOffen] = useState(false)
  const [eingefuegt, setEingefuegt] = useState([])

  if (!hotLeadId) return null

  const holen = async () => {
    setLaedt(true); setFehler(''); setErgebnis(null); setEingefuegt([])
    try {
      const antwort = await fetch('/.netlify/functions/mail-bausteine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotLeadId, anlass, hinweis })
      })
      const daten = await antwort.json()
      if (!antwort.ok) {
        setFehler(daten.message || daten.error || 'Vorschläge konnten nicht erstellt werden')
        if (daten.grundlage) setErgebnis({ bausteine: [], grundlage: daten.grundlage })
        return
      }
      setErgebnis(daten)
      setGrundlageOffen(false)
    } catch (e) {
      setFehler('Vorschläge konnten nicht erstellt werden: ' + e.message)
    } finally {
      setLaedt(false)
    }
  }

  const einfuegen = (baustein, i) => {
    onEinfuegen?.(baustein.text)
    setEingefuegt(liste => [...liste, i])
  }

  return (
    <div className="abschnitt space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="abschnitt-titel mb-0">
          <Sparkles className="w-4 h-4" />
          Textvorschläge aus der Übergabe
        </h4>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[200px]">
          <span className="feld-label">Anlass</span>
          <select
            value={anlass}
            onChange={e => setAnlass(e.target.value)}
            className="select-field"
          >
            {ANLAESSE.map(([wert, name]) => <option key={wert} value={wert}>{name}</option>)}
          </select>
        </label>
        <label className="flex-[2] min-w-[220px]">
          <span className="feld-label">Eigener Hinweis (optional)</span>
          <input
            type="text"
            value={hinweis}
            onChange={e => setHinweis(e.target.value)}
            placeholder="z. B. Referenz Wüstenrot erwähnen"
            className="input-field"
            maxLength={500}
          />
        </label>
        <button
          type="button"
          onClick={holen}
          disabled={laedt}
          className="btn-primary whitespace-nowrap"
        >
          {laedt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {laedt ? 'Schreibt…' : 'Vorschläge holen'}
        </button>
      </div>

      {fehler && (
        <p className="text-body-sm text-error">{fehler}</p>
      )}

      {ergebnis?.grundlage?.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setGrundlageOffen(o => !o)}
            className="flex items-center gap-1.5 text-label-sm text-on-surface-variant hover:text-primary"
          >
            <Info className="w-3.5 h-3.5" />
            Grundlage: {ergebnis.grundlage.length} Angaben aus dem Kontakt
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${grundlageOffen ? 'rotate-180' : ''}`} />
          </button>
          {grundlageOffen && (
            <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-surface-container p-3">
              {ergebnis.grundlage.map(([schluessel, wert]) => (
                <div key={schluessel} className="flex gap-2 text-body-sm min-w-0">
                  <dt className="text-on-surface-variant shrink-0">{schluessel}:</dt>
                  <dd className="text-on-surface truncate">{wert}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {ergebnis?.betreff && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/60 p-3">
          <div className="min-w-0">
            <p className="feld-label mb-0">Betreff</p>
            <p className="text-body-md text-on-surface truncate">{ergebnis.betreff}</p>
          </div>
          <button type="button" onClick={() => onBetreff?.(ergebnis.betreff)} className="btn-secondary whitespace-nowrap">
            Übernehmen
          </button>
        </div>
      )}

      {ergebnis?.bausteine?.length > 0 && (
        <>
          <div className="space-y-2">
            {ergebnis.bausteine.map((baustein, i) => (
              <div key={i} className="rounded-lg border border-outline-variant/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="feld-label mb-0">{baustein.titel}</p>
                  <button
                    type="button"
                    onClick={() => einfuegen(baustein, i)}
                    className="kopf-knopf whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {eingefuegt.includes(i) ? 'Nochmal einfügen' : 'Einfügen'}
                  </button>
                </div>
                <p className="mt-1.5 text-body-sm text-on-surface whitespace-pre-line">{baustein.text}</p>
              </div>
            ))}
          </div>

          {ergebnis.entwurf && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body-sm text-on-surface-variant">
                Alle Bausteine zusammen ergeben einen fertigen Text.
              </p>
              <button type="button" onClick={() => onEntwurf?.(ergebnis.entwurf)} className="btn-secondary whitespace-nowrap">
                <FileText className="w-4 h-4" />
                Kompletten Entwurf übernehmen
              </button>
            </div>
          )}
        </>
      )}

      {ergebnis && !ergebnis.bausteine?.length && ergebnis.entwurf && (
        <div className="rounded-lg border border-outline-variant/60 p-3">
          <p className="text-body-sm text-on-surface whitespace-pre-line">{ergebnis.entwurf}</p>
          <button type="button" onClick={() => onEntwurf?.(ergebnis.entwurf)} className="btn-secondary mt-3">
            Text übernehmen
          </button>
        </div>
      )}
    </div>
  )
}
