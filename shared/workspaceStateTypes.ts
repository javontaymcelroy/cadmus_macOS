// Schema version for forward-compatible migrations
export const WORKSPACE_STATE_VERSION = 1

/**
 * Layer 1: Workspace State — per-project layout and navigation
 */
export interface WorkspaceLayoutState {
  activeDocumentId: string | null
  leftSidebarOpen: boolean
  rightSidebarOpen: boolean
  bottomPanelOpen: boolean
  leftSidebarWidth: number
  rightSidebarWidth: number
  bottomPanelHeight: number
  storyboardPanelWidth: number
  writingPartnerPanelOpen: boolean
  settingsPanelOpen: boolean
  thoughtPartnerPanelOpen: boolean
  thoughtPartnerPanelWidth: number
  thoughtPartnerTextSize: number
  readerMode: boolean
  drawingMode: boolean
  infiniteCanvas: boolean
  viewZoom: number
  expandedFolders: string[] // doc IDs that are expanded in the project explorer
}

/**
 * Layer 2: Document View State — per-document cursor/scroll/selection
 */
export interface DocumentViewState {
  cursorPosition: number | null // ProseMirror doc offset
  selectionAnchor: number | null // Selection start (null if no selection)
  selectionHead: number | null // Selection end (null if no selection)
  scrollTop: number // Pixel offset of the editor scroll container
}

/**
 * Root workspace.json shape
 */
export interface WorkspaceState {
  version: number
  layout: WorkspaceLayoutState
  documentViews: Record<string, DocumentViewState>
  lastModified: string // ISO timestamp
}

/** Default layout values — matches the Zustand store defaults in projectStore.ts */
export const DEFAULT_LAYOUT: WorkspaceLayoutState = {
  activeDocumentId: null,
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  bottomPanelOpen: false,
  leftSidebarWidth: 345,
  rightSidebarWidth: 320,
  bottomPanelHeight: 320,
  storyboardPanelWidth: 320,
  writingPartnerPanelOpen: false,
  settingsPanelOpen: false,
  thoughtPartnerPanelOpen: false,
  thoughtPartnerPanelWidth: 400,
  thoughtPartnerTextSize: 16,
  readerMode: false,
  drawingMode: false,
  infiniteCanvas: false,
  viewZoom: 100,
  expandedFolders: []
}

export const DEFAULT_DOCUMENT_VIEW: DocumentViewState = {
  cursorPosition: null,
  selectionAnchor: null,
  selectionHead: null,
  scrollTop: 0
}
