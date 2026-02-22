import { useEffect, useCallback, useRef, useMemo, useState } from 'react'
import { AppState } from 'react-native'
import { useUpdateManager, clearUpdateCache } from './useUpdateManager'
import { useDownloadManager } from './useDownloadManager'
import { useSmartReviewManager } from './useSmartReviewManager'
import { AppUpdaterError } from './AppUpdaterError'
import type { AppUpdaterConfig, AppUpdaterEvent } from './types'

/**
 * High-performance App Updater hook for React Native.
 * Refactored into specialized managers (Update, Download, SmartReview).
 */
export function useAppUpdater(config: AppUpdaterConfig = { iosStoreId: '' }) {
  // Extract primitives directly from config
  const {
    minRequiredVersion = '',
    iosCountryCode = 'us',
    iosStoreId = '',
    checkOnMount = true,
    refreshOnForeground = true,
    debugMode = false,
    reviewCooldownDays = 120,
    onEvent,
    onDownloadComplete,
    enabled = true,
    iosLookupTimeoutMs,
  } = config

  // Stabilize the smartReview object configuration
  const hasSmartReview = !!config.smartReview
  const smartReviewEnabled = config.smartReview?.enabled
  const winsBeforePrompt = config.smartReview?.winsBeforePrompt
  const cooldownDays = config.smartReview?.cooldownDays
  const maxPrompts = config.smartReview?.maxPrompts

  const smartReview = useMemo(() => {
    if (!hasSmartReview) return undefined
    return {
      enabled: smartReviewEnabled,
      winsBeforePrompt,
      cooldownDays,
      maxPrompts,
    }
  }, [
    hasSmartReview,
    smartReviewEnabled,
    winsBeforePrompt,
    cooldownDays,
    maxPrompts
  ])

  // Stabilize callbacks using refs
  const onEventRef = useRef(onEvent)
  const onDownloadCompleteRef = useRef(onDownloadComplete)
  const onNegativeFeedbackRef = useRef(config.smartReview?.onNegativeFeedback)

  useEffect(() => {
    onEventRef.current = onEvent
    onDownloadCompleteRef.current = onDownloadComplete
    onNegativeFeedbackRef.current = config.smartReview?.onNegativeFeedback
  }, [onEvent, onDownloadComplete, config.smartReview?.onNegativeFeedback])

  // 1. Error State tracking for UI feedback
  const [error, setError] = useState<AppUpdaterError | undefined>(undefined)

  // M2: Auto-purge cache on transition false -> true
  const prevEnabledRef = useRef(enabled)
  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      // eslint-disable-next-line no-console
      if (__DEV__) console.log('[AppUpdater] Re-enabled: Purging update cache')
      clearUpdateCache()
    }
    prevEnabledRef.current = enabled
  }, [enabled])

  // Internal unified event emitter
  const emitEvent = useCallback((event: AppUpdaterEvent) => {
    if (event.type === 'update_dismissed' || event.type === 'update_failed') {
      setError(event.payload.error)
    } else if (event.type === 'update_accepted' || event.type === 'update_available') {
      setError(undefined) // Clear error on success/retry
    }
    onEventRef.current?.(event)
  }, [])

  // 2. Update Management
  const { 
    updateState, 
    loading, 
    checkUpdate 
  } = useUpdateManager(
    debugMode,
    iosCountryCode,
    minRequiredVersion,
    iosLookupTimeoutMs,
    emitEvent
  )

  // M3: Auto-refresh on foreground
  const hasBeenBackgrounded = useRef(false)
  
  const initialCheckDone = useRef(false)
  
  useEffect(() => {
    if (!enabled || !refreshOnForeground) return

    hasBeenBackgrounded.current = false

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && hasBeenBackgrounded.current) {
        // eslint-disable-next-line no-console
        if (__DEV__) console.log('[AppUpdater] App foregrounded: Purging update cache and checking for updates')
        clearUpdateCache()
        checkUpdate().catch(() => {
          // Silently handle background check errors
          if (__DEV__) console.warn('[AppUpdater] Background update check failed')
        })
      } else if (nextAppState.match(/inactive|background/)) {
        hasBeenBackgrounded.current = true
      }
    })

    return () => {
      subscription.remove()
    }
  }, [enabled, refreshOnForeground, checkUpdate])

  useEffect(() => {
    if (__DEV__ && config.minOsVersion) {
      console.warn('[AppUpdater] The `minOsVersion` config is deprecated. Standard store APIs handle OS compatibility natively.')
    }
  }, [config.minOsVersion])

  // 2. Download Management
  const {
    downloadProgress,
    isDownloadComplete,
    isDownloading,
    startUpdate,
    completeUpdate
  } = useDownloadManager(
    updateState,
    onDownloadCompleteRef,
    emitEvent,
    iosStoreId,
    debugMode
  )

  // 3. Smart Review Management
  const {
    lastReviewPromptDate,
    canRequestReview,
    showHappinessGate,
    recordWin,
    requestReview,
    openStoreReviewPage,
    handleHappinessPositive,
    handleHappinessNegative,
    handleHappinessDismiss,
    smartReviewState,
    resetSmartReview
  } = useSmartReviewManager(
    smartReview,
    debugMode,
    iosStoreId,
    reviewCooldownDays,
    emitEvent,
    enabled,
    onNegativeFeedbackRef
  )

  // Initial check on mount
  useEffect(() => {
    if (enabled && checkOnMount) {
      checkUpdate().catch(() => {
        // Silently handle mount check errors
        if (__DEV__) console.warn('[AppUpdater] Initial update check failed')
      }).finally(() => {
        initialCheckDone.current = true
      })
    } else {
      initialCheckDone.current = true
    }
  }, [enabled, checkOnMount, checkUpdate])

  return useMemo(() => ({
    loading,
    available: updateState.available,
    critical: updateState.critical,
    version: updateState.version,
    versionCode: updateState.versionCode,
    releaseNotes: updateState.releaseNotes,
    downloadProgress,
    isReadyToInstall: isDownloadComplete,
    isDownloading,
    lastReviewPromptDate,
    canRequestReview,
    showHappinessGate,
    checkUpdate,
    startUpdate,
    completeUpdate,
    recordWin,
    requestReview,
    openStoreReviewPage,
    /** @internal For library use only. Do not call this function directly. */
    emitEvent,
    smartReviewState,
    handleHappinessPositive,
    handleHappinessNegative,
    handleHappinessDismiss,
    resetSmartReview,
    error
  }), [
    loading, 
    updateState.available,
    updateState.critical,
    updateState.version,
    updateState.versionCode,
    updateState.releaseNotes,
    downloadProgress, 
    isDownloadComplete, 
    isDownloading, 
    lastReviewPromptDate, 
    canRequestReview, 
    showHappinessGate, 
    checkUpdate, 
    startUpdate, 
    completeUpdate, 
    recordWin, 
    requestReview, 
    openStoreReviewPage, 
    emitEvent, 
    smartReviewState, 
    handleHappinessPositive, 
    handleHappinessNegative, 
    handleHappinessDismiss,
    resetSmartReview,
    error
  ])
}
