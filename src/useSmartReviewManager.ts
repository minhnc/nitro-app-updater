import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import type { MutableRefObject } from "react";
import { Platform, InteractionManager } from "react-native";
import { AppUpdater } from "./NativeAppUpdater";
import { AppUpdaterErrorCode, AppUpdaterError } from './AppUpdaterError'
import type { SmartReviewConfig, AppUpdaterEvent } from "./types";

/**
 * Manages the Smart Review (Happiness Gate) lifecycle.
 * Tracks positive user actions ("wins"), shows a satisfaction gate at the configured threshold,
 * and routes to either a native review prompt or a store review page.
 *
 * @returns Handlers for recording wins, managing the happiness gate, and requesting reviews.
 */
export function useSmartReviewManager(
  config: SmartReviewConfig | undefined,
  debugMode: boolean,
  iosStoreId: string,
  reviewCooldownDays: number,
  emitEvent: (event: AppUpdaterEvent) => void,
  enabled: boolean = true,
  onNegativeFeedbackRef?: MutableRefObject<(() => void) | undefined>
) {
  const [lastPromptState, setLastPromptState] = useState(() => {
    if (!enabled) return 0
    try {
      return AppUpdater.getLastReviewPromptDate()
    } catch {
      return 0
    }
  })
  const [smartReviewState, setSmartReviewState] = useState(() => {
    if (!enabled) return { winCount: 0, lastPromptDate: 0, hasCompletedReview: false, promptCount: 0 }
    try {
      return AppUpdater.getSmartReviewState()
    } catch {
      return { winCount: 0, lastPromptDate: 0, hasCompletedReview: false, promptCount: 0 }
    }
  })
  const [showHappinessGate, setShowHappinessGate] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Synchronous ref-based state tracking for rapid-fire safety (e.g. rapid recordWin calls)
  // This allows us to check the latest state immediately without waiting for a re-render cycle.
  const smartReviewStateRef = useRef(smartReviewState)
  const lastPromptStateRef = useRef(lastPromptState)
  const configRef = useRef(config)
  const lastWinTime = useRef(0)

  // Keep refs in sync with incoming props and state
  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    smartReviewStateRef.current = smartReviewState
  }, [smartReviewState])

  useEffect(() => {
    lastPromptStateRef.current = lastPromptState
  }, [lastPromptState])

  const canRequestReview = useMemo(() => {
    if (debugMode) return true
    const lastPrompt = lastPromptState
    if (!lastPrompt) return true
    const cooldownMs = reviewCooldownDays * 24 * 60 * 60 * 1000
    return Date.now() - lastPrompt > cooldownMs
  }, [lastPromptState, reviewCooldownDays, debugMode])

  const openStoreReviewPage = useCallback(async (fallbackStoreId?: string) => {
    const idToUse = fallbackStoreId || iosStoreId
    if (Platform.OS === 'ios' && !idToUse) {
      if (__DEV__) {
        console.warn('[AppUpdater] openStoreReviewPage: No "iosStoreId" provided. Cannot generate a valid App Store review URL. Please configure iosStoreId in your AppUpdater config or pass it directly.')
      }
      return
    }
    
    try {
      await AppUpdater.openStoreReviewPage(idToUse || '')
    } catch (e: unknown) {
      if (__DEV__) console.error('[AppUpdater] Failed to open native store review page:', e)
      emitEvent?.({ 
        type: 'update_dismissed', 
        payload: { error: AppUpdaterError.fromNative(e) } 
      })
    }
  }, [iosStoreId, emitEvent])

  const requestReview = useCallback(async () => {
    if (!configRef.current?.enabled) {
      // eslint-disable-next-line no-console
      if (debugMode) console.log('[AppUpdater] requestReview skipped: smartReview.enabled is false')
      return
    }
    const startTime = Date.now()
    try {
      emitEvent?.({ type: 'review_requested', payload: {} })
      
      // Compute cooldown from refs for freshest values
      const currentLastPrompt = lastPromptStateRef.current
      const cooldownMs = reviewCooldownDays * 24 * 60 * 60 * 1000
      const currentCanRequest = debugMode || !currentLastPrompt || (Date.now() - currentLastPrompt > cooldownMs)

      if (currentCanRequest) {
        // eslint-disable-next-line no-console
        if (debugMode) console.log('[AppUpdater] Attempting native in-app review prompt...')
        await AppUpdater.requestInAppReview()
        
        const duration = Date.now() - startTime
        const isTooFast = duration < 300
        
        // On iOS, SKStoreReviewController returns instantly (fire-and-forget), so the duration is ALWAYS < 300ms.
        // We must ONLY apply this "suppressed" fallback heuristic on Android.
        if (isTooFast && Platform.OS === 'android') {
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
      emitEvent?.({ type: 'review_completed', payload: {} })
    } catch (e: unknown) {
      const error = AppUpdaterError.fromNative(e)
      if (error.code === AppUpdaterErrorCode.USER_CANCELLED) {
         // eslint-disable-next-line no-console
         if (debugMode) console.log('[AppUpdater] User cancelled the review prompt.')
      } else {
        if (debugMode) console.error('[AppUpdater] Native review request failed, falling back to Store page:', e)
        openStoreReviewPage()
      }
    }
  }, [emitEvent, openStoreReviewPage, debugMode, reviewCooldownDays])

  const recordWin = useCallback(async () => {
    // Throttling: Ignore rapid-fire calls (e.g. during navigation spam)
    const now = Date.now()
    if (now - lastWinTime.current < 2000) return
    lastWinTime.current = now

    // Use requestIdleCallback if available (modern RN/Web), fallback to InteractionManager
    const runWhenReady = (cb: () => void) => {
      let called = false
      const timeoutFallback = setTimeout(() => {
        if (!called) {
          called = true
          cb()
        }
      }, 500)

      const g = global as typeof globalThis & { requestIdleCallback?: (cb: () => void) => void }
      if (typeof g.requestIdleCallback !== 'undefined') {
        g.requestIdleCallback(() => {
          if (!called) {
            called = true
            clearTimeout(timeoutFallback)
            cb()
          }
        })
      } else {
        InteractionManager.runAfterInteractions(() => {
          if (!called) {
            called = true
            clearTimeout(timeoutFallback)
            cb()
          }
        })
      }
    }

    runWhenReady(() => {
      if (!isMountedRef.current) return;
      try {
        if (!enabled || !configRef.current?.enabled) return;

        const currentState = smartReviewStateRef.current;
        const currentConfig = configRef.current;
        const winsBeforePrompt = currentConfig?.winsBeforePrompt ?? 3;

        // Skip if already completed or restricted by config (unless debugging)
        if (!debugMode) {
          if (currentState.hasCompletedReview) return;
          const maxPrompts = currentConfig?.maxPrompts ?? 1;
          if (currentState.promptCount >= maxPrompts) return;

          const cooldownMs = (currentConfig?.cooldownDays ?? 120) * 24 * 60 * 60 * 1000;
          if (currentState.lastPromptDate > 0 && 
              (Date.now() - currentState.lastPromptDate < cooldownMs)) return;
        }

        const newWinCount = currentState.winCount + 1;
        const reachedThreshold = newWinCount >= winsBeforePrompt;

        const newState = {
          ...currentState,
          winCount: newWinCount,
        };
        
        smartReviewStateRef.current = newState;
        setSmartReviewState(newState); // Update React state
        AppUpdater.setSmartReviewState(newState);

        // Compute canRequestReview from refs to avoid stale closure
        const currentLastPrompt = lastPromptStateRef.current
        const reviewCooldownMs = reviewCooldownDays * 24 * 60 * 60 * 1000
        const freshCanRequestReview = debugMode || !currentLastPrompt || (Date.now() - currentLastPrompt > reviewCooldownMs)

        if (reachedThreshold && freshCanRequestReview) {
          setShowHappinessGate(true);
          emitEvent?.({ type: 'happiness_gate_shown', payload: {} })
        } else {
          emitEvent?.({ type: 'win_recorded', payload: { count: newWinCount } })
        }
      } catch (e: unknown) {
        if (__DEV__) {
          console.error("[AppUpdater] Failed to record win:", e);
        }
      }
    });
  }, [enabled, configRef, debugMode, reviewCooldownDays, emitEvent])

  const resetSmartState = useCallback((overrides: Partial<typeof smartReviewStateRef.current> = {}) => {
    const newState = {
      ...smartReviewStateRef.current,
      winCount: 0,
      lastPromptDate: Date.now(),
      ...overrides
    }
    smartReviewStateRef.current = newState
    setSmartReviewState(newState)
    AppUpdater.setSmartReviewState(newState)
  }, [])

  const handleHappinessPositive = useCallback(async () => {
    // eslint-disable-next-line no-console
    if (debugMode) console.log('[AppUpdater] User clicked YES in Happiness Gate')
    setShowHappinessGate(false)
    emitEvent({ type: 'happiness_positive', payload: {} })
    
    try {
      // Request review before updating state to ensure accuracy
      await requestReview()
      
      resetSmartState({
        hasCompletedReview: true,
        promptCount: smartReviewStateRef.current.promptCount + 1
      })
    } catch (e) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.error('[AppUpdater] review request failed:', e)
      // Reset state on failure so the user can be re-prompted in the future
      resetSmartState()
    }
  }, [emitEvent, requestReview, debugMode, resetSmartState])

  const handleHappinessNegative = useCallback(() => {
    setShowHappinessGate(false)
    resetSmartState()
    emitEvent({ type: 'happiness_negative', payload: {} })
    // Note: Invoking via ref ensures the callback is stabilized without effect dependencies churn.
    onNegativeFeedbackRef?.current?.()
  }, [emitEvent, resetSmartState, onNegativeFeedbackRef])

  const handleHappinessDismiss = useCallback(() => {
    setShowHappinessGate(false)
    resetSmartState()
    emitEvent({ type: 'happiness_dismissed', payload: {} })
  }, [emitEvent, resetSmartState])

  return useMemo(() => ({
    lastReviewPromptDate: lastPromptState,
    canRequestReview,
    showHappinessGate,
    recordWin,
    requestReview,
    openStoreReviewPage,
    handleHappinessPositive,
    handleHappinessNegative,
    handleHappinessDismiss,
    resetSmartReview: resetSmartState,
    smartReviewState
  }), [
    lastPromptState,
    canRequestReview,
    showHappinessGate,
    recordWin,
    requestReview,
    openStoreReviewPage,
    handleHappinessPositive,
    handleHappinessNegative,
    handleHappinessDismiss,
    resetSmartState,
    smartReviewState
  ])
}
