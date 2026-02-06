import type { Template } from '../../types/project'
import type { WorkspaceConfig } from '../types'

/**
 * Notes & Journal Template
 * Daily entries and quick notes with minimal formatting.
 */
export const notesJournalTemplate: Template = {
  id: 'notes-journal',
  name: 'Notes & Journal',
  description: 'Daily entries and quick notes with minimal formatting. Capture your thoughts freely.',
  icon: 'notebook',
  defaultStructure: {
    folders: [
      { name: 'Entries', path: 'entries' }
    ],
    documents: [
      { title: 'New Journal', path: 'new-journal.json' }
    ]
  },
  enabledPasses: ['spelling-grammar'],
  settings: {
    citationStyle: 'none',
    formattingRules: {
      headingStyle: 'none',
      quotationStyle: 'straight',
      enforceDoubleSpacing: false,
      defaultFontFamily: 'Beth Ellen, cursive'
    },
    enabledPasses: ['spelling-grammar']
  }
}

/**
 * Notes & Journal Workspace Configuration
 * 
 * Hierarchy: Journal (Document) -> Entry (Page) -> [No children]
 * Entries cannot have children in this workspace.
 */
export const notesJournalConfig: WorkspaceConfig = {
  id: 'notes-journal',
  
  hierarchy: {
    // Display labels for hierarchy levels
    documentLabel: 'Journal',
    pageLabel: 'Entry',
    noteLabel: 'Note',
    
    // Action labels
    documentChildLabel: 'New Entry',
    pageChildLabel: 'New Note', // Not used since entries can't have children
    siblingPageLabel: 'New Entry',
    documentChildType: undefined,
    defaultDocumentTitle: 'New Journal',
    defaultPageTitle: 'New Entry',
    pagesCanHaveChildren: false, // Entries cannot have children
  },
  
  features: {
    showCharactersPanel: false,
    showStoryboardPanel: false,
    showStatusBarRuntime: false,
    enableTodoLists: true,
    todoListsOnlyInNotes: false,
    deriveTitlesFromContent: false,
    showPageNumbers: false,
    showTimestamps: true,
  },
  
  editor: {
    fontFamily: 'Beth Ellen, cursive',
    useScreenplayExtension: false,
    useMonospaceFont: false,
    showFontFamilySelector: true,
  },
}
