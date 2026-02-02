import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import TerminPicker from '../components/TerminPicker'
import EmailComposer from '../components/EmailComposer'
import {
  Search,
  Filter,
  Phone,
  Mail,
  Globe,
  MapPin,
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
  Users,
  User as UserIcon,
  Send,
  Plus,
  AlertCircle,
  Lock,
  Flame
} from 'lucide-react'

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
    gray: 'bg-gray-100 text-gray-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    orange: 'bg-orange-100 text-orange-700',
    slate: 'bg-slate-200 text-slate-700'
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

function Kaltakquise() {
  const { user, isAdmin } = useAuth()
  
  // State
  const [leads, setLeads] = useState([])
  const [users, setUsers] = useState([]) // Liste aller Vertriebler für Filter
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterContacted, setFilterContacted] = useState('all') // 'all', 'true', 'false'
  const [filterResult, setFilterResult] = useState('all')
  const [filterVertriebler, setFilterVertriebler] = useState('all') // NEU: Vertriebler-Filter
  const [filterLand, setFilterLand] = useState('all') // Land-Filter: 'all', 'Deutschland', 'Österreich', 'Schweiz'
  const [filterQuelle, setFilterQuelle] = useState('all') // Quelle-Filter: 'all', 'E-Book', 'Kaltakquise', etc.
  const [viewMode, setViewMode] = useState('own') // 'all', 'own', oder 'ebook' (für E-Book Pool)
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
  const [kommentarOnlyMode, setKommentarOnlyMode] = useState(false) // Soft Lock: Nur Kommentare für Beratungsgespräch
  const [saving, setSaving] = useState(false)
  const [showTerminPicker, setShowTerminPicker] = useState(false)
  const [showEmailComposer, setShowEmailComposer] = useState(false)
  const [showKontaktdaten, setShowKontaktdaten] = useState(false) // Kontaktdaten-Sektion ein/ausklappen
  const [editForm, setEditForm] = useState({
    kontaktiert: false,
    ergebnis: '',
    kommentar: '',
    ansprechpartnerVorname: '',
    ansprechpartnerNachname: '',
    neuerKommentar: '', // Für neuen manuellen Kommentar
    ansprechpartnerValidation: false, // Für Validierung beim Button-Klick
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
  }, [user?.id, user?.vor_nachname, isAdmin, viewMode, search, filterContacted, filterResult, filterVertriebler, filterLand, filterQuelle, offset])

  // Initial laden
  useEffect(() => {
    if (viewMode !== 'ebook') {
      loadLeads()
    }
  }, [viewMode, search, filterContacted, filterResult, filterVertriebler, filterLand, filterQuelle])

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
    setEditForm({
      kontaktiert: lead.kontaktiert,
      ergebnis: lead.ergebnis,
      kommentar: lead.kommentar,
      ansprechpartnerVorname: lead.ansprechpartnerVorname || '',
      ansprechpartnerNachname: lead.ansprechpartnerNachname || '',
      neuerKommentar: '',
      ansprechpartnerValidation: false,
      // Stammdaten
      telefon: lead.telefon || '',
      email: lead.email || '',
      website: lead.website || '',
      // Wiedervorlage
      wiedervorlageDatum: lead.wiedervorlageDatum || ''
    })
    setEditMode(false)
    setShowTerminPicker(false)
    setShowEmailComposer(false)
    setShowKontaktdaten(false) // Eingeklappt starten
  }

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

  // Lead speichern
  const saveLead = async () => {
    if (!selectedLead) return
    
    // Validierung: Beratungsgespräch erfordert Termin-Buchung
    if (editForm.ergebnis === 'Beratungsgespräch') {
      alert('Bitte buche zuerst einen Termin über den "Termin mit Closer buchen" Button.')
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
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
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
      
      // Wiedervorlage nur wenn Ergebnis Wiedervorlage
      if (editForm.ergebnis === 'Wiedervorlage') {
        updates.wiedervorlageDatum = editForm.wiedervorlageDatum
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {viewMode === 'ebook' ? 'E-Book Pool' : 'Kaltakquise'}
          </h1>
          <p className="mt-1 text-gray-500">
            {viewMode === 'ebook' 
              ? 'Warme Leads aus dem E-Book Funnel - noch kein Vertriebler zugewiesen'
              : `${leads.length} Leads geladen${isAdmin() && viewMode === 'all' ? ' (alle Leads)' : ''}`
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Leads anfordern Button (für alle außer Admins optional) - nicht im E-Book Pool */}
          {!isAdmin() && viewMode !== 'ebook' && (
            <button
              onClick={() => setShowAnfrageModal(true)}
              disabled={offeneAnfrage !== null}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                offeneAnfrage 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-sunside-primary text-white hover:bg-purple-700'
              }`}
            >
              <Plus className="w-4 h-4" />
              Leads anfordern
            </button>
          )}

          {/* Tab-Navigation - für alle User */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            {/* Meine Leads */}
            <button
              onClick={() => { setViewMode('own'); setOffset(null); setPageHistory([]); setFilterVertriebler('all'); setLeads([]); }}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'own' 
                  ? 'bg-white text-sunside-primary shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserIcon className="w-4 h-4 mr-1.5" />
              Meine Leads
            </button>

            {/* Pool Tab */}
            <button
              onClick={() => { setViewMode('ebook'); setOffset(null); setPageHistory([]); }}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'ebook' 
                  ? 'bg-white text-amber-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Flame className="w-4 h-4 mr-1.5" />
              Pool
              {ebookCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                  {ebookCount}
                </span>
              )}
            </button>

            {/* Alle Leads - nur für Admins */}
            {isAdmin() && (
              <button
                onClick={() => { setViewMode('all'); setOffset(null); setPageHistory([]); setLeads([]); }}
                className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'all' 
                    ? 'bg-white text-sunside-primary shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users className="w-4 h-4 mr-1.5" />
                Alle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Offene Anfrage Banner */}
      {offeneAnfrage && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">
              Deine Anfrage über {offeneAnfrage.anzahl} Leads wird bearbeitet
            </p>
            <p className="text-sm text-amber-600">
              Gesendet am {new Date(offeneAnfrage.erstelltAm).toLocaleDateString('de-DE', { 
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
              })}
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar - nur bei normalen Leads (nicht E-Book Pool) */}
      {viewMode !== 'ebook' && (
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        {/* Zeile 1: Suche */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Firma, Name, Ort suchen..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
            />
          </div>
          
          {/* Refresh */}
          <button
            onClick={() => loadLeads()}
            disabled={loading}
            className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Zeile 2: Filter */}
        <div className="flex flex-wrap gap-3">
          {/* Filter: Kontaktiert */}
          <select
            value={filterContacted}
            onChange={(e) => { setFilterContacted(e.target.value); setOffset(null); setPageHistory([]); setLeads([]); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none bg-white text-sm"
          >
            <option value="all">Alle Status</option>
            <option value="false">Nicht kontaktiert</option>
            <option value="true">Bereits kontaktiert</option>
          </select>

          {/* Filter: Ergebnis */}
          <select
            value={filterResult}
            onChange={(e) => { setFilterResult(e.target.value); setOffset(null); setPageHistory([]); setLeads([]); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none bg-white text-sm"
          >
            <option value="all">Alle Ergebnisse</option>
            {ERGEBNIS_OPTIONEN.filter(o => o.value).map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          {/* Filter: Land */}
          <select
            value={filterLand}
            onChange={(e) => { setFilterLand(e.target.value); setOffset(null); setPageHistory([]); setLeads([]); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none bg-white text-sm"
          >
            <option value="all">🌍 Alle Länder</option>
            <option value="Deutschland">🇩🇪 Deutschland</option>
            <option value="Österreich">🇦🇹 Österreich</option>
            <option value="Schweiz">🇨🇭 Schweiz</option>
          </select>

          {/* Filter: Quelle */}
          <select
            value={filterQuelle}
            onChange={(e) => { setFilterQuelle(e.target.value); setOffset(null); setPageHistory([]); setLeads([]); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none bg-white text-sm"
          >
            <option value="all">📋 Alle Quellen</option>
            <option value="E-Book">📚 E-Book</option>
            <option value="Kaltakquise">📞 Kaltakquise</option>
            <option value="Empfehlung">🤝 Empfehlung</option>
            <option value="Website">🌐 Website</option>
            <option value="Sonstige">📌 Sonstige</option>
          </select>

          {/* Filter: Vertriebler (nur für Admins bei "Alle Leads") */}
          {isAdmin() && viewMode === 'all' && (
            <select
              value={filterVertriebler}
              onChange={(e) => { setFilterVertriebler(e.target.value); setOffset(null); setPageHistory([]); setLeads([]); }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none bg-white text-sm"
            >
              <option value="all">👤 Alle Vertriebler</option>
              {users.map(u => (
                <option key={u.id} value={u.name}>{u.name}</option>
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
                setOffset(null)
                setPageHistory([])
                setLeads([])
              }}
              className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Normale Leads Tabelle - nur wenn nicht E-Book Pool */}
      {viewMode !== 'ebook' && (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-sunside-primary mb-4" />
            <p className="text-gray-500">Leads werden geladen...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Keine Leads gefunden</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Unternehmen
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                    Standort
                  </th>
                  {/* Vertriebler-Spalte nur bei "Alle Leads" */}
                  {isAdmin() && viewMode === 'all' && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                      Vertriebler
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                    Kontakt
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ergebnis
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden xl:table-cell">
                    Letzte Aktivität
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr 
                    key={lead.id}
                    onClick={() => openLead(lead)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    {/* Status-Indikator (nur Anzeige, kein Klick) */}
                    <td className="px-4 py-3">
                      <div
                        className={`p-1.5 rounded-full inline-flex ${
                          lead.kontaktiert 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {lead.kontaktiert ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Phone className="w-5 h-5" />
                        )}
                      </div>
                    </td>

                    {/* Unternehmen */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{lead.unternehmensname}</div>
                      <div className="text-sm text-gray-500">{lead.kategorie}</div>
                    </td>

                    {/* Standort */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center text-gray-600">
                        {lead.land && (
                          <span className="mr-1.5 text-base" title={lead.land}>{getLandFlag(lead.land)}</span>
                        )}
                        <MapPin className="w-4 h-4 mr-1.5 text-gray-400" />
                        {lead.stadt}
                      </div>
                    </td>

                    {/* Vertriebler - nur bei "Alle Leads" */}
                    {isAdmin() && viewMode === 'all' && (
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {lead.zugewiesenAn && lead.zugewiesenAn.length > 0 ? (
                          <div className="flex items-center text-gray-600">
                            <UserIcon className="w-4 h-4 mr-1.5 text-gray-400" />
                            <span className="truncate max-w-[150px]">
                              {lead.zugewiesenAn.join(', ')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                    )}

                    {/* Kontakt */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="space-y-1">
                        {lead.telefon && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                            {lead.telefon}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                            <span className="truncate max-w-[150px]">{lead.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Ergebnis */}
                    <td className="px-4 py-3">
                      {lead.ergebnis ? (
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getErgebnisColor(lead.ergebnis)}`}>
                          {lead.ergebnis}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>

                    {/* Kommentar / Letzter Eintrag */}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {lead.kommentar ? (
                        (() => {
                          // Nur den ersten (neuesten) Eintrag anzeigen
                          const firstLine = lead.kommentar.split('\n')[0]
                          const historyMatch = firstLine.match(/^\[(\d{2}\.\d{2}\.\d{4}),?\s*(\d{2}:\d{2})\]\s*(.+)$/)
                          
                          if (historyMatch) {
                            const [, datum, zeit, rest] = historyMatch
                            // Icon und Text extrahieren
                            const iconMatch = rest.match(/^(📧|📅|✅|↩️|📋|👤|💬)\s*(.+)$/)
                            const icon = iconMatch ? iconMatch[1] : '📋'
                            let text = iconMatch ? iconMatch[2] : rest
                            // Username am Ende entfernen für kürzere Anzeige
                            text = text.replace(/\s*\([^)]+\)$/, '')
                            // Text kürzen
                            if (text.length > 30) text = text.substring(0, 30) + '...'
                            
                            return (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-xs font-mono">
                                  {datum.substring(0, 6)}
                                </span>
                                <span>{icon}</span>
                                <span className="text-gray-600 truncate max-w-[120px]">{text}</span>
                              </div>
                            )
                          } else {
                            // Alter Kommentar ohne History-Format
                            return (
                              <div className="flex items-center text-sm text-gray-600">
                                <MessageSquare className="w-4 h-4 mr-1.5 text-gray-400 flex-shrink-0" />
                                <span className="truncate max-w-[150px]">{firstLine}</span>
                              </div>
                            )
                          }
                        })()
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {(hasMore || pageHistory.length > 0) && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <button
              onClick={prevPage}
              disabled={pageHistory.length === 0}
              className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Zurück
            </button>
            <span className="text-sm text-gray-500">
              Seite {pageHistory.length + 1}
            </span>
            <button
              onClick={nextPage}
              disabled={!hasMore}
              className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Weiter
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        )}
      </div>
      )}

      {/* E-Book Pool View */}
      {viewMode === 'ebook' && (
        <>
          {/* Pool Refresh Button */}
          <div className="flex justify-end">
            <button
              onClick={loadEbookLeads}
              disabled={ebookLoading}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-2 text-gray-600 ${ebookLoading ? 'animate-spin' : ''}`} />
              Aktualisieren
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {ebookLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                <span className="ml-3 text-gray-600">Pool wird geladen...</span>
              </div>
            ) : ebookLeads.length === 0 ? (
              <div className="p-12 text-center">
                <Flame className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Keine E-Book Leads im Pool</p>
                <p className="text-gray-400 mt-1">Neue Leads erscheinen hier automatisch</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {ebookLeads.map((lead) => (
                  <div 
                    key={lead.id}
                    className="p-5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Lead-Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {lead.unternehmensname || 'Unbekanntes Unternehmen'}
                          </h3>
                          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                            📚 E-Book
                          </span>
                          {lead.kategorie && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                              {lead.kategorie}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
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
                          {lead.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" />
                              {lead.email}
                            </span>
                          )}
                          {lead.telefon && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {lead.telefon}
                            </span>
                          )}
                        </div>

                        {/* Datum */}
                        {lead.datum && (
                          <p className="mt-2 text-sm text-gray-400">
                            Eingegangen am {new Date(lead.datum).toLocaleDateString('de-DE')}
                          </p>
                        )}
                      </div>

                      {/* Übernehmen Button */}
                      <button
                        onClick={() => claimEbookLead(lead)}
                        disabled={claimingLead === lead.id}
                        className="flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {claimingLead === lead.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Übernehmen
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Lead Detail Modal - Portal rendert direkt in body */}
      {selectedLead && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedLead.unternehmensname}</h2>
                <p className="text-sm text-gray-500">{selectedLead.kategorie}</p>
              </div>
              <button
                onClick={() => { setSelectedLead(null); setShowTerminPicker(false); setShowEmailComposer(false); setKommentarOnlyMode(false); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-4 overflow-y-auto flex-1">
              {showTerminPicker ? (
                // Termin-Picker anzeigen
                <TerminPicker
                  lead={selectedLead}
                  onTerminBooked={(termin) => {
                    setShowTerminPicker(false)
                    setSelectedLead(null)
                    setEditMode(false)
                    loadLeads() // Leads neu laden
                  }}
                  onCancel={() => setShowTerminPicker(false)}
                />
              ) : showEmailComposer ? (
                // Email Composer anzeigen
                <EmailComposer
                  lead={selectedLead}
                  user={user}
                  inline={true}
                  kategorie="Kaltakquise"
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
              {/* Soft Lock Banner für Beratungsgespräch */}
              {selectedLead.ergebnis === 'Beratungsgespräch' && !kommentarOnlyMode && (
                <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-3">
                  <Lock className="w-5 h-5 text-purple-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-purple-800">Dieser Lead ist im Closing-Prozess</p>
                    <p className="text-xs text-purple-600">Änderungen nur noch über die Closing-Seite. Du kannst weiterhin Kommentare hinzufügen.</p>
                  </div>
                </div>
              )}
              
              {/* Kontaktdaten */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {/* Telefon */}
                {editMode ? (
                  <div className="flex items-center p-3 bg-white border-2 border-sunside-primary/30 rounded-lg">
                    <Phone className="w-5 h-5 text-sunside-primary mr-3" />
                    <input
                      type="tel"
                      value={editForm.telefon}
                      onChange={(e) => setEditForm(prev => ({ ...prev, telefon: e.target.value }))}
                      placeholder="Telefonnummer eingeben..."
                      className="flex-1 bg-transparent outline-none text-gray-900"
                    />
                  </div>
                ) : selectedLead.telefon ? (
                  <a 
                    href={`tel:${selectedLead.telefon}`}
                    className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Phone className="w-5 h-5 text-sunside-primary mr-3" />
                    <span className="text-gray-900">{selectedLead.telefon}</span>
                  </a>
                ) : (
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg text-gray-400">
                    <Phone className="w-5 h-5 mr-3" />
                    <span>Keine Telefonnummer</span>
                  </div>
                )}

                {/* E-Mail */}
                {editMode ? (
                  <div className="flex items-center p-3 bg-white border-2 border-sunside-primary/30 rounded-lg">
                    <Mail className="w-5 h-5 text-sunside-primary mr-3" />
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="E-Mail eingeben..."
                      className="flex-1 bg-transparent outline-none text-gray-900"
                    />
                  </div>
                ) : selectedLead.email ? (
                  <a 
                    href={`mailto:${selectedLead.email}`}
                    className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Mail className="w-5 h-5 text-sunside-primary mr-3" />
                    <span className="text-gray-900 truncate">{selectedLead.email}</span>
                  </a>
                ) : (
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg text-gray-400">
                    <Mail className="w-5 h-5 mr-3" />
                    <span>Keine E-Mail</span>
                  </div>
                )}

                {/* Website */}
                {editMode ? (
                  <div className="flex items-center p-3 bg-white border-2 border-sunside-primary/30 rounded-lg">
                    <Globe className="w-5 h-5 text-sunside-primary mr-3" />
                    <input
                      type="url"
                      value={editForm.website}
                      onChange={(e) => setEditForm(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="Website eingeben..."
                      className="flex-1 bg-transparent outline-none text-gray-900"
                    />
                  </div>
                ) : selectedLead.website ? (
                  <a 
                    href={selectedLead.website.startsWith('http') ? selectedLead.website : `https://${selectedLead.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Globe className="w-5 h-5 text-sunside-primary mr-3" />
                    <span className="text-gray-900 truncate">{selectedLead.website}</span>
                  </a>
                ) : (
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg text-gray-400">
                    <Globe className="w-5 h-5 mr-3" />
                    <span>Keine Website</span>
                  </div>
                )}

                {/* Standort - nicht editierbar */}
                <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                  {selectedLead.land && (
                    <span className="text-xl mr-2" title={selectedLead.land}>{getLandFlag(selectedLead.land)}</span>
                  )}
                  <MapPin className="w-5 h-5 text-sunside-primary mr-3" />
                  <span className="text-gray-900">{selectedLead.stadt}</span>
                </div>
                {/* Vertriebler anzeigen wenn vorhanden */}
                {selectedLead.zugewiesenAn && selectedLead.zugewiesenAn.length > 0 && (
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <UserIcon className="w-5 h-5 text-sunside-primary mr-3" />
                    <div>
                      <span className="text-xs text-gray-400">Zugewiesen an</span>
                      <p className="text-gray-900">{selectedLead.zugewiesenAn.join(', ')}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Website-Statistiken - immer anzeigen */}
              <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <Building2 className="w-4 h-4 mr-2 text-purple-600" />
                  Website-Statistiken
                </h4>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-xs text-gray-500">Besucher/Monat</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedLead.monatlicheBesuche !== null && selectedLead.monatlicheBesuche !== undefined
                        ? selectedLead.monatlicheBesuche.toLocaleString('de-DE')
                        : '-'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-xs text-gray-500">Mehrwert</p>
                    <p className="text-lg font-semibold text-green-600">
                      {selectedLead.mehrwert !== null && selectedLead.mehrwert !== undefined
                        ? `${selectedLead.mehrwert.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`
                        : '-'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-xs text-gray-500">Absprungrate</p>
                    <p className={`text-lg font-semibold ${
                      selectedLead.absprungrate === null || selectedLead.absprungrate === undefined ? 'text-gray-400' :
                      (parseFloat(selectedLead.absprungrate) * 100) > 60 ? 'text-red-600' : 
                      (parseFloat(selectedLead.absprungrate) * 100) > 40 ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {selectedLead.absprungrate !== null && selectedLead.absprungrate !== undefined
                        ? `${Math.round(parseFloat(selectedLead.absprungrate) * 100)}%`
                        : '-'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-xs text-gray-500">Leads/Monat</p>
                    <p className="text-lg font-semibold text-blue-600">
                      {selectedLead.anzahlLeads !== null && selectedLead.anzahlLeads !== undefined
                        ? selectedLead.anzahlLeads
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status & Bearbeitung */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Status & Notizen</h3>

                {editMode ? (
                  // Bearbeitungsmodus
                  <div className="space-y-4">
                    {/* Ergebnis - setzt automatisch kontaktiert: true (außer bei Ungültiger Lead) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ergebnis</label>
                      <select
                        value={editForm.ergebnis}
                        onChange={(e) => {
                          const neuesErgebnis = e.target.value
                          setEditForm(prev => ({ 
                            ...prev, 
                            ergebnis: neuesErgebnis,
                            // Automatisch als kontaktiert markieren wenn Ergebnis gesetzt (NICHT bei Ungültiger Lead)
                            kontaktiert: (neuesErgebnis && neuesErgebnis !== 'Ungültiger Lead') ? true : prev.kontaktiert,
                            // Wiedervorlage-Datum zurücksetzen wenn anderes Ergebnis gewählt
                            wiedervorlageDatum: neuesErgebnis === 'Wiedervorlage' ? prev.wiedervorlageDatum : ''
                          }))
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
                      >
                        {ERGEBNIS_OPTIONEN.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      
                      {/* Wiedervorlage DateTime-Picker */}
                      {editForm.ergebnis === 'Wiedervorlage' && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Wiedervorlage am <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="datetime-local"
                            value={editForm.wiedervorlageDatum || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, wiedervorlageDatum: e.target.value }))}
                            min={new Date().toISOString().slice(0, 16)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
                          />
                          <p className="text-xs text-gray-500 mt-1">Wann soll der Lead erneut kontaktiert werden?</p>
                        </div>
                      )}
                    </div>

                    {/* Ansprechpartner - PFLICHTFELD (vor den Buttons!) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ansprechpartner <span className="text-red-500">*</span>
                        {autoSaving && (
                          <span className="ml-2 text-xs text-gray-400 font-normal">
                            <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
                            Speichert...
                          </span>
                        )}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editForm.ansprechpartnerVorname}
                          onChange={(e) => {
                            handleAnsprechpartnerChange('ansprechpartnerVorname', e.target.value)
                            setEditForm(prev => ({ ...prev, ansprechpartnerValidation: false }))
                          }}
                          placeholder="Vorname *"
                          className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none ${
                            editForm.ansprechpartnerValidation && !editForm.ansprechpartnerVorname 
                              ? 'border-red-500 bg-red-50' 
                              : 'border-gray-300'
                          }`}
                        />
                        <input
                          type="text"
                          value={editForm.ansprechpartnerNachname}
                          onChange={(e) => {
                            handleAnsprechpartnerChange('ansprechpartnerNachname', e.target.value)
                            setEditForm(prev => ({ ...prev, ansprechpartnerValidation: false }))
                          }}
                          placeholder="Nachname *"
                          className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none ${
                            editForm.ansprechpartnerValidation && !editForm.ansprechpartnerNachname 
                              ? 'border-red-500 bg-red-50' 
                              : 'border-gray-300'
                          }`}
                        />
                      </div>
                    </div>
                      
                    {/* Termin buchen Button bei Beratungsgespräch */}
                    {editForm.ergebnis === 'Beratungsgespräch' && (
                      <button
                        onClick={() => {
                          if (!editForm.ansprechpartnerVorname || !editForm.ansprechpartnerNachname) {
                            // Felder rot markieren durch State-Update
                            setEditForm(prev => ({ ...prev, ansprechpartnerValidation: true }))
                            return
                          }
                          setShowTerminPicker(true)
                        }}
                        className="w-full flex items-center justify-center px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Termin mit Closer buchen
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
                        className="w-full flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Unterlagen senden
                      </button>
                    )}

                    {/* Neuer Kommentar */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Neuer Kommentar hinzufügen</label>
                      <textarea
                        value={editForm.neuerKommentar}
                        onChange={(e) => setEditForm(prev => ({ ...prev, neuerKommentar: e.target.value }))}
                        rows={2}
                        placeholder="Notiz hinzufügen..."
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none resize-none"
                      />
                    </div>
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

                    {(selectedLead.ansprechpartnerVorname || selectedLead.ansprechpartnerNachname) && (
                      <div className="flex items-center">
                        <UserIcon className="w-5 h-5 text-gray-400 mr-2" />
                        <span className="text-gray-700">
                          {[selectedLead.ansprechpartnerVorname, selectedLead.ansprechpartnerNachname].filter(Boolean).join(' ')}
                        </span>
                      </div>
                    )}

                    {/* History / Kommentar Anzeige */}
                    {selectedLead.kommentar && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center">
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Verlauf
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {selectedLead.kommentar.split('\n').filter(line => line.trim()).map((line, index) => {
                            // Parse History-Eintrag: [DD.MM.YYYY, HH:MM] ICON Text (Username)
                            const historyMatch = line.match(/^\[(\d{2}\.\d{2}\.\d{4}),?\s*(\d{2}:\d{2})\]\s*(.+)$/)
                            
                            if (historyMatch) {
                              const [, datum, zeit, rest] = historyMatch
                              // Icon und Text extrahieren
                              const iconMatch = rest.match(/^(📧|📅|✅|↩️|📋|👤|💬)\s*(.+)$/)
                              const icon = iconMatch ? iconMatch[1] : '📋'
                              const text = iconMatch ? iconMatch[2] : rest
                              
                              return (
                                <div key={index} className="flex items-start gap-2 text-sm">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-xs font-mono whitespace-nowrap">
                                    {datum}, {zeit}
                                  </span>
                                  <span className="text-base">{icon}</span>
                                  <span className="text-gray-700 flex-1">{text}</span>
                                </div>
                              )
                            } else {
                              // Alter Kommentar ohne History-Format
                              return (
                                <div key={index} className="flex items-start gap-2 text-sm">
                                  <span className="text-gray-600">{line}</span>
                                </div>
                              )
                            }
                          })}
                        </div>
                      </div>
                    )}

                    {!selectedLead.kontaktiert && !selectedLead.ergebnis && !selectedLead.kommentar && (
                      <p className="text-gray-400 italic">Noch keine Notizen vorhanden</p>
                    )}
                  </div>
                )}
              </div>
                </>
              )}
            </div>

            {/* Modal Footer - nur zeigen wenn weder TerminPicker noch EmailComposer */}
            {!showTerminPicker && !showEmailComposer && (
            <div className="border-t border-gray-200 bg-gray-50 flex-shrink-0 rounded-b-2xl">
                {kommentarOnlyMode ? (
                  /* Kommentar-Only Modus für gesperrte Leads */
                  <div className="px-6 py-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kommentar hinzufügen</label>
                      <textarea
                        value={editForm.neuerKommentar}
                        onChange={(e) => setEditForm(prev => ({ ...prev, neuerKommentar: e.target.value }))}
                        rows={3}
                        autoFocus
                        placeholder="Notiz hinzufügen..."
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => { setKommentarOnlyMode(false); setEditForm(prev => ({ ...prev, neuerKommentar: '' })); }}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={saveKommentarOnly}
                        disabled={saving || !editForm.neuerKommentar?.trim()}
                        className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Kommentar speichern
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 px-6 py-4">
                    {/* Warnung bei Beratungsgespräch ohne Termin */}
                    {editMode && editForm.ergebnis === 'Beratungsgespräch' && (
                      <div className="flex items-center p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                        <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Bitte buche zuerst einen Termin über den Button "Termin mit Closer buchen".</span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-end gap-3">
                    {editMode ? (
                      <>
                        <button
                          onClick={() => setEditMode(false)}
                          className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          Abbrechen
                        </button>
                        <button
                          onClick={saveLead}
                          disabled={saving || editForm.ergebnis === 'Beratungsgespräch'}
                          className="flex items-center px-4 py-2 bg-sunside-primary text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Speichern
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setSelectedLead(null); setShowTerminPicker(false); setShowEmailComposer(false); setKommentarOnlyMode(false); }}
                          className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          Schließen
                        </button>
                        {/* Soft Lock: Bei Beratungsgespräch nur Kommentar-Button, sonst Bearbeiten */}
                        {selectedLead.ergebnis === 'Beratungsgespräch' ? (
                          <button
                            onClick={() => setKommentarOnlyMode(true)}
                            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Kommentar hinzufügen
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditMode(true)}
                            className="px-4 py-2 bg-sunside-primary text-white rounded-lg hover:bg-purple-700 transition-colors"
                          >
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
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAnfrageModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Neue Leads anfordern</h2>
              <button
                onClick={() => setShowAnfrageModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Error */}
            {anfrageError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{anfrageError}</span>
              </div>
            )}

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anzahl Leads
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={anfrageAnzahl}
                  onChange={(e) => setAnfrageAnzahl(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none"
                />
                <p className="mt-1 text-sm text-gray-500">Empfohlen: 100-300 Leads</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nachricht (optional)
                </label>
                <textarea
                  value={anfrageNachricht}
                  onChange={(e) => setAnfrageNachricht(e.target.value)}
                  placeholder="z.B. Meine Liste ist fast durch..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sunside-primary focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAnfrageModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={sendLeadAnfrage}
                disabled={anfrageSending || anfrageAnzahl < 1}
                className="flex items-center gap-2 px-4 py-2 bg-sunside-primary text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

export default Kaltakquise
