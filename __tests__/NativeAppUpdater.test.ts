import { AppUpdaterError, AppUpdaterErrorCode } from '../src/AppUpdaterError';
import { NitroModules } from 'react-native-nitro-modules';

// Mock NitroModules to control its behavior
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(),
  },
}));

describe('NativeAppUpdater Proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // We need to reset the _appUpdater variable inside NativeAppUpdater
    // because it caches the first result. We can do this by isolating modules.
    jest.isolateModules(() => {});
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('delegates property access to the native module and binds methods', () => {
    const mockNativeAppUpdater = {
      getCurrentVersion: jest.fn().mockImplementation(function(this: unknown) {
        // Ensure 'this' is bound to the mock object
        if (this !== mockNativeAppUpdater) throw new Error('Unbound this context');
        return '1.0.0';
      }),
      someProperty: 'value',
    };

    (NitroModules.createHybridObject as jest.Mock).mockReturnValue(mockNativeAppUpdater);

    // Re-import to get a fresh proxy that will call createHybridObject again
    const { AppUpdater: FreshAppUpdater } = require('../src/NativeAppUpdater');

    expect(FreshAppUpdater.getCurrentVersion()).toBe('1.0.0');
    expect(FreshAppUpdater.someProperty).toBe('value');
    expect(mockNativeAppUpdater.getCurrentVersion).toHaveBeenCalledTimes(1);
    expect(NitroModules.createHybridObject).toHaveBeenCalledWith('AppUpdater');
  });

  it('throws NOT_SUPPORTED AppUpdaterError if the native module is undefined or errors', () => {
    (NitroModules.createHybridObject as jest.Mock).mockImplementation(() => {
      throw new Error('Module not linked');
    });

    const { AppUpdater: FreshAppUpdater } = require('../src/NativeAppUpdater');

    // Trying to access any property should throw
    expect(() => {
      FreshAppUpdater.getCurrentVersion();
    }).toThrow();

    try {
      FreshAppUpdater.getCurrentVersion();
    } catch (e: unknown) {
      expect((e as Error).name).toBe('AppUpdaterError');
      const err = e as AppUpdaterError;
      expect(err.code).toBe(AppUpdaterErrorCode.NOT_SUPPORTED);
      expect(err.message).toContain('Native module "AppUpdater" is not available');
    }
  });
});
