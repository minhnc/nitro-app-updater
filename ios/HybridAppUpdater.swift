import NitroModules
import UIKit
import StoreKit

class HybridAppUpdater: HybridAppUpdaterSpec {
  func getCurrentVersion() throws -> String {
    return Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
  }

  func getBundleId() throws -> String {
    return Bundle.main.bundleIdentifier ?? ""
  }

  func openStore(storeId: String) throws {
    // Redirect to App Store
    // storeId should be the numeric ID (e.g., "123456789")
    guard let url = URL(string: "itms-apps://itunes.apple.com/app/id\(storeId)") else {
      print("Invalid App Store URL for ID: \(storeId)")
      return
    }
    
    if UIApplication.shared.canOpenURL(url) {
      if #available(iOS 10.0, *) {
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
      } else {
        UIApplication.shared.openURL(url)
      }
    }
  }

  func openStoreReviewPage(storeId: String) throws {
    // Open App Store directly to the "Write a Review" action
    // Query params: ?action=write-review
    guard let url = URL(string: "itms-apps://itunes.apple.com/app/id\(storeId)?action=write-review") else {
      print("Invalid App Store URL for ID: \(storeId)")
      return
    }
    
    if UIApplication.shared.canOpenURL(url) {
      if #available(iOS 10.0, *) {
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
      } else {
        UIApplication.shared.openURL(url)
      }
    }
  }

  func checkPlayStoreUpdate(debugMode: Bool?) throws -> Promise<AppUpdateStatus> {
    // Not supported on iOS - return not available
    let status = AppUpdateStatus(available: false, versionCode: nil)
    return Promise.resolved(withResult: status)
  }

  func startInAppUpdate(immediate: Bool) throws -> Promise<Void> {
    // Not supported on iOS
    return Promise.rejected(withError: NSError(domain: "AppUpdater", code: 1, userInfo: [NSLocalizedDescriptionKey: "In-App Updates are not supported on iOS via Play Core."]))
  }

  func requestInAppReview() throws -> Promise<Void> {
    let promise = Promise<Void>()
    
    DispatchQueue.main.async {
      func attemptReview(attempt: Int) {
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
             DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
               attemptReview(attempt: attempt + 1)
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
      
      attemptReview(attempt: 0)
    }
    
    return promise
  }

  func getLastReviewPromptDate() -> Double {
    return UserDefaults.standard.double(forKey: "nitro_app_updater_last_review_date")
  }

  func setLastReviewPromptDate(timestamp: Double) {
    UserDefaults.standard.set(timestamp, forKey: "nitro_app_updater_last_review_date")
  }

  func getSmartReviewState() -> SmartReviewState {
    let defaults = UserDefaults.standard
    return SmartReviewState(
      winCount: defaults.double(forKey: "nitro_smart_review_win_count"),
      lastPromptDate: defaults.double(forKey: "nitro_smart_review_last_prompt"),
      hasCompletedReview: defaults.bool(forKey: "nitro_smart_review_completed"),
      promptCount: defaults.double(forKey: "nitro_smart_review_prompt_count")
    )
  }

  func setSmartReviewState(state: SmartReviewState) {
    let defaults = UserDefaults.standard
    defaults.set(state.winCount, forKey: "nitro_smart_review_win_count")
    defaults.set(state.lastPromptDate, forKey: "nitro_smart_review_last_prompt")
    defaults.set(state.hasCompletedReview, forKey: "nitro_smart_review_completed")
    defaults.set(state.promptCount, forKey: "nitro_smart_review_prompt_count")
  }

  func startFlexibleUpdate(onProgress: @escaping ((Double, Double) -> Void)) throws -> Promise<Void> {
    return Promise.rejected(withError: NSError(domain: "AppUpdater", code: 1, userInfo: [NSLocalizedDescriptionKey: "Flexible updates are not supported on iOS."]))
  }

  func completeFlexibleUpdate() throws -> Promise<Void> {
    return Promise.rejected(withError: NSError(domain: "AppUpdater", code: 1, userInfo: [NSLocalizedDescriptionKey: "Flexible updates are not supported on iOS."]))
  }
}
