import { useState, useEffect, useMemo } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { templates } from '../../workspaces'
import type { Template, LivingDocument, DocumentLifecycleState, AgendaItem } from '../../types/project'
import { TemplateCard } from './TemplateCard'
import { RecentProjectCard } from './RecentProjectCard'
import { AgendaItemCard } from './AgendaItemCard'
import { AgendaProjectStack } from './AgendaProjectStack'
import { LivingDocumentWithAgenda } from './LivingDocumentWithAgenda'
import {
  DocumentRegular,
  NotebookRegular,
  EditRegular,
  VideoRegular,
  HatGraduationRegular,
  FolderRegular,
  DocumentTextRegular,
  FolderOpenRegular,
  ChevronLeftRegular,
  FilterRegular,
  ChevronDownRegular,
  TaskListLtrRegular,
  SettingsRegular,
  KeyRegular,
  CheckmarkCircleRegular,
  ChevronUpRegular
} from '@fluentui/react-icons'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  document: DocumentRegular,
  notebook: NotebookRegular,
  edit: EditRegular,
  video: VideoRegular,
  academic: HatGraduationRegular
}

// Filter options for living documents
type FilterOption = 'all' | 'active' | 'paused' | 'review' | 'completed'

const filterLabels: Record<FilterOption, string> = {
  all: 'All Active',
  active: 'Active (WIP)',
  paused: 'Paused',
  review: 'Ready for Review',
  completed: 'Completed'
}

// State priority for sorting (lower = higher priority)
const statePriority: Record<DocumentLifecycleState, number> = {
  active: 0,
  paused: 1,
  review: 2,
  completed: 3,
  archived: 4
}

export function TemplatePicker() {
  const { 
    createProject, 
    openProject, 
    isLoading, 
    error,
    agendaItems,
    toggleAgendaTodo,
    markAllAgendaTodosDone,
    updateAgendaItemState,
    removeAgendaItem
  } = useProjectStore()
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [projectName, setProjectName] = useState('')
  const [projectPath, setProjectPath] = useState('')
  const [step, setStep] = useState<'select' | 'configure'>('select')
  const [livingDocuments, setLivingDocuments] = useState<LivingDocument[]>([])
  const [filter, setFilter] = useState<FilterOption>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  
  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)

  // Load living documents on mount
  useEffect(() => {
    const loadLiving = async () => {
      try {
        const docs = await window.api.project.getLivingDocuments()
        setLivingDocuments(docs)
      } catch {
        setLivingDocuments([])
      }
    }
    loadLiving()
  }, [])

  // Check for existing API key on mount
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const hasKey = await window.api.imageGeneration.hasApiKey()
        setHasApiKey(hasKey)
      } catch {
        setHasApiKey(false)
      }
    }
    checkApiKey()
  }, [])

  // Save API key handler
  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return
    
    setApiKeySaving(true)
    setApiKeyError(null)
    
    try {
      await window.api.imageGeneration.setSettings({ apiKey: apiKey.trim() })
      setHasApiKey(true)
      setApiKey('')
      setApiKeyError(null)
    } catch (err) {
      setApiKeyError('Failed to save API key')
    } finally {
      setApiKeySaving(false)
    }
  }
  
  // Filter agenda items to show only non-archived ones
  const visibleAgendaItems = useMemo(() => {
    return agendaItems.filter(item => item.state !== 'archived')
  }, [agendaItems])

  // Group agenda items by project for stacked card display
  const groupedAgendaItems = useMemo(() => {
    const groups = new Map<string, AgendaItem[]>()
    for (const item of visibleAgendaItems) {
      const existing = groups.get(item.projectPath) || []
      existing.push(item)
      groups.set(item.projectPath, existing)
    }
    return Array.from(groups.entries()).map(([projectPath, items]) => ({
      projectPath,
      projectName: items[0].projectName,
      items
    }))
  }, [visibleAgendaItems])

  // Filter and sort living documents
  const filteredDocuments = useMemo(() => {
    let filtered = livingDocuments

    // Apply filter
    if (filter === 'all') {
      // "All Active" shows everything except archived
      filtered = livingDocuments.filter(d => d.state !== 'archived')
    } else if (filter === 'completed') {
      // Show completed and archived
      filtered = livingDocuments.filter(d => d.state === 'completed' || d.state === 'archived')
    } else {
      filtered = livingDocuments.filter(d => d.state === filter)
    }

    // Sort by state priority, then by lastOpened
    return filtered.sort((a, b) => {
      const priorityDiff = statePriority[a.state] - statePriority[b.state]
      if (priorityDiff !== 0) return priorityDiff
      // Within same state, sort by lastOpened (most recent first)
      return new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()
    })
  }, [livingDocuments, filter])

  // Combine living documents with their agenda items
  const documentsWithAgenda = useMemo(() => {
    return filteredDocuments.map(doc => ({
      document: doc,
      agendaItems: visibleAgendaItems.filter(item => item.projectPath === doc.projectPath)
    }))
  }, [filteredDocuments, visibleAgendaItems])

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template)
    setProjectName('')
    setStep('configure')
  }

  const handleBack = () => {
    setStep('select')
    setSelectedTemplate(null)
  }

  const handleSelectFolder = async () => {
    const path = await window.api.dialog.selectFolder()
    if (path) {
      setProjectPath(path)
    }
  }

  const handleOpenProject = async () => {
    const path = await window.api.dialog.selectFolder()
    if (path) {
      await openProject(path)
    }
  }

  const handleOpenLivingDocument = async (path: string) => {
    await openProject(path)
  }

  const handleDeleteLivingDocument = async (path: string) => {
    // Move project folder to Trash and remove from living documents list
    const result = await window.api.project.moveToTrash(path)
    if (result.success) {
      // Update local state
      setLivingDocuments(prev => prev.filter(p => p.projectPath !== path))
    } else {
      console.error('Failed to delete project:', result.error)
    }
  }

  const handleRenameLivingDocument = (path: string, newName: string) => {
    // Update local state (name is just display, actual folder name stays the same)
    setLivingDocuments(prev => prev.map(p => 
      p.projectPath === path ? { ...p, projectName: newName } : p
    ))
  }

  const handleStateChange = async (path: string, state: DocumentLifecycleState, note?: string) => {
    try {
      await window.api.project.updateLivingDocument(path, state, note)
      // Update local state
      setLivingDocuments(prev => prev.map(p => 
        p.projectPath === path 
          ? { ...p, state, stateNote: note, lastStateChange: new Date().toISOString() } 
          : p
      ))
    } catch (err) {
      console.error('Failed to update document state:', err)
    }
  }

  const handleCreate = async () => {
    if (!selectedTemplate || !projectName.trim() || !projectPath) return
    await createProject(selectedTemplate, projectName.trim(), projectPath)
  }

  // Agenda item handlers
  const handleOpenAgendaItem = async (item: AgendaItem) => {
    await openProject(item.projectPath)
  }

  const handleRenameAgendaItem = (item: AgendaItem, newTitle: string) => {
    // Renaming would require updating the document title, which is more complex
    // For now, we'll just log it - this could be enhanced later
    console.log('Rename agenda item:', item.documentId, 'to', newTitle)
  }

  const handleDeleteAgendaItem = async (item: AgendaItem) => {
    await removeAgendaItem(item.projectPath, item.documentId)
  }

  const handleAgendaStateChange = async (item: AgendaItem, state: DocumentLifecycleState, note?: string) => {
    await updateAgendaItemState(item.projectPath, item.documentId, state, note)
  }

  const handleToggleAgendaTodo = async (item: AgendaItem, todoId: string, checked: boolean) => {
    await toggleAgendaTodo(item.projectPath, item.documentId, todoId, checked)
  }

  const handleMarkAllAgendaTodosDone = async (item: AgendaItem) => {
    await markAllAgendaTodosDone(item.projectPath, item.documentId)
  }

  const canCreate = selectedTemplate && projectName.trim() && projectPath

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Header with macOS title bar space */}
      <div className="h-12 flex items-center justify-center titlebar-drag-region toolbar-modern">
        <h1 className="text-sm font-ui font-medium text-theme-muted">Cadmus</h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center p-6 lg:p-8 overflow-auto">
        <div className="w-full max-w-6xl animate-fade-in flex-1 flex flex-col">
          {step === 'select' ? (
            <div className="flex flex-col justify-center flex-1">
              {/* Living Documents Section - only shown if there are documents */}
              {livingDocuments.length > 0 && (
                <div className="mb-12">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-base font-ui font-medium text-theme-primary uppercase tracking-wider">
                      Living Documents
                    </h2>
                    
                    {/* Filter dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setFilterOpen(!filterOpen)}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-ui text-theme-secondary hover:text-theme-primary bg-theme-hover border border-theme-subtle rounded-lg transition-colors"
                      >
                        <FilterRegular className="w-3.5 h-3.5" />
                        {filterLabels[filter]}
                        <ChevronDownRegular className={`w-3 h-3 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {filterOpen && (
                        <div className="absolute right-0 mt-1 w-44 py-1 rounded-lg border border-theme-default bg-theme-elevated backdrop-blur-sm shadow-xl z-50">
                          {(Object.keys(filterLabels) as FilterOption[]).map((option) => (
                            <button
                              key={option}
                              onClick={() => {
                                setFilter(option)
                                setFilterOpen(false)
                              }}
                              className={`w-full px-3 py-2 text-left text-sm font-ui transition-colors ${
                                filter === option ? 'text-theme-primary bg-theme-active' : 'text-theme-secondary hover:bg-theme-hover'
                              }`}
                            >
                              {filterLabels[option]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Min height keeps UI consistent between states */}
                  <div className="min-h-[168px]">
                    {documentsWithAgenda.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-start">
                        {documentsWithAgenda.map(({ document: doc, agendaItems: docAgendaItems }, index) => (
                          <LivingDocumentWithAgenda
                            key={doc.projectPath}
                            document={doc}
                            agendaItems={docAgendaItems}
                            onOpenProject={() => handleOpenLivingDocument(doc.projectPath)}
                            onRenameProject={(newName) => handleRenameLivingDocument(doc.projectPath, newName)}
                            onDeleteProject={() => handleDeleteLivingDocument(doc.projectPath)}
                            onStateChange={(state, note) => handleStateChange(doc.projectPath, state, note)}
                            onOpenAgendaItem={(item) => handleOpenAgendaItem(item)}
                            onRenameAgendaItem={(item, newTitle) => handleRenameAgendaItem(item, newTitle)}
                            onDeleteAgendaItem={(item) => handleDeleteAgendaItem(item)}
                            onAgendaStateChange={(item, state, note) => handleAgendaStateChange(item, state, note)}
                            onToggleAgendaTodo={(item, todoId, checked) => handleToggleAgendaTodo(item, todoId, checked)}
                            onMarkAllAgendaTodosDone={(item) => handleMarkAllAgendaTodosDone(item)}
                            delay={index * 0.03}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-theme-muted font-ui">
                        No projects match the current filter.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Workspaces section header */}
              <h2 className="text-base font-ui font-medium text-theme-primary uppercase tracking-wider mb-6">
                Workspaces
              </h2>

                {/* Template grid - 3 columns max */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {templates.map((template, index) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onClick={() => handleSelectTemplate(template)}
                      delay={index * 0.05}
                    />
                  ))}
                </div>

              {/* Open Project button when no living documents */}
              {livingDocuments.length === 0 && (
                <div className="mt-12 text-center">
                  <button
                    onClick={handleOpenProject}
                    className="btn-secondary-modern inline-flex items-center gap-2 text-sm"
                  >
                    <FolderOpenRegular className="w-4 h-4" />
                    Open Existing Project...
                  </button>
                </div>
              )}
            </div>
            ) : (
              <div className="flex flex-col justify-center min-h-full">
                {/* Configuration step */}
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 text-theme-muted hover:text-theme-primary font-ui text-sm mb-8 transition-all duration-300"
                >
                  <ChevronLeftRegular className="w-4 h-4" />
                  Back to templates
                </button>

                <div className="flex gap-12 items-stretch">
                  {/* Selected template preview */}
                  <div className="w-80 shrink-0">
                    {selectedTemplate && (
                      <div className="p-6 bg-theme-hover border border-theme-subtle rounded-2xl h-full">
                        <div className="template-icon-container mb-6">
                          {(() => {
                            const IconComponent = iconMap[selectedTemplate.icon] || DocumentRegular
                            return <IconComponent className="w-6 h-6 text-theme-secondary" />
                          })()}
                        </div>
                        <h3 className="text-xl font-ui font-medium text-theme-primary mb-2">
                          {selectedTemplate.name}
                        </h3>
                        <p className="text-sm text-theme-secondary font-ui mb-6 leading-relaxed">
                          {selectedTemplate.description}
                        </p>
                        
                        <div className="space-y-5">
                          <div>
                            <h4 className="text-xs font-ui font-medium text-theme-muted uppercase tracking-wider mb-3">
                              Enabled Passes
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedTemplate.enabledPasses.map(pass => (
                                <span
                                  key={pass}
                                  className="px-2.5 py-1 bg-theme-active border border-theme-subtle rounded-md text-xs font-ui text-theme-secondary"
                                >
                                  {pass.replace(/-/g, ' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-xs font-ui font-medium text-theme-muted uppercase tracking-wider mb-3">
                              Default Structure
                            </h4>
                            <ul className="text-sm text-theme-secondary font-ui space-y-2">
                              {selectedTemplate.defaultStructure.folders.map(f => (
                                <li key={f.path} className="flex items-center gap-2">
                                  <FolderRegular className="w-4 h-4 text-theme-muted" />
                                  {f.name}/
                                </li>
                              ))}
                              {selectedTemplate.defaultStructure.documents.map(d => (
                                <li key={d.path} className="flex items-center gap-2">
                                  <DocumentTextRegular className="w-4 h-4 text-theme-muted" />
                                  {d.title}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Configuration form */}
                  <div className="flex-1 max-w-lg flex flex-col">
                    <h2 className="text-2xl font-ui font-light text-theme-primary mb-8">
                      Configure Your Project
                    </h2>

                    <div className="space-y-6 flex-1">
                      <div>
                        <label className="block text-sm font-ui font-medium text-theme-secondary mb-2">
                          Project Name
                        </label>
                        <input
                          type="text"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          placeholder="My Writing Project"
                          className="input-modern w-full text-lg"
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-ui font-medium text-theme-secondary mb-2">
                          Location
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={projectPath}
                            readOnly
                            placeholder="Select a folder..."
                            className="input-modern flex-1 text-theme-muted"
                          />
                          <button
                            onClick={handleSelectFolder}
                            className="btn-secondary-modern whitespace-nowrap"
                          >
                            Browse...
                          </button>
                        </div>
                        {projectPath && (
                          <p className="text-xs text-theme-muted mt-3 font-mono">
                            Project will be created at: {projectPath}/{projectName || 'project-name'}
                          </p>
                        )}
                      </div>

                      {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                          <p className="text-sm text-red-400">{error}</p>
                        </div>
                      )}
                    </div>

                      <button
                        onClick={handleCreate}
                        disabled={!canCreate || isLoading}
                      className="w-full py-3 text-base mt-auto bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Creating...
                          </span>
                        ) : (
                          'Create Project'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
            )}
        </div>
      </div>

      {/* Settings Section */}
      <div className="border-t border-theme-subtle bg-theme-hover/50">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full px-6 py-3 flex items-center justify-between text-sm font-ui text-theme-secondary hover:text-theme-primary transition-colors"
        >
          <div className="flex items-center gap-2">
            <SettingsRegular className="w-4 h-4" />
            <span>Settings</span>
            {hasApiKey && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckmarkCircleRegular className="w-3.5 h-3.5" />
                API Key configured
              </span>
            )}
          </div>
          {settingsOpen ? (
            <ChevronDownRegular className="w-4 h-4" />
          ) : (
            <ChevronUpRegular className="w-4 h-4" />
          )}
        </button>
        
        {settingsOpen && (
          <div className="px-6 pb-4 space-y-4">
            {/* OpenAI API Key */}
            <div className="p-4 bg-theme-active border border-theme-subtle rounded-xl">
              <div className="flex items-start gap-3">
                <KeyRegular className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-ui font-medium text-theme-primary mb-1">
                    OpenAI API Key
                  </h3>
                  <p className="text-xs text-theme-secondary mb-3">
                    Required for AI-powered features like image generation and writing suggestions.
                    Your API key is stored securely on your device and never sent to our servers.
                  </p>
                  
                  {hasApiKey ? (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 font-ui">
                        API key configured
                      </div>
                      <button
                        onClick={() => setHasApiKey(false)}
                        className="px-3 py-2 rounded-lg text-sm font-ui text-theme-secondary hover:text-theme-primary bg-theme-hover border border-theme-subtle transition-colors"
                      >
                        Update
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white/90 font-mono placeholder:text-white/30 focus:outline-none focus:border-amber-400/50"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && apiKey.trim()) {
                            handleSaveApiKey()
                          }
                        }}
                      />
                      <button
                        onClick={handleSaveApiKey}
                        disabled={!apiKey.trim() || apiKeySaving}
                        className={`px-4 py-2 rounded-lg text-sm font-ui font-medium transition-colors ${
                          apiKey.trim() && !apiKeySaving
                            ? 'bg-amber-500 text-black hover:bg-amber-400'
                            : 'bg-white/10 text-white/30 cursor-not-allowed'
                        }`}
                      >
                        {apiKeySaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}
                  
                  {apiKeyError && (
                    <p className="mt-2 text-xs text-red-400">{apiKeyError}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="h-8 flex items-center justify-center statusbar-modern">
        <p className="text-xs text-theme-muted font-ui">
          Cadmus — An IDE for writers
        </p>
      </div>
    </div>
  )
}
