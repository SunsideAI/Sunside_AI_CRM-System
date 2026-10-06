import { STATUS, STUFE, IST_VERLOREN, anzeigeName, statusFuerStufe, statusBrauchtLeitung } from '../../shared/status.js'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import EmailComposer from '../components/EmailComposer'
import TerminPicker from '../components/TerminPicker'
import AbschlussForm from '../components/AbschlussForm'
import RueckgabeKnopf from '../components/RueckgabeKnopf'
import BillingPanel from '../components/BillingPanel'
import { deriveBillingMode } from '../utils/billingMode'

// Alles vor dem ersten datierten Eintrag: der Rest aus einer aelteren
// Migration, den die Zeitleiste bewusst nicht uebernimmt.
function altbestand(kommentar) {
  const k = kommentar || ''
  if (/^\[\d{2}\.\d{2}\.\d{4}/.test(k)) return ''
  return (k.split(/\n(?=\[\d{2}\.\d{2}\.\d{4})/)[0] || '').trim()
}
import Verlauf from '../components/Verlauf'
import Uebergabeblatt, { UEBERGABE_2 } from '../components/Uebergabeblatt'
import Aktionsmenue from '../components/Aktionsmenue'
import LeadFreigabe from '../components/LeadFreigabe'
import Gespraechsausgang from '../components/Gespraechsausgang'
import { Rollen, Pille, Statistik, webZahlen } from '../components/LeadSchublade'
import SlideDrawer from '../components/SlideDrawer'
import { useMeldung } from '../components/Meldungen'
import KontaktFelder from '../components/KontaktFelder'
import LeadPool from '../components/LeadPool'
import LeadTabelle from '../components/LeadTabelle'
import SpaltenWahl from '../components/SpaltenWahl'
import FilterWahl from '../components/FilterWahl'
import useTabelle from '../hooks/useTabelle'
import { filtern } from '../../shared/filter.js'
import { zeileAusLead, sortiere } from '../utils/zeile'
import { standardSpalten, spaltenAus } from '../../shared/spalten.js'
import { Angabe, Angaben } from '../components/Formular'

// Der Termin, der den Closer angeht.
//
// Seit dem Umbau gibt es zwei: das Beratungsgespraech des Setters und das
// Abschlussgespraech. Im Closing zaehlt das zweite. Bestandsdaten von vor dem
// Umbau haben nur das erste - dort war es der Termin des Closers, also gilt
// es weiter. Deshalb Abschluss zuerst, Beratung als Rueckfall.
function closerTermin(lead) {
  return lead?.termin_abschlussgespraech || lead?.terminDatum || null
}

/* closerTermin faellt auf das Beratungsgespraech zurueck, wenn noch kein
   Abschlussgespraech gelegt ist - fuer Sortierung und Bewerbung ist das
   richtig. Unter der festen Ueberschrift "Abschlussgespraech" wurde daraus
   aber eine Falschaussage: Am 06.10.2026 sah ein Kontakt, der im Setter-Pool
   lag und nur ein Beratungsgespraech hatte, wie ein gelegtes
   Abschlussgespraech aus. Hier steht, um welchen Termin es wirklich geht. */
function terminBezeichnung(lead) {
  return lead?.termin_abschlussgespraech ? 'Abschlussgespräch' : 'Beratungsgespräch'
}
import {
  Calendar,
  ClipboardList,
  History,
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
  File,
  Video
} from 'lucide-react'

// Paket-Optionen für Angebot
const PRODUKT_OPTIONS = [
  { value: 'fokus', label: 'Fokus' },
  { value: 'wachstum', label: 'Wachstum' },
  { value: 'wachstum & Website', label: 'Wachstum & Website' },
  { value: 'KI-Chatbot', label: 'KI-Chatbot' },
  { value: 'KI-Voicebot', label: 'KI-Voicebot' },
  { value: 'SEO & KI-Chatbot', label: 'SEO & KI-Chatbot' },
  { value: 'Website & KI-Chatbot', label: 'Website & KI-Chatbot' },
  { value: 'KI-Voicebot & KI-Chatbot', label: 'KI-Voicebot & KI-Chatbot' },
  { value: 'Website & KI-Voicebot & KI-Chatbot', label: 'Website & KI-Voicebot & KI-Chatbot' },
  { value: 'SEO & KI-Voicebot & KI-Chatbot', label: 'SEO & KI-Voicebot & KI-Chatbot' },
  { value: 'Individuell', label: 'Individuell' },
]

// Preise pro Produkt (leer = manuell eingeben)
const PRODUKT_PREISE = {
  'fokus':                                { setup: 3998, retainer: 399 },
  'wachstum':                             { setup: 5997, retainer: 699 },
  'wachstum & Website':                   { setup: 14999, retainer: 1499 },
  'KI-Chatbot':                         { setup: 1399, retainer: 360 },
  'KI-Voicebot':                        { setup: 1399, retainer: 360 },
  'SEO & KI-Chatbot':                   { setup: 2798, retainer: 360 },
  'Website & KI-Chatbot':               { setup: 3998, retainer: 360 },
  'KI-Voicebot & KI-Chatbot':           { setup: 2798, retainer: 612 },
  'Website & KI-Voicebot & KI-Chatbot': { setup: 5397, retainer: 612 },
  'SEO & KI-Voicebot & KI-Chatbot':     { setup: 4197, retainer: 612 },
  'Individuell':                        { setup: '', retainer: '' },
}

// Produkte die Website-Setup-Feld benötigen
const PRODUKTE_MIT_WEBSITE_SETUP = [
  'wachstum & Website',
  'Website & KI-Chatbot',
  'Website & KI-Voicebot & KI-Chatbot',
]

// Standard-Vertragsbestandteile (dynamisch mit Laufzeit)
// Bei laufzeit=0: reine Einmalzahlung, keine Vertragslaufzeit-Klausel und
// keine Auto-Verlängerung.
const DEFAULT_VERTRAGSBESTANDTEILE = (laufzeit = 12) => {
  const l = parseInt(laufzeit) || 0
  if (l <= 0) {
    return `* Alle Preise verstehen sich zzgl. 19 % Umsatzsteuer. Die Abrechnung der einmaligen Leistungen erfolgt bei Auftragserteilung.`
  }
  return `* Alle Preise verstehen sich zzgl. 19 % Umsatzsteuer und basieren auf einer Vertragslaufzeit von ${l} ${l === 1 ? 'Monat' : 'Monaten'}. Die Abrechnung der einmaligen Leistungen erfolgt bei Auftragserteilung. Die Abrechnung der regelmäßigen Leistungen erfolgt monatlich im Voraus. Der Vertrag verlängert sich automatisch um jeweils 3 Monate, wenn er nicht mit einer Frist von 3 Monaten zum Laufzeitende in Textform gekündigt wird. Das Recht zur außerordentlichen Kündigung bleibt unberührt.`
}

// Textbausteine zum Kopieren
const TEXTBAUSTEINE = [
  'Die ersten zwei Monate sind kostenfrei; die Abrechnung der regelmäßigen Leistungen beginnt ab dem dritten Monat der Vertragslaufzeit.',
  'Der Vertragsbeginn ist der [DATUM]. Die Vertragslaufzeit beginnt ab diesem Datum.',
  'Die Setup-Gebühr wird in zwei Raten abgerechnet: 50 % bei Auftragserteilung, 50 % nach Livegang.',
]

// Optik und Beschriftung aller Status. Welche davon im Closing überhaupt
// vorkommen, sagt shared/status.js - die Beratungs-Status gehören ins Setting
// und standen hier nur im Weg. Die Liste bleibt vollständig, damit ein
// Altdatensatz mit einem Setting-Status seine Farbe behält.
const STATUS_OPTIONS = [
  { value: STATUS.BERATUNG_VEREINBART,  label: 'Beratungsgespräch vereinbart', color: 'bg-blue-100 text-blue-700' },
  { value: STATUS.BERATUNG_GEFUEHRT,    label: 'Beratungsgespräch geführt',    color: 'bg-sky-100 text-sky-700' },
  { value: STATUS.ABSCHLUSS_VEREINBART, label: 'Abschlussgespräch vereinbart', color: 'bg-cyan-100 text-cyan-700' },
  { value: STATUS.IM_ABSCHLUSS,         label: 'Im Abschluss',                 color: 'bg-indigo-100 text-indigo-700' },
  { value: STATUS.NICHT_ERSCHIENEN,     label: 'Nicht erschienen',             color: 'bg-rose-100 text-rose-700' },
  { value: STATUS.ANGEBOT_ANGEFORDERT,  label: anzeigeName(STATUS.ANGEBOT_ANGEFORDERT), color: 'bg-yellow-100 text-yellow-700' },
  { value: STATUS.ANGEBOT_VERSCHICKT,   label: anzeigeName(STATUS.ANGEBOT_VERSCHICKT),  color: 'bg-secondary-container text-primary' },
  { value: STATUS.WIRD_NACHGEFASST,     label: 'Wird nachgefasst',             color: 'bg-amber-100 text-amber-700' },
  { value: STATUS.ANGEBOT_UNTERSCHRIEBEN, label: 'Angebot unterschrieben',     color: 'bg-success-container text-success' },
  { value: STATUS.GEWONNEN,             label: 'Gewonnen',                     color: 'bg-green-100 text-green-700' },
  { value: STATUS.TERMIN_ABGESAGT,      label: 'Termin abgesagt',              color: 'bg-orange-100 text-orange-700' },
  { value: STATUS.VERLOREN_WIEDERVORLAGE, label: 'Verloren, wiedervorlagefähig', color: 'bg-teal-100 text-teal-700' },
  { value: STATUS.VERLOREN_ENDGUELTIG,  label: 'Verloren, endgültig',          color: 'bg-red-100 text-red-700' }
]

// Was im Closing zur Wahl steht: die Status dieser Stufe, ohne "Angebot" -
// das setzt die Angebots-Automatisierung selbst. Ein Beratungsgespräch lässt
// sich hier nicht mehr setzen; es ist Sache des Settings.
const CLOSING_STATUS = statusFuerStufe(STUFE.CLOSING)
const SELECTABLE_STATUS_OPTIONS = STATUS_OPTIONS
  .filter(opt => CLOSING_STATUS.includes(opt.value) && opt.value !== STATUS.ANGEBOT_ANGEFORDERT)

// "Gewonnen" loest die Rechnung aus und steht deshalb nur der Leitung offen.
// Der Vertrieb schliesst mit "Angebot unterschrieben" ab; den Rest hebt die
// Leitung. Der Server prueft dasselbe noch einmal - hier geht es nur darum,
// niemandem einen Knopf hinzustellen, der ohnehin abgewiesen wird.
/** Beide Wege bedeuten: Der Vertrag ist unter Dach und Fach. */
const schliesstAb = (status) =>
  status === STATUS.ANGEBOT_UNTERSCHRIEBEN || status === STATUS.GEWONNEN

const statusZurWahl = (istLeitung) =>
  istLeitung ? SELECTABLE_STATUS_OPTIONS
             : SELECTABLE_STATUS_OPTIONS.filter(o => !statusBrauchtLeitung(o.value))

function Closing() {
  const meldung = useMeldung()
  const { user, isAdmin, isCloser, isGeschaeftsfuehrer } = useAuth()
  const location = useLocation()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedLead, setSelectedLead] = useState(null)
  const [editMode, setEditMode] = useState(false)
  // Ohne E-Mail geht weder Angebot noch Nachfassen raus - dieselbe Sperre wie
  // im Setting, damit dieselbe Maske überall gleich streng ist.
  const [mailFehlt, setMailFehlt] = useState(false)
  const tabelle = useTabelle('closing')
  // Sortiert wird über die ganze Liste, nicht nur über die sichtbare Seite.
  const [sortierung, setSortierung] = useState({ spalte: null, ab: false })
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState('own') // 'own', 'all' (für Admins), oder 'pool'
  
  // Pool-State
  const [poolLeads, setPoolLeads] = useState([])
  const [loadingPool, setLoadingPool] = useState(false)
  const [claimingLead, setClaimingLead] = useState(null)
  
  // Abschluss-Modal State
  const [showAbschlussForm, setShowAbschlussForm] = useState(false)
  // Womit der Abschluss endet: "Angebot unterschrieben" beim Vertrieb,
  // "Gewonnen", wenn die Leitung gleich abrechnet.
  const [abschlussZiel, setAbschlussZiel] = useState(STATUS.ANGEBOT_UNTERSCHRIEBEN)

  // Angebot-View State (innerhalb des Modals)
  const [showAngebotView, setShowAngebotView] = useState(false)
  const [angebotData, setAngebotData] = useState({
    produkt: '',
    setup: '',
    retainer: '',
    websiteSetup: '',        // Separater Setup-Betrag für Website-Komponente
    laufzeit: 12,            // Default 12 Monate
    vertragsbestandteile: DEFAULT_VERTRAGSBESTANDTEILE(12),
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
  
  
  // Datei-Upload State
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  // Hot-Lead-Bewerbung State
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [applyingLead, setApplyingLead] = useState(null)
  const [applyKommentar, setApplyKommentar] = useState('')
  const [submittingApplication, setSubmittingApplication] = useState(false)
  const [selectedPoolLead, setSelectedPoolLead] = useState(null)

  // No-Show Modal State
  const [showNoShowModal, setShowNoShowModal] = useState(false)
  const [noShowProcessing, setNoShowProcessing] = useState(false)
  // Closer will den Lead selbst weiter betreuen, kein automatisches Setter-Re-Engagement
  const [noShowKeepInClosing, setNoShowKeepInClosing] = useState(false)

  // SEO-Analyse State
  const [seoAnalysisLoading, setSeoAnalysisLoading] = useState({})

  const LEADS_PER_PAGE = 10

  // Alle kurzen Meldungen laufen über dasselbe Bauteil (components/Meldungen).
  // Der Name bleibt, damit die zwei Dutzend Aufrufe unverändert bleiben.
  const showToast = (type, message) => {
    if (type === 'success') meldung.erfolg(message)
    else if (type === 'error') meldung.fehler(message)
    else meldung.hinweis(message)
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

      // Upload zu Supabase Storage
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
      // Aus Storage löschen (Supabase oder legacy Cloudinary)
      if (attachment.id) {
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

  // Produkt-Auswahl Handler – füllt Setup/Retainer automatisch aus Preistabelle
  const handleProduktChange = (produktValue) => {
    const preise = PRODUKT_PREISE[produktValue] || { setup: '', retainer: '' }
    setAngebotData(prev => ({
      ...prev,
      produkt: produktValue,
      setup: preise.setup,
      retainer: preise.retainer,
      websiteSetup: '', // Reset bei Produktwechsel
      paketname: '',
      kurzbeschreibung: '',
      leistungsbeschreibung: '',
    }))
  }

  // Laufzeit-Handler – aktualisiert auch den Vertragstext automatisch
  //
  // Wechsel zwischen "mit Laufzeit" ↔ "Einmalzahlung" verändert die Text-
  // Struktur (Vertragslaufzeit-Klausel und Auto-Verlängerung fallen weg).
  // In diesen Fällen wird der Vertragstext auf den passenden Default
  // zurückgesetzt. Bei reinem Wechsel innerhalb "mit Laufzeit" (z.B. 12→24)
  // wird nur die Zahl im bestehenden Text ersetzt, damit ggf. individuelle
  // Änderungen erhalten bleiben.
  const handleLaufzeitChange = (newLaufzeit) => {
    setAngebotData(prev => {
      const prevL = parseInt(prev.laufzeit) || 0
      const nextL = parseInt(newLaufzeit) || 0
      const wechselStruktur = (prevL === 0) !== (nextL === 0)

      let updatedText
      if (wechselStruktur) {
        updatedText = DEFAULT_VERTRAGSBESTANDTEILE(nextL)
      } else if (nextL === 0) {
        updatedText = prev.vertragsbestandteile
      } else {
        updatedText = prev.vertragsbestandteile.replace(
          /Vertragslaufzeit von \d+ Monat(en)?/,
          `Vertragslaufzeit von ${nextL} ${nextL === 1 ? 'Monat' : 'Monaten'}`
        )
      }
      return { ...prev, laufzeit: nextL, vertragsbestandteile: updatedText }
    })
  }

  // SEO-Analyse starten (nur für Closer und Admins)
  const handleStartSeoAnalysis = async (lead) => {
    if (!lead.website) {
      showToast('error', 'Keine Website-URL vorhanden')
      return
    }

    // Stadt ist Pflicht - SEO-Tool validiert min_length: 1
    const stadt = (lead.ort || '').trim()
    if (!stadt) {
      // Wenn User die Stadt im edit-Feld eingetragen aber noch nicht gespeichert hat:
      const unsavedOrt = (editData.ort || '').trim()
      if (editMode && unsavedOrt) {
        showToast('error', 'Bitte zuerst "Speichern" klicken - die eingetragene Stadt ist noch nicht in der Datenbank.')
      } else {
        showToast('error', 'Bitte zuerst die Stadt beim Lead ergänzen - die SEO-Analyse braucht sie für lokale Rankings.')
      }
      return
    }

    setSeoAnalysisLoading(prev => ({ ...prev, [lead.id]: true }))

    try {
      const response = await fetch('/.netlify/functions/seo-analysis-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotLeadId: lead.id,
          websiteUrl: lead.website,
          firmenname: lead.unternehmen || lead.firmenname,
          stadt: stadt,
          // Steuert das Keyword-Set im SEO-Tool: Makler-Kategorien liefern
          // Eigentuemer-Keywords, Sachverstaendigen-Kategorien die
          // Gutachten-Keywords.
          kategorie: lead.kategorie
        })
      })

      if (!response.ok) {
        // Echten Fehler-Body auslesen und im Toast anzeigen
        let detail = `HTTP ${response.status}`
        try {
          const errBody = await response.json()
          detail = errBody.message || errBody.error || detail
        } catch (_) { /* Body war kein JSON */ }
        throw new Error(detail)
      }

      showToast('success', 'SEO-Analyse gestartet - Bericht wird in Kürze bei den Dokumenten angezeigt')
    } catch (error) {
      console.error('SEO Analysis Error:', error)
      showToast('error', `SEO-Analyse fehlgeschlagen: ${error.message}`)
    } finally {
      setSeoAnalysisLoading(prev => ({ ...prev, [lead.id]: false }))
    }
  }

  // Angebot absenden
  const handleSendAngebot = async () => {
    if (!selectedLead) return

    // Setup und Retainer dürfen explizit 0 sein (z.B. reine Einmalzahlung
    // oder reiner Retainer-Deal ohne Setup). Nur null/undefined/leerer
    // String zählt als "nicht ausgefüllt". Mindestens EIN Wert muss
    // ausgefüllt sein, damit ein Angebot Sinn hat.
    const isFilled = (v) => v !== null && v !== undefined && v !== ''
    if (!isFilled(angebotData.setup) && !isFilled(angebotData.retainer)) {
      showToast('error', 'Bitte Setup oder Retainer angeben (0 ist erlaubt)')
      return
    }

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
        setup: parseFloat(angebotData.setup) || 0,
        retainer: parseFloat(angebotData.retainer) || 0,
        laufzeit: (() => { const n = parseInt(angebotData.laufzeit); return isNaN(n) ? 12 : n })(),
        produktDienstleistung: angebotData.produkt ? [angebotData.produkt] : [],
        vertragsbestandteile: angebotData.vertragsbestandteile,
        // Signal an die externe Angebots-Automatisierung; sie meldet mit
        // "Angebot versendet" zurueck. Wert bleibt woertlich.
        status: STATUS.ANGEBOT_ANGEFORDERT
      }

      // Website-Setup nur bei Website-Produkten
      if (PRODUKTE_MIT_WEBSITE_SETUP.includes(angebotData.produkt) && angebotData.websiteSetup) {
        updates.websiteSetup = parseFloat(angebotData.websiteSetup)
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
        const websiteSetupInfo = angebotData.websiteSetup ? `, Website-Setup ${angebotData.websiteSetup}€` : ''
        const setupText = parseFloat(angebotData.setup) || 0
        const retainerText = parseFloat(angebotData.retainer) || 0
        const laufzeitNum = parseInt(angebotData.laufzeit) || 0
        const laufzeitInfo = laufzeitNum === 0 ? 'Einmalzahlung' : `Laufzeit ${laufzeitNum} Monate`
        const kommentarText = `Angebot versendet - ${produktInfo}: Setup ${setupText}€${websiteSetupInfo}, Retainer ${retainerText}€/Mon, ${laufzeitInfo}`
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
              websiteSetup: angebotData.websiteSetup ? parseFloat(angebotData.websiteSetup) : 0,
              laufzeit: (() => { const n = parseInt(angebotData.laufzeit); return isNaN(n) ? 12 : n })(),
              produktDienstleistung: angebotData.produkt ? [angebotData.produkt] : [],
              vertragsbestandteile: angebotData.vertragsbestandteile,
              status: STATUS.ANGEBOT_ANGEFORDERT
            }
          : lead
      ))

      // Selected Lead auch aktualisieren
      setSelectedLead(prev => ({
        ...prev,
        setup: parseFloat(angebotData.setup) || 0,
        retainer: parseFloat(angebotData.retainer) || 0,
        websiteSetup: angebotData.websiteSetup ? parseFloat(angebotData.websiteSetup) : 0,
        laufzeit: (() => { const n = parseInt(angebotData.laufzeit); return isNaN(n) ? 12 : n })(),
        produktDienstleistung: angebotData.produkt ? [angebotData.produkt] : [],
        vertragsbestandteile: angebotData.vertragsbestandteile,
        status: STATUS.ANGEBOT_ANGEFORDERT
      }))

      // Zapier-Webhook wird jetzt serverseitig in hot-leads.js gesendet (CORS-frei)

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

  // Auto-Refresh alle 30 Sekunden (für Zapier-Updates wie "Angebot versendet")
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      // Nur refreshen wenn kein Modal offen ist
      if (!selectedLead && !showAngebotView) {
        console.log('[Closing] Auto-Refresh für Status-Updates')
        if (viewMode === 'pool') {
          loadPoolLeads()
        } else {
          loadLeads()
        }
      }
    }, 30000) // 30 Sekunden

    return () => clearInterval(interval)
  }, [user, viewMode, selectedLead, showAngebotView])

  // Pool-Anzahl initial laden (für Badge)
  useEffect(() => {
    if (user) {
      loadPoolCount()
    }
  }, [user])

  // Lead öffnen wenn von Termine-Seite navigiert
  useEffect(() => {
    const openLeadId = location.state?.openLeadId
    if (openLeadId && leads.length > 0 && !loading) {
      const leadToOpen = leads.find(l => l.id === openLeadId)
      if (leadToOpen) {
        setSelectedLead(leadToOpen)
        // State clearen damit es nicht bei jedem Re-render öffnet
        window.history.replaceState({}, document.title)
      }
    }
  }, [location.state?.openLeadId, leads, loading])

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
          const dateA = closerTermin(a) ? new Date(closerTermin(a)) : new Date(0)
          const dateB = closerTermin(b) ? new Date(closerTermin(b)) : new Date(0)
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

  // Bewerbungs-Modal öffnen (ersetzt direktes Übernehmen)
  const startApplyForLead = (lead) => {
    setApplyingLead(lead)
    setApplyKommentar('')
    setShowApplyModal(true)
  }

  // Bewerbung absenden
  const submitApplication = async () => {
    if (!user || !applyingLead) return

    try {
      setSubmittingApplication(true)

      const response = await fetch('/.netlify/functions/hot-lead-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Wer sich bewirbt, kommt serverseitig aus dem Token. Die Stufe
          // sagt, worauf: hier das Abschlussgespräch.
          stufe: 'Closer',
          hotLeadId: applyingLead.id,
          kommentar: applyKommentar.trim() || null
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        showToast('success', data.direkt
          ? `${applyingLead.unternehmen} übernommen.`
          : `Bewerbung für ${applyingLead.unternehmen} eingereicht! Ein Admin wird diese prüfen.`)
        setShowApplyModal(false)
        setApplyingLead(null)
        setApplyKommentar('')
      } else {
        throw new Error(data.error || 'Fehler bei der Bewerbung')
      }
    } catch (err) {
      console.error('Bewerbung fehlgeschlagen:', err)
      showToast('error', err.message)
    } finally {
      setSubmittingApplication(false)
    }
  }

  // Nach der Freigabe: Die Kollegen erfahren davon, und die Ansicht raeumt auf.
  // Das Umhaengen selbst macht LeadFreigabe - hier steht nur noch, was danach
  // im Closing passieren soll.
  const nachFreigabe = async (grund) => {
    const userName = user?.vor_nachname || user?.name || 'Closer'
    const lead = selectedLead

    try {
      await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify-closers-release',
          termin: {
            datum: lead?.terminDatum ? new Date(lead.terminDatum).toLocaleDateString('de-DE', {
              weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
              timeZone: 'Europe/Berlin'   // immer deutsche Zeit
            }) : 'Nicht festgelegt',
            art: lead?.terminart || 'Unbekannt',
            unternehmen: lead?.unternehmen,
            ansprechpartner: [lead?.ansprechpartnerVorname, lead?.ansprechpartnerNachname]
              .filter(Boolean).join(' ') || '',
            releasedBy: userName,
            releaseReason: grund || 'Keine Angabe'
          }
        })
      })
    } catch (emailErr) {
      // Kein harter Fehler: Der Kontakt liegt bereits im Pool.
      console.error('Closer-Benachrichtigung fehlgeschlagen:', emailErr)
    }

    setReleaseReason('')
    setSelectedLead(null)
    loadPoolCount()
    if (viewMode === 'own') loadLeads()
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

  // Der Setter übergibt, der Closer schickt die Bestätigungsmail mit dem VSL.
  // Solange sie nicht draußen ist, ist sie der Anlass des Mailfensters; danach
  // ist es eine gewöhnliche Mail oder, beim Nachfassen, das Toolkit.
  const bestaetigungOffen = (lead) => {
    if (lead?.status !== STATUS.ABSCHLUSS_VEREINBART) return false
    const versendet = Array.isArray(lead.material_versendet) ? lead.material_versendet : []
    return !versendet.some(m => /bestätigung|bestaetigung/i.test(String(m)))
  }

  const mailAnlass = (lead) =>
    lead?.status === STATUS.WIRD_NACHGEFASST ? 'nachfassen'
      : bestaetigungOffen(lead) ? 'setting'
        : null

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

  // Der Statusfilter zeigt die Status dieser Stufe - und dazu, was im Bestand
  // wirklich vorkommt. Bestandsdaten von vor dem Umbau tragen noch einen
  // Beratungs-Status, obwohl der Closer sie hält; sie sollen filterbar
  // bleiben, auch wenn sich der Status hier nicht mehr setzen lässt.
  const filterStatusOptionen = (() => {
    const vorhanden = new Set(leads.map(l => l.status).filter(Boolean))
    return STATUS_OPTIONS
      .filter(opt => CLOSING_STATUS.includes(opt.value) || vorhanden.has(opt.value))
      // Beschriftet wie in der Liste: im Closing heisst ein Beratungs-Status
      // der Altkontakte "Termin vereinbart".
      .map(opt => ({ ...opt, label: anzeigeName(opt.value, STUFE.CLOSING) }))
  })()

  const filteredLeads = getFilteredLeads()
  // Erst in Zeilen übersetzen, dann die eigenen Filter des Benutzers - sie
  // arbeiten auf denselben Namen wie die Spalten.
  const alleZeilen = filteredLeads.map(l => zeileAusLead('closing', l))
  const gefilterteZeilen = (() => {
    const gefiltert = filtern(alleZeilen, tabelle.filter, 'closing')
    const spalte = spaltenAus('closing', tabelle.spalten)
      .find(x => x.schluessel === sortierung.spalte)
    return spalte ? sortiere(gefiltert, spalte, sortierung.ab) : gefiltert
  })()
  const totalPages = Math.max(1, Math.ceil(gefilterteZeilen.length / LEADS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * LEADS_PER_PAGE
  const paginatedLeads = gefilterteZeilen.slice(startIndex, startIndex + LEADS_PER_PAGE)

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
      neuerKommentar: '',  // Für neuen manuellen Kommentar
      terminDatum: closerTermin(lead) || '',  // Für manuelles Verschieben im CRM
      // Kontaktdaten (editierbar)
      anrede: lead.anrede || '',
      ansprechpartnerVorname: lead.ansprechpartnerVorname || '',
      ansprechpartnerNachname: lead.ansprechpartnerNachname || '',
      email: lead.email || '',
      telefon: lead.telefon || '',
      website: lead.website || '',
      ort: lead.ort || ''
    })
    setEditMode(false); setMailFehlt(false)
  }

  const closeModal = () => {
    setSelectedLead(null)
    setEditMode(false); setMailFehlt(false)
    setEditData({})
    setShowAngebotView(false)
    setAngebotData({
      produkt: '',
      setup: '',
      retainer: '',
      websiteSetup: '',
      laufzeit: 12,
      vertragsbestandteile: DEFAULT_VERTRAGSBESTANDTEILE(12),
      paketname: '',
      kurzbeschreibung: '',
      leistungsbeschreibung: ''
    })
    setAngebotSuccess(false)
    setShowEmailComposer(false)
    setShowTerminPicker(false)
    setShowAbschlussForm(false)
    setShowReleaseConfirm(false)
    setReleaseReason('')
  }

  const handleEditChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!selectedLead) return
    // Dieselbe Regel wie in Opening und Setting: Eine vorhandene Adresse
    // darf nicht geleert werden.
    if (selectedLead.email && !editData.email?.trim()) { setMailFehlt(true); return }

    // Status ist optional - Kommentare können auch ohne Status-Änderung gespeichert werden
    const hasStatusChange = editData.status && editData.status !== selectedLead.status
    const hasNeuerKommentar = editData.neuerKommentar && editData.neuerKommentar.trim()
    const hasTerminChange = editData.terminDatum && editData.terminDatum !== closerTermin(selectedLead)

    // Kontaktdaten-Änderungen prüfen
    const hasContactChange =
      editData.ansprechpartnerVorname !== selectedLead.ansprechpartnerVorname ||
      editData.ansprechpartnerNachname !== selectedLead.ansprechpartnerNachname ||
      editData.email !== selectedLead.email ||
      editData.telefon !== selectedLead.telefon ||
      editData.website !== selectedLead.website ||
      editData.ort !== selectedLead.ort

    const hasRollenChange = ['openerName', 'setterName', 'closerName'].some(
      f => editData[f] !== undefined && editData[f] !== (selectedLead[f] || ''))

    if (!hasStatusChange && !hasNeuerKommentar && !hasTerminChange && !hasContactChange
        && !hasRollenChange) {
      setEditMode(false); setMailFehlt(false)
      return // Nichts zu speichern
    }

    // Der Abschluss wird erfasst, bevor der Status steht - egal auf welchem
    // der beiden Wege. Der Vertrieb waehlt "Angebot unterschrieben", die
    // Leitung darf auch direkt "Gewonnen" setzen; beide Male sollen dieselben
    // Vertragsdaten erhoben werden.
    if (schliesstAb(editData.status) && !schliesstAb(selectedLead.status)) {
      setAbschlussZiel(editData.status)
      setShowAbschlussForm(true)
      return
    }

    // NEU: Wenn Status auf "Nicht erschienen" wechselt -> erst No-Show-Modal zeigen
    if (editData.status === STATUS.NICHT_ERSCHIENEN && selectedLead.status !== STATUS.NICHT_ERSCHIENEN) {
      setNoShowKeepInClosing(false)  // Default: Setter wird benachrichtigt (wie bisher)
      setShowNoShowModal(true)
      return
    }

    // Normale Speicherung (ohne Abschluss-Modal)
    await doSave(editData)
  }

  // Handler für Abschluss-Modal Submit
  const handleAbschlussSubmit = async (billingData) => {
    setShowAbschlussForm(false)
    await doSave({ ...editData, ...billingData })
  }

  // Handler für Abschluss-Form Abbrechen
  const handleAbschlussCancel = () => {
    setShowAbschlussForm(false)
    // Status zurücksetzen auf alten Wert
    setEditData(prev => ({ ...prev, status: selectedLead.status }))
  }

  // Handler für No-Show-Modal Bestätigung
  const handleNoShowConfirm = async () => {
    if (!selectedLead || !user) return

    setNoShowProcessing(true)
    try {
      const currentNoShowCount = selectedLead.no_show_count || 0
      const newNoShowCount = currentNoShowCount + 1

      // Hot Lead mit No-Show-Daten updaten
      const response = await fetch('/.netlify/functions/hot-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotLeadId: selectedLead.id,
          updates: {
            status: STATUS.NICHT_ERSCHIENEN,
            no_show_count: newNoShowCount,
            no_show_marked_at: new Date().toISOString(),
            no_show_marked_by: user.id,
            no_show_keep_in_closing: noShowKeepInClosing,
            // Zurueck an den Setter, der den Termin gelegt hat - spiegelbildlich
            // zum Beratungsgespraech, das an den Opener zurueckgeht. Nur wenn
            // der Closer sagt, er kuemmert sich selbst, bleibt es bei ihm.
            ...(noShowKeepInClosing ? {} : { closerName: '' })
          }
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Fehler beim Speichern')
      }

      // Notification an Setter nur senden wenn der Closer NICHT selbst weiter macht
      if (selectedLead.setterId && !noShowKeepInClosing) {
        try {
          await fetch('/.netlify/functions/notify-no-show', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              hotLeadId: selectedLead.id,
              setterId: selectedLead.setterId,
              closerId: user.id,
              closerName: user.vor_nachname || user.name,
              unternehmen: selectedLead.unternehmen,
              ansprechpartner: `${selectedLead.ansprechpartnerVorname || ''} ${selectedLead.ansprechpartnerNachname || ''}`.trim(),
              terminDatum: selectedLead.terminDatum,
              noShowCount: newNoShowCount
            })
          })
        } catch (notifyErr) {
          console.warn('No-Show Notification fehlgeschlagen:', notifyErr)
        }
      }

      // Kommentar in Original-Lead hinzufügen
      if (selectedLead.originalLeadId) {
        const userName = user?.vor_nachname || user?.name || 'Closer'
        try {
          await fetch('/.netlify/functions/leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId: selectedLead.originalLeadId,
              updates: {},
              historyEntry: {
                action: 'status',
                details: `Status: Nicht erschienen (${newNoShowCount}. No-Show)`,
                userName: userName
              }
            })
          })
        } catch (e) {
          console.warn('Kommentar-Update fehlgeschlagen:', e)
        }
      }

      // UI updaten
      setShowNoShowModal(false)
      setEditMode(false); setMailFehlt(false)

      // Lead in lokaler Liste aktualisieren
      setLeads(prev => prev.map(l =>
        l.id === selectedLead.id
          ? { ...l, status: STATUS.NICHT_ERSCHIENEN, no_show_count: newNoShowCount, no_show_marked_at: new Date().toISOString(), no_show_keep_in_closing: noShowKeepInClosing }
          : l
      ))
      setSelectedLead(prev => prev ? { ...prev, status: STATUS.NICHT_ERSCHIENEN, no_show_count: newNoShowCount, no_show_marked_at: new Date().toISOString(), no_show_keep_in_closing: noShowKeepInClosing } : null)

      const toastMsg = noShowKeepInClosing
        ? 'Lead als nicht erschienen markiert. Du betreust ihn selbst weiter.'
        : `Lead als nicht erschienen markiert. ${selectedLead.setterName ? `${selectedLead.setterName} wurde benachrichtigt.` : 'Kein Setter zugeordnet.'}`
      showToast('success', toastMsg)
    } catch (err) {
      console.error('No-Show Fehler:', err)
      showToast('error', err.message)
    } finally {
      setNoShowProcessing(false)
    }
  }

  // Handler für No-Show-Modal Abbrechen
  const handleNoShowCancel = () => {
    setShowNoShowModal(false)
    setEditData(prev => ({ ...prev, status: selectedLead.status }))
  }

  // Handler für No-Show → direkt auf Verloren setzen
  const handleNoShowToLost = async () => {
    setShowNoShowModal(false)
    // Endgueltig verloren. Die Wiedervorlage-Variante braucht ein Datum und
    // einen Anlass - die kommt mit dem Wiedervorlage-Wecker (Ticket 13).
    setEditData(prev => ({ ...prev, status: STATUS.VERLOREN_ENDGUELTIG }))
    await doSave({ ...editData, status: STATUS.VERLOREN_ENDGUELTIG })
  }

  // Interne Save-Funktion (früher handleSave)
  const doSave = async (data) => {
    if (!selectedLead) return

    const hasStatusChange = data.status && data.status !== selectedLead.status
    const hasNeuerKommentar = data.neuerKommentar && data.neuerKommentar.trim()
    const hasTerminChange = data.terminDatum && data.terminDatum !== closerTermin(selectedLead)
    const hasBillingData = data.rechnung_firma || data.rechnung_strasse

    try {
      setSaving(true)

      // Hot Lead Updates sammeln (inkl. Billing-Daten bei Abschluss)
      const hotLeadUpdates = {}
      if (hasStatusChange) hotLeadUpdates.status = data.status
      // Wiedervorlagefähig heißt: mit Datum und Grund. Ohne beides weckt den
      // Kontakt niemand, und keiner weiß später, warum er ruhte (Teil C).
      if (hasStatusChange && data.status === STATUS.VERLOREN_WIEDERVORLAGE) {
        hotLeadUpdates.wiedervorlage_am = data.wiedervorlage_am || null
        hotLeadUpdates.verlust_grund = data.verlust_grund || null
      }
      if (hasTerminChange) {
        if (selectedLead.termin_abschlussgespraech) {
          hotLeadUpdates.termin_abschlussgespraech = data.terminDatum
        } else {
          hotLeadUpdates.terminDatum = data.terminDatum
        }
      }

      /* Zuteilungen. Der Server loest den Namen zur Benutzer-ID auf und
         prueft dabei, ob der Angemeldete sie setzen darf - fuer fremde
         Zuteilungen ist das nur die Leitung (utils/zugriff.js). Leer heisst
         „niemand", also zurueck in den Pool. */
      for (const feld of ['openerName', 'setterName', 'closerName']) {
        if (data[feld] !== undefined && data[feld] !== (selectedLead[feld] || '')) {
          hotLeadUpdates[feld] = data[feld]
        }
      }

      // Kontaktdaten-Updates - immer mitsenden wenn im Edit-Mode
      /* Die Anrede gehoert dazu: Calendly fragt sie beim Buchen des
         Abschlussgespraechs als Pflichtfeld ab. */
      if (data.anrede !== undefined) {
        hotLeadUpdates.anrede = data.anrede
      }
      if (data.ansprechpartnerVorname !== undefined) {
        hotLeadUpdates.ansprechpartner_vorname = data.ansprechpartnerVorname
      }
      if (data.ansprechpartnerNachname !== undefined) {
        hotLeadUpdates.ansprechpartner_nachname = data.ansprechpartnerNachname
      }
      if (data.email !== undefined) {
        hotLeadUpdates.mail = data.email
      }
      if (data.telefon !== undefined) {
        hotLeadUpdates.telefonnummer = data.telefon
      }
      if (data.website !== undefined) {
        hotLeadUpdates.website = data.website
      }
      if (data.ort !== undefined) {
        hotLeadUpdates.ort = data.ort
      }

      // AUTOMATIK: Setter setzt neuen Termin bei "Nicht erschienen" → Status zurück auf "Im Closing"
      const isUserSetter = selectedLead.setterId === user?.id
      const isNoShowStatus = selectedLead.status === STATUS.NICHT_ERSCHIENEN
      if (isUserSetter && isNoShowStatus && hasTerminChange && !hasStatusChange) {
        hotLeadUpdates.status = STATUS.IM_ABSCHLUSS

        // Notification an Closer über Re-Termin
        if (selectedLead.closerId && selectedLead.closerId !== user?.id) {
          try {
            const terminFormatted = new Date(data.terminDatum).toLocaleString('de-DE', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
            })

            await fetch('/.netlify/functions/system-messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                empfaengerId: selectedLead.closerId,
                typ: 'no_show_rescheduled',
                titel: `Neuer Termin gebucht: ${selectedLead.unternehmen}`,
                nachricht: `${user?.vor_nachname || user?.name} hat einen neuen Termin für ${selectedLead.unternehmen} am ${terminFormatted} vereinbart.`,
                hotLeadId: selectedLead.id
              })
            })
          } catch (notifyErr) {
            console.warn('Re-Termin Notification fehlgeschlagen:', notifyErr)
          }
        }
      }

      // Billing-Daten hinzufügen wenn vorhanden (bei Abschluss)
      if (hasBillingData) {
        // billing_mode: 'auto' oder leer → aus Setup/Retainer ableiten.
        // Explizite Wahl (provision_partner, manual_external, reference) hat Vorrang.
        // MUSS im selben PATCH wie status='Gewonnen' sein, damit der DB-Trigger
        // die Bridge mit dem korrekten Modus anstößt.
        const chosenMode = data.billing_mode
        const finalBillingMode = (chosenMode && chosenMode !== 'auto')
          ? chosenMode
          : deriveBillingMode(selectedLead?.setup, selectedLead?.retainer)

        Object.assign(hotLeadUpdates, {
          rechnung_anrede: data.rechnung_anrede,
          rechnung_firma: data.rechnung_firma,
          ansprechpartner_vorname: data.ansprechpartner_vorname,
          ansprechpartner_nachname: data.ansprechpartner_nachname,
          rechnung_email: data.rechnung_email,
          telefonnummer: data.telefonnummer,
          rechnung_strasse: data.rechnung_strasse,
          rechnung_zusatz: data.rechnung_zusatz,
          rechnung_plz: data.rechnung_plz,
          rechnung_ort: data.rechnung_ort,
          rechnung_land: data.rechnung_land,
          ust_id: data.ust_id,
          steuernummer: data.steuernummer,
          vertragsbeginn: data.vertragsbeginn,
          zahlungsziel_tage: data.zahlungsziel_tage,
          retainer_start_offset_months: data.retainer_start_offset_months,
          billing_mode: finalBillingMode,
          billing_notes: data.billing_notes,
        })
      }

      // Hot Lead updaten (Status und/oder Termin und/oder Billing)
      if (Object.keys(hotLeadUpdates).length > 0) {
        const response = await fetch('/.netlify/functions/hot-leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hotLeadId: selectedLead.id,
            updates: hotLeadUpdates
          })
        })

        const responseData = await response.json()

        if (response.status === 422 && responseData.error === 'billing_validation_failed') {
          const fieldList = (responseData.fields || []).join(', ')
          showToast('error', `Rechnungsdaten unvollständig: ${fieldList}`)
          return
        }

        if (!response.ok) {
          showToast('error', 'Fehler beim Speichern: ' + (responseData.error || 'Unbekannt'))
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
                  details: data.neuerKommentar.trim(),
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
            const statusText = data.status === STATUS.GEWONNEN
              ? 'Deal gewonnen ✅'
              : IST_VERLOREN.includes(data.status)
                ? 'Lead verloren ❌'
                : data.status === STATUS.TERMIN_ABGESAGT
                  ? 'Termin abgesagt ❌'
                  : hasTerminChange
                    ? 'Termin verschoben 🔄'
                    : `Status: ${anzeigeName(data.status)}`

            const statusResponse = await fetch('/.netlify/functions/leads', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                leadId: selectedLead.originalLeadId,
                updates: {},
                historyEntry: {
                  action: data.status === STATUS.GEWONNEN ? 'abgeschlossen' :
                          IST_VERLOREN.includes(data.status) ? 'verloren' :
                          data.status === STATUS.TERMIN_ABGESAGT ? 'termin_abgesagt' :
                          hasTerminChange ? 'termin_verschoben' : 'status_update',
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

            if (data.status === STATUS.TERMIN_ABGESAGT) {
              messageData = {
                empfaengerId: setterId,
                typ: 'Termin abgesagt',
                titel: `Termin abgesagt: ${unternehmen}`,
                nachricht: `Der Termin mit ${unternehmen}${terminDatum ? ` am ${terminDatum}` : ''} wurde abgesagt.`,
                hotLeadId: selectedLead.id
              }
            } else if (hasTerminChange && !hasStatusChange) {
              messageData = {
                empfaengerId: setterId,
                typ: 'Termin verschoben',
                titel: `Termin verschoben: ${unternehmen}`,
                nachricht: `Der Termin mit ${unternehmen}${terminDatum ? ` (ursprünglich ${terminDatum})` : ''} wurde verschoben. Ein neuer Termin wird vereinbart.`,
                hotLeadId: selectedLead.id
              }
            } else if (data.status === STATUS.GEWONNEN) {
              messageData = {
                empfaengerId: setterId,
                typ: 'Lead gewonnen',
                titel: `🎉 Deal gewonnen: ${unternehmen}`,
                nachricht: `Herzlichen Glückwunsch! Dein Lead "${unternehmen}" wurde erfolgreich abgeschlossen!`,
                hotLeadId: selectedLead.id
              }
            } else if (IST_VERLOREN.includes(data.status)) {
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
              console.log('System Message an Setter gesendet:', data.status, response.ok ? 'OK' : 'Fehler')
            }
          } catch (msgErr) {
            console.warn('System Message konnte nicht gesendet werden:', msgErr)
          }
        } else {
          console.log('Kein Setter für diesen Lead - keine System Message gesendet')
        }
      }

      // History-Eintrag für manuelles Termin-Verschieben
      if (hasTerminChange && selectedLead.originalLeadId) {
        const userName = user?.vor_nachname || user?.name || 'Closer'
        const neuesDatum = new Date(data.terminDatum).toLocaleDateString('de-DE', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Berlin'
        })

        try {
          await fetch('/.netlify/functions/leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId: selectedLead.originalLeadId,
              updates: {},
              historyEntry: {
                action: 'termin_manuell_verschoben',
                details: `Termin manuell verschoben auf ${neuesDatum} (nur CRM, ohne Calendly)`,
                userName: userName
              }
            })
          })
        } catch (histErr) {
          console.warn('History-Eintrag für Termin-Verschiebung fehlgeschlagen:', histErr)
        }
      }

      // Lokale Liste aktualisieren
      setLeads(prev => prev.map(l =>
        l.id === selectedLead.id
          ? {
              ...l,
              status: hasStatusChange ? data.status : l.status,
              kommentar: updatedKommentar,
              terminDatum: (hasTerminChange && !selectedLead.termin_abschlussgespraech)
                ? data.terminDatum : l.terminDatum,
              termin_abschlussgespraech: (hasTerminChange && selectedLead.termin_abschlussgespraech)
                ? data.terminDatum : l.termin_abschlussgespraech,
              // Kontaktdaten
              ansprechpartnerVorname: data.ansprechpartnerVorname ?? l.ansprechpartnerVorname,
              ansprechpartnerNachname: data.ansprechpartnerNachname ?? l.ansprechpartnerNachname,
              email: data.email ?? l.email,
              telefon: data.telefon ?? l.telefon,
              website: data.website ?? l.website,
              ort: data.ort ?? l.ort
            }
          : l
      ))
      setSelectedLead(prev => ({
        ...prev,
        status: hasStatusChange ? data.status : prev.status,
        kommentar: updatedKommentar,
        terminDatum: (hasTerminChange && !prev.termin_abschlussgespraech)
          ? data.terminDatum : prev.terminDatum,
        termin_abschlussgespraech: (hasTerminChange && prev.termin_abschlussgespraech)
          ? data.terminDatum : prev.termin_abschlussgespraech,
        // Kontaktdaten
        ansprechpartnerVorname: data.ansprechpartnerVorname ?? prev.ansprechpartnerVorname,
        ansprechpartnerNachname: data.ansprechpartnerNachname ?? prev.ansprechpartnerNachname,
        email: data.email ?? prev.email,
        telefon: data.telefon ?? prev.telefon,
        website: data.website ?? prev.website,
        ort: data.ort ?? prev.ort
      }))
      setEditData(prev => ({ ...prev, neuerKommentar: '', kommentar: updatedKommentar }))
      setEditMode(false); setMailFehlt(false)
      showToast('success', data.status === STATUS.GEWONNEN ? 'Deal gewonnen!' : hasTerminChange ? 'Termin verschoben' : 'Änderungen gespeichert')
      
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="seitenkopf">
        <div>
          <h1 className="text-headline-lg font-display text-on-surface">
            {viewMode === 'pool' ? 'Closer-Pool' : 'Closing'}
            {isAdmin() && viewMode === 'all' && ' (alle Leads)'}
          </h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {viewMode === 'pool'
              ? 'Offene Abschlussgespräche - noch kein Closer zugewiesen'
              : viewMode === 'own'
                ? 'Deine Leads im Closing-Prozess'
                /* Diese Ansicht laedt hot-leads ohne jeden Filter, also den
                   ganzen Bestand - auch Kontakte, die im Setting liegen oder
                   verloren sind. "Alle Leads im Closing-Prozess" hat das
                   Gegenteil behauptet. */
                : 'Der gesamte Kontaktbestand, auch außerhalb des Closings'
            }
          </p>
        </div>

        {/* Toggle: Meine Leads / Pool / Alle (für Admins) - scrollable on mobile */}
        <div className="seitenkopf-bedienung">
          <div>
          <div className="umschalter">
            <button
              onClick={() => { setViewMode('own'); setCurrentPage(1); }}
              className={`umschalter-knopf ${
                viewMode === 'own'
                  ? 'aktiv'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
              }`}
            >
              <UserIcon className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Meine Leads</span>
              <span className="sm:hidden">Meine</span>
            </button>
            <button
              onClick={() => { setViewMode('pool'); setCurrentPage(1); }}
              className={`umschalter-knopf ${
                viewMode === 'pool'
                  ? 'aktiv'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
              }`}
            >
              <Calendar className="w-4 h-4 mr-1.5" />
              Pool
              <span className="umschalter-zahl">{poolLeads.length}</span>
            </button>
            {isAdmin() && (
              <button
                onClick={() => { setViewMode('all'); setCurrentPage(1); }}
                className={`umschalter-knopf ${
                  viewMode === 'all'
                    ? 'aktiv'
                    : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
                }`}
              >
                <Users className="w-4 h-4 mr-1.5" />
                Alle
              </button>
            )}
          </div>

          {/* Ein Knopf fuer beide Ansichten - handleRefresh laedt ohnehin
              das, was gerade zu sehen ist. */}
          <button
            onClick={handleRefresh}
            disabled={refreshing || (viewMode === 'pool' ? loadingPool : loading)}
            aria-label="Aktualisieren"
            title="Aktualisieren"
            className="kopf-knopf kopf-knopf-symbol"
          >
            <RefreshCw className={`w-4 h-4 ${
              (refreshing || (viewMode === 'pool' ? loadingPool : loading)) ? 'animate-spin' : ''
            }`} />
          </button>
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
          {/* Derselbe Aufbau wie im Opening und im Setting: Tabelle, Klick
              öffnet die Schublade, Aktion unten. Anders ist hier nur, dass
              man sich bewirbt statt zu übernehmen - über den Kontakt
              entscheidet ein Admin. */}
          <LeadPool
            laedt={loadingPool}
            leerText="Kein Abschlussgespräch wartet auf einen Closer."
            leerIcon={Calendar}
            aktion={{ text: 'Bewerben', icon: Send }}
            onAktion={(e, schliessen) => { schliessen?.(); startApplyForLead(e.roh) }}
            eintraege={poolLeads.map(l => {
              const wann = closerTermin(l)
              return {
                id: l.id,
                unternehmen: l.unternehmen,
                untertitel: [l.kategorie, l.ort].filter(Boolean).join(' · '),
                ansprechpartner: [l.ansprechpartnerVorname, l.ansprechpartnerNachname]
                  .filter(Boolean).join(' '),
                ort: l.ort,
                terminDatum: wann,
                art: { icon: l.terminart === 'Telefonisch' ? Phone : Video },
                hinweis: wann && new Date(wann) < new Date()
                  ? 'Abschlussgespräch verpasst'
                  : l.setterName ? `gelegt von ${l.setterName}` : null,
                roh: l
              }
            })}
            schublade={(e) => ({
              kontakt: {
                ansprechpartner: e.ansprechpartner,
                statusFeld: anzeigeName(e.roh.status, STUFE.CLOSING),
                telefon: e.roh.telefon,
                email: e.roh.email,
                website: e.roh.website,
                ort: e.roh.ort,
                rollen: { opener: e.roh.openerName, setter: e.roh.setterName }
              },
              termin: {
                datum: e.terminDatum && new Date(e.terminDatum).toLocaleString('de-DE', {
                  weekday: 'long', day: '2-digit', month: '2-digit',
                  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
                }) + ' Uhr',
                art: e.roh.terminart || 'Video',
                link: e.roh.meeting_link
              },
              statistik: webZahlen(e.roh),
              uebergabe: <Uebergabeblatt lead={e.roh} />,
              verlauf: { hotLeadId: e.roh.id, leadId: e.roh.originalLeadId }
            })}
          />

        </>
      ) : (
        /* ==================== NORMALE CLOSING-ANSICHT ==================== */
        <>
          {/* Filter & Suche - gleiches Layout wie Opening */}
      <div className="card p-5 space-y-4">
        {/* Zeile 1: Suche + Refresh */}
        <div className="flex gap-4">
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

        </div>

        {/* Zeile 2: Filter */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Status-Filter */}
          <select
            value={statusFilter}
            onChange={handleStatusFilterChange}
            className="select-field w-full sm:w-auto sm:min-w-[140px] text-body-sm py-2.5"
          >
            <option value="all">Alle Status</option>
            {filterStatusOptionen.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          {/* Rechts, weil es die Darstellung steuert und nicht die Auswahl. */}
          {/* Rechts, weil beides die Darstellung steuert. */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <FilterWahl stufe="closing" filter={tabelle.filter}
                        onAendern={tabelle.filterAendern} zeilen={alleZeilen}
                        speichert={tabelle.speichert} vollstaendig />
            <SpaltenWahl stufe="closing" auswahl={tabelle.spalten}
                         onAendern={tabelle.spaltenAendern} speichert={tabelle.speichert} />
          </div>
        </div>
      </div>

      {/* Lead-Liste */}
      <div className="card-elevated overflow-hidden min-h-[600px]">
        <div>
          {/* Beim Nachladen bleibt die Liste stehen - sonst springt die Seite. */}
          {loading && paginatedLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-on-surface-variant">Leads werden geladen...</p>
            </div>
          ) : paginatedLeads.length === 0 ? (
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
            <>
              <div className={`transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
              <LeadTabelle
                stufe="closing"
                zeilen={paginatedLeads}
                sortierung={sortierung}
                onSortierung={(spalte) => { setCurrentPage(1); setSortierung(s =>
                  s.spalte === spalte ? { spalte, ab: !s.ab } : { spalte, ab: false }) }}
                auswahl={tabelle.spalten
                  || (isAdmin() && viewMode === 'all'
                    ? [...standardSpalten('closing'), 'closer']
                    : null)}
                badgeFarbe={(_, z) => getStatusStyle(z.statusWert)}
                leer="Keine Leads mit diesen Filterkriterien."
                onZeile={(z) => openModal(z.roh)}
              />
              </div>

              {/* Pagination - shared for both views */}
              {gefilterteZeilen.length > LEADS_PER_PAGE && (
                <div className="px-4 md:px-6 py-3 md:py-4 bg-surface-container/50 flex items-center justify-between">
                  <span className="text-body-sm text-on-surface-variant">
                    {startIndex + 1}-{Math.min(startIndex + LEADS_PER_PAGE, gefilterteZeilen.length)} von {gefilterteZeilen.length}
                  </span>
                  <div className="flex items-center gap-1 md:gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safeCurrentPage === 1}
                      className="p-2 bg-surface-container-lowest rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
                    </button>
                    <span className="text-body-sm text-on-surface px-2">
                      {safeCurrentPage} / {totalPages}
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
            </>
          )}
        </div>
      </div>

      {/* Detail/Edit Drawer - Slide-in von rechts */}
      {selectedLead && createPortal(
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-scrim/50"
            onClick={closeModal}
          />

          {/* Drawer Content */}
          <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-surface shadow-xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 bg-surface border-b border-outline-variant px-6 py-4 flex items-center justify-between z-10 flex-shrink-0">
              <div className="min-w-0 pr-4">
                <h2 className="text-title-lg font-semibold text-on-surface truncate">
                  {safeString(selectedLead.unternehmen) || 'Lead Details'}
                </h2>
                {[selectedLead.kategorie, selectedLead.ort].filter(Boolean).length > 0 && (
                  <p className="text-body-sm text-on-surface-variant truncate mt-0.5">
                    {[selectedLead.kategorie, selectedLead.ort].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 hover:bg-surface-container rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body - Scrollbar hier */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">

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
              ) : showReleaseConfirm ? (
                <LeadFreigabe
                  lead={selectedLead}
                  stufe="closing"
                  onAbbrechen={() => { setShowReleaseConfirm(false); setReleaseReason('') }}
                  onFertig={(grund) => { setShowReleaseConfirm(false); nachFreigabe(grund) }}
                />
              ) : showAbschlussForm ? (
                /* ========================================
                   ABSCHLUSS-FORM für Billing-Daten
                   ======================================== */
                <div>
                  {/* Zurück-Link */}
                  <button
                    type="button"
                    onClick={handleAbschlussCancel}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Zurück zur Übersicht
                  </button>

                  <AbschlussForm
                    lead={selectedLead}
                    zielStatus={abschlussZiel}
                    onCancel={handleAbschlussCancel}
                    onSubmit={handleAbschlussSubmit}
                    isLoading={saving}
                  />
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
                  
                  {/* Im Nachfassen zeigt der Dialog auch das Toolkit und
                      schlägt das Stück aus Diagnose und Segment vor. */}
                  <EmailComposer
                    hotLeadId={selectedLead?.id}
                    lead={selectedLead}
                    kontakt={selectedLead}
                    anlass={mailAnlass(selectedLead)}
                    user={user}
                    inline={true}
                    kategorie={selectedLead?.status === STATUS.WIRD_NACHGEFASST ? 'Closing,Nachfassen' : 'Closing'}
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
                        websiteSetup: '',
                        laufzeit: 12,
                        vertragsbestandteile: DEFAULT_VERTRAGSBESTANDTEILE(12),
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

                  <div className="space-y-5">
                    {/* Produkt-Auswahl Dropdown */}
                    <div>
                      <label className="feld-label">
                        Produkt <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={angebotData.produkt}
                        onChange={(e) => handleProduktChange(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white text-gray-900 appearance-none cursor-pointer"
                      >
                        <option value="">Produkt auswählen...</option>
                        {PRODUKT_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Sachverständigen-Hinweis – nur wenn kein individuelles Angebot */}
                    {angebotData.produkt !== 'Individuell' && angebotData.produkt && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                          Für Sachverständige bitte ein individuelles Angebot erstellen.
                        </p>
                      </div>
                    )}

                    {/* Setup & Retainer */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="feld-label">
                          Setup (netto) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={angebotData.setup}
                            onChange={(e) => setAngebotData(prev => ({ ...prev, setup: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                            placeholder="z.B. 2500"
                            className="input-field pr-12"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">€</span>
                        </div>
                      </div>
                      <div>
                        <label className="feld-label">
                          Retainer (netto) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={angebotData.retainer}
                            onChange={(e) => setAngebotData(prev => ({ ...prev, retainer: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                            placeholder="z.B. 400"
                            className="input-field pr-12"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">€</span>
                        </div>
                      </div>
                    </div>

                    {/* Website-Setup Feld (nur für Website-Produkte) */}
                    {PRODUKTE_MIT_WEBSITE_SETUP.includes(angebotData.produkt) && (
                      <div className="bg-primary-fixed/30 rounded-xl p-5">
                        <h4 className="font-medium text-primary mb-4">Website-Komponente</h4>
                        <div>
                          <label className="feld-label">
                            Website Setup-Gebühr (netto)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={angebotData.websiteSetup}
                              onChange={(e) => setAngebotData(prev => ({ ...prev, websiteSetup: e.target.value }))}
                              placeholder="z.B. 2500"
                              className="input-field pr-12"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">€</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Separater Setup-Betrag für die Website-Erstellung</p>
                        </div>
                      </div>
                    )}

                    {/* Laufzeit */}
                    <div>
                      <label className="feld-label">
                        Laufzeit <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={angebotData.laufzeit}
                          onChange={(e) => {
                            const raw = e.target.value
                            const num = raw === '' ? 0 : Math.min(32, Math.max(0, parseInt(raw) || 0))
                            handleLaufzeitChange(num)
                          }}
                          min="0"
                          max="32"
                          className="input-field"
                        />
                        <span className="text-gray-500 whitespace-nowrap">
                          {parseInt(angebotData.laufzeit) === 0 ? 'Einmalzahlung' : 'Monate'}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {[0, 1, 6, 12, 24].map(months => (
                          <button
                            key={months}
                            type="button"
                            onClick={() => handleLaufzeitChange(months)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                              parseInt(angebotData.laufzeit) === months
                                ? 'bg-green-100 text-green-700 ring-2 ring-green-400'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {months === 0 ? 'Einmalzahlung' : `${months} Mon`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Individuelle Felder – nur bei "Individuell" */}
                    {angebotData.produkt === 'Individuell' && (
                      <>
                        {/* Paketname */}
                        <div>
                          <label className="feld-label">
                            Paketname <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={angebotData.paketname}
                            onChange={(e) => setAngebotData(prev => ({ ...prev, paketname: e.target.value }))}
                            placeholder="z.B. KI-Chatbot, WhatsApp-Assistent"
                            className="input-field"
                          />
                        </div>

                        {/* Kurzbeschreibung */}
                        <div>
                          <label className="feld-label">
                            Kurzbeschreibung der Leistung <span className="text-red-500">*</span>
                          </label>
                          <p className="text-xs text-gray-500 mb-2">
                            Eine Kurzbeschreibung der Leistung für die Mail an den Makler.
                          </p>
                          <input
                            type="text"
                            value={angebotData.kurzbeschreibung}
                            onChange={(e) => setAngebotData(prev => ({ ...prev, kurzbeschreibung: e.target.value }))}
                            placeholder="z.B. Aufbau & Betrieb Ihrer individuellen KI-Vertriebsassistenz"
                            className="input-field"
                          />
                        </div>

                        {/* Leistungsbeschreibung */}
                        <div>
                          <label className="feld-label">
                            Leistungsbeschreibung <span className="text-red-500">*</span>
                          </label>
                          <p className="text-xs text-gray-500 mb-2">
                            Bitte mit Überschriften und einzelnen Unterpunkten mit Spiegelstrichen angeben.
                          </p>
                          <textarea
                            value={angebotData.leistungsbeschreibung}
                            onChange={(e) => setAngebotData(prev => ({ ...prev, leistungsbeschreibung: e.target.value }))}
                            rows={5}
                            className="textarea-field min-h-[120px]"
                          />
                          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
                            <p className="font-medium mb-1">Format-Beispiel:</p>
                            <p>1. SEO Überarbeitung<br />– Website-Analyse mit Hilfe von verschiedenen Software-Tools<br />– Prüfung und Anpassung der .htaccess, Sitemap &amp; robots.txt.</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Vertragsbestandteile (immer sichtbar wenn Produkt gewählt) */}
                  {angebotData.produkt && (
                    <div className="space-y-4">
                      <div>
                        <label className="feld-label">
                          Individuelle Vertragsbestandteile
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                          Hier können zusätzliche Vertragsbedingungen eingefügt werden.
                        </p>
                        <textarea
                          value={angebotData.vertragsbestandteile}
                          onChange={(e) => setAngebotData(prev => ({ ...prev, vertragsbestandteile: e.target.value }))}
                          rows={4}
                          className="textarea-field min-h-[100px]"
                        />
                      </div>

                      {/* Textbausteine */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-700 mb-3">Textbausteine zum Kopieren</p>
                        <div className="space-y-2">
                          {TEXTBAUSTEINE.map((text, index) => (
                            <div
                              key={index}
                              onClick={() => {
                                navigator.clipboard.writeText(text)
                                showToast('success', 'In Zwischenablage kopiert')
                              }}
                              className="p-3 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors"
                            >
                              {text}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Zusammenfassung - zeigen sobald mindestens Setup oder Retainer gesetzt ist (0 zählt als gesetzt) */}
                  {(((angebotData.setup !== '' && angebotData.setup !== null && angebotData.setup !== undefined) ||
                     (angebotData.retainer !== '' && angebotData.retainer !== null && angebotData.retainer !== undefined))) && (
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
                      <div className={`grid grid-cols-2 ${angebotData.websiteSetup ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3 sm:gap-4 mb-4`}>
                        <div className="bg-white rounded-lg p-3 sm:p-4 text-center">
                          <p className="text-xs sm:text-sm text-gray-500 mb-1">Setup-Gebühr</p>
                          <p className="text-lg sm:text-2xl font-bold text-gray-900">{(parseFloat(angebotData.setup) || 0).toLocaleString('de-DE')} €</p>
                          <p className="text-xs text-gray-400">einmalig, netto</p>
                        </div>
                        {angebotData.websiteSetup && (
                          <div className="bg-white rounded-lg p-3 sm:p-4 text-center">
                            <p className="text-xs sm:text-sm text-gray-500 mb-1">Website-Setup</p>
                            <p className="text-lg sm:text-2xl font-bold text-primary">{(parseFloat(angebotData.websiteSetup) || 0).toLocaleString('de-DE')} €</p>
                            <p className="text-xs text-gray-400">einmalig, netto</p>
                          </div>
                        )}
                        <div className="bg-white rounded-lg p-3 sm:p-4 text-center">
                          <p className="text-xs sm:text-sm text-gray-500 mb-1">Monatl. Retainer</p>
                          <p className="text-lg sm:text-2xl font-bold text-gray-900">{(parseFloat(angebotData.retainer) || 0).toLocaleString('de-DE')} €</p>
                          <p className="text-xs text-gray-400">pro Monat, netto</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 sm:p-4 text-center">
                          <p className="text-xs sm:text-sm text-gray-500 mb-1">Laufzeit</p>
                          {parseInt(angebotData.laufzeit) === 0 ? (
                            <>
                              <p className="text-lg sm:text-2xl font-bold text-gray-900">–</p>
                              <p className="text-xs text-gray-400">Einmalzahlung</p>
                            </>
                          ) : (
                            <>
                              <p className="text-lg sm:text-2xl font-bold text-gray-900">{angebotData.laufzeit}</p>
                              <p className="text-xs text-gray-400">Monate</p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-500 mb-1">
                          {parseInt(angebotData.laufzeit) === 0
                            ? 'Gesamtwert (Einmalzahlung)'
                            : `Gesamtwert (${angebotData.laufzeit} Monate)`}
                        </p>
                        <p className="text-3xl font-bold text-green-600">
                          {(
                            (parseFloat(angebotData.setup) || 0) +
                            (parseFloat(angebotData.websiteSetup) || 0) +
                            (parseFloat(angebotData.retainer) || 0) * (parseInt(angebotData.laufzeit) || 0)
                          ).toLocaleString('de-DE')} €
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
                    const isAbgesagt = selectedLead.status === STATUS.TERMIN_ABGESAGT
                    const headerText = isInPast || isAbgesagt
                      ? 'Neues Abschlussgespräch buchen' : 'Abschlussgespräch verschieben'
                    
                    return (
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-primary-container rounded-xl">
                          <CalendarPlus className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">{headerText}</h3>
                          <p className="text-sm text-gray-500">{selectedLead.unternehmen}</p>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Im Closing wird ein ABSCHLUSSgespraech gelegt. Vorher
                      stand hier der Zweck 'beratung': Der Waehler schrieb den
                      Beratungstermin des Setters, setzte den Status auf
                      "Beratungsgespraech vereinbart" - und warf den Kontakt
                      damit zurueck ins Setting. */}
                  <TerminPicker
                    zweck="abschluss"
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
                      showToast('success', `Abschlussgespräch gebucht für ${selectedLead.unternehmen}`)
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
                  {/* Die drei Aktionen standen hier als Knopfleiste ueber allem
                      und schoben die Kontaktdaten aus dem Bild. Sie sind jetzt
                      in der Fussleiste - dort, wo Opening, Setting und
                      Follow-Up ihre Aktionen auch haben. */}

                  {/* KONTAKTDATEN Section */}
                  <div className="space-y-3">
                    <h3 className="abschnitt-titel flex items-center gap-2">
                    <UserIcon className="w-4 h-4" />
                    Kontaktdaten
                  </h3>

                    {editMode ? (
                      /* Edit Mode: Kontaktdaten bearbeiten */
                      <div className="space-y-3">
                        {/* Dieselben Felder in derselben Reihenfolge wie in
                            Opening und Setting — ein Bauteil, eine Beschriftung. */}
                        <KontaktFelder
                          werte={{
                            anrede: editData.anrede,
                            vorname: editData.ansprechpartnerVorname,
                            nachname: editData.ansprechpartnerNachname,
                            telefon: editData.telefon,
                            email: editData.email,
                            website: editData.website,
                            ort: editData.ort
                          }}
                          onChange={(w) => {
                            handleEditChange('anrede', w.anrede)
                            handleEditChange('ansprechpartnerVorname', w.vorname)
                            handleEditChange('ansprechpartnerNachname', w.nachname)
                            handleEditChange('telefon', w.telefon)
                            handleEditChange('email', w.email)
                            handleEditChange('website', w.website)
                            handleEditChange('ort', w.ort)
                          }}
                          mailFehlt={mailFehlt}
                          anredeFehlt={!editData.anrede}
                        />
                        <div>
                          <label className="feld-label">Status</label>
                          <select
                            value={editData.status}
                            onChange={(e) => handleEditChange('status', e.target.value)}
                            className="input-field"
                          >
                            <option value="">Status beibehalten ({selectedLead.status})</option>
                            {statusZurWahl(isAdmin()).map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        {editData.status === STATUS.VERLOREN_WIEDERVORLAGE && selectedLead.status !== STATUS.VERLOREN_WIEDERVORLAGE && (
                          <div className="space-y-3 p-3 bg-surface-container rounded-lg">
                            <div>
                              <label className="feld-label">Wiedervorlage am <span className="text-red-500">*</span></label>
                              <input
                                type="date"
                                value={editData.wiedervorlage_am || ''}
                                onChange={(e) => handleEditChange('wiedervorlage_am', e.target.value)}
                                className="input-field"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Nach sechs Monaten, oder zu dem Zeitpunkt, den der Kunde selbst genannt hat.
                              </p>
                            </div>
                            <div>
                              <label className="feld-label">Grund <span className="text-red-500">*</span></label>
                              <textarea
                                rows={2}
                                value={editData.verlust_grund || ''}
                                onChange={(e) => handleEditChange('verlust_grund', e.target.value)}
                                placeholder="Warum es gerade nicht passt, und was besprochen war"
                                className="textarea-field"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* View Mode */
                      <>
                        {/* Reicht die Übergabe des Setters nicht, geht der
                            Kontakt mit Begründung zurück. Kein Vorwurf -
                            die Rückgabequote misst die Qualität der Übergaben. */}
                        <RueckgabeKnopf
                          hotLead={selectedLead}
                          onErledigt={() => { setSelectedLead(null); loadLeads() }}
                        />

                        {/* Info Grid */}
                        <Angaben>
                          <Angabe name="Ansprechpartner">
                            {`${safeString(selectedLead.ansprechpartnerVorname)} ${safeString(selectedLead.ansprechpartnerNachname)}`.trim() || null}
                          </Angabe>
                          <Angabe name="Status">{anzeigeName(selectedLead.status, STUFE.CLOSING) || null}</Angabe>
                        </Angaben>

                        {/* Dieselben Pillen wie in Opening und Setting. */}
                        <div className="flex flex-wrap gap-2">
                          {safeString(selectedLead.telefon) && (
                            <Pille icon={Phone} href={`tel:${safeString(selectedLead.telefon)}`}>{safeString(selectedLead.telefon)}</Pille>
                          )}
                          {safeString(selectedLead.email) && (
                            <Pille icon={Mail} href={`mailto:${safeString(selectedLead.email)}`}>{safeString(selectedLead.email)}</Pille>
                          )}
                          {safeString(selectedLead.website) && (
                            <Pille icon={Globe}
                                   href={safeString(selectedLead.website).startsWith('http') ? safeString(selectedLead.website) : `https://${safeString(selectedLead.website)}`}>
                              Website
                            </Pille>
                          )}
                          {(safeString(selectedLead.ort) || safeString(selectedLead.bundesland)) && (
                            <Pille icon={MapPin}>
                              {[safeString(selectedLead.ort), safeString(selectedLead.bundesland)].filter(Boolean).join(', ')}
                            </Pille>
                          )}
                        </div>
                      </>
                    )}

                    {/* Wer den Kontakt hatte und hat, in jeder Schublade gleich.
                        Die Leitung kann es hier richtigstellen - zugeteilt wird
                        sonst über den Bewerbungsweg, aber wenn jemand ausfällt
                        oder versehentlich eingetragen wurde, braucht es einen
                        Griff, der ohne Freigeben und Neubewerben auskommt. */}
                    <Rollen
                      opener={safeString(editMode && isAdmin() ? (editData.openerName ?? selectedLead.openerName) : selectedLead.openerName)}
                      setter={safeString(editMode && isAdmin() ? (editData.setterName ?? selectedLead.setterName) : selectedLead.setterName)}
                      closer={safeString(editMode && isAdmin() ? (editData.closerName ?? selectedLead.closerName) : selectedLead.closerName)}
                      bearbeitbar={editMode && isAdmin()}
                      onAendern={handleEditChange}
                    />
                  </div>

                  {/* Der gelegte Termin - welcher, sagt die Überschrift. */}
                  <div className="space-y-3 abschnitt-trenner">
                    <h3 className="abschnitt-titel flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {terminBezeichnung(selectedLead)}
                  </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-body-sm text-on-surface-variant">Datum & Uhrzeit</p>
                        {editMode ? (
                          <div>
                            <input
                              type="datetime-local"
                              value={editData.terminDatum ? new Date(new Date(editData.terminDatum).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                              onChange={(e) => handleEditChange('terminDatum', e.target.value ? new Date(e.target.value).toISOString() : '')}
                              className="input-field"
                            />
                            <p className="text-label-sm text-warning mt-1">Nur CRM-Kalender, Calendly bleibt unverändert</p>
                          </div>
                        ) : (
                          <p className="text-body-md text-on-surface">{formatDate(closerTermin(selectedLead))}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-body-sm text-on-surface-variant">Terminart</p>
                        {/* Das Abschlussgespraech ist in Calendly als Videotermin
                            angelegt. selectedLead.terminart beschreibt den
                            Telefontermin des Setters - fuer das Closing waere es
                            schlicht die falsche Auskunft. */}
                        <p className="text-body-md text-on-surface">
                          {selectedLead.termin_abschlussgespraech
                            ? 'Video'
                            : (selectedLead.terminart || 'Video')}
                        </p>
                      </div>
                    </div>

                    {/* Steht davor ein Beratungsgespraech, gehoert es sichtbar
                        dazu: Der Closer sieht damit, was der Kunde schon hinter
                        sich hat - und verwechselt die beiden Termine nicht. */}
                    {selectedLead.termin_abschlussgespraech && selectedLead.terminDatum && (
                      <p className="text-body-sm text-on-surface-variant">
                        Beratungsgespräch war am {formatDate(selectedLead.terminDatum)}
                        {selectedLead.setterName && <> mit {selectedLead.setterName}</>}
                      </p>
                    )}

                    {/* Video-Link. Beim Abschlussgespraech ist es der eigene
                        Link - meeting_link zeigt auf den Setting-Termin. */}
                    {(selectedLead.meeting_link_abschluss
                      || (selectedLead.terminart === 'Video' && selectedLead.meetingLink)) && (
                      <a
                        href={selectedLead.meeting_link_abschluss || selectedLead.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-body-sm font-medium text-blue-700">Video-Meeting beitreten</span>
                          <p className="text-label-sm text-blue-500 truncate">{selectedLead.meeting_link_abschluss || selectedLead.meetingLink}</p>
                        </div>
                      </a>
                    )}
                  </div>

                  {/* BILLING Section (nur bei Abgeschlossen UND nur für Geschäftsführer) */}
                  {selectedLead.status === STATUS.GEWONNEN && isGeschaeftsfuehrer() && (
                    <BillingPanel
                      leadId={selectedLead.id}
                      leadStatus={selectedLead.status}
                      userId={user.id}
                    />
                  )}

                  {/* Dasselbe Bauteil wie in Opening und Setting: gleiche
                      Reihenfolge, gleiche Farbschwellen, gleiche Darstellung. */}
                  <div className="abschnitt-trenner">
                    <Statistik werte={webZahlen(selectedLead)} />
                  </div>

                  {/* Was Opener und Setter aufgenommen haben.
                      Der Setter fuellt zwoelf Pflichtfelder aus, bevor er das
                      Abschlussgespraech buchen darf - angezeigt wurden sie
                      danach nirgends. Der Closer ging mit einem Termin und
                      einem Kommentarfeld ins Gespraech. */}
                  <div className="space-y-3 abschnitt-trenner">
                    <h3 className="abschnitt-titel flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    Übergabe
                  </h3>
                    <Uebergabeblatt lead={selectedLead} />
                  </div>

                  {/* Ab hier der Arbeitsbereich des Closers, dann der Verlauf.
                      Dieselbe Reihenfolge wie in jeder Schublade (LeadSchublade). */}
                  {/* Der Ausgang steht vor dem Verlauf: Er ist das, was nach
                      dem Gespräch als Erstes festzuhalten ist. Nur sichtbar,
                      wenn es ein Abschlussgespräch gab — vorher gibt es keinen
                      Ausgang. */}
                  {selectedLead.termin_abschlussgespraech && (
                    <Gespraechsausgang
                      lead={selectedLead}
                      onGespeichert={() => loadLeads()}
                    />
                  )}

                  {/* DEAL-DETAILS Section (wenn nicht Lead-Status) */}
                  {selectedLead.status !== STATUS.BERATUNG_VEREINBART && (
                    <div className="space-y-3 abschnitt-trenner">
                      <h3 className="abschnitt-titel flex items-center gap-2">
                        <Euro className="w-4 h-4" />
                        Deal-Details
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant">
                        <div>
                          <p className="text-label-sm text-on-surface-variant">Setup</p>
                          <p className="text-title-md font-semibold text-on-surface">{formatMoney(selectedLead.setup)}</p>
                        </div>
                        <div>
                          <p className="text-label-sm text-on-surface-variant">Retainer</p>
                          <p className="text-title-md font-semibold text-on-surface">{formatMoney(selectedLead.retainer)}/Mon</p>
                        </div>
                        <div>
                          <p className="text-label-sm text-on-surface-variant">Laufzeit</p>
                          <p className="text-title-md font-semibold text-on-surface">{selectedLead.laufzeit || 12} Mon</p>
                        </div>
                        <div>
                          <p className="text-label-sm text-on-surface-variant">Gesamtwert</p>
                          <p className="text-title-md font-semibold text-success">
                            {formatMoney(
                              (selectedLead.setup || 0) +
                              (selectedLead.retainer || 0) *
                              (selectedLead.laufzeit || 12)
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}


                  {/* Neuer Kommentar hinzufügen - nur im Edit-Mode */}
                  {editMode && (
                    <div className="abschnitt-trenner">
                      <label className="feld-label">Neuer Kommentar hinzufügen</label>
                      <textarea
                        value={editData.neuerKommentar || ''}
                        onChange={(e) => handleEditChange('neuerKommentar', e.target.value)}
                        rows={3}
                        placeholder="Notiz hinzufügen..."
                        className="textarea-field"
                      />
                    </div>
                  )}

                  {/* SEO-Analyse - nur für Closer und Admins */}
                  {(isAdmin() || isCloser()) && selectedLead.website && (
                    <div className="space-y-3 abschnitt-trenner">
                      <h3 className="abschnitt-titel flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        SEO-Analyse
                      </h3>
                      <p className="text-body-sm text-on-surface-variant">
                        Startet eine externe SEO-Analyse. Der Bericht wird automatisch zu den Dokumenten hinzugefügt.
                      </p>
                      <button
                        onClick={() => handleStartSeoAnalysis(selectedLead)}
                        disabled={seoAnalysisLoading[selectedLead.id]}
                        className="fuss-neben"
                      >
                        {seoAnalysisLoading[selectedLead.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        SEO-Analyse starten
                      </button>
                    </div>
                  )}

                  {/* Dokumente / Attachments */}
                  <div className="space-y-3 abschnitt-trenner">
                    <h3 className="abschnitt-titel flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Dokumente
                    </h3>

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
                              <div className="w-10 h-10 bg-secondary-container rounded-lg flex items-center justify-center flex-shrink-0">
                                {attachment.filename?.toLowerCase().endsWith('.pdf') ? (
                                  <FileText className="w-5 h-5 text-primary" />
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
                                className="p-2 text-primary hover:bg-secondary-container rounded-lg transition-colors"
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
                                : 'border-gray-300 hover:border-secondary hover:bg-primary-fixed/30'
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
                              : 'border-gray-300 hover:border-secondary hover:bg-primary-fixed/30'
                          }`}
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="w-8 h-8 text-secondary mx-auto mb-2 animate-spin" />
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
                  {/* NOTIZEN & VERLAUF Section.
                      Die Zeitleiste steht hier oben, nicht als eigener Kasten
                      weiter unten — zwei Verlaufs-Abschnitte nebeneinander
                      waren genau das Durcheinander, das zu beheben war.
                      Darunter steht NUR noch der Altbestand — alles vor dem
                      ersten datierten Eintrag. Die datierten Einträge stehen
                      in der Zeitleiste; sie hier nochmals zu zeigen war
                      doppelt gemoppelt. Betrifft 588 von 7.588 Kontakten. */}
                  <div className="abschnitt-trenner">
                    <h3 className="abschnitt-titel mb-3 flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Verlauf
                    </h3>

                    <div className="mb-4">
                      <Verlauf hotLeadId={selectedLead.id} leadId={selectedLead.originalLeadId} />
                    </div>

                    {altbestand(selectedLead.kommentar) && (
                      <div className="text-label-sm text-on-surface-variant mb-2">
                        Ältere Notizen ohne Datum
                      </div>
                    )}
                    <div className={altbestand(selectedLead.kommentar)
                      ? 'bg-surface-container-lowest rounded-xl p-4 max-h-[250px] overflow-y-auto'
                      : 'hidden'}>
                      {altbestand(selectedLead.kommentar) ? (
                        <p className="text-body-sm text-on-surface whitespace-pre-line">
                          {altbestand(selectedLead.kommentar)}
                        </p>
                      ) : (
                        <p className="text-body-sm text-outline italic">Keine Notizen vorhanden</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer - unterschiedlich je nach View (nicht bei Success, EmailComposer, TerminPicker oder AbschlussForm) */}
            {!angebotSuccess && !showEmailComposer && !showTerminPicker && !showAbschlussForm && (
              <div className="schublade-fuss">
                {showAngebotView ? (
                  /* Angebot-View Footer */
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAngebotView(false)
                        setAngebotData({
                          produkt: '',
                          setup: '',
                          retainer: '',
                          websiteSetup: '',
                          laufzeit: 12,
                          vertragsbestandteile: DEFAULT_VERTRAGSBESTANDTEILE(12),
                          paketname: '',
                          kurzbeschreibung: '',
                          leistungsbeschreibung: ''
                        })
                      }}
                      disabled={sendingAngebot}
                      className="fuss-leise fuss-weg"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={handleSendAngebot}
                      disabled={
                        // Setup und Retainer dürfen 0 sein; mindestens einer muss ausgefüllt sein
                        !((angebotData.setup !== '' && angebotData.setup !== null && angebotData.setup !== undefined) ||
                          (angebotData.retainer !== '' && angebotData.retainer !== null && angebotData.retainer !== undefined))
                        || sendingAngebot
                      }
                      className="fuss-haupt"
                    >
                      {sendingAngebot ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Angebot wird versendet...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
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
                    onClick={() => { setEditMode(false); setMailFehlt(false) }}
                    className="fuss-leise fuss-weg"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="fuss-haupt"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Speichern
                  </button>
                </>
              ) : (
                /* Normal-View Footer */
                <>
                  {/* Vier Nebenaktionen unter einem Knopf. Vorher standen sie
                      als fuenf gleich grosse Knoepfe nebeneinander - bei der
                      Breite der Schublade brachen zwei mitten im Wort um. */}
                  <Aktionsmenue
                    eintraege={[
                      closerTermin(selectedLead) && !schliesstAb(selectedLead.status)
                        && !IST_VERLOREN.includes(selectedLead.status) && {
                          name: new Date(closerTermin(selectedLead)) < new Date()
                            || selectedLead.status === STATUS.TERMIN_ABGESAGT
                            ? 'Neues Abschlussgespräch buchen' : 'Abschlussgespräch verschieben',
                          icon: CalendarPlus,
                          onClick: () => setShowTerminPicker(true)
                        },
                      { name: 'Unterlagen versenden', icon: Paperclip,
                        onClick: () => setShowEmailComposer(true) },
                      // "Neues Angebot" erst, wenn schon eines draussen ist.
                      // Der Test hing an "Beratungsgespraech vereinbart" - ein
                      // Status, den es im Closing nicht gibt; deshalb stand hier
                      // immer "Neues Angebot", auch beim ersten.
                      { name: selectedLead.angebot_verschickt_am
                          || selectedLead.status === STATUS.ANGEBOT_VERSCHICKT
                          ? 'Neues Angebot' : 'Angebot versenden',
                        icon: Send, onClick: () => setShowAngebotView(true) },
                      selectedLead.closerName && {
                        name: 'An Pool freigeben', icon: UserMinus, warnung: true,
                        onClick: () => setShowReleaseConfirm(true) }
                    ]}
                  />

                  <button
                    type="button"
                    onClick={() => { setEditMode(true); setMailFehlt(false) }}
                    className="fuss-haupt"
                  >
                    <Edit3 className="w-4 h-4" />
                    Bearbeiten
                  </button>
                </>
              )}
              </div>
            )}

            {/* Freigeben: dieselbe Schublade wie überall. Vorher lag hier
                ein Kasten in der Bildmitte - die letzte Stelle im Closing, an
                der noch ein Popup aufsprang. */}
          </div>
        </div>,
        document.body
      )}
        </>
      )}

      {/* Bewerbungs-Modal */}
      {/* Bewerben: dieselbe Schublade wie überall, nicht mehr ein Kasten in
          der Bildmitte. Im Pool steht die Schublade des Kontakts, darüber
          legt sich diese hier - zwei Fenster derselben Art statt zweier
          Bauweisen (Feedback 28.09.). */}
      <SlideDrawer
        isOpen={showApplyModal && !!applyingLead}
        onClose={() => { setShowApplyModal(false); setApplyingLead(null); setApplyKommentar('') }}
        title="Auf Abschlussgespräch bewerben"
        untertitel={applyingLead?.unternehmen}
        width="max-w-xl"
        fuss={
          <>
            <button
              onClick={() => { setShowApplyModal(false); setApplyingLead(null); setApplyKommentar('') }}
              className="fuss-leise fuss-weg"
            >
              Abbrechen
            </button>
            <button onClick={submitApplication} disabled={submittingApplication} className="fuss-haupt">
              {submittingApplication
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              Bewerbung senden
            </button>
          </>
        }
      >
        {applyingLead && (
          <div className="space-y-5">
            <p className="text-body-md text-on-surface-variant">
              Deine Bewerbung geht an die Leitung. Sobald entschieden ist, bekommst du
              eine E-Mail.
            </p>

            <div>
              <label className="feld-label">Kommentar (optional)</label>
              <textarea
                value={applyKommentar}
                onChange={(e) => setApplyKommentar(e.target.value)}
                placeholder="Warum möchtest du dieses Gespräch übernehmen?"
                rows={3}
                className="textarea-field"
              />
            </div>

            <div className="abschnitt-trenner pt-4 space-y-2 text-body-sm">
              <div className="flex justify-between gap-4">
                <span className="text-on-surface-variant">Abschlussgespräch</span>
                <span className="font-medium text-on-surface">
                  {closerTermin(applyingLead)
                    ? new Date(closerTermin(applyingLead)).toLocaleString('de-DE', {
                        weekday: 'short', day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
                      }) + ' Uhr'
                    : 'Nicht festgelegt'}
                </span>
              </div>
              {applyingLead.setterName && (
                <div className="flex justify-between gap-4">
                  <span className="text-on-surface-variant">Gebucht von</span>
                  <span className="font-medium text-on-surface">{applyingLead.setterName}</span>
                </div>
              )}
              {applyingLead.ansprechpartner && (
                <div className="flex justify-between gap-4">
                  <span className="text-on-surface-variant">Ansprechpartner</span>
                  <span className="font-medium text-on-surface">{applyingLead.ansprechpartner}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* No-Show-Modal */}
      {/* Nicht erschienen: ebenfalls eine Schublade. Der Kasten in der
          Bildmitte war die letzte Stelle im Closing, die anders aussah als
          der Rest (Feedback 28.09.). */}
      <SlideDrawer
        isOpen={showNoShowModal && !!selectedLead}
        onClose={handleNoShowCancel}
        title="Kunde nicht erschienen"
        untertitel={selectedLead?.unternehmen}
        width="max-w-xl"
        fuss={selectedLead && (
          <>
            <button onClick={handleNoShowCancel} disabled={noShowProcessing} className="fuss-leise fuss-weg">
              Abbrechen
            </button>
            {(selectedLead.no_show_count || 0) >= 3 && (
              <button onClick={handleNoShowToLost} disabled={noShowProcessing} className="fuss-neben">
                Auf „Verloren" setzen
              </button>
            )}
            <button onClick={handleNoShowConfirm} disabled={noShowProcessing} className="fuss-haupt">
              {noShowProcessing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <AlertCircle className="w-4 h-4" />}
              Als nicht erschienen festhalten
            </button>
          </>
        )}
      >
        {selectedLead && (
          <div className="space-y-5">
            {(selectedLead.no_show_count || 0) >= 2 && (
              <div className={`p-3 rounded-lg border ${(selectedLead.no_show_count || 0) >= 3
                ? 'bg-error-container border-error/30' : 'bg-amber-50 border-amber-200'}`}>
                <p className={`text-body-md font-medium ${(selectedLead.no_show_count || 0) >= 3
                  ? 'text-error' : 'text-amber-900'}`}>
                  Das wäre der {(selectedLead.no_show_count || 0) + 1}. Ausfall.
                </p>
                <p className={`text-body-sm mt-1 ${(selectedLead.no_show_count || 0) >= 3
                  ? 'text-error' : 'text-amber-800'}`}>
                  {(selectedLead.no_show_count || 0) >= 3
                    ? 'Nach drei Ausfällen ist der Kontakt in aller Regel verloren.'
                    : 'Kommt es noch einmal vor, gehört der Kontakt auf „Verloren".'}
                </p>
              </div>
            )}

            <p className="text-body-md text-on-surface-variant">
              {noShowKeepInClosing
                ? <>Der Kontakt bleibt in <strong>deinem</strong> Closing. Der Setter wird nicht benachrichtigt.</>
                : selectedLead.setterName
                  ? <>Der Kontakt geht zurück an <strong>{selectedLead.setterName}</strong>. Er wird benachrichtigt und kann ein neues Abschlussgespräch buchen.</>
                  : 'Der Kontakt wird als nicht erschienen festgehalten. Ein Setter ist nicht zugeordnet.'}
            </p>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-outline-variant hover:bg-surface-container">
              <input
                type="checkbox"
                checked={noShowKeepInClosing}
                onChange={(e) => setNoShowKeepInClosing(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
              />
              <span className="text-body-sm text-on-surface">
                <strong>Im Closing behalten:</strong> Ich buche selbst neu, der Setter wird nicht benachrichtigt.
              </span>
            </label>

            <div className="abschnitt-trenner pt-4 space-y-2 text-body-sm">
              <div className="flex justify-between gap-4">
                <span className="text-on-surface-variant">Geplantes Abschlussgespräch</span>
                <span className="font-medium text-on-surface">
                  {closerTermin(selectedLead)
                    ? new Date(closerTermin(selectedLead)).toLocaleString('de-DE', {
                        weekday: 'short', day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
                      }) + ' Uhr'
                    : 'Nicht festgelegt'}
                </span>
              </div>
              {selectedLead.setterName && (
                <div className="flex justify-between gap-4">
                  <span className="text-on-surface-variant">Setter</span>
                  <span className="font-medium text-on-surface">{selectedLead.setterName}</span>
                </div>
              )}
              {(selectedLead.no_show_count || 0) > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-on-surface-variant">Bisherige Ausfälle</span>
                  <span className="font-medium text-error">{selectedLead.no_show_count}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </SlideDrawer>
    </div>
  )
}

export default Closing
