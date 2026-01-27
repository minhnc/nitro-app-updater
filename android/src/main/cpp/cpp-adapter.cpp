#include "AppUpdaterOnLoad.hpp"
#include <jni.h>
#include <android/log.h>

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *) {
  __android_log_print(ANDROID_LOG_INFO, "AppUpdater", "JNI_OnLoad called! Initializing Nitro modules...");
  return margelo::nitro::minhnc::appupdater::initialize(vm);
}
