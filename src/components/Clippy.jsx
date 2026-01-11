import { useState, useEffect } from 'react'
import { X, Sparkles } from 'lucide-react'

// Motivationstipps für Vertriebler
const TIPPS = [
  { text: "Anscheinend telefonierst du gerade. Brauchst du Hilfe beim Closing?", emoji: "📞" },
  { text: "Tipp: Ein Lächeln hört man auch durchs Telefon!", emoji: "😊" },
  { text: "Wusstest du? Die beste Zeit zum Anrufen ist zwischen 10-11 Uhr!", emoji: "⏰" },
  { text: "Du schaffst das! Jedes Nein bringt dich näher zum Ja!", emoji: "💪" },
  { text: "Erinnerung: Trink mal einen Schluck Wasser!", emoji: "💧" },
  { text: "Fun Fact: Top-Vertriebler machen 52 Anrufe pro Tag!", emoji: "🏆" },
  { text: "Tipp: Nach 5 Neins kommt statistisch ein Ja!", emoji: "📊" },
  { text: "Denk dran: Du verkaufst nicht - du hilfst!", emoji: "🤝" },
  { text: "Kurze Pause? Steh mal auf und streck dich!", emoji: "🧘" },
  { text: "Heute schon gelächelt? Dein Erfolg hängt davon ab!", emoji: "😄" },
  { text: "Psst... der nächste Lead könnte der große Deal sein!", emoji: "🎯" },
  { text: "Vergiss nicht: Follow-ups machen 80% der Deals!", emoji: "📧" },
  { text: "Kleiner Tipp: Sprich den Namen des Kunden aus!", emoji: "👋" },
  { text: "Zeit für einen Kaffee? Aber nur einer!", emoji: "☕" },
  { text: "Du bist heute 100% erfolgreicher als gestern!", emoji: "📈" },
  { text: "Erinnerung: CRM-Notizen sind dein bester Freund!", emoji: "📝" },
  { text: "Tipp: Frag offene Fragen - Wer, Was, Wie, Warum!", emoji: "❓" },
  { text: "Motivation: Jeder Anruf ist eine neue Chance!", emoji: "🌟" },
  { text: "Hey! Hast du heute schon einen Termin gebucht?", emoji: "📅" },
  { text: "Geheimtipp: Montag morgen ist Gold wert!", emoji: "🥇" },
  { text: "Es sieht so aus, als würdest du etwas schreiben. Soll ich helfen?", emoji: "✍️" },
  { text: "Ich sehe du bist fleißig! Weiter so!", emoji: "🔥" },
  { text: "Kleiner Reminder: Qualität vor Quantität bei den Calls!", emoji: "⭐" },
  { text: "Hast du heute schon deine Wiedervorlagen gecheckt?", emoji: "🔔" },
]

// Animationen für Clippy
const ANIMATIONEN = [
  'idle', 'wave', 'thinking', 'explain', 'congratulate', 'alert'
]

// Clippy erscheint zufällig alle X Minuten
const ERSCHEINUNGS_INTERVALL = 5 * 60 * 1000 // 5 Minuten

export default function Clippy() {
  const [isVisible, setIsVisible] = useState(false)
  const [currentTipp, setCurrentTipp] = useState(TIPPS[0])
  const [isAnimating, setIsAnimating] = useState(false)
  const [animation, setAnimation] = useState('idle')
  const [isTyping, setIsTyping] = useState(false)
  const [displayedText, setDisplayedText] = useState('')

  // Zufälligen Tipp auswählen
  const getRandomTipp = () => {
    const randomIndex = Math.floor(Math.random() * TIPPS.length)
    return TIPPS[randomIndex]
  }

  // Zufällige Animation
  const getRandomAnimation = () => {
    const animations = ['wave', 'thinking', 'explain', 'congratulate']
    return animations[Math.floor(Math.random() * animations.length)]
  }

  // Typewriter Effekt
  useEffect(() => {
    if (!isVisible || !currentTipp) return
    
    setIsTyping(true)
    setDisplayedText('')
    
    const fullText = `${currentTipp.emoji} ${currentTipp.text}`
    let index = 0
    
    const typeInterval = setInterval(() => {
      if (index < fullText.length) {
        setDisplayedText(fullText.slice(0, index + 1))
        index++
      } else {
        clearInterval(typeInterval)
        setIsTyping(false)
      }
    }, 30) // 30ms pro Zeichen
    
    return () => clearInterval(typeInterval)
  }, [isVisible, currentTipp])

  // Clippy erscheinen lassen
  const showClippy = () => {
    const newTipp = getRandomTipp()
    setCurrentTipp(newTipp)
    setAnimation(getRandomAnimation())
    setIsAnimating(true)
    setIsVisible(true)
    
    // Animation beenden
    setTimeout(() => {
      setIsAnimating(false)
      setAnimation('idle')
    }, 1500)
  }

  // Neuer Tipp
  const newTipp = () => {
    setAnimation('thinking')
    setTimeout(() => {
      setCurrentTipp(getRandomTipp())
      setAnimation('explain')
      setTimeout(() => setAnimation('idle'), 1000)
    }, 500)
  }

  // Initial und dann alle X Minuten erscheinen
  useEffect(() => {
    // Beim ersten Laden nach 30 Sekunden erscheinen
    const initialTimeout = setTimeout(() => {
      showClippy()
    }, 30000)

    // Dann alle X Minuten
    const interval = setInterval(() => {
      // 50% Chance zu erscheinen
      if (Math.random() > 0.5) {
        showClippy()
      }
    }, ERSCHEINUNGS_INTERVALL)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [])

  if (!isVisible) return null

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-end gap-3 ${isAnimating ? 'animate-bounce' : ''}`}>
      {/* Sprechblase */}
      <div className="relative bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl p-4 max-w-sm shadow-xl">
        {/* Schließen Button */}
        <button
          onClick={() => setIsVisible(false)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center transition-colors shadow-md"
        >
          <X className="w-3 h-3 text-red-600" />
        </button>
        
        {/* Glitzer Effekt */}
        <div className="absolute -top-1 -left-1">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
        </div>
        
        {/* Sprechblasen-Pfeil */}
        <div className="absolute -right-3 bottom-6 w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[14px] border-l-amber-300" />
        <div className="absolute -right-[10px] bottom-6 w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[14px] border-l-amber-50" />
        
        {/* Text mit Typewriter */}
        <p className="text-sm text-gray-700 leading-relaxed pr-4 min-h-[3rem]">
          {displayedText}
          {isTyping && <span className="animate-pulse">|</span>}
        </p>
        
        {/* Buttons */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-amber-200">
          <button
            onClick={newTipp}
            disabled={isTyping}
            className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1 disabled:opacity-50"
          >
            <Sparkles className="w-3 h-3" />
            Neuer Tipp
          </button>
          <span className="text-[10px] text-amber-400">Karl Klammer 📎</span>
        </div>
      </div>
      
      {/* Clippy Bild mit Animationen */}
      <div 
        className={`flex-shrink-0 cursor-pointer transition-all duration-300 ${
          animation === 'wave' ? 'animate-wiggle' :
          animation === 'thinking' ? 'animate-pulse' :
          animation === 'congratulate' ? 'animate-bounce' :
          animation === 'explain' ? 'scale-105' :
          ''
        }`}
        onClick={showClippy}
        title="Klick mich für einen neuen Tipp!"
      >
        {/* Clippy SVG - inspiriert vom Original */}
        <div className="relative">
          <svg width="80" height="100" viewBox="0 0 80 100" className="drop-shadow-lg">
            {/* Körper - die Büroklammer */}
            <defs>
              <linearGradient id="clipGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#9CA3AF" />
                <stop offset="50%" stopColor="#D1D5DB" />
                <stop offset="100%" stopColor="#9CA3AF" />
              </linearGradient>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.3"/>
              </filter>
            </defs>
            
            {/* Büroklammer Form */}
            <path 
              d="M25 95 Q15 95 15 85 L15 25 Q15 10 30 10 L50 10 Q65 10 65 25 L65 70 Q65 80 55 80 L35 80 Q25 80 25 70 L25 35 Q25 28 32 28 L48 28 Q55 28 55 35 L55 55"
              fill="none"
              stroke="url(#clipGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              filter="url(#shadow)"
              className={animation === 'wave' ? 'origin-bottom animate-wiggle' : ''}
            />
            
            {/* Augen */}
            <g className={animation === 'thinking' ? 'animate-pulse' : ''}>
              {/* Linkes Auge */}
              <ellipse cx="32" cy="45" rx="8" ry="10" fill="white" stroke="#374151" strokeWidth="1"/>
              <ellipse cx="34" cy="46" rx="4" ry="5" fill="#374151">
                <animate 
                  attributeName="cx" 
                  values="34;32;34;36;34" 
                  dur="3s" 
                  repeatCount="indefinite"
                />
              </ellipse>
              <ellipse cx="35" cy="44" rx="1.5" ry="2" fill="white"/>
              
              {/* Rechtes Auge */}
              <ellipse cx="48" cy="45" rx="8" ry="10" fill="white" stroke="#374151" strokeWidth="1"/>
              <ellipse cx="50" cy="46" rx="4" ry="5" fill="#374151">
                <animate 
                  attributeName="cx" 
                  values="50;48;50;52;50" 
                  dur="3s" 
                  repeatCount="indefinite"
                />
              </ellipse>
              <ellipse cx="51" cy="44" rx="1.5" ry="2" fill="white"/>
            </g>
            
            {/* Augenbrauen */}
            <g className={animation === 'thinking' ? '' : ''}>
              <path d="M24 35 Q32 32 40 35" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round">
                {animation === 'thinking' && (
                  <animate attributeName="d" values="M24 35 Q32 32 40 35;M24 32 Q32 28 40 32;M24 35 Q32 32 40 35" dur="1s" repeatCount="indefinite"/>
                )}
              </path>
              <path d="M40 35 Q48 32 56 35" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round">
                {animation === 'thinking' && (
                  <animate attributeName="d" values="M40 35 Q48 32 56 35;M40 32 Q48 28 56 32;M40 35 Q48 32 56 35" dur="1s" repeatCount="indefinite"/>
                )}
              </path>
            </g>
          </svg>
          
          {/* Kleine Sterne beim Congratulate */}
          {animation === 'congratulate' && (
            <>
              <Sparkles className="absolute -top-2 -left-2 w-4 h-4 text-yellow-400 animate-ping" />
              <Sparkles className="absolute -top-1 right-0 w-3 h-3 text-amber-400 animate-ping delay-100" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Tailwind Animation hinzufügen (in tailwind.config.js)
// animation: { wiggle: 'wiggle 0.5s ease-in-out' }
// keyframes: { wiggle: { '0%, 100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' } } }
