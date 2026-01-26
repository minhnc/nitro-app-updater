import type { AppUpdaterError } from './AppUpdaterError'

export interface UpdateState {
  available: boolean
  critical: boolean
  version?: string
  versionCode?: string
  releaseNotes?: string
  trackViewUrl?: string
}

export type AppUpdaterEvent = 
  | { type: 'update_available'; payload: { version: string } }
  | { type: 'update_accepted'; payload: Record<string, never> }
  | { type: 'update_dismissed'; payload: { error?: AppUpdaterError } }
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
   */
  cooldownDays?: number
  /**
   * Maximum number of times to prompt the user.
   */
  maxPrompts?: number
  /**
   * Callback when the user indicates they are unhappy.
   */
  onNegativeFeedback?: () => void
}

export interface SmartReviewState {
  winCount: number
  lastPromptDate: number
  hasCompletedReview: boolean
  promptCount: number
}

export interface AppUpdaterConfig {
  /**
   * The minimum version required. If the current version is lower, a critical update is triggered.
   */
  minRequiredVersion?: string
  /**
   * The minimum OS version required (iOS version or Android API level).
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
   * Unified event callback for analytics.
   */
  onEvent?: (event: AppUpdaterEvent) => void
  /**
   * Callback when a flexible update finishes downloading (Android only).
   */
  onDownloadComplete?: () => void
}
