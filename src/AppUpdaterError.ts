export enum AppUpdaterErrorCode {
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  STORE_ERROR = 'STORE_ERROR',
  USER_CANCELLED = 'USER_CANCELLED',
  NO_ACTIVITY = 'NO_ACTIVITY',
  UNKNOWN = 'UNKNOWN',
}

export class AppUpdaterError extends Error {
  code: AppUpdaterErrorCode;

  constructor(code: AppUpdaterErrorCode, message: string) {
    super(message);
    this.name = 'AppUpdaterError';
    this.code = code;
    
    // Ensure the prototype is set correctly for instanceof checks
    Object.setPrototypeOf(this, AppUpdaterError.prototype);
  }

  /**
   * Helper to parse error messages from native code.
   * Native side should prefix messages with the error code followed by a colon.
   * e.g., "USER_CANCELLED: Update cancelled by user"
   */
  static fromNative(error: any): AppUpdaterError {
    const message = error instanceof Error ? error.message : String(error);
    const parts = message.split(': ');
    
    if (parts.length >= 2) {
      const potentialCode = parts[0] as AppUpdaterErrorCode;
      if (Object.values(AppUpdaterErrorCode).includes(potentialCode)) {
        return new AppUpdaterError(potentialCode, parts.slice(1).join(': '));
      }
    }
    
    return new AppUpdaterError(AppUpdaterErrorCode.UNKNOWN, message);
  }
}
