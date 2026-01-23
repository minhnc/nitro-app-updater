import { useState, useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { AppUpdater } from './NativeAppUpdater'
import { compareVersions, checkIOSUpdate } from './versionCheck'
import { AppUpdaterError } from './AppUpdaterError'
import type { UpdateState, AppUpdaterEvent } from './types'

// Cache to prevent multiple simultaneous checks
const UPDATE_CACHE: Record<string, { data: UpdateState, timestamp: number }> = {}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function clearUpdateCache() {
  Object.keys(UPDATE_CACHE).forEach(key => delete UPDATE_CACHE[key])
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

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const checkUpdate = useCallback(async (force = false) => {
    const cacheKey = `${iosCountryCode}:${debugMode}:${minOsVersion}:${minRequiredVersion}`
    
    // Check cache
    if (!force && UPDATE_CACHE[cacheKey] && (Date.now() - UPDATE_CACHE[cacheKey].timestamp < CACHE_TTL)) {
      setUpdateState(UPDATE_CACHE[cacheKey].data)
      return UPDATE_CACHE[cacheKey].data
    }

    // Early exit if OS not supported
    if (minOsVersion && !debugMode) {
      const currentVersion = Platform.Version
      const currentOs = Platform.OS === 'ios' ? String(currentVersion) : String(currentVersion || '')
      if (currentOs && compareVersions(currentOs, minOsVersion) < 0) {
        if (__DEV__) console.warn(`[AppUpdater] Current OS version ${currentOs} is lower than required ${minOsVersion}. Skipping check.`)
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
        if (minRequiredVersion && newState.version) {
          if (compareVersions(newState.version, minRequiredVersion) >= 0) {
            newState.critical = true
          }
        }
      }

      UPDATE_CACHE[cacheKey] = {
        data: newState,
        timestamp: Date.now()
      }
      
      if (isMounted.current) {
        setUpdateState(newState)
        if (newState.available) {
          const version = newState.version || newState.versionCode || '0.0.0'
          emitEvent({ type: 'update_available', payload: { version } })
        }
      }
      return newState
    } catch (e: unknown) {
      const error = AppUpdaterError.fromNative(e)
      
      if (Platform.OS === 'android') {
        const message = e instanceof Error ? e.message : String(e)
        if (message.includes('-6')) {
          if (__DEV__) console.log('[AppUpdater] Play Store check failed: Install not allowed (-6). This is common on emulators without a real account. Use debugMode correctly to test.')
          const fallback = { available: false, critical: false }
          setUpdateState(fallback)
          return fallback
        }
      }

      if (__DEV__) console.error('[AppUpdater] Error checking update:', e)
      emitEvent({ type: 'update_dismissed', payload: { error } })
      throw error
    } finally {
      isCheckingRef.current = false
      if (isMounted.current) setLoading(false)
    }
  }, [debugMode, iosCountryCode, minOsVersion, minRequiredVersion, emitEvent])

  return {
    updateState,
    loading,
    checkUpdate
  }
}
