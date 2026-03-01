import { promises as fs } from 'fs'
import { join } from 'path'
import type { WorkspaceState, WorkspaceLayoutState, DocumentViewState } from '../../shared/workspaceStateTypes'
import { WORKSPACE_STATE_VERSION, DEFAULT_LAYOUT } from '../../shared/workspaceStateTypes'

const WORKSPACE_FILE = '.cadmus/workspace.json'

export class WorkspaceStateService {
  /**
   * Load workspace state for a project.
   * Returns null if no workspace.json exists (first time opening).
   */
  async load(projectPath: string): Promise<WorkspaceState | null> {
    const filePath = join(projectPath, WORKSPACE_FILE)
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw) as WorkspaceState

      if (parsed.version < WORKSPACE_STATE_VERSION) {
        return this.migrate(parsed)
      }

      return parsed
    } catch {
      return null
    }
  }

  /**
   * Save the full workspace state atomically.
   * Creates the .cadmus directory if it doesn't exist.
   */
  async save(projectPath: string, state: WorkspaceState): Promise<void> {
    const dirPath = join(projectPath, '.cadmus')
    const filePath = join(projectPath, WORKSPACE_FILE)

    try {
      await fs.mkdir(dirPath, { recursive: true })
      state.lastModified = new Date().toISOString()
      state.version = WORKSPACE_STATE_VERSION

      const tmpPath = filePath + '.tmp'
      await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8')
      await fs.rename(tmpPath, filePath)
    } catch (err) {
      console.error('[WorkspaceState] Failed to save:', err)
    }
  }

  /**
   * Save only the layout portion (debounced from renderer).
   */
  async saveLayout(projectPath: string, layout: WorkspaceLayoutState): Promise<void> {
    const current = await this.load(projectPath) || this.createDefault()
    current.layout = layout
    await this.save(projectPath, current)
  }

  /**
   * Save only a single document's view state.
   */
  async saveDocumentView(
    projectPath: string,
    docId: string,
    viewState: DocumentViewState
  ): Promise<void> {
    const current = await this.load(projectPath) || this.createDefault()
    current.documentViews[docId] = viewState
    await this.save(projectPath, current)
  }

  /**
   * Remove a document's view state (called when a document is deleted).
   */
  async removeDocumentView(projectPath: string, docId: string): Promise<void> {
    const current = await this.load(projectPath)
    if (current && current.documentViews[docId]) {
      delete current.documentViews[docId]
      await this.save(projectPath, current)
    }
  }

  private createDefault(): WorkspaceState {
    return {
      version: WORKSPACE_STATE_VERSION,
      layout: { ...DEFAULT_LAYOUT },
      documentViews: {},
      lastModified: new Date().toISOString()
    }
  }

  private migrate(state: WorkspaceState): WorkspaceState {
    // Future migration logic goes here
    state.version = WORKSPACE_STATE_VERSION
    return state
  }
}
