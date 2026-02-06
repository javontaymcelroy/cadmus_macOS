<<<<<<< HEAD
# cadmus_macOS
Writing IDE
=======
# Cadmus - Writing Compiler

An IDE for writers that compiles your draft and surfaces errors like a linter: grammar, citations, continuity, facts, and formatting.

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
>>>>>>> 90d7171 (initial commit)
