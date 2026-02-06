import type { Template } from '../../types/project'
import type { WorkspaceConfig } from '../types'

/**
 * Screenplay Template
 * Industry-standard screenplay formatting with scene headings, dialogue, and action blocks.
 */
export const screenplayTemplate: Template = {
  id: 'screenplay',
  name: 'Screenplay',
  description: 'Industry-standard screenplay formatting with scene headings, dialogue, and action blocks.',
  icon: 'video',
  defaultStructure: {
    folders: [
      { name: 'Acts', path: 'acts' },
      { name: 'Characters', path: 'characters' }
    ],
    documents: [
      { title: 'Title Page', path: 'title-page.json' },
      { title: 'New page', path: 'acts/new-page.json' }
    ]
  },
  enabledPasses: ['spelling-grammar', 'screenplay-lint', 'continuity'],
  settings: {
    citationStyle: 'none',
    formattingRules: {
      headingStyle: 'title',
      quotationStyle: 'straight',
      enforceDoubleSpacing: false,
      defaultFontFamily: 'Courier New, Courier, monospace'
    },
    enabledPasses: ['spelling-grammar', 'screenplay-lint', 'continuity']
  }
}

/**
 * Screenplay Workspace Configuration
 * 
 * Hierarchy: Screenplay (Document) -> Scene (Page) -> Note
 */
export const screenplayConfig: WorkspaceConfig = {
  id: 'screenplay',
  
  hierarchy: {
    // Display labels for hierarchy levels
    documentLabel: 'Screenplay',
    pageLabel: 'Act',
    noteLabel: 'Note',
    
    // Action labels
    documentChildLabel: 'New Act',
    pageChildLabel: 'New Note',
    siblingPageLabel: 'New Act',
    documentChildType: 'page',
    defaultDocumentTitle: 'Title Page',
    defaultPageTitle: 'New Act',
    pagesCanHaveChildren: true,
  },
  
  features: {
    showCharactersPanel: true,
    showStoryboardPanel: true,
    showStatusBarRuntime: true,
    enableTodoLists: true,
    todoListsOnlyInNotes: true,
    deriveTitlesFromContent: true,
    showPageNumbers: true,
    showTimestamps: false,
  },
  
  editor: {
    fontFamily: 'Courier New, Courier, monospace',
    useScreenplayExtension: true,
    useMonospaceFont: true,
    showFontFamilySelector: false,
  },
}
