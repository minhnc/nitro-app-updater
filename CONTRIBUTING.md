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
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

## Running Tests

We use Jest for testing. Please ensure all tests pass before submitting a PR.

```bash
npm test
```

To run a specific test file:

```bash
npm test useAppUpdater
```

## Code Style

- We use **TypeScript** and **ESLint**. Use `npm run lint` to check for issues.
- Follow the existing code style (2 spaces indentation, single quotes).
- Ensure new features are covered by tests.

## Submitting a Pull Request

1. Fork the repository.
2. Create a new branch for your feature or fix.
3. Commit your changes with clear messages.
4. Push to your fork and submit a Pull Request.
5. Provide a clear description of the changes and any relevant issue numbers.

## Reporting Issues

If you find a bug, please open an issue in the GitHub repository with:

- Library version
- React Native version
- Platform (iOS/Android)
- Steps to reproduce

Thank you for helping make this library better!
