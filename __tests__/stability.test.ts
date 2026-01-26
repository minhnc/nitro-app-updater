import { renderHook, act } from '@testing-library/react-native'
import { useAppUpdater, AppUpdaterConfig } from '../src/useAppUpdater'
import { AppUpdaterEvent } from '../src/types'
import { InteractionManager } from 'react-native'

// Mock InteractionManager behavior
jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((callback: any) => {
  callback()
  return { 
    then: (onFulfilled?: () => any) => {
      onFulfilled?.()
      return Promise.resolve()
    },
    done: (fn?: () => any) => fn?.(),
    cancel: jest.fn() 
  } as any
})

// Mock requestIdleCallback
const g = global as any
g.requestIdleCallback = jest.fn((cb) => cb())
g.cancelIdleCallback = jest.fn()

jest.mock('../src/NativeAppUpdater', () => ({
  AppUpdater: {
    getLastReviewPromptDate: jest.fn(() => 0),
    getSmartReviewState: jest.fn(() => ({
      winCount: 0,
      promptCount: 0,
      lastPromptDate: 0,
      hasCompletedReview: false
    })),
    getBundleId: jest.fn(() => 'com.test.app'),
    getCurrentVersion: jest.fn(() => '1.0.0'),
    setSmartReviewState: jest.fn(),
    checkPlayStoreUpdate: jest.fn(async () => ({ available: false })),
    requestInAppReview: jest.fn(async () => {}),
    startInAppUpdate: jest.fn(async () => {}),
    startFlexibleUpdate: jest.fn(async () => {}),
    completeFlexibleUpdate: jest.fn(async () => {}),
  }
}))

describe('useAppUpdater Stability', () => {
  let dateSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    dateSpy = jest.spyOn(Date, 'now')
  })

  afterEach(() => {
    dateSpy.mockRestore()
  })

  it('should maintain stable function identities even when config changes', () => {
    const onEvent1 = jest.fn()
    const { result, rerender } = renderHook(
      (props: { config: AppUpdaterConfig }) => useAppUpdater(props.config),
      {
        initialProps: {
          config: { onEvent: onEvent1, debugMode: true, smartReview: { enabled: true } }
        }
      }
    )

    const initialCheckUpdate = result.current.checkUpdate
    const initialStartUpdate = result.current.startUpdate
    const initialRecordWin = result.current.recordWin
    const initialRequestReview = result.current.requestReview

    // Re-render with a NEW config object and NEW callback
    const onEvent2 = jest.fn()
    rerender({
      config: { onEvent: onEvent2, debugMode: true, smartReview: { enabled: true } }
    })

    expect(result.current.checkUpdate).toBe(initialCheckUpdate)
    expect(result.current.startUpdate).toBe(initialStartUpdate)
    expect(result.current.recordWin).toBe(initialRecordWin)
    expect(result.current.requestReview).toBe(initialRequestReview)
  })

  it('should correctly use the late-bound callback from ref', async () => {
    let callCount1 = 0
    let callCount2 = 0
    
    const onEvent1 = () => { callCount1++ }
    const onEvent2 = () => { callCount2++ }

    const { result, rerender } = renderHook(
      (props: { onEvent: (e: AppUpdaterEvent) => void }) => 
        useAppUpdater({ onEvent: props.onEvent, debugMode: true, smartReview: { enabled: true } }),
      {
        initialProps: { onEvent: onEvent1 }
      }
    )

    // Trigger an event with first callback
    await act(async () => {
      await result.current.recordWin()
      await result.current.recordWin()
      // 3 wins trigger happiness_gate_shown event
      await result.current.recordWin()
    })
    
    expect(callCount1).toBeGreaterThan(0)
    expect(callCount2).toBe(0)

    // Reset counts and swap callback
    callCount1 = 0
    rerender({ onEvent: onEvent2 })

    // Trigger another event - should use the NEW callback despite recordWin having STABLE identity
    await act(async () => {
      await result.current.handleHappinessDismiss()
    })
    
    expect(callCount1).toBe(0)
    expect(callCount2).toBe(1)
  })

  it('should throttle frequent calls to recordWin', async () => {
    const onEvent = jest.fn()
    const { result } = renderHook(
      () => useAppUpdater({ onEvent, debugMode: false, smartReview: { enabled: true, winsBeforePrompt: 3 } })
    )

    // Mock Date.now starting from a safe timestamp
    let currentTime = 3000
    dateSpy.mockImplementation(() => currentTime)

    await act(async () => {
      // 1st call: Should work
      await result.current.recordWin()
    })
    
    // Immediate 2nd call: Should be throttled
    currentTime += 100 // 100ms later
    await act(async () => {
      await result.current.recordWin()
    })

    // Immediate 3rd call: Should be throttled
    currentTime += 500 // 600ms later
    await act(async () => {
      await result.current.recordWin()
    })

    // Expect only 1 win recorded
    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ 
        type: 'win_recorded',
        payload: { count: 1 }
    }))
    
    // Wait > 2000ms
    currentTime += 2000 
    await act(async () => {
      await result.current.recordWin()
    })

    // Now should work
    expect(onEvent).toHaveBeenCalledTimes(2)
    expect(onEvent).toHaveBeenLastCalledWith(expect.objectContaining({ 
        type: 'win_recorded',
        payload: { count: 2 }
    }))
  })
})
