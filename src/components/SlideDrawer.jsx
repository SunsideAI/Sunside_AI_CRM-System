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
function SlideDrawer({ isOpen, onClose, title, children, width = 'max-w-xl', headerActions }) {
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
          <h2 className="text-title-lg font-semibold text-on-surface truncate pr-4">
            {title}
          </h2>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default SlideDrawer
