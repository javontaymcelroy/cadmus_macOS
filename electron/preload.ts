import { contextBridge, ipcRenderer } from 'electron'
import type { JSONContent } from '@tiptap/core'
import type {
  ActBreakDocOutput,
  AIWritingRequest,
  AIWritingResponse,
  AgendaItem,
  Asset,
  AssetReference,
  BuildResult,
  CharacterDocOutput,
  ConversationIndex,
  ConversationMeta,
  CritiqueIssue,
  Diagnostic,
  DocumentLifecycleState,
  DocumentVersion,
  GeneratedImageResult,
  ImageGenOptions,
  ImageGenSettings,
  LivingDocument,
  LocationDocOutput,
  Project,
  ProjectDocument,
  PropDocOutput,
  ScriptContext,
  StoryFacts,
  SuggestionCard,
  SupplementaryDocument,
  Template,
  TemplateId,
  ThoughtPartnerConversationData,
  ThoughtPartnerRequest,
  ThoughtPartnerResponse,
  ThoughtPartnerSuggestionsRequest,
  TodoItem,
} from '../src/types/project'

// webUtils is available in Electron 22.1+
let webUtils: { getPathForFile: (file: File) => string } | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires -- webUtils needs Electron 29+; require so older versions fall through to the catch
  webUtils = require('electron').webUtils
} catch {
  console.warn('webUtils not available')
}

// AI Suggestions types
interface DocumentContentForAI {
  id: string
  title: string
  content: string
}

interface EntityDoc {
  type: 'character' | 'prop' | 'location'
  name: string
  content: string
}

// Gated Writing Pipeline types
type ActPosition = 'I' | 'II-A' | 'II-B' | 'III' | 'unknown'
type NarrativePhase = 'setup' | 'escalation' | 'climax' | 'release' | 'transition'
type SceneFocus = 'world-building' | 'supporting-cast' | 'lead-driven' | 'theme' | 'conflict'
type ContributionType = 'question' | 'tension' | 'delay' | 'texture' | 'dialogue' | 'action' | 'negativeSpace' | 'none'
type EligibilityStatus = 'eligible' | 'present-passive' | 'available-delayed' | 'excluded'
type PipelineStage = 'classified' | 'constrained' | 'gated' | 'generated' | 'declined'

interface SceneExclusion {
  type: 'character' | 'action' | 'revelation' | 'resolution'
  target?: string
  reason: string
}

interface ClassificationSignals {
  totalSceneCount: number
  scenesSinceActBreak: number
  charactersIntroducedCount: number
  charactersInCurrentScene: number
  conflictEstablished: boolean
  isOpeningScene: boolean
  leadCharacterIdentified: boolean
  leadInCurrentScene: boolean
  scenesSinceLeadAppearance: number
  activeTension: boolean
  currentSceneHeading?: string
}

interface SceneState {
  act: ActPosition
  phase: NarrativePhase
  focus: SceneFocus
  exclusions: SceneExclusion[]
  allowedContributions: ContributionType[]
  confidence: number
  reasoning: string
  signals: ClassificationSignals
}

interface CharacterEligibility {
  characterId: string
  name: string
  status: EligibilityStatus
  reason: string
  constraints?: string[]
  isLead: boolean
  sceneAppearanceCount: number
  scenesSinceLastAppearance: number
}

interface PipelineResult {
  stage: PipelineStage
  sceneState?: SceneState
  eligibility?: CharacterEligibility[]
  gatePassed: boolean
  gateReason?: string
  generation?: AIWritingResponse
  suggestion?: string
}

interface SuggestionsCache {
  contentHash: string
  suggestions: SuggestionCard[]
  cachedAt: string
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const api = {
  // Project operations
  project: {
    create: (template: Template, name: string, basePath: string): Promise<Project> =>
      ipcRenderer.invoke('project:create', template, name, basePath),
    
    open: (projectPath: string): Promise<Project> =>
      ipcRenderer.invoke('project:open', projectPath),

    import: (sourcePath: string, destinationBasePath: string): Promise<Project> =>
      ipcRenderer.invoke('project:import', sourcePath, destinationBasePath),

    export: (projectPath: string, destinationBasePath: string): Promise<string> =>
      ipcRenderer.invoke('project:export', projectPath, destinationBasePath),

    save: (project: Project): Promise<void> =>
      ipcRenderer.invoke('project:save', project),
    
    getLastOpened: (): Promise<string | null> =>
      ipcRenderer.invoke('project:getLastOpened'),
    
    setLastOpened: (path: string): Promise<void> =>
      ipcRenderer.invoke('project:setLastOpened', path),
    
    getRecentProjects: (): Promise<{ name: string; path: string; templateId?: string }[]> =>
      ipcRenderer.invoke('project:getRecentProjects'),
    
    removeFromRecent: (projectPath: string): Promise<void> =>
      ipcRenderer.invoke('project:removeFromRecent', projectPath),
    
    moveToTrash: (projectPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:moveToTrash', projectPath),
    
    // Living document operations
    getLivingDocuments: (): Promise<LivingDocument[]> =>
      ipcRenderer.invoke('project:getLivingDocuments'),
    
    updateLivingDocument: (projectPath: string, state: DocumentLifecycleState, stateNote?: string): Promise<void> =>
      ipcRenderer.invoke('project:updateLivingDocument', projectPath, state, stateNote),
    
    removeLivingDocument: (projectPath: string): Promise<void> =>
      ipcRenderer.invoke('project:removeLivingDocument', projectPath)
  },

  // Document operations
  document: {
    create: (projectPath: string, doc: Omit<ProjectDocument, 'createdAt' | 'updatedAt'>, templateId?: string, screenplayDocType?: 'title-page' | 'page' | 'break'): Promise<ProjectDocument> =>
      ipcRenderer.invoke('document:create', projectPath, doc, templateId, screenplayDocType),
    
    save: (projectPath: string, docId: string, content: unknown): Promise<void> =>
      ipcRenderer.invoke('document:save', projectPath, docId, content),
    
    load: (projectPath: string, docId: string): Promise<JSONContent> =>
      ipcRenderer.invoke('document:load', projectPath, docId),
    
    delete: (projectPath: string, docId: string): Promise<void> =>
      ipcRenderer.invoke('document:delete', projectPath, docId)
  },

  // Asset operations
  asset: {
    upload: (projectPath: string, filePath: string, fileName: string): Promise<Asset> =>
      ipcRenderer.invoke('asset:upload', projectPath, filePath, fileName),
    
    // Upload from buffer (for drag-and-drop where file path isn't available)
    uploadFromBuffer: (projectPath: string, buffer: ArrayBuffer, fileName: string, mimeType: string): Promise<Asset> =>
      ipcRenderer.invoke('asset:uploadFromBuffer', projectPath, buffer, fileName, mimeType),
    
    delete: (projectPath: string, assetId: string): Promise<void> =>
      ipcRenderer.invoke('asset:delete', projectPath, assetId),
    
    getPath: (projectPath: string, assetId: string): Promise<string> =>
      ipcRenderer.invoke('asset:getPath', projectPath, assetId),
    
    // Update references for a single asset
    updateReferences: (projectPath: string, assetId: string, references: AssetReference[]): Promise<void> =>
      ipcRenderer.invoke('asset:updateReferences', projectPath, assetId, references),
    
    // Sync all asset references at once (more efficient)
    syncAllReferences: (projectPath: string, assetReferences: Record<string, AssetReference[]>): Promise<void> =>
      ipcRenderer.invoke('asset:syncAllReferences', projectPath, assetReferences)
  },

  // Dialog operations
  dialog: {
    selectFolder: (): Promise<string | null> =>
      ipcRenderer.invoke('dialog:selectFolder'),
    
    selectFile: (filters?: { name: string; extensions: string[] }[]): Promise<string | null> =>
      ipcRenderer.invoke('dialog:selectFile', filters)
  },

  // Build operations
  build: {
    run: (project: Project, documentContents: Record<string, unknown>): Promise<BuildResult> =>
      ipcRenderer.invoke('build:run', project, documentContents)
  },

  // Version history operations
  version: {
    save: (projectPath: string, docId: string, content: unknown, label?: string): Promise<DocumentVersion> =>
      ipcRenderer.invoke('version:save', projectPath, docId, content, label),
    
    load: (projectPath: string, docId: string): Promise<DocumentVersion[]> =>
      ipcRenderer.invoke('version:load', projectPath, docId),
    
    delete: (projectPath: string, docId: string, versionId: string): Promise<void> =>
      ipcRenderer.invoke('version:delete', projectPath, docId, versionId)
  },

  // Utility operations
  utils: {
    getPathForFile: (file: File): string => {
      // #region agent log
      console.log('[PRELOAD] getPathForFile called:', { name: file?.name, hasWebUtils: !!webUtils })
      // #endregion
      
      if (webUtils) {
        try {
          const result = webUtils.getPathForFile(file)
          // #region agent log
          console.log('[PRELOAD] webUtils.getPathForFile result:', result)
          // #endregion
          return result
        } catch (err) {
          // #region agent log
          console.error('[PRELOAD] webUtils.getPathForFile error:', err)
          // #endregion
        }
      }
      // Fallback for older Electron versions - try to access path property directly
      const fileWithPath = file as File & { path?: string }
      return fileWithPath.path || ''
    },
    
    // Generate a URL for loading local assets via the custom protocol
    getAssetUrl: (projectPath: string, assetPath: string): string => {
      const fullPath = `${projectPath}/${assetPath}`
      return `cadmus-asset://load?path=${encodeURIComponent(fullPath)}`
    }
  },

  // Agenda operations (for NotesJournal todo tracking)
  agenda: {
    getAgendaItems: (): Promise<AgendaItem[]> =>
      ipcRenderer.invoke('agenda:getAgendaItems'),
    
    updateAgendaItem: (
      projectPath: string, 
      documentId: string, 
      documentTitle: string, 
      projectName: string, 
      templateId: TemplateId, 
      todos: TodoItem[]
    ): Promise<void> =>
      ipcRenderer.invoke('agenda:updateAgendaItem', projectPath, documentId, documentTitle, projectName, templateId, todos),
    
    updateAgendaState: (
      projectPath: string, 
      documentId: string, 
      state: DocumentLifecycleState, 
      stateNote?: string
    ): Promise<void> =>
      ipcRenderer.invoke('agenda:updateAgendaState', projectPath, documentId, state, stateNote),
    
    removeAgendaItem: (projectPath: string, documentId: string): Promise<void> =>
      ipcRenderer.invoke('agenda:removeAgendaItem', projectPath, documentId),
    
    toggleTodo: (projectPath: string, documentId: string, todoId: string, checked: boolean): Promise<void> =>
      ipcRenderer.invoke('agenda:toggleTodo', projectPath, documentId, todoId, checked),
    
    markAllTodosDone: (projectPath: string, documentId: string): Promise<void> =>
      ipcRenderer.invoke('agenda:markAllTodosDone', projectPath, documentId)
  },

  // Theme operations
  theme: {
    get: (): Promise<'dark' | 'light'> =>
      ipcRenderer.invoke('theme:get'),

    set: (theme: 'dark' | 'light'): Promise<void> =>
      ipcRenderer.invoke('theme:set', theme)
  },

  // Zoom operations
  zoom: {
    get: (): Promise<number> =>
      ipcRenderer.invoke('zoom:get'),

    set: (zoom: number): Promise<void> =>
      ipcRenderer.invoke('zoom:set', zoom)
  },

  // Interface Scale operations (whole-app zoom)
  interfaceScale: {
    get: (): Promise<number> =>
      ipcRenderer.invoke('interfaceScale:get'),

    set: (scale: number): Promise<void> =>
      ipcRenderer.invoke('interfaceScale:set', scale)
  },

  // Image Generation operations
  imageGeneration: {
    generate: (prompt: string, options: ImageGenOptions): Promise<GeneratedImageResult> =>
      ipcRenderer.invoke('imageGeneration:generate', prompt, options),
    
    getSettings: (): Promise<ImageGenSettings> =>
      ipcRenderer.invoke('imageGeneration:getSettings'),
    
    setSettings: (settings: Partial<ImageGenSettings>): Promise<void> =>
      ipcRenderer.invoke('imageGeneration:setSettings', settings),
    
    hasApiKey: (): Promise<boolean> =>
      ipcRenderer.invoke('imageGeneration:hasApiKey'),
    
    buildPrompt: (selectedText: string, contextSection: string, promptTemplate?: string): Promise<string> =>
      ipcRenderer.invoke('imageGeneration:buildPrompt', selectedText, contextSection, promptTemplate)
  },

  // AI Suggestions operations
  aiSuggestions: {
    generate: (documents: DocumentContentForAI[]): Promise<Diagnostic[]> =>
      ipcRenderer.invoke('aiSuggestions:generate', documents),
    
    hasApiKey: (): Promise<boolean> =>
      ipcRenderer.invoke('aiSuggestions:hasApiKey')
  },

  // Document Generation operations (AI-powered character/prop/location docs)
  documentGeneration: {
    generateCharacter: (characterName: string, scriptContexts: ScriptContext[], supplementaryDocs?: SupplementaryDocument[]): Promise<CharacterDocOutput | null> =>
      ipcRenderer.invoke('documentGeneration:generateCharacter', characterName, scriptContexts, supplementaryDocs),
    
    generateProp: (propName: string, scriptContexts: ScriptContext[], supplementaryDocs?: SupplementaryDocument[]): Promise<PropDocOutput | null> =>
      ipcRenderer.invoke('documentGeneration:generateProp', propName, scriptContexts, supplementaryDocs),
    
    generateLocation: (locationName: string, scriptContexts: ScriptContext[]): Promise<LocationDocOutput | null> =>
      ipcRenderer.invoke('documentGeneration:generateLocation', locationName, scriptContexts),
    
    generateActBreak: (actName: string, actScriptContent: string): Promise<ActBreakDocOutput | null> =>
      ipcRenderer.invoke('documentGeneration:generateActBreak', actName, actScriptContent),
    
    hasApiKey: (): Promise<boolean> =>
      ipcRenderer.invoke('documentGeneration:hasApiKey')
  },

  // Dramatic Critique (Writing Partner) operations
  dramaticCritique: {
    generate: (screenplayText: string, entityDocs: EntityDoc[], supplementaryDocs?: SupplementaryDocument[]): Promise<CritiqueIssue[]> =>
      ipcRenderer.invoke('dramaticCritique:generate', screenplayText, entityDocs, supplementaryDocs),
    
    hasApiKey: (): Promise<boolean> =>
      ipcRenderer.invoke('dramaticCritique:hasApiKey')
  },

  // AI Writing operations (slash command generative tools)
  aiWriting: {
    generate: (request: AIWritingRequest): Promise<AIWritingResponse> =>
      ipcRenderer.invoke('aiWriting:generate', request),
    
    hasApiKey: (): Promise<boolean> =>
      ipcRenderer.invoke('aiWriting:hasApiKey'),

    getDefaultInstructions: (): Promise<{ prose: Record<string, string>; screenplay: Record<string, string> }> =>
      ipcRenderer.invoke('aiWriting:getDefaultInstructions')
  },

  // Gated Writing Pipeline (constraint-first generation)
  gatedWriting: {
    generate: (request: AIWritingRequest, storyFacts?: StoryFacts, forceOverride?: boolean): Promise<PipelineResult> =>
      ipcRenderer.invoke('gatedWriting:generate', request, storyFacts, forceOverride)
  },

  // Thought Partner operations (conversational AI thought partner)
  thoughtPartner: {
    sendMessage: (request: ThoughtPartnerRequest): Promise<ThoughtPartnerResponse> =>
      ipcRenderer.invoke('thoughtPartner:sendMessage', request),

    stopStreaming: (): Promise<void> =>
      ipcRenderer.invoke('thoughtPartner:stopStreaming'),

    getSuggestions: (request: ThoughtPartnerSuggestionsRequest): Promise<SuggestionCard[]> =>
      ipcRenderer.invoke('thoughtPartner:getSuggestions', request),

    loadConversationIndex: (projectPath: string): Promise<ConversationIndex> =>
      ipcRenderer.invoke('thoughtPartner:loadConversationIndex', projectPath),

    saveConversationIndex: (projectPath: string, index: ConversationIndex): Promise<void> =>
      ipcRenderer.invoke('thoughtPartner:saveConversationIndex', projectPath, index),

    loadConversation: (projectPath: string, conversationId: string): Promise<ThoughtPartnerConversationData | null> =>
      ipcRenderer.invoke('thoughtPartner:loadConversation', projectPath, conversationId),

    saveConversation: (projectPath: string, conversationId: string, data: ThoughtPartnerConversationData): Promise<void> =>
      ipcRenderer.invoke('thoughtPartner:saveConversation', projectPath, conversationId, data),

    createConversation: (projectPath: string, title?: string): Promise<ConversationMeta> =>
      ipcRenderer.invoke('thoughtPartner:createConversation', projectPath, title),

    deleteConversation: (projectPath: string, conversationId: string): Promise<ConversationIndex> =>
      ipcRenderer.invoke('thoughtPartner:deleteConversation', projectPath, conversationId),

    hasApiKey: (): Promise<boolean> =>
      ipcRenderer.invoke('thoughtPartner:hasApiKey'),

    loadSuggestionsCache: (projectPath: string): Promise<SuggestionsCache | null> =>
      ipcRenderer.invoke('thoughtPartner:loadSuggestionsCache', projectPath),

    saveSuggestionsCache: (projectPath: string, cache: SuggestionsCache): Promise<void> =>
      ipcRenderer.invoke('thoughtPartner:saveSuggestionsCache', projectPath, cache),

    executePlan: (request: any): Promise<any> =>
      ipcRenderer.invoke('thoughtPartner:executePlan', request),

    acceptReflection: (request: any): Promise<any> =>
      ipcRenderer.invoke('thoughtPartner:acceptReflection', request),

    editReflection: (request: any): Promise<any> =>
      ipcRenderer.invoke('thoughtPartner:editReflection', request),

    answerReflectionQuestions: (request: any): Promise<any> =>
      ipcRenderer.invoke('thoughtPartner:answerReflectionQuestions', request),

    exploreIdea: (request: any): Promise<any> =>
      ipcRenderer.invoke('thoughtPartner:exploreIdea', request),

    stressTestIdea: (request: any): Promise<any> =>
      ipcRenderer.invoke('thoughtPartner:stressTestIdea', request),

    turnIdeaInto: (request: any): Promise<any> =>
      ipcRenderer.invoke('thoughtPartner:turnIdeaInto', request),

    mergeIdeas: (request: any): Promise<any> =>
      ipcRenderer.invoke('thoughtPartner:mergeIdeas', request),

    onChunk: (callback: (chunk: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk)
      ipcRenderer.on('thoughtPartner:chunk', handler)
      return () => ipcRenderer.removeListener('thoughtPartner:chunk', handler)
    },

    onDone: (callback: (response: ThoughtPartnerResponse) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, response: ThoughtPartnerResponse) => callback(response)
      ipcRenderer.on('thoughtPartner:done', handler)
      return () => ipcRenderer.removeListener('thoughtPartner:done', handler)
    },

    onPipelineState: (callback: (state: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: string) => callback(state)
      ipcRenderer.on('thoughtPartner:pipelineState', handler)
      return () => ipcRenderer.removeListener('thoughtPartner:pipelineState', handler)
    }
  },

  // Behavior Policy operations (adaptive behavior layer)
  behaviorPolicy: {
    submitFeedback: (feedback: any): Promise<{ updatedVector: any }> =>
      ipcRenderer.invoke('behaviorPolicy:submitFeedback', feedback),

    getVector: (projectPath: string | null, context: any): Promise<any> =>
      ipcRenderer.invoke('behaviorPolicy:getVector', projectPath, context),

    reset: (projectPath: string | null, level: 'global' | 'project' | 'session'): Promise<void> =>
      ipcRenderer.invoke('behaviorPolicy:reset', projectPath, level),

    getFeedbackSummary: (projectPath: string): Promise<any> =>
      ipcRenderer.invoke('behaviorPolicy:getFeedbackSummary', projectPath),
  },

  // Panel widths persistence
  panelWidths: {
    get: (): Promise<Record<string, number>> =>
      ipcRenderer.invoke('panelWidths:get'),

    set: (widths: Record<string, number>): Promise<void> =>
      ipcRenderer.invoke('panelWidths:set', widths)
  },

  // Workspace state persistence (per-project UI state)
  workspace: {
    load: (projectPath: string): Promise<any> =>
      ipcRenderer.invoke('workspace:load', projectPath),

    saveLayout: (projectPath: string, layout: any): Promise<void> =>
      ipcRenderer.invoke('workspace:saveLayout', projectPath, layout),

    saveDocumentView: (projectPath: string, docId: string, viewState: any): Promise<void> =>
      ipcRenderer.invoke('workspace:saveDocumentView', projectPath, docId, viewState),

    removeDocumentView: (projectPath: string, docId: string): Promise<void> =>
      ipcRenderer.invoke('workspace:removeDocumentView', projectPath, docId)
  },

  // Window state
  window: {
    onFullScreenChange: (callback: (isFullScreen: boolean) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, isFullScreen: boolean) => callback(isFullScreen)
      ipcRenderer.on('fullscreen-changed', handler)
      return () => ipcRenderer.removeListener('fullscreen-changed', handler)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled
contextBridge.exposeInMainWorld('api', api)

// TypeScript type for the exposed API
export type ElectronAPI = typeof api
