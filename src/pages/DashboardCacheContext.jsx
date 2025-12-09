import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const DashboardCacheContext = createContext(null)

// Cache-Dauer: 5 Minuten
const CACHE_DURATION = 5 * 60 * 1000

export function DashboardCacheProvider({ children }) {
  const [cache, setCache] = useState(() => {
    // Versuche aus localStorage zu laden
    try {
      const stored = localStorage.getItem('dashboard_cache')
      if (stored) {
        const parsed = JSON.parse(stored)
        // Prüfe ob Cache noch gültig
        if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_DURATION) {
          return parsed
        }
      }
    } catch (e) {
      console.error('Cache load error:', e)
    }
    return null
  })
  
  const [loading, setLoading] = useState(false)
  const [lastFetch, setLastFetch] = useState(cache?.timestamp || null)

  // Cache speichern
  const saveToCache = useCallback((data) => {
    const cacheData = {
      ...data,
      timestamp: Date.now()
    }
    setCache(cacheData)
    setLastFetch(Date.now())
    
    try {
      localStorage.setItem('dashboard_cache', JSON.stringify(cacheData))
    } catch (e) {
      console.error('Cache save error:', e)
    }
  }, [])

  // Daten laden
  const fetchDashboardData = useCallback(async (userName, userRole, forceRefresh = false) => {
    // Wenn Cache gültig und kein Force-Refresh, nichts tun
    if (!forceRefresh && cache && lastFetch && Date.now() - lastFetch < CACHE_DURATION) {
      return cache
    }

    setLoading(true)
    
    try {
      const params = new URLSearchParams()
      params.append('userName', userName || '')
      params.append('userRole', userRole || 'Setter')

      const response = await fetch(`/.netlify/functions/dashboard?${params.toString()}`)
      const result = await response.json()

      if (response.ok) {
        saveToCache(result)
        return result
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
    
    return cache // Fallback zu gecachten Daten
  }, [cache, lastFetch, saveToCache])

  // Hintergrund-Refresh
  const refreshInBackground = useCallback(async (userName, userRole) => {
    // Nicht anzeigen dass geladen wird (Hintergrund)
    try {
      const params = new URLSearchParams()
      params.append('userName', userName || '')
      params.append('userRole', userRole || 'Setter')

      const response = await fetch(`/.netlify/functions/dashboard?${params.toString()}`)
      const result = await response.json()

      if (response.ok) {
        saveToCache(result)
      }
    } catch (err) {
      console.error('Background refresh error:', err)
    }
  }, [saveToCache])

  // Cache invalidieren
  const invalidateCache = useCallback(() => {
    setCache(null)
    setLastFetch(null)
    localStorage.removeItem('dashboard_cache')
  }, [])

  const value = {
    cache,
    loading,
    lastFetch,
    fetchDashboardData,
    refreshInBackground,
    invalidateCache,
    isCacheValid: cache && lastFetch && Date.now() - lastFetch < CACHE_DURATION
  }

  return (
    <DashboardCacheContext.Provider value={value}>
      {children}
    </DashboardCacheContext.Provider>
  )
}

export function useDashboardCache() {
  const context = useContext(DashboardCacheContext)
  if (!context) {
    throw new Error('useDashboardCache must be used within DashboardCacheProvider')
  }
  return context
}
