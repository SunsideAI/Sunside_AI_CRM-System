import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Sparkles, Trophy, Star } from 'lucide-react'

// ==========================================
// SPRÜCHE - Normal, Memes & Zeitbasiert
// ==========================================

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
  { text: "Damals war ich auch Cold Caller... dann habe ich einen Pfeil ins Knie bekommen.", emoji: "🏹", mood: "sad" },
  
  // MEME SPRÜCHE 🎭
  { text: "This is fine. 🔥 *Während 50 Leads auf Wiedervorlage warten*", emoji: "🐕", mood: "cool" },
  { text: "One does not simply close a deal on the first call.", emoji: "🧙", mood: "thinking" },
  { text: "It's over Anakin! I have the higher conversion rate!", emoji: "⚔️", mood: "flex" },
  { text: "Perfectly balanced, as all quotas should be.", emoji: "💜", mood: "thinking" },
  { text: "I am inevitable. - Dein nächster Abschluss", emoji: "🧤", mood: "flex" },
  { text: "You shall not pass! ...ohne Termin zu vereinbaren.", emoji: "🧙", mood: "alert" },
  { text: "It's a trap! ...sagte niemand über dein Angebot.", emoji: "🦑", mood: "shrug" },
  { text: "Hello there! General Vertriebler!", emoji: "👋", mood: "wave" },
  { text: "I've got a bad feeling about this... Ach quatsch, der Deal klappt!", emoji: "🚀", mood: "happy" },
  { text: "May the Conversion be with you.", emoji: "✨", mood: "happy" },
  { text: "In einer Galaxis weit, weit entfernt... machte jemand Cold Calls.", emoji: "🌟", mood: "thinking" },
  { text: "Why so serious? Lächeln beim Telefonieren!", emoji: "🃏", mood: "laugh" },
  { text: "They see me callin', they hatin'...", emoji: "😎", mood: "cool" },
  { text: "First rule of Sales Club: Immer nach dem Abschluss fragen!", emoji: "🥊", mood: "flex" },
  { text: "Winter is coming... und damit die Jahresend-Deals!", emoji: "❄️", mood: "alert" },
  { text: "I'm not superstitious, but I am a little stitious about my lucky headset.", emoji: "🎧", mood: "shrug" },
  { text: "That's what she said... der Closer nach dem Deal.", emoji: "😏", mood: "laugh" },
  { text: "LEEEROY JENKINS! *wählt Nummer ohne Vorbereitung*", emoji: "🐔", mood: "excited" },
  { text: "Keep calm and close deals.", emoji: "👑", mood: "cool" },
  { text: "You miss 100% of the calls you don't make. - Wayne Gretzky - Michael Scott", emoji: "🏒", mood: "thinking" },
  
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

// Zeitbasierte Sprüche
const ZEIT_TIPPS = {
  morgen: [
    { text: "Guten Morgen! ☀️ Bereit für den ersten Call des Tages?", emoji: "🌅", mood: "happy" },
    { text: "Früher Vogel fängt den Wurm - und den Deal!", emoji: "🐦", mood: "excited" },
    { text: "Kaffee geholt? Dann kann's ja losgehen!", emoji: "☕", mood: "coffee" },
    { text: "Die Morgenstund' hat Gold im Mund - ruf jemanden an!", emoji: "💰", mood: "money" },
  ],
  mittag: [
    { text: "Mittagspause? Nicht vergessen zu essen!", emoji: "🍕", mood: "helpful" },
    { text: "Halbzeit! Wie viele Calls hast du schon gemacht?", emoji: "⏰", mood: "thinking" },
    { text: "Nach dem Essen sollst du ruhn... ODER DEALS CLOSEN!", emoji: "💪", mood: "flex" },
  ],
  nachmittag: [
    { text: "Nachmittagstief? Steh auf, streck dich, und dann weiter!", emoji: "🧘", mood: "stretch" },
    { text: "14-16 Uhr ist prime time für Calls!", emoji: "📞", mood: "alert" },
    { text: "Der Nachmittag gehört den Gewinnern - dir!", emoji: "🏆", mood: "flex" },
  ],
  abend: [
    { text: "Feierabend in Sicht! Noch einen Deal zum Abschluss?", emoji: "🌅", mood: "thinking" },
    { text: "Die letzten Calls des Tages - mach sie zählen!", emoji: "💫", mood: "excited" },
    { text: "Gleich geschafft! Du hast heute super gearbeitet!", emoji: "🎉", mood: "party" },
  ],
  montag: [
    { text: "Montag... ich fühl mit dir. ☕ Aber hey, neue Woche, neue Deals!", emoji: "📅", mood: "coffee" },
    { text: "Montage sind wie Leads - am Anfang schwer, am Ende lohnend!", emoji: "💪", mood: "flex" },
  ],
  freitag: [
    { text: "FREITAG! 🎉 Noch ein Deal vor dem Wochenende?", emoji: "🍻", mood: "party" },
    { text: "Fast Wochenende! Letzte Chance für diese Woche!", emoji: "⏰", mood: "alert" },
    { text: "Friday feeling! Aber erst noch den einen Abschluss...", emoji: "😎", mood: "cool" },
  ],
}

// Easter Egg Sprüche
const EASTER_EGG_SPRUECHE = {
  konami: { text: "⬆️⬆️⬇️⬇️⬅️➡️⬅️➡️🅱️🅰️ CHEAT AKTIVIERT! Unendlich Motivation!", emoji: "🎮", mood: "party" },
  angry: { text: "HÖR AUF MICH ZU KLICKEN! 😤 Ich bin auch nur eine Büroklammer mit Gefühlen!", emoji: "😤", mood: "angry" },
  secret: { text: "Du hast das Geheimnis entdeckt! 🥚 Hier ist ein virtueller Cookie: 🍪", emoji: "🥚", mood: "excited" },
}

// Achievement Nachrichten
const ACHIEVEMENTS = {
  clicks50: { text: "🏆 Achievement: Clippy 50x weggeklickt! Er ist traurig aber stolz auf dich.", emoji: "😢", mood: "sad" },
  clicks100: { text: "🏆 Achievement: Clippy 100x ignoriert! Du bist offiziell herzlos. 💔", emoji: "💔", mood: "sad" },
  tipps25: { text: "🏆 Achievement: 25 Tipps gelesen! Du bist ein Motivations-Lehrling!", emoji: "📚", mood: "happy" },
  tipps50: { text: "🏆 Achievement: 50 Tipps gelesen! Motivations-Meister! 🎓", emoji: "🎓", mood: "party" },
  tipps100: { text: "🏆 Achievement: 100 Tipps gelesen! Du bist der GOAT! 🐐", emoji: "🐐", mood: "flex" },
}

// Clippy erscheint alle X Minuten
const ERSCHEINUNGS_INTERVALL = 5 * 60 * 1000

export default function Clippy() {
  const [isVisible, setIsVisible] = useState(false)
  const [isDisabledForSession, setIsDisabledForSession] = useState(false)
  const [currentTipp, setCurrentTipp] = useState(TIPPS[0])
  const [isAnimating, setIsAnimating] = useState(false)
  const [mood, setMood] = useState('idle')
  const [isTyping, setIsTyping] = useState(false)
  const [displayedText, setDisplayedText] = useState('')
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 })
  const [isBlinking, setIsBlinking] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [clickCount, setClickCount] = useState(0)
  const [tippsRead, setTippsRead] = useState(0)
  const [showAchievement, setShowAchievement] = useState(null)
  const [konamiIndex, setKonamiIndex] = useState(0)
  const [costume, setCostume] = useState('normal')
  
  const containerRef = useRef(null)
  const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA']

  // SESSION STORAGE
  useEffect(() => {
    const disabled = sessionStorage.getItem('clippy-disabled')
    if (disabled === 'true') setIsDisabledForSession(true)
    
    const clicks = parseInt(localStorage.getItem('clippy-clicks') || '0')
    const tipps = parseInt(localStorage.getItem('clippy-tipps') || '0')
    setClickCount(clicks)
    setTippsRead(tipps)
  }, [])

  const disableForSession = () => {
    sessionStorage.setItem('clippy-disabled', 'true')
    setIsDisabledForSession(true)
    setIsVisible(false)
  }

  // KONAMI CODE EASTER EGG
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === konamiCode[konamiIndex]) {
        const newIndex = konamiIndex + 1
        setKonamiIndex(newIndex)
        
        if (newIndex === konamiCode.length) {
          setCurrentTipp(EASTER_EGG_SPRUECHE.konami)
          setMood('party')
          setIsVisible(true)
          setKonamiIndex(0)
        }
      } else {
        setKonamiIndex(0)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [konamiIndex])

  // 10 OUTFITS - WECHSELT TÄGLICH
  useEffect(() => {
    const now = new Date()
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24))
    const outfitIndex = dayOfYear % 10
    
    const outfits = [
      'normal',      // 0: Kein Outfit
      'christmas',   // 1: Weihnachtsmütze 🎅
      'cowboy',      // 2: Cowboy Hut 🤠
      'crown',       // 3: Krone 👑
      'pirate',      // 4: Pirat 🏴‍☠️
      'wizard',      // 5: Zauberer 🧙
      'headphones',  // 6: Kopfhörer 🎧
      'chef',        // 7: Kochmütze 👨‍🍳
      'detective',   // 8: Detektiv 🕵️
      'party',       // 9: Party Hut 🎉
    ]
    
    setCostume(outfits[outfitIndex])
  }, [])

  // MAUS-TRACKING FÜR AUGEN
  useEffect(() => {
    if (!isVisible) return
    
    const handleMouseMove = (e) => {
      if (!containerRef.current) return
      
      const rect = containerRef.current.getBoundingClientRect()
      const clipX = rect.left + rect.width / 2
      const clipY = rect.top + rect.height / 2
      
      const deltaX = e.clientX - clipX
      const deltaY = e.clientY - clipY
      
      const maxMove = 3
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      const normalizedX = distance > 0 ? (deltaX / distance) * Math.min(distance / 50, 1) * maxMove : 0
      const normalizedY = distance > 0 ? (deltaY / distance) * Math.min(distance / 50, 1) * maxMove : 0
      
      setEyePosition({ x: normalizedX, y: normalizedY })
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [isVisible])

  // BLINZELN
  useEffect(() => {
    if (!isVisible) return
    
    const blinkInterval = setInterval(() => {
      setIsBlinking(true)
      setTimeout(() => setIsBlinking(false), 150)
    }, 3000 + Math.random() * 2000)
    
    return () => clearInterval(blinkInterval)
  }, [isVisible])

  // DRAGGING
  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return
    setIsDragging(true)
    const rect = containerRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  useEffect(() => {
    if (!isDragging) return
    
    const handleMouseMove = (e) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }
    
    const handleMouseUp = () => setIsDragging(false)
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  // TYPEWRITER EFFEKT
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

  // TIPP AUSWAHL (mit Zeitlogik)
  const getRandomTipp = useCallback(() => {
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay()
    
    if (Math.random() < 0.3) {
      let zeitTipps = []
      
      if (day === 1) zeitTipps = [...zeitTipps, ...ZEIT_TIPPS.montag]
      if (day === 5) zeitTipps = [...zeitTipps, ...ZEIT_TIPPS.freitag]
      
      if (hour >= 6 && hour < 10) zeitTipps = [...zeitTipps, ...ZEIT_TIPPS.morgen]
      else if (hour >= 11 && hour < 14) zeitTipps = [...zeitTipps, ...ZEIT_TIPPS.mittag]
      else if (hour >= 14 && hour < 17) zeitTipps = [...zeitTipps, ...ZEIT_TIPPS.nachmittag]
      else if (hour >= 17 && hour < 20) zeitTipps = [...zeitTipps, ...ZEIT_TIPPS.abend]
      
      if (zeitTipps.length > 0) {
        return zeitTipps[Math.floor(Math.random() * zeitTipps.length)]
      }
    }
    
    return TIPPS[Math.floor(Math.random() * TIPPS.length)]
  }, [])

  // ACHIEVEMENTS
  const checkAchievements = useCallback((newClicks, newTipps) => {
    if (newClicks === 50) {
      setShowAchievement(ACHIEVEMENTS.clicks50)
      setTimeout(() => setShowAchievement(null), 5000)
    } else if (newClicks === 100) {
      setShowAchievement(ACHIEVEMENTS.clicks100)
      setTimeout(() => setShowAchievement(null), 5000)
    }
    
    if (newTipps === 25) {
      setShowAchievement(ACHIEVEMENTS.tipps25)
      setTimeout(() => setShowAchievement(null), 5000)
    } else if (newTipps === 50) {
      setShowAchievement(ACHIEVEMENTS.tipps50)
      setTimeout(() => setShowAchievement(null), 5000)
    } else if (newTipps === 100) {
      setShowAchievement(ACHIEVEMENTS.tipps100)
      setTimeout(() => setShowAchievement(null), 5000)
    }
  }, [])

  // CLIPPY ANZEIGEN
  const showClippy = useCallback(() => {
    if (isDisabledForSession) return
    
    const newTipp = getRandomTipp()
    setCurrentTipp(newTipp)
    setMood(newTipp.mood || 'idle')
    setIsAnimating(true)
    setIsVisible(true)
    
    const newTippsCount = tippsRead + 1
    setTippsRead(newTippsCount)
    localStorage.setItem('clippy-tipps', newTippsCount.toString())
    checkAchievements(clickCount, newTippsCount)
    
    setTimeout(() => {
      setIsAnimating(false)
      setTimeout(() => setMood('idle'), 2000)
    }, 1500)
  }, [isDisabledForSession, getRandomTipp, tippsRead, clickCount, checkAchievements])

  // KLICK HANDLER (Easter Egg bei 10x schnell klicken)
  const rapidClicksRef = useRef([])
  
  const handleClippyClick = () => {
    const now = Date.now()
    rapidClicksRef.current.push(now)
    rapidClicksRef.current = rapidClicksRef.current.filter(t => now - t < 3000)
    
    if (rapidClicksRef.current.length >= 10) {
      setCurrentTipp(EASTER_EGG_SPRUECHE.angry)
      setMood('angry')
      rapidClicksRef.current = []
      return
    }
    
    newTipp()
  }

  const newTipp = () => {
    setMood('thinking')
    setTimeout(() => {
      const tipp = getRandomTipp()
      setCurrentTipp(tipp)
      setMood(tipp.mood || 'idle')
      
      const newTippsCount = tippsRead + 1
      setTippsRead(newTippsCount)
      localStorage.setItem('clippy-tipps', newTippsCount.toString())
      checkAchievements(clickCount, newTippsCount)
      
      setTimeout(() => setMood('idle'), 2000)
    }, 500)
  }

  const playAnimation = (animMood) => {
    setMood(animMood)
    setTimeout(() => setMood('idle'), 2000)
  }

  const handleClose = () => {
    const newClicks = clickCount + 1
    setClickCount(newClicks)
    localStorage.setItem('clippy-clicks', newClicks.toString())
    checkAchievements(newClicks, tippsRead)
    setIsVisible(false)
  }

  // AUTO-ERSCHEINEN
  useEffect(() => {
    if (isDisabledForSession) return
    
    const initialTimeout = setTimeout(() => showClippy(), 30000)
    const interval = setInterval(() => {
      if (Math.random() > 0.5 && !isVisible && !isDisabledForSession) showClippy()
    }, ERSCHEINUNGS_INTERVALL)
    
    return () => { clearTimeout(initialTimeout); clearInterval(interval) }
  }, [isVisible, isDisabledForSession, showClippy])

  // MOOD ANIMATION KLASSE
  const getMoodClass = () => {
    switch(mood) {
      case 'wave': return 'animate-wiggle'
      case 'happy': case 'laugh': case 'party': case 'excited': case 'money': return 'animate-bounce'
      case 'flex': case 'proud': return 'scale-110'
      case 'sad': return 'opacity-80'
      case 'angry': return 'animate-shake'
      case 'shrug': return 'animate-wiggle'
      case 'stretch': case 'coffee': case 'alert': return 'animate-pulse'
      default: return ''
    }
  }

  if (!isVisible || isDisabledForSession) return null

  const containerStyle = position.x || position.y 
    ? { position: 'fixed', left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
    : {}

  return (
    <>
      {/* Achievement Popup */}
      {showAchievement && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] animate-bounce">
          <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3">
            <Trophy className="w-6 h-6" />
            <span className="font-bold">{showAchievement.text}</span>
          </div>
        </div>
      )}
      
      <div 
        ref={containerRef}
        className={`fixed bottom-6 right-6 z-50 flex items-end gap-3 ${isAnimating ? 'animate-bounce' : ''} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={containerStyle}
        onMouseDown={handleMouseDown}
      >
        {/* Sprechblase */}
        <div className="relative bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl p-4 w-80 shadow-xl select-none">
          <div className="absolute -top-2 -right-2 flex gap-1">
            <button onClick={disableForSession} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors shadow-md" title="Für diese Session ausblenden">
              <span className="text-xs">🔕</span>
            </button>
            <button onClick={handleClose} className="w-6 h-6 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center transition-colors shadow-md" title="Schließen">
              <X className="w-3 h-3 text-red-600" />
            </button>
          </div>
          
          <div className="absolute -top-1 -left-1">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          
          <div className="absolute -right-3 bottom-6 w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[14px] border-l-amber-300" />
          <div className="absolute -right-[10px] bottom-6 w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[14px] border-l-amber-50" />
          
          <p className="text-sm text-gray-700 leading-relaxed pr-4 min-h-[5rem]">
            {displayedText}
            {isTyping && <span className="animate-pulse">|</span>}
          </p>
          
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-amber-200">
            <button onClick={newTipp} disabled={isTyping} className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1 disabled:opacity-50">
              <Sparkles className="w-3 h-3" /> Neuer Tipp
            </button>
            <div className="flex gap-1">
              <button onClick={() => playAnimation('wave')} className="text-base hover:scale-125 transition-transform" title="Winken">👋</button>
              <button onClick={() => playAnimation('party')} className="text-base hover:scale-125 transition-transform" title="Feiern">🎉</button>
              <button onClick={() => playAnimation('flex')} className="text-base hover:scale-125 transition-transform" title="Stark">💪</button>
              <button onClick={() => playAnimation('cool')} className="text-base hover:scale-125 transition-transform" title="Cool">😎</button>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2 text-[10px] text-amber-400">
            <span>Klaus Klammer 📎</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {tippsRead} Tipps</span>
          </div>
        </div>
        
        {/* CLIPPY SVG */}
        <div className={`flex-shrink-0 cursor-pointer transition-all duration-300 ${getMoodClass()}`} onClick={handleClippyClick} title="Klick für neuen Tipp!">
          <div className="relative overflow-visible">
            <svg width="100" height="115" viewBox="0 0 105 115" className="drop-shadow-lg overflow-visible">
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
              <path d="M28 105 Q14 105 14 90 L14 30 Q14 12 32 12 L58 12 Q76 12 76 30 L76 78 Q76 92 60 92 L42 92 Q28 92 28 78 L28 42 Q28 32 38 32 L52 32 Q62 32 62 42 L62 62" fill="none" stroke="url(#clipGrad)" strokeWidth="11" strokeLinecap="round"/>
              <path d="M28 105 Q14 105 14 90 L14 30 Q14 12 32 12 L58 12 Q76 12 76 30 L76 78 Q76 92 60 92 L42 92 Q28 92 28 78 L28 42 Q28 32 38 32 L52 32 Q62 32 62 42 L62 62" fill="none" stroke="url(#shine)" strokeWidth="4" strokeLinecap="round"/>
              
              {/* KOSTÜME */}
              {costume === 'christmas' && (
                <>
                  {/* Weihnachtsmütze */}
                  <ellipse cx="45" cy="8" rx="25" ry="8" fill="#DC2626"/>
                  <path d="M25 8 Q45 -15 65 8" fill="#DC2626"/>
                  <ellipse cx="70" cy="-5" rx="6" ry="6" fill="white"/>
                  <rect x="20" y="5" width="50" height="6" fill="white" rx="3"/>
                </>
              )}
              {costume === 'cowboy' && (
                <>
                  {/* Cowboy Hut */}
                  <ellipse cx="45" cy="10" rx="35" ry="6" fill="#92400E"/>
                  <path d="M20 10 Q25 -5 45 -8 Q65 -5 70 10" fill="#B45309"/>
                  <rect x="35" y="-2" width="20" height="4" fill="#FCD34D" rx="1"/>
                </>
              )}
              {costume === 'crown' && (
                <>
                  {/* Krone */}
                  <path d="M22 12 L22 -2 L30 6 L38 -5 L45 8 L52 -5 L60 6 L68 -2 L68 12 Z" fill="#FCD34D" stroke="#F59E0B" strokeWidth="1"/>
                  <circle cx="30" cy="2" r="3" fill="#DC2626"/>
                  <circle cx="45" cy="-2" r="3" fill="#3B82F6"/>
                  <circle cx="60" cy="2" r="3" fill="#10B981"/>
                </>
              )}
              {costume === 'pirate' && (
                <>
                  {/* Piraten Bandana + Augenklappe */}
                  <ellipse cx="45" cy="8" rx="28" ry="10" fill="#1F2937"/>
                  <path d="M17 8 Q45 -8 73 8" fill="#DC2626"/>
                  <circle cx="75" cy="12" r="4" fill="white"/>
                  {/* Augenklappe wird später über Auge gelegt */}
                </>
              )}
              {costume === 'wizard' && (
                <>
                  {/* Zauberer Hut */}
                  <path d="M25 12 L45 -20 L65 12 Z" fill="#4C1D95"/>
                  <ellipse cx="45" cy="12" rx="22" ry="6" fill="#5B21B6"/>
                  <circle cx="45" cy="-8" r="4" fill="#FCD34D"/>
                  <circle cx="38" cy="0" r="2" fill="#FCD34D" opacity="0.7"/>
                  <circle cx="52" cy="-2" r="2" fill="#FCD34D" opacity="0.7"/>
                </>
              )}
              {costume === 'headphones' && (
                <>
                  {/* Kopfhörer */}
                  <path d="M15 45 Q15 15 45 12 Q75 15 75 45" fill="none" stroke="#1F2937" strokeWidth="4"/>
                  <ellipse cx="15" cy="48" rx="6" ry="10" fill="#1F2937"/>
                  <ellipse cx="15" cy="48" rx="4" ry="8" fill="#374151"/>
                  <ellipse cx="75" cy="48" rx="6" ry="10" fill="#1F2937"/>
                  <ellipse cx="75" cy="48" rx="4" ry="8" fill="#374151"/>
                </>
              )}
              {costume === 'chef' && (
                <>
                  {/* Kochmütze */}
                  <ellipse cx="45" cy="10" rx="22" ry="8" fill="white" stroke="#E5E7EB" strokeWidth="1"/>
                  <ellipse cx="35" cy="0" rx="12" ry="12" fill="white"/>
                  <ellipse cx="55" cy="0" rx="12" ry="12" fill="white"/>
                  <ellipse cx="45" cy="-5" rx="10" ry="10" fill="white"/>
                </>
              )}
              {costume === 'detective' && (
                <>
                  {/* Detektiv Hut */}
                  <ellipse cx="45" cy="10" rx="30" ry="6" fill="#78716C"/>
                  <path d="M20 10 Q30 -5 45 -5 Q60 -5 70 10" fill="#57534E"/>
                  <rect x="40" y="-2" width="10" height="8" fill="#1F2937" rx="1"/>
                </>
              )}
              {costume === 'party' && (
                <>
                  {/* Party Hut */}
                  <path d="M30 12 L45 -15 L60 12 Z" fill="#EC4899"/>
                  <circle cx="45" cy="-15" r="5" fill="#FCD34D"/>
                  <ellipse cx="45" cy="12" rx="18" ry="4" fill="#8B5CF6"/>
                  <path d="M35 0 L33 -5 M45 -5 L45 -10 M55 0 L57 -5" stroke="#FCD34D" strokeWidth="1.5"/>
                </>
              )}
              
              {/* Augenbrauen */}
              {mood === 'angry' ? (
                <><path d="M25 38 L38 42" stroke="#404040" strokeWidth="2.5" strokeLinecap="round"/><path d="M52 42 L65 38" stroke="#404040" strokeWidth="2.5" strokeLinecap="round"/></>
              ) : mood === 'sad' ? (
                <><path d="M25 42 Q32 46 38 42" fill="none" stroke="#404040" strokeWidth="2" strokeLinecap="round"/><path d="M52 42 Q58 46 65 42" fill="none" stroke="#404040" strokeWidth="2" strokeLinecap="round"/></>
              ) : mood === 'thinking' || mood === 'alert' ? (
                <><path d="M25 36 Q32 32 38 36" fill="none" stroke="#404040" strokeWidth="2.5" strokeLinecap="round"><animate attributeName="d" values="M25 36 Q32 32 38 36;M25 33 Q32 28 38 33;M25 36 Q32 32 38 36" dur="0.8s" repeatCount="indefinite"/></path><path d="M52 36 Q58 32 65 36" fill="none" stroke="#404040" strokeWidth="2.5" strokeLinecap="round"><animate attributeName="d" values="M52 36 Q58 32 65 36;M52 33 Q58 28 65 33;M52 36 Q58 32 65 36" dur="0.8s" repeatCount="indefinite"/></path></>
              ) : (
                <><path d="M25 38 Q32 35 38 38" fill="none" stroke="#404040" strokeWidth="2" strokeLinecap="round"/><path d="M52 38 Q58 35 65 38" fill="none" stroke="#404040" strokeWidth="2" strokeLinecap="round"/></>
              )}
              
              {/* Augen */}
              <g style={{ transform: isBlinking ? 'scaleY(0.1)' : 'scaleY(1)', transformOrigin: '45px 50px', transition: 'transform 0.1s' }}>
                <ellipse cx="32" cy="50" rx="10" ry="12" fill="white" stroke="#374151" strokeWidth="1.5"/>
                <ellipse cx={33 + eyePosition.x} cy={51 + eyePosition.y} rx="5" ry="6" fill="#374151"/>
                <ellipse cx={34 + eyePosition.x} cy={49 + eyePosition.y} rx="2" ry="2.5" fill="white"/>
                <ellipse cx="58" cy="50" rx="10" ry="12" fill="white" stroke="#374151" strokeWidth="1.5"/>
                <ellipse cx={59 + eyePosition.x} cy={51 + eyePosition.y} rx="5" ry="6" fill="#374151"/>
                <ellipse cx={60 + eyePosition.x} cy={49 + eyePosition.y} rx="2" ry="2.5" fill="white"/>
              </g>
              
              {/* Piraten Augenklappe über rechtem Auge */}
              {costume === 'pirate' && (
                <>
                  <ellipse cx="58" cy="50" rx="12" ry="14" fill="#1F2937"/>
                  <path d="M70 50 L85 35" stroke="#1F2937" strokeWidth="2"/>
                </>
              )}
              
              {/* Sonnenbrille */}
              {mood === 'cool' && (
                <><rect x="20" y="44" width="24" height="16" rx="3" fill="#1F2937"/><rect x="46" y="44" width="24" height="16" rx="3" fill="#1F2937"/><path d="M44 52 L46 52" stroke="#1F2937" strokeWidth="3"/><path d="M20 48 L12 44" stroke="#1F2937" strokeWidth="2"/><path d="M70 48 L78 44" stroke="#1F2937" strokeWidth="2"/></>
              )}
              
              {/* Mund */}
              {mood === 'happy' || mood === 'laugh' || mood === 'party' || mood === 'excited' || mood === 'money' ? (
                <path d="M32 68 Q45 82 58 68" fill="none" stroke="#404040" strokeWidth="2.5" strokeLinecap="round"/>
              ) : mood === 'sad' ? (
                <path d="M35 72 Q45 64 55 72" fill="none" stroke="#404040" strokeWidth="2.5" strokeLinecap="round"/>
              ) : mood === 'angry' ? (
                <path d="M35 70 L55 70" stroke="#404040" strokeWidth="3" strokeLinecap="round"/>
              ) : mood === 'thinking' ? (
                <ellipse cx="55" cy="68" rx="4" ry="3" fill="#404040"/>
              ) : (
                <path d="M38 66 Q45 72 52 66" fill="none" stroke="#404040" strokeWidth="2" strokeLinecap="round"/>
              )}
              
              {/* Wangen */}
              {(mood === 'happy' || mood === 'party' || mood === 'excited') && (<><ellipse cx="20" cy="58" rx="5" ry="3" fill="#FECACA" opacity="0.7"/><ellipse cx="70" cy="58" rx="5" ry="3" fill="#FECACA" opacity="0.7"/></>)}
              
              {/* Träne */}
              {mood === 'sad' && (<ellipse cx="24" cy="62" rx="3" ry="4" fill="#60A5FA"><animate attributeName="cy" values="62;72;62" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite"/></ellipse>)}
              
              {/* Schweißtropfen */}
              {mood === 'angry' && (<ellipse cx="72" cy="38" rx="3" ry="4" fill="#60A5FA"/>)}
              
              {/* Winkende Hand */}
              {mood === 'wave' && (<ellipse cx="82" cy="55" rx="7" ry="9" fill="#D4D4D4" stroke="#A3A3A3" strokeWidth="2"><animateTransform attributeName="transform" type="rotate" values="0 82 64;25 82 64;0 82 64;-25 82 64;0 82 64" dur="0.5s" repeatCount="indefinite"/></ellipse>)}
              
              {/* Muskel */}
              {mood === 'flex' && (<><ellipse cx="84" cy="48" rx="9" ry="7" fill="#D4D4D4" stroke="#A3A3A3" strokeWidth="2"/><ellipse cx="86" cy="45" rx="5" ry="4" fill="#E5E5E5"/></>)}
              
              {/* Geldsack */}
              {mood === 'money' && (<><circle cx="82" cy="52" r="10" fill="#FCD34D" stroke="#F59E0B" strokeWidth="2"/><text x="82" y="57" textAnchor="middle" fontSize="12" fill="#92400E" fontWeight="bold">$</text></>)}
              
              {/* Kaffee */}
              {mood === 'coffee' && (<><rect x="75" y="50" width="12" height="14" rx="2" fill="#8B5CF6" stroke="#7C3AED" strokeWidth="1"/><path d="M87 54 Q92 54 92 58 Q92 62 87 62" fill="none" stroke="#7C3AED" strokeWidth="2"/><path d="M77 48 Q79 44 81 48 Q83 44 85 48" fill="none" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.6"><animate attributeName="d" values="M77 48 Q79 44 81 48 Q83 44 85 48;M77 46 Q79 42 81 46 Q83 42 85 46;M77 48 Q79 44 81 48 Q83 44 85 48" dur="1s" repeatCount="indefinite"/></path></>)}
            </svg>
            
            {/* Effekte */}
            {(mood === 'party' || mood === 'excited' || mood === 'money') && (<><Sparkles className="absolute -top-3 -left-1 w-5 h-5 text-yellow-400 animate-ping" /><Sparkles className="absolute -top-1 right-2 w-4 h-4 text-amber-400 animate-ping" style={{ animationDelay: '0.2s' }} /><Sparkles className="absolute top-2 left-6 w-3 h-3 text-orange-400 animate-ping" style={{ animationDelay: '0.4s' }} /></>)}
            {mood === 'thinking' && (<div className="absolute -top-8 right-2 flex gap-1"><div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"/><div className="w-3 h-3 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}/><div className="w-4 h-4 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}/></div>)}
            {mood === 'alert' && (<div className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-bounce">❗</div>)}
            {mood === 'stretch' && (<div className="absolute -top-4 left-1/2 -translate-x-1/2 text-xl">💫</div>)}
          </div>
        </div>
      </div>
    </>
  )
}
