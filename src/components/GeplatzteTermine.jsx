import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, CalendarPlus, ChevronRight, Loader2 } from 'lucide-react'
import { STATUS } from '../../shared/status.js'

// Geplatzte Termine, die neu gelegt werden müssen.
//
// Der Ablauf ist auf beiden Stufen derselbe und geht immer eine Stufe zurück:
//
//   Beratungsgespräch geplatzt → zurück an den Opener, der neu terminiert
//   Abschlussgespräch geplatzt → zurück an den Setter, der neu terminiert
//
// Wer den Termin gemacht hat, macht den neuen. Im Opening gab es diesen Kasten
// schon; im Setting fehlte er, und damit hatte ein geplatztes
// Abschlussgespräch niemanden, der sich darum kümmert.

export default function GeplatzteTermine({
  /** 'beratung' | 'abschluss' — welche Stufe geplatzt ist */
  stufe,
  /** Abfrage nach der eigenen Rolle, z. B. `openerId=...` oder `setterId=...` */
  abfrage,
  /** Wird mit dem Lead aufgerufen, wenn neu terminiert werden soll */
  onNeuTerminieren,
  /** Damit der Kasten nach einer Buchung neu lädt */
  neuladenSignal
}) {
  const [leads, setLeads] = useState([])
  const [laedt, setLaedt] = useState(false)
  const [zu, setZu] = useState(false)

  const istAbschluss = stufe === 'abschluss'

  const laden = useCallback(async () => {
    if (!abfrage) return
    setLaedt(true)
    try {
      const antwort = await fetch(
        `/.netlify/functions/hot-leads?${abfrage}&status=${encodeURIComponent(
          `${STATUS.NICHT_ERSCHIENEN},${STATUS.TERMIN_ABGESAGT}`)}`)
      const daten = await antwort.json()
      if (!antwort.ok) { setLeads([]); return }

      const passend = (daten.hotLeads || [])
        // „Der Closer kümmert sich selbst" nimmt den Kontakt aus dieser Liste.
        .filter(l => !l.no_show_keep_in_closing)
        // Ein geplatztes Abschlussgespräch erkennt man daran, DASS es eines
        // gab. Ohne diese Trennung stünden im Setting auch die geplatzten
        // Beratungsgespräche, die dem Opener gehören.
        .filter(l => istAbschluss
          ? !!l.termin_abschlussgespraech
          : !l.termin_abschlussgespraech)
        .sort((a, b) => new Date(b.no_show_marked_at || b.terminDatum || 0)
                      - new Date(a.no_show_marked_at || a.terminDatum || 0))

      setLeads(passend)
    } catch {
      setLeads([])
    } finally {
      setLaedt(false)
    }
  }, [abfrage, istAbschluss])

  useEffect(() => { laden() }, [laden, neuladenSignal])

  if (leads.length === 0) return null

  const datum = (iso) => iso
    ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    : ''

  return (
    <div className="card p-5">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setZu(z => !z)}
      >
        <h3 className="text-title-md font-medium text-on-surface flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-primary" />
          {istAbschluss ? 'Abschluss-Termine' : 'Setting-Termine'} neu vereinbaren ({leads.length})
        </h3>
        <div className="flex items-center gap-2">
          {laedt && <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant" />}
          <ChevronRight className={`w-5 h-5 text-on-surface-variant transition-transform duration-200 ${zu ? '' : 'rotate-90'}`} />
        </div>
      </div>

      {!zu && (
        <>
          <p className="text-body-sm text-on-surface-variant mt-1 mb-3">
            {istAbschluss
              ? 'Diese Kontakte brauchen ein neues Abschlussgespräch, weil das alte geplatzt ist: nicht erschienen oder abgesagt.'
              : 'Diese Leads brauchen einen neuen Termin, weil der alte geplatzt ist: nicht erschienen oder abgesagt.'}
          </p>

          <div className="space-y-2">
            {leads.slice(0, 5).map(lead => (
              <div
                key={lead.id}
                className="flex items-center justify-between gap-3 p-3 bg-surface-container rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-body-md text-on-surface truncate">
                    {lead.unternehmen || 'Ohne Namen'}
                  </div>
                  <div className="text-body-sm text-on-surface-variant flex items-center gap-2 mt-0.5">
                    <span className="truncate">
                      {[lead.ansprechpartnerVorname, lead.ansprechpartnerNachname].filter(Boolean).join(' ')}
                    </span>
                    {lead.status === STATUS.NICHT_ERSCHIENEN ? (
                      <span className="px-1.5 py-0.5 bg-error-container text-error rounded text-label-sm shrink-0">
                        {(lead.no_show_count || 0) > 1 ? `${lead.no_show_count}. No-Show` : 'No-Show'}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-warning-container text-warning rounded text-label-sm shrink-0">
                        Abgesagt
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-body-sm text-on-surface-variant hidden sm:inline">
                    {datum(lead.no_show_marked_at || lead.termin_abschlussgespraech || lead.terminDatum)}
                  </span>
                  <button
                    onClick={() => onNeuTerminieren?.(lead)}
                    className="btn-primary inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <CalendarPlus className="w-4 h-4" /> Termin buchen
                  </button>
                </div>
              </div>
            ))}

            {leads.length > 5 && (
              <p className="text-body-sm text-on-surface-variant pt-1">
                und {leads.length - 5} weitere
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
