import NitroModules
import UIKit
import StoreKit

class HybridAppUpdater: HybridAppUpdaterSpec {
  private lazy var defaults: UserDefaults = {
    UserDefaults(suiteName: "nitro_app_updater") ?? .standard
  }()

  func getCurrentVersion() throws -> String {
    return Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
  }

  func getBundleId() throws -> String {
    return Bundle.main.bundleIdentifier ?? ""
  }

  func openStore(storeId: String) throws -> Promise<Void> {
    let urlString = "https://apps.apple.com/app/id\(storeId)"
    guard let url = URL(string: urlString) else {
      return Promise.rejected(withError: NSError(domain: "AppUpdater", code: 1, userInfo: [NSLocalizedDescriptionKey: "UNKNOWN: Invalid App Store URL"]))
    }

    let promise = Promise<Void>()
    UIApplication.shared.open(url, options: [:]) { success in
      if success {
        promise.resolve(withResult: ())
      } else {
        promise.reject(withError: NSError(domain: "AppUpdater", code: 1, userInfo: [NSLocalizedDescriptionKey: "STORE_ERROR: Failed to open App Store URL"]))
      }
    }
    return promise
  }

  func openStoreReviewPage(storeId: String) throws -> Promise<Void> {
    let urlString = "https://apps.apple.com/app/id\(storeId)?action=write-review"
    guard let url = URL(string: urlString) else {
      return Promise.rejected(withError: NSError(domain: "AppUpdater", code: 1, userInfo: [NSLocalizedDescriptionKey: "UNKNOWN: Invalid App Store Review URL"]))
    }

    let promise = Promise<Void>()
    UIApplication.shared.open(url, options: [:]) { success in
      if success {
        promise.resolve(withResult: ())
      } else {
        promise.reject(withError: NSError(domain: "AppUpdater", code: 1, userInfo: [NSLocalizedDescriptionKey: "STORE_ERROR: Failed to open App Store for review"]))
      }
    }
    return promise
  }

  func checkPlayStoreUpdate(debugMode: Bool?) throws -> Promise<AppUpdateStatus> {
    // Not supported on iOS - return not available
    let status = AppUpdateStatus(available: false, versionCode: nil)
    return Promise.resolved(withResult: status)
  }

  func startInAppUpdate() throws -> Promise<Void> {
    // Not supported on iOS
    return Promise.rejected(withError: NSError(domain: "AppUpdater", code: 1, userInfo: [NSLocalizedDescriptionKey: "NOT_SUPPORTED: In-App Updates are not supported on iOS via Play Core."]))
  }

  func requestInAppReview() throws -> Promise<Void> {
    let promise = Promise<Void>()
    
    DispatchQueue.main.async {
      self.attemptInAppReview(attempt: 0, promise: promise)
    }
    
    return promise
  }

  private func attemptInAppReview(attempt: Int, promise: Promise<Void>) {
    if #available(iOS 14.0, *) {
      // Try to find the most appropriate scene
      let scenes = UIApplication.shared.connectedScenes
      let activeScene = scenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
      let firstScene = scenes.first { $0 is UIWindowScene } as? UIWindowScene
      
      if let scene = activeScene ?? firstScene {
        SKStoreReviewController.requestReview(in: scene)
        self.setLastReviewPromptDate(timestamp: Date().timeIntervalSince1970 * 1000)
        promise.resolve(withResult: ())
      } else if attempt < 3 {
         // Retry after a short delay (scene might be transitioning)
         DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
           guard let self = self else {
             // If self is gone, we can't retry, but we should reject or resolve the promise to avoid hanging?
             // Actually if self is gone, the app is probably closing or module deallocating.
             // We can safely ignore or reject.
             let error = NSError(domain: "AppUpdater", code: 1, userInfo: [NSLocalizedDescriptionKey: "Updater deallocated during retry"])
             promise.reject(withError: error)
             return
           }
           self.attemptInAppReview(attempt: attempt + 1, promise: promise)
         }
      } else {
        let errorMsg = "No valid UIWindowScene found for review prompt. Status: \(UIApplication.shared.applicationState.rawValue)"
        print("[AppUpdater] \(errorMsg)")
        promise.reject(withError: NSError(domain: "AppUpdater", code: 1, userInfo: [NSLocalizedDescriptionKey: errorMsg]))
      }
    } else {
      SKStoreReviewController.requestReview()
      self.setLastReviewPromptDate(timestamp: Date().timeIntervalSince1970 * 1000)
      promise.resolve(withResult: ())
    }
  }

  private enum StorageKeys {
    static let lastReviewDate = "nitro_app_updater_last_review_date"
    static let smartReviewWinCount = "nitro_app_updater_smart_review_win_count"
    static let smartReviewLastPrompt = "nitro_app_updater_smart_review_last_prompt"
    static let smartReviewCompleted = "nitro_app_updater_smart_review_completed"
    static let smartReviewPromptCount = "nitro_app_updater_smart_review_prompt_count"
  }

  func getLastReviewPromptDate() -> Double {
    return defaults.double(forKey: StorageKeys.lastReviewDate)
  }

  func setLastReviewPromptDate(timestamp: Double) {
    defaults.set(timestamp, forKey: StorageKeys.lastReviewDate)
  }

  func getSmartReviewState() -> SmartReviewState {
    // Note: Double values implicitly cast to Int here, safe since wins are whole numbers
    return SmartReviewState(
      winCount: Double(defaults.integer(forKey: StorageKeys.smartReviewWinCount)),
      lastPromptDate: defaults.double(forKey: StorageKeys.smartReviewLastPrompt),
      hasCompletedReview: defaults.bool(forKey: StorageKeys.smartReviewCompleted),
      promptCount: Double(defaults.integer(forKey: StorageKeys.smartReviewPromptCount))
    )
  }

  func setSmartReviewState(state: SmartReviewState) {
    defaults.set(Int(state.winCount), forKey: StorageKeys.smartReviewWinCount)
    defaults.set(state.lastPromptDate, forKey: StorageKeys.smartReviewLastPrompt)
    defaults.set(state.hasCompletedReview, forKey: StorageKeys.smartReviewCompleted)
    defaults.set(Int(state.promptCount), forKey: StorageKeys.smartReviewPromptCount)
  }

  func startFlexibleUpdate(onProgress: @escaping ((Double, Double) -> Void)) throws -> Promise<Void> {
    return Promise.rejected(withError: NSError(domain: "AppUpdater", code: 1, userInfo: [NSLocalizedDescriptionKey: "NOT_SUPPORTED: Flexible updates are not supported on iOS."]))
  }

  func completeFlexibleUpdate() throws -> Promise<Void> {
    return Promise.rejected(withError: NSError(domain: "AppUpdater", code: 1, userInfo: [NSLocalizedDescriptionKey: "NOT_SUPPORTED: Flexible updates are not supported on iOS."]))
  }
}
