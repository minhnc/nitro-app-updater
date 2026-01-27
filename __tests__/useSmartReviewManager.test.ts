import { renderHook, act } from '@testing-library/react-native';
import { useSmartReviewManager } from '../src/useSmartReviewManager';
import { AppUpdater } from '../src/NativeAppUpdater';
import { Platform, Linking } from 'react-native';

// Mock InteractionManager behavior handled in the main factory mock below

// Mock requestIdleCallback
(global as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback = jest.fn((cb) => cb());

// Mock the native AppUpdater
jest.mock('../src/NativeAppUpdater', () => ({
  AppUpdater: {
    getBundleId: jest.fn(() => 'com.example.app'),
    getLastReviewPromptDate: jest.fn(() => 0),
    getSmartReviewState: jest.fn(() => ({
      winCount: 0,
      lastPromptDate: 0,
      hasCompletedReview: false,
      promptCount: 0,
    })),
    setSmartReviewState: jest.fn(),
    requestInAppReview: jest.fn(),
  },
}));

// Mock react-native
jest.mock('react-native', () => {
  return {
    Platform: {
      OS: 'android',
      select: jest.fn((dict) => dict.android || dict.default),
    },
    Linking: {
      openURL: jest.fn(),
    },
    InteractionManager: {
      runAfterInteractions: jest.fn((cb) => {
        cb();
        return { 
          then: (onF?: () => void) => onF?.(),
          done: (fn?: () => void) => fn?.(),
          cancel: jest.fn() 
        };
      }),
    },
    StyleSheet: {
      create: <T>(s: T) => s,
    },
    View: 'View',
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    Modal: 'Modal',
    ScrollView: 'ScrollView',
    Animated: {
      Value: jest.fn(() => ({
        setValue: jest.fn(),
        interpolate: jest.fn(),
      })),
      timing: jest.fn(() => ({ start: jest.fn((cb) => cb?.()) })),
      spring: jest.fn(() => ({ start: jest.fn((cb) => cb?.()) })),
      parallel: jest.fn(() => ({ start: jest.fn((cb) => cb?.()) })),
    },
  };
});

describe('useSmartReviewManager', () => {
  const emitEvent = jest.fn();
  const iosStoreId = '123456';
  const reviewCooldownDays = 30;

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'android';
  });

  it('should fallback to store review if native prompt is too fast (Android)', async () => {
    // Mock native prompt returning instantly
    (AppUpdater.requestInAppReview as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSmartReviewManager(
      { enabled: true },
      false, // debugMode
      iosStoreId,
      reviewCooldownDays,
      emitEvent
    ));

    await act(async () => {
      await result.current.requestReview();
    });

    // On Android, 300ms check triggers redirect
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('market://details'));
  });

  it('should NOT fallback to store review if native prompt takes time (Android)', async () => {
    // Mock native prompt taking 500ms
    (AppUpdater.requestInAppReview as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 500))
    );

    const { result } = renderHook(() => useSmartReviewManager(
      { enabled: true },
      false,
      iosStoreId,
      reviewCooldownDays,
      emitEvent
    ));

    await act(async () => {
      await result.current.requestReview();
    });

    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('should bypass completion limits in debugMode', async () => {
    // Mock state where review is already completed
    (AppUpdater.getSmartReviewState as jest.Mock).mockReturnValue({
      winCount: 0,
      lastPromptDate: 0,
      hasCompletedReview: true,
      promptCount: 1,
    });

    const { result } = renderHook(() => useSmartReviewManager(
      { enabled: true, winsBeforePrompt: 1 },
      true, // debugMode: true
      iosStoreId,
      reviewCooldownDays,
      emitEvent
    ));

    await act(async () => {
      await result.current.recordWin();
    });

    // Should show gate despite hasCompletedReview: true
    expect(result.current.showHappinessGate).toBe(true);
  });

  it('should respect canRequestReview cooldown for direct links', async () => {
    const recently = Date.now() - 1000;
    (AppUpdater.getLastReviewPromptDate as jest.Mock).mockReturnValue(recently);

    const { result } = renderHook(() => useSmartReviewManager(
      { enabled: true },
      false,
      iosStoreId,
      reviewCooldownDays,
      emitEvent
    ));

    expect(result.current.canRequestReview).toBe(false);

    await act(async () => {
      await result.current.requestReview();
    });

    // Should NOT try native prompt, should go straight to store link
    expect(AppUpdater.requestInAppReview).not.toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalled();
  });

  it('should use deep link for iOS when iosStoreId is provided', async () => {
    (Platform as { OS: string }).OS = 'ios';
    const { result } = renderHook(() => useSmartReviewManager(
      { enabled: true },
      false,
      iosStoreId,
      reviewCooldownDays,
      emitEvent
    ));

    await act(async () => {
      await result.current.openStoreReviewPage();
    });

    expect(Linking.openURL).toHaveBeenCalledWith(`itms-apps://itunes.apple.com/app/id${iosStoreId}?action=write-review`);
  });
});
