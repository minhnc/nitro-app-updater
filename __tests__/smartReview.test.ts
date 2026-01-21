import { renderHook, act } from '@testing-library/react-native';
import { useAppUpdater } from '../src/useAppUpdater';
import { AppUpdater } from '../src/index';

// Mock the native AppUpdater
jest.mock('../src/NativeAppUpdater', () => {
  const mockState = {
    winCount: 0,
    lastPromptDate: 0,
    hasCompletedReview: false,
    promptCount: 0,
  };
  return {
    AppUpdater: {
      getCurrentVersion: jest.fn(() => '1.0.0'),
      getBundleId: jest.fn(() => 'com.example.app'),
      getLastReviewPromptDate: jest.fn(() => 0),
      getSmartReviewState: jest.fn(() => mockState),
      setSmartReviewState: jest.fn(),
      requestInAppReview: jest.fn().mockResolvedValue(undefined),
      openStoreReviewPage: jest.fn(),
    },
  };
});

describe('Smart Review Triggers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should increment winCount when recordWin is called', async () => {
    const initialState = {
      winCount: 0,
      lastPromptDate: 0,
      hasCompletedReview: false,
      promptCount: 0,
    };
    (AppUpdater.getSmartReviewState as jest.Mock).mockReturnValue(initialState);

    const { result } = renderHook(() => useAppUpdater({
      checkOnMount: false,
      smartReview: { enabled: true, winsBeforePrompt: 3 }
    }));

    await act(async () => {
      await result.current.recordWin();
    });

    expect(AppUpdater.setSmartReviewState).toHaveBeenCalledWith(
      expect.objectContaining({ winCount: 1 })
    );
  });

  it('should trigger happiness gate when threshold is reached', async () => {
    const initialState = {
      winCount: 2,
      lastPromptDate: 0,
      hasCompletedReview: false,
      promptCount: 0,
    };
    (AppUpdater.getSmartReviewState as jest.Mock).mockReturnValue(initialState);

    const { result } = renderHook(() => useAppUpdater({
      checkOnMount: false,
      smartReview: { enabled: true, winsBeforePrompt: 3 }
    }));

    await act(async () => {
      await result.current.recordWin();
    });

    expect(result.current.showHappinessGate).toBe(true);
  });

  it('should not trigger if hasCompletedReview is true', async () => {
    const initialState = {
      winCount: 2,
      lastPromptDate: 0,
      hasCompletedReview: true,
      promptCount: 0,
    };
    (AppUpdater.getSmartReviewState as jest.Mock).mockReturnValue(initialState);

    const { result } = renderHook(() => useAppUpdater({
      checkOnMount: false,
      smartReview: { enabled: true, winsBeforePrompt: 3 }
    }));

    await act(async () => {
      await result.current.recordWin();
    });

    expect(result.current.showHappinessGate).toBe(false);
    expect(AppUpdater.setSmartReviewState).not.toHaveBeenCalled();
  });

  it('should respect cooldown period', async () => {
    const recently = Date.now() - 1000; // 1 second ago
    const initialState = {
      winCount: 2,
      lastPromptDate: recently,
      hasCompletedReview: false,
      promptCount: 0,
    };
    (AppUpdater.getSmartReviewState as jest.Mock).mockReturnValue(initialState);

    const { result } = renderHook(() => useAppUpdater({
      checkOnMount: false,
      smartReview: { enabled: true, winsBeforePrompt: 3, cooldownDays: 1 }
    }));

    await act(async () => {
      await result.current.recordWin();
    });

    expect(result.current.showHappinessGate).toBe(false);
  });

  it('should handle positive feedback and trigger review', async () => {
    const initialState = {
      winCount: 3,
      lastPromptDate: 0,
      hasCompletedReview: false,
      promptCount: 0,
    };
    (AppUpdater.getSmartReviewState as jest.Mock).mockReturnValue(initialState);

    const { result } = renderHook(() => useAppUpdater({
      checkOnMount: false,
      smartReview: { enabled: true }
    }));

    await act(async () => {
      await result.current.handleHappinessPositive();
    });

    expect(result.current.showHappinessGate).toBe(false);
    expect(AppUpdater.setSmartReviewState).toHaveBeenCalledWith(
      expect.objectContaining({ hasCompletedReview: true })
    );
    expect(AppUpdater.requestInAppReview).toHaveBeenCalled();
  });

  it('should handle negative feedback and trigger callback', async () => {
    const onNegativeFeedback = jest.fn();
    const initialState = {
      winCount: 3,
      lastPromptDate: 0,
      hasCompletedReview: false,
      promptCount: 0,
    };
    (AppUpdater.getSmartReviewState as jest.Mock).mockReturnValue(initialState);

    const { result } = renderHook(() => useAppUpdater({
      checkOnMount: false,
      smartReview: { enabled: true, onNegativeFeedback }
    }));

    await act(async () => {
      await result.current.handleHappinessNegative();
    });

    expect(result.current.showHappinessGate).toBe(false);
    expect(onNegativeFeedback).toHaveBeenCalled();
    expect(AppUpdater.setSmartReviewState).toHaveBeenCalledWith(
        expect.objectContaining({ winCount: 0, hasCompletedReview: false })
    );
  });
});
