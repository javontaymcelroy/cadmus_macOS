import { promises as fs } from 'fs'
import { join, extname, basename } from 'path'
import { v4 as uuidv4 } from 'uuid'
import Store from 'electron-store'
import type { 
  Project, 
  ProjectDocument, 
  Asset, 
  Template,
  AssetType,
  AssetReference,
  DocumentVersion
} from '../../src/types/project'
import type { JSONContent } from '@tiptap/core'

interface RecentProject {
  name: string
  path: string
  templateId?: string
}

// Document lifecycle state types
type DocumentLifecycleState = 'active' | 'paused' | 'review' | 'completed' | 'archived'

// Template type alias
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

// Helper to create a text node with optional marks
function createTextNode(
  text: string, 
  options?: { 
    fontFamily?: string
    underline?: boolean 
  }
): { type: string; text: string; marks?: Array<{ type: string; attrs?: Record<string, string> }> } {
  const marks: Array<{ type: string; attrs?: Record<string, string> }> = []
  
  if (options?.fontFamily) {
    marks.push({ type: 'textStyle', attrs: { fontFamily: options.fontFamily } })
  }
  if (options?.underline) {
    marks.push({ type: 'underline' })
  }
  
  return marks.length > 0 
    ? { type: 'text', text, marks }
    : { type: 'text', text }
}

// Helper to create a centered paragraph
function createCenteredParagraph(
  text?: string,
  options?: { fontFamily?: string; underline?: boolean }
): JSONContent {
  if (!text) {
    return { type: 'paragraph', attrs: { textAlign: 'center' } }
  }
  return {
    type: 'paragraph',
    attrs: { textAlign: 'center' },
    content: [createTextNode(text, options)]
  }
}

// Helper to create a left-aligned paragraph
function createLeftParagraph(
  text?: string,
  options?: { fontFamily?: string }
): JSONContent {
  if (!text) {
    return { type: 'paragraph' }
  }
  return {
    type: 'paragraph',
    content: [createTextNode(text, options)]
  }
}

// Helper to create a centered H1 heading (for screenplay title)
function createCenteredHeading(
  text: string,
  options?: { fontFamily?: string; underline?: boolean }
): JSONContent {
  const marks: Array<{ type: string; attrs?: Record<string, string> }> = []
  
  if (options?.fontFamily) {
    marks.push({ type: 'textStyle', attrs: { fontFamily: options.fontFamily } })
  }
  if (options?.underline) {
    marks.push({ type: 'underline' })
  }
  
  return {
    type: 'heading',
    attrs: { level: 1, textAlign: 'center' },
    content: [marks.length > 0 
      ? { type: 'text', text, marks }
      : { type: 'text', text }
    ]
  }
}

// Generate screenplay break (Act) content
function createScreenplayBreakContent(fontFamily: string, title: string): JSONContent {
  const fontOpts = { fontFamily }
  
  return {
    type: 'doc',
    content: [
      // Spacing before title
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      
      // Title - centered H1 heading (syncs with document title)
      createCenteredHeading(title, { ...fontOpts, underline: true }),
      
      // Spacing
      createCenteredParagraph(),
      createCenteredParagraph(),
      
      // Placeholder description
      {
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [{
          type: 'text',
          text: 'Describe your act...',
          marks: [
            { type: 'textStyle', attrs: { fontFamily } },
            { type: 'italic' }
          ]
        }]
      }
    ]
  }
}

// Generate industry-standard screenplay title page content
function createScreenplayTitlePageContent(fontFamily: string, projectName: string): JSONContent {
  const fontOpts = { fontFamily }
  
  // Convert project name to uppercase for screenplay title convention
  const screenplayTitle = projectName.toUpperCase()
  
  return {
    type: 'doc',
    content: [
      // Title - centered H1 heading with underline (syncs with document title)
      createCenteredHeading(screenplayTitle, { ...fontOpts, underline: true }),
      
      // Spacing
      createCenteredParagraph(),
      createCenteredParagraph(),
      
      // Written by
      createCenteredParagraph('Written by', fontOpts),
      
      // Spacing
      createCenteredParagraph(),
      
      // Author name
      createCenteredParagraph('Your Name', fontOpts),
      
      // Spacing
      createCenteredParagraph(),
      createCenteredParagraph(),
      
      // Based on (optional)
      createCenteredParagraph('Based on (If Any)', fontOpts),
      
      // Spacing
      createCenteredParagraph(),
      createCenteredParagraph(),
      
      // Draft date
      createCenteredParagraph('Draft Date', fontOpts),
      
      // Large spacing to push contact info to bottom
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      createCenteredParagraph(),
      
      // Contact details - left aligned at bottom
      createLeftParagraph('Your Contact Information:', fontOpts),
      createLeftParagraph('Email Address', fontOpts),
      createLeftParagraph('Phone Number', fontOpts),
    ]
  }
}

interface PanelWidths {
  leftSidebarWidth?: number
  rightSidebarWidth?: number
  bottomPanelHeight?: number
  storyboardPanelWidth?: number
}

interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

interface AppPreferences {
  lastOpenedProjectPath?: string
  recentProjects: RecentProject[]
  livingDocuments: LivingDocument[]
  agendaItems: AgendaItem[]
  theme: 'dark' | 'light'
  panelWidths?: PanelWidths
  windowBounds?: WindowBounds
}

export class ProjectStore {
  private store: Store<AppPreferences>

  constructor() {
    this.store = new Store<AppPreferences>({
      name: 'cadmus-preferences',
      defaults: {
        recentProjects: [],
        livingDocuments: [],
        agendaItems: [],
        theme: 'dark'
      }
    })
    
    // Migrate recentProjects to livingDocuments on first run
    this.migrateRecentToLiving()
  }
  
  /**
   * Migrate existing recentProjects to livingDocuments (one-time migration)
   */
  private migrateRecentToLiving(): void {
    const living = this.store.get('livingDocuments') || []
    const recent = this.store.get('recentProjects') || []
    
    // Only migrate if livingDocuments is empty but recentProjects has data
    if (living.length === 0 && recent.length > 0) {
      const now = new Date().toISOString()
      const migrated: LivingDocument[] = recent.map(p => ({
        projectPath: p.path,
        projectName: p.name,
        templateId: p.templateId,
        state: 'active' as DocumentLifecycleState,
        lastStateChange: now,
        lastOpened: now
      }))
      this.store.set('livingDocuments', migrated)
    }
  }

  // Project operations
  async createProject(template: Template, name: string, basePath: string): Promise<Project> {
    const projectId = uuidv4()
    const projectPath = join(basePath, name)
    const now = new Date().toISOString()

    // Create project directory structure
    await fs.mkdir(projectPath, { recursive: true })
    await fs.mkdir(join(projectPath, 'documents'), { recursive: true })
    await fs.mkdir(join(projectPath, 'assets'), { recursive: true })
    await fs.mkdir(join(projectPath, '.build'), { recursive: true })

    // Create folders from template
    for (const folder of template.defaultStructure.folders) {
      await fs.mkdir(join(projectPath, 'documents', folder.path), { recursive: true })
    }

    // Create documents from template
    const documents: ProjectDocument[] = []
    const defaultFontFamily = template.settings.formattingRules.defaultFontFamily
    
    // Track the title page ID for screenplay templates (to set as parent for other docs)
    let screenplayTitlePageId: string | undefined
    
    for (let i = 0; i < template.defaultStructure.documents.length; i++) {
      const docTemplate = template.defaultStructure.documents[i]
      const docId = uuidv4()
      
      // For screenplay title page, use project name as document title
      const isTitlePage = template.id === 'screenplay' && docTemplate.title === 'Title Page'
      const docTitle = isTitlePage ? name.toUpperCase() : docTemplate.title
      
      // Track the title page ID
      if (isTitlePage) {
        screenplayTitlePageId = docId
      }
      
      // For screenplay templates, non-title-page documents should be children of the title page
      const parentId = (template.id === 'screenplay' && !isTitlePage && screenplayTitlePageId) 
        ? screenplayTitlePageId 
        : undefined
      
      const doc: ProjectDocument = {
        id: docId,
        path: docTemplate.path,
        title: docTitle,
        order: i,
        type: 'document',
        parentId,
        createdAt: now,
        updatedAt: now
      }
      documents.push(doc)

      // Determine initial content based on template and document type
      let initialContent: JSONContent
      
      // Special case: Screenplay template Title Page
      if (template.id === 'screenplay' && docTemplate.title === 'Title Page' && defaultFontFamily) {
        initialContent = createScreenplayTitlePageContent(defaultFontFamily, name)
      } else if (template.id === 'screenplay' && docTemplate.title !== 'Title Page') {
        // Screenplay pages (not title page) - default to scene heading element
        initialContent = {
          type: 'doc',
          content: [
            {
              type: 'screenplayElement',
              attrs: { elementType: 'scene-heading' }
            }
          ]
        }
      } else {
        // Default: simple heading + empty paragraph
        const titleTextNode: { type: string; text: string; marks?: { type: string; attrs: { fontFamily: string } }[] } = {
          type: 'text',
          text: docTemplate.title
        }
        
        if (defaultFontFamily) {
          titleTextNode.marks = [{ type: 'textStyle', attrs: { fontFamily: defaultFontFamily } }]
        }
        
        initialContent = {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [titleTextNode]
            },
            {
              type: 'paragraph'
            }
          ]
        }
      }
      
      const docFilePath = join(projectPath, 'documents', docTemplate.path)
      await fs.mkdir(join(docFilePath, '..'), { recursive: true }).catch(() => {})
      await fs.writeFile(docFilePath, JSON.stringify(initialContent, null, 2))
    }

    // Create project manifest
    const project: Project = {
      id: projectId,
      name,
      templateId: template.id,
      path: projectPath,
      createdAt: now,
      updatedAt: now,
      documents,
      assets: [],
      characters: [], // For screenplay character bank
      settings: { ...template.settings },
      buildProfiles: [
        {
          id: uuidv4(),
          name: 'Default',
          includedDocumentIds: documents.map(d => d.id),
          exportFormats: ['html', 'pdf']
        }
      ]
    }

    await fs.writeFile(
      join(projectPath, 'project.json'),
      JSON.stringify(project, null, 2)
    )

    // Update recent projects
    this.addToRecentProjects(projectPath, name, template.id)

    return project
  }

  async openProject(projectPath: string): Promise<Project> {
    const manifestPath = join(projectPath, 'project.json')
    const content = await fs.readFile(manifestPath, 'utf-8')
    const project: Project = JSON.parse(content)
    project.path = projectPath // Ensure path is current
    
    // Ensure characters array exists (backwards compatibility)
    if (!project.characters) {
      project.characters = []
    }
    
    this.addToRecentProjects(projectPath, project.name, project.templateId)
    
    return project
  }

  async importProject(sourcePath: string, destinationBasePath: string): Promise<Project> {
    // Validate source has a project.json
    const sourceManifestPath = join(sourcePath, 'project.json')
    let sourceContent: string
    try {
      sourceContent = await fs.readFile(sourceManifestPath, 'utf-8')
    } catch {
      throw new Error('Invalid Cadmus project: no project.json found in the selected folder')
    }

    const sourceProject: Project = JSON.parse(sourceContent)

    // Determine target folder name, handle conflicts
    let targetName = sourceProject.name || basename(sourcePath)
    let targetPath = join(destinationBasePath, targetName)
    let suffix = 1
    while (true) {
      try {
        await fs.access(targetPath)
        // Path exists, try with suffix
        suffix++
        targetPath = join(destinationBasePath, `${targetName} (${suffix})`)
      } catch {
        // Path doesn't exist, we can use it
        break
      }
    }

    // Deep copy the entire project directory
    await fs.cp(sourcePath, targetPath, { recursive: true })

    // Update the project.json with the new path
    const project: Project = { ...sourceProject, path: targetPath }
    const newManifestPath = join(targetPath, 'project.json')
    await fs.writeFile(newManifestPath, JSON.stringify(project, null, 2))

    // Ensure backwards compatibility
    if (!project.characters) {
      project.characters = []
    }

    // Register in recent projects and living documents
    this.addToRecentProjects(targetPath, project.name, project.templateId)

    return project
  }

  async exportProject(projectPath: string, destinationBasePath: string): Promise<string> {
    // Read the source project
    const sourceManifestPath = join(projectPath, 'project.json')
    const sourceContent = await fs.readFile(sourceManifestPath, 'utf-8')
    const sourceProject: Project = JSON.parse(sourceContent)

    // Determine target folder name, handle conflicts
    let targetName = sourceProject.name || basename(projectPath)
    let targetPath = join(destinationBasePath, targetName)
    let suffix = 1
    while (true) {
      try {
        await fs.access(targetPath)
        suffix++
        targetPath = join(destinationBasePath, `${targetName} (${suffix})`)
      } catch {
        break
      }
    }

    // Deep copy the entire project directory
    await fs.cp(projectPath, targetPath, { recursive: true })

    return targetPath
  }

  async saveProject(project: Project): Promise<void> {
    const manifestPath = join(project.path, 'project.json')
    project.updatedAt = new Date().toISOString()
    await fs.writeFile(manifestPath, JSON.stringify(project, null, 2))
  }

  // Document operations
  async createDocument(
    projectPath: string, 
    doc: Omit<ProjectDocument, 'createdAt' | 'updatedAt'>,
    defaultFontFamily?: string,
    templateId?: string,
    screenplayDocType?: 'title-page' | 'page' | 'break'
  ): Promise<ProjectDocument> {
    const now = new Date().toISOString()
    const fullDoc: ProjectDocument = {
      ...doc,
      createdAt: now,
      updatedAt: now
    }

    if (doc.type === 'document') {
      let initialContent: JSONContent
      
      // For screenplay templates
      if (templateId === 'screenplay') {
        const fontFamily = defaultFontFamily || 'Courier New, Courier, monospace'
        
        // Notes get plain content, not screenplay format
        if (doc.isNote) {
          initialContent = {
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: doc.title }]
              },
              {
                type: 'paragraph'
              }
            ]
          }
        } else if (screenplayDocType === 'title-page') {
          // Create title page format
          initialContent = createScreenplayTitlePageContent(fontFamily, doc.title)
        } else if (screenplayDocType === 'break') {
          // Create break (Act) format
          initialContent = createScreenplayBreakContent(fontFamily, doc.title)
        } else if (doc.useJournalToolbar) {
          // Plain document with journal-style toolbar (basic documents in screenplay projects)
          initialContent = {
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: doc.title }]
              },
              {
                type: 'paragraph'
              }
            ]
          }
        } else {
          // Default to scene heading format for regular pages
          initialContent = {
            type: 'doc',
            content: [
              {
                type: 'screenplayElement',
                attrs: { elementType: 'scene-heading' }
              }
            ]
          }
        }
      } else {
        // Create document file with optional default font
        const titleTextNode: { type: string; text: string; marks?: { type: string; attrs: { fontFamily: string } }[] } = {
          type: 'text',
          text: doc.title
        }
        
        if (defaultFontFamily) {
          titleTextNode.marks = [{ type: 'textStyle', attrs: { fontFamily: defaultFontFamily } }]
        }
        
        initialContent = {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [titleTextNode]
            },
            {
              type: 'paragraph'
            }
          ]
        }
      }
      
      const docFilePath = join(projectPath, 'documents', doc.path)
      await fs.mkdir(join(docFilePath, '..'), { recursive: true }).catch(() => {})
      await fs.writeFile(docFilePath, JSON.stringify(initialContent, null, 2))
    } else {
      // Create folder
      await fs.mkdir(join(projectPath, 'documents', doc.path), { recursive: true })
    }

    return fullDoc
  }

  async saveDocument(projectPath: string, docId: string, content: JSONContent): Promise<void> {
    // Load project to get document path
    const project = await this.openProject(projectPath)
    const doc = project.documents.find(d => d.id === docId)
    if (!doc) throw new Error(`Document ${docId} not found`)

    const docFilePath = join(projectPath, 'documents', doc.path)
    await fs.writeFile(docFilePath, JSON.stringify(content, null, 2))

    // Update document timestamp
    doc.updatedAt = new Date().toISOString()
    await this.saveProject(project)
  }

  async loadDocument(projectPath: string, docId: string): Promise<JSONContent> {
    const project = await this.openProject(projectPath)
    const doc = project.documents.find(d => d.id === docId)
    if (!doc) throw new Error(`Document ${docId} not found`)

    const docFilePath = join(projectPath, 'documents', doc.path)
    const content = await fs.readFile(docFilePath, 'utf-8')
    return JSON.parse(content)
  }

  async deleteDocument(projectPath: string, docId: string): Promise<void> {
    const project = await this.openProject(projectPath)
    const docIndex = project.documents.findIndex(d => d.id === docId)
    if (docIndex === -1) throw new Error(`Document ${docId} not found`)

    const doc = project.documents[docIndex]
    
    if (doc.type === 'document') {
      const docFilePath = join(projectPath, 'documents', doc.path)
      await fs.unlink(docFilePath).catch(() => {})
    } else {
      const folderPath = join(projectPath, 'documents', doc.path)
      await fs.rm(folderPath, { recursive: true, force: true }).catch(() => {})
    }

    project.documents.splice(docIndex, 1)
    await this.saveProject(project)
    
    // Remove any associated agenda item for the deleted document
    this.removeAgendaItem(projectPath, docId)
  }

  // Asset operations
  async uploadAsset(projectPath: string, filePath: string, fileName: string): Promise<Asset> {
    const assetId = uuidv4()
    const ext = extname(fileName)
    const assetFileName = `${assetId}${ext}`
    const assetPath = join(projectPath, 'assets', assetFileName)

    // Copy file to assets folder
    await fs.copyFile(filePath, assetPath)

    // Get file stats
    const stats = await fs.stat(assetPath)

    // Determine asset type
    const type = this.getAssetType(ext)

    const asset: Asset = {
      id: assetId,
      path: `assets/${assetFileName}`,
      name: fileName,
      type,
      mimeType: this.getMimeType(ext),
      size: stats.size,
      createdAt: new Date().toISOString(),
      references: []
    }

    // Update project manifest
    const project = await this.openProject(projectPath)
    project.assets.push(asset)
    await this.saveProject(project)

    return asset
  }

  async uploadAssetFromBuffer(projectPath: string, buffer: ArrayBuffer, fileName: string, mimeType: string): Promise<Asset> {
    const assetId = uuidv4()
    const ext = extname(fileName)
    const assetFileName = `${assetId}${ext}`
    const assetPath = join(projectPath, 'assets', assetFileName)

    // Write buffer to assets folder
    await fs.writeFile(assetPath, Buffer.from(buffer))

    // Determine asset type
    const type = this.getAssetType(ext)

    const asset: Asset = {
      id: assetId,
      path: `assets/${assetFileName}`,
      name: fileName,
      type,
      mimeType: mimeType || this.getMimeType(ext),
      size: buffer.byteLength,
      createdAt: new Date().toISOString(),
      references: []
    }

    // Update project manifest
    const project = await this.openProject(projectPath)
    project.assets.push(asset)
    await this.saveProject(project)

    return asset
  }

  async deleteAsset(projectPath: string, assetId: string): Promise<void> {
    const project = await this.openProject(projectPath)
    const assetIndex = project.assets.findIndex(a => a.id === assetId)
    if (assetIndex === -1) throw new Error(`Asset ${assetId} not found`)

    const asset = project.assets[assetIndex]
    const assetFilePath = join(projectPath, asset.path)
    
    await fs.unlink(assetFilePath).catch(() => {})
    project.assets.splice(assetIndex, 1)
    await this.saveProject(project)
  }

  getAssetPath(projectPath: string, assetId: string): string {
    return join(projectPath, 'assets', assetId)
  }

  // Update asset references and persist to project.json
  async updateAssetReferences(projectPath: string, assetId: string, references: AssetReference[]): Promise<void> {
    const project = await this.openProject(projectPath)
    const assetIndex = project.assets.findIndex(a => a.id === assetId)
    if (assetIndex === -1) throw new Error(`Asset ${assetId} not found`)

    project.assets[assetIndex].references = references
    await this.saveProject(project)
  }

  // Bulk update all asset references (more efficient for syncing)
  async syncAllAssetReferences(projectPath: string, assetReferences: Record<string, AssetReference[]>): Promise<void> {
    const project = await this.openProject(projectPath)
    
    for (const asset of project.assets) {
      if (assetReferences[asset.id]) {
        asset.references = assetReferences[asset.id]
      }
    }
    
    await this.saveProject(project)
  }

  // Preferences
  getLastOpenedProjectPath(): string | null {
    return this.store.get('lastOpenedProjectPath') || null
  }

  setLastOpenedProjectPath(path: string): void {
    this.store.set('lastOpenedProjectPath', path)
  }

  private addToRecentProjects(projectPath: string, projectName: string, templateId?: string): void {
    const recent = this.store.get('recentProjects') || []
    const filtered = recent.filter(p => p.path !== projectPath)
    filtered.unshift({ name: projectName, path: projectPath, templateId })
    this.store.set('recentProjects', filtered.slice(0, 10))
    this.store.set('lastOpenedProjectPath', projectPath)
    
    // Also add to living documents
    this.addToLivingDocuments(projectPath, projectName, templateId)
  }

  async getRecentProjects(): Promise<RecentProject[]> {
    const recent = this.store.get('recentProjects') || []
    const validProjects: RecentProject[] = []
    
    for (const project of recent) {
      try {
        // Check if the project.json file exists and read it
        const manifestPath = join(project.path, 'project.json')
        const content = await fs.readFile(manifestPath, 'utf-8')
        const projectData = JSON.parse(content)
        
        // Use stored templateId or read from project file
        validProjects.push({
          name: project.name,
          path: project.path,
          templateId: project.templateId || projectData.templateId
        })
      } catch {
        // Project no longer exists, skip it
      }
    }
    
    // Update store with only valid projects if any were removed or updated
    if (validProjects.length !== recent.length || 
        validProjects.some((p, i) => p.templateId !== recent[i]?.templateId)) {
      this.store.set('recentProjects', validProjects)
    }
    
    return validProjects
  }

  removeFromRecentProjects(projectPath: string): void {
    const recent = this.store.get('recentProjects') || []
    const filtered = recent.filter(p => p.path !== projectPath)
    this.store.set('recentProjects', filtered)
  }

  // Living document operations
  
  /**
   * Add or update a project in living documents when opened/created
   */
  private addToLivingDocuments(projectPath: string, projectName: string, templateId?: string): void {
    const living = this.store.get('livingDocuments') || []
    const now = new Date().toISOString()
    
    // Check if project already exists
    const existingIndex = living.findIndex(p => p.projectPath === projectPath)
    
    if (existingIndex !== -1) {
      // Update existing entry - preserve state, update lastOpened
      living[existingIndex] = {
        ...living[existingIndex],
        projectName,
        templateId,
        lastOpened: now
      }
    } else {
      // Add new entry as active
      living.unshift({
        projectPath,
        projectName,
        templateId,
        state: 'active',
        lastStateChange: now,
        lastOpened: now
      })
    }
    
    // Keep up to 50 living documents
    this.store.set('livingDocuments', living.slice(0, 50))
  }

  /**
   * Get all living documents with validation
   */
  async getLivingDocuments(): Promise<LivingDocument[]> {
    const living = this.store.get('livingDocuments') || []
    const validDocuments: LivingDocument[] = []
    
    for (const doc of living) {
      try {
        // Check if the project.json file exists and read it
        const manifestPath = join(doc.projectPath, 'project.json')
        const content = await fs.readFile(manifestPath, 'utf-8')
        const projectData = JSON.parse(content)
        
        // Update with latest project name and templateId
        validDocuments.push({
          ...doc,
          projectName: projectData.name || doc.projectName,
          templateId: doc.templateId || projectData.templateId
        })
      } catch {
        // Project no longer exists, skip it
      }
    }
    
    // Update store with only valid documents if any were removed
    if (validDocuments.length !== living.length) {
      this.store.set('livingDocuments', validDocuments)
    }
    
    return validDocuments
  }

  /**
   * Update a living document's state
   */
  updateLivingDocumentState(projectPath: string, state: DocumentLifecycleState, stateNote?: string): void {
    const living = this.store.get('livingDocuments') || []
    const index = living.findIndex(p => p.projectPath === projectPath)
    
    if (index !== -1) {
      living[index] = {
        ...living[index],
        state,
        stateNote: stateNote || undefined, // Clear note if not provided
        lastStateChange: new Date().toISOString()
      }
      this.store.set('livingDocuments', living)
    }
  }

  /**
   * Remove a project from living documents
   */
  removeLivingDocument(projectPath: string): void {
    const living = this.store.get('livingDocuments') || []
    const filtered = living.filter(p => p.projectPath !== projectPath)
    this.store.set('livingDocuments', filtered)
  }

  // Version history operations
  
  /**
   * Get the path to a document's versions file
   */
  private getVersionsFilePath(projectPath: string, docId: string): string {
    return join(projectPath, 'documents', `${docId}.versions.json`)
  }

  /**
   * Count words in JSONContent
   */
  private countWordsInContent(content: JSONContent): number {
    let wordCount = 0
    
    const traverse = (node: JSONContent) => {
      if (node.type === 'text' && node.text) {
        // Split by whitespace and count non-empty parts
        wordCount += node.text.split(/\s+/).filter(Boolean).length
      }
      if (node.content) {
        node.content.forEach(traverse)
      }
    }
    
    traverse(content)
    return wordCount
  }

  /**
   * Save a new version snapshot of a document
   */
  async saveVersion(projectPath: string, docId: string, content: JSONContent, label?: string): Promise<DocumentVersion> {
    const versionsPath = this.getVersionsFilePath(projectPath, docId)
    
    // Load existing versions or create empty array
    let versions: DocumentVersion[] = []
    try {
      const existing = await fs.readFile(versionsPath, 'utf-8')
      versions = JSON.parse(existing)
    } catch {
      // File doesn't exist yet, start fresh
    }

    // Create new version
    const version: DocumentVersion = {
      id: uuidv4(),
      documentId: docId,
      timestamp: new Date().toISOString(),
      label,
      content,
      wordCount: this.countWordsInContent(content)
    }

    // Add to beginning (newest first)
    versions.unshift(version)

    // Save versions file
    await fs.writeFile(versionsPath, JSON.stringify(versions, null, 2))

    return version
  }

  /**
   * Load all versions for a document
   */
  async loadVersions(projectPath: string, docId: string): Promise<DocumentVersion[]> {
    const versionsPath = this.getVersionsFilePath(projectPath, docId)
    
    try {
      const content = await fs.readFile(versionsPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      // No versions file exists
      return []
    }
  }

  /**
   * Delete a specific version
   */
  async deleteVersion(projectPath: string, docId: string, versionId: string): Promise<void> {
    const versionsPath = this.getVersionsFilePath(projectPath, docId)
    
    try {
      const content = await fs.readFile(versionsPath, 'utf-8')
      let versions: DocumentVersion[] = JSON.parse(content)
      
      versions = versions.filter(v => v.id !== versionId)
      
      if (versions.length === 0) {
        // Remove file if no versions left
        await fs.unlink(versionsPath).catch(() => {})
      } else {
        await fs.writeFile(versionsPath, JSON.stringify(versions, null, 2))
      }
    } catch {
      // No versions file exists, nothing to delete
    }
  }

  // Agenda item operations (for NotesJournal todo tracking)

  /**
   * Extract todos from TipTap JSONContent
   */
  private extractTodosFromContent(content: JSONContent): TodoItem[] {
    const todos: TodoItem[] = []
    let todoIndex = 0
    
    const traverse = (node: JSONContent) => {
      // Look for taskItem nodes
      if (node.type === 'taskItem') {
        const checked = node.attrs?.checked === true
        // Extract text from the taskItem
        let text = ''
        if (node.content) {
          const extractText = (n: JSONContent): string => {
            if (n.type === 'text' && n.text) return n.text
            if (n.content) return n.content.map(extractText).join('')
            return ''
          }
          text = node.content.map(extractText).join('').trim()
        }
        
        if (text) {
          todos.push({
            id: `todo-${todoIndex++}`,
            text,
            checked
          })
        }
      }
      
      // Recursively traverse children
      if (node.content) {
        for (const child of node.content) {
          traverse(child)
        }
      }
    }
    
    traverse(content)
    return todos
  }

  /**
   * Update the checked state of a todo in document content
   */
  private updateTodoInContent(content: JSONContent, todoId: string, checked: boolean): JSONContent {
    let todoIndex = 0
    
    const traverse = (node: JSONContent): JSONContent => {
      if (node.type === 'taskItem') {
        const currentId = `todo-${todoIndex++}`
        if (currentId === todoId) {
          return {
            ...node,
            attrs: { ...node.attrs, checked }
          }
        }
      }
      
      if (node.content) {
        return {
          ...node,
          content: node.content.map(traverse)
        }
      }
      
      return node
    }
    
    return traverse(content)
  }

  /**
   * Mark all todos as done in document content
   */
  private markAllTodosInContent(content: JSONContent): JSONContent {
    const traverse = (node: JSONContent): JSONContent => {
      if (node.type === 'taskItem') {
        return {
          ...node,
          attrs: { ...node.attrs, checked: true }
        }
      }
      
      if (node.content) {
        return {
          ...node,
          content: node.content.map(traverse)
        }
      }
      
      return node
    }
    
    return traverse(content)
  }

  /**
   * Get all agenda items with validation
   */
  async getAgendaItems(): Promise<AgendaItem[]> {
    const items = this.store.get('agendaItems') || []
    const validItems: AgendaItem[] = []
    
    for (const item of items) {
      try {
        // Check if the project.json file exists and document is still in project
        const manifestPath = join(item.projectPath, 'project.json')
        const manifestContent = await fs.readFile(manifestPath, 'utf-8')
        const project = JSON.parse(manifestContent) as Project
        
        // Verify the document still exists in the project
        const docExists = project.documents.some(d => d.id === item.documentId)
        if (docExists) {
          validItems.push(item)
        }
      } catch {
        // Project no longer exists, skip it
      }
    }
    
    // Update store with only valid items if any were removed
    if (validItems.length !== items.length) {
      this.store.set('agendaItems', validItems)
    }
    
    return validItems
  }

  /**
   * Update or create an agenda item for a document
   */
  updateAgendaItem(
    projectPath: string, 
    documentId: string, 
    documentTitle: string,
    projectName: string,
    templateId: TemplateId,
    todos: TodoItem[]
  ): void {
    const items = this.store.get('agendaItems') || []
    const now = new Date().toISOString()
    
    // Find existing item for this document
    const existingIndex = items.findIndex(
      item => item.projectPath === projectPath && item.documentId === documentId
    )
    
    if (todos.length === 0) {
      // If no todos, remove the agenda item if it exists
      if (existingIndex !== -1) {
        items.splice(existingIndex, 1)
        this.store.set('agendaItems', items)
      }
      return
    }
    
    if (existingIndex !== -1) {
      // Update existing item
      items[existingIndex] = {
        ...items[existingIndex],
        documentTitle,
        projectName,
        todos,
        lastUpdated: now
      }
    } else {
      // Add new item
      items.unshift({
        projectPath,
        projectName,
        templateId,
        documentId,
        documentTitle,
        todos,
        state: 'active',
        lastUpdated: now
      })
    }
    
    // Keep up to 100 agenda items
    this.store.set('agendaItems', items.slice(0, 100))
  }

  /**
   * Update an agenda item's state
   */
  updateAgendaState(
    projectPath: string, 
    documentId: string, 
    state: DocumentLifecycleState, 
    stateNote?: string
  ): void {
    const items = this.store.get('agendaItems') || []
    const index = items.findIndex(
      item => item.projectPath === projectPath && item.documentId === documentId
    )
    
    if (index !== -1) {
      items[index] = {
        ...items[index],
        state,
        stateNote: stateNote || undefined,
        lastUpdated: new Date().toISOString()
      }
      this.store.set('agendaItems', items)
    }
  }

  /**
   * Remove an agenda item
   */
  removeAgendaItem(projectPath: string, documentId: string): void {
    const items = this.store.get('agendaItems') || []
    const filtered = items.filter(
      item => !(item.projectPath === projectPath && item.documentId === documentId)
    )
    this.store.set('agendaItems', filtered)
  }

  /**
   * Toggle a specific todo's checked state and update document
   */
  async toggleTodo(projectPath: string, documentId: string, todoId: string, checked: boolean): Promise<void> {
    // Load document content
    const content = await this.loadDocument(projectPath, documentId)
    
    // Update the todo in content
    const updatedContent = this.updateTodoInContent(content, todoId, checked)
    
    // Save the document
    await this.saveDocument(projectPath, documentId, updatedContent)
    
    // Update agenda items
    const items = this.store.get('agendaItems') || []
    const index = items.findIndex(
      item => item.projectPath === projectPath && item.documentId === documentId
    )
    
    if (index !== -1) {
      const todoIndex = items[index].todos.findIndex(t => t.id === todoId)
      if (todoIndex !== -1) {
        items[index].todos[todoIndex].checked = checked
        items[index].lastUpdated = new Date().toISOString()
        this.store.set('agendaItems', items)
      }
    }
  }

  /**
   * Mark all todos as done in a document
   */
  async markAllTodosDone(projectPath: string, documentId: string): Promise<void> {
    // Load document content
    const content = await this.loadDocument(projectPath, documentId)
    
    // Mark all todos as done
    const updatedContent = this.markAllTodosInContent(content)
    
    // Save the document
    await this.saveDocument(projectPath, documentId, updatedContent)
    
    // Update agenda items
    const items = this.store.get('agendaItems') || []
    const index = items.findIndex(
      item => item.projectPath === projectPath && item.documentId === documentId
    )
    
    if (index !== -1) {
      items[index].todos = items[index].todos.map(t => ({ ...t, checked: true }))
      items[index].lastUpdated = new Date().toISOString()
      this.store.set('agendaItems', items)
    }
  }

  /**
   * Sync todos from document content to agenda items
   */
  async syncDocumentTodos(
    projectPath: string, 
    documentId: string,
    documentTitle: string,
    projectName: string,
    templateId: TemplateId,
    content: JSONContent
  ): Promise<TodoItem[]> {
    const todos = this.extractTodosFromContent(content)
    this.updateAgendaItem(projectPath, documentId, documentTitle, projectName, templateId, todos)
    return todos
  }

  // Theme methods
  getTheme(): 'dark' | 'light' {
    return this.store.get('theme') || 'dark'
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.store.set('theme', theme)
  }

  // Zoom methods
  getZoom(): number {
    return this.store.get('viewZoom') || 100
  }

  setZoom(zoom: number): void {
    this.store.set('viewZoom', zoom)
  }

  // Interface scale methods (whole-app zoom via webContents)
  getInterfaceScale(): number {
    return this.store.get('interfaceScale') || 100
  }

  setInterfaceScale(scale: number): void {
    this.store.set('interfaceScale', scale)
  }

  // Panel width methods
  getPanelWidths(): PanelWidths {
    return this.store.get('panelWidths') || {}
  }

  setPanelWidths(widths: PanelWidths): void {
    const current = this.store.get('panelWidths') || {}
    this.store.set('panelWidths', { ...current, ...widths })
  }

  // Window bounds methods
  getWindowBounds(): WindowBounds | undefined {
    return this.store.get('windowBounds')
  }

  setWindowBounds(bounds: WindowBounds): void {
    this.store.set('windowBounds', bounds)
  }

  private getAssetType(ext: string): AssetType {
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
    const pdfExts = ['.pdf']
    
    if (imageExts.includes(ext.toLowerCase())) return 'image'
    if (pdfExts.includes(ext.toLowerCase())) return 'pdf'
    return 'other'
  }

  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf'
    }
    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream'
  }
}
