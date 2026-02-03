# Build & Development Knowledge

> **Auto-update trigger**: Update this file when modifying `package.json`, `tsconfig.json`, `.github/workflows/build.yml`, or `webview-ui/vite.config.ts`.

## Overview

Grove uses Bun as the package manager and TypeScript for development.

## Project Configuration

| File | Purpose |
|------|---------|
| `package.json` | Extension manifest, scripts, dependencies |
| `tsconfig.json` | TypeScript compiler options |
| `.github/workflows/build.yml` | CI/CD pipeline |
| `webview-ui/vite.config.ts` | Webview build config |
| `webview-ui/package.json` | Webview dependencies |

## NPM Scripts

```bash
# Development
npm run watch        # Watch TypeScript compilation
npm run watch:webview # Watch webview (Vite dev mode)

# Build
npm run compile      # Compile TypeScript → out/
npm run build:webview # Build webview → webview-ui/build/

# Testing
npm run lint         # ESLint check
npm run test:unit    # Run unit tests with Bun

# Packaging
npm run package      # Create .vsix file
npm run publish      # Publish to marketplace
```

## Build Artifacts

```
grove/
├── out/                    # Compiled TypeScript
│   ├── core/               # Core module JS
│   ├── extension/          # Extension module JS
│   └── test/               # Test JS
├── webview-ui/
│   └── build/              # Bundled Svelte app
│       ├── index.js
│       └── index.css
└── grove-x.x.x.vsix        # Packaged extension
```

## Development Workflow

### 1. Initial Setup

```bash
bun install
cd webview-ui && bun install
```

### 2. Development Mode

Terminal 1: Watch TypeScript
```bash
npm run watch
```

Terminal 2: Watch Webview
```bash
npm run watch:webview
```

Press F5 in VS Code to launch Extension Development Host.

### 3. Running Tests

```bash
bun test src/test    # Unit tests
```

### 4. Packaging

```bash
npm run compile
npm run build:webview
npm run package
```

## CI/CD Pipeline

**Triggers:**
- Push to `main`
- Pull requests to `main`
- Manual dispatch

**Jobs:**

### Build Job
1. Checkout code
2. Setup Bun
3. Install dependencies
4. Run linter (`bun run lint`)
5. Run tests (`bun test src/test`)
6. Compile TypeScript
7. Build webview
8. Package extension
9. Upload VSIX artifact (30 day retention)

### Auto-Release Job
- Runs on push to `main` only
- Checks if release for current version exists
- If not, creates GitHub release with VSIX

## Extension Manifest (package.json)

### Key Fields

```json
{
  "main": "./out/extension/extension.js",
  "engines": { "vscode": "^1.85.0" },
  "activationEvents": ["onStartupFinished"],
  "contributes": {
    "commands": [...],
    "views": { "explorer": [...] },
    "menus": {...},
    "configuration": {...}
  }
}
```

### Adding a New Command

```json
{
  "contributes": {
    "commands": [
      {
        "command": "grove.myCommand",
        "title": "Grove: My Command",
        "category": "Grove"
      }
    ]
  }
}
```

### Adding a Context Menu Item

```json
{
  "contributes": {
    "menus": {
      "view/item/context": [
        {
          "command": "grove.myCommand",
          "when": "view == groveExplorer && viewItem == activeTask",
          "group": "2_actions"
        }
      ]
    }
  }
}
```

### Adding a Configuration Option

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "grove.myOption": {
          "type": "boolean",
          "default": true,
          "description": "Description of the option"
        }
      }
    }
  }
}
```

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": ["ES2020"],
    "strict": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "webview-ui"]
}
```

## Version Bump & Release

1. Update version in `package.json`
2. Commit and push to `main`
3. CI creates GitHub release automatically
4. Download VSIX from release

## Debugging

### Extension
- Press F5 to launch Extension Development Host
- Breakpoints work in `src/` TypeScript files
- Use `console.log()` → appears in Debug Console

### Webview
- Use browser DevTools in webview panel
- Right-click webview → "Open DevTools"

## Common Issues

### TypeScript errors after git pull
```bash
rm -rf out && npm run compile
```

### Webview not updating
```bash
cd webview-ui && rm -rf build && npm run build
```

### VSIX too large
- Check `.vscodeignore` for exclusions
- Ensure `node_modules` not included

---
*Last updated: 2026-02-03*
