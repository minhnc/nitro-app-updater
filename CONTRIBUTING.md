# Contributing to Nitro App Updater

Thank you for your interest in contributing to `@minhnc/nitro-app-updater`! We welcome contributions from the community properly.

## Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/minhnc/nitro-app-updater.git
   cd nitro-app-updater
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Verify the build**
   ```bash
   bun run check
   ```

## Normal Development Workflow

To add features or fix bugs, follow this standard cycle:

1. **Modify the source code** in `src/`.
2. **Install the changes into the example app**:
   ```bash
   bun run example:install
   ```
   _This command rebuilds the library, generates native bindings, packs it as a `.tgz`, and updates the example app's dependency._
3. **Test natively**:
   ```bash
   bun run example:ios    # or example:android
   ```
4. **Run unit tests**:
   Make sure your changes don't break existing logic:
   ```bash
   bun test
   bun run test:watch # for continuous testing
   ```

## Code Style

- We use **TypeScript** and **ESLint**. Run `bun run check` to verify both.
- Use `bun run clean` if you need to reset the generated native files.

## Submitting a Pull Request

1. Fork the repository.
2. Create a new branch for your feature or fix.
3. Commit your changes with clear messages.
4. Push to your fork and submit a Pull Request.

## Reporting Issues

If you find a bug, please open an issue in the GitHub repository with:

- Library version
- React Native version
- Platform (iOS/Android)
- Steps to reproduce

Thank you for helping make this library better!
