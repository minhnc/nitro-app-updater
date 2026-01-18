import { type HybridObject } from "react-native-nitro-modules";

export interface AppUpdateStatus {
  available: boolean;
  versionCode?: number;
}

export interface AppUpdater
  extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  getCurrentVersion(): string;
  getBundleId(): string;
  openStore(storeId: string): void;
  openStoreReviewPage(storeId: string): void;
  
  // Android In-App Updates (Play Core)
  checkPlayStoreUpdate(debugMode?: boolean): Promise<AppUpdateStatus>;
  startInAppUpdate(immediate: boolean): Promise<void>;

  // Flexible Update Progress (Android)
  /**
   * Starts a flexible update and returns immediately.
   * Listen for progress via the provided callback.
   */
  startFlexibleUpdate(onProgress: (bytesDownloaded: number, totalBytes: number) => void): Promise<void>;
  
  /**
   * Completes the flexible update (installs downloaded APK).
   */
  completeFlexibleUpdate(): Promise<void>;

  /**
   * Requests the native in-app review dialog.
   * On Android, uses Play Core ReviewManager.
   * On iOS, uses SKStoreReviewController.
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
}
