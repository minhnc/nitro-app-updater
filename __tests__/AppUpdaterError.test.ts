import { AppUpdaterError, AppUpdaterErrorCode } from '../src/AppUpdaterError';

describe('AppUpdaterError', () => {
  describe('fromNative', () => {
    it('parses valid error strings', () => {
      const error = 'USER_CANCELLED: User cancelled the update';
      const result = AppUpdaterError.fromNative(error);
      expect(result).toBeInstanceOf(AppUpdaterError);
      expect(result.code).toBe(AppUpdaterErrorCode.USER_CANCELLED);
      expect(result.message).toBe('User cancelled the update');
    });

    it('parses APP_NOT_OWNED natively', () => {
      const error = 'APP_NOT_OWNED: App is not installed from Google Play. Install Error(-10)';
      const result = AppUpdaterError.fromNative(error);
      expect(result.code).toBe(AppUpdaterErrorCode.APP_NOT_OWNED);
      expect(result.message).toBe('App is not installed from Google Play. Install Error(-10)');
    });

    it('handles unknowns or missing colons', () => {
      const error = 'Some random error';
      const result = AppUpdaterError.fromNative(error);
      expect(result.code).toBe(AppUpdaterErrorCode.UNKNOWN);
      expect(result.message).toBe('Some random error');
    });

    it('handles unknown codes gracefully', () => {
      const error = 'WEIRD_CODE: Something happened';
      const result = AppUpdaterError.fromNative(error);
      // Fallback to UNKNOWN because WEIRD_CODE is not in enum
      expect(result.code).toBe(AppUpdaterErrorCode.UNKNOWN);
      expect(result.message).toBe('WEIRD_CODE: Something happened');
    });

    it('preserves extra colons in message', () => {
      const error = 'STORE_ERROR: Update failed: network timeout';
      const result = AppUpdaterError.fromNative(error);
      expect(result.code).toBe(AppUpdaterErrorCode.STORE_ERROR);
      expect(result.message).toBe('Update failed: network timeout');
    });

    it('handles non-error objects', () => {
      const result = AppUpdaterError.fromNative(12345);
      expect(result.code).toBe(AppUpdaterErrorCode.UNKNOWN);
      expect(result.message).toBe('12345');
    });

    it('handles Error objects', () => {
      const nativeError = new Error('NETWORK_ERROR: Connection lost');
      const result = AppUpdaterError.fromNative(nativeError);
      expect(result.code).toBe(AppUpdaterErrorCode.NETWORK_ERROR);
      expect(result.message).toBe('Connection lost');
    });
  });
});
