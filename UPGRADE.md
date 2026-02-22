# Upgrade Guide: @minhnc/nitro-app-updater

## v1.1.x → v1.2.0

This release focuses on robust error recovery and developer experience, introducing an automatic error state UI and tools to reset local review data.

### Breaking Changes

**None** – This is a fully backward-compatible update.

### 🎨 Type-Safe Error Theming (NEW)

The `UpdatePromptTheme` interface now supports an `error` color to seamlessly integrate the new failure states into your brand's palette.

```typescript
const customTheme: UpdatePromptTheme = {
  // ... existing theme properties
  error: "#EF4444", // New optional error color (defaults to #FF3B30)
};
```

### 🔄 Resetting Smart Review (Developer Tool)

If you've hit your Smart Review prompt limits during testing, you can now programmatically clear the internal tracker without clearing app data:

```typescript
const { resetSmartReview } = useAppUpdater();

// Attach to a hidden dev-menu button
<Button title="Reset Tracker" onPress={() => resetSmartReview()} />
```

### 🚨 Improved Error Tracking

The `useAppUpdater` hook now returns the last encountered `error` object, allowing you to build custom failure UI if you prefer not to use the bundled `UpdatePrompt`.

```typescript
const { error, startUpdate, checkUpdate } = useAppUpdater({
  iosStoreId: "YOUR_APP_STORE_ID",
});

if (error) {
  console.log("Last Error:", error.message);
}
```

### 🏛️ Global Provider (NEW)

You can now use `AppUpdaterProvider` to wrap your app and consume the updater state via `useAppUpdaterContext()` anywhere. This eliminates the need to prop-drill the hook's return values deep into your component tree.

```tsx
// 1. Wrap your app
<AppUpdaterProvider config={{ iosStoreId: "YOUR_APP_STORE_ID" }}>
  <YourApp />
</AppUpdaterProvider>;

// 2. Consume anywhere
function MyScreen() {
  const { requestReview, canRequestReview } = useAppUpdaterContext();
  // ...
}
```

### 🗑️ Deprecations

- `minOsVersion` configuration is now **deprecated**. The library automatically extracts the required minimum OS version directly from the iTunes App Store API for iOS, maintaining dynamic compliance without manual config. On Android, the Google Play Store inherently handles OS availability. You can safely remove this prop from your configuration.

---

## v1.0.0 → v1.1.0

This guide helps you upgrade from v1.0.0 to v1.1.0 and adopt all new features.

### Breaking Changes

**None** – This is a fully backward-compatible update. Your existing code will work as-is.

---

## Step 1: Adopt New Features

### 🎨 Type-Safe Theming (NEW)

Import the new `UpdatePromptTheme` interface for autocomplete and type checking:

```typescript
import { UpdatePrompt, type UpdatePromptTheme } from '@minhnc/nitro-app-updater';

const customTheme: UpdatePromptTheme = {
  primary: '#FF5733',      // Brand color
  background: '#FFFFFF',
  text: '#1E293B',
  subtext: '#64748B',
  overlay: 'rgba(0,0,0,0.6)',
};

<UpdatePrompt theme={customTheme} config={{...}} />
```

---

### 🏆 Smart Review (Happiness Gate)

Replace manual review requests with the win-based system:

```typescript
const { recordWin, showHappinessGate } = useAppUpdater({
  smartReview: {
    enabled: true,
    winsBeforePrompt: 3, // Prompt after 3 positive actions
    cooldownDays: 120, // Wait 120 days between prompts
    maxPrompts: 1, // Only prompt once ever
    onNegativeFeedback: () => {
      // User said "Not really" - redirect to feedback form
      navigation.navigate("FeedbackForm");
    },
  },
});

// Call recordWin() when user completes a positive action
const handleDealSaved = () => {
  saveDeal();
  recordWin(); // ← Increment win counter
};
```

---

### 🗣️ Happiness Gate Text Customization (NEW)

Customize the Happiness Gate text for localization or brand voice:

```typescript
<UpdatePrompt
  happinessGate={{
    title: "Loving these deals? 🔥",
    positiveText: "Absolutely!",
    negativeText: "Could be better",
    dismissText: "Ask me later",
  }}
  config={{...}}
/>
```

---

### 📱 Shared Updater State (Recommended Pattern)

Use `externalUpdater` to share state between your UI and `UpdatePrompt`:

```typescript
const updater = useAppUpdater({ /* config */ });

return (
  <>
    <YourApp
      onWin={updater.recordWin}
      canReview={updater.canRequestReview}
    />
    <UpdatePrompt externalUpdater={updater} />
  </>
);
```

---

### 🔗 Manual Store Rating Button

Add a "Rate Us" button in Settings that always works (bypasses OS quotas):

```typescript
const { openStoreReviewPage } = useAppUpdater({
  iosStoreId: 'YOUR_APP_STORE_ID',  // Required for iOS
});

<Button title="Rate Us ⭐" onPress={openStoreReviewPage} />
```

---

## Step 2: API Reference

### New Exports

| Export                  | Type      | Description                           |
| ----------------------- | --------- | ------------------------------------- |
| `UpdatePromptTheme`     | Interface | Type-safe theme configuration         |
| `recordWin()`           | Function  | Increment positive action counter     |
| `showHappinessGate`     | Boolean   | Whether the gate is currently visible |
| `openStoreReviewPage()` | Function  | Direct link to store review page      |
| `canRequestReview`      | Boolean   | Whether review request is allowed     |

### Configuration Options

| Option                           | Type     | Default | Description                          |
| -------------------------------- | -------- | ------- | ------------------------------------ |
| `smartReview.enabled`            | boolean  | false   | Enable win-based review prompting    |
| `smartReview.winsBeforePrompt`   | number   | 3       | Positive actions before showing gate |
| `smartReview.cooldownDays`       | number   | 120     | Days between gate appearances        |
| `smartReview.maxPrompts`         | number   | 1       | Maximum lifetime prompts             |
| `smartReview.onNegativeFeedback` | function | -       | Called when user taps "Not really"   |

---

## Step 3: Test Locally

```typescript
// Enable debug mode for testing
useAppUpdater({
  iosStoreId: "YOUR_APP_STORE_ID",
  debugMode: __DEV__, // Mock updates in dev
  reviewCooldownDays: 0, // Allow repeated reviews in dev
  smartReview: {
    enabled: true,
    cooldownDays: 0, // Allow gate to re-show
    winsBeforePrompt: 3,
  },
});
```

```bash
# Run the app
npx expo run:ios
```

---

## Full Example

```typescript
import {
  useAppUpdater,
  UpdatePrompt,
  type UpdatePromptTheme,
  type AppUpdaterEvent
} from '@minhnc/nitro-app-updater';

const theme: UpdatePromptTheme = {
  primary: '#10B981',
  background: '#FFFFFF',
  text: '#111827',
  subtext: '#6B7280',
  overlay: 'rgba(0,0,0,0.5)',
};

export default function App() {
  const handleEvent = (event: AppUpdaterEvent) => {
    analytics.track(event.type, event.payload);
  };

  const updater = useAppUpdater({
    debugMode: __DEV__,
    iosStoreId: '6514638249',
    iosCountryCode: 'au',
    checkOnMount: true,
    reviewCooldownDays: __DEV__ ? 0 : 120,
    smartReview: {
      enabled: true,
      winsBeforePrompt: 3,
      cooldownDays: __DEV__ ? 0 : 120,
      onNegativeFeedback: () => console.log('Show feedback form'),
    },
    onEvent: handleEvent,
  });

  return (
    <>
      <MainApp onPositiveAction={updater.recordWin} />
      <UpdatePrompt externalUpdater={updater} theme={theme} />
    </>
  );
}
```

---

## What's New Summary

### v1.2.0

- ✅ **Automatic error recovery UI** with built-in retry in `UpdatePrompt`
- ✅ **Error theming** via `UpdatePromptTheme.error`
- ✅ **`resetSmartReview`** helper for development testing
- ✅ **Exposed `error` state** from `useAppUpdater`
- ✅ **`iosLookupTimeoutMs`** configuration option
- ✅ **`refreshOnForeground`** option in `useAppUpdater` to automatically check for updates on resume
- ✅ **`APP_NOT_OWNED` error handling** for side-loaded Android builds
- ✅ **Removed Expo config plugin** — no longer needed with RN 0.75+/Expo SDK 51+

### v1.1.x

- ✅ **Type-safe theming** with `UpdatePromptTheme` interface
- ✅ **Smart Review timing** with configurable win thresholds
- ✅ **Happiness Gate** for better review quality
- ✅ **Robust version comparison** for pre-release versions
- ✅ **Better error handling** for network failures
- ✅ **Modular architecture** for improved reliability
