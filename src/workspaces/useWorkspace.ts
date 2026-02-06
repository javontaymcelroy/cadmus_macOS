import { useProjectStore } from '../stores/projectStore'
import { getWorkspaceConfig } from './index'
import type { WorkspaceConfig } from './types'

/**
 * Hook to access workspace configuration for the current project
 * Provides type-safe access to template-specific features and settings
 */
export function useWorkspace(): UseWorkspaceResult {
  const { currentProject } = useProjectStore()
  const config = getWorkspaceConfig(currentProject?.templateId)
  
  return {
    // Full config object
    config,
    
    // Quick template checks
    isScreenplay: config.id === 'screenplay',
    isNotesJournal: config.id === 'notes-journal',
    hasCustomConfig: config.id === 'screenplay' || config.id === 'notes-journal',
    
    // Feature flags (convenience accessors)
    showCharactersPanel: config.features.showCharactersPanel,
    showStoryboardPanel: config.features.showStoryboardPanel,
    showStatusBarRuntime: config.features.showStatusBarRuntime,
    enableTodoLists: config.features.enableTodoLists,
    todoListsOnlyInNotes: config.features.todoListsOnlyInNotes,
    deriveTitlesFromContent: config.features.deriveTitlesFromContent,
    showPageNumbers: config.features.showPageNumbers,
    
    // Editor config (convenience accessors)
    editorFontFamily: config.editor.fontFamily,
    useScreenplayExtension: config.editor.useScreenplayExtension,
    useMonospaceFont: config.editor.useMonospaceFont,
    showFontFamilySelector: config.editor.showFontFamilySelector,
    
    // Hierarchy config (convenience accessors)
    documentChildLabel: config.hierarchy.documentChildLabel,
    pageChildLabel: config.hierarchy.pageChildLabel,
    siblingPageLabel: config.hierarchy.siblingPageLabel,
    documentChildType: config.hierarchy.documentChildType,
    defaultDocumentTitle: config.hierarchy.defaultDocumentTitle,
    defaultPageTitle: config.hierarchy.defaultPageTitle,
    pagesCanHaveChildren: config.hierarchy.pagesCanHaveChildren,
  }
}

/**
 * Return type for useWorkspace hook
 */
export interface UseWorkspaceResult {
  // Full config
  config: WorkspaceConfig
  
  // Template checks
  isScreenplay: boolean
  isNotesJournal: boolean
  hasCustomConfig: boolean
  
  // Feature flags
  showCharactersPanel: boolean
  showStoryboardPanel: boolean
  showStatusBarRuntime: boolean
  enableTodoLists: boolean
  todoListsOnlyInNotes: boolean
  deriveTitlesFromContent: boolean
  showPageNumbers: boolean
  
  // Editor config
  editorFontFamily: string
  useScreenplayExtension: boolean
  useMonospaceFont: boolean
  showFontFamilySelector: boolean
  
  // Hierarchy config
  documentChildLabel: string
  pageChildLabel: string
  siblingPageLabel: string
  documentChildType: 'title-page' | 'page' | 'break' | undefined
  defaultDocumentTitle: string
  defaultPageTitle: string
  pagesCanHaveChildren: boolean
}
