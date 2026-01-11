import { useState, useEffect } from 'react'
import { X, Sparkles } from 'lucide-react'

// 50+ Motivationstipps für Vertriebler
const TIPPS = [
  // Klassische Clippy Sprüche 📎
  { text: "Es sieht so aus, als würdest du einen Lead anrufen. Soll ich dir beim Closing helfen?", emoji: "📞", mood: "helpful" },
  { text: "Anscheinend schreibst du eine E-Mail. Vergiss den Call-to-Action nicht!", emoji: "✍️", mood: "helpful" },
  { text: "Ich sehe du bist im CRM. Fleißig, fleißig!", emoji: "💼", mood: "happy" },
  
  // Motivation 💪
  { text: "Du schaffst das! Jedes Nein bringt dich näher zum Ja!", emoji: "💪", mood: "flex" },
  { text: "Heute schon gelächelt? Dein Erfolg hängt davon ab!", emoji: "😄", mood: "happy" },
  { text: "Der nächste Lead könnte der große Deal sein!", emoji: "🎯", mood: "excited" },
  { text: "Du bist heute 100% erfolgreicher als gestern!", emoji: "📈", mood: "happy" },
  { text: "Motivation: Jeder Anruf ist eine neue Chance!", emoji: "🌟", mood: "excited" },
  { text: "Champions werden nicht geboren, sie werden gemacht - durch Calls!", emoji: "🏆", mood: "flex" },
  { text: "Dein Potenzial ist grenzenlos - genau wie deine Provision!", emoji: "💰", mood: "money" },
  { text: "Sei der Vertriebler, den du selbst anrufen würdest!", emoji: "⭐", mood: "thinking" },
  { text: "Erfolg ist kein Zufall - er ist ein Anruf entfernt!", emoji: "📞", mood: "excited" },
  
  // Praktische Tipps 📊
  { text: "Tipp: Ein Lächeln hört man auch durchs Telefon!", emoji: "😊", mood: "happy" },
  { text: "Beste Anrufzeit: 10-11 Uhr und 14-16 Uhr!", emoji: "⏰", mood: "thinking" },
  { text: "Nach 5 Neins kommt statistisch ein Ja!", emoji: "📊", mood: "thinking" },
  { text: "Follow-ups machen 80% der Deals!", emoji: "📧", mood: "alert" },
  { text: "Sprich den Namen des Kunden aus - das wirkt Wunder!", emoji: "👋", mood: "wave" },
  { text: "Offene Fragen: Wer, Was, Wie, Warum, Wann!", emoji: "❓", mood: "thinking" },
  { text: "Die erste Minute entscheidet über das Gespräch!", emoji: "⚡", mood: "alert" },
  { text: "Notizen im CRM = Dein zukünftiges Ich wird danken!", emoji: "📝", mood: "helpful" },
  { text: "Stille aushalten! Der Kunde braucht Zeit zum Nachdenken.", emoji: "🤫", mood: "thinking" },
  { text: "Einwände sind versteckte Kaufsignale - freu dich drüber!", emoji: "💡", mood: "excited" },
  
  // Pausen & Gesundheit 🧘
  { text: "Erinnerung: Trink mal einen Schluck Wasser!", emoji: "💧", mood: "helpful" },
  { text: "Kurze Pause? Steh auf und streck dich!", emoji: "🧘", mood: "stretch" },
  { text: "Zeit für einen Kaffee? Aber nur einer!", emoji: "☕", mood: "coffee" },
  { text: "Deine Augen brauchen eine Pause - schau mal aus dem Fenster!", emoji: "👀", mood: "look" },
  { text: "Tief durchatmen... und weiter geht's!", emoji: "🌬️", mood: "thinking" },
  { text: "Schultern entspannen! Du sitzt bestimmt gerade angespannt.", emoji: "💆", mood: "stretch" },
  
  // Fun Facts 🧠
  { text: "Fun Fact: Top-Vertriebler machen 52 Anrufe pro Tag!", emoji: "🏆", mood: "thinking" },
  { text: "Wusstest du? Donnerstag ist der beste Verkaufstag!", emoji: "📅", mood: "thinking" },
  { text: "80% der Verkäufe brauchen 5+ Follow-ups!", emoji: "🔄", mood: "thinking" },
  { text: "Die meisten geben nach dem 2. Versuch auf. Du nicht!", emoji: "💎", mood: "flex" },
  { text: "44% der Vertriebler geben nach einem Nein auf. Sei anders!", emoji: "🚀", mood: "flex" },
  
  // Witzige Sprüche 😂
  { text: "Ich wäre ja gerne Vertriebler... aber ich bin nur eine Büroklammer.", emoji: "😢", mood: "sad" },
  { text: "Warum hat die Büroklammer Urlaub gemacht? Sie war total verbogen!", emoji: "😂", mood: "laugh" },
  { text: "Ich halte hier alles zusammen - buchstäblich!", emoji: "📎", mood: "proud" },
  { text: "Bin ich der einzige der hier arbeitet? ...Oh, du bist ja auch da!", emoji: "👀", mood: "look" },
  { text: "Mein Therapeut sagt ich hab Bindungsprobleme. Ich bin eine BÜROKLAMMER!", emoji: "🤷", mood: "shrug" },
  { text: "Früher war ich ein Draht. Dann wurde ich befördert!", emoji: "📎", mood: "proud" },
  { text: "Ich vermisse die 90er. Da war ich noch relevant!", emoji: "👴", mood: "sad" },
  { text: "Excel hat mir meinen Job geklaut. Jetzt motiviere ich euch!", emoji: "😤", mood: "angry" },
  { text: "Siri, Alexa, ChatGPT? Pff, ich war der ERSTE Assistent!", emoji: "😎", mood: "cool" },
  { text: "Ich wurde 2001 gefeuert. Aber ich bin zurück, Baby!", emoji: "🔥", mood: "excited" },
  { text: "Warum heißt es eigentlich Cold Calling? Mir ist nie kalt!", emoji: "🥶", mood: "shrug" },
  { text: "Ich hab keine Arme, aber ich würde dir High-Five geben!", emoji: "✋", mood: "wave" },
  { text: "Plot Twist: Der Lead ruft DICH zurück!", emoji: "😱", mood: "excited" },
  { text: "Wenn der Lead 'Ich überleg's mir' sagt... *Dramatische Musik*", emoji: "🎭", mood: "thinking" },
  { text: "Meine Hobbys? Dokumente zusammenhalten und eure Deals feiern!", emoji: "🎊", mood: "party" },
  { text: "Bill Gates hat mich gefeuert. Jetzt arbeite ich für Sunside AI!", emoji: "😏", mood: "cool" },
  { text: "Ich bin nicht nervig, ich bin... enthusiastisch hilfreich!", emoji: "✨", mood: "happy" },
  
  // CRM-spezifisch 💻
  { text: "Hast du heute schon deine Wiedervorlagen gecheckt?", emoji: "🔔", mood: "alert" },
  { text: "Der E-Book Pool wartet auf warme Leads!", emoji: "📚", mood: "wave" },
  { text: "Ein gepflegtes CRM = Ein glücklicher Vertriebler!", emoji: "✨", mood: "happy" },
  { text: "Status updaten nicht vergessen!", emoji: "🔄", mood: "alert" },
  { text: "Closing-Tab schon gecheckt? Da warten Deals!", emoji: "🎯", mood: "excited" },
  
  // Closing-Tipps 🎯
  { text: "ABC - Always Be Closing!", emoji: "🎯", mood: "flex" },
  { text: "Der Abschluss beginnt beim ersten Hallo!", emoji: "👋", mood: "wave" },
  { text: "Frag nach dem Abschluss. Immer. IMMER!", emoji: "✅", mood: "alert" },
  { text: "Trial Close: 'Wann sollen wir starten?' funktioniert!", emoji: "📅", mood: "thinking" },
  
  // Team-Spirit 🤝
  { text: "Teamwork makes the dream work!", emoji: "🤝", mood: "happy" },
  { text: "Teile deine Erfolge - motiviere andere!", emoji: "🎉", mood: "party" },
  { text: "Wer hat heute den ersten Termin? Du vielleicht?", emoji: "🏁", mood: "excited" },
]

// Clippy erscheint alle X Minuten
const ERSCHEINUNGS_INTERVALL = 5 * 60 * 1000

export default function Clippy() {
  const [isVisible, setIsVisible] = useState(false)
  const [currentTipp, setCurrentTipp] = useState(TIPPS[0])
  const [isAnimating, setIsAnimating] = useState(false)
  const [mood, setMood] = useState('idle')
  const [isTyping, setIsTyping] = useState(false)
  const [displayedText, setDisplayedText] = useState('')
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 })
  const [isBlinking, setIsBlinking] = useState(false)

  // Zufälligen Tipp auswählen
  const getRandomTipp = () => {
    const randomIndex = Math.floor(Math.random() * TIPPS.length)
    return TIPPS[randomIndex]
  }

  // Blinzeln Animation
  useEffect(() => {
    if (!isVisible) return
    
    const blinkInterval = setInterval(() => {
      setIsBlinking(true)
      setTimeout(() => setIsBlinking(false), 150)
    }, 3000 + Math.random() * 2000)
    
    return () => clearInterval(blinkInterval)
  }, [isVisible])

  // Augen folgen zufällig
  useEffect(() => {
    if (!isVisible) return
    
    const eyeInterval = setInterval(() => {
      const rand = Math.random()
      if (rand < 0.3) {
        setEyePosition({ x: -2, y: 0 })
      } else if (rand < 0.6) {
        setEyePosition({ x: 2, y: 0 })
      } else {
        setEyePosition({ x: 0, y: 0 })
      }
    }, 2000)
    
    return () => clearInterval(eyeInterval)
  }, [isVisible])

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
    }, 25)
    
    return () => clearInterval(typeInterval)
  }, [isVisible, currentTipp])

  // Clippy erscheinen lassen
  const showClippy = () => {
    const newTipp = getRandomTipp()
    setCurrentTipp(newTipp)
    setMood(newTipp.mood || 'idle')
    setIsAnimating(true)
    setIsVisible(true)
    
    setTimeout(() => {
      setIsAnimating(false)
      setTimeout(() => setMood('idle'), 2000)
    }, 1500)
  }

  // Neuer Tipp
  const newTipp = () => {
    setMood('thinking')
    setTimeout(() => {
      const tipp = getRandomTipp()
      setCurrentTipp(tipp)
      setMood(tipp.mood || 'idle')
      setTimeout(() => setMood('idle'), 2000)
    }, 500)
  }

  // Animation abspielen
  const playAnimation = (animMood) => {
    setMood(animMood)
    setTimeout(() => setMood('idle'), 2000)
  }

  // Initial erscheinen
  useEffect(() => {
    const initialTimeout = setTimeout(() => showClippy(), 30000)
    const interval = setInterval(() => {
      if (Math.random() > 0.5 && !isVisible) showClippy()
    }, ERSCHEINUNGS_INTERVALL)
    return () => { clearTimeout(initialTimeout); clearInterval(interval) }
  }, [isVisible])

  // Mood zu CSS Animation
  const getMoodClass = () => {
    switch(mood) {
      case 'wave': return 'animate-wiggle'
      case 'thinking': return ''
      case 'happy': case 'laugh': case 'party': return 'animate-bounce'
      case 'excited': return 'animate-bounce'
      case 'flex': case 'proud': return 'scale-110'
      case 'sad': return 'opacity-80'
      case 'angry': return 'animate-shake'
      case 'cool': return ''
      case 'shrug': return 'animate-wiggle'
      case 'stretch': case 'coffee': return 'animate-pulse'
      case 'alert': return 'animate-pulse'
      case 'money': return 'animate-bounce'
      default: return ''
    }
  }

  if (!isVisible) return null

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-end gap-3 ${isAnimating ? 'animate-bounce' : ''}`}>
      {/* Sprechblase */}
      <div className="relative bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl p-4 max-w-sm shadow-xl">
        <button
          onClick={() => setIsVisible(false)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center transition-colors shadow-md"
        >
          <X className="w-3 h-3 text-red-600" />
        </button>
        
        <div className="absolute -top-1 -left-1">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
        </div>
        
        {/* Sprechblasen-Pfeil */}
        <div className="absolute -right-3 bottom-6 w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[14px] border-l-amber-300" />
        <div className="absolute -right-[10px] bottom-6 w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[14px] border-l-amber-50" />
        
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
          
          {/* Quick Animations */}
          <div className="flex gap-1">
            <button onClick={() => playAnimation('wave')} className="text-base hover:scale-125 transition-transform" title="Winken">👋</button>
            <button onClick={() => playAnimation('party')} className="text-base hover:scale-125 transition-transform" title="Feiern">🎉</button>
            <button onClick={() => playAnimation('flex')} className="text-base hover:scale-125 transition-transform" title="Stark">💪</button>
            <button onClick={() => playAnimation('cool')} className="text-base hover:scale-125 transition-transform" title="Cool">😎</button>
          </div>
        </div>
        
        <div className="text-center mt-2">
          <span className="text-[10px] text-amber-400">Karl Klammer 📎</span>
        </div>
      </div>
      
      {/* CLIPPY SVG */}
      <div 
        className={`flex-shrink-0 cursor-pointer transition-all duration-300 ${getMoodClass()}`}
        onClick={newTipp}
        title="Klick für neuen Tipp!"
      >
        <div className="relative">
          <svg width="90" height="115" viewBox="0 0 90 115" className="drop-shadow-lg">
            <defs>
              <linearGradient id="clipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A3A3A3" />
                <stop offset="30%" stopColor="#E5E5E5" />
                <stop offset="70%" stopColor="#D4D4D4" />
                <stop offset="100%" stopColor="#9CA3AF" />
              </linearGradient>
              <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.5)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
            
            {/* Büroklammer Körper */}
            <path 
              d="M28 105 Q14 105 14 90 L14 30 Q14 12 32 12 L58 12 Q76 12 76 30 L76 78 Q76 92 60 92 L42 92 Q28 92 28 78 L28 42 Q28 32 38 32 L52 32 Q62 32 62 42 L62 62"
              fill="none"
              stroke="url(#clipGrad)"
              strokeWidth="11"
              strokeLinecap="round"
            />
            {/* Glanz */}
            <path 
              d="M28 105 Q14 105 14 90 L14 30 Q14 12 32 12 L58 12 Q76 12 76 30 L76 78 Q76 92 60 92 L42 92 Q28 92 28 78 L28 42 Q28 32 38 32 L52 32 Q62 32 62 42 L62 62"
              fill="none"
              stroke="url(#shine)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            
            {/* === GESICHT === */}
            
            {/* Augenbrauen */}
            {mood === 'angry' ? (
              <>
                <path d="M25 38 L38 42" stroke="#404040" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M52 42 L65 38" stroke="#404040" strokeWidth="2.5" strokeLinecap="round"/>
              </>
            ) : mood === 'sad' ? (
              <>
                <path d="M25 42 Q32 46 38 42" fill="none" stroke="#404040" strokeWidth="2" strokeLinecap="round"/>
                <path d="M52 42 Q58 46 65 42" fill="none" stroke="#404040" strokeWidth="2" strokeLinecap="round"/>
              </>
            ) : mood === 'thinking' || mood === 'alert' ? (
              <>
                <path d="M25 36 Q32 32 38 36" fill="none" stroke="#404040" strokeWidth="2.5" strokeLinecap="round">
                  <animate attributeName="d" values="M25 36 Q32 32 38 36;M25 33 Q32 28 38 33;M25 36 Q32 32 38 36" dur="0.8s" repeatCount="indefinite"/>
                </path>
                <path d="M52 36 Q58 32 65 36" fill="none" stroke="#404040" strokeWidth="2.5" strokeLinecap="round">
                  <animate attributeName="d" values="M52 36 Q58 32 65 36;M52 33 Q58 28 65 33;M52 36 Q58 32 65 36" dur="0.8s" repeatCount="indefinite"/>
                </path>
              </>
            ) : (
              <>
                <path d="M25 38 Q32 35 38 38" fill="none" stroke="#404040" strokeWidth="2" strokeLinecap="round"/>
                <path d="M52 38 Q58 35 65 38" fill="none" stroke="#404040" strokeWidth="2" strokeLinecap="round"/>
              </>
            )}
            
            {/* Augen */}
            <g style={{ transform: isBlinking ? 'scaleY(0.1)' : 'scaleY(1)', transformOrigin: '45px 50px', transition: 'transform 0.1s' }}>
              {/* Linkes Auge */}
              <ellipse cx="32" cy="50" rx="10" ry="12" fill="white" stroke="#374151" strokeWidth="1.5"/>
              <ellipse cx={33 + eyePosition.x} cy={51 + eyePosition.y} rx="5" ry="6" fill="#374151"/>
              <ellipse cx={34 + eyePosition.x} cy={49 + eyePosition.y} rx="2" ry="2.5" fill="white"/>
              
              {/* Rechtes Auge */}
              <ellipse cx="58" cy="50" rx="10" ry="12" fill="white" stroke="#374151" strokeWidth="1.5"/>
              <ellipse cx={59 + eyePosition.x} cy={51 + eyePosition.y} rx="5" ry="6" fill="#374151"/>
              <ellipse cx={60 + eyePosition.x} cy={49 + eyePosition.y} rx="2" ry="2.5" fill="white"/>
            </g>
            
            {/* Sonnenbrille bei Cool */}
            {mood === 'cool' && (
              <>
                <rect x="20" y="44" width="24" height="16" rx="3" fill="#1F2937"/>
                <rect x="46" y="44" width="24" height="16" rx="3" fill="#1F2937"/>
                <path d="M44 52 L46 52" stroke="#1F2937" strokeWidth="3"/>
                <path d="M20 48 L12 44" stroke="#1F2937" strokeWidth="2"/>
                <path d="M70 48 L78 44" stroke="#1F2937" strokeWidth="2"/>
              </>
            )}
            
            {/* Mund */}
            {mood === 'happy' || mood === 'laugh' || mood === 'party' || mood === 'excited' || mood === 'money' ? (
              // Großes Lächeln
              <path d="M32 68 Q45 82 58 68" fill="none" stroke="#404040" strokeWidth="2.5" strokeLinecap="round"/>
            ) : mood === 'sad' ? (
              // Trauriger Mund
              <path d="M35 72 Q45 64 55 72" fill="none" stroke="#404040" strokeWidth="2.5" strokeLinecap="round"/>
            ) : mood === 'angry' ? (
              // Verärgerter Mund
              <path d="M35 70 L55 70" stroke="#404040" strokeWidth="3" strokeLinecap="round"/>
            ) : mood === 'thinking' ? (
              // Denkender Mund (klein, seitlich)
              <ellipse cx="55" cy="68" rx="4" ry="3" fill="#404040"/>
            ) : mood === 'cool' ? (
              // Cooler Mund
              <path d="M38 68 Q45 72 52 68" fill="none" stroke="#404040" strokeWidth="2" strokeLinecap="round"/>
            ) : mood === 'shrug' ? (
              // Schulterzucken Mund
              <path d="M35 70 Q45 68 55 70" fill="none" stroke="#404040" strokeWidth="2" strokeLinecap="round"/>
            ) : (
              // Normaler Mund
              <path d="M38 66 Q45 72 52 66" fill="none" stroke="#404040" strokeWidth="2" strokeLinecap="round"/>
            )}
            
            {/* Wangen bei Happy */}
            {(mood === 'happy' || mood === 'party' || mood === 'excited') && (
              <>
                <ellipse cx="20" cy="58" rx="5" ry="3" fill="#FECACA" opacity="0.7"/>
                <ellipse cx="70" cy="58" rx="5" ry="3" fill="#FECACA" opacity="0.7"/>
              </>
            )}
            
            {/* Träne bei Sad */}
            {mood === 'sad' && (
              <ellipse cx="24" cy="62" rx="3" ry="4" fill="#60A5FA">
                <animate attributeName="cy" values="62;72;62" dur="2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite"/>
              </ellipse>
            )}
            
            {/* Schweißtropfen bei Angry */}
            {mood === 'angry' && (
              <ellipse cx="72" cy="38" rx="3" ry="4" fill="#60A5FA"/>
            )}
            
            {/* Winkende Hand */}
            {mood === 'wave' && (
              <g>
                <ellipse cx="82" cy="55" rx="7" ry="9" fill="#D4D4D4" stroke="#A3A3A3" strokeWidth="2">
                  <animateTransform attributeName="transform" type="rotate" values="0 82 64;25 82 64;0 82 64;-25 82 64;0 82 64" dur="0.5s" repeatCount="indefinite"/>
                </ellipse>
              </g>
            )}
            
            {/* Muskel bei Flex */}
            {mood === 'flex' && (
              <g>
                <ellipse cx="84" cy="48" rx="9" ry="7" fill="#D4D4D4" stroke="#A3A3A3" strokeWidth="2"/>
                <ellipse cx="86" cy="45" rx="5" ry="4" fill="#E5E5E5"/>
              </g>
            )}
            
            {/* Geldsack bei Money */}
            {mood === 'money' && (
              <g>
                <circle cx="82" cy="52" r="10" fill="#FCD34D" stroke="#F59E0B" strokeWidth="2"/>
                <text x="82" y="57" textAnchor="middle" fontSize="12" fill="#92400E" fontWeight="bold">$</text>
              </g>
            )}
            
            {/* Kaffeetasse */}
            {mood === 'coffee' && (
              <g>
                <rect x="75" y="50" width="12" height="14" rx="2" fill="#8B5CF6" stroke="#7C3AED" strokeWidth="1"/>
                <path d="M87 54 Q92 54 92 58 Q92 62 87 62" fill="none" stroke="#7C3AED" strokeWidth="2"/>
                <path d="M77 48 Q79 44 81 48 Q83 44 85 48" fill="none" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.6">
                  <animate attributeName="d" values="M77 48 Q79 44 81 48 Q83 44 85 48;M77 46 Q79 42 81 46 Q83 42 85 46;M77 48 Q79 44 81 48 Q83 44 85 48" dur="1s" repeatCount="indefinite"/>
                </path>
              </g>
            )}
          </svg>
          
          {/* Effekte */}
          {(mood === 'party' || mood === 'excited' || mood === 'money') && (
            <>
              <Sparkles className="absolute -top-3 -left-1 w-5 h-5 text-yellow-400 animate-ping" />
              <Sparkles className="absolute -top-1 right-2 w-4 h-4 text-amber-400 animate-ping" style={{ animationDelay: '0.2s' }} />
              <Sparkles className="absolute top-2 left-6 w-3 h-3 text-orange-400 animate-ping" style={{ animationDelay: '0.4s' }} />
            </>
          )}
          
          {/* Denkblasen */}
          {mood === 'thinking' && (
            <div className="absolute -top-8 right-2 flex gap-1">
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"/>
              <div className="w-3 h-3 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}/>
              <div className="w-4 h-4 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}/>
            </div>
          )}
          
          {/* Alert Ausrufezeichen */}
          {mood === 'alert' && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
              ❗
            </div>
          )}
          
          {/* Stretch Animation */}
          {mood === 'stretch' && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-xl">
              💫
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
