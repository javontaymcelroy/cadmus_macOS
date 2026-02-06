import type { Template } from '../../types/project'
import type { WorkspaceConfig } from '../types'

/**
 * Academic Paper Template
 * Research papers with citation management, bibliography, and strict formatting rules.
 */
export const academicPaperTemplate: Template = {
  id: 'academic-paper',
  name: 'Academic Paper',
  description: 'Research papers with citation management, bibliography, and strict formatting rules.',
  icon: 'academic',
  defaultStructure: {
    folders: [
      { name: 'Sections', path: 'sections' },
      { name: 'References', path: 'references' }
    ],
    documents: [
      { title: 'Abstract', path: 'sections/abstract.json' },
      { title: 'Introduction', path: 'sections/introduction.json' },
      { title: 'Methodology', path: 'sections/methodology.json' },
      { title: 'Results', path: 'sections/results.json' },
      { title: 'Discussion', path: 'sections/discussion.json' },
      { title: 'Conclusion', path: 'sections/conclusion.json' },
      { title: 'Bibliography', path: 'references/bibliography.json' }
    ]
  },
  enabledPasses: ['spelling-grammar', 'formatting-lint', 'citation', 'fact-check'],
  settings: {
    citationStyle: 'apa',
    formattingRules: {
      headingStyle: 'title',
      quotationStyle: 'curly',
      enforceDoubleSpacing: true
    },
    enabledPasses: ['spelling-grammar', 'formatting-lint', 'citation', 'fact-check']
  }
}

/**
 * Academic Workspace Configuration
 * 
 * Hierarchy: Paper (Document) -> Section -> Note
 */
export const academicConfig: WorkspaceConfig = {
  id: 'academic-paper',
  
  hierarchy: {
    // Display labels for hierarchy levels
    documentLabel: 'Paper',
    pageLabel: 'Section',
    noteLabel: 'Note',
    
    // Action labels
    documentChildLabel: 'New Section',
    pageChildLabel: 'New Note',
    siblingPageLabel: 'New Section',
    documentChildType: undefined,
    defaultDocumentTitle: 'New Paper',
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
