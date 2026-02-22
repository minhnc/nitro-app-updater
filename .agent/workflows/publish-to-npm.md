---
description: How to publish the library to npm
---

# Publish to npm Workflow

Follow these steps to safely publish a new version of the library.

### 1. Ensure a Clean State

Make sure all your changes are committed and your working directory is clean.

### 2. Update Version

Use `npm version` to bump the version number (e.g., patch, minor, or major). This will also update `package.json`.

```bash
npm version patch
```

### 3. Generate and Build (Verification)

The `prepublishOnly` script in `package.json` handles this automatically, but it's good to running it manually first to ensure no errors.

```bash
bun run generate
bun run build
```

### 4. Login to npm (If not already)

```bash
npm login
```

### 5. Publish

Use the unified release script to ensure all checks and tests pass before the package is sent to the registry.

```bash
bun run release
```

_Note: This script automatically handles `--access public` for our scoped package._

### 6. Push Tags to Git

```bash
git push origin main --tags
```
