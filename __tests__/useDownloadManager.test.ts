import { renderHook, act } from '@testing-library/react-native';
import { useDownloadManager } from '../src/useDownloadManager';
import { AppUpdater } from '../src/NativeAppUpdater';
import { Platform } from 'react-native';
import { AppUpdaterError } from '../src/AppUpdaterError';

// Mock dependencies
jest.mock('../src/NativeAppUpdater', () => ({
  AppUpdater: {
    startFlexibleUpdate: jest.fn(),
    startInAppUpdate: jest.fn(),
    completeFlexibleUpdate: jest.fn(),
    openStore: jest.fn(),
    getBundleId: jest.fn(() => 'com.example.app'),
  },
}));


describe('useDownloadManager', () => {
  const emitEvent = jest.fn();
  const onDownloadComplete = jest.fn();
  const iosStoreId = '123456';
  const updateState = { 
    available: true, 
    critical: false, 
    trackViewUrl: 'https://apps.apple.com/app/id123456' 
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    Platform.OS = 'android';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should trigger mock download in debugMode', async () => {
    const { result } = renderHook(() => useDownloadManager(
      updateState,
      { current: onDownloadComplete },
      emitEvent,
      iosStoreId,
      true // debugMode
    ));

    await act(async () => {
      await result.current.startUpdate();
    });

    // Verify initial progress
    expect(result.current.downloadProgress.percent).toBe(0);
    expect(result.current.isDownloading).toBe(true);

    // Fast forward halfway
    act(() => {
      jest.advanceTimersByTime(2500); // 5 intervals of 500ms
    });

    expect(result.current.downloadProgress.percent).toBe(50);
    expect(result.current.isDownloadComplete).toBe(false);
    expect(result.current.isDownloading).toBe(true);

    // Finish simulation
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.downloadProgress.percent).toBe(100);
    expect(result.current.isDownloadComplete).toBe(true);
    expect(result.current.isDownloading).toBe(false);
    expect(onDownloadComplete).toHaveBeenCalled();
    expect(emitEvent).toHaveBeenCalledWith({ type: 'update_downloaded', payload: {} });
  });

  it('should call native startFlexibleUpdate on Android', async () => {
    Platform.OS = 'android';
    const { result } = renderHook(() => useDownloadManager(
      updateState,
      { current: onDownloadComplete },
      emitEvent,
      iosStoreId,
      false // debugMode
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
      { current: onDownloadComplete },
      emitEvent,
      iosStoreId
    ));

    await act(async () => {
      await result.current.startUpdate();
    });

    expect(AppUpdater.startInAppUpdate).toHaveBeenCalledWith();
  });

  it('should use AppUpdater.openStore on iOS when trackViewUrl is provided', async () => {
    Platform.OS = 'ios';
    const { result } = renderHook(() => useDownloadManager(
      updateState,
      { current: onDownloadComplete },
      emitEvent,
      iosStoreId
    ));

    await act(async () => {
      await result.current.startUpdate();
    });

    // It should extract the ID from the URL and call openStore
    expect(AppUpdater.openStore).toHaveBeenCalledWith('123456');
  });

  it('should emit update_failed when both trackViewUrl and iosStoreId are missing on iOS', async () => {
    Platform.OS = 'ios';
    const stateWithoutUrl = { ...updateState, trackViewUrl: undefined };
    const { result } = renderHook(() => useDownloadManager(
      stateWithoutUrl,
      { current: onDownloadComplete },
      emitEvent,
      undefined // missing iosStoreId
    ));

    await act(async () => {
      await result.current.startUpdate();
    });

    expect(emitEvent).toHaveBeenCalledWith({
      type: 'update_failed',
      payload: expect.objectContaining({ error: expect.any(AppUpdaterError) })
    });
  });

  it('should call native openStore on iOS as fallback when trackViewUrl is missing', async () => {
    Platform.OS = 'ios';
    const stateWithoutUrl = { ...updateState, trackViewUrl: undefined };
    const { result } = renderHook(() => useDownloadManager(
      stateWithoutUrl,
      { current: onDownloadComplete },
      emitEvent,
      iosStoreId
    ));

    await act(async () => {
      await result.current.startUpdate();
    });

    expect(AppUpdater.openStore).toHaveBeenCalledWith(iosStoreId);
  });

  it('should call completeFlexibleUpdate on Android', async () => {
    Platform.OS = 'android';
    const { result } = renderHook(() => useDownloadManager(
      updateState,
      { current: onDownloadComplete },
      emitEvent,
      iosStoreId
    ));

    await act(async () => {
      await result.current.completeUpdate();
    });

    expect(AppUpdater.completeFlexibleUpdate).toHaveBeenCalled();
  });

  it('should cleanup intervals on unmount', async () => {
    const { unmount, result } = renderHook(() => useDownloadManager(
      updateState,
      { current: onDownloadComplete },
      emitEvent,
      iosStoreId,
      true // debugMode
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
