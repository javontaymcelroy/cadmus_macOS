# Cadmus - Writing Compiler

An IDE for writers that compiles your draft and surfaces errors like a linter: grammar, citations, continuity, facts, and formatting.

## Install

Download the latest `Cadmus-x.y.z-universal.dmg` from [Releases](https://github.com/javontaymcelroy/cadmus_macOS/releases), open it, and drag **Cadmus** into **Applications**. It runs on Apple Silicon and Intel Macs. Releases are signed with an Apple Developer ID and notarized by Apple, so it opens like any other app.

## Features (Phase 1 - POC)

- **Template-based projects**: Basic Document, Notes/Journal, Blog Post, Screenplay, Academic Paper
- **Rich text editor**: TipTap-powered with full formatting support
- **Project explorer**: Tree view with drag-reorder and context menus
- **Assets management**: Drag-and-drop images and PDFs
- **Auto-save**: Documents save automatically with keyboard shortcut support
- **Local-first**: All data stored on your filesystem

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- macOS (for the full Electron experience)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Building

```bash
# Build for production
npm run build

# Build macOS app
npm run build:mac
```

### Releasing

Releases are built by GitHub Actions (`.github/workflows/release.yml`) when a version tag is pushed.

1. Bump `version` in `package.json` (for example with `npm version 0.1.2 --no-git-tag-version`), then commit and push to `main`.
2. Tag the same version and push the tag:

   ```bash
   git tag v0.1.2
   git push origin v0.1.2
   ```

The workflow checks that the tag matches `package.json`. It then builds a universal (Apple Silicon and Intel) `.dmg` and `.zip`, signs and notarizes them, and publishes them as a GitHub Release. It takes about 15 minutes, most of it waiting on Apple's notarization.

Signing needs these repository secrets:

| Secret | Value |
|--------|-------|
| `CSC_LINK` | Base64-encoded `.p12` with the Developer ID Application certificate and its private key |
| `CSC_KEY_PASSWORD` | Password of that `.p12` |
| `APPLE_ID` | Apple ID email of the developer account |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for that Apple ID ([appleid.apple.com](https://appleid.apple.com) → Sign-In and Security) |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

Without `CSC_LINK`, the release is built unsigned, and its notes explain how to open it anyway.

## Project Structure

```
├── electron/           # Electron main process
│   ├── main.ts        # Main entry point
│   ├── preload.ts     # Preload script for IPC
│   └── services/      # Backend services
├── src/               # React renderer
│   ├── components/    # UI components
│   ├── stores/        # Zustand state management
│   ├── hooks/         # Custom React hooks
│   ├── types/         # TypeScript interfaces
│   └── styles/        # Global styles
└── resources/         # App resources (icons, etc.)
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘S | Save document |
| ⌘N | New document |
| ⌘B | Toggle project explorer |
| ⌘\ | Toggle assets panel |
| ⇧⌘B | Run build |

## Tech Stack

- **Frontend**: React, TypeScript, TipTap, Zustand, Tailwind CSS
- **Backend**: Electron, Node.js
- **Build**: electron-vite, Vite

## Roadmap

- [ ] **Phase 2**: Pass engine + local passes (formatting, spelling/grammar, citation)
- [ ] **Phase 3**: AI passes (continuity + fact-checking) with OpenAI
- [ ] **Phase 4**: Problems panel with jump-to-range + quick fixes
- [ ] **Phase 5**: Export pipeline (HTML + PDF), build profiles

## License

MIT
