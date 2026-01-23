import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAppUpdater } from '../src/useAppUpdater';
import { AppUpdater } from '../src/NativeAppUpdater';
import { Platform, Linking } from 'react-native';
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
    openStoreReviewPage: jest.fn(),
    getLastReviewPromptDate: jest.fn(() => 0),
    getSmartReviewState: jest.fn(() => ({ winCount: 0, lastPromptDate: 0, hasCompletedReview: false, promptCount: 0 })),
    setSmartReviewState: jest.fn(),
  },
}));

// Mock versionCheck utilities
jest.mock('../src/versionCheck', () => ({
  checkIOSUpdate: jest.fn(),
  compareVersions: jest.fn((v1, v2) => {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }),
}));

describe('useAppUpdater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    Object.defineProperty(Platform, 'Version', { value: '33', configurable: true });
    (AppUpdater.getCurrentVersion as jest.Mock).mockReturnValue('1.0.0');
    (AppUpdater.getBundleId as jest.Mock).mockReturnValue('com.example.app');
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useAppUpdater({ checkOnMount: false }));
    expect(result.current.loading).toBe(false);
    expect(result.current.available).toBe(false);
  });

  it('should use debugMode correctly', async () => {
    const { result } = renderHook(() => useAppUpdater({ debugMode: true }));
    
    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.version).toBe('9.9.9');
  });

  it('should respect minOsVersion on Android', async () => {
    Object.defineProperty(Platform, 'Version', { value: '25', configurable: true });
    
    const { result } = renderHook(() => useAppUpdater({ minOsVersion: '26', checkOnMount: false }));

    await act(async () => {
      await result.current.checkUpdate();
    });

    expect(AppUpdater.checkPlayStoreUpdate).not.toHaveBeenCalled();
  });

  it('should trigger onEvent with update_available', async () => {
    const onEvent = jest.fn();
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockResolvedValue({
      available: true,
      versionCode: 200,
    });

    renderHook(() => useAppUpdater({ onEvent }));

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
          trackViewUrl: 'itms-apps://itunes.apple.com/app/id123456'
        });
        await result.current.checkUpdate(true);
        await result.current.startUpdate();
    });

    expect(Linking.openURL).toHaveBeenCalledWith('itms-apps://itunes.apple.com/app/id123456');
  });

  it('should handle native errors and emit update_dismissed', async () => {
    const onEvent = jest.fn();
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockRejectedValue(
      new Error('USER_CANCELLED: User rejected update')
    );

    const { result } = renderHook(() => useAppUpdater({ onEvent, checkOnMount: false }));

    await act(async () => {
      try {
        await result.current.checkUpdate(true);
      } catch (e) {
        // Expected
      }
    });

    await waitFor(() => expect(onEvent).toHaveBeenCalledWith({
      type: 'update_dismissed',
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

    const { result } = renderHook(() => useAppUpdater({ onDownloadComplete, checkOnMount: false }));

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

    const { result } = renderHook(() => useAppUpdater({ checkOnMount: false }));

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

      expect(Linking.openURL).toHaveBeenCalledWith('itms-apps://itunes.apple.com/app/id123?action=write-review');
    });

    it('should call openStoreReviewPage with bundleId on Android', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      const { result } = renderHook(() => useAppUpdater({ iosStoreId: '123', checkOnMount: false }));

      await act(async () => {
        await result.current.openStoreReviewPage();
      });

      expect(Linking.openURL).toHaveBeenCalledWith('market://details?id=com.example.app&show_reviews=true');
    });
  });
});
