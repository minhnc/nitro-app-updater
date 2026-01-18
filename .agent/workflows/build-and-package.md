---
description: How to compile and package the library for use
---

# Build and Package Workflow

Follow these steps to generate native bindings, compile TypeScript, and create a package item for testing.

### 1. Generate Native Bindings (Nitrogen)

This generates the JSI/C++ code required by Nitro Modules from your TypeScript interfaces.

```bash
bun run generate
```

### 2. Compile TypeScript

This compiles the source code in `src/` to the `lib/` directory.

```bash
bun run build
```

### 3. Package for Local Testing

This creates a `.tgz` file that can be installed in another project.

```bash
npm pack
```

### 4. Install in a React Native/Expo App

Go to your target application directory and run:

```bash
bun add /path/to/minhnc-nitro-app-updater-1.0.0.tgz
```

### 5. Rebuild Native Code

Since this is a Native Module, you must rebuild the native part of your app.

```bash
# For Expo (Managed or Bare)
npx expo run:ios
npx expo run:android

# For standard React Native
npx react-native run-ios
npx react-native run-android
```
