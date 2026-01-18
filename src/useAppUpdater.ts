import { useState, useCallback, useEffect } from 'react'
import { Platform, Linking } from 'react-native'
import { AppUpdater } from './index'
import { checkIOSUpdate, compareVersions } from './versionCheck'
import { AppUpdaterError } from './AppUpdaterError'

/**
 * Event types emitted by the app updater.
 * Use with `onEvent` callback for unified analytics/logging.
 */
export type AppUpdaterEvent =
  | { type: 'update_available'; payload: { version: string } }
  | { type: 'update_accepted'; payload: Record<string, never> }
  | { type: 'update_dismissed'; payload: { error?: AppUpdaterError } }
  | { type: 'update_downloaded'; payload: Record<string, never> }
  | { type: 'review_requested'; payload: Record<string, never> }
  | { type: 'review_completed'; payload: Record<string, never> }

export interface AppUpdaterConfig {
  /**
   * Minimum version required to run the app. If the current version is lower, 
   * the update will be treated as mandatory (force update).
   */
  minRequiredVersion?: string
  /**
   * Country code for iOS App Store lookup (default: 'us')
   */
  iosCountryCode?: string
  /**
   * How often to check for updates in milliseconds (default: 1 hour)
   * Note: This simple implementation checks on mount.
   */
  checkOnMount?: boolean
  /**
   * Enable debug mode to mock update availability.
   * Useful for testing UI and flows without a real update.
   */
  debugMode?: boolean
  /**
   * Number of days between in-app review prompts (default: 120).
   * Set to 0 to disable cooldown (not recommended).
   */
  reviewCooldownDays?: number
  /**
   * Unified event callback for analytics/logging.
   * Fired for all update and review events.
   */
  onEvent?: (event: AppUpdaterEvent) => void
  /**
   * iOS App Store numeric ID (e.g., "6514638249").
   * Used as a fallback if the iTunes API doesn't return a trackViewUrl.
   */
  iosStoreId?: string
  /**
   * Minimum OS version required to trigger the update prompt.
   * Useful for apps that have a higher OS requirement in the new version.
   * iOS: e.g., "15.0"
   * Android: e.g., "31" (API Level)
   */
  minOsVersion?: string
  /**
   * Callback fired when a flexible update finishes downloading (Android only).
   * Use for custom UI logic like confetti or navigation.
   */
  onDownloadComplete?: () => void
}

export interface UpdateState {
  available: boolean
  manifestVersion?: string
  versionCode?: number
  releaseNotes?: string
  storeUrl?: string
  critical: boolean
}

// Simple in-memory cache to prevent frequent network/native calls
const UPDATE_CACHE: { 
  lastCheck: number, 
  data: UpdateState | null 
} = { lastCheck: 0, data: null }

const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export function useAppUpdater(config: AppUpdaterConfig = {}) {
  const {
    minRequiredVersion,
    iosCountryCode,
    checkOnMount = true,
    debugMode = false,
    reviewCooldownDays = 120,
    onEvent,
    iosStoreId,
    minOsVersion,
    onDownloadComplete,
  } = config

  // Helper to emit events
  const emitEvent = useCallback((event: AppUpdaterEvent) => {
    onEvent?.(event)
  }, [onEvent])

  const [updateState, setUpdateState] = useState<UpdateState>({ available: false, critical: false })
  const [loading, setLoading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState({ bytesDownloaded: 0, totalBytes: 0, percent: 0 })
  const [isDownloadComplete, setIsDownloadComplete] = useState(false)

  const [lastPromptState, setLastPromptState] = useState(() => AppUpdater.getLastReviewPromptDate())

  const canRequestReview = reviewCooldownDays === 0 ||
    lastPromptState === 0 ||
    (Date.now() - lastPromptState) > reviewCooldownDays * 24 * 60 * 60 * 1000;

  /**
   * Check for available updates.
   * @param forceCheck - Set to `true` when triggered by user action (e.g., button tap)
   *                     to bypass the 1-hour cache. Defaults to `false` for background checks.
   */
  const checkUpdate = useCallback(async (forceCheck = false): Promise<UpdateState> => {
    // Check cache first
    const now = Date.now()
    if (!forceCheck && !debugMode && UPDATE_CACHE.data && (now - UPDATE_CACHE.lastCheck < CACHE_TTL)) {
      setUpdateState(UPDATE_CACHE.data)
      return UPDATE_CACHE.data
    }

    setLoading(true)

    // OS version check
    if (minOsVersion) {
      const currentOsVersion = String(Platform.Version)
      if (compareVersions(currentOsVersion, minOsVersion) < 0) {
        console.log(`[AppUpdater] Device OS version ${currentOsVersion} is lower than required ${minOsVersion}. Skipping update check.`)
        setLoading(false)
        return { available: false, critical: false }
      }
    }
    const currentVersion = AppUpdater.getCurrentVersion()
    const bundleId = AppUpdater.getBundleId()

    try {
      let newState: UpdateState = { available: false, critical: false }
      
      if (debugMode) {
        // Mock Update
        newState = {
            available: true,
            manifestVersion: "9.9.9-debug",
            releaseNotes: "This is a mock update for debugging purposes.",
            critical: false
        }
      } else if (Platform.OS === 'ios') {
        const result = await checkIOSUpdate(bundleId, iosCountryCode)
        if (result && compareVersions(result.version, currentVersion) > 0) {
          const isCritical = minRequiredVersion 
            ? compareVersions(currentVersion, minRequiredVersion) < 0
            : false
            
          newState = {
            available: true,
            manifestVersion: result.version,
            releaseNotes: result.releaseNotes,
            storeUrl: result.trackViewUrl,
            critical: isCritical
          }
        }
      } else if (Platform.OS === 'android') {
        const result = await AppUpdater.checkPlayStoreUpdate(debugMode)
        if (result.available) {
          newState = {
            available: true,
            versionCode: result.versionCode || undefined,
            critical: false // Android Play Core handles its own Flexible/Immediate flows
          }
        }
      }
      
      // Update state and cache
      setUpdateState(newState)
      if (newState.available) {
          emitEvent({ type: 'update_available', payload: { version: newState.manifestVersion || 'unknown' } })
      }

      if (!debugMode) {
          UPDATE_CACHE.lastCheck = now
          UPDATE_CACHE.data = newState
      }

    } catch (e) {
      console.error('[AppUpdater] Error checking update:', e)
      const error = AppUpdaterError.fromNative(e)
      emitEvent({ type: 'update_dismissed', payload: { error } })
    } finally {
      setLoading(false)
    }
    
    // We can't return updateState here because it's not updated until the next render.
    // We should maintain the latest state in a local variable or just return it from here.
    return UPDATE_CACHE.data || { available: false, critical: false }
  }, [debugMode, iosCountryCode, iosStoreId, minOsVersion, minRequiredVersion, emitEvent])

  useEffect(() => {
    // Config validation warnings in development
    if (__DEV__) {
      if (Platform.OS === 'ios' && !iosStoreId) {
        console.warn(
          '[AppUpdater] Warning: iosStoreId is not configured. ' +
          'The App Store fallback will use a search query, which is slower. ' +
          'Consider adding your App Store ID for a direct deep link.'
        )
      }
      if (minOsVersion && !/^\d+(\.\d+)*$/.test(minOsVersion)) {
        console.warn(`[AppUpdater] Warning: minOsVersion "${minOsVersion}" may be malformed. Expected format like "15.0" or "31".`)
      }
    }

    if (checkOnMount !== false) {
      checkUpdate()
    }
  }, [checkUpdate, checkOnMount, iosStoreId, minOsVersion])

  /**
   * Triggers the update flow.
   * On Android, this starts the In-App Update.
   * On iOS, this opens the App Store.
   */

  const completeUpdate = useCallback(async () => {
    try {
      await AppUpdater.completeFlexibleUpdate()
    } catch (e) {
      console.error('[AppUpdater] Failed to complete flexible update:', e)
    }
  }, [])

  const startUpdate = useCallback(async () => {
    emitEvent({ type: 'update_accepted', payload: {} })

    if (Platform.OS === 'android') {
        try {
            if (updateState.critical) {
                 await AppUpdater.startInAppUpdate(true)
            } else {
                 await AppUpdater.startFlexibleUpdate((bytesDownloaded, totalBytes) => {
                     const percent = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0
                     setDownloadProgress({ bytesDownloaded, totalBytes, percent })
                     if (percent === 100) {
                       emitEvent({ type: 'update_downloaded', payload: {} })
                       setIsDownloadComplete(true)
                       onDownloadComplete?.()
                     }
                 })
            }
        } catch(e) {
            const error = AppUpdaterError.fromNative(e)
            emitEvent({ type: 'update_dismissed', payload: { error } })
        }
    } else {
        if (updateState.storeUrl) {
            Linking.openURL(updateState.storeUrl)
        } else if (iosStoreId) {
            Linking.openURL(`itms-apps://itunes.apple.com/app/id${iosStoreId}`)
        } else {
             // Fallback to searching for the bundle ID if no specific URL is found
             const appId = AppUpdater.getBundleId()
             // Redirect to App Store search as fallback
             Linking.openURL(`https://apps.apple.com/search?term=${encodeURIComponent(appId)}`)
        }
    }
  }, [updateState, emitEvent])

  /**
   * Requests the native in-app review dialog.
   */
  const requestReview = useCallback(async () => {
    try {
      emitEvent({ type: 'review_requested', payload: {} })
      await AppUpdater.requestInAppReview()
      // Force a re-render to update canRequestReview/lastPromptDate
      setLastPromptState(AppUpdater.getLastReviewPromptDate())
      emitEvent({ type: 'review_completed', payload: {} })
    } catch (e) {
      console.warn('[AppUpdater] Failed to request review:', e)
    }
  }, [emitEvent])


  /**
   * Opens the store page directly to the "Write a Review" section.
   * This is recommended for manual "Rate & Review" buttons where you want to ensure an action is taken,
   * bypassing the quota-limited requestReview() prompt.
   */
  const openStoreReviewPage = useCallback(() => {
    if (Platform.OS === 'ios' && iosStoreId) {
      AppUpdater.openStoreReviewPage(iosStoreId);
    } else {
      AppUpdater.openStoreReviewPage(AppUpdater.getBundleId());
    }
  }, [iosStoreId]);

  return {
    ...updateState,
    loading,
    downloadProgress,
    isReadyToInstall: isDownloadComplete && Platform.OS === 'android',
    checkUpdate,
    startUpdate,
    completeUpdate,
    requestReview,
    openStoreReviewPage,
    canRequestReview,
    lastReviewPromptDate: lastPromptState || undefined
  }
}
