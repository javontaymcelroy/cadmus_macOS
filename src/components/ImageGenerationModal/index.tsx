/**
 * ImageGenerationModal
 * 
 * Modal dialog for configuring and generating storyboard images via OpenAI.
 * Allows users to:
 * - Edit the prompt template
 * - Select image style and dimensions
 * - Configure API key
 * - Preview selected text, surrounding context, and mentions
 * - Toggle reference images for style consistency
 * - Generate images
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { clsx } from 'clsx'
import type { ImageStyle, ImageSize } from '../../types/project'
import {
  DismissRegular,
  ImageSparkleRegular,
  SettingsRegular,
  ChevronDownRegular,
  ChevronUpRegular,
  KeyRegular,
  ArrowSyncRegular,
  ErrorCircleRegular,
  InfoRegular,
  ImageMultipleRegular,
  PersonRegular,
  PersonAddRegular,
} from '@fluentui/react-icons'
import { buildContextSection, formatSurroundingContext, contentToPlainText } from '../../utils/selectionUtils'
import { DEFAULT_PROMPT_TEMPLATE, SIZE_OPTIONS } from '../../../shared/imageGenerationPrompts'

// Style options with display names
const STYLE_OPTIONS: { value: ImageStyle; label: string; description: string }[] = [
  { value: 'storyboard-sketch', label: 'Storyboard Sketch', description: 'Hand-drawn black & white sketch style' },
  { value: 'cinematic', label: 'Cinematic', description: 'Film noir influenced, strong contrast' },
  { value: 'toon-boom', label: 'Toon Boom Style', description: 'Clean animation storyboard style' },
  { value: 'custom', label: 'Custom', description: 'Use prompt as-is without style modifiers' },
]

export function ImageGenerationModal() {
  const {
    imageGenerationModal,
    closeImageGenerationModal,
    currentProject,
    documents,
    addAssetFromBuffer,
    updateProjectSettings,
  } = useProjectStore()

  const { isOpen, selectedText, mentions, surroundingContext } = imageGenerationModal

  // Settings state
  const [hasApiKey, setHasApiKey] = useState(false)
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_PROMPT_TEMPLATE)
  const [customInstructions, setCustomInstructions] = useState('')
  const [style, setStyle] = useState<ImageStyle>('storyboard-sketch')
  const [size, setSize] = useState<ImageSize>('1536x1024')
  const [includeContext, setIncludeContext] = useState(true)
  const [includeSurroundingContext, setIncludeSurroundingContext] = useState(true)
  const [useReferenceImages, setUseReferenceImages] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showSurroundingContext, setShowSurroundingContext] = useState(false)
  
  // Manually added characters for context
  const [additionalCharacterIds, setAdditionalCharacterIds] = useState<string[]>([])

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generationProgress, setGenerationProgress] = useState<string>('')

  // Load settings on mount
  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  const loadSettings = async () => {
    try {
      const settings = await window.api.imageGeneration.getSettings()
      // Load prompt from project settings if available, otherwise use default
      const projectCustomPrompt = currentProject?.settings?.customImagePromptTemplate
      setPromptTemplate(projectCustomPrompt || DEFAULT_PROMPT_TEMPLATE)
      // Load custom instructions from project settings
      setCustomInstructions(currentProject?.settings?.customImageInstructions || '')
      setStyle(settings.defaultStyle || 'storyboard-sketch')
      setSize(settings.defaultSize || '1536x1024')
      setUseReferenceImages(settings.useReferenceImages ?? true)
      
      const hasKey = await window.api.imageGeneration.hasApiKey()
      setHasApiKey(hasKey)
    } catch (err) {
      console.error('Failed to load image generation settings:', err)
    }
  }

  // Use mentions for character/prop context
  const mentionsToUse = includeContext ? mentions : []

  // Build context section from mentions
  const contextSection = useMemo(() => {
    if (!includeContext || mentionsToUse.length === 0) return ''
    
    const characters = currentProject?.characters || []
    const props = currentProject?.props || []
    
    // Convert documents state to the format expected by buildContextSection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docsWithContent: Record<string, { content: any }> = {}
    for (const [docId, docState] of Object.entries(documents)) {
      docsWithContent[docId] = { content: docState.content }
    }
    
    return buildContextSection(mentionsToUse, characters, props, docsWithContent)
  }, [mentionsToUse, includeContext, currentProject, documents])

  // Format the surrounding context for the prompt
  const formattedSurroundingContext = useMemo(() => {
    if (!includeSurroundingContext || !surroundingContext) return ''
    return formatSurroundingContext(surroundingContext)
  }, [includeSurroundingContext, surroundingContext])

  // Check if we have meaningful surrounding context to show
  const hasSurroundingContext = surroundingContext && (
    surroundingContext.sceneHeading ||
    surroundingContext.recentCharacters.length > 0 ||
    surroundingContext.resolvedPronouns.length > 0 ||
    surroundingContext.precedingAction
  )

  // Build context for manually added characters
  const additionalCharacterContext = useMemo(() => {
    if (additionalCharacterIds.length === 0) return ''
    
    const characters = currentProject?.characters || []
    const lines: string[] = ['ADDITIONAL CHARACTER CONTEXT (manually added):']
    
    for (const charId of additionalCharacterIds) {
      const char = characters.find(c => c.id === charId)
      if (!char) continue
      
      let description = ''
      // Get note content if available
      if (char.noteDocumentId) {
        const docState = documents[char.noteDocumentId]
        if (docState?.content) {
          const noteText = contentToPlainText(docState.content)
          // Truncate if too long
          description = noteText.length > 500 
            ? noteText.substring(0, 500) + '...'
            : noteText
        }
      }
      
      if (description) {
        lines.push(`- ${char.name}: ${description}`)
      } else {
        lines.push(`- ${char.name}: (No description in character notes)`)
      }
    }
    
    return lines.join('\n')
  }, [additionalCharacterIds, currentProject, documents])

  // Get characters available to add (not already in auto-detected context or manually added)
  const availableCharactersToAdd = useMemo(() => {
    const characters = currentProject?.characters || []
    const autoDetectedIds = new Set(
      surroundingContext?.recentCharacters.map(c => c.id).filter(Boolean) || []
    )
    const mentionIds = new Set(mentions.map(m => m.id))
    const addedIds = new Set(additionalCharacterIds)
    
    return characters.filter(c => 
      !autoDetectedIds.has(c.id) && 
      !mentionIds.has(c.id) && 
      !addedIds.has(c.id)
    )
  }, [currentProject, surroundingContext, mentions, additionalCharacterIds])

  const handleSaveSettings = async () => {
    try {
      // Save prompt and custom instructions to project settings (per-project)
      await updateProjectSettings({
        customImagePromptTemplate: promptTemplate,
        customImageInstructions: customInstructions,
      })
      // Save other settings globally via electron-store
      await window.api.imageGeneration.setSettings({
        defaultStyle: style,
        defaultSize: size,
        useReferenceImages,
      })
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  const handleGenerate = async () => {
    if (!hasApiKey) {
      setError('OpenAI API key not configured. Please add your API key in the Settings section on the welcome screen.')
      return
    }

    if (!selectedText.trim()) {
      setError('No text selected')
      return
    }

    if (!currentProject) {
      setError('No project open')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGenerationProgress('Preparing request...')

    try {
      // Save current settings
      await handleSaveSettings()

      const modelInfo = useReferenceImages ? 'GPT-Image with storyboard style' : 'GPT-Image (minimal style)'
      setGenerationProgress(`Generating storyboard sketch with ${modelInfo}...`)
      
      // Build the final prompt (combine all context sources)
      const combinedContext = [
        contextSection,                    // From @mentions in selection
        formattedSurroundingContext,       // Auto-detected from script
        additionalCharacterContext         // Manually added characters
      ]
        .filter(Boolean)
        .join('\n\n')
      
      // Build the prompt with template
      let finalPrompt = await window.api.imageGeneration.buildPrompt(
        selectedText,
        combinedContext,
        promptTemplate
      )
      
      // Append custom instructions if provided (these are "non-negotiables")
      if (customInstructions.trim()) {
        finalPrompt = `${finalPrompt}\n\nCRITICAL INSTRUCTIONS (must follow):\n${customInstructions.trim()}`
      }

      // Generate the image
      const result = await window.api.imageGeneration.generate(finalPrompt, {
        style,
        size,
        projectPath: currentProject.path,
        useReferenceImages,
      })

      if (!result.success) {
        throw new Error(result.error || 'Image generation failed')
      }

      if (!result.imageData) {
        throw new Error('No image data returned')
      }

      setGenerationProgress('Saving to storyboard assets...')

      // Save the image as a storyboard asset
      const timestamp = Date.now()
      const fileName = `storyboard_${timestamp}.png`
      
      await addAssetFromBuffer(
        result.imageData,
        fileName,
        'image/png',
        'storyboard'
      )

      setGenerationProgress('Complete!')
      
      // Close modal after short delay to show success
      setTimeout(() => {
        closeImageGenerationModal()
      }, 1000)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      setGenerationProgress('')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClose = useCallback(() => {
    if (!isGenerating) {
      closeImageGenerationModal()
    }
  }, [isGenerating, closeImageGenerationModal])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isGenerating) {
      handleClose()
    }
  }, [handleClose, isGenerating])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
    >
      <div 
        className="bg-ink-900 border border-white/[0.08] rounded-xl shadow-2xl w-[640px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ImageSparkleRegular className="w-5 h-5 text-gold-400" />
            <h3 className="text-sm font-ui font-semibold text-white/90">Generate Storyboard Image</h3>
          </div>
          <button
            onClick={handleClose}
            disabled={isGenerating}
            className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          >
            <DismissRegular className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* API Key Warning */}
          {!hasApiKey && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <KeyRegular className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-amber-200 font-ui">
                    OpenAI API key required
                  </p>
                  <p className="text-xs text-amber-200/60 font-ui mt-1">
                    Please configure your API key in the Settings section on the welcome screen (close the project to access it).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Selected Text Preview */}
          <div>
            <label className="block text-xs font-ui font-medium text-white/50 mb-1.5">
              Selected Text to Illustrate
            </label>
            <div className="bg-black/30 rounded-lg p-3 border border-white/[0.06]">
              <p className="text-sm text-white/80 font-serif whitespace-pre-wrap line-clamp-4">
                {selectedText || '(No text selected)'}
              </p>
            </div>
          </div>

          {/* Mentions Context */}
          {mentionsToUse.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-ui font-medium text-white/50">
                  Character/Prop Context ({mentionsToUse.length} mention{mentionsToUse.length !== 1 ? 's' : ''})
                </label>
                <label className="flex items-center gap-1.5 text-xs font-ui text-white/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeContext}
                    onChange={e => setIncludeContext(e.target.checked)}
                    className="rounded border-white/20 bg-black/30 text-gold-400 focus:ring-gold-400/50"
                  />
                  Include in prompt
                </label>
              </div>
              <div className="bg-black/30 rounded-lg p-3 border border-white/[0.06]">
                <div className="flex flex-wrap gap-1.5">
                  {mentionsToUse.map((mention: { type: string; label: string }, idx: number) => (
                    <span
                      key={idx}
                      className={clsx(
                        'px-2 py-0.5 rounded text-xs font-ui',
                        mention.type === 'character'
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-amber-500/20 text-amber-300'
                      )}
                    >
                      @{mention.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Surrounding Script Context - Auto-extracted from screenplay */}
          {hasSurroundingContext && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <PersonRegular className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-purple-200 font-ui font-medium">
                    Script Context (Auto-detected)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-ui text-purple-200/70 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSurroundingContext}
                      onChange={e => setIncludeSurroundingContext(e.target.checked)}
                      className="rounded border-purple-500/30 bg-black/30 text-purple-400 focus:ring-purple-400/50"
                    />
                    Include
                  </label>
                  <button
                    onClick={() => setShowSurroundingContext(!showSurroundingContext)}
                    className="text-xs text-purple-300/70 hover:text-purple-200 font-ui flex items-center gap-1"
                  >
                    {showSurroundingContext ? (
                      <>Hide <ChevronUpRegular className="w-3 h-3" /></>
                    ) : (
                      <>Show <ChevronDownRegular className="w-3 h-3" /></>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Summary badges */}
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {surroundingContext?.sceneHeading && (
                  <span className="px-2 py-0.5 rounded text-xs font-ui bg-purple-500/20 text-purple-300">
                    Scene: {surroundingContext.sceneHeading.length > 30 
                      ? surroundingContext.sceneHeading.substring(0, 30) + '...' 
                      : surroundingContext.sceneHeading}
                  </span>
                )}
                {surroundingContext?.recentCharacters.map((char, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded text-xs font-ui bg-blue-500/20 text-blue-300"
                  >
                    {char.name}
                    {char.introductionText && ' (with description)'}
                  </span>
                ))}
                {surroundingContext?.resolvedPronouns.map((rp, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded text-xs font-ui bg-amber-500/20 text-amber-300"
                  >
                    "{rp.pronoun}" = {rp.resolvedTo}
                  </span>
                ))}
              </div>
              
              {/* Expanded details */}
              {showSurroundingContext && (
                <div className="px-3 pb-3 border-t border-purple-500/20">
                  <pre className="mt-2 text-xs text-purple-200/70 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {formattedSurroundingContext || '(No context extracted)'}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Manual Character Picker */}
          {currentProject && currentProject.characters.length > 0 && (
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <PersonAddRegular className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-cyan-200 font-ui font-medium">
                  Add Character Context
                </span>
              </div>
              <p className="text-xs text-cyan-200/60 font-ui mb-2">
                Manually add characters to provide visual descriptions to the AI, even if they aren't mentioned in the selected text.
              </p>
              
              {/* Character selector dropdown */}
              {availableCharactersToAdd.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <select
                    className="flex-1 px-2 py-1.5 rounded bg-black/30 border border-cyan-500/30 text-sm text-white/90 font-ui focus:outline-none focus:border-cyan-400/50"
                    defaultValue=""
                    onChange={e => {
                      if (e.target.value) {
                        setAdditionalCharacterIds(prev => [...prev, e.target.value])
                        e.target.value = '' // Reset selection
                      }
                    }}
                  >
                    <option value="">Select a character to add...</option>
                    {availableCharactersToAdd.map(char => (
                      <option key={char.id} value={char.id}>
                        {char.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Display added characters as removable badges */}
              {additionalCharacterIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {additionalCharacterIds.map(charId => {
                    const char = currentProject.characters.find(c => c.id === charId)
                    if (!char) return null
                    return (
                      <span
                        key={charId}
                        className="px-2 py-0.5 rounded text-xs font-ui bg-cyan-500/20 text-cyan-300 flex items-center gap-1"
                      >
                        @{char.name}
                        <button
                          onClick={() => setAdditionalCharacterIds(prev => prev.filter(id => id !== charId))}
                          className="hover:text-white ml-0.5"
                          title="Remove"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
              
              {availableCharactersToAdd.length === 0 && additionalCharacterIds.length === 0 && (
                <p className="text-xs text-cyan-200/40 font-ui italic">
                  All characters are already included in context
                </p>
              )}
            </div>
          )}

          {/* Style & Size Options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-ui font-medium text-white/50 mb-1.5">
                Image Style
              </label>
              <select
                value={style}
                onChange={e => setStyle(e.target.value as ImageStyle)}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white/90 font-ui focus:outline-none focus:border-gold-400/50"
              >
                {STYLE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-white/30 font-ui mt-1">
                {STYLE_OPTIONS.find(o => o.value === style)?.description}
              </p>
            </div>
            <div>
              <label className="block text-xs font-ui font-medium text-white/50 mb-1.5">
                Image Dimensions
              </label>
              <select
                value={size}
                onChange={e => setSize(e.target.value as ImageSize)}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white/90 font-ui focus:outline-none focus:border-gold-400/50"
              >
                {SIZE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-white/30 font-ui mt-1">
                {SIZE_OPTIONS.find(o => o.value === size)?.aspect}
              </p>
            </div>
          </div>

          {/* Storyboard Style Toggle */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="useReferenceImages"
                checked={useReferenceImages}
                onChange={e => setUseReferenceImages(e.target.checked)}
                className="mt-0.5 rounded border-white/20 bg-black/30 text-emerald-400 focus:ring-emerald-400/50"
              />
              <div className="flex-1">
                <label htmlFor="useReferenceImages" className="flex items-center gap-2 text-sm text-emerald-200 font-ui font-medium cursor-pointer">
                  <ImageMultipleRegular className="w-4 h-4" />
                  Apply storyboard sketch style
                </label>
                <p className="text-xs text-emerald-200/60 font-ui mt-1">
                  When enabled, appends detailed storyboard style instructions (monochrome, marker linework, grey tones) to ensure consistent visual aesthetic.
                </p>
              </div>
            </div>
          </div>

          {/* Custom Instructions (Non-negotiables) */}
          <div>
            <label className="block text-xs font-ui font-medium text-white/50 mb-1.5">
              Custom Instructions <span className="text-white/30">(applies to all generations)</span>
            </label>
            <textarea
              value={customInstructions}
              onChange={e => setCustomInstructions(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white/80 font-ui resize-none focus:outline-none focus:border-gold-400/50"
              placeholder="Add rules the AI must always follow, e.g.:&#10;- Characters behind objects should be partially obscured&#10;- All characters are anthropomorphic animals&#10;- Maintain proper depth and layering"
            />
            <p className="text-[10px] text-white/30 font-ui mt-1">
              These instructions are always included at the end of every prompt as critical/non-negotiable rules.
            </p>
          </div>

          {/* Advanced Settings (Collapsible) */}
          <div className="border border-white/[0.06] rounded-lg overflow-hidden">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-ui text-white/70 hover:text-white/90 hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-2">
                <SettingsRegular className="w-4 h-4" />
                <span>Advanced Settings</span>
              </div>
              {showSettings ? (
                <ChevronUpRegular className="w-4 h-4" />
              ) : (
                <ChevronDownRegular className="w-4 h-4" />
              )}
            </button>
            
            {showSettings && (
              <div className="px-3 pb-3 pt-1 border-t border-white/[0.06]">
                <label className="block text-xs font-ui font-medium text-white/50 mb-1.5">
                  Prompt Template
                </label>
                <textarea
                  value={promptTemplate}
                  onChange={e => setPromptTemplate(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-xs text-white/80 font-mono resize-none focus:outline-none focus:border-gold-400/50"
                  placeholder="Enter your custom prompt template..."
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-white/30 font-ui">
                    Variables: <code className="text-gold-400/80">{'${selectedText}'}</code>,{' '}
                    <code className="text-gold-400/80">{'${contextSection}'}</code>,{' '}
                    <code className="text-gold-400/80">{'${surroundingContext}'}</code>
                  </p>
                  <button
                    onClick={async () => {
                      setPromptTemplate(DEFAULT_PROMPT_TEMPLATE)
                      // Clear custom prompt from project settings (reset to code default)
                      await updateProjectSettings({ customImagePromptTemplate: undefined })
                    }}
                    className="text-[10px] text-white/40 hover:text-gold-400 font-ui underline flex-shrink-0 ml-2"
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <ErrorCircleRegular className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-200 font-ui">{error}</p>
              </div>
            </div>
          )}

          {/* Generation Progress */}
          {isGenerating && generationProgress && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <ArrowSyncRegular className="w-4 h-4 text-blue-400 animate-spin" />
                <p className="text-sm text-blue-200 font-ui">{generationProgress}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 text-[10px] text-white/30 font-ui">
            <InfoRegular className="w-3 h-3" />
            <span>Images are saved to Storyboard Assets</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              disabled={isGenerating}
              className="px-3 py-1.5 rounded-lg text-sm font-ui text-white/60 hover:text-white/90 hover:bg-white/[0.06] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedText.trim()}
              className={clsx(
                'px-4 py-1.5 rounded-lg text-sm font-ui font-medium flex items-center gap-2 transition-colors',
                isGenerating || !selectedText.trim()
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-gold-400 text-ink-900 hover:bg-gold-300'
              )}
            >
              {isGenerating ? (
                <>
                  <ArrowSyncRegular className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ImageSparkleRegular className="w-4 h-4" />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
