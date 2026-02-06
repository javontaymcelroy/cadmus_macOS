import type { TemplateId } from '../types/project'

/**
 * Document type for screenplay-specific document creation
 */
export type ScreenplayDocType = 'title-page' | 'page' | 'break'

/**
 * Hierarchy configuration for document creation
 */
export interface HierarchyConfig {
  /**
   * Display label for top-level documents in UI
   * e.g., "Screenplay", "Journal", "Document"
   */
  documentLabel: string
  
  /**
   * Display label for pages (children of documents) in UI
   * e.g., "Scene", "Entry", "Page"
   */
  pageLabel: string
  
  /**
   * Display label for notes (children of pages) in UI
   * e.g., "Note", "Annotation"
   */
  noteLabel: string
  
  /**
   * Label for creating a child under a Document (top-level)
   * e.g., "New Page" for screenplay, "New Note" for notes-journal
   */
  documentChildLabel: string
  
  /**
   * Label for creating a child under a Page
   * e.g., "New Note" for screenplay
   */
  pageChildLabel: string
  
  /**
   * Label for creating a sibling Page
   * e.g., "New Page" for screenplay, "New Note" for notes-journal
   */
  siblingPageLabel: string
  
  /**
   * Document type when creating children under a Document
   * For screenplay, this is 'page' to create scene pages
   */
  documentChildType?: ScreenplayDocType
  
  /**
   * Default title for new top-level documents
   */
  defaultDocumentTitle: string
  
  /**
   * Default title for new pages (children of documents)
   */
  defaultPageTitle: string
  
  /**
   * Whether pages can have children (notes)
   */
  pagesCanHaveChildren: boolean
}

/**
 * Feature flags for workspace-specific UI elements
 */
export interface FeatureFlags {
  /**
   * Show the Characters panel in the sidebar
   */
  showCharactersPanel: boolean
  
  /**
   * Show the Storyboard panel
   */
  showStoryboardPanel: boolean
  
  /**
   * Show runtime estimate in status bar
   */
  showStatusBarRuntime: boolean
  
  /**
   * Enable todo list functionality in documents
   */
  enableTodoLists: boolean
  
  /**
   * Enable todo lists only in notes (children of pages)
   */
  todoListsOnlyInNotes: boolean
  
  /**
   * Derive page titles from first block content
   */
  deriveTitlesFromContent: boolean
  
  /**
   * Show page numbers in document tree
   */
  showPageNumbers: boolean
  
  /**
   * Show timestamps in sidebar list items
   */
  showTimestamps: boolean
}

/**
 * Editor configuration for workspace-specific behavior
 */
export interface EditorConfig {
  /**
   * Default font family for the editor
   */
  fontFamily: string
  
  /**
   * Whether to use the screenplay element extension
   */
  useScreenplayExtension: boolean
  
  /**
   * Whether to use monospace font throughout
   */
  useMonospaceFont: boolean
  
  /**
   * Whether to show font family selector in toolbar
   */
  showFontFamilySelector: boolean
}

/**
 * Complete workspace configuration
 */
export interface WorkspaceConfig {
  /**
   * Template ID this config applies to
   */
  id: TemplateId
  
  /**
   * Document hierarchy configuration
   */
  hierarchy: HierarchyConfig
  
  /**
   * Feature flags for UI elements
   */
  features: FeatureFlags
  
  /**
   * Editor-specific configuration
   */
  editor: EditorConfig
}
