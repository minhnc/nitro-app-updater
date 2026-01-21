# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1]

### Added

- **Smart Review Triggers (Happiness Gate)**: New feature to optimize app store reviews by collecting user feedback before prompting for a review. Includes:
  - `recordWin()` function to track positive user actions
  - `HappinessGate` component for the intermediate satisfaction prompt
  - Native storage (`SharedPreferences`/`UserDefaults`) for persistent state
  - Configurable `winsBeforePrompt`, `cooldownDays`, and `maxPrompts`
  - Optional `onNegativeFeedback` callback to divert unhappy users internally
  - New event types: `win_recorded`, `happiness_gate_shown`, `happiness_positive`, `happiness_negative`, `happiness_dismissed`
- `SmartReviewState` type exported from the package
- Comprehensive documentation and flow diagram in README

### Changed

- `requestReview()` now includes automatic fallback to `openStoreReviewPage()` if the in-app review cooldown hasn't passed or if an error occurs. This simplifies the API for consumers.

## [1.0.0]

- Initial release with core in-app update and review features
