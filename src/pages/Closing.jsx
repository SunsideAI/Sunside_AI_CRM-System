import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import EmailComposer from '../components/EmailComposer'
import TerminPicker from '../components/TerminPicker'
import { 
  Calendar, 
  Users,
  User as UserIcon,
  UserMinus,
  Target,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  Phone,
  Mail,
  Globe,
  MapPin,
  Building2,
  Edit3,
  Save,
  Filter,
  Send,
  FileText,
  Euro,
  Package,
  CheckCircle,
  AlertCircle,
  Paperclip,
  CalendarPlus,
  BarChart3,
  Upload,
  Download,
  Trash2,
  File
} from 'lucide-react'

// Produkt-Optionen für Angebot (entspricht Airtable-Produkten)
const PRODUKT_OPTIONS = [
  {
    value: 'KI-Chatbot',
    label: 'KI-Chatbot',
    setup: 1399,
    retainer: 360,
    description: '1.399 € Setup + 360 €/Monat'
  },
  {
    value: 'KI-Voicebot',
    label: 'KI-Voicebot',
    setup: 1399,
    retainer: 360,
    description: '1.399 € Setup + 360 €/Monat'
  },
  {
    value: 'SEO & KI-Chatbot',
    label: 'SEO & KI-Chatbot',
    setup: 2798,
    retainer: 360,
    description: '2.798 € Setup + 360 €/Monat'
  },
  {
    value: 'Website & KI-Chatbot',
    label: 'Website & KI-Chatbot',
    setup: 3998,
    retainer: 360,
    description: '3.998 € Setup + 360 €/Monat'
  },
  {
    value: 'KI-Voicebot & KI-Chatbot',
    label: 'KI-Voicebot & KI-Chatbot',
    setup: 2798,
    retainer: 612,
    description: '2.798 € Setup + 612 €/Monat'
  },
  {
    value: 'Website & KI-Voicebot & KI-Chatbot',
    label: 'Website & KI-Voicebot & KI-Chatbot',
    setup: 5397,
    retainer: 612,
    description: '5.397 € Setup + 612 €/Monat'
  },
  {
    value: 'SEO & KI-Voicebot & KI-Chatbot',
    label: 'SEO & KI-Voicebot & KI-Chatbot',
    setup: 4197,
    retainer: 612,
    description: '4.197 € Setup + 612 €/Monat'
  },
  {
    value: 'Individuell',
    label: 'Individuelles Angebot',
    setup: null,
    retainer: null,
    description: 'Setup & Retainer manuell eingeben'
  }
]

// Standard-Vertragsbestandteile
const DEFAULT_VERTRAGSBESTANDTEILE = `Alle Preise verstehen sich zzgl. der gesetzlichen Umsatzsteuer von derzeit 19%.
Mindestvertragslaufzeit: 12 Monate
Kündigungsfrist: 3 Monate zum Vertragsende
Zahlungsweise: Monatlich im Voraus`

// Status-Optionen für Dropdown
const STATUS_OPTIONS = [
  { value: 'Lead', label: 'Lead', color: 'badge-primary' },
  { value: 'Angebot', label: 'Angebot', color: 'badge-warning' },
  { value: 'Angebot versendet', label: 'Angebot versendet', color: 'badge-secondary' },
  { value: 'Abgeschlossen', label: 'Abgeschlossen', color: 'badge-success' },
  { value: 'Termin abgesagt', label: 'Termin abgesagt', color: 'bg-warning-container text-warning' },
  { value: 'Termin verschoben', label: 'Termin verschoben', color: 'bg-warning-container text-warning' },
  { value: 'Verloren', label: 'Verloren', color: 'badge-error' }
]

function Closing() {
  const { user, isAdmin } = useAuth()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedLead, setSelectedLead] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState('own') // 'own', 'all' (für Admins), oder 'pool'
  
  // Pool-State
  const [poolLeads, setPoolLeads] = useState([])
  const [loadingPool, setLoadingPool] = useState(false)
  const [claimingLead, setClaimingLead] = useState(null)
  const [toast, setToast] = useState(null) // { type: 'success'|'error', message: string }
  
  // Angebot-View State (innerhalb des Modals)
  const [showAngebotView, setShowAngebotView] = useState(false)
  const [angebotData, setAngebotData] = useState({
    produkt: '',
    setup: '',
    retainer: '',
    laufzeit: 12,  // Default 12 Monate
    vertragsbestandteile: DEFAULT_VERTRAGSBESTANDTEILE,
    paketname: '',           // Nur bei Individuell
    kurzbeschreibung: '',    // Nur bei Individuell
    leistungsbeschreibung: '' // Nur bei Individuell
  })
  const [sendingAngebot, setSendingAngebot] = useState(false)
  const [angebotSuccess, setAngebotSuccess] = useState(false) // Erfolgs-Ansicht im Modal
  
  // Email-Composer State (für Unterlagen versenden)
  const [showEmailComposer, setShowEmailComposer] = useState(false)
  
  // Neu-Terminieren State (innerhalb des Modals)
  const [showTerminPicker, setShowTerminPicker] = useState(false)
  
  // Freigabe an Pool State
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false)
  const [releaseReason, setReleaseReason] = useState('')
  const [releasing, setReleasing] = useState(false)
  
  // Website-Statistiken einklappbar (für Status != Lead)
  const [showWebsiteStats, setShowWebsiteStats] = useState(false)
  
  // Datei-Upload State
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  const LEADS_PER_PAGE = 10

  // Toast anzeigen (verschwindet nach 4 Sekunden)
  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  // Datei-Upload Handler
  const handleFileUpload = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0 || !selectedLead) return

    setUploading(true)
    setUploadError('')

    try {
      const file = files[0]
      
      // Nur PDFs und gängige Dokumente erlauben
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|png|jpg|jpeg|doc|docx)$/i)) {
        throw new Error('Nur PDF, PNG, JPG, DOC und DOCX Dateien erlaubt')
      }

      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Datei zu groß (max. 10 MB)')
      }

      // Zu Base64 konvertieren
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Upload zu Cloudinary
      const uploadResponse = await fetch('/.netlify/functions/upload-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64,
          filename: file.name
        })
      })

      const uploadData = await uploadResponse.json()

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || 'Upload fehlgeschlagen')
      }

      // Neue Attachment-Liste erstellen
      const newAttachment = {
        id: uploadData.file.id,
        url: uploadData.file.url,
        filename: uploadData.file.filename,
        size: uploadData.file.size,
        type: uploadData.file.type
      }

      const updatedAttachments = [...(selectedLead.attachments || []), newAttachment]

      // In Airtable speichern
      const saveResponse = await fetch('/.netlify/functions/hot-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotLeadId: selectedLead.id,
          updates: {
            attachments: updatedAttachments
          }
        })
      })

      if (!saveResponse.ok) {
        throw new Error('Speichern in Airtable fehlgeschlagen')
      }

      // Lokalen State aktualisieren
      setSelectedLead(prev => ({ ...prev, attachments: updatedAttachments }))
      setLeads(prev => prev.map(l => 
        l.id === selectedLead.id ? { ...l, attachments: updatedAttachments } : l
      ))

      showToast('success', `${file.name} wurde hochgeladen`)

    } catch (err) {
      console.error('Upload Error:', err)
      setUploadError(err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Datei löschen
  const handleDeleteAttachment = async (attachment) => {
    if (!selectedLead) return

    try {
      // Aus Cloudinary löschen (optional)
      if (attachment.id && attachment.url?.includes('cloudinary')) {
        await fetch(`/.netlify/functions/upload-file?public_id=${encodeURIComponent(attachment.id)}`, {
          method: 'DELETE'
        })
      }

      // Aus der Liste entfernen
      const updatedAttachments = (selectedLead.attachments || []).filter(att => att.url !== attachment.url)

      // In Airtable speichern
      await fetch('/.netlify/functions/hot-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotLeadId: selectedLead.id,
          updates: {
            attachments: updatedAttachments
          }
        })
      })

      // Lokalen State aktualisieren
      setSelectedLead(prev => ({ ...prev, attachments: updatedAttachments }))
      setLeads(prev => prev.map(l => 
        l.id === selectedLead.id ? { ...l, attachments: updatedAttachments } : l
      ))

      showToast('success', 'Datei gelöscht')

    } catch (err) {
      console.error('Delete Error:', err)
      showToast('error', 'Löschen fehlgeschlagen')
    }
  }

  // Dateigröße formatieren
  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Retainer aus Setup berechnen (Setup / 2.75, abgerundet auf gerade Beträge, max 10% nach unten)
  const calculateRetainer = (setup) => {
    if (!setup || isNaN(setup)) return ''
    const rawRetainer = setup / 2.75
    const evenRetainer = Math.floor(rawRetainer / 10) * 10 // Auf 10er abrunden
    const minRetainer = rawRetainer * 0.9 // Max 10% weniger
    // Wenn zu viel abgerundet, auf nächsten 10er aufrunden
    if (evenRetainer < minRetainer) {
      return Math.ceil(rawRetainer / 10) * 10
    }
    return evenRetainer
  }

  // Produkt-Auswahl Handler
  const handleProduktChange = (produktValue) => {
    const produkt = PRODUKT_OPTIONS.find(p => p.value === produktValue)
    if (produkt) {
      if (produkt.value === 'Individuell') {
        setAngebotData(prev => ({
          ...prev,
          produkt: produktValue,
          setup: '',
          retainer: '',
          paketname: '',
          kurzbeschreibung: '',
          leistungsbeschreibung: ''
        }))
      } else {
        setAngebotData(prev => ({
          ...prev,
          produkt: produktValue,
          setup: produkt.setup,
          retainer: produkt.retainer,
          paketname: '',
          kurzbeschreibung: '',
          leistungsbeschreibung: ''
        }))
      }
    }
  }

  // Setup ändern bei individuellem Preis
  const handleSetupChange = (value) => {
    const setup = parseFloat(value) || ''
    const retainer = setup ? calculateRetainer(setup) : ''
    setAngebotData(prev => ({
      ...prev,
      setup,
      retainer
    }))
  }

  // Angebot absenden
  const handleSendAngebot = async () => {
    if (!selectedLead || !angebotData.setup || !angebotData.retainer) return

    // Bei Individuell: Pflichtfelder prüfen
    if (angebotData.produkt === 'Individuell') {
      if (!angebotData.paketname || !angebotData.kurzbeschreibung || !angebotData.leistungsbeschreibung) {
        showToast('error', 'Bitte alle Pflichtfelder für individuelles Angebot ausfüllen')
        return
      }
    }

    try {
      setSendingAngebot(true)

      // Updates zusammenstellen
      const updates = {
        setup: parseFloat(angebotData.setup),
        retainer: parseFloat(angebotData.retainer),
        laufzeit: parseInt(angebotData.laufzeit) || 12,
        produktDienstleistung: angebotData.produkt ? [angebotData.produkt] : [],
        vertragsbestandteile: angebotData.vertragsbestandteile,
        status: 'Angebot'  // Zapier sendet dann das Angebot und setzt auf "Angebot versendet"
      }

      // Individuelle Felder nur bei Individuell-Produkt
      if (angebotData.produkt === 'Individuell') {
        updates.paketname = angebotData.paketname
        updates.kurzbeschreibung = angebotData.kurzbeschreibung
        updates.leistungsbeschreibung = angebotData.leistungsbeschreibung
      }

      // Hot Lead updaten
      const response = await fetch('/.netlify/functions/hot-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotLeadId: selectedLead.id,
          updates
        })
      })

      if (!response.ok) {
        throw new Error('Fehler beim Speichern')
      }

      // Kommentar im Original-Lead (Immobilienmakler_Leads) hinzufügen
      console.log('Original Lead ID:', selectedLead.originalLeadId)
      if (selectedLead.originalLeadId) {
        const produktInfo = angebotData.produkt || 'Individuell'
        const kommentarText = `Angebot versendet - ${produktInfo}: Setup ${angebotData.setup}€, Retainer ${angebotData.retainer}€/Mon, Laufzeit ${angebotData.laufzeit} Monate`
        const userName = user?.vor_nachname || user?.name || 'Closer'
        
        try {
          const kommentarResponse = await fetch('/.netlify/functions/leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId: selectedLead.originalLeadId,
              updates: {},  // Leeres Objekt, da wir nur historyEntry brauchen
              historyEntry: {
                action: 'angebot',
                details: kommentarText,
                userName: userName
              }
            })
          })
          console.log('Kommentar Response:', kommentarResponse.ok)
          if (!kommentarResponse.ok) {
            const errorData = await kommentarResponse.json()
            console.error('Kommentar-Update Error:', errorData)
          }
        } catch (kommentarErr) {
          console.warn('Kommentar-Update fehlgeschlagen:', kommentarErr)
          // Nicht abbrechen, Hot Lead wurde bereits aktualisiert
        }
      } else {
        console.warn('Kein originalLeadId vorhanden - Kommentar wird nicht aktualisiert')
      }
      
      // Lead in Liste aktualisieren
      setLeads(prev => prev.map(lead =>
        lead.id === selectedLead.id
          ? {
              ...lead,
              setup: parseFloat(angebotData.setup),
              retainer: parseFloat(angebotData.retainer),
              laufzeit: parseInt(angebotData.laufzeit) || 12,
              produktDienstleistung: angebotData.produkt ? [angebotData.produkt] : [],
              vertragsbestandteile: angebotData.vertragsbestandteile,
              status: 'Angebot'
            }
          : lead
      ))

      // Selected Lead auch aktualisieren
      setSelectedLead(prev => ({
        ...prev,
        setup: parseFloat(angebotData.setup),
        retainer: parseFloat(angebotData.retainer),
        laufzeit: parseInt(angebotData.laufzeit) || 12,
        produktDienstleistung: angebotData.produkt ? [angebotData.produkt] : [],
        vertragsbestandteile: angebotData.vertragsbestandteile,
        status: 'Angebot'
      }))
      
      // Erfolgs-Ansicht im Modal zeigen
      setAngebotSuccess(true)
      
      // Nach 1.5 Sekunden automatisch schließen
      setTimeout(() => {
        closeModal()
      }, 1500)
      
    } catch (err) {
      console.error('Fehler beim Senden des Angebots:', err)
      showToast('error', 'Fehler beim Senden des Angebots')
    } finally {
      setSendingAngebot(false)
    }
  }

  useEffect(() => {
    if (viewMode === 'pool') {
      loadPoolLeads()
    } else {
      loadLeads()
    }
  }, [user, viewMode])

  // Pool-Anzahl initial laden (für Badge)
  useEffect(() => {
    if (user) {
      loadPoolCount()
    }
  }, [user])

  // Nur die Anzahl der Pool-Leads laden (für Badge)
  const loadPoolCount = async () => {
    try {
      const response = await fetch('/.netlify/functions/hot-leads?pool=true')
      const data = await response.json()
      if (response.ok && data.hotLeads) {
        setPoolLeads(data.hotLeads)
      }
    } catch (err) {
      console.error('Pool-Count laden fehlgeschlagen:', err)
    }
  }

  const loadLeads = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)

      // Closer sehen nur eigene Leads
      // Admin: Je nach viewMode eigene oder alle
      const userName = user.vor_nachname || user.name
      let url = '/.netlify/functions/hot-leads'
      
      if (!isAdmin()) {
        // Closer: Immer nur eigene Leads (nach closerName filtern)
        url += `?closerName=${encodeURIComponent(userName)}`
      } else if (viewMode === 'own') {
        // Admin mit "Meine Leads": Nach closerName filtern
        url += `?closerName=${encodeURIComponent(userName)}`
      }
      // Admin mit "Alle Leads": Kein Filter, alle Hot Leads laden

      const response = await fetch(url)
      const data = await response.json()

      if (response.ok && data.hotLeads) {
        // Sortieren: Neueste Termine zuerst
        const sortedLeads = data.hotLeads.sort((a, b) => {
          const dateA = a.terminDatum ? new Date(a.terminDatum) : new Date(0)
          const dateB = b.terminDatum ? new Date(b.terminDatum) : new Date(0)
          return dateB - dateA
        })
        setLeads(sortedLeads)
      } else {
        setError(data.error || 'Fehler beim Laden')
        setLeads([])
      }
    } catch (err) {
      console.error('Leads laden fehlgeschlagen:', err)
      setError('Verbindungsfehler')
      setLeads([])
    } finally {
      setLoading(false)
    }
  }

  // Pool-Leads laden (Termine ohne Closer)
  const loadPoolLeads = async () => {
    if (!user) return
    
    try {
      setLoadingPool(true)
      setError(null)

      const response = await fetch('/.netlify/functions/hot-leads?pool=true')
      const data = await response.json()

      if (response.ok && data.hotLeads) {
        // Sortieren: Nächste Termine zuerst
        const sortedLeads = data.hotLeads.sort((a, b) => {
          const dateA = a.terminDatum ? new Date(a.terminDatum) : new Date(0)
          const dateB = b.terminDatum ? new Date(b.terminDatum) : new Date(0)
          return dateA - dateB // Aufsteigend - nächste Termine zuerst
        })
        setPoolLeads(sortedLeads)
      } else {
        setError(data.error || 'Fehler beim Laden')
        setPoolLeads([])
      }
    } catch (err) {
      console.error('Pool-Leads laden fehlgeschlagen:', err)
      setError('Verbindungsfehler')
      setPoolLeads([])
    } finally {
      setLoadingPool(false)
    }
  }

  // Termin übernehmen
  const claimLead = async (lead) => {
    if (!user) return
    
    const userName = user.vor_nachname || user.name
    
    try {
      setClaimingLead(lead.id)
      
      const response = await fetch('/.netlify/functions/hot-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotLeadId: lead.id,
          updates: {
            closerName: userName
          }
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        // Lead aus Pool entfernen
        setPoolLeads(prev => prev.filter(l => l.id !== lead.id))
        // Success-Toast
        showToast('success', `Termin mit ${lead.unternehmen} erfolgreich übernommen!`)
      } else {
        throw new Error(data.error || 'Fehler beim Übernehmen')
      }
    } catch (err) {
      console.error('Termin übernehmen fehlgeschlagen:', err)
      showToast('error', 'Fehler: ' + err.message)
    } finally {
      setClaimingLead(null)
    }
  }

  // Lead an Pool freigeben
  const releaseLead = async () => {
    if (!selectedLead) return
    
    const userName = user?.vor_nachname || user?.name || 'Closer'
    
    try {
      setReleasing(true)
      
      // 1. Hot Lead updaten - closerName entfernen
      const response = await fetch('/.netlify/functions/hot-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotLeadId: selectedLead.id,
          updates: {
            closerName: ''  // Leer = Pool
          }
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Freigeben')
      }
      
      // 2. E-Mail an alle Closer senden
      try {
        await fetch('/.netlify/functions/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'notify-closers-release',
            termin: {
              datum: selectedLead.terminDatum ? new Date(selectedLead.terminDatum).toLocaleDateString('de-DE', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Berlin'  // Immer deutsche Zeit anzeigen
              }) : 'Nicht festgelegt',
              art: selectedLead.terminart || 'Unbekannt',
              unternehmen: selectedLead.unternehmen,
              ansprechpartner: selectedLead.ansprechpartner,
              releasedBy: userName,
              releaseReason: releaseReason || 'Keine Angabe'
            }
          })
        })
      } catch (emailErr) {
        console.error('Closer-Benachrichtigung fehlgeschlagen:', emailErr)
        // Kein harter Fehler - Lead wurde trotzdem freigegeben
      }
      
      // 3. UI aktualisieren
      showToast('success', `${selectedLead.unternehmen} wurde an den Pool freigegeben`)
      setShowReleaseConfirm(false)
      setReleaseReason('')
      setSelectedLead(null)
      
      // 4. Pool-Anzahl aktualisieren
      loadPoolCount()
      
      // 5. Leads neu laden
      if (viewMode === 'own') {
        loadLeads()
      }
      
    } catch (err) {
      console.error('Lead freigeben fehlgeschlagen:', err)
      showToast('error', 'Fehler: ' + err.message)
    } finally {
      setReleasing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    if (viewMode === 'pool') {
      await loadPoolLeads()
    } else {
      await loadLeads()
    }
    setRefreshing(false)
  }

  // Helper Funktionen
  const safeString = (value) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value[0] || ''
    return String(value)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Berlin'  // Immer deutsche Zeit anzeigen
      })
    } catch {
      return '-'
    }
  }

  const formatMoney = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    }).format(value || 0)
  }

  const getStatusStyle = (status) => {
    const option = STATUS_OPTIONS.find(o => o.value === status)
    return option?.color || 'bg-gray-100 text-gray-700'
  }

  // Filter-Logik
  const getFilteredLeads = () => {
    let filtered = leads

    // Status-Filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter)
    }

    // Suche
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(lead => {
        return safeString(lead.unternehmen).toLowerCase().includes(search) ||
               safeString(lead.ansprechpartnerVorname).toLowerCase().includes(search) ||
               safeString(lead.ansprechpartnerNachname).toLowerCase().includes(search) ||
               safeString(lead.email).toLowerCase().includes(search) ||
               safeString(lead.ort).toLowerCase().includes(search)
      })
    }

    return filtered
  }

  const filteredLeads = getFilteredLeads()
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * LEADS_PER_PAGE
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + LEADS_PER_PAGE)

  // Event Handlers
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1)
  }

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value)
    setCurrentPage(1)
  }

  const openModal = (lead) => {
    setSelectedLead(lead)
    // Für Edit-Mode: Status leer lassen, damit User aktiv wählen muss
    setEditData({
      status: '',  // Leer - User muss wählen
      setup: lead.setup || 0,
      retainer: lead.retainer || 0,
      laufzeit: lead.laufzeit || 6,
      kommentar: lead.kommentar || '',
      neuerKommentar: ''  // Für neuen manuellen Kommentar
    })
    setEditMode(false)
  }

  const closeModal = () => {
    setSelectedLead(null)
    setEditMode(false)
    setEditData({})
    setShowAngebotView(false)
    setAngebotData({ paket: '', setup: '', retainer: '', laufzeit: 12 })
    setAngebotSuccess(false)
    setShowEmailComposer(false)
    setShowTerminPicker(false)
    setShowWebsiteStats(false)
    setShowReleaseConfirm(false)
    setReleaseReason('')
  }

  const handleEditChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!selectedLead) return
    
    // Status ist optional - Kommentare können auch ohne Status-Änderung gespeichert werden
    const hasStatusChange = editData.status && editData.status !== selectedLead.status
    const hasNeuerKommentar = editData.neuerKommentar && editData.neuerKommentar.trim()

    if (!hasStatusChange && !hasNeuerKommentar) {
      setEditMode(false)
      return // Nichts zu speichern
    }

    try {
      setSaving(true)

      // Hot Lead Status updaten (nur wenn Status geändert wurde)
      if (hasStatusChange) {
        const response = await fetch('/.netlify/functions/hot-leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hotLeadId: selectedLead.id,
            updates: {
              status: editData.status
            }
          })
        })

        const data = await response.json()

        if (!response.ok) {
          showToast('error', 'Fehler beim Speichern: ' + (data.error || 'Unbekannt'))
          return
        }
      }

      // Kommentar im Original-Lead (Immobilienmakler_Leads) updaten
      let updatedKommentar = selectedLead.kommentar
      
      if (selectedLead.originalLeadId && (hasNeuerKommentar || hasStatusChange)) {
        const userName = user?.vor_nachname || user?.name || 'Closer'
        
        try {
          // Neuer Kommentar als History-Eintrag hinzufügen
          if (hasNeuerKommentar) {
            const kommentarResponse = await fetch('/.netlify/functions/leads', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                leadId: selectedLead.originalLeadId,
                updates: {},
                historyEntry: {
                  action: 'kommentar',
                  details: editData.neuerKommentar.trim(),
                  userName: userName
                }
              })
            })
            
            if (kommentarResponse.ok) {
              const kommentarData = await kommentarResponse.json()
              updatedKommentar = kommentarData.lead?.kommentar || updatedKommentar
            }
          }
          
          // History-Eintrag für Status-Änderung
          if (hasStatusChange) {
            const statusText = editData.status === 'Abgeschlossen' 
              ? 'Deal abgeschlossen ✅' 
              : editData.status === 'Verloren'
                ? 'Lead verloren ❌'
                : editData.status === 'Termin abgesagt'
                  ? 'Termin abgesagt ❌'
                  : editData.status === 'Termin verschoben'
                    ? 'Termin verschoben 🔄'
                    : `Status: ${editData.status}`
            
            const statusResponse = await fetch('/.netlify/functions/leads', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                leadId: selectedLead.originalLeadId,
                updates: {},
                historyEntry: {
                  action: editData.status === 'Abgeschlossen' ? 'abgeschlossen' : 
                          editData.status === 'Verloren' ? 'verloren' :
                          editData.status === 'Termin abgesagt' ? 'termin_abgesagt' :
                          editData.status === 'Termin verschoben' ? 'termin_verschoben' : 'status_update',
                  details: statusText,
                  userName: userName
                }
              })
            })
            
            if (statusResponse.ok) {
              const statusData = await statusResponse.json()
              updatedKommentar = statusData.lead?.kommentar || updatedKommentar
            }
          }
        } catch (kommentarErr) {
          console.warn('Kommentar-Update fehlgeschlagen:', kommentarErr)
        }
      }

      // System Message senden bei bestimmten Status-Änderungen
      if (hasStatusChange) {
        const setterId = selectedLead.setterId
        const unternehmen = selectedLead.unternehmen || 'Lead'
        const terminDatum = selectedLead.terminDatum
          ? new Date(selectedLead.terminDatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
          : ''

        // Nachricht an Setter senden (wenn vorhanden)
        if (setterId) {
          try {
            let messageData = null

            if (editData.status === 'Termin abgesagt') {
              messageData = {
                empfaengerId: setterId,
                typ: 'Termin abgesagt',
                titel: `Termin abgesagt: ${unternehmen}`,
                nachricht: `Der Termin mit ${unternehmen}${terminDatum ? ` am ${terminDatum}` : ''} wurde abgesagt.`,
                hotLeadId: selectedLead.id
              }
            } else if (editData.status === 'Termin verschoben') {
              messageData = {
                empfaengerId: setterId,
                typ: 'Termin verschoben',
                titel: `Termin verschoben: ${unternehmen}`,
                nachricht: `Der Termin mit ${unternehmen}${terminDatum ? ` (ursprünglich ${terminDatum})` : ''} wurde verschoben. Ein neuer Termin wird vereinbart.`,
                hotLeadId: selectedLead.id
              }
            } else if (editData.status === 'Abgeschlossen') {
              messageData = {
                empfaengerId: setterId,
                typ: 'Lead gewonnen',
                titel: `🎉 Deal gewonnen: ${unternehmen}`,
                nachricht: `Herzlichen Glückwunsch! Dein Lead "${unternehmen}" wurde erfolgreich abgeschlossen!`,
                hotLeadId: selectedLead.id
              }
            } else if (editData.status === 'Verloren') {
              messageData = {
                empfaengerId: setterId,
                typ: 'Lead verloren',
                titel: `Lead verloren: ${unternehmen}`,
                nachricht: `Der Lead "${unternehmen}" konnte leider nicht abgeschlossen werden.`,
                hotLeadId: selectedLead.id
              }
            }

            if (messageData) {
              const response = await fetch('/.netlify/functions/system-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(messageData)
              })
              console.log('System Message an Setter gesendet:', editData.status, response.ok ? 'OK' : 'Fehler')
            }
          } catch (msgErr) {
            console.warn('System Message konnte nicht gesendet werden:', msgErr)
          }
        } else {
          console.log('Kein Setter für diesen Lead - keine System Message gesendet')
        }
      }

      // Lokale Liste aktualisieren
      setLeads(prev => prev.map(l => 
        l.id === selectedLead.id 
          ? { ...l, status: hasStatusChange ? editData.status : l.status, kommentar: updatedKommentar }
          : l
      ))
      setSelectedLead(prev => ({ 
        ...prev, 
        status: hasStatusChange ? editData.status : prev.status,
        kommentar: updatedKommentar
      }))
      setEditData(prev => ({ ...prev, neuerKommentar: '', kommentar: updatedKommentar }))
      setEditMode(false)
      showToast('success', 'Änderungen gespeichert')
      
      // Bei Status-Änderung Modal schließen (wie vorher)
      if (hasStatusChange) {
        closeModal()
      }
    } catch (err) {
      console.error('Speichern fehlgeschlagen:', err)
      showToast('error', 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  if (loading && viewMode !== 'pool') {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-on-surface-variant">Leads werden geladen...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-ambient-lg ${
            toast.type === 'success'
              ? 'bg-success-container'
              : 'bg-error-container'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
            )}
            <span className={`font-medium ${
              toast.type === 'success' ? 'text-success' : 'text-error'
            }`}>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className={`ml-2 ${
                toast.type === 'success'
                  ? 'text-success hover:text-success/80'
                  : 'text-error hover:text-error/80'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-display text-on-surface">
            {viewMode === 'pool' ? 'Closer-Pool' : 'Closing'}
            {isAdmin() && viewMode === 'all' && ' (alle Leads)'}
          </h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {viewMode === 'pool'
              ? 'Offene Beratungsgespräche - noch kein Closer zugewiesen'
              : viewMode === 'own'
                ? 'Deine Leads im Closing-Prozess'
                : 'Alle Leads im Closing-Prozess'
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle: Meine Leads / Pool / Alle (für Admins) */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => { setViewMode('own'); setCurrentPage(1); }}
              className={`flex items-center px-4 py-2 rounded-md text-label-lg transition-all duration-250 ${
                viewMode === 'own'
                  ? 'bg-gradient-primary text-white shadow-glow-primary'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
              }`}
            >
              <UserIcon className="w-4 h-4 mr-1.5" />
              Meine Leads
            </button>
            <button
              onClick={() => { setViewMode('pool'); setCurrentPage(1); }}
              className={`flex items-center px-4 py-2 rounded-md text-label-lg transition-all duration-250 ${
                viewMode === 'pool'
                  ? 'bg-secondary text-white shadow-glow-secondary'
                  : 'text-on-surface-variant hover:text-secondary hover:bg-secondary-container/30'
              }`}
            >
              <Calendar className="w-4 h-4 mr-1.5" />
              Pool
              {poolLeads.length > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 text-label-sm rounded-md ${
                  viewMode === 'pool' ? 'bg-white/20 text-white' : 'bg-secondary-container text-secondary'
                }`}>
                  {poolLeads.length}
                </span>
              )}
            </button>
            {isAdmin() && (
              <button
                onClick={() => { setViewMode('all'); setCurrentPage(1); }}
                className={`flex items-center px-4 py-2 rounded-md text-label-lg transition-all duration-250 ${
                  viewMode === 'all'
                    ? 'bg-gradient-primary text-white shadow-glow-primary'
                    : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
                }`}
              >
                <Users className="w-4 h-4 mr-1.5" />
                Alle
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-error-container text-error px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* ==================== POOL-ANSICHT ==================== */}
      {viewMode === 'pool' ? (
        <>
          {/* Pool Refresh Button */}
          <div className="flex justify-end">
            <button
              onClick={handleRefresh}
              disabled={refreshing || loadingPool}
              className="flex items-center px-4 py-2.5 bg-surface-container-lowest rounded-lg hover:bg-surface-container transition-colors shadow-ambient-sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 text-on-surface-variant ${(refreshing || loadingPool) ? 'animate-spin' : ''}`} />
              Aktualisieren
            </button>
          </div>

          <div className="card-elevated overflow-hidden">
            {loadingPool ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-secondary" />
              <span className="ml-3 text-on-surface-variant">Pool wird geladen...</span>
            </div>
          ) : poolLeads.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-16 h-16 text-outline-variant mx-auto mb-4" />
              <p className="text-on-surface-variant text-title-md">Keine offenen Termine im Pool</p>
              <p className="text-outline mt-1">Alle Beratungsgespräche wurden bereits übernommen</p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {poolLeads.map((lead, index) => {
                const terminDate = lead.terminDatum ? new Date(lead.terminDatum) : null
                const isUpcoming = terminDate && terminDate > new Date()
                const isPast = terminDate && terminDate < new Date()

                return (
                  <div
                    key={lead.id}
                    className={`table-row p-5 rounded-xl ${isPast ? 'bg-error-container/30' : index % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Lead-Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-on-surface truncate">
                            {lead.unternehmen || 'Unbekannt'}
                          </h3>
                          {lead.terminart && (
                            <span className={`badge ${
                              lead.terminart === 'Video'
                                ? 'badge-secondary'
                                : 'badge-primary'
                            }`}>
                              {lead.terminart === 'Video' ? 'Video' : 'Telefon'}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-on-surface-variant">
                          {(lead.ansprechpartnerVorname || lead.ansprechpartnerNachname) && (
                            <span className="flex items-center gap-1">
                              <UserIcon className="w-3.5 h-3.5" />
                              {lead.ansprechpartnerVorname} {lead.ansprechpartnerNachname}
                            </span>
                          )}
                          {lead.ort && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {lead.ort}
                            </span>
                          )}
                          {lead.setterName && (
                            <span className="flex items-center gap-1 text-outline">
                              Gebucht von: {lead.setterName}
                            </span>
                          )}
                        </div>

                        {/* Problemstellung / Infos aus Kommentar */}
                        {lead.kommentar && (
                          <p className="mt-2 text-body-sm text-on-surface-variant line-clamp-2">
                            {lead.kommentar}
                          </p>
                        )}
                      </div>

                      {/* Termin & Action */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        {/* Termin-Datum */}
                        <div className={`text-center px-4 py-2 rounded-xl ${
                          isPast
                            ? 'bg-error-container text-error'
                            : 'bg-secondary-container text-secondary'
                        }`}>
                          <div className="text-label-sm font-medium uppercase">
                            {terminDate?.toLocaleDateString('de-DE', { weekday: 'short', timeZone: 'Europe/Berlin' })}
                          </div>
                          <div className="text-title-lg font-display">
                            {terminDate?.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })}
                          </div>
                          <div className="text-body-sm font-medium">
                            {terminDate?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })} Uhr
                          </div>
                          {isPast && (
                            <div className="text-label-sm mt-1">Verpasst</div>
                          )}
                        </div>

                        {/* Übernehmen Button */}
                        <button
                          onClick={() => claimLead(lead)}
                          disabled={claimingLead === lead.id}
                          className="btn-primary flex items-center justify-center whitespace-nowrap disabled:opacity-50"
                        >
                          {claimingLead === lead.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Übernehmen
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        </>
      ) : (
        /* ==================== NORMALE CLOSING-ANSICHT ==================== */
        <>
          {/* Filter & Suche */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Suche */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
            <input
              type="text"
              placeholder="Firma, Name, Ort suchen..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="input-field pl-10 pr-10"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Status-Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="select-field pl-10 min-w-[180px]"
            >
              <option value="all">Alle Status</option>
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* Aktualisieren */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-surface-container-lowest rounded-lg hover:bg-surface-container transition-colors shadow-ambient-sm"
          >
            <RefreshCw className={`w-5 h-5 text-on-surface-variant ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Lead-Liste */}
      <div className="card-elevated overflow-hidden min-h-[600px]">
        <div>
          {paginatedLeads.length === 0 ? (
            <div className="p-12 text-center">
              <Target className="w-16 h-16 text-outline-variant mx-auto mb-4" />
              {searchTerm || statusFilter !== 'all' ? (
                <div>
                  <p className="text-on-surface-variant text-title-md">Keine Leads gefunden</p>
                  <button
                    type="button"
                    onClick={() => { setSearchTerm(''); setStatusFilter('all'); setCurrentPage(1); }}
                    className="text-primary hover:text-primary-container mt-2 transition-colors"
                  >
                    Filter zurücksetzen
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-on-surface-variant text-title-md">Noch keine Leads im Closing</p>
                  <p className="text-outline mt-1">Leads erscheinen hier sobald Termine gebucht werden</p>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-container">
                    <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider">
                      Unternehmen
                    </th>
                    <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider hidden md:table-cell">
                      Ansprechpartner
                    </th>
                    <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">
                      Termin
                    </th>
                    <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider">
                      Status
                    </th>
                    {/* Closer-Spalte nur bei "Alle Leads" für Admins */}
                    {isAdmin() && viewMode === 'all' && (
                      <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">
                        Closer
                      </th>
                    )}
                    <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">
                      Coldcaller
                    </th>
                    <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider hidden xl:table-cell">
                      Kontakt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead, index) => (
                    <tr
                      key={lead.id}
                      onClick={() => openModal(lead)}
                      className={`table-row cursor-pointer ${index % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'}`}
                    >
                      {/* Status-Indikator */}
                      <td className="px-4 py-4">
                        <div
                          className={`p-1.5 rounded-lg inline-flex ${
                            lead.status === 'Abgeschlossen'
                              ? 'bg-success-container text-success'
                              : lead.status === 'Verloren'
                              ? 'bg-error-container text-error'
                              : lead.status === 'Angebot' || lead.status === 'Angebot versendet'
                              ? 'bg-warning-container text-warning'
                              : 'bg-surface-container text-outline'
                          }`}
                        >
                          {lead.status === 'Abgeschlossen' ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : lead.status === 'Verloren' ? (
                            <AlertCircle className="w-5 h-5" />
                          ) : lead.status === 'Angebot' || lead.status === 'Angebot versendet' ? (
                            <FileText className="w-5 h-5" />
                          ) : (
                            <Calendar className="w-5 h-5" />
                          )}
                        </div>
                      </td>

                      {/* Unternehmen */}
                      <td className="px-4 py-4">
                        <div className="font-medium text-on-surface">{safeString(lead.unternehmen) || 'Unbekannt'}</div>
                        <div className="text-body-sm text-on-surface-variant">{lead.kategorie || 'Unternehmen'}</div>
                      </td>

                      {/* Ansprechpartner */}
                      <td className="px-4 py-4 hidden md:table-cell">
                        <div className="flex items-center text-on-surface-variant">
                          <UserIcon className="w-4 h-4 mr-1.5 text-outline" />
                          {safeString(lead.ansprechpartnerVorname)} {safeString(lead.ansprechpartnerNachname)}
                        </div>
                      </td>

                      {/* Termin */}
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <div className="flex items-center text-on-surface-variant">
                          <Calendar className="w-4 h-4 mr-1.5 text-outline" />
                          {formatDate(lead.terminDatum)}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-4">
                        <span className={`badge ${getStatusStyle(lead.status)}`}>
                          {lead.status || 'Unbekannt'}
                        </span>
                      </td>

                      {/* Closer - nur bei "Alle Leads" für Admins */}
                      {isAdmin() && viewMode === 'all' && (
                        <td className="px-4 py-4 hidden lg:table-cell">
                          <div className="flex items-center text-on-surface-variant">
                            <UserIcon className="w-4 h-4 mr-1.5 text-outline" />
                            <span className="truncate max-w-[100px]">{safeString(lead.closerName) || '—'}</span>
                          </div>
                        </td>
                      )}

                      {/* Coldcaller */}
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <div className="flex items-center text-on-surface-variant">
                          <Phone className="w-4 h-4 mr-1.5 text-outline" />
                          <span className="truncate max-w-[100px]">{safeString(lead.setterName) || '—'}</span>
                        </div>
                      </td>

                      {/* Kontakt */}
                      <td className="px-4 py-4 hidden xl:table-cell">
                        <div className="space-y-1">
                          {lead.telefon && (
                            <div className="flex items-center text-body-sm text-on-surface-variant">
                              <Phone className="w-3.5 h-3.5 mr-1.5 text-outline" />
                              {lead.telefon}
                            </div>
                          )}
                          {lead.email && (
                            <div className="flex items-center text-body-sm text-on-surface-variant">
                              <Mail className="w-3.5 h-3.5 mr-1.5 text-outline" />
                              <span className="truncate max-w-[150px]">{lead.email}</span>
                            </div>
                          )}
                          {!lead.telefon && !lead.email && (
                            <span className="text-outline text-body-sm">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {filteredLeads.length > LEADS_PER_PAGE && (
                <div className="px-6 py-4 bg-surface-container/50 flex items-center justify-between">
                  <span className="text-body-sm text-on-surface-variant">
                    {startIndex + 1}-{Math.min(startIndex + LEADS_PER_PAGE, filteredLeads.length)} von {filteredLeads.length} Leads
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safeCurrentPage === 1}
                      className="p-2 bg-surface-container-lowest rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
                    </button>
                    <span className="text-body-sm text-on-surface px-3">
                      Seite {safeCurrentPage} von {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage === totalPages}
                      className="p-2 bg-surface-container-lowest rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail/Edit Modal */}
      {selectedLead && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="modal-backdrop fixed inset-0"
            onClick={closeModal}
          />

          {/* Modal Content */}
          <div className="modal-content relative max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-primary rounded-lg">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-headline-sm font-display text-on-surface">
                    {safeString(selectedLead.unternehmen) || 'Lead Details'}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant">{selectedLead.kategorie || 'Immobilienmakler'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 hover:bg-surface-container rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body - Scrollbar hier */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {angebotSuccess ? (
                /* ========================================
                   ERFOLGS-ANSICHT nach Angebot versenden
                   ======================================== */
                <div className="py-8 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Angebot wird versendet!</h3>
                </div>
              ) : showEmailComposer ? (
                /* ========================================
                   EMAIL COMPOSER für Unterlagen versenden
                   ======================================== */
                <div>
                  {/* Zurück-Link */}
                  <button
                    type="button"
                    onClick={() => setShowEmailComposer(false)}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Zurück zur Übersicht
                  </button>
                  
                  <EmailComposer
                    lead={selectedLead}
                    user={user}
                    inline={true}
                    kategorie="Closing"
                    onClose={() => setShowEmailComposer(false)}
                    onSent={(info) => {
                      console.log('E-Mail gesendet:', info)
                      setShowEmailComposer(false)
                    }}
                  />
                </div>
              ) : showAngebotView ? (
                /* ========================================
                   ANGEBOT VERSENDEN VIEW
                   ======================================== */
                <div className="space-y-6">
                  {/* Zurück-Link */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAngebotView(false)
                      setAngebotData({
                        produkt: '',
                        setup: '',
                        retainer: '',
                        laufzeit: 12,
                        vertragsbestandteile: DEFAULT_VERTRAGSBESTANDTEILE,
                        paketname: '',
                        kurzbeschreibung: '',
                        leistungsbeschreibung: ''
                      })
                    }}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Zurück zur Übersicht
                  </button>

                  {/* Angebot Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <FileText className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Angebot konfigurieren</h3>
                      <p className="text-sm text-gray-500">Wähle ein Produkt oder erstelle ein individuelles Angebot</p>
                    </div>
                  </div>

                  {/* Produkt-Auswahl als Cards */}
                  <div className="space-y-3 mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Produkt auswählen</label>
                    {PRODUKT_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleProduktChange(option.value)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                          angebotData.produkt === option.value
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              angebotData.produkt === option.value
                                ? 'border-green-500 bg-green-500'
                                : 'border-gray-300'
                            }`}>
                              {angebotData.produkt === option.value && (
                                <div className="w-2 h-2 bg-white rounded-full" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{option.label}</p>
                              {option.value !== 'Individuell' && (
                                <p className="text-sm text-gray-500">{option.description}</p>
                              )}
                            </div>
                          </div>
                          {option.value !== 'Individuell' && (
                            <div className="text-right">
                              <p className="font-bold text-gray-900">{option.setup.toLocaleString('de-DE')} €</p>
                              <p className="text-sm text-gray-500">+ {option.retainer} €/Mon</p>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Individuelle Preiseingabe & Felder */}
                  {angebotData.produkt === 'Individuell' && (
                    <div className="bg-gray-50 rounded-xl p-5 mb-6 space-y-4">
                      <h4 className="font-medium text-gray-900">Individuelles Angebot konfigurieren</h4>

                      {/* Paketname */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Paketname <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={angebotData.paketname}
                          onChange={(e) => setAngebotData(prev => ({ ...prev, paketname: e.target.value }))}
                          placeholder="z.B. KI-Chatbot, WhatsApp-Assistent"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                      </div>

                      {/* Kurzbeschreibung */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Kurzbeschreibung <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={angebotData.kurzbeschreibung}
                          onChange={(e) => setAngebotData(prev => ({ ...prev, kurzbeschreibung: e.target.value }))}
                          placeholder="z.B. Aufbau & Betrieb Ihrer individuellen KI-Vertriebsassistenz"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">Wird in der Angebots-E-Mail verwendet</p>
                      </div>

                      {/* Leistungsbeschreibung */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Leistungsbeschreibung <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={angebotData.leistungsbeschreibung}
                          onChange={(e) => setAngebotData(prev => ({ ...prev, leistungsbeschreibung: e.target.value }))}
                          placeholder="Detaillierte Beschreibung der Leistungen..."
                          rows={5}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">Verwende Überschriften und Spiegelstriche für Struktur</p>
                      </div>

                      {/* Setup-Gebühr */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Setup-Gebühr (netto) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={angebotData.setup}
                            onChange={(e) => handleSetupChange(e.target.value)}
                            placeholder="z.B. 1500"
                            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">€</span>
                        </div>
                      </div>

                      {angebotData.setup && angebotData.retainer && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-sm text-blue-700 mb-1">Automatisch berechneter Retainer</p>
                          <p className="text-sm text-blue-600">
                            {angebotData.setup} € / 2,75 = <span className="font-bold text-blue-800">{angebotData.retainer} €/Monat</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vertragsbestandteile (immer sichtbar wenn Produkt gewählt) */}
                  {angebotData.produkt && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vertragsbestandteile
                      </label>
                      <textarea
                        value={angebotData.vertragsbestandteile}
                        onChange={(e) => setAngebotData(prev => ({ ...prev, vertragsbestandteile: e.target.value }))}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none text-sm"
                      />
                    </div>
                  )}

                  {/* Vertragslaufzeit */}
                  {angebotData.produkt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vertragslaufzeit
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={angebotData.laufzeit}
                          onChange={(e) => setAngebotData(prev => ({
                            ...prev,
                            laufzeit: Math.min(32, Math.max(3, parseInt(e.target.value) || 12))
                          }))}
                          min="3"
                          max="32"
                          className="w-24 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-center"
                        />
                        <span className="text-gray-600">Monate</span>
                        <div className="flex gap-2 ml-auto">
                          {[6, 12, 24].map(months => (
                            <button
                              key={months}
                              type="button"
                              onClick={() => setAngebotData(prev => ({ ...prev, laufzeit: months }))}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                angebotData.laufzeit === months
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {months} Mon
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Min. 3 Monate, max. 32 Monate</p>
                    </div>
                  )}

                  {/* Zusammenfassung */}
                  {angebotData.setup && angebotData.retainer && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                      <h4 className="font-medium text-green-900 mb-4">Angebot Zusammenfassung</h4>
                      {angebotData.produkt && (
                        <p className="text-sm text-green-700 mb-4">
                          Produkt: <span className="font-semibold">{angebotData.produkt}</span>
                          {angebotData.produkt === 'Individuell' && angebotData.paketname && (
                            <span> - {angebotData.paketname}</span>
                          )}
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-white rounded-lg p-4 text-center">
                          <p className="text-sm text-gray-500 mb-1">Setup-Gebühr</p>
                          <p className="text-2xl font-bold text-gray-900">{parseFloat(angebotData.setup).toLocaleString('de-DE')} €</p>
                          <p className="text-xs text-gray-400">einmalig, netto</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center">
                          <p className="text-sm text-gray-500 mb-1">Monatlicher Retainer</p>
                          <p className="text-2xl font-bold text-gray-900">{angebotData.retainer} €</p>
                          <p className="text-xs text-gray-400">pro Monat, netto</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center">
                          <p className="text-sm text-gray-500 mb-1">Laufzeit</p>
                          <p className="text-2xl font-bold text-gray-900">{angebotData.laufzeit}</p>
                          <p className="text-xs text-gray-400">Monate</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-500 mb-1">Gesamtwert ({angebotData.laufzeit} Monate)</p>
                        <p className="text-3xl font-bold text-green-600">
                          {(parseFloat(angebotData.setup) + parseFloat(angebotData.retainer) * angebotData.laufzeit).toLocaleString('de-DE')} €
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : showTerminPicker ? (
                /* ========================================
                   NEU-TERMINIEREN VIEW
                   ======================================== */
                <div className="space-y-6">
                  {/* Zurück-Link */}
                  <button
                    type="button"
                    onClick={() => setShowTerminPicker(false)}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Zurück zur Übersicht
                  </button>

                  {/* Header */}
                  {(() => {
                    const terminDate = new Date(selectedLead.terminDatum)
                    const isInPast = terminDate < new Date()
                    const isAbgesagt = selectedLead.status === 'Termin abgesagt'
                    const headerText = isInPast || isAbgesagt ? 'Neuen Termin buchen' : 'Termin verschieben'
                    
                    return (
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-orange-100 rounded-xl">
                          <CalendarPlus className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">{headerText}</h3>
                          <p className="text-sm text-gray-500">{selectedLead.unternehmen}</p>
                        </div>
                      </div>
                    )
                  })()}

                  {/* TerminPicker */}
                  <TerminPicker
                    lead={{
                      id: selectedLead.originalLeadId,
                      unternehmen: selectedLead.unternehmen,
                      unternehmensname: selectedLead.unternehmen,
                      email: selectedLead.email,
                      telefon: selectedLead.telefon,
                      ansprechpartnerVorname: selectedLead.ansprechpartnerVorname,
                      ansprechpartnerNachname: selectedLead.ansprechpartnerNachname,
                      stadt: selectedLead.ort,
                      kategorie: selectedLead.kategorie
                    }}
                    hotLeadId={selectedLead.id}
                    onTerminBooked={(result) => {
                      setShowTerminPicker(false)
                      setSelectedLead(null)
                      showToast('success', `Neuer Termin gebucht für ${selectedLead.unternehmen}`)
                      loadLeads()
                    }}
                    onCancel={() => setShowTerminPicker(false)}
                  />
                </div>
              ) : (
                /* ========================================
                   NORMALE LEAD-DETAIL-ANSICHT
                   ======================================== */
                <div className="space-y-6">
                  {/* Action Buttons - Angebot & Unterlagen versenden */}
                  {!editMode && (
                    <div className="space-y-3">
                      {/* Termin verschieben/neu buchen Button - für alle Leads mit Termin */}
                      {selectedLead.terminDatum && selectedLead.status !== 'Abgeschlossen' && selectedLead.status !== 'Verloren' && (() => {
                        const terminDate = new Date(selectedLead.terminDatum)
                        const now = new Date()
                        const isInPast = terminDate < now
                        const isAbgesagt = selectedLead.status === 'Termin abgesagt'
                        
                        return (
                          <button
                            type="button"
                            onClick={() => setShowTerminPicker(true)}
                            className="w-full flex items-center justify-center px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                          >
                            <CalendarPlus className="w-5 h-5 mr-2" />
                            {isInPast || isAbgesagt ? 'Neuen Termin buchen' : 'Termin verschieben'}
                          </button>
                        )
                      })()}
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setShowAngebotView(true)}
                          className="flex items-center justify-center px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {selectedLead.status === 'Lead' ? 'Angebot versenden' : 'Neues Angebot'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowEmailComposer(true)}
                          className="flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Paperclip className="w-4 h-4 mr-2" />
                          Unterlagen versenden
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">Status</label>
                    {editMode ? (
                      <select
                        value={editData.status}
                        onChange={(e) => handleEditChange('status', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        {/* Aktuellen Status als Default */}
                        <option value="">Status beibehalten ({selectedLead.status})</option>
                        <option value="Lead">Lead</option>
                        <option value="Angebot">Angebot</option>
                        <option value="Angebot versendet">Angebot versendet</option>
                        <option value="Termin verschoben">Termin verschoben</option>
                        <option value="Termin abgesagt">Termin abgesagt</option>
                        <option value="Abgeschlossen">Abgeschlossen</option>
                        <option value="Verloren">Verloren</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${getStatusStyle(selectedLead.status)}`}>
                        {selectedLead.status || 'Unbekannt'}
                      </span>
                    )}
                  </div>

                  {/* Kontaktdaten - gleicher Stil wie Kaltakquise */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Telefon */}
                    {safeString(selectedLead.telefon) ? (
                      <a 
                        href={`tel:${safeString(selectedLead.telefon)}`}
                        className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <Phone className="w-5 h-5 text-purple-600 mr-3" />
                        <span className="text-gray-900">{safeString(selectedLead.telefon)}</span>
                      </a>
                    ) : (
                      <div className="flex items-center p-3 bg-gray-50 rounded-lg text-gray-400">
                        <Phone className="w-5 h-5 mr-3" />
                        <span>Keine Telefonnummer</span>
                      </div>
                    )}

                    {/* E-Mail */}
                    {safeString(selectedLead.email) ? (
                      <a 
                        href={`mailto:${safeString(selectedLead.email)}`}
                        className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <Mail className="w-5 h-5 text-purple-600 mr-3" />
                        <span className="text-gray-900 truncate">{safeString(selectedLead.email)}</span>
                      </a>
                    ) : (
                      <div className="flex items-center p-3 bg-gray-50 rounded-lg text-gray-400">
                        <Mail className="w-5 h-5 mr-3" />
                        <span>Keine E-Mail</span>
                      </div>
                    )}

                    {/* Website */}
                    {safeString(selectedLead.website) ? (
                      <a 
                        href={safeString(selectedLead.website).startsWith('http') ? safeString(selectedLead.website) : `https://${safeString(selectedLead.website)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <Globe className="w-5 h-5 text-purple-600 mr-3" />
                        <span className="text-gray-900 truncate">{safeString(selectedLead.website)}</span>
                      </a>
                    ) : (
                      <div className="flex items-center p-3 bg-gray-50 rounded-lg text-gray-400">
                        <Globe className="w-5 h-5 mr-3" />
                        <span>Keine Website</span>
                      </div>
                    )}

                    {/* Standort */}
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <MapPin className="w-5 h-5 text-purple-600 mr-3" />
                      <span className="text-gray-900">
                        {[safeString(selectedLead.ort), safeString(selectedLead.bundesland)].filter(Boolean).join(', ') || 'Kein Standort'}
                      </span>
                    </div>
                  </div>

                  {/* Ansprechpartner & Zuständig */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Ansprechpartner */}
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Users className="w-5 h-5 text-purple-600 mr-3" />
                      <div>
                        <span className="text-xs text-gray-400">Ansprechpartner</span>
                        <p className="text-gray-900">
                          {safeString(selectedLead.ansprechpartnerVorname) || safeString(selectedLead.ansprechpartnerNachname) 
                            ? `${safeString(selectedLead.ansprechpartnerVorname)} ${safeString(selectedLead.ansprechpartnerNachname)}`.trim()
                            : 'Nicht angegeben'}
                        </p>
                      </div>
                    </div>

                    {/* Termin */}
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Calendar className="w-5 h-5 text-purple-600 mr-3" />
                      <div>
                        <span className="text-xs text-gray-400">Termin</span>
                        <p className="text-gray-900">{formatDate(selectedLead.terminDatum)}</p>
                      </div>
                    </div>

                    {/* Coldcaller */}
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <UserIcon className="w-5 h-5 text-purple-600 mr-3" />
                      <div>
                        <span className="text-xs text-gray-400">Coldcaller</span>
                        <p className="text-gray-900">{safeString(selectedLead.setterName) || '-'}</p>
                      </div>
                    </div>

                    {/* Closer */}
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Target className="w-5 h-5 text-purple-600 mr-3" />
                      <div>
                        <span className="text-xs text-gray-400">Closer</span>
                        <p className="text-gray-900">{safeString(selectedLead.closerName) || '-'}</p>
                      </div>
                    </div>

                    {/* Video-Link (wenn Video-Termin mit Link) - ganz unten */}
                    {selectedLead.terminart === 'Video' && selectedLead.meetingLink && (
                      <a
                        href={selectedLead.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors group col-span-2"
                      >
                        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-3 group-hover:bg-blue-600 transition-colors">
                          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                          </svg>
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-medium text-blue-700">Video-Meeting beitreten</span>
                          <p className="text-xs text-blue-500 truncate max-w-[300px]">{selectedLead.meetingLink}</p>
                        </div>
                        <svg className="w-5 h-5 text-blue-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>

                  {/* Website-Statistiken (bei Status "Lead") ODER Deal-Details (bei anderen Status) */}
                  {selectedLead.status === 'Lead' ? (
                    /* Website-Statistiken - Hauptanzeige bei Status Lead */
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
                      <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                        <BarChart3 className="w-4 h-4 mr-2 text-purple-600" />
                        Website-Statistiken
                      </h4>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="bg-white p-3 rounded-lg shadow-sm">
                          <p className="text-xs text-gray-500">Besucher/Monat</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {selectedLead.monatlicheBesuche 
                              ? selectedLead.monatlicheBesuche.toLocaleString('de-DE')
                              : '-'}
                          </p>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm">
                          <p className="text-xs text-gray-500">Absprungrate</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {selectedLead.absprungrate !== null && selectedLead.absprungrate !== undefined
                              ? `${Math.round(selectedLead.absprungrate * 100)}%`
                              : '-'}
                          </p>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm">
                          <p className="text-xs text-gray-500">Leads/Monat</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {selectedLead.anzahlLeads !== null && selectedLead.anzahlLeads !== undefined
                              ? selectedLead.anzahlLeads
                              : '-'}
                          </p>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm">
                          <p className="text-xs text-gray-500">Mehrwert</p>
                          <p className="text-lg font-semibold text-green-600">
                            {selectedLead.mehrwert 
                              ? `${selectedLead.mehrwert.toLocaleString('de-DE')} €`
                              : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Deal-Details und einklappbare Website-Statistiken bei anderen Status */
                    <>
                      {/* Deal-Werte - gleicher Stil wie Website-Statistiken */}
                      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                          <Euro className="w-4 h-4 mr-2 text-green-600" />
                          Deal-Details
                        </h4>
                        <div className="grid grid-cols-4 gap-4">
                          <div className="bg-white p-3 rounded-lg shadow-sm">
                            <p className="text-xs text-gray-500">Setup</p>
                            <p className="text-lg font-semibold text-gray-900">{formatMoney(selectedLead.setup)}</p>
                          </div>
                          <div className="bg-white p-3 rounded-lg shadow-sm">
                            <p className="text-xs text-gray-500">Retainer</p>
                            <p className="text-lg font-semibold text-gray-900">{formatMoney(selectedLead.retainer)}/Mon</p>
                          </div>
                          <div className="bg-white p-3 rounded-lg shadow-sm">
                            <p className="text-xs text-gray-500">Laufzeit</p>
                            <p className="text-lg font-semibold text-gray-900">{selectedLead.laufzeit || 12} Mon</p>
                          </div>
                          <div className="bg-white p-3 rounded-lg shadow-sm">
                            <p className="text-xs text-gray-500">Gesamtwert</p>
                            <p className="text-lg font-semibold text-green-600">
                              {formatMoney(
                                (selectedLead.setup || 0) + 
                                (selectedLead.retainer || 0) * 
                                (selectedLead.laufzeit || 12)
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Website-Statistiken - Einklappbar */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowWebsiteStats(!showWebsiteStats)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <span className="flex items-center text-sm font-medium text-gray-700">
                            <BarChart3 className="w-4 h-4 mr-2 text-purple-600" />
                            Website-Statistiken
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showWebsiteStats ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showWebsiteStats && (
                          <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-t border-gray-200">
                            <div className="grid grid-cols-4 gap-4">
                              <div className="bg-white p-3 rounded-lg shadow-sm">
                                <p className="text-xs text-gray-500">Besucher/Monat</p>
                                <p className="text-lg font-semibold text-gray-900">
                                  {selectedLead.monatlicheBesuche 
                                    ? selectedLead.monatlicheBesuche.toLocaleString('de-DE')
                                    : '-'}
                                </p>
                              </div>
                              <div className="bg-white p-3 rounded-lg shadow-sm">
                                <p className="text-xs text-gray-500">Absprungrate</p>
                                <p className="text-lg font-semibold text-gray-900">
                                  {selectedLead.absprungrate !== null && selectedLead.absprungrate !== undefined
                                    ? `${Math.round(selectedLead.absprungrate * 100)}%`
                                    : '-'}
                                </p>
                              </div>
                              <div className="bg-white p-3 rounded-lg shadow-sm">
                                <p className="text-xs text-gray-500">Leads/Monat</p>
                                <p className="text-lg font-semibold text-gray-900">
                                  {selectedLead.anzahlLeads !== null && selectedLead.anzahlLeads !== undefined
                                    ? selectedLead.anzahlLeads
                                    : '-'}
                                </p>
                              </div>
                              <div className="bg-white p-3 rounded-lg shadow-sm">
                                <p className="text-xs text-gray-500">Mehrwert</p>
                                <p className="text-lg font-semibold text-green-600">
                                  {selectedLead.mehrwert 
                                    ? `${selectedLead.mehrwert.toLocaleString('de-DE')} €`
                                    : '-'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Notizen / History - immer read-only */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-3">Notizen & Verlauf</h4>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                      {selectedLead.kommentar ? (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedLead.kommentar}</p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Keine Notizen vorhanden</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Neuer Kommentar hinzufügen - nur im Edit-Mode */}
                  {editMode && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Neuer Kommentar hinzufügen</label>
                      <textarea
                        value={editData.neuerKommentar || ''}
                        onChange={(e) => handleEditChange('neuerKommentar', e.target.value)}
                        rows={3}
                        placeholder="Notiz hinzufügen..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                      />
                    </div>
                  )}

                  {/* Dokumente / Attachments */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-3">Dokumente</h4>
                    
                    {/* Hidden File Input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      className="hidden"
                      id="file-upload"
                    />
                    
                    {uploadError && (
                      <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center">
                        <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                        {uploadError}
                        <button onClick={() => setUploadError('')} className="ml-auto">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {selectedLead.attachments && selectedLead.attachments.length > 0 ? (
                      <div className="space-y-2">
                        {selectedLead.attachments.map((attachment, index) => (
                          <div 
                            key={attachment.id || index}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center min-w-0 flex-1">
                              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                {attachment.filename?.toLowerCase().endsWith('.pdf') ? (
                                  <FileText className="w-5 h-5 text-purple-600" />
                                ) : attachment.type?.startsWith('image') || attachment.filename?.match(/\.(png|jpg|jpeg)$/i) ? (
                                  <File className="w-5 h-5 text-blue-600" />
                                ) : (
                                  <File className="w-5 h-5 text-gray-600" />
                                )}
                              </div>
                              <div className="ml-3 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {attachment.filename || 'Dokument'}
                                </p>
                                {attachment.size && (
                                  <p className="text-xs text-gray-500">{formatFileSize(attachment.size)}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-3">
                              <a
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                                title="Herunterladen"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              {editMode && (
                                <button
                                  onClick={() => handleDeleteAttachment(attachment)}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Löschen"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {/* Weitere Datei hinzufügen - nur im Edit-Mode */}
                        {editMode && (
                          <label
                            htmlFor="file-upload"
                            className={`flex items-center justify-center p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                              uploading 
                                ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                                : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                            }`}
                          >
                            {uploading ? (
                              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                            ) : (
                              <>
                                <Upload className="w-4 h-4 text-gray-400 mr-2" />
                                <span className="text-sm text-gray-500">Weitere Datei hinzufügen</span>
                              </>
                            )}
                          </label>
                        )}
                      </div>
                    ) : (
                      /* Leerer Zustand - klickbar im Edit-Mode */
                      editMode ? (
                        <label
                          htmlFor="file-upload"
                          className={`block p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                            uploading 
                              ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                              : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                          }`}
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="w-8 h-8 text-purple-400 mx-auto mb-2 animate-spin" />
                              <p className="text-sm text-gray-500">Wird hochgeladen...</p>
                            </>
                          ) : (
                            <>
                              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                              <p className="text-sm text-gray-500">Klicken zum Hochladen</p>
                              <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG, DOC, DOCX (max. 10 MB)</p>
                            </>
                          )}
                        </label>
                      ) : (
                        <div className="p-4 bg-gray-50 rounded-lg text-center">
                          <File className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">Keine Dokumente vorhanden</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer - unterschiedlich je nach View (nicht bei Success, EmailComposer oder TerminPicker) */}
            {!angebotSuccess && !showEmailComposer && !showTerminPicker && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                {showAngebotView ? (
                  /* Angebot-View Footer */
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAngebotView(false)
                        setAngebotData({ paket: '', setup: '', retainer: '', laufzeit: 12 })
                      }}
                      disabled={sendingAngebot}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={handleSendAngebot}
                      disabled={!angebotData.setup || !angebotData.retainer || sendingAngebot}
                      className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {sendingAngebot ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Angebot wird versendet...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Angebot versenden
                      </>
                    )}
                  </button>
                </>
              ) : editMode ? (
                /* Edit-Mode Footer */
                <>
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Speichern
                  </button>
                </>
              ) : (
                /* Normal-View Footer */
                <>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Schließen
                  </button>
                  {/* Freigabe-Button - nur wenn Lead einem Closer zugewiesen ist */}
                  {selectedLead.closerName && (
                    <button
                      type="button"
                      onClick={() => setShowReleaseConfirm(true)}
                      className="flex items-center px-4 py-2 text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      An Pool freigeben
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Bearbeiten
                  </button>
                </>
              )}
              </div>
            )}

            {/* Freigabe-Bestätigung Modal */}
            {showReleaseConfirm && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 rounded-2xl">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <UserMinus className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Lead freigeben?</h3>
                      <p className="text-sm text-gray-500">{selectedLead.unternehmen}</p>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-4">
                    Der Lead wird wieder für alle Closer im Pool verfügbar. Alle Closer werden per E-Mail benachrichtigt.
                  </p>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Grund (optional)
                    </label>
                    <textarea
                      value={releaseReason}
                      onChange={(e) => setReleaseReason(e.target.value)}
                      rows={2}
                      placeholder="z.B. Urlaub, Krankheit, Kapazität..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowReleaseConfirm(false); setReleaseReason(''); }}
                      disabled={releasing}
                      className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={releaseLead}
                      disabled={releasing}
                      className="flex-1 flex items-center justify-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                    >
                      {releasing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <UserMinus className="w-4 h-4 mr-2" />
                          Freigeben
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
        </>
      )}
    </div>
  )
}

export default Closing
