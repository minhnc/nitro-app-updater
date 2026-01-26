import { useEffect, useCallback, useRef } from 'react'
import { useUpdateManager } from './useUpdateManager'
import { useDownloadManager } from './useDownloadManager'
import { useSmartReviewManager } from './useSmartReviewManager'
import type { AppUpdaterConfig, AppUpdaterEvent } from './types'

// Re-export types for backward compatibility
export * from './types'

/**
 * High-performance App Updater hook for React Native.
 * Refactored into specialized managers (Update, Download, SmartReview).
 */
export function useAppUpdater(config: AppUpdaterConfig = {}) {
  // Stabilization: Use deep comparison to handle "raw object" configs passed by parent
  // We want to reuse the same config object reference if the DATA hasn't changed.
  const configRef = useRef(config)
  const previousJson = useRef(JSON.stringify(config))

  // Only perform expensive JSON.stringify if the reference actually changed
  if (configRef.current !== config) {
    const configJson = JSON.stringify(config)
    if (configJson !== previousJson.current) {
      configRef.current = config
      previousJson.current = configJson
    }
  }

  // Merge stable data-config with fresh callbacks (to avoid stale closures)
  const stableConfig = {
    ...configRef.current,
    onEvent: config.onEvent,
    onDownloadComplete: config.onDownloadComplete
  }

  const {
    minRequiredVersion = '',
    minOsVersion = '',
    iosCountryCode = 'us',
    iosStoreId = '',
    checkOnMount = true,
    debugMode = false,
    reviewCooldownDays = 120,
    smartReview,
    onEvent,
    onDownloadComplete
  } = stableConfig

  // Stabilize callbacks using refs
  const onEventRef = useRef(onEvent)
  const onDownloadCompleteRef = useRef(onDownloadComplete)

  useEffect(() => {
    onEventRef.current = onEvent
    onDownloadCompleteRef.current = onDownloadComplete
  }, [onEvent, onDownloadComplete])

  // Internal unified event emitter with PERFECTLY STABLE identity
  const emitEvent = useCallback((event: AppUpdaterEvent) => {
    onEventRef.current?.(event)
  }, [])

  // 1. Update Management
  const { 
    updateState, 
    loading, 
    checkUpdate 
  } = useUpdateManager(
    debugMode,
    iosCountryCode,
    minOsVersion,
    minRequiredVersion,
    emitEvent
  )

  // 2. Download Management
  const {
    downloadProgress,
    isDownloadComplete,
    startUpdate,
    completeUpdate
  } = useDownloadManager(
    updateState,
    debugMode,
    iosStoreId,
    emitEvent,
    onDownloadCompleteRef.current
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
    handleHappinessDismiss
  } = useSmartReviewManager(
    smartReview,
    debugMode,
    iosStoreId,
    reviewCooldownDays,
    emitEvent
  )

  // Initial check on mount
  useEffect(() => {
    if (checkOnMount) {
      checkUpdate()
    }
  }, [checkOnMount, checkUpdate])

  return {
    /**
     * Whether an update check is currently in progress.
     */
    loading,
    /**
     * Whether an update is available for download.
     */
    available: updateState.available,
    /**
     * Whether the update is critical (e.g. meets min required version).
     * If true, the user should be forced to update.
     */
    critical: updateState.critical,
    /**
     * The version string of the available update (e.g. "1.2.3").
     */
    version: updateState.version,
    /**
     * The version code of the available update (Android only).
     */
    versionCode: updateState.versionCode,
    /**
     * Release notes or "What's New" text from the store.
     */
    releaseNotes: updateState.releaseNotes,
    /**
     * Current download progress object { bytesDownloaded, totalBytes, percent }.
     */
    downloadProgress,
    /**
     * Whether the update has been downloaded and is ready to install (Android flexible updates).
     */
    isReadyToInstall: isDownloadComplete,
    /**
     * Timestamp of the last time a review was requested.
     */
    lastReviewPromptDate,
    /**
     * Whether a review request is allowed based on cooldown and other rules.
     */
    canRequestReview,
    
    // Happiness Gate UI State
    /**
     * Whether the Happiness Gate (pre-review prompt) should be shown.
     */
    showHappinessGate,

    // Actions
    /**
     * Manually triggers an update check.
     * @param force - If true, bypasses the cache.
     */
    checkUpdate,
    /**
     * Starts the update process.
     * On Android: Starts flexible or immediate update.
     * On iOS: Opens the App Store URL.
     */
    startUpdate,
    /**
     * Completes a flexible update (Android only). Triggers app restart.
     */
    completeUpdate,
    /**
     * Records a "win" (positive user action) for Smart Review logic.
     */
    recordWin,
    /**
     * Manually requests a store review.
     */
    requestReview,
    /**
     * Opens the store review page directly (write review action).
     */
    openStoreReviewPage,
    
    // Happiness Gate Handlers (Internal/Advanced use)
    handleHappinessPositive,
    handleHappinessNegative,
    handleHappinessDismiss
  }
}
