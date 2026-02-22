import { type HybridObject } from "react-native-nitro-modules";

export interface AppUpdateStatus {
  available: boolean;
  versionCode?: number;
}

export interface SmartReviewState {
  winCount: number; // Integer count of positive actions
  lastPromptDate: number; // 0 if never prompted
  hasCompletedReview: boolean;
  promptCount: number; // Integer count of prompts shown
}

export interface AppUpdater extends HybridObject<{
  ios: "swift";
  android: "kotlin";
}> {
  /**
   * Returns the current application version string (e.g., "1.0.0").
   */
  getCurrentVersion(): string;
  /**
   * Returns the application bundle identifier (e.g., "com.example.app").
   */
  getBundleId(): string;
  /**
   * Opens the app's store page.
   * On iOS, uses storeId. On Android, uses the app's package name.
   */
  openStore(storeId: string): Promise<void>;
  /**
   * Opens the store's review/rating page.
   * On iOS, deep links to the "Write a Review" action.
   * On Android, opens the app's Play Store listing (no direct review action available).
   */
  openStoreReviewPage(storeId: string): Promise<void>;

  // Android In-App Updates (Play Core)
  /**
   * Checks for updates via the Google Play Store (Android only).
   */
  checkPlayStoreUpdate(debugMode?: boolean): Promise<AppUpdateStatus>;
  /**
   * (Android only) Starts the in-app update flow.
   * This always performs an immediate update (app restart required).
   * For flexible updates with progress tracking, use `startFlexibleUpdate()`.
   * Throws if no update is available or if called on iOS.
   */
  startInAppUpdate(): Promise<void>;

  // Flexible Update Progress (Android)
  /**
   * Starts a flexible update and returns immediately.
   * Listen for progress via the provided callback.
   */
  startFlexibleUpdate(
    onProgress: (bytesDownloaded: number, totalBytes: number) => void,
  ): Promise<void>;

  /**
   * Completes the flexible update (installs downloaded APK and restarts).
   */
  completeFlexibleUpdate(): Promise<void>;

  /**
   * Requests the native in-app review dialog.
   * On Android, uses Play Core ReviewManager.
   * On iOS, uses SKStoreReviewController.
   * Note: This may be suppressed by OS-level quotas. On iOS specifically, Apple provides 
   * no callback/result if the prompt was actually displayed to the user. Therefore, the 
   * cooldown timer will be recorded even if the prompt was silently suppressed.
   */
  requestInAppReview(): Promise<void>;

  /**
   * Get the last review prompt timestamp (epoch ms).
   * Returns 0 if never prompted.
   */
  getLastReviewPromptDate(): number;

  /**
   * Set the last review prompt timestamp.
   * Called internally after requestInAppReview() succeeds.
   */
  setLastReviewPromptDate(timestamp: number): void;

  /**
   * Get the persisted Smart Review state tracking wins and prompts.
   */
  getSmartReviewState(): SmartReviewState;

  /**
   * Update the persisted Smart Review state.
   */
  setSmartReviewState(state: SmartReviewState): void;
}
