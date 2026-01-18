---
name: Nitrogen Module Development
description: Best practices and troubleshooting steps for developing React Native modules with Nitrogen (Nitro Modules).
---

# Nitrogen Module Development Guide

## 1. Runtime Errors: "Couldn't find class" (Android)

**Context**: You receive a runtime crash on Android: `Couldn't find class com.margelo.nitro...`
**Root Cause**: Nitrogen generates C++ code that expects your implementation class to be in a specific package structure: `com.margelo.nitro.<your_android_namespace>`.
**Fix**:

1. Check `nitro.json` for the `androidNamespace` property (e.g., `["minhnc", "appupdater"]`).
2. Ensure your Kotlin implementation file (e.g., `HybridAppUpdater.kt`) is physically located in `android/src/main/java/com/margelo/nitro/minhnc/appupdater/`.
3. Ensure the `package` declaration at the top of the Kotlin file is `package com.margelo.nitro.minhnc.appupdater`.

## 2. Compilation Errors: Protocol Mismatches

**Context**: Swift compliance error `Type does not conform to protocol` or Kotlin `Class is not abstract`.
**Root Cause**: You modified the shared TypeScript spec (`*.nitro.ts`) and re-ran `nitrogen`, but haven't updated the native implementation methods.
**Fix**:

1. Run `npm run generate`.
2. Open the generated spec file:
   - **iOS**: `nitrogen/generated/ios/swift/Hybrid...Spec.swift`
   - **Android**: `nitrogen/generated/android/kotlin/com/margelo/nitro/.../Hybrid...Spec.kt`
3. Copy the exact method signatures from the generated spec to your implementation class.
4. **Android Critical**: Ensure `ActivityEventListener` overrides (like `onActivityResult`) use **non-nullable** types (`Activity`, `Intent`) if the interface requires it.

## 3. Expo Plugin Compatibility

**Context**: Build error `... is not a function` or plugin resolution failure involved `import`/`require`.
**Root Cause**: Config Plugins run in Node.js (CommonJS), but your project might be transpiling them to ESM.
**Fix**:

1. In `tsconfig.json`, ensure `"module": "commonjs"`.
2. In `package.json`, avoid `"type": "module"` if possible, or isolate the plugin build config.
3. In `app.plugin.js`, use `module.exports = require('./lib/plugin').default`.

## 4. Emulator Testing Limitations

**Context**: `Install Error(-6)` regarding "download/install is not allowed".
**Root Cause**: Google Play Core APIs do not work on standard emulators or debug builds without specific account entitlements.
**Fix**: Use a **Debug Mode** to mock the update flow for UI testing.

## 5. Android C++ Linking Errors (`undefined symbol`)

**Context**: Linker error `undefined symbol: margelo::nitro::JHybridObject` or similar core Nitro symbols, despite `find_package` passing.
**Root Cause**:

- Gradle Prefab integration often fails to expose C++ headers/libraries correctly for Nitro Modules without explicit configuration.
- The Nitrogen-generated autolinking script may sometimes fail to add the `NitroModules` prefab to the linker command.
  **Fix**:

1. **Enable Prefab**: In `android/build.gradle`, add:
   ```gradle
   buildFeatures {
     prefab true
     prefabPublishing true
   }
   ```
2. **Explicit Dependency**: Add `implementation "com.facebook.fbjni:fbjni:0.6.0"` to dependencies.
3. **Explicit Linking (Workaround)**: If autolinking fails, manually add this to `android/CMakeLists.txt` after including the autolinking script:
   ```cmake
   find_package(NitroModules REQUIRED)
   target_link_libraries(AppUpdater PRIVATE NitroModules::NitroModules)
   ```

## 6. iOS C++ Interop & Swift Compiler Errors

**Context**:

- Build error `'functional' file not found` or `unknown type name 'namespace'`.
- Swift error `method does not override any method from its superclass`.
  **Root Cause**:
- Configuration is not fully matching C++20 standards or Swift Interop modes.
- Implementation incorrectly treats the generated Protocol as a Class.
  **Fix**:

1. **Podspec Hardening**: Ensure your Podspec forces C++20 and strict interop:
   ```ruby
   s.pod_target_xcconfig = {
     "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
     "SWIFT_OBJC_INTEROP_MODE" => "objcxx",
     "DEFINES_MODULE" => "YES"
   }
   ```
2. **Public Headers**: Must categorize generated bridging headers as public in `podspec` (`public_header_files`).
3. **Swift Signature**:
   - Do **NOT** use `override` when implementing the Nitro protocol.
   - **ALWAYS** add `throws` to the method signature (e.g., `func myMethod() throws -> String`).
   - Inherit correctly: `class HybridMyClass: HybridMyClassSpec_base, HybridMyClassSpec`.

## 7. Nitrogen Source Contamination

**Context**: Build error `HybridMMKVSpec.hpp file not found` or other strange specs appearing in your project.
**Root Cause**: The `nitrogen` command recursively scans all folders, including cloned repos or `node_modules` if not scoped effectively.
**Fix**:

1. Scope the command in `package.json`: `"generate": "nitrogen ./src"`.
2. Delete the `nitrogen/generated` directory to remove phantom files before regenerating.

## 8. Runtime `this` Context Loss

**Context**: Error `Cannot call hybrid function ... 'this' does not have a NativeState`.
**Root Cause**: Wrapping a Singleton HybridObject in a `Proxy` without binding methods separates the function from its native state instance.
**Fix**:

1. In your Proxy `get` trap, explicitly bind the method to the instance:
   ```typescript
   if (typeof value === "function") {
     return value.bind(hybridObject);
   }
   ```
## 9. Android Dependency Resolution (`nitro-modules` not found)

**Context**: Build error `Could not find com.margelo.nitro:nitro-modules:0.33.1`.
**Root Cause**: The `nitro-modules` package is often a local dependency in `node_modules` and not published to Maven Central.
**Fix**: Add local repository paths to `android/build.gradle`:

```gradle
repositories {
  // ...
  maven {
    // For local development
    url = uri("${projectDir}/../node_modules/react-native-nitro-modules/android")
  }
  maven {
    // For app consumption
    url = uri("${projectDir}/../../../react-native-nitro-modules/android")
  }
}
```

## 10. Android Native Initialization (Autolinking)

**Context**: Runtime error `HybridObjectRegistry: AppUpdater has not yet been registered`.
**Root Cause**: Unlike standard Config Modules, Nitrogen C++ libraries must be explicitly initialized.
**Fix**:

1. Create a `Package` class (e.g., `AppUpdaterPackage.kt`) that calls `AppUpdaterOnLoad.initializeNative()` in its `init` block.
2. Create `react-native.config.js` to point Android autolinking to this package:
   ```js
   module.exports = {
     dependency: {
       platforms: {
         android: {
           packageImportPath:
             "import com.margelo.nitro.appupdater.AppUpdaterPackage;",
           packageInstance: "new AppUpdaterPackage()",
         },
       },
     },
   };
   ```

## 11. Swift Header Generation ("File not found")

**Context**: First build fails with `AppUpdater-Swift.h file not found` in the umbrella header.
**Root Cause**: The generated C++ code tries to include the Swift header before it's generated by Xcode (circular dependency on first build).
**Fix**:

1. In `podspec`, add header search paths:
   ```ruby
   "HEADER_SEARCH_PATHS" => "$(inherited) \"${PODS_CONFIGURATION_BUILD_DIR}/AppUpdater/AppUpdater.framework/Headers\""
   ```
2. In the `Umbrella.hpp`, wrap the include in a check and downgrade error to warning:
   ```cpp
   #if __has_include("AppUpdater-Swift.h")
     #include "AppUpdater-Swift.h"
   #else
     #warning "Swift header not found on first build. This is expected."
   #endif
   ```

## 12. Robust Expo Config Plugin Setup

**Context**: `PluginError: Unable to resolve a valid config plugin`.
**Root Cause**: Expo expects `app.plugin.js` at root, and Node resolution can fail if using `module: esnext`.
**Fix**:

1. Create a root `app.plugin.js` proxy:
   ```js
   module.exports = require("./lib/expo-plugin").default;
   ```
2. Set `tsconfig.json` to `"module": "commonjs"` and `"moduleResolution": "node"`.
3. Add `app.plugin.js` to `files` in `package.json`.
4. Run `npm pack` locally to test structure before publishing.
