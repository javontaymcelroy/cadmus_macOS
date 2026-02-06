import { useProjectStore } from '../stores/projectStore'
import type { TemplateId } from '../types/project'

// Import workspace editors
import { ScreenplayEditor } from './screenplay'
import { JournalEditor } from './notes-journal'
import { AcademicEditor } from './academic'
import { BlogEditor } from './blog'
import { DefaultEditor } from './default'

// Placeholder component shown while loading or for unimplemented workspaces
function PlaceholderEditor({ templateId }: { templateId: string }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-ink-900">
      <div className="text-center text-ink-400">
        <p className="text-lg mb-2">Workspace: {templateId}</p>
        <p className="text-sm">Editor implementation in progress...</p>
      </div>
    </div>
  )
}

// Component registry - all workspaces registered
type EditorComponent = React.ComponentType<Record<string, never>>

const workspaceEditors: Partial<Record<TemplateId, EditorComponent>> = {
  'screenplay': ScreenplayEditor,
  'notes-journal': JournalEditor,
  'academic-paper': AcademicEditor,
  'blog-post': BlogEditor,
  'basic-document': DefaultEditor,
}

interface WorkspaceRouterProps {
  // Optional fallback component if no editor is available
  fallback?: React.ReactNode
}

/**
 * WorkspaceRouter selects and renders the appropriate editor
 * based on the current project's template type.
 * 
 * Each template has its own dedicated editor with template-specific:
 * - TipTap extensions
 * - Toolbar configuration
 * - UI components
 * - Document handling logic
 */
export function WorkspaceRouter({ fallback }: WorkspaceRouterProps) {
  const currentProject = useProjectStore(state => state.currentProject)
  const activeDocumentId = useProjectStore(state => state.activeDocumentId)
  
  // No project selected
  if (!currentProject) {
    return fallback ? <>{fallback}</> : null
  }
  
  const templateId = currentProject.templateId
  
  // Get the editor component for this template
  const EditorComponent = workspaceEditors[templateId]
  
  // If we have a specific editor for this template, use it
  if (EditorComponent) {
    return <EditorComponent />
  }
  
  // Otherwise show placeholder (during development) or fallback
  if (fallback) {
    return <>{fallback}</>
  }
  
  // Development placeholder
  return <PlaceholderEditor templateId={templateId} />
}

/**
 * Register a workspace editor component
 * This allows dynamic registration of editors as they're implemented
 */
export function registerWorkspaceEditor(templateId: TemplateId, component: EditorComponent) {
  workspaceEditors[templateId] = component
}

/**
 * Check if a workspace editor is registered for a template
 */
export function hasWorkspaceEditor(templateId: TemplateId): boolean {
  return templateId in workspaceEditors
}

export default WorkspaceRouter
