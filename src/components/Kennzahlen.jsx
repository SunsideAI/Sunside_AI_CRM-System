// Die Bausteine einer Auswertung: Kennzahl-Kacheln und Diagramm-Karten.
//
// Das Finanzen-Dashboard hatte sie als lokale Helfer — grosse Zahl, Symbol in
// einem farbigen Feld oben rechts, die wichtigste Kachel gefüllt. Opening und
// Closing bauten ihre Kacheln selbst: Symbol links, winzige Zahl daneben, und
// alles in eine Reihe gequetscht. Bei sieben Kacheln stand dort dann
// "Umsatz Ges…".
//
// Hier stehen sie einmal, damit alle vier Auswertungen dieselbe Sprache
// sprechen.

/** Während geladen wird, steht dort ein Platzhalter — kein „…", das sich
    wie ein Wert liest. */
function Platzhalter({ hell = false }) {
  return (
    <span className={`inline-block h-8 w-24 rounded-md animate-pulse align-middle ${
      hell ? 'bg-white/25' : 'bg-on-surface/10'
    }`} />
  )
}

/** Die eine Zahl, auf die es ankommt. Gefüllt, damit das Auge dort startet. */
export function HeroKennzahl({ label, value, subtitle, icon: Icon, vergleich, laedt = false }) {
  return (
    <div className="relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-primary to-primary-container text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-white/80 truncate">{label}</p>
          <p className="mt-2 text-3xl font-bold">{laedt ? <Platzhalter hell /> : value}</p>
          {(vergleich || subtitle) && (
            <p className="mt-1 text-sm text-white/80 truncate">
              {vergleich ?? subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-3 rounded-lg bg-white/20 shrink-0">
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
      {/* Der Lichtfleck gibt der Kachel Tiefe, ohne ein Bild zu brauchen. */}
      <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl" />
    </div>
  )
}

const FARBEN = {
  green:   'bg-success/10 text-success',
  blue:    'bg-primary/10 text-primary',
  purple:  'bg-primary/10 text-primary',
  amber:   'bg-warning/10 text-warning',
  yellow:  'bg-warning/10 text-warning',
  red:     'bg-error/10 text-error',
  neutral: 'bg-on-surface/10 text-on-surface-variant',
  gray:    'bg-on-surface/10 text-on-surface-variant'
}

/** Eine Kennzahl: Beschriftung klein darüber, Zahl gross, Symbol rechts. */
export function Kennzahl({ label, value, subtitle, icon: Icon, color = 'neutral', vergleich, laedt = false }) {
  return (
    <div className="metric-card hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-label-sm uppercase tracking-wide text-on-surface-variant truncate">
            {label}
          </p>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <p className="text-headline-md font-bold text-on-surface">{laedt ? <Platzhalter /> : value}</p>
            {vergleich}
          </div>
          {subtitle && <p className="mt-1 text-body-sm text-on-surface-variant truncate">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg shrink-0 ${FARBEN[color] || FARBEN.neutral}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Der Pfeil neben einer Zahl, wenn ein Vergleichszeitraum gewählt ist.
 *
 * `inverted` für Zahlen, bei denen weniger besser ist — No-Shows etwa.
 */
export function Vergleich({ diff, percent, inverted, hell = false }) {
  if (diff === undefined || diff === null) return null
  const gut = inverted ? diff < 0 : diff > 0
  const schlecht = inverted ? diff > 0 : diff < 0
  const pfeil = diff > 0 ? '↑' : diff < 0 ? '↓' : '→'
  const farbe = hell
    ? 'text-white/80'
    : gut ? 'text-success' : schlecht ? 'text-error' : 'text-outline'
  const text = percent !== undefined
    ? `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`
    : `${diff > 0 ? '+' : ''}${diff}`
  return <span className={`text-label-md font-medium ${farbe}`}>{pfeil} {text}</span>
}

/** Eine Diagramm-Karte: Titel, eine Zeile Einordnung, dann das Diagramm. */
export function DiagrammKarte({ title, subtitle, aktion, children, className = '' }) {
  return (
    <div className={`card p-6 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-label-lg font-semibold text-on-surface">{title}</h3>
          {subtitle && <p className="text-body-sm text-on-surface-variant mt-0.5">{subtitle}</p>}
        </div>
        {aktion}
      </div>
      {children}
    </div>
  )
}

/** Was statt eines Diagramms steht, wenn es nichts zu zeigen gibt. */
export function LeerZustand({ icon: Icon, message, hoehe = 'h-[280px]' }) {
  return (
    <div className={`flex flex-col items-center justify-center ${hoehe} text-on-surface-variant`}>
      {Icon && <Icon className="w-12 h-12 mb-2 opacity-50" />}
      <p className="text-body-md">{message}</p>
    </div>
  )
}
