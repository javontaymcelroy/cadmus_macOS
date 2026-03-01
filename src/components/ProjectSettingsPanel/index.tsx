import { useState, useRef, useEffect } from 'react'
import { clsx } from 'clsx'
import { ArrowResetRegular, CheckmarkRegular, DismissRegular, ChevronDownRegular } from '@fluentui/react-icons'
import { useProjectStore } from '../../stores/projectStore'
import { FONT_FAMILIES } from '../../workspaces/shared/extensions/FontFamily'
import { SLASH_COMMANDS_GENERATE, SLASH_COMMANDS_SELECTION, SLASH_COMMANDS_SELECTION_GENERAL } from '../../workspaces/shared/extensions/SlashCommand'
import type { FormattingRules, HeadingTypography } from '../../types/project'

// Interface scale steps
const INTERFACE_SCALE_STEPS = [75, 80, 90, 100, 110, 125, 150]

// Color presets for the pickers
const COLOR_PRESETS = [
  { name: 'Default', value: '' },
  { name: 'White', value: '#ffffff' },
  { name: 'Light Gray', value: '#a3a3a3' },
  { name: 'Gold', value: '#fbbf24' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Lime', value: '#84cc16' },
]

// Section definitions for sidebar navigation
export const SETTINGS_SECTIONS = [
  { id: 'body', label: 'Body Text' },
  { id: 'h1', label: 'Heading 1' },
  { id: 'h2', label: 'Heading 2' },
  { id: 'h3', label: 'Heading 3' },
  { id: 'layout', label: 'Layout' },
  { id: 'aiPrompts', label: 'AI Prompts' },
] as const

// Setting row component
function SettingRow({ label, description, children }: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-theme-primary">{label}</div>
        {description && (
          <div className="text-xs text-theme-muted mt-0.5">{description}</div>
        )}
      </div>
      <div className="shrink-0">
        {children}
      </div>
    </div>
  )
}

// Number input with stepper
function NumberStepper({ value, onChange, min, max, step, unit, width = 'w-24' }: {
  value: number | undefined
  onChange: (val: number | undefined) => void
  min: number
  max: number
  step: number
  unit?: string
  width?: string
}) {
  const displayValue = value ?? ''

  return (
    <div className="flex items-center gap-1">
      {unit && <span className="text-xs text-theme-muted mr-1">{unit}</span>}
      <button
        onClick={() => {
          const current = value ?? min
          const next = Math.max(min, +(current - step).toFixed(2))
          onChange(next)
        }}
        className="btn-icon-modern p-1 text-xs"
        title="Decrease"
      >
        -
      </button>
      <input
        type="number"
        value={displayValue}
        onChange={(e) => {
          const val = e.target.value === '' ? undefined : parseFloat(e.target.value)
          if (val === undefined) {
            onChange(undefined)
          } else if (!isNaN(val) && val >= min && val <= max) {
            onChange(+(val.toFixed(2)))
          }
        }}
        min={min}
        max={max}
        step={step}
        placeholder="Default"
        className={clsx('input-modern text-center text-sm py-1.5 px-2', width)}
      />
      <button
        onClick={() => {
          const current = value ?? min
          const next = Math.min(max, +(current + step).toFixed(2))
          onChange(next)
        }}
        className="btn-icon-modern p-1 text-xs"
        title="Increase"
      >
        +
      </button>
    </div>
  )
}

// Color picker with presets
function ColorPicker({ value, onChange, label }: {
  value: string | undefined
  onChange: (val: string | undefined) => void
  label: string
}) {
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!showPicker) return
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPicker])

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-theme-subtle hover:bg-theme-hover transition-colors"
      >
        <div
          className="w-4 h-4 rounded-sm border border-theme-subtle"
          style={{ backgroundColor: value || 'var(--text-primary)' }}
        />
        <span className="text-xs text-theme-secondary font-mono">
          {value || 'Default'}
        </span>
      </button>

      {showPicker && (
        <div className="absolute right-0 top-full mt-1 z-20 p-3 rounded-lg border border-theme-default bg-theme-elevated shadow-xl min-w-[200px]">
          <div className="grid grid-cols-6 gap-1.5 mb-3">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value || 'default'}
                onClick={() => {
                  onChange(preset.value || undefined)
                  setShowPicker(false)
                }}
                title={preset.name}
                className={clsx(
                  'w-6 h-6 rounded-sm border transition-transform hover:scale-110',
                  (value || '') === preset.value
                    ? 'ring-2 ring-gold-400 border-gold-400'
                    : 'border-theme-subtle'
                )}
                style={{
                  backgroundColor: preset.value || 'var(--text-primary)',
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-theme-muted">Custom:</span>
            <input
              type="color"
              value={value || '#ffffff'}
              onChange={(e) => onChange(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Reusable heading section component
function HeadingSection({ level, label, values, onUpdate }: {
  level: 'h1' | 'h2' | 'h3'
  label: string
  values: HeadingTypography | undefined
  onUpdate: (partial: Partial<HeadingTypography>) => void
}) {
  return (
    <section id={`settings-${level}`}>
      <h3 className="text-xs font-ui font-semibold text-theme-accent uppercase tracking-wider mb-2">
        {label}
      </h3>
      <div className="divide-y divide-theme-subtle">
        <SettingRow label="Font Family">
          <select
            value={values?.fontFamily ?? ''}
            onChange={(e) => onUpdate({ fontFamily: e.target.value || undefined })}
            className="input-modern text-sm py-1.5 px-3 w-48"
          >
            <option value="">Same as Body</option>
            {FONT_FAMILIES.map((font) => (
              <option key={font.value} value={font.value}>
                {font.name}
              </option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label="Font Size">
          <NumberStepper
            value={values?.fontSize}
            onChange={(val) => onUpdate({ fontSize: val })}
            min={1}
            max={4}
            step={0.125}
            unit="rem"
          />
        </SettingRow>

        <SettingRow label="Color">
          <ColorPicker
            value={values?.color}
            onChange={(val) => onUpdate({ color: val })}
            label={`${label} Color`}
          />
        </SettingRow>
      </div>
    </section>
  )
}

// Helper to pick only the editable formatting fields from FormattingRules
type EditableFields = Pick<FormattingRules,
  'defaultFontFamily' | 'defaultFontSize' | 'defaultLineHeight' |
  'paragraphSpacing' | 'editorPaddingX' | 'editorMaxWidth' |
  'textColor' | 'headingColor' |
  'h1' | 'h2' | 'h3'
>

function getEditableFields(rules: FormattingRules): EditableFields {
  return {
    defaultFontFamily: rules.defaultFontFamily,
    defaultFontSize: rules.defaultFontSize,
    defaultLineHeight: rules.defaultLineHeight,
    paragraphSpacing: rules.paragraphSpacing,
    editorPaddingX: rules.editorPaddingX,
    editorMaxWidth: rules.editorMaxWidth,
    textColor: rules.textColor,
    headingColor: rules.headingColor,
    h1: rules.h1,
    h2: rules.h2,
    h3: rules.h3,
  }
}

function hasChanges(a: EditableFields, b: EditableFields): boolean {
  return JSON.stringify(a) !== JSON.stringify(b)
}

// Commands to exclude from the prompt editor (user-driven, not customizable)
const EXCLUDED_COMMANDS = new Set(['customPrompt', 'ask'])

// Get unique, non-gated, non-excluded commands for prompt editing
function getEditableCommands(isScreenplay: boolean) {
  const selectionCommands = isScreenplay ? SLASH_COMMANDS_SELECTION : SLASH_COMMANDS_SELECTION_GENERAL
  const allCommands = [...SLASH_COMMANDS_GENERATE, ...selectionCommands]
  const seen = new Set<string>()
  return allCommands.filter(cmd => {
    if (seen.has(cmd.id) || cmd.gated || EXCLUDED_COMMANDS.has(cmd.id)) return false
    seen.add(cmd.id)
    return true
  })
}

export function ProjectSettingsPanel() {
  const { currentProject, updateProjectSettings, setSettingsPanelOpen } = useProjectStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  const rules = currentProject?.settings?.formattingRules
  if (!currentProject || !rules) return null

  const isScreenplay = currentProject.templateId === 'screenplay'

  // Local draft state - changes are buffered here until Save
  const [draft, setDraft] = useState<EditableFields>(() => getEditableFields(rules))

  // Separate draft for target runtime (lives on ProjectSettings, not FormattingRules)
  const [draftTargetRuntime, setDraftTargetRuntime] = useState<number | undefined>(
    currentProject.settings.targetRuntimeMinutes
  )

  // Draft state for custom AI prompts
  const [draftCustomPrompts, setDraftCustomPrompts] = useState<Record<string, string>>(
    () => {
      const prompts: Record<string, string> = {}
      const saved = currentProject.settings.customAIPrompts
      if (saved) {
        for (const [key, val] of Object.entries(saved)) {
          if (val !== undefined) prompts[key] = val
        }
      }
      return prompts
    }
  )

  // Default instruction text fetched from the AI service
  const [defaultInstructions, setDefaultInstructions] = useState<{ prose: Record<string, string>; screenplay: Record<string, string> } | null>(null)

  // Expanded prompt editor state
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null)

  // Fetch default instructions on mount
  useEffect(() => {
    window.api.aiWriting.getDefaultInstructions().then(setDefaultInstructions).catch(() => {})
  }, [])

  // Interface scale state (applied immediately, not part of the save/cancel flow)
  const [interfaceScale, setInterfaceScale] = useState(100)

  // Load interface scale on mount
  useEffect(() => {
    window.api.interfaceScale?.get().then((scale: number) => {
      if (scale >= 75 && scale <= 150) {
        setInterfaceScale(scale)
      }
    }).catch(() => {})
  }, [])

  const handleInterfaceScaleChange = (newScale: number) => {
    setInterfaceScale(newScale)
    window.api.interfaceScale?.set(newScale)
  }

  // Track whether we have unsaved changes
  const customPromptsChanged = JSON.stringify(draftCustomPrompts) !== JSON.stringify(currentProject.settings.customAIPrompts || {})
  const dirty = hasChanges(draft, getEditableFields(rules))
    || draftTargetRuntime !== currentProject.settings.targetRuntimeMinutes
    || customPromptsChanged

  const updateDraft = (partial: Partial<EditableFields>) => {
    setDraft(prev => ({ ...prev, ...partial }))
  }

  const updateHeadingDraft = (level: 'h1' | 'h2' | 'h3', partial: Partial<HeadingTypography>) => {
    setDraft(prev => ({
      ...prev,
      [level]: { ...prev[level], ...partial }
    }))
  }

  const handleUpdatePrompt = (commandId: string, text: string | undefined) => {
    setDraftCustomPrompts(prev => {
      if (text === undefined) {
        const next = { ...prev }
        delete next[commandId]
        return next
      }
      return { ...prev, [commandId]: text }
    })
  }

  const handleSave = () => {
    const customPrompts = Object.keys(draftCustomPrompts).length > 0 ? draftCustomPrompts : undefined
    updateProjectSettings({
      formattingRules: { ...rules, ...draft },
      targetRuntimeMinutes: draftTargetRuntime,
      customAIPrompts: customPrompts,
    })
    setSettingsPanelOpen(false)
  }

  const handleCancel = () => {
    setSettingsPanelOpen(false)
  }

  const handleResetDefaults = () => {
    setDraft({
      defaultFontFamily: undefined,
      defaultFontSize: undefined,
      defaultLineHeight: undefined,
      paragraphSpacing: undefined,
      editorPaddingX: undefined,
      editorMaxWidth: undefined,
      textColor: undefined,
      headingColor: undefined,
      h1: undefined,
      h2: undefined,
      h3: undefined,
    })
    setDraftTargetRuntime(undefined)
    setDraftCustomPrompts({})
  }

  const editableCommands = getEditableCommands(isScreenplay)
  const instructions = isScreenplay ? defaultInstructions?.screenplay : defaultInstructions?.prose

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* Header with Save / Cancel */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-theme-subtle bg-theme-header">
        <h2 className="text-base font-ui font-semibold text-theme-primary">
          Project Settings
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-ui text-theme-secondary hover:text-theme-primary hover:bg-theme-hover transition-colors"
          >
            <DismissRegular className="w-3.5 h-3.5" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-ui font-medium transition-colors',
              dirty
                ? 'bg-gold-500 text-black hover:bg-gold-400'
                : 'bg-theme-hover text-theme-muted cursor-not-allowed'
            )}
          >
            <CheckmarkRegular className="w-3.5 h-3.5" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-xl mx-auto space-y-8">

          {/* Interface Scale Section (always shown, applied immediately) */}
          <section id="settings-interface-scale">
            <h3 className="text-xs font-ui font-semibold text-theme-accent uppercase tracking-wider mb-2">
              Interface Scale
            </h3>
            <div className="divide-y divide-theme-subtle">
              <SettingRow label="App Zoom" description="Scale the entire interface (toolbar, sidebar, editor)">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const idx = INTERFACE_SCALE_STEPS.findIndex(s => s >= interfaceScale)
                      const prevIdx = Math.max((idx > 0 ? idx : INTERFACE_SCALE_STEPS.length) - 1, 0)
                      handleInterfaceScaleChange(INTERFACE_SCALE_STEPS[prevIdx])
                    }}
                    disabled={interfaceScale <= INTERFACE_SCALE_STEPS[0]}
                    className="btn-icon-modern p-1 text-xs"
                    title="Zoom Out"
                  >
                    -
                  </button>
                  <select
                    value={interfaceScale}
                    onChange={(e) => handleInterfaceScaleChange(Number(e.target.value))}
                    className="input-modern text-sm text-center py-1.5 px-2 w-24"
                  >
                    {INTERFACE_SCALE_STEPS.map((s) => (
                      <option key={s} value={s}>{s}%</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const idx = INTERFACE_SCALE_STEPS.findIndex(s => s > interfaceScale)
                      const nextIdx = idx >= 0 ? idx : INTERFACE_SCALE_STEPS.length - 1
                      handleInterfaceScaleChange(INTERFACE_SCALE_STEPS[nextIdx])
                    }}
                    disabled={interfaceScale >= INTERFACE_SCALE_STEPS[INTERFACE_SCALE_STEPS.length - 1]}
                    className="btn-icon-modern p-1 text-xs"
                    title="Zoom In"
                  >
                    +
                  </button>
                  {interfaceScale !== 100 && (
                    <button
                      onClick={() => handleInterfaceScaleChange(100)}
                      className="text-xs text-theme-muted hover:text-theme-accent transition-colors ml-1"
                      title="Reset to 100%"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </SettingRow>
            </div>
          </section>

          {/* Body Text Section */}
          <section id="settings-body">
            <h3 className="text-xs font-ui font-semibold text-theme-accent uppercase tracking-wider mb-2">
              Body Text
            </h3>
            <div className="divide-y divide-theme-subtle">
              {/* Font Family - hidden for screenplay (locked to Courier) */}
              {!isScreenplay && (
                <SettingRow label="Font Family" description="Default font for body text">
                  <select
                    value={draft.defaultFontFamily ?? ''}
                    onChange={(e) => updateDraft({
                      defaultFontFamily: e.target.value || undefined
                    })}
                    className="input-modern text-sm py-1.5 px-3 w-48"
                  >
                    <option value="">Workspace Default</option>
                    {FONT_FAMILIES.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                </SettingRow>
              )}

              <SettingRow label="Font Size" description={isScreenplay ? 'Base text size in points' : 'Base text size in pixels'}>
                <NumberStepper
                  value={draft.defaultFontSize}
                  onChange={(val) => updateDraft({ defaultFontSize: val })}
                  min={10}
                  max={24}
                  step={1}
                  unit={isScreenplay ? 'pt' : 'px'}
                />
              </SettingRow>

              <SettingRow label="Line Height" description="Spacing between lines">
                <NumberStepper
                  value={draft.defaultLineHeight}
                  onChange={(val) => updateDraft({ defaultLineHeight: val })}
                  min={1}
                  max={3}
                  step={0.1}
                />
              </SettingRow>

              {!isScreenplay && (
                <SettingRow label="Paragraph Spacing" description="Space between paragraphs">
                  <NumberStepper
                    value={draft.paragraphSpacing}
                    onChange={(val) => updateDraft({ paragraphSpacing: val })}
                    min={0}
                    max={2}
                    step={0.25}
                    unit="rem"
                  />
                </SettingRow>
              )}

              <SettingRow label="Color" description="Body text color">
                <ColorPicker
                  value={draft.textColor}
                  onChange={(val) => updateDraft({ textColor: val })}
                  label="Body Text Color"
                />
              </SettingRow>
            </div>
          </section>

          {/* Heading Sections - hidden for screenplay */}
          {!isScreenplay && (
            <>
              <HeadingSection
                level="h1"
                label="Heading 1"
                values={draft.h1}
                onUpdate={(p) => updateHeadingDraft('h1', p)}
              />
              <HeadingSection
                level="h2"
                label="Heading 2"
                values={draft.h2}
                onUpdate={(p) => updateHeadingDraft('h2', p)}
              />
              <HeadingSection
                level="h3"
                label="Heading 3"
                values={draft.h3}
                onUpdate={(p) => updateHeadingDraft('h3', p)}
              />
            </>
          )}

          {/* Layout Section */}
          <section id="settings-layout">
            <h3 className="text-xs font-ui font-semibold text-theme-accent uppercase tracking-wider mb-2">
              Layout
            </h3>
            <div className="divide-y divide-theme-subtle">
              <SettingRow label="Editor Padding" description="Horizontal padding around text">
                <NumberStepper
                  value={draft.editorPaddingX}
                  onChange={(val) => updateDraft({ editorPaddingX: val })}
                  min={1}
                  max={6}
                  step={0.5}
                  unit="rem"
                />
              </SettingRow>

              <SettingRow label="Max Width" description="Maximum editor width">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.editorMaxWidth === null}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateDraft({ editorMaxWidth: null })
                        } else {
                          updateDraft({ editorMaxWidth: undefined })
                        }
                      }}
                      className="accent-gold-400"
                    />
                    <span className="text-xs text-theme-secondary">No limit</span>
                  </label>
                  {draft.editorMaxWidth !== null && (
                    <NumberStepper
                      value={draft.editorMaxWidth ?? undefined}
                      onChange={(val) => updateDraft({ editorMaxWidth: val })}
                      min={600}
                      max={1200}
                      step={50}
                      unit="px"
                      width="w-20"
                    />
                  )}
                </div>
              </SettingRow>
            </div>
          </section>

          {/* Screenplay Section - only for screenplay projects */}
          {isScreenplay && (
            <section id="settings-screenplay">
              <h3 className="text-xs font-ui font-semibold text-theme-accent uppercase tracking-wider mb-2">
                Screenplay
              </h3>
              <div className="divide-y divide-theme-subtle">
                <SettingRow label="Target Runtime" description="Goal runtime for your screenplay">
                  <NumberStepper
                    value={draftTargetRuntime}
                    onChange={(val) => setDraftTargetRuntime(val)}
                    min={1}
                    max={600}
                    step={5}
                    unit="min"
                  />
                </SettingRow>
              </div>
            </section>
          )}

          {/* AI Prompts Section */}
          <section id="settings-aiPrompts">
            <h3 className="text-xs font-ui font-semibold text-theme-accent uppercase tracking-wider mb-2">
              AI Prompts
            </h3>
            <p className="text-xs text-theme-muted mb-4">
              Customize the instruction prompts for each AI writing command. The base writing philosophy and format guides are prepended automatically.
            </p>
            <div className="space-y-1">
              {editableCommands.map(cmd => {
                const isExpanded = expandedPrompt === cmd.id
                const currentValue = draftCustomPrompts[cmd.id]
                const defaultValue = instructions?.[cmd.id] || ''
                const isCustomized = currentValue !== undefined

                return (
                  <div key={cmd.id} className="border border-theme-subtle rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedPrompt(isExpanded ? null : cmd.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-theme-hover transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-theme-primary">{cmd.name}</span>
                        {isCustomized && (
                          <span className="text-[10px] font-ui font-semibold text-gold-400 uppercase tracking-wider">
                            Customized
                          </span>
                        )}
                      </div>
                      <ChevronDownRegular className={clsx(
                        'w-3.5 h-3.5 text-theme-muted transition-transform shrink-0',
                        isExpanded && 'rotate-180'
                      )} />
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2 border-t border-theme-subtle">
                        <p className="text-xs text-theme-muted pt-2">{cmd.description}</p>
                        <textarea
                          value={currentValue ?? defaultValue}
                          onChange={(e) => handleUpdatePrompt(cmd.id, e.target.value)}
                          className="w-full h-48 text-xs font-mono bg-[var(--bg-tertiary)] border border-theme-subtle rounded-lg p-3 resize-y text-theme-primary placeholder-theme-muted focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/30"
                          placeholder="Enter custom instruction..."
                        />
                        {isCustomized && (
                          <button
                            onClick={() => handleUpdatePrompt(cmd.id, undefined)}
                            className="flex items-center gap-1 text-xs text-theme-muted hover:text-theme-accent transition-colors"
                          >
                            <ArrowResetRegular className="w-3 h-3" />
                            Reset to Default
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Reset */}
          <div className="pt-4 border-t border-theme-subtle">
            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-hover transition-colors"
            >
              <ArrowResetRegular className="w-4 h-4" />
              Reset to Workspace Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
