package com.minhnc.appupdater

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.margelo.nitro.minhnc.appupdater.AppUpdaterOnLoad

/**
 * React Native Package that initializes AppUpdater native library.
 * This is required for autolinking to work.
 */
class AppUpdaterPackage : TurboReactPackage() {
    companion object {
        init {
            // Initialize the native library when this class is loaded
            AppUpdaterOnLoad.initializeNative()
        }
    }

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        // No TurboModules here - we use Nitro HybridObjects instead
        return null
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider { 
            emptyMap()
        }
    }
}
