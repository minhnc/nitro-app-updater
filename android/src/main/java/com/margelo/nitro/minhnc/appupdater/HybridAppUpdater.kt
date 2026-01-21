package com.margelo.nitro.minhnc.appupdater

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.ktx.isFlexibleUpdateAllowed
import com.google.android.play.core.ktx.isImmediateUpdateAllowed
import com.google.android.play.core.review.ReviewManagerFactory
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise

class HybridAppUpdater : HybridAppUpdaterSpec(), ActivityEventListener {
  private var pendingUpdatePromise: Promise<Unit>? = null

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
                      pendingUpdatePromise?.reject(Error("UNKNOWN: Activity destroyed"))
                      pendingUpdatePromise = null
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

  override fun openStore(storeId: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$storeId"))
    val activity = context?.currentActivity
    if (activity != null) {
      activity.startActivity(intent)
    } else {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      requireContext().startActivity(intent)
    }
  }

  override fun openStoreReviewPage(storeId: String) {
    // For Android, just opening the store page is standard for manual reviews.
    // There isn't a direct "write-review" action intent that is universally supported
    // like iOS, so we redirect to the app details page where users can rate.
    openStore(storeId)
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
    task.addOnFailureListener { e -> promise.reject(e) }
    return promise
  }

  override fun startInAppUpdate(immediate: Boolean): Promise<Unit> {
    val promise = Promise<Unit>()
    val activity = context?.currentActivity
    if (activity == null) {
      promise.reject(Error("NO_ACTIVITY: No current activity found"))
      return promise
    }

    // Cancel previous promise if exists
    if (pendingUpdatePromise != null) {
      pendingUpdatePromise?.reject(Error("UNKNOWN: New update flow started"))
      pendingUpdatePromise = null
    }

    val task = appUpdateManager.appUpdateInfo
    task.addOnSuccessListener { info ->
      val allowed = if (immediate) info.isImmediateUpdateAllowed else info.isFlexibleUpdateAllowed

      if (allowed) {
        try {
          pendingUpdatePromise = promise
          appUpdateManager.startUpdateFlowForResult(
                  info,
                  if (immediate) com.google.android.play.core.install.model.AppUpdateType.IMMEDIATE
                  else com.google.android.play.core.install.model.AppUpdateType.FLEXIBLE,
                  activity,
                  1337
          )
          // Do not resolve yet - wait for onActivityResult
        } catch (e: Exception) {
          promise.reject(e)
          pendingUpdatePromise = null
        }
      } else {
        promise.reject(Error("NOT_SUPPORTED: Update type allowed: false"))
      }
    }
    task.addOnFailureListener { e -> promise.reject(e) }
    return promise
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
                  appUpdateManager.unregisterListener(this)
                  promise.resolve(Unit)
                } else if (state.installStatus() ==
                                com.google.android.play.core.install.model.InstallStatus.FAILED
                ) {
                  appUpdateManager.unregisterListener(this)
                  promise.reject(Error("STORE_ERROR: Flexible update failed"))
                }
              }
            }

    appUpdateManager.registerListener(listener)

    val task = appUpdateManager.appUpdateInfo
    task.addOnSuccessListener { info ->
      if (info.isFlexibleUpdateAllowed) {
        try {
          appUpdateManager.startUpdateFlowForResult(
                  info,
                  com.google.android.play.core.install.model.AppUpdateType.FLEXIBLE,
                  activity,
                  1337
          )
        } catch (e: Exception) {
          appUpdateManager.unregisterListener(listener)
          promise.reject(e)
        }
      } else {
        appUpdateManager.unregisterListener(listener)
        promise.reject(Error("NOT_SUPPORTED: Flexible update not allowed"))
      }
    }
    task.addOnFailureListener { e ->
      appUpdateManager.unregisterListener(listener)
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
    if (requestCode == 1337) {
      if (resultCode == Activity.RESULT_OK) {
        pendingUpdatePromise?.resolve(Unit)
      } else if (resultCode == Activity.RESULT_CANCELED) {
        pendingUpdatePromise?.reject(Error("USER_CANCELLED: Update cancelled by user"))
      } else {
        pendingUpdatePromise?.reject(
                Error("STORE_ERROR: Update failed with result code: $resultCode")
        )
      }
      pendingUpdatePromise = null
    }
  }

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
    val prefs =
            requireContext()
                    .getSharedPreferences("nitro_app_updater", android.content.Context.MODE_PRIVATE)
    return prefs.getLong("nitro_app_updater_last_review_date", 0L).toDouble()
  }

  override fun setLastReviewPromptDate(timestamp: Double) {
    val prefs =
            requireContext()
                    .getSharedPreferences("nitro_app_updater", android.content.Context.MODE_PRIVATE)
    prefs.edit().putLong("nitro_app_updater_last_review_date", timestamp.toLong()).apply()
  }

  override fun getSmartReviewState(): SmartReviewState {
    val prefs =
            requireContext()
                    .getSharedPreferences("nitro_app_updater", android.content.Context.MODE_PRIVATE)
    return SmartReviewState(
            winCount = prefs.getLong("smart_review_win_count", 0L).toDouble(),
            lastPromptDate = prefs.getLong("smart_review_last_prompt", 0L).toDouble(),
            hasCompletedReview = prefs.getBoolean("smart_review_completed", false),
            promptCount = prefs.getLong("smart_review_prompt_count", 0L).toDouble()
    )
  }

  override fun setSmartReviewState(state: SmartReviewState) {
    val prefs =
            requireContext()
                    .getSharedPreferences("nitro_app_updater", android.content.Context.MODE_PRIVATE)
    prefs.edit()
            .putLong("smart_review_win_count", state.winCount.toLong())
            .putLong("smart_review_last_prompt", state.lastPromptDate.toLong())
            .putBoolean("smart_review_completed", state.hasCompletedReview)
            .putLong("smart_review_prompt_count", state.promptCount.toLong())
            .apply()
  }

  override fun onNewIntent(intent: Intent) {
    // No-op
  }
}
