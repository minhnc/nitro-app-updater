# Changelog

All notable changes to the `@minhnc/nitro-app-updater` project will be documented in this file.

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
