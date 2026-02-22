package com.margelo.nitro.minhnc.appupdater

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.annotation.Keep
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.ktx.isFlexibleUpdateAllowed
import com.google.android.play.core.review.ReviewManagerFactory
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise

@DoNotStrip
@Keep
class HybridAppUpdater : HybridAppUpdaterSpec(), ActivityEventListener {
  companion object {
    private const val KEY_APP_UPDATER_PREFS = "nitro_app_updater_prefs"
    private const val KEY_LAST_REVIEW_DATE = "nitro_app_updater_last_review_date"
    private const val KEY_SMART_REVIEW_STATE = "nitro_app_updater_smart_review_state"
    private const val KEY_SMART_REVIEW_WIN_COUNT = "nitro_app_updater_smart_review_win_count"
    private const val KEY_SMART_REVIEW_LAST_PROMPT = "nitro_app_updater_smart_review_last_prompt"
    private const val KEY_SMART_REVIEW_COMPLETED = "nitro_app_updater_smart_review_completed"
    private const val KEY_SMART_REVIEW_PROMPT_COUNT = "nitro_app_updater_smart_review_prompt_count"
    private const val REQUEST_CODE_UPDATE = 1337
  }
  private var pendingUpdatePromise: Promise<Unit>? = null
  private var flexibleUpdateListener:
          com.google.android.play.core.install.InstallStateUpdatedListener? =
          null

  private val context: ReactApplicationContext?
    get() = NitroModules.applicationContext

  init {
    context?.addActivityEventListener(this)

    // Clean up when Activity is destroyed to prevent memory leaks
    context?.currentActivity?.let { activity ->
      if (activity is LifecycleOwner) {
        activity.runOnUiThread {
          activity.lifecycle.addObserver(
                  LifecycleEventObserver { _, event ->
                    if (event == Lifecycle.Event.ON_DESTROY) {
                      pendingUpdatePromise?.reject(
                              Error("NO_ACTIVITY: Activity destroyed during update")
                      )
                      pendingUpdatePromise = null

                      // Cleanup listener - use raw context access to avoid throwing if context is
                      // already null
                      flexibleUpdateListener?.let { listener ->
                        if (context != null) {
                          appUpdateManager.unregisterListener(listener)
                        }
                      }
                      flexibleUpdateListener = null
                    }
                  }
          )
        }
      }
    }
  }

  private val appUpdateManager: AppUpdateManager by lazy {
    AppUpdateManagerFactory.create(requireContext())
  }

  private val prefs: android.content.SharedPreferences by lazy {
    requireContext()
            .getSharedPreferences(KEY_APP_UPDATER_PREFS, android.content.Context.MODE_PRIVATE)
  }

  private fun requireContext(): ReactApplicationContext {
    return context ?: throw Error("UNKNOWN: React Application Context is null!")
  }

  override fun getCurrentVersion(): String {
    val ctx = requireContext()
    val pInfo = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
    return pInfo.versionName ?: "0.0.0"
  }

  override fun getBundleId(): String {
    return requireContext().packageName
  }

  // Note: storeId is the iOS App Store numeric ID passed from JS.
  // On Android we always use the app's own package name for Play Store intents.
  override fun openStore(storeId: String): Promise<Unit> {
    val promise = Promise<Unit>()
    val packageName = getBundleId()
    try {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$packageName"))
      val activity = context?.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        requireContext().startActivity(intent)
      }
      promise.resolve(Unit)
    } catch (e: Exception) {
      // Fallback to HTTPS if Play Store is not installed or enabled
      try {
        val webIntent =
                Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("https://play.google.com/store/apps/details?id=$packageName")
                )
        val activity = context?.currentActivity
        if (activity != null) {
          activity.startActivity(webIntent)
        } else {
          webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          requireContext().startActivity(webIntent)
        }
        promise.resolve(Unit)
      } catch (inner: Exception) {
        promise.reject(inner)
      }
    }
    return promise
  }

  override fun openStoreReviewPage(storeId: String): Promise<Unit> {
    // For Android, just opening the store page is standard for manual reviews.
    // There isn't a direct "write-review" action intent that is universally supported
    // like iOS, so we redirect to the app details page where users can rate.
    return openStore(storeId)
  }

  override fun checkPlayStoreUpdate(debugMode: Boolean?): Promise<AppUpdateStatus> {
    val promise = Promise<AppUpdateStatus>()

    if (debugMode == true) {
      val status = AppUpdateStatus(true, 999999.0) // Mock update available
      promise.resolve(status)
      return promise
    }

    val task = appUpdateManager.appUpdateInfo

    task.addOnSuccessListener { info ->
      val available =
              info.updateAvailability() ==
                      com.google.android.play.core.install.model.UpdateAvailability.UPDATE_AVAILABLE
      val versionCode = info.availableVersionCode().toDouble()
      val status = AppUpdateStatus(available, versionCode)
      promise.resolve(status)
    }
    task.addOnFailureListener { e ->
      val msg = e.message ?: ""
      if (msg.contains("Install Error(-10)")) {
        promise.reject(Error("APP_NOT_OWNED: App is not installed from Google Play. $msg"))
      } else {
        promise.reject(e)
      }
    }
    return promise
  }

  /**
   * Note: On Android, this promise resolves when the review flow *launches* (or is suppressed by
   * quota), not when the user interacts with it. We cannot know if the user actually reviewed the
   * app.
   */
  override fun startInAppUpdate(): Promise<Unit> {
    val result = Promise<Unit>()
    val appContext = requireContext()
    val activity = appContext.currentActivity
    if (activity == null) {
      result.reject(Error("NO_ACTIVITY: Not attached to an Activity"))
      return result
    }

    val appUpdateInfoTask = appUpdateManager.appUpdateInfo

    appUpdateInfoTask.addOnSuccessListener { appUpdateInfo ->
      if (appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
        try {
          pendingUpdatePromise = result
          val options = AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()
          appUpdateManager.startUpdateFlowForResult(
                  appUpdateInfo,
                  activity,
                  options,
                  REQUEST_CODE_UPDATE
          )
        } catch (e: Exception) {
          pendingUpdatePromise = null
          result.reject(Error("STORE_ERROR: ${e.message}"))
        }
      } else {
        result.reject(Error("STORE_ERROR: Immediate update not allowed or available"))
      }
    }

    appUpdateInfoTask.addOnFailureListener { e ->
      result.reject(Error("STORE_ERROR: ${e.message}"))
    }

    return result
  }

  override fun startFlexibleUpdate(onProgress: (Double, Double) -> Unit): Promise<Unit> {
    val promise = Promise<Unit>()
    val activity = context?.currentActivity
    if (activity == null) {
      promise.reject(Error("NO_ACTIVITY: No current activity found"))
      return promise
    }

    val listener =
            object : com.google.android.play.core.install.InstallStateUpdatedListener {
              override fun onStateUpdate(state: com.google.android.play.core.install.InstallState) {
                if (state.installStatus() ==
                                com.google.android.play.core.install.model.InstallStatus.DOWNLOADING
                ) {
                  val bytesDownloaded = state.bytesDownloaded().toDouble()
                  val totalBytes = state.totalBytesToDownload().toDouble()
                  onProgress(bytesDownloaded, totalBytes)
                } else if (state.installStatus() ==
                                com.google.android.play.core.install.model.InstallStatus.DOWNLOADED
                ) {
                  val totalBytes = state.totalBytesToDownload().toDouble()
                  onProgress(totalBytes, totalBytes) // Ensure 100% completion is sent
                  appUpdateManager.unregisterListener(this)
                  flexibleUpdateListener = null
                  promise.resolve(Unit)
                } else if (state.installStatus() ==
                                com.google.android.play.core.install.model.InstallStatus.FAILED
                ) {
                  appUpdateManager.unregisterListener(this)
                  flexibleUpdateListener = null
                  promise.reject(Error("STORE_ERROR: Flexible update failed"))
                } else if (state.installStatus() ==
                                com.google.android.play.core.install.model.InstallStatus.CANCELED
                ) {
                  appUpdateManager.unregisterListener(this)
                  flexibleUpdateListener = null
                  promise.reject(Error("USER_CANCELLED: Flexible update cancelled by user"))
                } else if (state.installStatus() ==
                                com.google.android.play.core.install.model.InstallStatus.PENDING
                ) {
                  Log.d("HybridAppUpdater", "Flexible update is pending...")
                }
              }
            }

    flexibleUpdateListener?.let { appUpdateManager.unregisterListener(it) }
    flexibleUpdateListener = listener
    appUpdateManager.registerListener(listener)

    val task = appUpdateManager.appUpdateInfo
    task.addOnSuccessListener { info ->
      if (info.isFlexibleUpdateAllowed) {
        try {
          val options = AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build()

          appUpdateManager.startUpdateFlowForResult(info, activity, options, REQUEST_CODE_UPDATE)
        } catch (e: Exception) {
          appUpdateManager.unregisterListener(listener)
          flexibleUpdateListener = null
          promise.reject(e)
        }
      } else {
        appUpdateManager.unregisterListener(listener)
        flexibleUpdateListener = null
        promise.reject(Error("NOT_SUPPORTED: Flexible update not allowed"))
      }
    }
    task.addOnFailureListener { e ->
      appUpdateManager.unregisterListener(listener)
      flexibleUpdateListener = null
      promise.reject(e)
    }

    return promise
  }

  override fun completeFlexibleUpdate(): Promise<Unit> {
    val promise = Promise<Unit>()
    try {
      appUpdateManager.completeUpdate()
      promise.resolve(Unit)
    } catch (e: Exception) {
      promise.reject(e)
    }
    return promise
  }

  override fun onActivityResult(
          activity: Activity,
          requestCode: Int,
          resultCode: Int,
          data: Intent?
  ) {
    if (requestCode == REQUEST_CODE_UPDATE) {
      val promise = pendingUpdatePromise
      pendingUpdatePromise = null

      if (promise == null) return

      if (resultCode == android.app.Activity.RESULT_OK) {
        promise.resolve(Unit)
      } else if (resultCode == android.app.Activity.RESULT_CANCELED) {
        promise.reject(Error("USER_CANCELLED: Update cancelled by user"))
      } else {
        promise.reject(Error("STORE_ERROR: Update failed with result code: $resultCode"))
      }
    }
  }

  /**
   * Note: On Android, this promise resolves when the review flow *launches* (or is suppressed by
   * quota), not when the user interacts with it. We cannot know if the user actually reviewed the
   * app.
   */
  override fun requestInAppReview(): Promise<Unit> {
    val promise = Promise<Unit>()
    val activity = context?.currentActivity
    if (activity == null) {
      promise.reject(Error("NO_ACTIVITY: No current activity found"))
      return promise
    }

    val manager = ReviewManagerFactory.create(requireContext())
    val request = manager.requestReviewFlow()
    request.addOnCompleteListener { task ->
      if (task.isSuccessful) {
        val reviewInfo = task.result
        val flow = manager.launchReviewFlow(activity, reviewInfo)
        flow.addOnCompleteListener {
          // Task completes when the flow finishes (dialog dismissed or not shown due to quota)
          setLastReviewPromptDate(System.currentTimeMillis().toDouble())
          promise.resolve(Unit)
        }
      } else {
        promise.reject(task.exception ?: Error("UNKNOWN: Review request failed"))
      }
    }
    return promise
  }

  override fun getLastReviewPromptDate(): Double {
    return prefs.getLong(KEY_LAST_REVIEW_DATE, 0L).toDouble()
  }

  override fun setLastReviewPromptDate(timestamp: Double) {
    prefs.edit().putLong(KEY_LAST_REVIEW_DATE, timestamp.toLong()).apply()
  }

  override fun getSmartReviewState(): SmartReviewState {
    return SmartReviewState(
            winCount = prefs.getLong(KEY_SMART_REVIEW_WIN_COUNT, 0L).toDouble(),
            lastPromptDate = prefs.getLong(KEY_SMART_REVIEW_LAST_PROMPT, 0L).toDouble(),
            hasCompletedReview = prefs.getBoolean(KEY_SMART_REVIEW_COMPLETED, false),
            promptCount = prefs.getLong(KEY_SMART_REVIEW_PROMPT_COUNT, 0L).toDouble()
    )
  }

  override fun setSmartReviewState(state: SmartReviewState) {
    prefs.edit()
            .putLong(KEY_SMART_REVIEW_WIN_COUNT, state.winCount.toLong())
            .putLong(KEY_SMART_REVIEW_LAST_PROMPT, state.lastPromptDate.toLong())
            .putBoolean(KEY_SMART_REVIEW_COMPLETED, state.hasCompletedReview)
            .putLong(KEY_SMART_REVIEW_PROMPT_COUNT, state.promptCount.toLong())
            .apply()
  }

  override fun onNewIntent(intent: Intent) {
    // If a deep link arrives during an active update flow, log a warning but don't cancel
    // the pending promise, as background updates might still be finishing.
    Log.w("HybridAppUpdater", "Update interrupted by navigation: onNewIntent called.")
  }
}
