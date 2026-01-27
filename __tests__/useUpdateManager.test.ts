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

describe('useUpdateManager', () => {
  const emitEvent = jest.fn();
  const iosCountryCode = 'us';
  const minOsVersion = '';
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
      minOsVersion,
      minRequiredVersion,
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
      minOsVersion,
      minRequiredVersion,
      emitEvent
    ));

    await act(async () => {
      await result.current.checkUpdate(true);
    });

    expect(result.current.updateState.available).toBe(true);
    expect(result.current.updateState.version).toBe('1.1.0');
    expect(result.current.updateState.trackViewUrl).toBe('https://store.com');
  });

  it('should respect minOsVersion', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    Object.defineProperty(Platform, 'Version', { value: 25, configurable: true });
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockResolvedValue({ available: true, versionCode: 100 });

    const { result } = renderHook(() => useUpdateManager(
      false,
      iosCountryCode,
      '26', // Required
      minRequiredVersion,
      emitEvent
    ));

    await act(async () => {
      await result.current.checkUpdate(true);
    });

    // Hidden because OS version is too low
    expect(result.current.updateState.available).toBe(false);
  });

  it('should identify critical updates based on minRequiredVersion', async () => {
    Platform.OS = 'ios';
    (checkIOSUpdate as jest.Mock).mockResolvedValue({ version: '1.5.0' });

    const { result } = renderHook(() => useUpdateManager(
      false,
      iosCountryCode,
      minOsVersion,
      '1.5.0', // This version makes it critical
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
      minOsVersion,
      minRequiredVersion,
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
      minOsVersion,
      minRequiredVersion,
      emitEvent
    ));

    await act(async () => {
      const state = await result.current.checkUpdate(true);
      expect(state.available).toBe(false);
    });

    expect(emitEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'update_dismissed' }));
  });

  it('should clear the cache when clearUpdateCache is called', async () => {
    (AppUpdater.checkPlayStoreUpdate as jest.Mock).mockResolvedValue({ available: true, versionCode: 100 });

    const { result } = renderHook(() => useUpdateManager(
      false,
      iosCountryCode,
      minOsVersion,
      minRequiredVersion,
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
