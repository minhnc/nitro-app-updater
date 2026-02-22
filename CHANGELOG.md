# Changelog

All notable changes to the `@minhnc/nitro-app-updater` project will be documented in this file.

## [1.2.1]

### 🚀 Added

- **Built-in Provider & Context**: Added `AppUpdaterProvider` and `useAppUpdaterContext` to drastically reduce boilerplate in consumer apps. You can now wrap your app once and access the updater state from anywhere without prop-drilling or initializing multiple hook instances.
- **Automatic Error Recovery UI**: `UpdatePrompt` now handles failures (like network timeouts) gracefully. It displays a fully themable error wrapper equipped with a functional "Try Again" button to retrigger checks/downloads.
- **Error Theming**: Added an optional `error` color property to `UpdatePromptTheme` (defaulting to `#FF3B30`). The failure UI automatically calculates dynamic background and border opacities based on this base hex color.
- **Smart Review Reset**: Exported `resetSmartReview` from the `useAppUpdater` hook to allow developers to instantly clear persistent win counts and prompt cooldowns during development.
- **Exposed Error State**: The `useAppUpdater` hook now surfaces the `error` state directly, holding the `AppUpdaterError` object from the most recent failed `update_dismissed` event.
- **Configurable iOS Timeout**: New `iosLookupTimeoutMs` config option (default: 10000ms) to control the App Store lookup request timeout.
- **Public Sub-Hooks**: Exported `useUpdateManager`, `useDownloadManager`, and `useSmartReviewManager` for advanced consumers who need granular control.
- **Public Utilities**: Exported `compareVersions`, `checkIOSUpdate`, and `ITunesLookupResult` for consumers who want to perform version checks independently.
- **Dynamic OS Compatibility**: `minOsVersion` is now handled internally. On iOS, the library automatically extracts `minimumOsVersion` from the iTunes API and prevents update prompts on unsupported devices. On Android, the Google Play Store already handles this natively.

### 🏗️ Changed

- **Internalized minOsVersion**: Deprecated the manual `minOsVersion` configuration. The library now manages OS compatibility checks dynamically via store APIs, reducing boilerplate and preventing stale OS requirement data.
- **React Best Practices**: Improved hook safety by hoisting state declarations (`useState`) to the absolute top of the `useAppUpdater` hook, preventing subtle lexical scoping constraints.
- **Memory Safety**: Added strict unmount cleanup for the rapid-fire `setTimeout` used in the `UpdatePrompt`'s visual retry flash effect.
- **Logic Stability**: Refactored `useUpdateManager` to eliminate the legacy `isMounted` ref pattern in favor of stable callback identities via refs, following modern React 18+ best practices for async safety.
- **Improved Error Recovery**: `useSmartReviewManager` now resets the internal `winCount` if a store review request fails, ensuring users can be re-prompted later rather than being permanently stuck in a "happiness pending" state.
- **HappinessGate Memoized**: Wrapped `HappinessGate` with `React.memo` for render performance consistency with `UpdatePrompt`.

### 🛡️ Fixed

- **Android Sideload Safety**: Gracefully handle the `APP_NOT_OWNED` error (-10) on Android. The library now treats sideloaded apps (not from Play Store) as having no updates available instead of throwing an error.
- **Hook Promise Safety**: Wrapped internal `checkUpdate` calls in `useAppUpdater` with `.catch()` blocks to prevent uncaught promise rejections across all platforms.
- **Regression Fix**: Restored missing `clearUpdateCache()` call in the foreground refresh flow.
- **Deleted Legacy Code**: Removed the `expo-plugin.ts` entirely. It was discovered that with React Native 0.75+ and Expo SDK 51+, the modern C++ interoperability setup renders custom config plugins for Nitro Modules completely unnecessary. Applications just work out-of-the-box via autolinking.
- **Accessibility**: Added missing `accessibilityRole` and `accessibilityLabel` props to all `HappinessGate` buttons to improve screen reader support.
- **Documentation Polish**: Cleaned up all internal review markers and standardized codebase comments for professional production release.

## [1.1.1]

### 🚀 Added

- **Download Status Tracking**: Introduced `isDownloading` state to `useAppUpdater` to accurately track the transition from "Update Now" to "Downloading".
- **Disabled State**: Added `enabled` flag to `useAppUpdater` and `UpdatePrompt`. This allows skipping all initialization side-effects, which is essential when providing an `externalUpdater` to a child prompt.
- **Happiness Gate Accessibility**: Increased the touch target for the "Maybe Later" dismiss button (44px min height) to meet accessibility standards.

### 🏗️ Changed

- **Improved UpdatePrompt UI**: The `UpdatePrompt` now shows a prominent progress bar in the footer immediately after the download begins, replacing the buttons for a clearer state transition.
- **Update Check Cache**: Implemented a Map-based cache with a 5-minute TTL and a maximum size of 10 entries to prevent memory growth and redundant network requests.
- **Standardized Native Keys**: Standardized UserDefaults (iOS) and SharedPreferences (Android) keys with the `nitro_app_updater_` prefix.
- **Notice**: Review state (win counts and last prompt dates) will reset once during this upgrade due to the standardized naming.

### 🛡️ Fixed

- **Android Stale Status**: Fixed an issue where the updater UI would show a stale "Update Now" status for several seconds while a native update was starting in the background.
- **SemVer Logic**: Fixed an inversion in `versionCheck.ts` where pre-release versions were incorrectly prioritized. Release versions are now correctly considered greater than pre-release versions (e.g. `1.0.0 > 1.0.0-beta`).
- **iOS Redirection**: Corrected the fallback URL logic in `useDownloadManager.ts`. It now correctly requires and warns about the missing numeric `iosStoreId` instead of attempting an invalid bundle ID redirection.
- **Native Efficiency**: Removed redundant iOS version checks in `HybridAppUpdater.swift`.
- **Test Stability**: Major overhaul of the test suite (`useSmartReviewManager.test.ts`) to resolve async leaks and suite-level crashes caused by broad `react-native` mocks.
- **Improved Test Coverage**: Added detailed test case for `clearUpdateCache` to ensure reliable cache management.

## [1.1.0]

### 🚀 Added

- **Premium UI Overhaul**: Complete redesign of the example app and library components (`UpdatePrompt`, `HappinessGate`) with a modern, high-end mobile aesthetic (HSL colors, glassmorphism, organic shapes).
- **Dedicated Demo Videos**: High-quality video showcases for iOS and Android now included in the README.
- **Smart Review Heuristics**: Added a 300ms heuristic for native review prompts to automatically fallback to the store page if the OS suppresses the dialog (primarily for Android/Debug).
- **Comprehensive Test Suite**: Full unit test coverage for all manager hooks (`useUpdateManager`, `useDownloadManager`, `useSmartReviewManager`) and UI components (`UpdatePrompt`, `HappinessGate`).
- **Types Module**: Extracted shared types into dedicated `src/types.ts` for cleaner imports and better maintainability.
- **Contributing Guide**: Added `CONTRIBUTING.md` with development setup instructions.
- **Happiness Gate Text Customization**: New `happinessGate` prop on `UpdatePrompt` allows customizing all text labels for localization or brand voice (e.g., "Loving these deals?" instead of "Enjoying the app?").

### 🏗️ Changed

- **Modular Hook Architecture**: Refactored the monolithic `useAppUpdater` into three specialized internal managers for better state isolation and reliability.
- **Improved Performance**: Switched from standard state-heavy loops to `useRef` and composed hooks to minimize re-renders.
- **API Realignment**: Updated native bridge method calls (`checkPlayStoreUpdate`, `getCurrentVersion`, `completeFlexibleUpdate`) to match the latest Nitro Module signatures.
- **Documentation**: Updated README with accurate compatibility specs (RN 0.75+, SDK 51+) and a full architectural walkthrough.
- **Developer Experience**: Exported `UpdatePromptTheme` interface from `src/UpdatePrompt.tsx` for better type safety when theming.
- **Callback & Config Stability**: Implemented an internal "latest-ref" pattern across all hooks. Handlers like `recordWin`, `checkUpdate`, and `requestReview` now have **perfectly stable identities**, preventing re-renders or infinite loops even when users pass inline object literals or arrow functions to `useAppUpdater`.
- **High-Frequency Call Safety**: refactored state management to handle rapid-fire calls (e.g., calling `recordWin` multiple times in a single frame) safely using synchronous ref-tracking.
- **Error Handling**: Enhanced internal `checkIOSUpdate` to propagate specific network errors (e.g. 404, 500) instead of suppressing them, allowing consumers to handle `update_dismissed` events more effectively.

### 🛡️ Fixed

- **Smart Review Visibility**: Fixed a bug where the Happiness Gate wouldn't show if no update was available.
- **Memory Leaks**: Ensured all `setInterval` and event listeners in the download and update flows are properly cleaned up on unmount.
- **Android Compilation**: Corrected `packageImportPath` in `react-native.config.js` to match the native build setup.
- **Version Comparison**: Improved `compareVersions` logic in `versionCheck.ts` to robustly handle non-numeric segments (e.g., `1.0.0-beta.1` vs `1.0.0`), preventing potential crashes or incorrect update prompts.
- **Callback Stability**: Fixed identity instability of `recordWin` and happiness gate handlers in `useSmartReviewManager.ts`. Using refs now ensures these functions remain stable across renders, preventing infinite loops when used in `useEffect` dependencies.

## [1.0.1]

### Added

- **Smart Review Triggers (Happiness Gate)**: New feature to optimize app store reviews by collecting user feedback before prompting for a review.
- `recordWin()` function to track positive user actions.
- `HappinessGate` component for the intermediate satisfaction prompt.
- Native storage (`SharedPreferences`/`UserDefaults`) for persistent state.

### Changed

- `requestReview()` now includes automatic fallback to `openStoreReviewPage()`.

## [1.0.0]

- Initial release with core in-app update and review features.
