import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Platform } from 'react-native'
import { AppUpdater } from './NativeAppUpdater'
import { compareVersions, checkIOSUpdate } from './versionCheck'
import { AppUpdaterError } from './AppUpdaterError'
import type { UpdateState, AppUpdaterEvent } from './types'

/**
 * Cache to prevent multiple simultaneous checks.
 * Uses a simple Map with FIFO eviction and access-order bumping.
 * Note: Stale entries are only pruned lazily on the next checkUpdate call,
 * which is sufficient given the small MAX_CACHE_SIZE (10).
 * This is a module-level singleton shared across all hook instances.
 */
const UPDATE_CACHE: Map<string, { data: UpdateState, timestamp: number }> = new Map()

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE = 10

// Clear cache on Fast Refresh in development
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (__DEV__ && (module as any).hot) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (module as any).hot.accept(() => UPDATE_CACHE.clear());
}

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
 * Useful for refreshing update state when the app returns from background.
 * Pro-tip: Call this in an AppState listener if you need real-time freshness.
 * @example
 * AppState.addEventListener('change', (state) => {
 *   if (state === 'active') clearUpdateCache();
 * });
 */
export function clearUpdateCache() {
  UPDATE_CACHE.clear()
}

/**
 * Manages update availability checks against Play Store (Android) and iTunes (iOS).
 * Includes a module-level cache with TTL to prevent redundant network requests.
 *
 * @returns `updateState` — current update availability, `loading` — check in progress,
 *          `checkUpdate(forceOrMock?)` — trigger a check (bypasses cache; when `debugMode` is on, also mocks update data).
 */
export function useUpdateManager(
  debugMode: boolean,
  iosCountryCode: string,
  minRequiredVersion: string,
  iosLookupTimeoutMs: number | undefined,
  emitEvent: (event: AppUpdaterEvent) => void
) {
  const [updateState, setUpdateState] = useState<UpdateState>({ available: false, critical: false })
  const [loading, setLoading] = useState(false)
  const isCheckingRef = useRef(false)
  const isMountedRef = useRef(true)
  const updateStateRef = useRef(updateState)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    updateStateRef.current = updateState
  }, [updateState])

  const emitEventRef = useRef(emitEvent)
  useEffect(() => {
    emitEventRef.current = emitEvent
  }, [emitEvent])

  const checkUpdate = useCallback(async (forceOrMock = false) => {
    // Cache key includes parameters to prevent cross-context pollution.
    // NOTE: This cache is module-level (singleton) and shared across all instances.
    const isMock = debugMode && forceOrMock
    const cacheKey = `${iosCountryCode}:${debugMode}:${minRequiredVersion}:${isMock}`
    
    // Prune stale entries before check
    pruneStaleCache()

    // Check cache
    const cached = UPDATE_CACHE.get(cacheKey)
    if (!forceOrMock && cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      // LRU bump
      UPDATE_CACHE.delete(cacheKey)
      UPDATE_CACHE.set(cacheKey, cached)
      setUpdateState(cached.data)
      return cached.data
    }

    // Return current state if already checking. 
    // Uses ref to avoid closure staleness and dependency churn.
    if (isCheckingRef.current) return updateStateRef.current

    isCheckingRef.current = true
    setLoading(true)
    
    try {
      let newState: UpdateState = { available: false, critical: false }
      
      if (isMock) {
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
        // Validate and check for updates on iOS
        const result = await checkIOSUpdate(bundleId, iosCountryCode, iosLookupTimeoutMs)
        
        if (result) {
          const isVersionNewer = compareVersions(result.version, AppUpdater.getCurrentVersion()) > 0
          
          // Dynamic OS Compatibility check
          const currentOsVersion = String(Platform.Version)
          const isOsCompatible = !result.minimumOsVersion || compareVersions(currentOsVersion, result.minimumOsVersion) >= 0

          if (isVersionNewer && isOsCompatible) {
            newState = {
              available: true,
              critical: false,
              version: result.version,
              releaseNotes: result.releaseNotes,
              trackViewUrl: result.trackViewUrl
            }
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
        if (oldestKey !== undefined) UPDATE_CACHE.delete(oldestKey)
      }

      UPDATE_CACHE.set(cacheKey, {
        data: newState,
        timestamp: Date.now()
      })
      
      if (isMountedRef.current) {
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
        // -6 is INSTALL_NOT_ALLOWED (e.g. user disabled it)
        // -10 is APP_NOT_OWNED (e.g. sideloaded)
        if (message.includes('-6') || message.includes('-10')) {
          const fallback = { available: false, critical: false }
          if (isMountedRef.current) setUpdateState(fallback)
          return fallback
        }
      }

      if (isMountedRef.current) {
        emitEventRef.current({ type: 'update_failed', payload: { error } })
      }
      throw error
    } finally {
      isCheckingRef.current = false
      if (isMountedRef.current) setLoading(false)
    }
  }, [debugMode, iosCountryCode, minRequiredVersion, iosLookupTimeoutMs])

  return useMemo(() => ({
    updateState,
    loading,
    checkUpdate
  }), [updateState, loading, checkUpdate])
}
