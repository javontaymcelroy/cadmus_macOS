import type { Template } from '../../types/project'
import type { WorkspaceConfig } from '../types'

/**
 * Blog Post Template
 * Structured for online publishing with metadata, headings, and link validation.
 */
export const blogPostTemplate: Template = {
  id: 'blog-post',
  name: 'Blog Post',
  description: 'Structured for online publishing with metadata, headings, and link validation.',
  icon: 'edit',
  defaultStructure: {
    folders: [
      { name: 'Drafts', path: 'drafts' },
      { name: 'Published', path: 'published' }
    ],
    documents: [
      { title: 'New Post', path: 'drafts/new-post.json' }
    ]
  },
  enabledPasses: ['spelling-grammar', 'formatting-lint', 'fact-check'],
  settings: {
    citationStyle: 'none',
    formattingRules: {
      headingStyle: 'sentence',
      quotationStyle: 'curly',
      enforceDoubleSpacing: false
    },
    enabledPasses: ['spelling-grammar', 'formatting-lint', 'fact-check']
  }
}

/**
 * Blog Workspace Configuration
 * 
 * Hierarchy: Post (Document) -> Section -> Note
 */
export const blogConfig: WorkspaceConfig = {
  id: 'blog-post',
  
  hierarchy: {
    // Display labels for hierarchy levels
    documentLabel: 'Post',
    pageLabel: 'Section',
    noteLabel: 'Note',
    
    // Action labels
    documentChildLabel: 'New Section',
    pageChildLabel: 'New Note',
    siblingPageLabel: 'New Section',
    documentChildType: undefined,
    defaultDocumentTitle: 'New Post',
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
