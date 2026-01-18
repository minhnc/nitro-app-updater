import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAppUpdater } from '../src/useAppUpdater';
import { AppUpdater } from '../src/index';
import { Platform, Linking } from 'react-native';
import { compareVersions } from '../src/versionCheck';

// Mock the native AppUpdater
jest.mock('../src/index', () => {
  return {
    AppUpdater: {
      getCurrentVersion: jest.fn(),
      getBundleId: jest.fn(),
      checkPlayStoreUpdate: jest.fn(),
      startInAppUpdate: jest.fn(),
      startFlexibleUpdate: jest.fn(),
      openStoreReviewPage: jest.fn(),
      getLastReviewPromptDate: jest.fn(() => 0),
    },
  };
});

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

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: '33',
  },
  Linking: {
    openURL: jest.fn(),
  },
}));

describe('useAppUpdater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    (AppUpdater.getCurrentVersion as jest.Mock).mockReturnValue('1.0.0');
    (AppUpdater.getBundleId as jest.Mock).mockReturnValue('com.example.app');
  });

  it('should return mock update in debugMode', async () => {
    const { result } = renderHook(() => useAppUpdater({ debugMode: true }));

    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.manifestVersion).toBe('9.9.9-debug');
  });

  it('should detect update available on Android', async () => {
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockResolvedValue({
      available: true,
      versionCode: 200,
    });

    const { result } = renderHook(() => useAppUpdater({ checkOnMount: false }));

    await act(async () => {
      await result.current.checkUpdate(true); 
    });

    await waitFor(() => expect(result.current.available).toBe(true));
    expect(AppUpdater.checkPlayStoreUpdate).toHaveBeenCalled();
  });

  it('should respect minOsVersion on Android', async () => {
    // Current version is 33 (mocked above)
    const { result } = renderHook(() => useAppUpdater({ minOsVersion: '34', checkOnMount: false }));

    await act(async () => {
      await result.current.checkUpdate(true);
    });

    expect(AppUpdater.checkPlayStoreUpdate).not.toHaveBeenCalled();
  });

  it('should trigger onEvent with update_available', async () => {
    const onEvent = jest.fn();
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockResolvedValue({
      available: true,
      versionCode: 200,
    });

    const { result } = renderHook(() => useAppUpdater({ onEvent, checkOnMount: false }));

    await act(async () => {
      await result.current.checkUpdate(true);
    });

    await waitFor(() => expect(onEvent).toHaveBeenCalledWith({
      type: 'update_available',
      payload: expect.anything()
    }));
  });

  it('should use iosStoreId for fallback deep link on iOS', async () => {
    Platform.OS = 'ios';
    const onEvent = jest.fn();
    
    // Mock no update from iTunes lookup
    const { checkIOSUpdate } = require('../src/versionCheck');
    (checkIOSUpdate as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useAppUpdater({ 
        iosStoreId: '123456',
        onEvent,
        checkOnMount: false 
    }));

    await act(async () => {
        // available: false, but we want to test startUpdate logic
        // We'll manually set available to true via mock or just call startUpdate
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
      await result.current.checkUpdate(true);
    });

    await waitFor(() => expect(onEvent).toHaveBeenCalledWith({
      type: 'update_dismissed',
      payload: expect.objectContaining({
        error: expect.anything()
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

    // Trigger update and mock progress
    await act(async () => {
      await result.current.startUpdate();
      
      // Get the callback passed to startFlexibleUpdate
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
      versionCode: 200
    }));
  });
});
