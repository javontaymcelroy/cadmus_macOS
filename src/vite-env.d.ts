/// <reference types="vite/client" />

interface RecentProject {
  name: string
  path: string
}

interface AssetReferenceAPI {
  documentId: string
  range?: { from: number; to: number }
}

// AI Writing types for slash commands (generative and revision)
type AIWritingCommand =
  | 'continue' | 'dialogue' | 'setting' | 'expand' | 'pov' | 'negativeSpace'
  | 'rework' | 'adjustTone' | 'shorten' | 'clearer' | 'elaborate'
  | 'tension' | 'soften' | 'imagery' | 'pacing' | 'voice' | 'contradiction'
  | 'scriptDoctor'
  | 'fixGrammar' | 'makeLonger' | 'makeConcise' | 'actionItems' | 'extractQuestions' | 'summarize'
  | 'customPrompt'
  | 'ask'
  | 'makeConsistent'

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

interface AISceneContext {
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
  customPromptText?: string
  supplementaryContext?: SupplementaryWritingContext
  sceneContext?: AISceneContext
  targetRuntimeMinutes?: number
  userQuestion?: string
  customSystemPromptInstruction?: string
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

interface SceneStateAPI {
  act: ActPosition
  phase: NarrativePhase
  focus: SceneFocus
  exclusions: SceneExclusion[]
  allowedContributions: ContributionType[]
  confidence: number
  reasoning: string
  signals: ClassificationSignals
}

interface CharacterEligibilityAPI {
  characterId: string
  name: string
  status: EligibilityStatus
  reason: string
  constraints?: string[]
  isLead: boolean
  sceneAppearanceCount: number
  scenesSinceLastAppearance: number
}

interface PipelineResultAPI {
  stage: PipelineStage
  sceneState?: SceneStateAPI
  eligibility?: CharacterEligibilityAPI[]
  gatePassed: boolean
  gateReason?: string
  generation?: AIWritingResponse
  suggestion?: string
}

// Document Generation types
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

interface SupplementaryDocument {
  title: string
  content: string
}

declare global {
  interface Window {
    api: import('../electron/preload').ElectronAPI
  }
}

export {}
