import type { TemplateId, Template } from '../types/project'
import type { WorkspaceConfig } from './types'

// Import templates and configs from workspace folders
import { screenplayTemplate, screenplayConfig } from './screenplay'
import { notesJournalTemplate, notesJournalConfig } from './notes-journal'
import { basicDocumentTemplate, defaultConfig } from './default'
import { blogPostTemplate, blogConfig } from './blog'
import { academicPaperTemplate, academicConfig } from './academic'

// Re-export types
export type { WorkspaceConfig, HierarchyConfig, FeatureFlags, EditorConfig, ScreenplayDocType } from './types'

// Re-export hook
export { useWorkspace } from './useWorkspace'
export type { UseWorkspaceResult } from './useWorkspace'

// Re-export WorkspaceRouter
export { WorkspaceRouter, registerWorkspaceEditor, hasWorkspaceEditor } from './WorkspaceRouter'

// Re-export shared module
export * from './shared'

/**
 * All available templates
 */
export const templates: Template[] = [
  basicDocumentTemplate,
  screenplayTemplate,
  notesJournalTemplate,
  blogPostTemplate,
  academicPaperTemplate
]

/**
 * Get template by ID
 */
export function getTemplateById(id: string): Template | undefined {
  return templates.find(t => t.id === id)
}

/**
 * Map of template IDs to their workspace configurations
 */
const workspaceConfigs: Record<string, WorkspaceConfig> = {
  'screenplay': screenplayConfig,
  'notes-journal': notesJournalConfig,
  'basic-document': defaultConfig,
  'blog-post': blogConfig,
  'academic-paper': academicConfig,
}

/**
 * Get the workspace configuration for a given template ID
 * Returns the default config if no specific config exists
 * 
 * @param templateId - The template ID to get config for
 * @returns The workspace configuration
 */
export function getWorkspaceConfig(templateId: TemplateId | undefined): WorkspaceConfig {
  if (!templateId) {
    return defaultConfig
  }
  return workspaceConfigs[templateId] || defaultConfig
}

/**
 * Check if a template has a specific workspace configuration
 * 
 * @param templateId - The template ID to check
 * @returns True if the template has a custom config
 */
export function hasCustomWorkspaceConfig(templateId: TemplateId): boolean {
  return templateId in workspaceConfigs
}

// Export individual templates for direct access
export { screenplayTemplate, screenplayConfig } from './screenplay'
export { notesJournalTemplate, notesJournalConfig } from './notes-journal'
export { basicDocumentTemplate, defaultConfig } from './default'
export { blogPostTemplate, blogConfig } from './blog'
export { academicPaperTemplate, academicConfig } from './academic'
