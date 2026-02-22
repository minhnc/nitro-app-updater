import { renderHook, act } from '@testing-library/react-native';
import { useUpdateManager, clearUpdateCache } from '../src/useUpdateManager';
import { AppUpdater } from '../src/NativeAppUpdater';
import { checkIOSUpdate } from '../src/versionCheck';
import { Platform } from 'react-native';

// Mock dependencies
jest.mock('../src/NativeAppUpdater', () => ({
  AppUpdater: {
    checkPlayStoreUpdate: jest.fn(),
    startInAppUpdate: jest.fn(),
    startFlexibleUpdate: jest.fn(),
    completeFlexibleUpdate: jest.fn(),
    getBundleId: jest.fn(() => 'com.example.app'),
    getCurrentVersion: jest.fn(() => '1.0.0'),
  },
}));

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

describe('useUpdateManager', () => {
  const emitEvent = jest.fn();
  const iosCountryCode = 'us';
  const minRequiredVersion = '';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    clearUpdateCache();
    Platform.OS = 'android';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should fetch update info on Android', async () => {
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockResolvedValue({
      available: true,
      versionCode: 123,
    });

    const { result } = renderHook(() => useUpdateManager(
      false,
      iosCountryCode,
      minRequiredVersion,
      undefined, // iosLookupTimeoutMs
      emitEvent
    ));

    await act(async () => {
      await result.current.checkUpdate(true);
    });

    expect(result.current.updateState.available).toBe(true);
    expect(result.current.updateState.versionCode).toBe('123');
    expect(emitEvent).toHaveBeenCalledWith({
      type: 'update_available',
      payload: { version: '123' },
    });
  });

  it('should use iTunes lookup on iOS', async () => {
    Platform.OS = 'ios';
    (checkIOSUpdate as jest.Mock).mockResolvedValue({
      version: '1.1.0',
      trackViewUrl: 'https://store.com',
      releaseNotes: 'Fixed bugs',
    });

    const { result } = renderHook(() => useUpdateManager(
      false,
      iosCountryCode,
      minRequiredVersion,
      undefined, // iosLookupTimeoutMs
      emitEvent
    ));

    await act(async () => {
      await result.current.checkUpdate(true);
    });

    expect(result.current.updateState.available).toBe(true);
    expect(result.current.updateState.version).toBe('1.1.0');
    expect(result.current.updateState.trackViewUrl).toBe('https://store.com');
  });

  it('should respect minimumOsVersion from iTunes lookup', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    Object.defineProperty(Platform, 'Version', { value: '14.0', configurable: true });
    (checkIOSUpdate as jest.Mock).mockResolvedValue({ 
      version: '1.5.0', 
      minimumOsVersion: '15.0' // Higher than current OS
    });

    const { result } = renderHook(() => useUpdateManager(
      false,
      iosCountryCode,
      minRequiredVersion,
      undefined, // iosLookupTimeoutMs
      emitEvent
    ));

    await act(async () => {
      await result.current.checkUpdate(true);
    });

    // Hidden because OS version is too low
    expect(result.current.updateState.available).toBe(false);
  });

  it('should return simulated update in debugMode on iOS', async () => {
    Platform.OS = 'ios';
    const { result } = renderHook(() => useUpdateManager(
      true, // debugMode
      iosCountryCode,
      minRequiredVersion,
      undefined,
      emitEvent
    ));

    await act(async () => {
      await result.current.checkUpdate(true);
    });

    expect(result.current.updateState.available).toBe(true);
    expect(result.current.updateState.version).toBe('9.9.9');
  });

  it('should identify critical updates based on minRequiredVersion', async () => {
    Platform.OS = 'ios';
    (checkIOSUpdate as jest.Mock).mockResolvedValue({ version: '1.5.0' });

    const { result } = renderHook(() => useUpdateManager(
      false,
      iosCountryCode,
      '1.5.0', // This version makes it critical
      undefined, // iosLookupTimeoutMs
      emitEvent
    ));

    await act(async () => {
      await result.current.checkUpdate(true);
    });

    expect(result.current.updateState.available).toBe(true);
    expect(result.current.updateState.critical).toBe(true);
  });

  it('should use caching mechanism (TTL)', async () => {
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockResolvedValue({ available: true, versionCode: 100 });

    const { result } = renderHook(() => useUpdateManager(
      false,
      iosCountryCode,
      minRequiredVersion,
      undefined, // iosLookupTimeoutMs
      emitEvent
    ));

    // First call
    await act(async () => {
      await result.current.checkUpdate();
    });
    expect(AppUpdater.checkPlayStoreUpdate).toHaveBeenCalledTimes(1);

    // Second call immediately - should use cache
    await act(async () => {
      await result.current.checkUpdate();
    });
    expect(AppUpdater.checkPlayStoreUpdate).toHaveBeenCalledTimes(1);

    // Bypassing cache with force
    await act(async () => {
      await result.current.checkUpdate(true);
    });
    expect(AppUpdater.checkPlayStoreUpdate).toHaveBeenCalledTimes(2);
  });

  it('should handle Play Store error -6 gracefully', async () => {
    const error = new Error('Install not allowed (-6)');
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useUpdateManager(
      false,
      iosCountryCode,
      minRequiredVersion,
      undefined, // iosLookupTimeoutMs
      emitEvent
    ));

    await act(async () => {
      const state = await result.current.checkUpdate(true);
      expect(state.available).toBe(false);
    });

    expect(emitEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'update_failed' }));
  });

  it('should handle Play Store error -10 gracefully', async () => {
    const error = new Error('APP_NOT_OWNED: App is not installed from Google Play. -10: Install Error(-10)');
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useUpdateManager(
      false,
      iosCountryCode,
      minRequiredVersion,
      undefined, // iosLookupTimeoutMs
      emitEvent
    ));

    await act(async () => {
      const state = await result.current.checkUpdate(true);
      expect(state.available).toBe(false);
    });

    expect(emitEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'update_failed' }));
  });

  it('should clear the cache when clearUpdateCache is called', async () => {
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockResolvedValue({ available: true, versionCode: 100 });

    const { result } = renderHook(() => useUpdateManager(
      false,
      iosCountryCode,
      minRequiredVersion,
      undefined, // iosLookupTimeoutMs
      emitEvent
    ));

    // Fill cache
    await act(async () => {
      await result.current.checkUpdate();
    });
    expect(AppUpdater.checkPlayStoreUpdate).toHaveBeenCalledTimes(1);

    // Verify cache works
    await act(async () => {
      await result.current.checkUpdate();
    });
    expect(AppUpdater.checkPlayStoreUpdate).toHaveBeenCalledTimes(1);

    // Clear cache
    act(() => {
      clearUpdateCache();
    });

    // Should fetch fresh data
    await act(async () => {
      await result.current.checkUpdate();
    });
    expect(AppUpdater.checkPlayStoreUpdate).toHaveBeenCalledTimes(2);
  });
});
