import { useState, useRef, useEffect } from 'react'
import { clsx } from 'clsx'
import { ArrowResetRegular, CheckmarkRegular, DismissRegular } from '@fluentui/react-icons'
import { useProjectStore } from '../../stores/projectStore'
import { FONT_FAMILIES } from '../../workspaces/shared/extensions/FontFamily'
import type { FormattingRules, HeadingTypography } from '../../types/project'

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
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-theme-default hover:border-theme-strong transition-colors"
        title={label}
      >
        <div
          className="w-5 h-5 rounded border border-theme-subtle"
          style={{ backgroundColor: value || 'var(--text-primary)' }}
        />
        <span className="text-xs text-theme-secondary">
          {value || 'Default'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 p-3 bg-theme-elevated border border-theme-default rounded-lg shadow-lg z-50 min-w-[200px]">
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color.name}
                onClick={() => {
                  onChange(color.value || undefined)
                  setIsOpen(false)
                }}
                className={clsx(
                  'w-8 h-8 rounded-md border transition-all',
                  value === color.value || (!value && !color.value)
                    ? 'border-theme-accent ring-1 ring-gold-400 scale-110'
                    : 'border-theme-subtle hover:border-theme-default hover:scale-105'
                )}
                style={{
                  backgroundColor: color.value || 'var(--text-primary)',
                }}
                title={color.name}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-theme-subtle">
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

export function ProjectSettingsPanel() {
  const { currentProject, updateProjectSettings, setSettingsPanelOpen } = useProjectStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  const rules = currentProject?.settings?.formattingRules
  if (!currentProject || !rules) return null

  // Local draft state - changes are buffered here until Save
  const [draft, setDraft] = useState<EditableFields>(() => getEditableFields(rules))

  // Track whether we have unsaved changes
  const dirty = hasChanges(draft, getEditableFields(rules))

  const updateDraft = (partial: Partial<EditableFields>) => {
    setDraft(prev => ({ ...prev, ...partial }))
  }

  const updateHeadingDraft = (level: 'h1' | 'h2' | 'h3', partial: Partial<HeadingTypography>) => {
    setDraft(prev => ({
      ...prev,
      [level]: { ...prev[level], ...partial }
    }))
  }

  const handleSave = () => {
    updateProjectSettings({
      formattingRules: { ...rules, ...draft }
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
  }

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

          {/* Body Text Section */}
          <section id="settings-body">
            <h3 className="text-xs font-ui font-semibold text-theme-accent uppercase tracking-wider mb-2">
              Body Text
            </h3>
            <div className="divide-y divide-theme-subtle">
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

              <SettingRow label="Font Size" description="Base text size in pixels">
                <NumberStepper
                  value={draft.defaultFontSize}
                  onChange={(val) => updateDraft({ defaultFontSize: val })}
                  min={12}
                  max={24}
                  step={1}
                  unit="px"
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

              <SettingRow label="Color" description="Body text color">
                <ColorPicker
                  value={draft.textColor}
                  onChange={(val) => updateDraft({ textColor: val })}
                  label="Body Text Color"
                />
              </SettingRow>
            </div>
          </section>

          {/* Heading Sections */}
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
