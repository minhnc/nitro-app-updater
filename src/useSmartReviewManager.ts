import { useState, useCallback, useMemo } from 'react'
import { Platform, Linking } from 'react-native'
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

  const canRequestReview = useMemo(() => {
    if (debugMode) return true
    const lastPrompt = lastPromptState
    if (!lastPrompt) return true
    const cooldownMs = reviewCooldownDays * 24 * 60 * 60 * 1000
    return Date.now() - lastPrompt > cooldownMs
  }, [lastPromptState, reviewCooldownDays, debugMode])

  const openStoreReviewPage = useCallback(async () => {
    if (Platform.OS === 'ios') {
      const url = iosStoreId 
        ? `itms-apps://itunes.apple.com/app/id${iosStoreId}?action=write-review`
        : `itms-apps://itunes.apple.com/app/id${AppUpdater.getBundleId()}?action=write-review`
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
      
      if (canRequestReview) {
        if (debugMode) console.log('[AppUpdater] Attempting native in-app review prompt...')
        await AppUpdater.requestInAppReview()
        
        const duration = Date.now() - startTime
        const isTooFast = duration < 300
        if (isTooFast && (Platform.OS === 'android' || debugMode)) {
          if (debugMode) console.log(`[AppUpdater] Native prompt returned too fast (${duration}ms). Likely suppressed. Falling back to Store Review page.`)
          openStoreReviewPage()
        }
        
        setLastPromptState(AppUpdater.getLastReviewPromptDate())
      } else {
        if (debugMode) console.log('[AppUpdater] Cooldown active. Falling back to Store Review page link.')
        openStoreReviewPage()
      }
      emitEvent({ type: 'review_completed', payload: {} })
    } catch (e) {
      if (debugMode) console.error('[AppUpdater] Native review request failed, falling back to Store page:', e)
      openStoreReviewPage()
    }
  }, [emitEvent, canRequestReview, openStoreReviewPage, debugMode])

  const recordWin = useCallback(async () => {
    if (!config?.enabled) return
    
    if (!debugMode) {
      if (smartReviewState.hasCompletedReview) return
      const maxPrompts = config.maxPrompts ?? 1
      if (smartReviewState.promptCount >= maxPrompts) return

      const cooldownMs = (config.cooldownDays ?? 120) * 24 * 60 * 60 * 1000
      if (smartReviewState.lastPromptDate > 0 && 
          (Date.now() - smartReviewState.lastPromptDate < cooldownMs)) return
    }

    const newWinCount = smartReviewState.winCount + 1
    const winsBeforePrompt = config.winsBeforePrompt ?? 3

    if (newWinCount >= winsBeforePrompt) {
      setShowHappinessGate(true)
      emitEvent({ type: 'happiness_gate_shown', payload: {} })
    } else {
      const newState = { ...smartReviewState, winCount: newWinCount }
      setSmartReviewState(newState)
      AppUpdater.setSmartReviewState(newState)
      emitEvent({ type: 'win_recorded', payload: { count: newWinCount } })
    }
  }, [config, smartReviewState, debugMode, emitEvent])

  const handleHappinessPositive = useCallback(async () => {
    if (debugMode) console.log('[AppUpdater] User clicked YES in Happiness Gate')
    setShowHappinessGate(false)
    const newState = {
      ...smartReviewState,
      hasCompletedReview: true,
      promptCount: smartReviewState.promptCount + 1,
      lastPromptDate: Date.now(),
      winCount: 0
    }
    setSmartReviewState(newState)
    AppUpdater.setSmartReviewState(newState)
    emitEvent({ type: 'happiness_positive', payload: {} })
    await requestReview()
  }, [smartReviewState, emitEvent, requestReview, debugMode])

  const handleHappinessNegative = useCallback(async () => {
    setShowHappinessGate(false)
    const newState = {
      ...smartReviewState,
      winCount: 0,
      lastPromptDate: Date.now()
    }
    setSmartReviewState(newState)
    AppUpdater.setSmartReviewState(newState)
    emitEvent({ type: 'happiness_negative', payload: {} })
    config?.onNegativeFeedback?.()
  }, [smartReviewState, emitEvent, config])

  const handleHappinessDismiss = useCallback(async () => {
    setShowHappinessGate(false)
    const newState = {
      ...smartReviewState,
      winCount: 0,
      lastPromptDate: Date.now()
    }
    setSmartReviewState(newState)
    AppUpdater.setSmartReviewState(newState)
    emitEvent({ type: 'happiness_dismissed', payload: {} })
  }, [smartReviewState, emitEvent])

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
