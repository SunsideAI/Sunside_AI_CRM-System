import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * SlideDrawer - A reusable slide-in drawer component from the right
 *
 * @param {boolean} isOpen - Whether the drawer is open
 * @param {function} onClose - Function to call when closing
 * @param {string} title - Title shown in the header
 * @param {React.ReactNode} children - Content to render inside the drawer
 * @param {string} width - Width class (default: 'max-w-xl')
 */
function SlideDrawer({ isOpen, onClose, title, untertitel, children, width = 'max-w-2xl', headerActions, fuss }) {
  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-scrim/50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full ${width} bg-surface shadow-xl transform transition-transform duration-300 ease-out flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-outline-variant px-4 sm:px-6 py-4 flex items-center justify-between z-10">
          <div className="min-w-0 pr-4">
            <h2 className="text-title-lg font-semibold text-on-surface truncate">
              {title}
            </h2>
            {/* Eine Zeile Einordnung unter dem Namen. Der Kopf trug bisher nur
                den Firmennamen - wer die Schublade oeffnete, musste erst
                nach unten sehen, um zu wissen, womit er es zu tun hat. */}
            {untertitel && (
              <p className="text-body-sm text-on-surface-variant truncate mt-0.5">
                {untertitel}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-container transition-colors"
              aria-label="Schließen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Inhalt. Der Innenabstand gehoert hierher, nicht in jeden Aufrufer:
            Die Kopfzeile darueber hat ihn bereits, und ohne ihn klebte der
            Inhalt an der linken Kante, waehrend der Titel eingerueckt stand. */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {children}
        </div>

        {/* Fusszeile. Die Aktionen einer Schublade gehoeren immer hierher -
            vorher lagen sie mal oben, mal mittendrin, mal gar nicht da. */}
        {fuss && (
          <div className="schublade-fuss">
            {fuss}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default SlideDrawer
