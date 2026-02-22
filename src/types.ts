import type { AppUpdaterError } from './AppUpdaterError'

/**
 * Describes the current state of an available app update.
 */
export interface UpdateState {
  /** Whether an update is available from the store. */
  available: boolean
  /** Whether the update is critical (current version < `minRequiredVersion`). */
  critical: boolean
  /** The new version string from the store (e.g., "2.0.0"). iOS only. */
  version?: string
  /** The new version code from the Play Store (e.g., "200"). Android only. */
  versionCode?: string
  /** Release notes or "What's New" text from the store (iOS only). */
  releaseNotes?: string
  /** The App Store URL for the update (iOS only). Used internally for deep linking. */
  trackViewUrl?: string
}

export type AppUpdaterEvent = 
  | { type: 'update_available'; payload: { version: string } }
  | { type: 'update_accepted'; payload: Record<string, never> }
  | { type: 'update_dismissed'; payload: { error?: AppUpdaterError } }
  | { type: 'update_failed'; payload: { error: AppUpdaterError } }
  | { type: 'update_downloaded'; payload: Record<string, never> }
  | { type: 'review_requested'; payload: Record<string, never> }
  | { type: 'review_completed'; payload: Record<string, never> }
  | { type: 'win_recorded'; payload: { count: number } }
  | { type: 'happiness_gate_shown'; payload: Record<string, never> }
  | { type: 'happiness_positive'; payload: Record<string, never> }
  | { type: 'happiness_negative'; payload: Record<string, never> }
  | { type: 'happiness_dismissed'; payload: Record<string, never> }

export interface SmartReviewConfig {
  /**
   * Whether to enable the Smart Review feature.
   */
  enabled?: boolean
  /**
   * Number of positive actions (wins) before prompting.
   */
  winsBeforePrompt?: number
  /**
   * Days to wait before prompting again if dismissed.
   * Note: This does not bypass native OS-level quotas (e.g. iOS max 3 prompts per year).
   */
  cooldownDays?: number;
  /**
   * Maximum number of times to prompt the user via this library's logic.
   * Note: This does not bypass native OS-level quotas.
   */
  maxPrompts?: number;
  /**
   * Callback when the user indicates they are unhappy.
   */
  onNegativeFeedback?: () => void
}

export type { SmartReviewState } from './AppUpdater.nitro'

export interface AppUpdaterConfig {
  /**
   * The minimum version required. If the current version is lower, a critical update is triggered.
   */
  minRequiredVersion?: string
  /**
   * @deprecated Standard store APIs (Google Play & iTunes) handle OS compatibility natively.
   * This property is now ignored and will be removed in a future major version.
   */
  minOsVersion?: string
  /**
   * iOS App Store country code (default: 'us').
   */
  iosCountryCode?: string
  /**
   * iOS App Store numeric ID for deep linking.
   */
  iosStoreId?: string
  /**
   * Timeout for iOS App Store lookup in milliseconds (default: 10000).
   */
  iosLookupTimeoutMs?: number
  /**
   * Whether to check for updates when the hook mounts.
   */
  checkOnMount?: boolean
  /**
   * Mock update availability for testing.
   */
  debugMode?: boolean
  /**
   * Days to wait between native in-app review prompts (default: 120).
   */
  reviewCooldownDays?: number
  /**
   * Smart review (Happiness Gate) configuration.
   */
  smartReview?: SmartReviewConfig
  /**
   * Whether the updater is enabled. If false, it completely deactivates the hook (no update checks, no smart review).
   * Note: This is a global toggle. To disable *only* the Smart Review feature, use `smartReview: { enabled: false }`.
   * Useful when providing an external updater state to UpdatePrompt.
   */
  enabled?: boolean
  /**
   * Unified event callback for analytics.
   */
  onEvent?: (event: AppUpdaterEvent) => void
  /**
   * Callback when a flexible update finishes downloading (Android only).
   */
  onDownloadComplete?: () => void
  /**
   * Whether to automatically check for updates when the app returns to the foreground (default: true).
   */
  refreshOnForeground?: boolean
}
