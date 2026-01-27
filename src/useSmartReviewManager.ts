import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Platform, Linking, InteractionManager } from 'react-native'
import { AppUpdater } from './NativeAppUpdater'
import type { SmartReviewConfig, AppUpdaterEvent } from './types'

export function useSmartReviewManager(
  config: SmartReviewConfig | undefined,
  debugMode: boolean,
  iosStoreId: string,
  reviewCooldownDays: number,
  emitEvent: (event: AppUpdaterEvent) => void
) {
  const [lastPromptState, setLastPromptState] = useState(() => AppUpdater.getLastReviewPromptDate())
  const [smartReviewState, setSmartReviewState] = useState(() => AppUpdater.getSmartReviewState())
  const [showHappinessGate, setShowHappinessGate] = useState(false)

  // Synchronous ref-based state tracking for rapid-fire safety (e.g. rapid recordWin calls)
  // This allows us to check the latest state immediately without waiting for a re-render cycle.
  const smartReviewStateRef = useRef(smartReviewState)
  const lastPromptStateRef = useRef(lastPromptState)
  const configRef = useRef(config)
  const lastWinTime = useRef(0)

  // Keep refs in sync with incoming props
  useEffect(() => {
    configRef.current = config
  }, [config])

  const canRequestReview = useMemo(() => {
    if (debugMode) return true
    const lastPrompt = lastPromptState
    if (!lastPrompt) return true
    const cooldownMs = reviewCooldownDays * 24 * 60 * 60 * 1000
    return Date.now() - lastPrompt > cooldownMs
  }, [lastPromptState, reviewCooldownDays, debugMode])

  const openStoreReviewPage = useCallback(async () => {
    if (Platform.OS === 'ios') {
      if (!iosStoreId) {
        if (__DEV__) {
          console.warn('[AppUpdater] openStoreReviewPage: No "iosStoreId" provided. Cannot generate a valid App Store review URL. Please configure iosStoreId in your UpdatePrompt config.')
        }
        return
      }
      const url = `itms-apps://itunes.apple.com/app/id${iosStoreId}?action=write-review`
      Linking.openURL(url)
    } else {
      const packageName = AppUpdater.getBundleId()
      Linking.openURL(`market://details?id=${packageName}&show_reviews=true`)
    }
  }, [iosStoreId])

  const requestReview = useCallback(async () => {
    const startTime = Date.now()
    try {
      emitEvent({ type: 'review_requested', payload: {} })
      
      // We use isMounted or a similar check usually, but here we just need stable identity
      // canRequestReview is derived from lastPromptState which we have in ref
      const currentLastPrompt = lastPromptStateRef.current
      const cooldownMs = reviewCooldownDays * 24 * 60 * 60 * 1000
      const currentCanRequest = debugMode || !currentLastPrompt || (Date.now() - currentLastPrompt > cooldownMs)

      if (currentCanRequest) {
        // eslint-disable-next-line no-console
        if (debugMode) console.log('[AppUpdater] Attempting native in-app review prompt...')
        await AppUpdater.requestInAppReview()
        
        const duration = Date.now() - startTime
        const isTooFast = duration < 300
        if (isTooFast && (Platform.OS === 'android' || debugMode)) {
          // eslint-disable-next-line no-console
          if (debugMode) console.log(`[AppUpdater] Native prompt returned too fast (${duration}ms). Likely suppressed. Falling back to Store Review page.`)
          openStoreReviewPage()
        }
        
        const newTimestamp = AppUpdater.getLastReviewPromptDate()
        lastPromptStateRef.current = newTimestamp
        setLastPromptState(newTimestamp)
      } else {
        // eslint-disable-next-line no-console
        if (debugMode) console.log('[AppUpdater] Cooldown active. Falling back to Store Review page link.')
        openStoreReviewPage()
      }
      emitEvent({ type: 'review_completed', payload: {} })
    } catch (e) {
      if (debugMode) console.error('[AppUpdater] Native review request failed, falling back to Store page:', e)
      openStoreReviewPage()
    }
  }, [emitEvent, openStoreReviewPage, debugMode, reviewCooldownDays])

  const recordWin = useCallback(async () => {
    // Throttling: Ignore rapid-fire calls (e.g. during navigation spam)
    const now = Date.now()
    if (now - lastWinTime.current < 2000) return
    lastWinTime.current = now

    // Use requestIdleCallback if available (modern RN/Web), fallback to InteractionManager
    const runWhenReady = (cb: () => void) => {
      const g = global as typeof globalThis & { requestIdleCallback?: (cb: () => void) => void }
      if (typeof g.requestIdleCallback !== 'undefined') {
        g.requestIdleCallback(cb)
      } else {
        InteractionManager.runAfterInteractions(cb)
      }
    }

    runWhenReady(async () => {
      const currentConfig = configRef.current
      // prevState is captured inside the interaction callback to ensure it's fresh
      // as wins might be recorded during the animation window.
      const prevState = smartReviewStateRef.current
  
      if (!currentConfig?.enabled) return
      
      if (!debugMode) {
        if (prevState.hasCompletedReview) return
        const maxPrompts = currentConfig.maxPrompts ?? 1
        if (prevState.promptCount >= maxPrompts) return
  
        const cooldownMs = (currentConfig.cooldownDays ?? 120) * 24 * 60 * 60 * 1000
        if (prevState.lastPromptDate > 0 && 
            (Date.now() - prevState.lastPromptDate < cooldownMs)) return
      }
  
      const newWinCount = prevState.winCount + 1
      const winsBeforePrompt = currentConfig?.winsBeforePrompt ?? 3
  
      if (newWinCount >= winsBeforePrompt) {
        setShowHappinessGate(true)
        emitEvent({ type: 'happiness_gate_shown', payload: {} })
      } else {
        const newState = { ...prevState, winCount: newWinCount }
        smartReviewStateRef.current = newState
        setSmartReviewState(newState)
        AppUpdater.setSmartReviewState(newState)
        emitEvent({ type: 'win_recorded', payload: { count: newWinCount } })
      }
    })
  }, [debugMode, emitEvent])

  const handleHappinessPositive = useCallback(async () => {
    // eslint-disable-next-line no-console
    if (debugMode) console.log('[AppUpdater] User clicked YES in Happiness Gate')
    setShowHappinessGate(false)
    const newState = {
      ...smartReviewStateRef.current,
      hasCompletedReview: true,
      promptCount: smartReviewStateRef.current.promptCount + 1,
      lastPromptDate: Date.now(),
      winCount: 0
    }
    smartReviewStateRef.current = newState
    setSmartReviewState(newState)
    AppUpdater.setSmartReviewState(newState)
    emitEvent({ type: 'happiness_positive', payload: {} })
    await requestReview()
  }, [emitEvent, requestReview, debugMode])

  const handleHappinessNegative = useCallback(async () => {
    setShowHappinessGate(false)
    const newState = {
      ...smartReviewStateRef.current,
      winCount: 0,
      lastPromptDate: Date.now()
    }
    smartReviewStateRef.current = newState
    setSmartReviewState(newState)
    AppUpdater.setSmartReviewState(newState)
    emitEvent({ type: 'happiness_negative', payload: {} })
    configRef.current?.onNegativeFeedback?.()
  }, [emitEvent])

  const handleHappinessDismiss = useCallback(async () => {
    setShowHappinessGate(false)
    const newState = {
      ...smartReviewStateRef.current,
      winCount: 0,
      lastPromptDate: Date.now()
    }
    smartReviewStateRef.current = newState
    setSmartReviewState(newState)
    AppUpdater.setSmartReviewState(newState)
    emitEvent({ type: 'happiness_dismissed', payload: {} })
  }, [emitEvent])

  return {
    lastReviewPromptDate: lastPromptState,
    canRequestReview,
    showHappinessGate,
    recordWin,
    requestReview,
    openStoreReviewPage,
    handleHappinessPositive,
    handleHappinessNegative,
    handleHappinessDismiss
  }
}
