import { contextBridge, ipcRenderer } from 'electron'

// webUtils is available in Electron 22.1+
let webUtils: { getPathForFile: (file: File) => string } | null = null
try {
  webUtils = require('electron').webUtils
} catch {
  console.warn('webUtils not available')
}

// Define types locally to avoid import issues during preload build
interface Template {
  id: string
  name: string
  description: string
  icon: string
  defaultStructure: {
    folders: { name: string; path: string }[]
    documents: { title: string; path: string }[]
  }
  enabledPasses: string[]
  settings: {
    citationStyle?: string
    formattingRules: {
      headingStyle: string
      quotationStyle: string
      enforceDoubleSpacing: boolean
    }
    enabledPasses: string[]
  }
}

interface Project {
  id: string
  name: string
  templateId: string
  path: string
  createdAt: string
  updatedAt: string
  documents: ProjectDocument[]
  assets: Asset[]
  settings: unknown
  buildProfiles: unknown[]
}

interface ProjectDocument {
  id: string
  path: string
  title: string
  order: number
  parentId?: string
  type: 'document' | 'folder'
  createdAt: string
  updatedAt: string
}

interface AssetReference {
  documentId: string
  range?: { from: number; to: number }
}

interface Asset {
  id: string
  path: string
  name: string
  type: string
  mimeType?: string
  size: number
  createdAt: string
  references: AssetReference[]
}

// Build types
interface Diagnostic {
  id: string
  passId: string
  severity: 'error' | 'warning' | 'info'
  title: string
  message: string
  documentId: string
  range?: { from: number; to: number }
  suggestions?: Array<{ label: string; replacement?: string; action?: string }>
  source?: string
}

interface PassResult {
  passId: string
  diagnostics: Diagnostic[]
  fixes?: unknown[]
  timing: number
}

interface BuildResult {
  success: boolean
  diagnostics: Diagnostic[]
  passResults: PassResult[]
  totalTiming: number
  artifacts?: unknown[]
}

// Version history type
interface DocumentVersion {
  id: string
  documentId: string
  timestamp: string
  label?: string
  content: unknown // JSONContent
  wordCount: number
}

// Living document types
type DocumentLifecycleState = 'active' | 'paused' | 'review' | 'completed' | 'archived'

// Template IDs
type TemplateId = 'basic-document' | 'notes-journal' | 'blog-post' | 'screenplay' | 'academic-paper'

interface LivingDocument {
  projectPath: string
  projectName: string
  templateId?: string
  state: DocumentLifecycleState
  stateNote?: string
  lastStateChange: string
  lastOpened: string
}

// Agenda item types (for NotesJournal todo tracking)
interface TodoItem {
  id: string
  text: string
  checked: boolean
}

interface AgendaItem {
  projectPath: string
  projectName: string
  templateId: TemplateId
  documentId: string
  documentTitle: string
  todos: TodoItem[]
  state: DocumentLifecycleState
  stateNote?: string
  lastUpdated: string
}

// Image Generation types
type ImageStyle = 'storyboard-sketch' | 'cinematic' | 'toon-boom' | 'custom'
// gpt-image-1 supported sizes
type ImageSize = '1024x1024' | '1536x1024' | '1024x1536'

interface ImageGenSettings {
  apiKey?: string
  defaultPromptTemplate: string
  defaultStyle: ImageStyle
  defaultSize: ImageSize
  useReferenceImages: boolean
}

interface ImageGenOptions {
  style: ImageStyle
  size: ImageSize
  customPrompt?: string
  projectPath: string
  useReferenceImages?: boolean
}

interface GeneratedImageResult {
  success: boolean
  imageData?: ArrayBuffer
  error?: string
  errorCode?: number
}

// AI Suggestions types
interface DocumentContentForAI {
  id: string
  title: string
  content: string
}

// Document Generation types (AI-powered character/prop/location docs)
interface ScriptContext {
  sceneHeading: string
  elementType: 'character' | 'dialogue' | 'action' | 'parenthetical'
  content: string
  surroundingContext?: string
}

interface CharacterDocOutput {
  roleInStory: string
  backstory: string
  psychologyUnderStress: string
  physicalDescription: string
  wardrobeLogic: string
  movementHabits: string
  voiceSpeechPatterns: string
  relationshipToEnvironment: string
  arc: string
}

interface PropDocOutput {
  functionInPlot: string
  physicalDescription: string
  condition: string
  rulesLimitations: string
  symbolicWeight: string
  howUsedOnScreen: string
}

interface LocationDocOutput {
  purpose: string
  moodTone: string
  visualLanguage: string
  soundProfile: string
  stateOfDecayOrOrder: string
  rulesOfSpace: string
  howCharactersBehaveHere: string
}

interface ActBreakDocOutput {
  plotSummary: string
  themes: string[]
  characterArcs: string[]
}

// Supplementary document for additional context (notes, synopsis, etc.)
interface SupplementaryDocument {
  title: string
  content: string  // Plain text content
}

// Dramatic Critique (Writing Partner) types
type CritiqueOperator = 
  | 'contradiction'
  | 'missing_motivation'
  | 'agency_drop'
  | 'unclear_causality'
  | 'timeline_impossibility'
  | 'chekhov_unfired'
  | 'stakes_drift'
  | 'theme_repetition'

type IssueSeverity = 'blocking' | 'warning' | 'optional'
type IssueResolution = 'unresolved' | 'fixed' | 'intentional' | 'deferred'

interface CritiqueEvidence {
  sceneRef: string
  blockId?: string
  documentId: string
  excerpt: string
}

interface CritiqueIssue {
  id: string
  operator: CritiqueOperator
  confidence: number
  severity: IssueSeverity
  consequence: string
  deadline: string | null
  title: string
  evidence: CritiqueEvidence[]
  question: string
  context: string
  resolution: IssueResolution
  resolvedAt?: number
  resolutionNote?: string
}

interface EntityDoc {
  type: 'character' | 'prop' | 'location'
  name: string
  content: string
}

// AI Writing types (slash command generative and revision tools)
type AIWritingCommand =
  | 'continue' | 'dialogue' | 'setting' | 'expand' | 'pov' | 'negativeSpace'
  | 'rework' | 'adjustTone' | 'shorten' | 'clearer' | 'elaborate'
  | 'tension' | 'soften' | 'imagery' | 'pacing' | 'voice' | 'contradiction'
  | 'scriptDoctor'
  | 'fixGrammar' | 'makeLonger' | 'makeConcise' | 'actionItems' | 'extractQuestions' | 'summarize'

type ScreenplayElementType = 
  | 'scene-heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'

interface ScreenplayElement {
  type: ScreenplayElementType
  text: string
}

interface CharacterInfo {
  id: string
  name: string
  color?: string
}

interface PropInfo {
  id: string
  name: string
  icon?: string
}

interface SupplementaryWritingContext {
  synopsis?: string
  characterNotes?: Array<{ name: string; content: string }>
  propNotes?: Array<{ name: string; content: string }>
  otherNotes?: Array<{ title: string; content: string }>
}

interface SceneContext {
  sceneHeading?: string
  charactersInScene: string[]
  precedingAction?: string
}

interface AIWritingRequest {
  command: AIWritingCommand
  context: string
  selection?: string
  characterName?: string
  characters?: CharacterInfo[]
  props?: PropInfo[]
  settingHint?: string
  documentTitle?: string
  templateType?: string
  toneOption?: string
  supplementaryContext?: SupplementaryWritingContext
  sceneContext?: SceneContext
}

interface AIWritingResponse {
  text: string
  error?: string
  screenplayElements?: ScreenplayElement[]
  isScreenplay?: boolean
  characterMap?: Record<string, CharacterInfo>
  propMap?: Record<string, PropInfo>
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

// StoryFacts for gated pipeline (simplified for preload)
interface StoryFacts {
  characters: Array<{
    characterId: string
    name: string
    currentWants: string[]
    promises: string[]
    constraints: string[]
    relationshipStates: { with: string; state: string; scene: string }[]
    behaviorPattern: string[]
  }>
  props: Array<{
    propId: string
    name: string
    introduced: { scene: string; context: string } | null
    usages: { scene: string; how: string }[]
    rules: string[]
    symbolicSetup: string | null
  }>
  timeline: Array<{
    scene: string
    sceneNumber: number
    characters: string[]
    location: string
    timeOfDay: string
    impliedDuration: string | null
    keyEvents: string[]
  }>
  establishedRules: string[]
  openPromises: string[]
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
    
    load: (projectPath: string, docId: string): Promise<unknown> =>
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
      ipcRenderer.invoke('aiWriting:hasApiKey')
  },

  // Gated Writing Pipeline (constraint-first generation)
  gatedWriting: {
    generate: (request: AIWritingRequest, storyFacts?: StoryFacts, forceOverride?: boolean): Promise<PipelineResult> =>
      ipcRenderer.invoke('gatedWriting:generate', request, storyFacts, forceOverride)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled
contextBridge.exposeInMainWorld('api', api)

// TypeScript type for the exposed API
export type ElectronAPI = typeof api
