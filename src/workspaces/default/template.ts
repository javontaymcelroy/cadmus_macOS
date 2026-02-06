import type { Template } from '../../types/project'
import type { WorkspaceConfig } from '../types'

/**
 * Basic Document Template
 * A simple document for general writing.
 */
export const basicDocumentTemplate: Template = {
  id: 'basic-document',
  name: 'Basic Document',
  description: 'A simple document for general writing. Perfect for essays, letters, or any standalone piece.',
  icon: 'document',
  defaultStructure: {
    folders: [],
    documents: [
      { title: 'Untitled Document', path: 'document.json' }
    ]
  },
  enabledPasses: ['spelling-grammar', 'formatting-lint'],
  settings: {
    citationStyle: 'none',
    formattingRules: {
      headingStyle: 'sentence',
      quotationStyle: 'curly',
      enforceDoubleSpacing: false
    },
    enabledPasses: ['spelling-grammar', 'formatting-lint']
  }
}

/**
 * Default Workspace Configuration
 * Used for basic-document and as fallback for other templates without specific configs.
 * 
 * Standard hierarchy: Document -> Section -> Note
 */
export const defaultConfig: WorkspaceConfig = {
  id: 'basic-document',
  
  hierarchy: {
    // Display labels for hierarchy levels
    documentLabel: 'Document',
    pageLabel: 'Section',
    noteLabel: 'Note',
    
    // Action labels
    documentChildLabel: 'New Section',
    pageChildLabel: 'New Note',
    siblingPageLabel: 'New Section',
    documentChildType: undefined,
    defaultDocumentTitle: 'New Document',
    defaultPageTitle: 'New Section',
    pagesCanHaveChildren: true,
  },
  
  features: {
    showCharactersPanel: false,
    showStoryboardPanel: false,
    showStatusBarRuntime: false,
    enableTodoLists: false,
    todoListsOnlyInNotes: false,
    deriveTitlesFromContent: false,
    showPageNumbers: false,
    showTimestamps: true,
  },
  
  editor: {
    fontFamily: 'inherit',
    useScreenplayExtension: false,
    useMonospaceFont: false,
    showFontFamilySelector: true,
  },
}
