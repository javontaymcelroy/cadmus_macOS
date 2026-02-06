# Writing Compiler POC
A project-based writing environment that treats a writing artifact (book, screenplay, academic paper, blog series) like a software project: structured workspace + assets + validation “passes” + a build output. The POC proves the end-to-end loop: create project from template → write/import → attach assets → run passes → review diagnostics → apply fixes → export.

## Goals
Primary: demonstrate a usable editor + project container + compile panel that runs at least 3 passes locally and 2 via OpenAI, returning structured diagnostics linked to document ranges.
Secondary: prove extensibility (new templates, new passes) via a plugin-like interface.
Non-goals for POC: realtime collaboration, mobile, offline AI models, full screenplay production tooling, full citation manager integrations (Zotero), comprehensive EPUB layout polish.

## Target users
“All writers” by design, but the POC should validate breadth via 5 templates: Basic Document, Notes/Journal, Blog Post, Screenplay, Academic Paper. Each template maps to defaults: folder structure, enabled passes, formatting presets, export presets.

## Product idea in one sentence
“An IDE for writing that compiles your draft and surfaces errors like a linter: grammar, citations, continuity, facts, and formatting.”

## Core concepts
Project: a container with documents, assets, settings, pass configuration, and outputs.
Document: a rich-text file inside a project; documents can be grouped (chapters/scenes/sections) and assembled into a build output.
Asset: anything referenced by a project or document (images, PDFs, links, reference notes, uploaded sources).
Pass: a validator/transformer that produces diagnostics and optional fixes.
Diagnostic: {id, passId, severity, title, message, documentId, range, suggestions?, source?}.
Build: runs selected passes, aggregates diagnostics, optionally applies formatting transforms, then produces exports.

## UX flows
New project: pick template → name project → choose storage mode (local-only for POC) → project opens with default structure.
Write: open a document in editor → format text → insert links → attach assets by drag/drop.
Compile: press “Run Build” → passes execute → diagnostics appear in a Problems panel → click an item to jump/highlight range.
Fix: apply suggested fix (one-click when available) or edit manually → rerun build.
Export: build output to PDF + DOCX (POC can start with HTML + PDF, add DOCX as stretch).

## POC feature set
### Workspaces/templates
Basic Document: single doc, simple formatting rules, core language passes.
Notes/Journal: daily entries, tags, quick capture, minimal formatting enforcement.
Blog Post: front-matter metadata, headings and link checks, readability suggestions (optional).
Screenplay: screenplay-friendly formatting presets and lint rules (scene heading patterns, character blocks) without full Final Draft fidelity.
Academic Paper: section scaffolding + citation style selection (APA/MLA) + references section validation.

### Editor
Rich text: bold, italics, underline, headings, lists, blockquote, code, highlight, font family, font size, color, alignment, indentation, line spacing.
Inline annotations: underlines/highlights for diagnostics; hovering shows message; clicking focuses.
Project explorer: tree of documents and folders; drag to reorder; create/rename/delete.
Assets panel: list of uploads and links; show where referenced.

### Passes (POC)
Local passes (no AI):
1) Spelling/grammar baseline pass using LanguageTool (self-hosted or public endpoint) or a local library wrapper.
2) Formatting lint pass (Prettier-like for writing): normalize whitespace, enforce heading style, enforce quotation marks choice, enforce double-space rules, consistent capitalization rules (configurable per template).
3) Citation format pass (rule-based MVP): detect in-text citations and reference entries for APA/MLA, verify required fields patterns, flag mismatch between in-text and bibliography keys.

AI-assisted passes (OpenAI):
4) Continuity pass: detect inconsistent entities (names, attributes, timeline hints) across documents; return warnings with excerpts + references to conflicting spans.
5) Fact-check pass: identify factual claims above a confidence threshold; verify via web search tool (later) or “source-needed” flags in POC; return suggestions: add citation, rephrase, or mark as uncertain. For the POC, implement as “claim extraction + ‘needs citation’ detection” without live browsing if required, but architecture must allow swapping in a real verifier later.

AI suggestions layer:
Given diagnostics from all passes, produce contextual suggestions grouped by document section. Must never auto-apply without explicit user action.

## Architecture
### High level
Client (React) hosts the editor and local project store. A local Node.js service (or Electron main process) runs the pass engine, file IO, and OpenAI calls. For the POC, keep everything local-first with a project directory on disk.

### Components
Frontend (React + TypeScript)
- Editor surface (rich text)
- Project explorer
- Problems panel (diagnostics list, filters by pass/severity)
- Build controls (run, stop, settings)
- Assets panel (uploads and references)
- Template picker modal

Backend (Node.js + TypeScript)
- ProjectStore: create/open/save project; manage docs and assets
- PassEngine: load docs → run passes → merge diagnostics → return results
- PassRegistry: register passes by id and capability (local/AI)
- OpenAIClient: prompt + rate limit + response parsing
- ExportService: assemble documents into export artifact(s)

Data model (JSON)
Project manifest (project.json):
- id, name, templateId, createdAt, updatedAt
- documents: [{id, path, title, order}]
- assets: [{id, path, type, size, createdAt, references: [{documentId, range}]}]
- settings: {citationStyle, formattingRules, enabledPasses}
- buildProfiles: [{id, name, includedDocumentIds, exportFormats}]

Document storage
- Store editor content as HTML or a structured JSON (preferred) plus a rendered HTML cache for export.
- Recommended: TipTap/ProseMirror JSON for stable ranges and annotations.

Diagnostics storage
- Keep last build results in memory and persist to .build/last.json for recovery.

### Pass interface
Each pass implements:
- id, name, kind (“local” | “ai”), defaultEnabledByTemplate
- run(ctx): returns {diagnostics: Diagnostic[], fixes?: Fix[]}
Context includes: project settings, documents with content + plain text, entity index, asset index, previous build cache, and an event logger.

Fix interface
- id, diagnosticId, label, apply(document): Patch
Patch describes a range replace or structured editor transaction.

## Suggested tech stack and packages
Frontend
- React + TypeScript + Vite
- TipTap (ProseMirror) for rich text editing
- @tiptap/extension-* for formatting features
- react-router for routing (optional for POC)
- Zustand for state (or Redux Toolkit)
- react-dropzone for drag/drop assets
- TanStack Query for build/run calls (optional)

Backend
- Node.js + TypeScript + Express (if running as local server) or Electron main process IPC
- multer for uploads (if server-based)
- lowdb or sqlite for optional indexing (POC can stay JSON)
- language-tool integration (LanguageTool HTTP API)
- docx export: html-to-docx (stretch) or docx library
- pdf export: playwright print-to-pdf or puppeteer

Storage
- Local filesystem for POC
- AWS S3 adapter planned behind an interface (not implemented in POC)

OpenAI
- Use OpenAI Responses API via official SDK
- Enforce chunking by token count; never send the entire project if not needed; prefer summaries + entity tables.

## Build pipeline behavior
Run order: Formatting lint → Spelling/grammar → Citation → Continuity → Fact check → AI suggestions.
The engine returns:
- diagnostics merged and sorted by severity then document order
- per-pass timings
- optional auto-fix patches (formatting pass can offer “apply all”)

Severity
Error: prevents clean build (critical citation format mismatch, broken export preconditions)
Warning: likely issues (continuity conflicts, missing citations)
Info: suggestions (style, readability)

## Templates and default rules
Basic Document: formatting lint minimal; spelling/grammar on; continuity optional off; fact/citation off.
Notes/Journal: minimal lint; spelling optional; continuity off; fact off.
Blog: lint on (headings, link checks), spelling on, fact “needs citation” on, citations optional.
Screenplay: screenplay lint on, spelling on, continuity on (names), fact off, citations off.
Academic: citation on (APA/MLA), spelling on, fact on, formatting lint stricter.

## UI requirements
Template picker must feel like an Unreal-style project browser: cards with icon, description, what it creates, and “recommended passes.”
Project explorer must make “where everything is” obvious: documents, assets, build outputs, settings.
Problems panel must act like an IDE: search, filter by pass/severity, click-to-jump, show quick fixes.
Diagnostics must highlight in editor with stable anchoring; if text changes, ranges should update using editor transactions.

## Acceptance criteria for POC
1) User can create a project from any template and write in at least 2 documents.
2) User can drag/drop an image and a PDF into assets and see them in the Assets panel.
3) Run Build returns diagnostics from at least 5 passes (3 local, 2 AI) and populates Problems panel.
4) Clicking a diagnostic navigates to the exact text range and highlights it.
5) At least one pass provides a one-click fix that patches the document.
6) Export produces a PDF and a single assembled HTML output for the selected build profile.
7) All project data persists locally and reloads correctly after app restart.

## Competitive framing (for internal use)
Scrivener: strong project organization, weak built-in advanced checking.
Obsidian: strong linking/knowledge graph, power-user and file-centric; no compile pipeline.
Grammarly: strong language checks, not a project IDE.
Final Draft: screenplay formatting, less on narrative continuity + cross-doc checks.
This product’s wedge is the compile loop and the unified project container.

## Risks and mitigations
Editor complexity: choose a mature editor (TipTap) and avoid deep custom rendering early.
AI cost/latency: chunking, caching, and per-pass toggles; offer “run on selection” mode later.
Continuity/fact ambiguity: treat as warnings with confidence and evidence; never hard-stop builds for AI.
Privacy: local-first storage; explicit user action to run AI; show what text will be sent.

## Blocking questions
1) What is the canonical content format (ProseMirror JSON vs HTML) for stable diagnostics and exports?
2) Which citation styles must be supported in POC (start with APA/MLA only)?
3) What level of fact checking is acceptable without live web verification in POC?
4) Should the POC be a web app with a local Node server, or an Electron app for simpler filesystem access?
5) How should “build profiles” work for multi-doc outputs (chapter order, front matter, back matter)?

## API contracts (if server-based)
POST /projects create/open/save operations
POST /build {projectId, profileId, passes[]} → {diagnostics, timings, artifacts}
POST /assets/upload multipart → {assetId, path}
POST /export {projectId, profileId, format} → file stream

## Implementation plan (POC)
Phase 1: template picker, project store, editor, explorer, assets drag/drop.
Phase 2: pass engine + local passes (formatting, spelling/grammar, citation MVP).
Phase 3: AI passes (continuity + needs-citation/fact flags) with structured output parsing.
Phase 4: problems panel with jump-to-range + quick fixes.
Phase 5: export pipeline (HTML + PDF), build profiles.
