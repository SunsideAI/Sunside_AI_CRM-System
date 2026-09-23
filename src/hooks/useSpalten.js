import { useState, useEffect, useCallback } from 'react'

// Die Spaltenauswahl eines Benutzers, geladen und gespeichert.
//
// Geschrieben wird in users.preferences (siehe netlify/functions/
// tabellen-spalten.js). Damit die Liste nicht wartet, zeigt die Oberfläche die
// Änderung sofort und schickt sie danach weg; scheitert das Speichern, steht
// der alte Stand wieder da und eine Meldung dabei.

const PFAD = '/.netlify/functions/tabellen-spalten'

export default function useSpalten(stufe) {
  const [auswahl, setAuswahl] = useState(null)
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    let abgebrochen = false
    fetch(PFAD)
      .then(a => a.ok ? a.json() : { tabellen: {} })
      .then(d => { if (!abgebrochen) setAuswahl(d?.tabellen?.[stufe] || null) })
      .catch(() => {})
    return () => { abgebrochen = true }
  }, [stufe])

  const aendern = useCallback(async (neu) => {
    const vorher = auswahl
    setAuswahl(neu)
    setSpeichert(true); setFehler('')
    try {
      const antwort = await fetch(PFAD, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stufe, spalten: neu })
      })
      if (!antwort.ok) {
        const daten = await antwort.json().catch(() => ({}))
        throw new Error(daten.error || 'Konnte nicht gespeichert werden')
      }
    } catch (e) {
      setAuswahl(vorher)
      setFehler('Spalten nicht gespeichert: ' + e.message)
    } finally {
      setSpeichert(false)
    }
  }, [auswahl, stufe])

  return { auswahl, aendern, speichert, fehler }
}
