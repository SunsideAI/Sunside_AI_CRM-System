import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

// Motivationstipps für Vertriebler
const TIPPS = [
  "Anscheinend telefonierst du gerade. Brauchst du Hilfe beim Closing? 📞",
  "Tipp: Ein Lächeln hört man auch durchs Telefon! 😊",
  "Wusstest du? Die beste Zeit zum Anrufen ist zwischen 10-11 Uhr! ⏰",
  "Du schaffst das! Jedes Nein bringt dich näher zum Ja! 💪",
  "Erinnerung: Trink mal einen Schluck Wasser! 💧",
  "Fun Fact: Top-Vertriebler machen 52 Anrufe pro Tag! 🏆",
  "Tipp: Nach 5 Neins kommt statistisch ein Ja! 📊",
  "Denk dran: Du verkaufst nicht - du hilfst! 🤝",
  "Kurze Pause? Steh mal auf und streck dich! 🧘",
  "Heute schon gelächelt? Dein Erfolg hängt davon ab! 😄",
  "Psst... der nächste Lead könnte der große Deal sein! 🎯",
  "Vergiss nicht: Follow-ups machen 80% der Deals! 📧",
  "Kleiner Tipp: Sprich den Namen des Kunden aus! 👋",
  "Zeit für einen Kaffee? ☕ Aber nur einer!",
  "Du bist heute 100% erfolgreicher als gestern! 📈",
  "Erinnerung: CRM-Notizen sind dein bester Freund! 📝",
  "Tipp: Frag offene Fragen - Wer, Was, Wie, Warum! ❓",
  "Motivation: Jeder Anruf ist eine neue Chance! 🌟",
  "Hey! Hast du heute schon einen Termin gebucht? 📅",
  "Geheimtipp: Montag morgen ist Gold wert! 🥇"
]

// Clippy erscheint zufällig alle X Minuten
const ERSCHEINUNGS_INTERVALL = 5 * 60 * 1000 // 5 Minuten

export default function Clippy() {
  const [isVisible, setIsVisible] = useState(false)
  const [currentTipp, setCurrentTipp] = useState('')
  const [isAnimating, setIsAnimating] = useState(false)

  // Zufälligen Tipp auswählen
  const getRandomTipp = () => {
    const randomIndex = Math.floor(Math.random() * TIPPS.length)
    return TIPPS[randomIndex]
  }

  // Clippy erscheinen lassen
  const showClippy = () => {
    setCurrentTipp(getRandomTipp())
    setIsAnimating(true)
    setIsVisible(true)
    
    // Animation beenden
    setTimeout(() => setIsAnimating(false), 500)
    
    // Nach 15 Sekunden automatisch ausblenden
    setTimeout(() => {
      setIsVisible(false)
    }, 15000)
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
    <div className={`fixed bottom-6 right-6 z-50 flex items-end gap-2 ${isAnimating ? 'animate-bounce' : ''}`}>
      {/* Sprechblase */}
      <div className="relative bg-amber-50 border-2 border-amber-300 rounded-xl p-4 max-w-xs shadow-lg">
        {/* Schließen Button */}
        <button
          onClick={() => setIsVisible(false)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>
        
        {/* Sprechblasen-Pfeil */}
        <div className="absolute -right-3 bottom-4 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-l-[12px] border-l-amber-300" />
        <div className="absolute -right-[9px] bottom-4 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-l-[12px] border-l-amber-50" />
        
        {/* Text */}
        <p className="text-sm text-gray-700 leading-relaxed pr-4">
          {currentTipp}
        </p>
        
        {/* Neuer Tipp Button */}
        <button
          onClick={() => setCurrentTipp(getRandomTipp())}
          className="mt-3 text-xs text-amber-600 hover:text-amber-700 font-medium"
        >
          💡 Neuer Tipp
        </button>
      </div>
      
      {/* Clippy Bild */}
      <div className="flex-shrink-0 cursor-pointer hover:scale-105 transition-transform" onClick={showClippy}>
        <img 
          src="https://upload.wikimedia.org/wikipedia/en/d/db/Clippy-letter.PNG" 
          alt="Clippy"
          className="w-20 h-auto drop-shadow-lg"
        />
      </div>
    </div>
  )
}
