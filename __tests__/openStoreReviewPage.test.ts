import { renderHook, act } from '@testing-library/react-native';
import { useAppUpdater } from '../src/useAppUpdater';
import { AppUpdater } from '../src/index';
// @ts-ignore
import { Platform } from 'react-native';

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

// Mock versionCheck utilities
jest.mock('../src/versionCheck', () => ({
    checkIOSUpdate: jest.fn(),
    compareVersions: jest.fn(),
}));

describe('openStoreReviewPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (AppUpdater.getBundleId as jest.Mock).mockReturnValue('com.example.app');
    });

    it('should call openStoreReviewPage with iosStoreId on iOS', () => {
        Platform.OS = 'ios';
        const { result } = renderHook(() => useAppUpdater({ iosStoreId: '123' }));

        act(() => {
            result.current.openStoreReviewPage();
        });

        expect(AppUpdater.openStoreReviewPage).toHaveBeenCalledWith('123');
    });

    it('should call openStoreReviewPage with bundleId on Android', () => {
        Platform.OS = 'android';
        const { result } = renderHook(() => useAppUpdater({ iosStoreId: '123' }));

        act(() => {
            result.current.openStoreReviewPage();
        });

        expect(AppUpdater.openStoreReviewPage).toHaveBeenCalledWith('com.example.app');
    });
});
