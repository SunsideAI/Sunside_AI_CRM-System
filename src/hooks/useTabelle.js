import { useState, useEffect, useCallback } from 'react'

// Spalten und Filter einer Liste, wie dieser Benutzer sie eingestellt hat.
//
// Beides liegt zusammen in users.preferences (siehe netlify/functions/
// tabellen-spalten.js) und gilt damit auf jedem Gerät. Die Oberfläche zeigt
// eine Änderung sofort und schickt sie danach weg; scheitert das Speichern,
// steht der alte Stand wieder da.

const PFAD = '/.netlify/functions/tabellen-spalten'

export default function useTabelle(stufe) {
  const [spalten, setSpalten] = useState(null)
  const [filter, setFilter] = useState([])
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    let abgebrochen = false
    fetch(PFAD)
      .then(a => a.ok ? a.json() : { tabellen: {} })
      .then(d => {
        if (abgebrochen) return
        const eintrag = d?.tabellen?.[stufe]
        setSpalten(Array.isArray(eintrag) ? eintrag : (eintrag?.spalten || null))
        setFilter(Array.isArray(eintrag) ? [] : (eintrag?.filter || []))
      })
      .catch(() => {})
    return () => { abgebrochen = true }
  }, [stufe])

  const senden = useCallback(async (teil, zuruecksetzen) => {
    setSpeichert(true); setFehler('')
    try {
      const antwort = await fetch(PFAD, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stufe, ...teil })
      })
      if (!antwort.ok) {
        const daten = await antwort.json().catch(() => ({}))
        throw new Error(daten.error || 'Konnte nicht gespeichert werden')
      }
    } catch (e) {
      zuruecksetzen()
      setFehler('Nicht gespeichert: ' + e.message)
    } finally {
      setSpeichert(false)
    }
  }, [stufe])

  const spaltenAendern = useCallback((neu) => {
    const vorher = spalten
    setSpalten(neu)
    senden({ spalten: neu }, () => setSpalten(vorher))
  }, [spalten, senden])

  const filterAendern = useCallback((neu) => {
    const vorher = filter
    setFilter(neu)
    // Halbfertige Zeilen (Wert noch leer) bleiben sichtbar, gehen aber nicht
    // zum Server: Sie würden dort aussortiert und kämen als Sprung zurück.
    const fertig = neu.filter(f => f.vergleich === 'leer' || f.vergleich === 'nicht_leer'
      || (f.wert !== undefined && f.wert !== null && String(f.wert).trim() !== ''))
    senden({ filter: fertig }, () => setFilter(vorher))
  }, [filter, senden])

  return { spalten, filter, spaltenAendern, filterAendern, speichert, fehler }
}
