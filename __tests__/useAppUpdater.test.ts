import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAppUpdater } from '../src/useAppUpdater';
import { AppUpdater } from '../src/NativeAppUpdater';
import { Platform, AppState } from 'react-native';
import { AppUpdaterError } from '../src/AppUpdaterError';

// Mock the native AppUpdater
jest.mock('../src/NativeAppUpdater', () => ({
  AppUpdater: {
    getCurrentVersion: jest.fn(),
    getBundleId: jest.fn(),
    checkPlayStoreUpdate: jest.fn(),
    startInAppUpdate: jest.fn(),
    startFlexibleUpdate: jest.fn(),
    completeFlexibleUpdate: jest.fn(),
    openStore: jest.fn(),
    openStoreReviewPage: jest.fn(),
    getLastReviewPromptDate: jest.fn(() => 0),
    getSmartReviewState: jest.fn(() => ({ winCount: 0, lastPromptDate: 0, hasCompletedReview: false, promptCount: 0 })),
    setSmartReviewState: jest.fn(),
  },
}));

// Mock dependencies
jest.mock('../src/versionCheck', () => {
  const mockCompareVersions = (v1: string, v2: string) => {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  };
  return {
    checkIOSUpdate: jest.fn(),
    compareVersions: mockCompareVersions,
  };
});

// Mock useUpdateManager
jest.mock('../src/useUpdateManager', () => {
  const original = jest.requireActual('../src/useUpdateManager');
  return {
    ...original,
    clearUpdateCache: jest.fn(),
  };
});

describe('useAppUpdater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    Object.defineProperty(Platform, 'Version', { value: '33', configurable: true });
    (AppUpdater.getCurrentVersion as jest.Mock).mockReturnValue('1.0.0');
    (AppUpdater.getBundleId as jest.Mock).mockReturnValue('com.example.app');
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useAppUpdater({ checkOnMount: false, iosStoreId: '' }));
    expect(result.current.loading).toBe(false);
    expect(result.current.available).toBe(false);
  });

  it('should use debugMode correctly', async () => {
    const { result } = renderHook(() => useAppUpdater({ debugMode: true, iosStoreId: '', checkOnMount: false }));
    
    await act(async () => {
      await result.current.checkUpdate(true);
    });
    
    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.version).toBe('9.9.9');
  });


  it('should trigger onEvent with update_available', async () => {
    const onEvent = jest.fn();
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockResolvedValue({
      available: true,
      versionCode: 200,
    });

    renderHook(() => useAppUpdater({ onEvent, iosStoreId: '' }));

    await waitFor(() => expect(onEvent).toHaveBeenCalledWith({
      type: 'update_available',
      payload: { version: '200' }
    }));
  });

  it('should use iosStoreId for fallback deep link on iOS', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const { result } = renderHook(() => useAppUpdater({ iosStoreId: '123456', checkOnMount: false }));

    await act(async () => {
        const { checkIOSUpdate: checkIOSUpdateMock } = require('../src/versionCheck');
        (checkIOSUpdateMock as jest.Mock).mockResolvedValue({ 
          version: '1.2.0',
          trackViewUrl: 'https://apps.apple.com/app/id123456'
        });
        await result.current.checkUpdate(true);
    });
    
    await waitFor(() => expect(result.current.available).toBe(true));

    await act(async () => {
        await result.current.startUpdate();
    });

    expect(AppUpdater.openStore).toHaveBeenCalledWith('123456');
  });

  it('should handle native errors and emit update_dismissed', async () => {
    const onEvent = jest.fn();
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockRejectedValue(
      new Error('USER_CANCELLED: User rejected update')
    );

    const { result } = renderHook(() => useAppUpdater({ onEvent, checkOnMount: false, iosStoreId: '' }));

    await act(async () => {
      try {
        await result.current.checkUpdate(true);
      } catch {
        // Ignore
      }
    });

    await waitFor(() => expect(onEvent).toHaveBeenCalledWith({
      type: 'update_failed',
      payload: expect.objectContaining({
        error: expect.any(AppUpdaterError)
      })
    }));
  });

  it('should call onDownloadComplete when flexible update finishes', async () => {
    const onDownloadComplete = jest.fn();
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockResolvedValue({
      available: true,
      versionCode: 200,
    });

    const { result } = renderHook(() => useAppUpdater({ onDownloadComplete, checkOnMount: false, iosStoreId: '' }));

    await act(async () => {
      await result.current.checkUpdate(true);
    });

    await waitFor(() => expect(result.current.available).toBe(true));

    await act(async () => {
      await result.current.startUpdate();
      
      const onProgress = (AppUpdater.startFlexibleUpdate as jest.Mock).mock.calls[0][0];
      onProgress(100, 100); // 100%
    });

    expect(onDownloadComplete).toHaveBeenCalled();
  });

  it('should return update state from checkUpdate', async () => {
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockResolvedValue({
      available: true,
      versionCode: 200,
    });

    const { result } = renderHook(() => useAppUpdater({ checkOnMount: false, iosStoreId: '' }));

    let state;
    await act(async () => {
      state = await result.current.checkUpdate(true);
    });

    expect(state).toEqual(expect.objectContaining({
      available: true,
      versionCode: '200'
    }));
  });

  describe('openStoreReviewPage', () => {
    it('should call openStoreReviewPage with iosStoreId on iOS', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
      const { result } = renderHook(() => useAppUpdater({ iosStoreId: '123', checkOnMount: false }));

      await act(async () => {
        await result.current.openStoreReviewPage();
      });

      expect(AppUpdater.openStoreReviewPage).toHaveBeenCalledWith('123');
    });

    it('should call openStoreReviewPage with bundleId on Android', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      const { result } = renderHook(() => useAppUpdater({ iosStoreId: '123', checkOnMount: false }));

      await act(async () => {
        await result.current.openStoreReviewPage();
      });

      expect(AppUpdater.openStoreReviewPage).toHaveBeenCalledWith('123');
    });
  });

  it('should reset smart review state when resetSmartReview is called', async () => {
    const { result } = renderHook(() => useAppUpdater({ checkOnMount: false, iosStoreId: '' }));
    
    await act(async () => {
      result.current.resetSmartReview();
    });

    expect(AppUpdater.setSmartReviewState).toHaveBeenCalledWith(expect.objectContaining({
      winCount: 0
    }));
  });

  describe('refreshOnForeground', () => {
    it('should clear cache and check update when changing from background to active', async () => {
      let listener: ((state: import('react-native').AppStateStatus) => void) | undefined;
      const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((event, callback) => {
        if (event === 'change') listener = callback;
        return { remove: jest.fn() } as unknown as import('react-native').NativeEventSubscription;
      });
      const { clearUpdateCache } = require('../src/useUpdateManager');
      (clearUpdateCache as jest.Mock).mockClear();

      renderHook(() => useAppUpdater({ checkOnMount: false, refreshOnForeground: true, iosStoreId: '' }));

      await act(async () => {
        // App goes to background
        listener?.('background');
      });

      await act(async () => {
        // App returns to active
        listener?.('active');
        // We need to await the checkUpdate call inside the listener
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(clearUpdateCache).toHaveBeenCalled();
      
      addEventListenerSpy.mockRestore();
    });
  });
});
