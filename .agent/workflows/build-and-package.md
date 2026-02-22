---
description: How to compile and package the library for use
---

# Build and Package Workflow

Follow these steps to generate native bindings, compile TypeScript, and create a package for testing.

### 1. Unified Build & Pack

Use the automated script to clean, generate native bindings, compile TypeScript, and package the library into a `.tgz` file in one step:

```bash
bun run pack:local
```

### 2. Testing in the Example App

To quickly sync your changes to the built-in example app:

```bash
bun run example:install
```

### 3. Testing in an External App

If you want to test the library in a different local project:

1. **Pack the library** (Step 1 above).
2. **Install the `.tgz`** in your target app:
   ```bash
   bun add /path/to/minhnc-nitro-app-updater-<version>.tgz
   ```

### 4. Rebuild Native Code

Since this is a Native Module, you must rebuild the native part of your app after installation:

```bash
# For Expo (Managed or Bare)
bun run example:ios    # or example:android
# or manually:
npx expo run:ios
npx expo run:android

# For standard React Native
npx react-native run-ios
npx react-native run-android
```
