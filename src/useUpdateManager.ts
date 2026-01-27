import { useState, useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { AppUpdater } from './NativeAppUpdater'
import { compareVersions, checkIOSUpdate } from './versionCheck'
import { AppUpdaterError } from './AppUpdaterError'
import type { UpdateState, AppUpdaterEvent } from './types'

// Cache to prevent multiple simultaneous checks
const UPDATE_CACHE: Map<string, { data: UpdateState, timestamp: number }> = new Map()

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE = 10

/**
 * Prunes expired entries from the update cache.
 */
function pruneStaleCache() {
  const now = Date.now()
  for (const [key, value] of UPDATE_CACHE) {
    if (now - value.timestamp > CACHE_TTL) {
      UPDATE_CACHE.delete(key)
    }
  }
}

/**
 * Manually clears the update check cache.
 */
export function clearUpdateCache() {
  UPDATE_CACHE.clear()
}

export function useUpdateManager(
  debugMode: boolean,
  iosCountryCode: string,
  minOsVersion: string,
  minRequiredVersion: string,
  emitEvent: (event: AppUpdaterEvent) => void
) {
  const [updateState, setUpdateState] = useState<UpdateState>({ available: false, critical: false })
  const [loading, setLoading] = useState(false)
  const isCheckingRef = useRef(false)
  const isMounted = useRef(true)

  const emitEventRef = useRef(emitEvent)
  useEffect(() => {
    emitEventRef.current = emitEvent
  }, [emitEvent])

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const checkUpdate = useCallback(async (force = false) => {
    const cacheKey = `${iosCountryCode}:${debugMode}:${minOsVersion}:${minRequiredVersion}`
    
    // Prune stale entries before check
    pruneStaleCache()

    // Check cache
    const cached = UPDATE_CACHE.get(cacheKey)
    if (!force && cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      setUpdateState(cached.data)
      return cached.data
    }

    // Early exit if OS not supported
    if (minOsVersion && !debugMode) {
      const currentVersion = Platform.Version
      const currentOs = Platform.OS === 'ios' ? String(currentVersion) : String(currentVersion || '')
      if (currentOs && compareVersions(currentOs, minOsVersion) < 0) {
        const newState = { available: false, critical: false }
        setUpdateState(newState)
        return newState
      }
    }

    if (isCheckingRef.current) return { available: false, critical: false }

    isCheckingRef.current = true
    setLoading(true)
    try {
      let newState: UpdateState = { available: false, critical: false }
      
      if (debugMode) {
        newState = {
          available: true,
          critical: false,
          version: '9.9.9',
          versionCode: '999',
          releaseNotes: 'This is a simulated update for testing purposes. It contains mock features and bug fixes.'
        }
      } else if (Platform.OS === 'android') {
        const info = await AppUpdater.checkPlayStoreUpdate()
        newState = {
          available: info.available,
          critical: false, // Default for flexible updates
          versionCode: info.versionCode?.toString()
        }
      } else if (Platform.OS === 'ios') {
        const bundleId = AppUpdater.getBundleId()
        const currentVersion = AppUpdater.getCurrentVersion()
        const result = await checkIOSUpdate(bundleId, iosCountryCode)
        
        if (result && compareVersions(result.version, currentVersion) > 0) {
          newState = {
            available: true,
            critical: false,
            version: result.version,
            releaseNotes: result.releaseNotes,
            trackViewUrl: result.trackViewUrl
          }
        }
      }

      // Final local checks (Min required version)
      if (newState.available) {
        const currentVersion = AppUpdater.getCurrentVersion()
        if (minRequiredVersion && compareVersions(currentVersion, minRequiredVersion) < 0) {
          newState.critical = true
        }
      }

      // Maintain cache size
      if (UPDATE_CACHE.size >= MAX_CACHE_SIZE) {
        const oldestKey = UPDATE_CACHE.keys().next().value
        if (oldestKey) UPDATE_CACHE.delete(oldestKey)
      }

      UPDATE_CACHE.set(cacheKey, {
        data: newState,
        timestamp: Date.now()
      })
      
      if (isMounted.current) {
        setUpdateState(newState)
        if (newState.available) {
          const version = newState.version || newState.versionCode || '0.0.0'
          emitEventRef.current({ type: 'update_available', payload: { version } })
        }
      }
      return newState
    } catch (e: unknown) {
      const error = AppUpdaterError.fromNative(e)
      
      if (Platform.OS === 'android') {
        const message = e instanceof Error ? e.message : String(e)
        if (message.includes('-6')) {
          // -6 is INSTALL_NOT_ALLOWED (e.g. user disabled it)
          const fallback = { available: false, critical: false }
          if (isMounted.current) setUpdateState(fallback)
          return fallback
        }
      }

      if (isMounted.current) emitEventRef.current({ type: 'update_dismissed', payload: { error } })
      throw error
    } finally {
      isCheckingRef.current = false
      if (isMounted.current) setLoading(false)
    }
  }, [debugMode, iosCountryCode, minOsVersion, minRequiredVersion])

  return {
    updateState,
    loading,
    checkUpdate
  }
}
