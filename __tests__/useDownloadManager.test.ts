import { renderHook, act } from '@testing-library/react-native';
import { useDownloadManager } from '../src/useDownloadManager';
import { AppUpdater } from '../src/NativeAppUpdater';
import { Platform, Linking } from 'react-native';

// Mock dependencies
jest.mock('../src/NativeAppUpdater', () => ({
  AppUpdater: {
    startFlexibleUpdate: jest.fn(),
    startInAppUpdate: jest.fn(),
    completeFlexibleUpdate: jest.fn(),
    getBundleId: jest.fn(() => 'com.example.app'),
  },
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
  Linking: {
    openURL: jest.fn(),
  },
}));

describe('useDownloadManager', () => {
  const emitEvent = jest.fn();
  const onDownloadComplete = jest.fn();
  const iosStoreId = '123456';
  const updateState = { available: true, critical: false, trackViewUrl: 'https://store.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should trigger mock download in debugMode', async () => {
    const { result } = renderHook(() => useDownloadManager(
      updateState,
      true, // debugMode
      iosStoreId,
      emitEvent,
      onDownloadComplete
    ));

    await act(async () => {
      await result.current.startUpdate();
    });

    // Verify initial progress
    expect(result.current.downloadProgress.percent).toBe(0);

    // Fast forward halfway
    act(() => {
      jest.advanceTimersByTime(2500); // 5 intervals of 500ms
    });

    expect(result.current.downloadProgress.percent).toBe(50);
    expect(result.current.isDownloadComplete).toBe(false);

    // Finish simulation
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.downloadProgress.percent).toBe(100);
    expect(result.current.isDownloadComplete).toBe(true);
    expect(onDownloadComplete).toHaveBeenCalled();
    expect(emitEvent).toHaveBeenCalledWith({ type: 'update_downloaded', payload: {} });
  });

  it('should call native startFlexibleUpdate on Android', async () => {
    Platform.OS = 'android';
    const { result } = renderHook(() => useDownloadManager(
      updateState,
      false, // debugMode
      iosStoreId,
      emitEvent,
      onDownloadComplete
    ));

    await act(async () => {
      await result.current.startUpdate();
    });

    expect(AppUpdater.startFlexibleUpdate).toHaveBeenCalled();
    
    // Simulate native progress callback
    const progressCallback = (AppUpdater.startFlexibleUpdate as jest.Mock).mock.calls[0][0];
    act(() => {
      progressCallback(1000, 1000); // 100%
    });

    expect(result.current.isDownloadComplete).toBe(true);
    expect(emitEvent).toHaveBeenCalledWith({ type: 'update_downloaded', payload: {} });
  });

  it('should call native startInAppUpdate for critical updates', async () => {
    Platform.OS = 'android';
    const criticalState = { ...updateState, critical: true };
    const { result } = renderHook(() => useDownloadManager(
      criticalState,
      false,
      iosStoreId,
      emitEvent
    ));

    await act(async () => {
      await result.current.startUpdate();
    });

    expect(AppUpdater.startInAppUpdate).toHaveBeenCalledWith(true);
  });

  it('should open Store URL on iOS', async () => {
    Platform.OS = 'ios';
    const { result } = renderHook(() => useDownloadManager(
      updateState,
      false,
      iosStoreId,
      emitEvent
    ));

    await act(async () => {
      await result.current.startUpdate();
    });

    expect(Linking.openURL).toHaveBeenCalledWith('https://store.com');
  });

  it('should call completeFlexibleUpdate on Android', async () => {
    Platform.OS = 'android';
    const { result } = renderHook(() => useDownloadManager(
      updateState,
      false,
      iosStoreId,
      emitEvent
    ));

    await act(async () => {
      await result.current.completeUpdate();
    });

    expect(AppUpdater.completeFlexibleUpdate).toHaveBeenCalled();
  });

  it('should cleanup intervals on unmount', async () => {
    const { unmount, result } = renderHook(() => useDownloadManager(
      updateState,
      true, // debugMode
      iosStoreId,
      emitEvent
    ));

    await act(async () => {
      await result.current.startUpdate();
    });

    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
