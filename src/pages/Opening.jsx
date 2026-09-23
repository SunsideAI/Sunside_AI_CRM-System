import { STATUS, stufeVonLead, STUFE_TEXT } from '../../shared/status.js'

/**
 * Wer darf einen geplatzten Termin neu legen?
 *
 * Frueher: wer als Setter eingetragen war. Nach dem OSC-Umbau bedeutet
 * setter_id aber "wer das Beratungsgespraech haelt" - der Bucher steht in
 * opener_id. Mit der alten Pruefung kam der Opener nicht mehr an seinen
 * eigenen geplatzten Termin, und der Setter darf das Opening gar nicht
 * oeffnen. Damit kam NIEMAND an diesen Pfad.
 */
function darfNachterminieren(hotLead, user) {
  if (!hotLead || !user?.id) return false
  return hotLead.openerId === user.id || hotLead.setterId === user.id
}
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import TerminPicker from '../components/TerminPicker'
import { Rollen, Pille, Statistik, webZahlen } from '../components/LeadSchublade'
import KontaktFelder from '../components/KontaktFelder'
import LeadPool from '../components/LeadPool'
import LeadTabelle from '../components/LeadTabelle'
import SpaltenWahl from '../components/SpaltenWahl'
import FilterWahl from '../components/FilterWahl'
import useTabelle from '../hooks/useTabelle'
import { zeileAusLead } from '../utils/zeile'
import { standardSpalten } from '../../shared/spalten.js'
import Verlauf from '../components/Verlauf'
import EmailComposer from '../components/EmailComposer'
import {
  ClipboardList,
  History,
  Search,
  Filter,
  Phone,
  Mail,
  Globe,
  MapPin,
  Edit3,
  Save,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  RefreshCw,
  CalendarPlus,
  Users,
  User as UserIcon,
  Send,
  Plus,
  AlertCircle,
  Lock,
  Flame
} from 'lucide-react'

// Helper: Lokales Datum als YYYY-MM-DDTHH:MM für datetime-local inputs (ohne UTC-Konvertierung)
const toLocalDateTimeString = (date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Helper: Konvertiert ISO-String oder Date zu datetime-local Format
const isoToLocalDateTimeString = (isoString) => {
  if (!isoString) return ''
  return toLocalDateTimeString(new Date(isoString))
}

// Ergebnis-Optionen (aus Airtable)
const ERGEBNIS_OPTIONEN = [
  { value: '', label: 'Kein Ergebnis', color: 'gray' },
  { value: 'Nicht erreicht', label: 'Nicht erreicht', color: 'yellow' },
  { value: 'Kein Interesse', label: 'Kein Interesse', color: 'red' },
  { value: 'Beratungsgespräch', label: 'Beratungsgespräch', color: 'green' },
  { value: 'Unterlage bereitstellen', label: 'Unterlage bereitstellen', color: 'blue' },
  { value: 'Wiedervorlage', label: 'Wiedervorlage', color: 'orange' },
  { value: 'Ungültiger Lead', label: 'Ungültiger Lead', color: 'slate' }
]

function getErgebnisColor(ergebnis) {
  const option = ERGEBNIS_OPTIONEN.find(o => o.value === ergebnis)
  const colors = {
    gray: 'bg-surface-container text-on-surface-variant',
    yellow: 'bg-warning-container text-warning',
    red: 'badge-error',
    blue: 'badge-primary',
    green: 'badge-success',
    orange: 'bg-warning-container text-warning',
    slate: 'bg-tertiary-container text-tertiary'
  }
  return colors[option?.color || 'gray']
}

// Länderflagge als Emoji
function getLandFlag(land) {
  const flags = {
    'Deutschland': '🇩🇪',
    'Österreich': '🇦🇹',
    'Schweiz': '🇨🇭'
  }
  return flags[land] || ''
}

// Alles vor dem ersten datierten Eintrag: der Rest aus einer aelteren
// Migration, den die Zeitleiste bewusst nicht uebernimmt - er hat kein Datum,
// und ein geschaetztes waere schlimmer als eine Luecke.
function altbestand(kommentar) {
  const k = kommentar || ''
  if (/^\[\d{2}\.\d{2}\.\d{4}/.test(k)) return ''
  return (k.split(/\n(?=\[\d{2}\.\d{2}\.\d{4})/)[0] || '').trim()
}

function Opening() {
  const { user, isAdmin } = useAuth()

  // Filter-State aus sessionStorage wiederherstellen
  const getStoredFilter = (key, defaultValue) => {
    try {
      const stored = sessionStorage.getItem(`opening_${key}`)
      return stored !== null ? stored : defaultValue
    } catch {
      return defaultValue
    }
  }

  // State
  const [leads, setLeads] = useState([])
  const [users, setUsers] = useState([]) // Liste aller Vertriebler für Filter
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState(getStoredFilter('search', ''))
  const [filterContacted, setFilterContacted] = useState(getStoredFilter('filterContacted', 'all'))
  const [filterResult, setFilterResult] = useState(getStoredFilter('filterResult', 'all'))
  const [filterVertriebler, setFilterVertriebler] = useState(getStoredFilter('filterVertriebler', 'all'))
  const [filterLand, setFilterLand] = useState(getStoredFilter('filterLand', 'all'))
  const [filterQuelle, setFilterQuelle] = useState(getStoredFilter('filterQuelle', 'all'))
  const [viewMode, setViewMode] = useState(getStoredFilter('viewMode', 'own'))
  const [offset, setOffset] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [pageHistory, setPageHistory] = useState([])
  
  // E-Book Pool State
  const [ebookLeads, setEbookLeads] = useState([])
  const [ebookLoading, setEbookLoading] = useState(false)
  const [ebookCount, setEbookCount] = useState(0)
  const [claimingLead, setClaimingLead] = useState(null) // ID des Leads der gerade übernommen wird
  
  // Modal State
  const [selectedLead, setSelectedLead] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const tabelle = useTabelle('opening')
  const [kommentarOnlyMode, setKommentarOnlyMode] = useState(false) // Soft Lock: Nur Kommentare für Beratungsgespräch
  const [saving, setSaving] = useState(false)
  const [showTerminPicker, setShowTerminPicker] = useState(false)
  const [showEmailComposer, setShowEmailComposer] = useState(false)
  // Nach der Buchung: die empfohlene Segment-Mail zum neuen Kontakt.
  const [segmentMail, setSegmentMail] = useState(null)
  const [showKontaktdaten, setShowKontaktdaten] = useState(false) // Kontaktdaten-Sektion ein/ausklappen

  // Hot-Lead Data für No-Show Bearbeitung durch Setter
  const [hotLeadData, setHotLeadData] = useState(null)
  const [loadingHotLead, setLoadingHotLead] = useState(false)

  // No-Show Widget: Setter's leads die nicht erschienen sind
  const [setterNoShowLeads, setSetterNoShowLeads] = useState([])
  const [loadingSetterNoShows, setLoadingSetterNoShows] = useState(false)
  const [reEngagementCollapsed, setReEngagementCollapsed] = useState(false)

  const [editForm, setEditForm] = useState({
    kontaktiert: false,
    ergebnis: '',
    kommentar: '',
    ansprechpartnerVorname: '',
    ansprechpartnerNachname: '',
    neuerKommentar: '', // Für neuen manuellen Kommentar
    ansprechpartnerValidation: false, // Für Validierung beim Button-Klick
    emailValidation: false, // Für Email-Pflichtfeld bei Termin-Buchung
    // Stammdaten (editierbar)
    telefon: '',
    email: '',
    website: '',
    // Wiedervorlage
    wiedervorlageDatum: ''
  })
  
  // Auto-Save State
  const [autoSaving, setAutoSaving] = useState(false)
  const autoSaveTimeoutRef = useRef(null)

  // Lead-Anfragen State
  const [showAnfrageModal, setShowAnfrageModal] = useState(false)
  const [anfrageAnzahl, setAnfrageAnzahl] = useState(100)
  const [anfrageNachricht, setAnfrageNachricht] = useState('')
  const [anfrageSending, setAnfrageSending] = useState(false)
  const [offeneAnfrage, setOffeneAnfrage] = useState(null)
  const [anfrageError, setAnfrageError] = useState('')

  // Leads laden
  const loadLeads = useCallback(async (newOffset = null, addToHistory = false) => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      params.append('userName', user?.vor_nachname || '')
      params.append('userId', user?.id || '')
      params.append('airtableId', user?.airtable_id || '') // Fallback für alte IDs
      params.append('userRole', isAdmin() ? 'Admin' : 'Setter')
      params.append('view', viewMode)
      params.append('limit', '50')
      
      if (search) params.append('search', search)
      if (filterContacted !== 'all') params.append('contacted', filterContacted)
      if (filterResult !== 'all') params.append('result', filterResult)
      if (filterVertriebler !== 'all') params.append('vertriebler', filterVertriebler)
      if (filterLand !== 'all') params.append('land', filterLand)
      if (filterQuelle !== 'all') params.append('quelle', filterQuelle)
      if (newOffset) params.append('offset', newOffset)
      // Die eigenen Filter des Benutzers wertet der Server aus: Bei knapp
      // 29.000 Leads reicht es nicht, die geladene Seite zu durchsuchen.
      const fertigeFilter = (tabelle.filter || []).filter(f =>
        ['leer', 'nicht_leer'].includes(f.vergleich)
        || (f.wert !== undefined && f.wert !== null && String(f.wert).trim() !== ''))
      if (fertigeFilter.length) params.append('filter', JSON.stringify(fertigeFilter))

      const response = await fetch(`/.netlify/functions/leads?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Laden')
      }

      setLeads(data.leads)
      setHasMore(data.hasMore)
      
      // User-Liste für Filter speichern (nur beim ersten Laden)
      if (data.users && data.users.length > 0) {
        setUsers(data.users)
      }
      
      if (addToHistory && offset) {
        setPageHistory(prev => [...prev, offset])
      }
      setOffset(data.offset)

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.vor_nachname, isAdmin, viewMode, search, filterContacted, filterResult, filterVertriebler, filterLand, filterQuelle, offset, tabelle.filter])

  // Initial laden
  useEffect(() => {
    if (viewMode !== 'ebook') {
      loadLeads()
    }
  }, [viewMode, search, filterContacted, filterResult, filterVertriebler, filterLand, filterQuelle, tabelle.filter])

  // Filter-State in sessionStorage persistieren
  useEffect(() => {
    try {
      sessionStorage.setItem('opening_searchInput', searchInput)
      sessionStorage.setItem('opening_filterContacted', filterContacted)
      sessionStorage.setItem('opening_filterResult', filterResult)
      sessionStorage.setItem('opening_filterVertriebler', filterVertriebler)
      sessionStorage.setItem('opening_filterLand', filterLand)
      sessionStorage.setItem('opening_filterQuelle', filterQuelle)
      sessionStorage.setItem('opening_viewMode', viewMode)
    } catch (e) {
      // sessionStorage nicht verfügbar
    }
  }, [searchInput, filterContacted, filterResult, filterVertriebler, filterLand, filterQuelle, viewMode])

  // E-Book Pool laden
  const loadEbookLeads = useCallback(async () => {
    setEbookLoading(true)
    try {
      const response = await fetch('/.netlify/functions/ebook-leads')
      if (!response.ok) throw new Error('Fehler beim Laden der E-Book Leads')
      const data = await response.json()
      setEbookLeads(data.leads || [])
      setEbookCount(data.count || 0)
    } catch (err) {
      console.error('E-Book Leads Fehler:', err)
      setEbookLeads([])
    } finally {
      setEbookLoading(false)
    }
  }, [])

  // E-Book Pool Count initial laden (für Badge)
  useEffect(() => {
    const loadEbookCount = async () => {
      try {
        const response = await fetch('/.netlify/functions/ebook-leads')
        if (response.ok) {
          const data = await response.json()
          setEbookCount(data.count || 0)
        }
      } catch (err) {
        console.error('E-Book Count Fehler:', err)
      }
    }
    loadEbookCount()
  }, [])

  // E-Book Leads laden wenn Tab gewechselt wird
  useEffect(() => {
    if (viewMode === 'ebook') {
      loadEbookLeads()
    }
  }, [viewMode, loadEbookLeads])

  // Setter Re-Engagement Leads laden (No-Show + Termin abgesagt)
  const loadSetterNoShowLeads = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoadingSetterNoShows(true)
      // Beide Status laden: "Nicht erschienen" und "Termin abgesagt"
      // Nach openerId, nicht nach setterId: Wer den Termin gelegt hat, legt den
      // neuen. setter_id meint seit dem Umbau den, der das Gespraech haelt -
      // und wird bei einer Absage ueber Calendly geleert. Mit der alten
      // Abfrage sah der Opener seine eigenen geplatzten Termine nicht.
      //
      // Die zweite Abfrage ist fuer den Altbestand: Fuenf Kontakte haben gar
      // keinen Opener, zwei davon einen Setter. Ohne sie fielen die durch.
      const stufen = 'Nicht%20erschienen,Termin%20abgesagt'
      const [alsOpener, alsSetter] = await Promise.all([
        fetch(`/.netlify/functions/hot-leads?openerId=${user.id}&status=${stufen}`)
          .then(r => r.json()).catch(() => ({ hotLeads: [] })),
        fetch(`/.netlify/functions/hot-leads?setterId=${user.id}&status=${stufen}`)
          .then(r => r.json()).catch(() => ({ hotLeads: [] }))
      ])

      const data = {
        hotLeads: [
          ...(alsOpener.hotLeads || []),
          // Nur die ohne Opener - alles andere gehoert dem Opener, der es
          // gelegt hat, und steht in DESSEN Kasten.
          ...(alsSetter.hotLeads || []).filter(hl => !hl.openerId)
        ].reduce((liste, hl) => {
          if (!liste.find(x => x.id === hl.id)) liste.push(hl)
          return liste
        }, [])
      }
      const response = { ok: true }

      if (response.ok && data.hotLeads) {
        // "Im Closing behalten"-Leads gehören nicht ins Setter-Widget - der
        // Closer bearbeitet sie selbst weiter.
        const relevant = data.hotLeads
          .filter(hl => !hl.no_show_keep_in_closing)
          // Ein geplatztes Abschlussgespraech gehoert dem Setter - es steht
          // in dessen Kasten im Setting, nicht hier.
          .filter(hl => !hl.termin_abschlussgespraech)
        const sorted = relevant.sort((a, b) => {
          // Nach Datum sortieren (neueste zuerst)
          const dateA = a.no_show_marked_at || a.terminDatum || ''
          const dateB = b.no_show_marked_at || b.terminDatum || ''
          return new Date(dateB) - new Date(dateA)
        })
        setSetterNoShowLeads(sorted)
      } else {
        setSetterNoShowLeads([])
      }
    } catch (err) {
      console.warn('Setter Re-Engagement Leads laden fehlgeschlagen:', err)
      setSetterNoShowLeads([])
    } finally {
      setLoadingSetterNoShows(false)
    }
  }, [user?.id])

  // No-Show Leads initial laden
  useEffect(() => {
    loadSetterNoShowLeads()
  }, [loadSetterNoShowLeads])

  // E-Book Lead übernehmen
  const claimEbookLead = async (lead) => {
    if (!user?.vor_nachname) return
    
    setClaimingLead(lead.id)
    try {
      const response = await fetch('/.netlify/functions/ebook-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          vertrieblerName: user.vor_nachname,
          vertrieblerId: user.id
        })
      })

      if (!response.ok) {
        throw new Error('Fehler beim Übernehmen des Leads')
      }

      // Lead aus Pool entfernen und Count aktualisieren
      setEbookLeads(prev => prev.filter(l => l.id !== lead.id))
      setEbookCount(prev => Math.max(0, prev - 1))

      // Zu "Meine Leads" wechseln und neu laden
      setViewMode('own')
      setLeads([])
      loadLeads()
      
    } catch (err) {
      console.error('Claim Error:', err)
      setError(err.message)
    } finally {
      setClaimingLead(null)
    }
  }

  // Offene Lead-Anfrage laden
  useEffect(() => {
    const loadOffeneAnfrage = async () => {
      if (!user?.id) return
      try {
        const response = await fetch(`/.netlify/functions/lead-requests?userId=${user.id}&status=Offen&isAdmin=false`)
        if (response.ok) {
          const data = await response.json()
          if (data.anfragen && data.anfragen.length > 0) {
            setOffeneAnfrage(data.anfragen[0])
          } else {
            setOffeneAnfrage(null)
          }
        }
      } catch (err) {
        console.error('Fehler beim Laden der Anfrage:', err)
      }
    }
    loadOffeneAnfrage()
  }, [user?.id])

  // Lead-Anfrage senden
  const sendLeadAnfrage = async () => {
    if (!anfrageAnzahl || anfrageAnzahl < 1) {
      setAnfrageError('Bitte gib eine gültige Anzahl ein')
      return
    }

    setAnfrageSending(true)
    setAnfrageError('')

    try {
      const response = await fetch('/.netlify/functions/lead-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          anzahl: anfrageAnzahl,
          nachricht: anfrageNachricht
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Anfrage konnte nicht gesendet werden')
      }

      // Erfolg - Modal schließen und Status aktualisieren
      setShowAnfrageModal(false)
      setOffeneAnfrage({
        anfrageId: data.anfrage.anfrageId,
        anzahl: anfrageAnzahl,
        status: 'Offen',
        erstelltAm: new Date().toISOString()
      })
      setAnfrageAnzahl(100)
      setAnfrageNachricht('')

    } catch (err) {
      setAnfrageError(err.message)
    } finally {
      setAnfrageSending(false)
    }
  }

  // Suche mit Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setOffset(null)
      setPageHistory([])
    }, 500)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Nächste Seite
  const nextPage = () => {
    if (hasMore && offset) {
      loadLeads(offset, true)
    }
  }

  // Vorherige Seite
  const prevPage = () => {
    if (pageHistory.length > 0) {
      const newHistory = [...pageHistory]
      const prevOffset = newHistory.pop()
      setPageHistory(newHistory)
      loadLeads(newHistory[newHistory.length - 1] || null, false)
    }
  }

  // Lead auswählen
  const openLead = (lead) => {
    setSelectedLead(lead)
    setHotLeadData(null) // Reset hot lead data
    setEditForm({
      kontaktiert: lead.kontaktiert,
      ergebnis: lead.ergebnis,
      kommentar: lead.kommentar,
      ansprechpartnerVorname: lead.ansprechpartnerVorname || '',
      ansprechpartnerNachname: lead.ansprechpartnerNachname || '',
      neuerKommentar: '',
      ansprechpartnerValidation: false,
      emailValidation: false,
      // Stammdaten
      telefon: lead.telefon || '',
      email: lead.email || '',
      website: lead.website || '',
      ort: lead.stadt || '',
      // Wiedervorlage - ISO-String zu datetime-local Format konvertieren
      wiedervorlageDatum: isoToLocalDateTimeString(lead.wiedervorlageDatum)
    })
    setEditMode(false)
    setShowTerminPicker(false)
    setShowEmailComposer(false)
    setShowKontaktdaten(false) // Eingeklappt starten
  }

  // Hot-Lead-Daten für Beratungsgespräch-Leads laden (für No-Show Setter-Bearbeitung)
  useEffect(() => {
    const loadHotLeadData = async () => {
      if (!selectedLead || selectedLead.ergebnis !== 'Beratungsgespräch') {
        setHotLeadData(null)
        return
      }

      setLoadingHotLead(true)
      try {
        const response = await fetch(`/.netlify/functions/hot-leads?originalLeadId=${selectedLead.id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.hotLeads && data.hotLeads.length > 0) {
            setHotLeadData(data.hotLeads[0])
          }
        }
      } catch (err) {
        console.warn('Hot-Lead-Daten laden fehlgeschlagen:', err)
      } finally {
        setLoadingHotLead(false)
      }
    }

    loadHotLeadData()
  }, [selectedLead?.id, selectedLead?.ergebnis])

  // Auto-Save für Ansprechpartner-Felder (mit Debounce)
  const autoSaveAnsprechpartner = useCallback(async (leadId, vorname, nachname) => {
    setAutoSaving(true)
    try {
      await fetch('/.netlify/functions/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          updates: {
            ansprechpartnerVorname: vorname,
            ansprechpartnerNachname: nachname
          }
        })
      })
      
      // Lead in Liste aktualisieren
      setLeads(prev => prev.map(lead => 
        lead.id === leadId 
          ? { ...lead, ansprechpartnerVorname: vorname, ansprechpartnerNachname: nachname }
          : lead
      ))
      
      // Auch selectedLead aktualisieren
      if (selectedLead?.id === leadId) {
        setSelectedLead(prev => ({ 
          ...prev, 
          ansprechpartnerVorname: vorname, 
          ansprechpartnerNachname: nachname 
        }))
      }
    } catch (err) {
      console.error('Auto-Save Fehler:', err)
    } finally {
      setAutoSaving(false)
    }
  }, [selectedLead])

  // Handler für Ansprechpartner-Änderungen mit Debounce
  const handleAnsprechpartnerChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
    
    // Debounced Auto-Save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (selectedLead) {
        const vorname = field === 'ansprechpartnerVorname' ? value : editForm.ansprechpartnerVorname
        const nachname = field === 'ansprechpartnerNachname' ? value : editForm.ansprechpartnerNachname
        autoSaveAnsprechpartner(selectedLead.id, vorname, nachname)
      }
    }, 800) // 800ms Verzögerung
  }

  // Die Maske wird beim Öffnen des Bearbeitens frisch aus dem Kontakt gefüllt
  // - wie in Setting und Closing. Vorher stand darin der Stand vom Auswählen
  // des Kontakts; nach einem Zwischenspeichern oder einer Buchung zeigte das
  // E-Mail-Feld deshalb nichts an, obwohl eine Adresse hinterlegt war.
  const bearbeitenStarten = () => {
    setEditForm(prev => ({
      ...prev,
      kontaktiert: selectedLead.kontaktiert,
      ergebnis: selectedLead.ergebnis,
      ansprechpartnerVorname: selectedLead.ansprechpartnerVorname || '',
      ansprechpartnerNachname: selectedLead.ansprechpartnerNachname || '',
      telefon: selectedLead.telefon || '',
      email: selectedLead.email || '',
      website: selectedLead.website || '',
      ort: selectedLead.stadt || '',
      // Stand beim Öffnen eine Adresse in der Maske, darf sie nicht leer
      // gespeichert werden. Woher der Wert kam, ist dabei egal.
      mailWarDa: Boolean(selectedLead.email),
      emailValidation: false,
      ansprechpartnerValidation: false
    }))
    setEditMode(true)
  }

  // Lead speichern
  const saveLead = async () => {
    if (!selectedLead) return
    
    // Validierung: Beratungsgespräch erfordert Termin-Buchung
    if (editForm.ergebnis === 'Beratungsgespräch') {
      alert('Bitte buche zuerst einen Termin über den "Termin mit Setter buchen" Button.')
      return
    }
    
    // Eine einmal hinterlegte E-Mail darf nicht leer gespeichert werden —
    // dieselbe Regel in Opening, Setting und Closing. Wo noch keine Adresse
    // steht, blockiert sie nur Terminbuchung und Mailversand, nicht die Arbeit.
    if ((editForm.mailWarDa || selectedLead.email) && !editForm.email?.trim()) {
      setEditForm(prev => ({ ...prev, emailValidation: true }))
      return
    }

    // Validierung: Wiedervorlage benötigt ein Datum
    if (editForm.ergebnis === 'Wiedervorlage' && !editForm.wiedervorlageDatum) {
      alert('Bitte gib ein Datum für die Wiedervorlage an.')
      return
    }
    
    setSaving(true)

    try {
      // History-Einträge sammeln
      const historyEntries = []
      
      // Kontaktiert geändert? (kommt zuerst in der Historie)
      if (editForm.kontaktiert !== selectedLead.kontaktiert) {
        historyEntries.push({
          action: editForm.kontaktiert ? 'kontaktiert' : 'nicht_kontaktiert',
          details: editForm.kontaktiert ? 'Als kontaktiert markiert' : 'Als nicht kontaktiert zurückgesetzt',
          userName: user?.name || 'Unbekannt'
        })
      }
      
      // Ergebnis geändert?
      if (editForm.ergebnis !== selectedLead.ergebnis) {
        const ergebnisText = editForm.ergebnis || 'Kein Ergebnis'
        historyEntries.push({
          action: 'ergebnis',
          details: `Ergebnis: ${ergebnisText}`,
          userName: user?.name || 'Unbekannt'
        })
      }
      
      // Wiedervorlage gesetzt?
      if (editForm.ergebnis === 'Wiedervorlage' && editForm.wiedervorlageDatum) {
        const wvDate = new Date(editForm.wiedervorlageDatum)
        const wvFormatted = wvDate.toLocaleDateString('de-DE', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
        })
        historyEntries.push({
          action: 'wiedervorlage',
          details: `Wiedervorlage: ${wvFormatted}`,
          userName: user?.name || 'Unbekannt'
        })
      }
      
      // Neuer Kommentar hinzugefügt?
      if (editForm.neuerKommentar && editForm.neuerKommentar.trim()) {
        historyEntries.push({
          action: 'kommentar',
          details: editForm.neuerKommentar.trim(),
          userName: user?.name || 'Unbekannt'
        })
      }

      // Kontaktdaten geändert? (automatischer Kommentar)
      const kontaktdatenAenderungen = []
      if (editForm.telefon !== (selectedLead.telefon || '')) {
        kontaktdatenAenderungen.push('Telefonnummer')
      }
      if (editForm.email !== (selectedLead.email || '')) {
        kontaktdatenAenderungen.push('E-Mail')
      }
      if (editForm.website !== (selectedLead.website || '')) {
        kontaktdatenAenderungen.push('Website')
      }
      
      if (kontaktdatenAenderungen.length > 0) {
        historyEntries.push({
          action: 'kontaktdaten',
          details: `${kontaktdatenAenderungen.join(' und ')} geändert`,
          userName: user?.name || 'Unbekannt'
        })
      }

      // Updates vorbereiten (ohne kommentar - wird über historyEntry gehandhabt)
      const updates = {
        kontaktiert: editForm.kontaktiert,
        ergebnis: editForm.ergebnis,
        ansprechpartnerVorname: editForm.ansprechpartnerVorname,
        ansprechpartnerNachname: editForm.ansprechpartnerNachname
      }
      
      // Stammdaten nur mitsenden wenn geändert
      if (editForm.telefon !== (selectedLead.telefon || '')) {
        updates.telefon = editForm.telefon
      }
      if (editForm.email !== (selectedLead.email || '')) {
        updates.email = editForm.email
      }
      if (editForm.website !== (selectedLead.website || '')) {
        updates.website = editForm.website
      }
      if (editForm.ort !== (selectedLead.stadt || '')) {
        updates.stadt = editForm.ort
      }
      
      // Wiedervorlage nur wenn Ergebnis Wiedervorlage
      if (editForm.ergebnis === 'Wiedervorlage' && editForm.wiedervorlageDatum) {
        // datetime-local gibt lokale Zeit ohne Zeitzone, konvertiere zu ISO mit Zeitzone
        updates.wiedervorlageDatum = new Date(editForm.wiedervorlageDatum).toISOString()
      } else if (selectedLead.wiedervorlageDatum) {
        // Nur löschen wenn vorher gesetzt war
        updates.wiedervorlageDatum = ''
      }

      // Wenn keine History-Einträge, normale Speicherung
      if (historyEntries.length === 0) {
        const response = await fetch('/.netlify/functions/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: selectedLead.id,
            updates
          })
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Fehler beim Speichern')
        }
      } else {
        // Jeden History-Eintrag nacheinander speichern
        let updatedKommentar = editForm.kommentar
        
        for (const entry of historyEntries) {
          const response = await fetch('/.netlify/functions/leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId: selectedLead.id,
              updates: historyEntries.indexOf(entry) === historyEntries.length - 1 ? updates : {},
              historyEntry: entry
            })
          })

          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error || 'Fehler beim Speichern')
          }
          
          const data = await response.json()
          updatedKommentar = data.lead?.kommentar || updatedKommentar
        }
        
        editForm.kommentar = updatedKommentar
      }

      // Lead in Liste aktualisieren
      setLeads(prev => prev.map(lead => 
        lead.id === selectedLead.id 
          ? { ...lead, ...updates, kommentar: editForm.kommentar }
          : lead
      ))

      // Modal aktualisieren und neuerKommentar leeren
      setSelectedLead(prev => ({ ...prev, ...updates, kommentar: editForm.kommentar }))
      setEditForm(prev => ({ ...prev, neuerKommentar: '', kommentar: editForm.kommentar }))
      setEditMode(false)

    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Soft Lock: Nur Kommentar speichern (für Beratungsgespräch-Leads)
  const saveKommentarOnly = async () => {
    if (!selectedLead || !editForm.neuerKommentar?.trim()) {
      setKommentarOnlyMode(false)
      return
    }
    
    setSaving(true)
    
    try {
      const response = await fetch('/.netlify/functions/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          historyEntry: {
            action: 'kommentar',
            details: editForm.neuerKommentar.trim(),
            userName: user?.name || 'Unbekannt'
          }
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Fehler beim Speichern')
      }
      
      const data = await response.json()
      const updatedKommentar = data.lead?.kommentar || selectedLead.kommentar
      
      // Lead in Liste aktualisieren
      setLeads(prev => prev.map(lead => 
        lead.id === selectedLead.id 
          ? { ...lead, kommentar: updatedKommentar }
          : lead
      ))
      
      // Modal aktualisieren
      setSelectedLead(prev => ({ ...prev, kommentar: updatedKommentar }))
      setEditForm(prev => ({ ...prev, neuerKommentar: '', kommentar: updatedKommentar }))
      setKommentarOnlyMode(false)
      
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Prüfen ob "Unterlagen senden" Button angezeigt werden soll
  const showUnterlagenButton = (lead) => {
    if (!lead?.ergebnis) return false
    const ergebnis = lead.ergebnis.toLowerCase()
    return ergebnis.includes('unterlage') || ergebnis.includes('unterlagen')
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="seitenkopf">
        <div>
          <h1 className="text-headline-lg font-display text-on-surface">
            {viewMode === 'ebook' ? 'E-Book Pool' : 'Opening'}
          </h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {viewMode === 'ebook'
              ? 'Warme Leads aus dem E-Book Funnel - noch kein Vertriebler zugewiesen'
              : `${leads.length} Leads geladen${isAdmin() && viewMode === 'all' ? ' (alle Leads)' : ''}`
            }
          </p>
        </div>

        <div className="seitenkopf-bedienung">
          <div>
          {/* Leads anfordern Button (für alle außer Admins optional) - nicht im E-Book Pool */}
          {!isAdmin() && viewMode !== 'ebook' && (
            <button
              onClick={() => setShowAnfrageModal(true)}
              disabled={offeneAnfrage !== null}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-label-lg transition-all duration-250 ${
                offeneAnfrage
                  ? 'bg-surface-container text-outline cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Leads anfordern</span>
              <span className="sm:hidden">Anfordern</span>
            </button>
          )}

          {/* Tab-Navigation - scrollable on mobile */}
          <div className="w-full sm:w-auto overflow-x-auto">
            <div className="umschalter">
              {/* Meine Leads */}
              <button
                onClick={() => { setViewMode('own'); setOffset(null); setPageHistory([]); setFilterVertriebler('all'); setLeads([]); }}
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

              {/* Pool Tab */}
              <button
                onClick={() => { setViewMode('ebook'); setOffset(null); setPageHistory([]); }}
                className={`umschalter-knopf ${viewMode === 'ebook' ? 'aktiv' : ''}`}
              >
                <Flame className="w-4 h-4 mr-1.5" />
                Pool
                <span className="umschalter-zahl">{ebookCount}</span>
              </button>

              {/* Alle Leads - nur für Admins */}
              {isAdmin() && (
                <button
                  onClick={() => { setViewMode('all'); setOffset(null); setPageHistory([]); setLeads([]); }}
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
          </div>

          {/* Ein Knopf fuer die ganze Seite: Liste oder E-Book-Pool, je
              nachdem was gerade zu sehen ist, und der Kasten mit den
              geplatzten Terminen dazu. */}
          <button
            onClick={() => {
              if (viewMode === 'ebook') loadEbookLeads()
              else loadLeads()
              loadSetterNoShowLeads()
            }}
            disabled={viewMode === 'ebook' ? ebookLoading : loading}
            aria-label="Aktualisieren"
            title="Aktualisieren"
            className="kopf-knopf kopf-knopf-symbol"
          >
            <RefreshCw className={`w-4 h-4 ${
              (viewMode === 'ebook' ? ebookLoading : loading) ? 'animate-spin' : ''
            }`} />
          </button>
          </div>
        </div>
      </div>

      {/* Offene Anfrage Banner */}
      {offeneAnfrage && (
        <div className="ai-highlight flex items-center gap-3">
          <Clock className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-on-surface">
              Deine Anfrage über {offeneAnfrage.anzahl} Leads wird bearbeitet
            </p>
            <p className="text-body-sm text-on-surface-variant">
              Gesendet am {new Date(offeneAnfrage.erstelltAm).toLocaleDateString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar - nur bei normalen Leads (nicht E-Book Pool) */}
      {viewMode !== 'ebook' && (
      <div className="card p-5 space-y-4">
        {/* Zeile 1: Suche */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
            <input
              type="text"
              placeholder="Firma, Name, Ort suchen..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input-field pl-10"
            />
          </div>

        </div>

        {/* Zeile 2: Filter - responsive grid on mobile */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
          {/* Filter: Kontaktiert */}
          <select
            value={filterContacted}
            onChange={(e) => { setFilterContacted(e.target.value); setOffset(null); setPageHistory([]); setLeads([]); }}
            className="select-field w-full sm:w-auto sm:min-w-[140px] text-body-sm py-2.5"
          >
            <option value="all">Alle Status</option>
            <option value="false">Nicht kontaktiert</option>
            <option value="true">Kontaktiert</option>
          </select>

          {/* Filter: Ergebnis */}
          <select
            value={filterResult}
            onChange={(e) => { setFilterResult(e.target.value); setOffset(null); setPageHistory([]); setLeads([]); }}
            className="select-field w-full sm:w-auto sm:min-w-[140px] text-body-sm py-2.5"
          >
            <option value="all">Ergebnis</option>
            {ERGEBNIS_OPTIONEN.filter(o => o.value).map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          {/* Filter: Land */}
          <select
            value={filterLand}
            onChange={(e) => { setFilterLand(e.target.value); setOffset(null); setPageHistory([]); setLeads([]); }}
            className="select-field w-full sm:w-auto sm:min-w-[120px] text-body-sm py-2.5"
          >
            <option value="all">Land</option>
            <option value="Deutschland">DE</option>
            <option value="Österreich">AT</option>
            <option value="Schweiz">CH</option>
          </select>

          {/* Filter: Quelle */}
          <select
            value={filterQuelle}
            onChange={(e) => { setFilterQuelle(e.target.value); setOffset(null); setPageHistory([]); setLeads([]); }}
            className="select-field w-full sm:w-auto sm:min-w-[120px] text-body-sm py-2.5"
          >
            <option value="all">Quelle</option>
            <option value="E-Book">E-Book</option>
            <option value="Opening">Opening</option>
            <option value="Empfehlung">Empfehlung</option>
            <option value="Website">Website</option>
            <option value="Sonstige">Sonstige</option>
          </select>

          {/* Filter: Vertriebler (nur für Admins bei "Alle Leads") */}
          {isAdmin() && viewMode === 'all' && (
            <select
              value={filterVertriebler}
              onChange={(e) => { setFilterVertriebler(e.target.value); setOffset(null); setPageHistory([]); setLeads([]); }}
              className="select-field w-full sm:w-auto sm:min-w-[140px] text-body-sm py-2.5 col-span-2 sm:col-span-1"
            >
              <option value="all">Vertriebler</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}

          {/* Reset Filter Button - zeigt an wenn Filter aktiv */}
          {(filterContacted !== 'all' || filterResult !== 'all' || filterLand !== 'all' || filterQuelle !== 'all' || filterVertriebler !== 'all') && (
            <button
              onClick={() => {
                setFilterContacted('all')
                setFilterResult('all')
                setFilterLand('all')
                setFilterQuelle('all')
                setFilterVertriebler('all')
                setSearchInput('')
                setOffset(null)
                setPageHistory([])
                setLeads([])
                // sessionStorage zurücksetzen
                try {
                  Object.keys(sessionStorage).forEach(key => {
                    if (key.startsWith('opening_')) sessionStorage.removeItem(key)
                  })
                } catch (e) {}
              }}
              className="px-3 py-2 text-body-sm text-error hover:bg-error-container rounded-lg transition-colors flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Filter zurücksetzen
            </button>
          )}

          {/* Rechts, weil beides die Darstellung steuert. */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <FilterWahl stufe="opening" filter={tabelle.filter}
                        onAendern={tabelle.filterAendern}
                        zeilen={leads.map(l => zeileAusLead('opening', l))}
                        speichert={tabelle.speichert} />
            <SpaltenWahl stufe="opening" auswahl={tabelle.spalten}
                         onAendern={tabelle.spaltenAendern} speichert={tabelle.speichert} />
          </div>
        </div>
      </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-error-container rounded-xl p-4 text-error">
          {error}
        </div>
      )}

      {/* Re-Engagement Widget: Leads die neu terminiert werden müssen */}
      {setterNoShowLeads.length > 0 && viewMode !== 'ebook' && (
        <div className="card p-5">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setReEngagementCollapsed(!reEngagementCollapsed)}
          >
            <h3 className="text-title-md font-medium text-on-surface flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary" />
              Setting-Termine neu vereinbaren ({setterNoShowLeads.length})
            </h3>
            <div className="flex items-center gap-2">
              <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${reEngagementCollapsed ? '' : 'rotate-90'}`} />
            </div>
          </div>
          {!reEngagementCollapsed && (
            <>
              <p className="text-xs text-gray-500 mb-3 mt-1">
                Diese Leads brauchen einen neuen Termin, weil der alte geplatzt ist:
                nicht erschienen oder abgesagt.
              </p>
          <div className="space-y-2">
            {setterNoShowLeads.slice(0, 5).map(lead => (
              <div
                key={lead.id}
                className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => {
                  // Hot-Lead-Daten auf Lead-Format mappen (vollständig)
                  const mappedLead = {
                    id: lead.originalLeadId,
                    unternehmensname: lead.unternehmen,
                    ansprechpartnerVorname: lead.ansprechpartnerVorname,
                    ansprechpartnerNachname: lead.ansprechpartnerNachname,
                    kategorie: lead.kategorie,
                    email: lead.email,
                    telefon: lead.telefon,
                    website: lead.website,
                    stadt: lead.ort,
                    land: lead.bundesland,
                    monatlicheBesuche: lead.monatlicheBesuche,
                    mehrwert: lead.mehrwert,
                    absprungrate: lead.absprungrate,
                    anzahlLeads: lead.anzahlLeads,
                    kommentar: lead.kommentar,
                    ergebnis: 'Beratungsgespräch',
                    kontaktiert: true
                  }
                  setSelectedLead(mappedLead)
                  setHotLeadData(lead)
                  setEditForm({
                    kontaktiert: true,
                    ergebnis: 'Beratungsgespräch',
                    kommentar: lead.kommentar || '',
                    ansprechpartnerVorname: lead.ansprechpartnerVorname || '',
                    ansprechpartnerNachname: lead.ansprechpartnerNachname || '',
                    neuerKommentar: '',
                    ansprechpartnerValidation: false,
                    emailValidation: false,
                    telefon: lead.telefon || '',
                    email: lead.email || '',
                    website: lead.website || '',
                    ort: lead.stadt || '',
                    wiedervorlageDatum: ''
                  })
                  setEditMode(true)
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">{lead.unternehmen}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <span>{lead.ansprechpartnerVorname} {lead.ansprechpartnerNachname}</span>
                    {/* Status-Badge */}
                    {lead.status === STATUS.NICHT_ERSCHIENEN ? (
                      <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-xs font-medium">
                        {(lead.no_show_count || 0) > 1 ? `${lead.no_show_count}. No-Show` : 'No-Show'}
                      </span>
                    ) : lead.status === STATUS.TERMIN_ABGESAGT ? (
                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                        Abgesagt
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(lead.no_show_marked_at || lead.terminDatum) && (
                    <span className="text-xs text-gray-500">
                      {new Date(lead.no_show_marked_at || lead.terminDatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // Email-Validierung
                      if (!lead.email || !lead.email.trim()) {
                        alert('E-Mail fehlt! Bitte zuerst eine E-Mail-Adresse beim Lead hinterlegen.')
                        return
                      }
                      // Hot-Lead-Daten auf Lead-Format mappen und direkt TerminPicker öffnen
                      const mappedLead = {
                        id: lead.originalLeadId,
                        unternehmensname: lead.unternehmen,
                        ansprechpartnerVorname: lead.ansprechpartnerVorname,
                        ansprechpartnerNachname: lead.ansprechpartnerNachname,
                        kategorie: lead.kategorie,
                        email: lead.email,
                        telefon: lead.telefon,
                        website: lead.website,
                        stadt: lead.ort,
                        ergebnis: 'Beratungsgespräch'
                      }
                      setSelectedLead(mappedLead)
                      setHotLeadData(lead)
                      setShowTerminPicker(true)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white
                               rounded-lg hover:bg-primary-container shrink-0"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    Termin buchen
                  </button>
                </div>
              </div>
            ))}
            {setterNoShowLeads.length > 5 && (
              <p className="text-xs text-gray-500 text-center pt-2">
                + {setterNoShowLeads.length - 5} weitere
              </p>
            )}
          </div>
            </>
          )}
        </div>
      )}

      {/* Normale Leads Tabelle - nur wenn nicht E-Book Pool.
          min-h wie in Closing und Setting: Die Liste reserviert ihren Platz,
          bevor die Daten da sind. Sonst ist die Seite beim Laden kurz, danach
          lang - und der Scrollbalken verhaelt sich in jedem Tab anders. */}
      {viewMode !== 'ebook' && (
      <div className="card-elevated overflow-hidden min-h-[600px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-on-surface-variant">Leads werden geladen...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-outline-variant" />
            <p className="text-title-md mb-2">Keine Leads gefunden</p>
            <p className="text-body-sm text-outline">
              {viewMode === 'own'
                ? 'Dir sind noch keine Leads zugewiesen.'
                : 'Keine Leads mit diesen Filterkriterien.'}
            </p>
          </div>
        ) : (
          <LeadTabelle
            stufe="opening"
            zeilen={leads.map(l => zeileAusLead('opening', l))}
            auswahl={tabelle.spalten
              || (isAdmin() && viewMode === 'all'
                ? [...standardSpalten('opening'), 'zustaendig']
                : null)}
            badgeFarbe={(wert) => getErgebnisColor(wert)}
            leer="Keine Leads mit diesen Filterkriterien."
            onZeile={(z) => openLead(z.roh)}
          />
        )}

        {/* Blättern: Die Leads kommen seitenweise vom Server, eine Gesamtzahl
            gibt es dort nicht - deshalb nur vor und zurück. */}
        {(hasMore || pageHistory.length > 0) && (
          <div className="flex items-center justify-between px-4 py-3 bg-surface-container/50">
            <button
              onClick={prevPage}
              disabled={pageHistory.length === 0}
              className="flex items-center px-3 py-1.5 text-body-sm text-on-surface-variant hover:text-on-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Zurück
            </button>
            <span className="text-body-sm text-on-surface-variant">
              Seite {pageHistory.length + 1}
            </span>
            <button
              onClick={nextPage}
              disabled={!hasMore}
              className="flex items-center px-3 py-1.5 text-body-sm text-on-surface-variant hover:text-on-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Weiter
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        )}
      </div>
      )}

      {/* E-Book Pool: derselbe Aufbau wie der Setter- und der Closer-Pool -
          Tabelle, Klick öffnet die Schublade, Aktion unten in der Fußleiste. */}
      {viewMode === 'ebook' && (
        <LeadPool
          laedt={ebookLoading}
          leerText="Kein E-Book-Lead im Pool. Neue erscheinen hier von allein."
          leerIcon={Flame}
          aktion={{ text: 'Übernehmen', icon: CheckCircle2 }}
          laufend={claimingLead}
          onAktion={(e, schliessen) => { schliessen?.(); claimEbookLead(e.roh) }}
          eintraege={ebookLeads.map(l => ({
            id: l.id,
            unternehmen: l.unternehmensname,
            untertitel: [l.kategorie, l.ort].filter(Boolean).join(' · '),
            ansprechpartner: [l.ansprechpartnerVorname, l.ansprechpartnerNachname]
              .filter(Boolean).join(' '),
            ort: l.ort,
            art: { icon: Flame },
            hinweis: l.datum
              ? `Eingegangen am ${new Date(l.datum).toLocaleDateString('de-DE')}`
              : 'Aus dem E-Book-Funnel',
            roh: l
          }))}
          schublade={(e) => ({
            kontakt: {
              ansprechpartner: e.ansprechpartner,
              kategorie: e.roh.kategorie,
              telefon: e.roh.telefon,
              email: e.roh.email,
              website: e.roh.website,
              ort: e.roh.ort
            },
            statistik: webZahlen(e.roh),
            verlauf: { leadId: e.roh.id }
          })}
        />
      )}

      {/* Lead Detail Drawer - Slide-in von rechts */}
      {selectedLead && createPortal(
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-scrim/50"
            onClick={() => { setSelectedLead(null); setShowTerminPicker(false); setShowEmailComposer(false); setSegmentMail(null); setKommentarOnlyMode(false); }}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-surface shadow-xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="sticky top-0 bg-surface border-b border-outline-variant px-6 py-4 flex items-center justify-between z-10 flex-shrink-0">
              <div className="min-w-0 pr-4">
                <h2 className="text-title-lg font-semibold text-on-surface truncate">{selectedLead.unternehmensname}</h2>
                {[selectedLead.kategorie, selectedLead.stadt].filter(Boolean).length > 0 && (
                  <p className="text-body-sm text-on-surface-variant truncate mt-0.5">
                    {[selectedLead.kategorie, selectedLead.stadt].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button
                onClick={() => { setSelectedLead(null); setShowTerminPicker(false); setShowEmailComposer(false); setSegmentMail(null); setKommentarOnlyMode(false); }}
                className="p-2 hover:bg-surface-container rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {showTerminPicker ? (
                // Termin-Picker anzeigen
                <TerminPicker
                  zweck="beratung"
                  lead={selectedLead}
                  onTerminBooked={async (termin) => {
                    // Bei Re-Terminierung (nicht erschienen oder abgesagt) zurueck in
                    // den vereinbarten Termin. Frueher stand hier "Im Closing" - ein
                    // mechanisch umbenanntes altes 'Im Closing', das die Uebergangs-
                    // matrix nicht erlaubt. Der Aufruf wurde mit 409 abgewiesen, es
                    // wurde NICHTS gespeichert, und der Closer bekam trotzdem eine
                    // Nachricht ueber einen Termin, den es im CRM nicht gab.
                    //
                    // Welcher Termin geplatzt ist, sagt das Abschluss-Datum: Ist es
                    // gesetzt, ging es um das Abschlussgespraech, sonst um die Beratung.
                    const isReEngagement = hotLeadData?.id && (hotLeadData?.status === STATUS.NICHT_ERSCHIENEN || hotLeadData?.status === STATUS.TERMIN_ABGESAGT)
                    if (isReEngagement) {
                      try {
                        const zielStatus = hotLeadData?.termin_abschlussgespraech
                          ? STATUS.ABSCHLUSS_VEREINBART
                          : STATUS.BERATUNG_VEREINBART

                        const antwort = await fetch('/.netlify/functions/hot-leads', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            hotLeadId: hotLeadData.id,
                            updates: {
                              status: zielStatus,
                              terminDatum: termin.datum
                            }
                          })
                        })

                        // Fehlschlag nicht verschlucken: Sonst meldet die Oberflaeche
                        // Erfolg, waehrend im CRM das alte Datum steht.
                        if (!antwort.ok) {
                          const daten = await antwort.json().catch(() => ({}))
                          alert(daten.error
                            || 'Der Termin wurde bei Calendly gebucht, im CRM aber nicht gespeichert. Bitte den Lead prüfen.')
                          return
                        }

                        // Closer über neuen Termin benachrichtigen (wenn Closer zugewiesen)
                        if (hotLeadData.closerId) {
                          const statusText = hotLeadData.status === STATUS.NICHT_ERSCHIENEN ? 'nicht erschienen' : 'abgesagt'
                          await fetch('/.netlify/functions/system-messages', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              empfaengerId: hotLeadData.closerId,
                              typ: 'termin_rescheduled',
                              titel: `📅 Neuer Termin: ${selectedLead.unternehmensname}`,
                              nachricht: `${user?.vor_nachname || 'Setter'} hat einen neuen Termin für ${selectedLead.unternehmensname} vereinbart. Der Lead war zuvor als "${statusText}" markiert.`,
                              hotLeadId: hotLeadData.id
                            })
                          })
                        }
                      } catch (err) {
                        console.error('Hot Lead Update Fehler:', err)
                      }
                    }
                    setShowTerminPicker(false)
                    loadLeads() // Leads neu laden
                    loadSetterNoShowLeads() // No-Show Widget aktualisieren

                    // Neuer Kontakt: Die Schublade bleibt offen und zeigt die
                    // empfohlene Segment-Mail. Sie soll binnen Minuten raus,
                    // solange das Telefonat frisch ist (Miro F23).
                    if (!isReEngagement && termin?.hotLeadId) {
                      setSegmentMail({ hotLeadId: termin.hotLeadId, kontakt: termin.kontakt })
                      return
                    }
                    setSelectedLead(null)
                    setEditMode(false)
                  }}
                  onCancel={() => setShowTerminPicker(false)}
                />
              ) : segmentMail ? (
                // Das Empfehlungsfenster nach der Buchung. Anders als „Unterlagen
                // senden" setzt es kein Ergebnis: Der Lead bleibt beim
                // Beratungsgespräch.
                <div className="space-y-4">
                  <div className="p-3 bg-success-container rounded-lg text-body-sm text-on-surface">
                    Der Termin steht. Jetzt die Mail mit dem passenden Video hinterher,
                    solange das Gespräch frisch ist. Bitte vor dem Senden anpassen.
                  </div>
                  <EmailComposer
                    hotLeadId={segmentMail.hotLeadId}
                    lead={selectedLead}
                    kontakt={segmentMail.kontakt}
                    user={user}
                    inline={true}
                    kategorie="Opening"
                    anlass="opening"
                    onClose={() => { setSegmentMail(null); setSelectedLead(null); setEditMode(false) }}
                    onSent={() => { setSegmentMail(null); setSelectedLead(null); setEditMode(false) }}
                  />
                </div>
              ) : showEmailComposer ? (
                // Email Composer anzeigen
                <EmailComposer
                  hotLeadId={hotLeadData?.id}
                  lead={selectedLead}
                  user={user}
                  inline={true}
                  kategorie="Opening"
                  onClose={() => setShowEmailComposer(false)}
                  onSent={async (info) => {
                    console.log('E-Mail gesendet:', info)
                    
                    // Status auf "Unterlage bereitstellen" setzen NACH erfolgreichem Versand
                    try {
                      // Prüfen ob Lead bereits kontaktiert war
                      const warBereitsKontaktiert = selectedLead.kontaktiert === true
                      
                      // 1. Updates + ggf. "Als kontaktiert markiert" History-Eintrag
                      const requestBody = {
                        leadId: selectedLead.id,
                        updates: {
                          ergebnis: 'Unterlage bereitstellen',
                          kontaktiert: true
                        }
                      }
                      
                      // Nur History-Eintrag wenn noch nicht kontaktiert
                      if (!warBereitsKontaktiert) {
                        requestBody.historyEntry = {
                          action: 'kontaktiert',
                          details: 'Als kontaktiert markiert',
                          userName: user?.name || 'System'
                        }
                      }
                      
                      await fetch('/.netlify/functions/leads', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                      })
                      
                      // 2. Dann Ergebnis-Eintrag
                      await fetch('/.netlify/functions/leads', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          leadId: selectedLead.id,
                          historyEntry: {
                            action: 'ergebnis',
                            details: 'Ergebnis: Unterlage bereitstellen',
                            userName: user?.name || 'System'
                          }
                        })
                      })
                      
                      console.log('Status auf Unterlage bereitstellen gesetzt')
                    } catch (err) {
                      console.error('Fehler beim Status-Update:', err)
                    }
                    
                    setShowEmailComposer(false)
                    setSelectedLead(null)
                    loadLeads()
                  }}
                />
              ) : (
                <>
              {/* Soft Lock Banner für Beratungsgespräch - mit Re-Engagement Ausnahme */}
              {selectedLead.ergebnis === 'Beratungsgespräch' && !kommentarOnlyMode && (
                loadingHotLead ? (
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin flex-shrink-0" />
                    <span className="text-sm text-gray-500">Status wird geladen...</span>
                  </div>
                ) : hotLeadData?.status === STATUS.NICHT_ERSCHIENEN && darfNachterminieren(hotLeadData, user) ? (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-rose-800">
                        Termin nicht stattgefunden (No-Show #{hotLeadData.no_show_count || 1})
                      </p>
                      <p className="text-xs text-rose-600">
                        Bitte neuen Termin vereinbaren oder Unterlagen erneut senden.
                      </p>
                    </div>
                  </div>
                ) : hotLeadData?.status === STATUS.TERMIN_ABGESAGT && darfNachterminieren(hotLeadData, user) ? (
                  <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">
                        Termin wurde abgesagt
                      </p>
                      <p className="text-xs text-orange-600">
                        Bitte neuen Termin vereinbaren oder Unterlagen erneut senden.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Wo der Kontakt WIRKLICH liegt. Vorher stand hier immer
                     "im Closing-Prozess", sobald ein Beratungstermin gebucht
                     war - auch wenn er noch beim Setter lag. */
                  (() => {
                    const stufe = stufeVonLead(hotLeadData || { status: STATUS.BERATUNG_VEREINBART })
                    const text = STUFE_TEXT[stufe]
                    return (
                      <div className="mb-4 p-3 bg-primary-fixed/30 border border-primary-fixed-dim rounded-lg flex items-center gap-3">
                        <Lock className="w-5 h-5 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-primary">
                            {text?.kopf || 'Dieser Lead ist weitergezogen'}
                          </p>
                          <p className="text-xs text-primary">{text?.satz}</p>
                        </div>
                      </div>
                    )
                  })()
                )
              )}

              {/* KONTAKTDATEN Section */}
              <div className="space-y-3 mb-6">
                <h3 className="abschnitt-titel flex items-center gap-2">
                    <UserIcon className="w-4 h-4" />
                    Kontaktdaten
                  </h3>

                {/* Erst wer, dann was — dieselbe Reihenfolge wie in den anderen
                    Schubladen. Vorher stand der Ansprechpartner weiter unten
                    unter "Status & Notizen". */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  <div className="min-w-0">
                    <p className="angabe-label">Ansprechpartner</p>
                    <p className="angabe-wert">
                      {[selectedLead.ansprechpartnerVorname, selectedLead.ansprechpartnerNachname]
                        .filter(Boolean).join(' ') || '–'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="angabe-label">Kategorie</p>
                    <p className="angabe-wert">{selectedLead.kategorie || '–'}</p>
                  </div>
                </div>

                {/* Contact Buttons (Pill Style) - Edit mode inline */}
                {editMode ? (
                  // Dasselbe Bauteil wie in Setting und Closing: gleiche Felder,
                  // gleiche Reihenfolge, gleiche Beschriftung. Der Name läuft
                  // weiter über handleAnsprechpartnerChange, weil er hier
                  // zwischengespeichert wird, sobald er vollständig ist.
                  <KontaktFelder
                    werte={{
                      vorname: editForm.ansprechpartnerVorname,
                      nachname: editForm.ansprechpartnerNachname,
                      telefon: editForm.telefon,
                      email: editForm.email,
                      website: editForm.website,
                      ort: editForm.ort
                    }}
                    onChange={(w) => {
                      if (w.vorname !== editForm.ansprechpartnerVorname) {
                        handleAnsprechpartnerChange('ansprechpartnerVorname', w.vorname)
                      }
                      if (w.nachname !== editForm.ansprechpartnerNachname) {
                        handleAnsprechpartnerChange('ansprechpartnerNachname', w.nachname)
                      }
                      setEditForm(prev => ({
                        ...prev,
                        telefon: w.telefon, email: w.email, website: w.website, ort: w.ort,
                        emailValidation: false, ansprechpartnerValidation: false
                      }))
                    }}
                    mailFehlt={Boolean(editForm.emailValidation && !editForm.email?.trim())}
                    notiz={autoSaving && (
                      <span className="ml-2 text-xs text-gray-400 font-normal">
                        <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
                        Speichert...
                      </span>
                    )}
                    nameFehlt={Boolean(editForm.ansprechpartnerValidation
                      && (!editForm.ansprechpartnerVorname || !editForm.ansprechpartnerNachname))}
                  />
                ) : (
                  // Dieselben Pillen wie in Setting und Closing, der Ort
                  // eingeschlossen. Vorher stand er hier als eigenes Feld.
                  <div className="flex flex-wrap gap-2">
                    {selectedLead.telefon && (
                      <Pille icon={Phone} href={`tel:${selectedLead.telefon}`}>{selectedLead.telefon}</Pille>
                    )}
                    {selectedLead.email && (
                      <Pille icon={Mail} href={`mailto:${selectedLead.email}`}>{selectedLead.email}</Pille>
                    )}
                    {selectedLead.website && (
                      <Pille icon={Globe}
                             href={selectedLead.website.startsWith('http') ? selectedLead.website : `https://${selectedLead.website}`}>
                        Website
                      </Pille>
                    )}
                    {selectedLead.stadt && (
                      <Pille icon={MapPin}>
                        {selectedLead.land && <span title={selectedLead.land} className="mr-1">{getLandFlag(selectedLead.land)}</span>}
                        {selectedLead.stadt}
                      </Pille>
                    )}
                  </div>
                )}

                {/* Wer den Kontakt hat. Der zugewiesene Vertriebler ist der
                    Opener; steht schon ein Kontakt dahinter, kommen Setter
                    und Closer dazu. */}
                <Rollen
                  opener={selectedLead.zugewiesenAn}
                  setter={hotLeadData?.setterName}
                  closer={hotLeadData?.closerName}
                />
              </div>

              {/* Website-Zahlen: derselbe Baustein wie in Setting und Closing,
                  hier offen, weil sie der Einstieg ins Telefonat sind. */}
              <div className="abschnitt-trenner mb-6">
                <Statistik anfangsOffen werte={webZahlen(selectedLead)} />
              </div>

              {/* STATUS & NOTIZEN Section */}
              <div className="space-y-4 abschnitt-trenner">
                <h3 className="abschnitt-titel flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    Status & Notizen
                  </h3>

                {editMode ? (
                  // Bearbeitungsmodus
                  <div className="space-y-4">
                    {/* Ergebnis - setzt automatisch kontaktiert: true (außer bei Ungültiger Lead) */}
                    <div>
                      <label className="feld-label">Ergebnis</label>
                      <select
                        value={editForm.ergebnis}
                        onChange={(e) => {
                          const neuesErgebnis = e.target.value
                          setEditForm(prev => ({
                            ...prev,
                            ergebnis: neuesErgebnis,
                            // Automatisch als kontaktiert markieren wenn Ergebnis gesetzt
                            // Bei "Ungültiger Lead" explizit auf FALSE setzen (zählt nicht als erreicht)
                            kontaktiert: neuesErgebnis === 'Ungültiger Lead'
                              ? false
                              : (neuesErgebnis ? true : prev.kontaktiert),
                            // Wiedervorlage-Datum zurücksetzen wenn anderes Ergebnis gewählt
                            wiedervorlageDatum: neuesErgebnis === 'Wiedervorlage' ? prev.wiedervorlageDatum : ''
                          }))
                        }}
                        className="input-field"
                      >
                        {ERGEBNIS_OPTIONEN.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      
                      {/* Wiedervorlage DateTime-Picker */}
                      {editForm.ergebnis === 'Wiedervorlage' && (
                        <div className="mt-3">
                          <label className="feld-label">
                            Wiedervorlage am <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="datetime-local"
                            value={editForm.wiedervorlageDatum || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, wiedervorlageDatum: e.target.value }))}
                            min={toLocalDateTimeString(new Date())}
                            className="input-field"
                          />
                          <p className="text-xs text-gray-500 mt-1">Wann soll der Lead erneut kontaktiert werden?</p>
                        </div>
                      )}
                    </div>

                    {/* Der Ansprechpartner steht jetzt oben bei den
                        Kontaktdaten, wie in Setting und Closing. Pflicht bleibt
                        er: Ohne Namen wird kein Termin gebucht. */}

                    {/* Termin buchen Button bei Beratungsgespräch */}
                    {editForm.ergebnis === 'Beratungsgespräch' && (
                      <button
                        onClick={() => {
                          let hasError = false
                          if (!editForm.ansprechpartnerVorname || !editForm.ansprechpartnerNachname) {
                            setEditForm(prev => ({ ...prev, ansprechpartnerValidation: true }))
                            hasError = true
                          }
                          if (!editForm.email || !editForm.email.trim()) {
                            setEditForm(prev => ({ ...prev, emailValidation: true }))
                            hasError = true
                          }
                          if (hasError) return
                          setShowTerminPicker(true)
                        }}
                        className="fuss-haupt w-full justify-center"
                      >
                        <Calendar className="w-4 h-4" />
                        Termin mit Setter buchen
                      </button>
                    )}
                    
                    {/* Unterlagen senden Button */}
                    {showUnterlagenButton({ ergebnis: editForm.ergebnis }) && (
                      <button
                        onClick={() => {
                          if (!editForm.ansprechpartnerVorname || !editForm.ansprechpartnerNachname) {
                            setEditForm(prev => ({ ...prev, ansprechpartnerValidation: true }))
                            return
                          }
                          setShowEmailComposer(true)
                        }}
                        className="fuss-neben w-full justify-center"
                      >
                        <Send className="w-4 h-4" />
                        Unterlagen senden
                      </button>
                    )}

                    {/* Neuer Kommentar. Nicht beim Beratungsgespräch: Dort füllt der
                        Opener gleich die Übergabe aus, und die hat ihr eigenes
                        Notizfeld (Feedback 21.09.: „Notizfeld hier ist Quatsch"). */}
                    {editForm.ergebnis !== 'Beratungsgespräch' && (
                      <div>
                        <label className="feld-label">Neuer Kommentar hinzufügen</label>
                        <textarea
                          value={editForm.neuerKommentar}
                          onChange={(e) => setEditForm(prev => ({ ...prev, neuerKommentar: e.target.value }))}
                          rows={2}
                          placeholder="Notiz hinzufügen..."
                          className="textarea-field"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  // Anzeigemodus
                  <div className="space-y-3">
                    <div className="flex items-center">
                      {selectedLead.kontaktiert ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400 mr-2" />
                      )}
                      <span className={selectedLead.kontaktiert ? 'text-green-700' : 'text-gray-500'}>
                        {selectedLead.kontaktiert ? 'Bereits kontaktiert' : 'Noch nicht kontaktiert'}
                      </span>
                      {selectedLead.datum && (
                        <span className="ml-2 text-sm text-gray-400">
                          ({new Date(selectedLead.datum).toLocaleDateString('de-DE')})
                        </span>
                      )}
                    </div>

                    {selectedLead.ergebnis && (
                      <div className="flex items-center">
                        <Clock className="w-5 h-5 text-gray-400 mr-2" />
                        <span className={`px-2.5 py-1 rounded-full text-sm font-medium ${getErgebnisColor(selectedLead.ergebnis)}`}>
                          {selectedLead.ergebnis}
                        </span>
                      </div>
                    )}

                  </div>
                )}
              </div>

              {/* Der Verlauf ist ein eigener Abschnitt und steht zuletzt -
                  so wie in Setting, Closing und Follow-Up. Vorher hing er
                  mitten in "Status & Notizen", weshalb er in jedem Tab an
                  einer anderen Stelle auftauchte. */}
              <div className="space-y-3 abschnitt-trenner mb-6">
                <h3 className="abschnitt-titel flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Verlauf
                </h3>

                <Verlauf leadId={selectedLead.id} />

                {/* Nur noch der Altbestand: alles, was VOR dem ersten datierten
                    Eintrag steht. Die datierten Einträge zeigt die Zeitleiste
                    darüber — sie hier nochmals aufzulisten war doppelt.
                    Betrifft 588 von 7.588 Kontakten; bei allen anderen
                    entfällt der Block ganz. */}
                {altbestand(selectedLead.kommentar) && (
                  <>
                    <div className="text-label-sm text-on-surface-variant">
                      Ältere Notizen ohne Datum
                    </div>
                    <div className="bg-surface-container-lowest rounded-xl p-4 max-h-[200px] overflow-y-auto">
                      <p className="text-body-sm text-on-surface whitespace-pre-line">
                        {altbestand(selectedLead.kommentar)}
                      </p>
                    </div>
                  </>
                )}
              </div>
                </>
              )}
            </div>

            {/* Modal Footer - nur zeigen wenn weder TerminPicker noch EmailComposer */}
            {!showTerminPicker && !showEmailComposer && (
            <div className="schublade-fuss">
                {kommentarOnlyMode ? (
                  /* Kommentar-Only Modus für gesperrte Leads */
                  <div className="w-full space-y-3">
                    <div>
                      <label className="feld-label">Kommentar hinzufügen</label>
                      <textarea
                        value={editForm.neuerKommentar}
                        onChange={(e) => setEditForm(prev => ({ ...prev, neuerKommentar: e.target.value }))}
                        rows={3}
                        autoFocus
                        placeholder="Notiz hinzufügen..."
                        className="textarea-field"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => { setKommentarOnlyMode(false); setEditForm(prev => ({ ...prev, neuerKommentar: '' })); }}
                        className="fuss-leise"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={saveKommentarOnly}
                        disabled={saving || !editForm.neuerKommentar?.trim()}
                        className="fuss-haupt"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Kommentar speichern
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full flex flex-col gap-3">
                    {/* Warnung bei Beratungsgespräch ohne Termin */}
                    {editMode && editForm.ergebnis === 'Beratungsgespräch' && (
                      <div className="flex items-center p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                        <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Bitte buche zuerst einen Termin über den Button "Termin mit Setter buchen".</span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-end gap-3">
                    {editMode ? (
                      <>
                        <button onClick={() => setEditMode(false)} className="fuss-leise">
                          Abbrechen
                        </button>
                        <button
                          onClick={saveLead}
                          disabled={saving || editForm.ergebnis === 'Beratungsgespräch'}
                          className="fuss-haupt"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Speichern
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Soft Lock: Bei Beratungsgespräch nur Kommentar-Button, AUSSER bei Re-Engagement */}
                        {selectedLead.ergebnis === 'Beratungsgespräch' ? (
                          // No-Show oder Abgesagt: Setter kann voll bearbeiten
                          (hotLeadData?.status === STATUS.NICHT_ERSCHIENEN || hotLeadData?.status === STATUS.TERMIN_ABGESAGT) && darfNachterminieren(hotLeadData, user) ? (
                            <button onClick={bearbeitenStarten} className="fuss-haupt">
                              <Calendar className="w-4 h-4" />
                              Lead neu terminieren
                            </button>
                          ) : (
                            // Normal Closing: nur Kommentar
                            <button onClick={() => setKommentarOnlyMode(true)} className="fuss-haupt">
                              <MessageSquare className="w-4 h-4" />
                              Kommentar hinzufügen
                            </button>
                          )
                        ) : (
                          <button onClick={bearbeitenStarten} className="fuss-haupt">
                            <Edit3 className="w-4 h-4" />
                            Bearbeiten
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Lead-Anfrage Modal */}
      {showAnfrageModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="modal-backdrop absolute inset-0"
            onClick={() => setShowAnfrageModal(false)}
          />
          <div className="modal-content relative w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between pb-6">
              <h2 className="text-headline-sm font-display text-on-surface">Neue Leads anfordern</h2>
              <button
                onClick={() => setShowAnfrageModal(false)}
                className="p-2 hover:bg-surface-container rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Error */}
            {anfrageError && (
              <div className="mb-4 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{anfrageError}</span>
              </div>
            )}

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="feld-label">
                  Anzahl Leads
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={anfrageAnzahl}
                  onChange={(e) => setAnfrageAnzahl(parseInt(e.target.value) || 0)}
                  className="input-field"
                />
                <p className="mt-1 text-body-sm text-muted">Empfohlen: 100-300 Leads</p>
              </div>

              <div>
                <label className="feld-label">
                  Nachricht (optional)
                </label>
                <textarea
                  value={anfrageNachricht}
                  onChange={(e) => setAnfrageNachricht(e.target.value)}
                  placeholder="z.B. Meine Liste ist fast durch..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6">
              <button
                onClick={() => setShowAnfrageModal(false)}
                className="btn-ghost"
              >
                Abbrechen
              </button>
              <button
                onClick={sendLeadAnfrage}
                disabled={anfrageSending || anfrageAnzahl < 1}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {anfrageSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Anfrage senden
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}

export default Opening
