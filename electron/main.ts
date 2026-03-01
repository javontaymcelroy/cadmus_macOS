import { app, BrowserWindow, ipcMain, dialog, shell, session, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ProjectStore } from './services/projectStore'
import { PassEngine, PassRegistry, contentToPlainText } from './services/passEngine'
import { FormattingPass, SpellingGrammarPass, CitationPass } from './services/passes'
import { getImageGenerationService, type ImageGenOptions, type ImageGenSettings } from './services/imageGenerationService'
import { getAISuggestionsService, type DocumentContent as AIDocumentContent } from './services/aiSuggestionsService'
import { getDocumentGenerationService, type ScriptContext, type SupplementaryDocument, type CharacterDocOutput, type PropDocOutput, type LocationDocOutput, type ActBreakDocOutput } from './services/documentGenerationService'
import { getDramaticCritiqueService, type EntityDoc } from './services/dramaticCritiqueService'
import { getAIWritingService, type AIWritingRequest } from './services/aiWritingService'
import { runGatedPipeline } from './services/gatedWritingPipeline'
import { getThoughtPartnerService } from './services/thoughtPartnerService'
import { getBehaviorPolicyService } from './services/behaviorPolicyService'
import { getFeedbackLogger } from './services/feedbackLogger'
import { WorkspaceStateService } from './services/workspaceStateService'
import type { ThoughtPartnerRequest, ThoughtPartnerSuggestionsRequest, ThoughtPartnerConversationData, ConversationIndex, SuggestionsCache } from '../shared/thoughtPartnerTypes'
import type { AIWritingRequest as SharedAIWritingRequest } from '../shared/aiWritingTypes'
import type { StoryFacts } from './services/dramaticCritiqueService'
import type { Project, BuildResult } from '../src/types/project'
import type { JSONContent } from '@tiptap/core'

let mainWindow: BrowserWindow | null = null
let projectStore: ProjectStore
let passEngine: PassEngine
let workspaceStateService: WorkspaceStateService

// Initialize Pass Engine with all passes
function initializePassEngine(): PassEngine {
  const registry = new PassRegistry()
  
  // Register all local passes
  registry.register(new FormattingPass())
  registry.register(new SpellingGrammarPass())
  registry.register(new CitationPass())
  
  return new PassEngine(registry)
}

try {
  projectStore = new ProjectStore()
  passEngine = initializePassEngine()
  workspaceStateService = new WorkspaceStateService()
} catch (error) {
  console.error('Failed to initialize services:', error)
  process.exit(1)
}

function createWindow(): void {
  // Configure CSP to allow the cadmus-asset protocol for loading local files
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (is.dev) {
      // Don't set CSP header in dev mode to allow Vite HMR and blob URLs
      callback({ responseHeaders: details.responseHeaders })
      return
    }
    
    // Production CSP with blob: allowed for TTS audio
    const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' cadmus-asset: data:; font-src 'self' data:; media-src 'self' cadmus-asset: blob:; connect-src 'self' cadmus-asset:;"
    
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  // Restore saved window bounds or use defaults
  const savedBounds = projectStore.getWindowBounds()
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: savedBounds?.width || 2100,
    height: savedBounds?.height || 1480,
    minWidth: 1000,
    minHeight: 700,
    show: true, // Show immediately to avoid blank window issues
  }
  if (savedBounds?.x != null && savedBounds?.y != null) {
    windowOptions.x = savedBounds.x
    windowOptions.y = savedBounds.y
  } else {
    windowOptions.center = true
  }

  mainWindow = new BrowserWindow({
    ...windowOptions,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#18181b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Handle renderer crashes - reload the page
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] Renderer process gone:', details.reason)
    if (mainWindow && details.reason !== 'clean-exit') {
      console.log('[Main] Reloading after crash...')
      mainWindow.webContents.reload()
    }
  })

  // Forward fullscreen state changes to the renderer
  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('fullscreen-changed', true)
  })
  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('fullscreen-changed', false)
  })

  // Apply saved interface scale on window ready
  mainWindow.webContents.on('did-finish-load', () => {
    const savedScale = projectStore.getInterfaceScale()
    if (savedScale && savedScale !== 100 && mainWindow) {
      mainWindow.webContents.setZoomFactor(savedScale / 100)
    }
  })

  // Save window bounds on resize and move (debounced)
  let boundsTimer: ReturnType<typeof setTimeout> | null = null
  const saveBounds = () => {
    if (boundsTimer) clearTimeout(boundsTimer)
    boundsTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
        const bounds = mainWindow.getBounds()
        projectStore.setWindowBounds(bounds)
      }
    }, 500)
  }
  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)

  // HMR for renderer based on electron-vite cli
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC Handlers
function setupIpcHandlers(): void {
  // Project operations
  ipcMain.handle('project:create', async (_, template, name, basePath) => {
    return projectStore.createProject(template, name, basePath)
  })

  ipcMain.handle('project:open', async (_, projectPath) => {
    return projectStore.openProject(projectPath)
  })

  ipcMain.handle('project:import', async (_, sourcePath, destinationBasePath) => {
    return projectStore.importProject(sourcePath, destinationBasePath)
  })

  ipcMain.handle('project:export', async (_, projectPath, destinationBasePath) => {
    return projectStore.exportProject(projectPath, destinationBasePath)
  })

  ipcMain.handle('project:save', async (_, project) => {
    return projectStore.saveProject(project)
  })

  ipcMain.handle('project:getLastOpened', async () => {
    return projectStore.getLastOpenedProjectPath()
  })

  ipcMain.handle('project:setLastOpened', async (_, path) => {
    projectStore.setLastOpenedProjectPath(path)
  })

  ipcMain.handle('project:getRecentProjects', async () => {
    return projectStore.getRecentProjects()
  })

  ipcMain.handle('project:removeFromRecent', async (_, projectPath) => {
    return projectStore.removeFromRecentProjects(projectPath)
  })

  ipcMain.handle('project:moveToTrash', async (_, projectPath) => {
    try {
      await shell.trashItem(projectPath)
      projectStore.removeFromRecentProjects(projectPath)
      projectStore.removeLivingDocument(projectPath)
      return { success: true }
    } catch (error) {
      console.error('Failed to move to trash:', error)
      return { success: false, error: String(error) }
    }
  })

  // Living document operations
  ipcMain.handle('project:getLivingDocuments', async () => {
    return projectStore.getLivingDocuments()
  })

  ipcMain.handle('project:updateLivingDocument', async (_, projectPath, state, stateNote) => {
    return projectStore.updateLivingDocumentState(projectPath, state, stateNote)
  })

  ipcMain.handle('project:removeLivingDocument', async (_, projectPath) => {
    return projectStore.removeLivingDocument(projectPath)
  })

  // Document operations
  ipcMain.handle('document:create', async (_, projectPath, doc, templateId, screenplayDocType) => {
    return projectStore.createDocument(projectPath, doc, undefined, templateId, screenplayDocType)
  })

  ipcMain.handle('document:save', async (_, projectPath, docId, content) => {
    return projectStore.saveDocument(projectPath, docId, content)
  })

  ipcMain.handle('document:load', async (_, projectPath, docId) => {
    return projectStore.loadDocument(projectPath, docId)
  })

  ipcMain.handle('document:delete', async (_, projectPath, docId) => {
    return projectStore.deleteDocument(projectPath, docId)
  })

  // Asset operations
  ipcMain.handle('asset:upload', async (_, projectPath, filePath, fileName) => {
    return projectStore.uploadAsset(projectPath, filePath, fileName)
  })

  ipcMain.handle('asset:uploadFromBuffer', async (_, projectPath, buffer, fileName, mimeType) => {
    return projectStore.uploadAssetFromBuffer(projectPath, buffer, fileName, mimeType)
  })

  ipcMain.handle('asset:delete', async (_, projectPath, assetId) => {
    return projectStore.deleteAsset(projectPath, assetId)
  })

  ipcMain.handle('asset:getPath', async (_, projectPath, assetId) => {
    return projectStore.getAssetPath(projectPath, assetId)
  })

  ipcMain.handle('asset:updateReferences', async (_, projectPath, assetId, references) => {
    return projectStore.updateAssetReferences(projectPath, assetId, references)
  })

  ipcMain.handle('asset:syncAllReferences', async (_, projectPath, assetReferences) => {
    return projectStore.syncAllAssetReferences(projectPath, assetReferences)
  })

  // Dialog operations
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:selectFile', async (_, filters) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Version history operations
  ipcMain.handle('version:save', async (_, projectPath, docId, content, label) => {
    return projectStore.saveVersion(projectPath, docId, content, label)
  })

  ipcMain.handle('version:load', async (_, projectPath, docId) => {
    return projectStore.loadVersions(projectPath, docId)
  })

  ipcMain.handle('version:delete', async (_, projectPath, docId, versionId) => {
    return projectStore.deleteVersion(projectPath, docId, versionId)
  })

  // Agenda operations
  ipcMain.handle('agenda:getAgendaItems', async () => {
    return projectStore.getAgendaItems()
  })

  ipcMain.handle('agenda:updateAgendaItem', async (_, projectPath, documentId, documentTitle, projectName, templateId, todos) => {
    return projectStore.updateAgendaItem(projectPath, documentId, documentTitle, projectName, templateId, todos)
  })

  ipcMain.handle('agenda:updateAgendaState', async (_, projectPath, documentId, state, stateNote) => {
    return projectStore.updateAgendaState(projectPath, documentId, state, stateNote)
  })

  ipcMain.handle('agenda:removeAgendaItem', async (_, projectPath, documentId) => {
    return projectStore.removeAgendaItem(projectPath, documentId)
  })

  ipcMain.handle('agenda:toggleTodo', async (_, projectPath, documentId, todoId, checked) => {
    return projectStore.toggleTodo(projectPath, documentId, todoId, checked)
  })

  ipcMain.handle('agenda:markAllTodosDone', async (_, projectPath, documentId) => {
    return projectStore.markAllTodosDone(projectPath, documentId)
  })

  // Theme operations
  ipcMain.handle('theme:get', async () => {
    return projectStore.getTheme()
  })

  ipcMain.handle('theme:set', async (_, theme: 'dark' | 'light') => {
    return projectStore.setTheme(theme)
  })

  // Zoom operations
  ipcMain.handle('zoom:get', async () => {
    return projectStore.getZoom()
  })

  ipcMain.handle('zoom:set', async (_, zoom: number) => {
    return projectStore.setZoom(zoom)
  })

  // Interface Scale operations (whole-app zoom via webContents)
  ipcMain.handle('interfaceScale:get', async () => {
    return projectStore.getInterfaceScale()
  })

  ipcMain.handle('interfaceScale:set', async (_, scale: number) => {
    projectStore.setInterfaceScale(scale)
    if (mainWindow) {
      mainWindow.webContents.setZoomFactor(scale / 100)
    }
  })

  // Panel width operations
  ipcMain.handle('panelWidths:get', async () => {
    return projectStore.getPanelWidths()
  })

  ipcMain.handle('panelWidths:set', async (_, widths: Record<string, number>) => {
    projectStore.setPanelWidths(widths)
  })

  // Workspace state operations
  ipcMain.handle('workspace:load', async (_, projectPath: string) => {
    return workspaceStateService.load(projectPath)
  })

  ipcMain.handle('workspace:saveLayout', async (_, projectPath: string, layout) => {
    return workspaceStateService.saveLayout(projectPath, layout)
  })

  ipcMain.handle('workspace:saveDocumentView', async (_, projectPath: string, docId: string, viewState) => {
    return workspaceStateService.saveDocumentView(projectPath, docId, viewState)
  })

  ipcMain.handle('workspace:removeDocumentView', async (_, projectPath: string, docId: string) => {
    return workspaceStateService.removeDocumentView(projectPath, docId)
  })

  // Window bounds operations
  ipcMain.handle('windowBounds:get', async () => {
    return projectStore.getWindowBounds()
  })

  // Image Generation operations
  ipcMain.handle('imageGeneration:generate', async (_, prompt: string, options: ImageGenOptions) => {
    console.log('[Main] Image generation requested')
    const service = getImageGenerationService()
    const result = await service.generateImage(prompt, options)
    
    if (result.success && result.imageBuffer) {
      // Return the buffer as an ArrayBuffer for the renderer
      return {
        success: true,
        imageData: result.imageBuffer.buffer.slice(
          result.imageBuffer.byteOffset,
          result.imageBuffer.byteOffset + result.imageBuffer.byteLength
        )
      }
    }
    
    return {
      success: false,
      error: result.error,
      errorCode: result.errorCode
    }
  })

  ipcMain.handle('imageGeneration:getSettings', async () => {
    const service = getImageGenerationService()
    return service.getSettings()
  })

  ipcMain.handle('imageGeneration:setSettings', async (_, settings: Partial<ImageGenSettings>) => {
    const service = getImageGenerationService()
    service.setSettings(settings)
  })

  ipcMain.handle('imageGeneration:hasApiKey', async () => {
    const service = getImageGenerationService()
    return service.hasApiKey()
  })

  ipcMain.handle('imageGeneration:buildPrompt', async (_, selectedText: string, contextSection: string, promptTemplate?: string) => {
    const service = getImageGenerationService()
    return service.buildPrompt(selectedText, contextSection, promptTemplate)
  })

  // AI Suggestions operations
  ipcMain.handle('aiSuggestions:generate', async (_, documents: AIDocumentContent[]) => {
    console.log('[Main] AI suggestions requested for', documents.length, 'documents')
    const service = getAISuggestionsService()
    return service.generateSuggestions(documents)
  })

  ipcMain.handle('aiSuggestions:hasApiKey', async () => {
    const service = getAISuggestionsService()
    return service.hasApiKey()
  })

  // Document Generation operations (AI-powered character/prop/location docs)
  ipcMain.handle('documentGeneration:generateCharacter', async (_, characterName: string, scriptContexts: ScriptContext[], supplementaryDocs?: SupplementaryDocument[]) => {
    console.log('[Main] Document generation requested for character:', characterName, 'with', supplementaryDocs?.length || 0, 'supplementary docs')
    const service = getDocumentGenerationService()
    return service.generateCharacterDoc(characterName, scriptContexts, supplementaryDocs)
  })

  ipcMain.handle('documentGeneration:generateProp', async (_, propName: string, scriptContexts: ScriptContext[], supplementaryDocs?: SupplementaryDocument[]) => {
    console.log('[Main] Document generation requested for prop:', propName, 'with', supplementaryDocs?.length || 0, 'supplementary docs')
    const service = getDocumentGenerationService()
    return service.generatePropDoc(propName, scriptContexts, supplementaryDocs)
  })

  ipcMain.handle('documentGeneration:generateLocation', async (_, locationName: string, scriptContexts: ScriptContext[]) => {
    console.log('[Main] Document generation requested for location:', locationName)
    const service = getDocumentGenerationService()
    return service.generateLocationDoc(locationName, scriptContexts)
  })

  ipcMain.handle('documentGeneration:generateActBreak', async (_, actName: string, actScriptContent: string) => {
    console.log('[Main] Document generation requested for act break:', actName)
    const service = getDocumentGenerationService()
    return service.generateActBreakDoc(actName, actScriptContent)
  })

  ipcMain.handle('documentGeneration:hasApiKey', async () => {
    const service = getDocumentGenerationService()
    return service.hasApiKey()
  })

  // Dramatic Critique (Writing Partner) operations
  ipcMain.handle('dramaticCritique:generate', async (_, screenplayText: string, entityDocs: EntityDoc[], supplementaryDocs?: { title: string; content: string }[]) => {
    console.log('[Main] Dramatic critique requested')
    const service = getDramaticCritiqueService()
    return service.generateCritique(screenplayText, entityDocs, supplementaryDocs)
  })

  ipcMain.handle('dramaticCritique:hasApiKey', async () => {
    const service = getDramaticCritiqueService()
    return service.hasApiKey()
  })

  // AI Writing operations (slash command generative tools)
  ipcMain.handle('aiWriting:generate', async (_, request: AIWritingRequest) => {
    console.log('[Main] AI writing requested:', request.command)
    const service = getAIWritingService()
    return service.generate(request)
  })

  ipcMain.handle('aiWriting:hasApiKey', async () => {
    const service = getAIWritingService()
    return service.hasApiKey()
  })

  ipcMain.handle('aiWriting:getDefaultInstructions', async () => {
    const { DEFAULT_PROSE_INSTRUCTIONS, DEFAULT_SCREENPLAY_INSTRUCTIONS } = await import('./services/aiWritingService')
    return { prose: DEFAULT_PROSE_INSTRUCTIONS, screenplay: DEFAULT_SCREENPLAY_INSTRUCTIONS }
  })

  // Gated Writing Pipeline operations (constraint-first generation)
  ipcMain.handle('gatedWriting:generate', async (_, request: SharedAIWritingRequest, storyFacts?: StoryFacts, forceOverride?: boolean) => {
    console.log('[Main] Gated writing pipeline requested:', request.command, 'override:', !!forceOverride)
    return runGatedPipeline(request, storyFacts, forceOverride || false)
  })

  // Thought Partner operations
  ipcMain.handle('thoughtPartner:sendMessage', async (_, request: ThoughtPartnerRequest) => {
    console.log('[Main] Thought Partner message received, pipeline:', !!request.usePipeline)
    const service = getThoughtPartnerService()
    return service.sendMessage(
      request,
      (chunk: string) => {
        if (mainWindow) {
          mainWindow.webContents.send('thoughtPartner:chunk', chunk)
        }
      },
      (state: string) => {
        if (mainWindow) {
          mainWindow.webContents.send('thoughtPartner:pipelineState', state)
        }
      }
    )
  })

  ipcMain.handle('thoughtPartner:stopStreaming', async () => {
    const service = getThoughtPartnerService()
    service.stopStreaming()
  })

  ipcMain.handle('thoughtPartner:executePlan', async (_, request: any) => {
    console.log('[Main] Thought Partner plan execution requested')
    const service = getThoughtPartnerService()
    return service.executePlanAfterApproval(
      request.structuredPlan,
      request,
      (chunk: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:chunk', chunk)
      },
      (state: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:pipelineState', state)
      }
    )
  })

  ipcMain.handle('thoughtPartner:acceptReflection', async (_, request: any) => {
    console.log('[Main] Thought Partner reflection accepted')
    const service = getThoughtPartnerService()
    return service.handleReflectionAccept(
      request.reflection,
      request,
      (chunk: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:chunk', chunk)
      },
      (state: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:pipelineState', state)
      }
    )
  })

  ipcMain.handle('thoughtPartner:editReflection', async (_, request: any) => {
    console.log('[Main] Thought Partner reflection edited')
    const service = getThoughtPartnerService()
    return service.handleReflectionEdit(
      request.reflection,
      request.newInterpretation,
      request,
      (chunk: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:chunk', chunk)
      },
      (state: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:pipelineState', state)
      }
    )
  })

  ipcMain.handle('thoughtPartner:answerReflectionQuestions', async (_, request: any) => {
    console.log('[Main] Thought Partner reflection questions answered')
    const service = getThoughtPartnerService()
    return service.handleReflectionAnswer(
      request.reflection,
      request.meaningAnswers || [],
      request.executionAnswers || [],
      request,
      (chunk: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:chunk', chunk)
      },
      (state: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:pipelineState', state)
      }
    )
  })

  ipcMain.handle('thoughtPartner:exploreIdea', async (_, request: any) => {
    console.log('[Main] Thought Partner exploring idea')
    const service = getThoughtPartnerService()
    return service.handleExploreIdea(
      request.ideaCard,
      request.expansionPathId || null,
      request,
      (chunk: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:chunk', chunk)
      },
      (state: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:pipelineState', state)
      }
    )
  })

  ipcMain.handle('thoughtPartner:stressTestIdea', async (_, request: any) => {
    console.log('[Main] Thought Partner stress-testing idea')
    const service = getThoughtPartnerService()
    return service.handleStressTestIdea(
      request.ideaCard,
      request,
      (chunk: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:chunk', chunk)
      },
      (state: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:pipelineState', state)
      }
    )
  })

  ipcMain.handle('thoughtPartner:turnIdeaInto', async (_, request: any) => {
    console.log('[Main] Thought Partner converting idea')
    const service = getThoughtPartnerService()
    return service.handleTurnIdeaInto(
      request.ideaCard,
      request.targetType,
      request,
      (chunk: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:chunk', chunk)
      },
      (state: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:pipelineState', state)
      }
    )
  })

  ipcMain.handle('thoughtPartner:mergeIdeas', async (_, request: any) => {
    console.log('[Main] Thought Partner merging ideas')
    const service = getThoughtPartnerService()
    return service.handleMergeIdeas(
      request.ideaCardA,
      request.ideaCardB,
      request,
      (chunk: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:chunk', chunk)
      },
      (state: string) => {
        if (mainWindow) mainWindow.webContents.send('thoughtPartner:pipelineState', state)
      }
    )
  })

  ipcMain.handle('thoughtPartner:getSuggestions', async (_, request: ThoughtPartnerSuggestionsRequest) => {
    console.log('[Main] Thought Partner suggestions requested')
    const service = getThoughtPartnerService()
    return service.generateSuggestions(request)
  })

  ipcMain.handle('thoughtPartner:loadConversationIndex', async (_, projectPath: string) => {
    const service = getThoughtPartnerService()
    return service.loadConversationIndex(projectPath)
  })

  ipcMain.handle('thoughtPartner:saveConversationIndex', async (_, projectPath: string, index: ConversationIndex) => {
    const service = getThoughtPartnerService()
    return service.saveConversationIndex(projectPath, index)
  })

  ipcMain.handle('thoughtPartner:loadConversation', async (_, projectPath: string, conversationId: string) => {
    const service = getThoughtPartnerService()
    return service.loadConversation(projectPath, conversationId)
  })

  ipcMain.handle('thoughtPartner:saveConversation', async (_, projectPath: string, conversationId: string, data: ThoughtPartnerConversationData) => {
    const service = getThoughtPartnerService()
    return service.saveConversation(projectPath, conversationId, data)
  })

  ipcMain.handle('thoughtPartner:createConversation', async (_, projectPath: string, title?: string) => {
    const service = getThoughtPartnerService()
    return service.createConversation(projectPath, title)
  })

  ipcMain.handle('thoughtPartner:deleteConversation', async (_, projectPath: string, conversationId: string) => {
    const service = getThoughtPartnerService()
    return service.deleteConversation(projectPath, conversationId)
  })

  ipcMain.handle('thoughtPartner:hasApiKey', async () => {
    const service = getThoughtPartnerService()
    return service.hasApiKey()
  })

  ipcMain.handle('thoughtPartner:loadSuggestionsCache', async (_, projectPath: string) => {
    const service = getThoughtPartnerService()
    return service.loadSuggestionsCache(projectPath)
  })

  ipcMain.handle('thoughtPartner:saveSuggestionsCache', async (_, projectPath: string, cache: SuggestionsCache) => {
    const service = getThoughtPartnerService()
    return service.saveSuggestionsCache(projectPath, cache)
  })

  // Behavior Policy operations (adaptive behavior layer)
  ipcMain.handle('behaviorPolicy:submitFeedback', async (_, feedback) => {
    console.log('[Main] Behavior policy feedback received:', feedback.signal)
    const policyService = getBehaviorPolicyService()
    const logger = getFeedbackLogger()

    const entry = {
      id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      messageId: feedback.messageId,
      conversationId: feedback.conversationId,
      timestamp: new Date().toISOString(),
      signal: feedback.signal,
      context: feedback.context,
      behaviorVectorSnapshot: feedback.vectorSnapshot,
      expressedDimensions: feedback.expressedDimensions,
    }

    if (feedback.projectPath) {
      logger.logFeedback(feedback.projectPath, entry)
    }

    const updatedVector = policyService.processFeedback(feedback.projectPath, entry)
    return { updatedVector }
  })

  ipcMain.handle('behaviorPolicy:getVector', async (_, projectPath: string | null, context) => {
    const policyService = getBehaviorPolicyService()
    return policyService.resolveVectorWithExploration(projectPath, context)
  })

  ipcMain.handle('behaviorPolicy:reset', async (_, projectPath: string | null, level: string) => {
    const policyService = getBehaviorPolicyService()
    switch (level) {
      case 'global': policyService.resetGlobal(); break
      case 'project': if (projectPath) policyService.resetProject(projectPath); break
      case 'session': policyService.resetSession(); break
    }
  })

  ipcMain.handle('behaviorPolicy:getFeedbackSummary', async (_, projectPath: string) => {
    const logger = getFeedbackLogger()
    return logger.getFeedbackSummary(projectPath)
  })

  // Build operations
  ipcMain.handle('build:run', async (_, project: Project, documentContents: Record<string, JSONContent>): Promise<BuildResult> => {
    console.log('[Main] Running build for project:', project.name)
    
    try {
      // Prepare documents with content and plain text
      const documents = project.documents
        .filter(doc => doc.type === 'document')
        .map(doc => {
          const content = documentContents[doc.id] || { type: 'doc', content: [] }
          const { text } = contentToPlainText(content)
          return {
            id: doc.id,
            title: doc.title,
            content,
            plainText: text
          }
        })

      // Run the build
      const result = await passEngine.runBuild({
        project,
        documents,
        settings: project.settings
      })

      console.log('[Main] Build complete:', {
        success: result.success,
        diagnosticCount: result.diagnostics.length,
        timing: result.totalTiming
      })

      return result
    } catch (error) {
      console.error('[Main] Build failed:', error)
      return {
        success: false,
        diagnostics: [{
          id: 'build-error',
          passId: 'system',
          severity: 'error',
          title: 'Build Failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          documentId: ''
        }],
        passResults: [],
        totalTiming: 0
      }
    }
  })
}

// Register custom protocol scheme for serving local assets
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cadmus-asset',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true
    }
  }
])

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.cadmus.app')

  // Register the protocol handler for serving local asset files
  protocol.handle('cadmus-asset', (request) => {
    // URL format: cadmus-asset://load?path=/full/path/to/file.jpg
    const url = new URL(request.url)
    const filePath = url.searchParams.get('path')
    
    if (!filePath) {
      return new Response('Missing path parameter', { status: 400 })
    }
    
    // Convert the file path to a file:// URL and fetch it via net
    const fileUrl = pathToFileURL(filePath).href
    return net.fetch(fileUrl)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIpcHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
