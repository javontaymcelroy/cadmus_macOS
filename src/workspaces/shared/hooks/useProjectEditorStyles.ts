import { useMemo } from 'react'
import { useProjectStore } from '../../../stores/projectStore'

/**
 * Computes CSS custom property overrides from project formatting settings.
 * Returns a style object and class flag to apply on the editor container div.
 */
export function useProjectEditorStyles() {
  const formattingRules = useProjectStore(
    state => state.currentProject?.settings?.formattingRules
  )
  const templateId = useProjectStore(
    state => state.currentProject?.templateId
  )

  return useMemo(() => {
    if (!formattingRules) return { hasOverrides: false, style: {} as Record<string, string>, maxWidth: undefined as string | undefined }

    const style: Record<string, string> = {}
    let hasOverrides = false
    const fontSizeUnit = templateId === 'screenplay' ? 'pt' : 'px'

    if (formattingRules.defaultFontFamily) {
      style['--project-font-family'] = formattingRules.defaultFontFamily
      hasOverrides = true
    }
    if (formattingRules.defaultFontSize != null) {
      style['--project-font-size'] = `${formattingRules.defaultFontSize}${fontSizeUnit}`
      hasOverrides = true
    }
    if (formattingRules.defaultLineHeight != null) {
      style['--project-line-height'] = `${formattingRules.defaultLineHeight}`
      hasOverrides = true
    }
    if (formattingRules.paragraphSpacing != null) {
      style['--project-paragraph-spacing'] = `${formattingRules.paragraphSpacing}rem`
      hasOverrides = true
    }
    if (formattingRules.editorPaddingX != null) {
      style['--project-padding-x'] = `${formattingRules.editorPaddingX}rem`
      hasOverrides = true
    }
    if (formattingRules.textColor) {
      style['--project-text-color'] = formattingRules.textColor
      hasOverrides = true
    }
    if (formattingRules.headingColor) {
      style['--project-heading-color'] = formattingRules.headingColor
      hasOverrides = true
    }

    // Per-heading overrides
    const headingLevels = ['h1', 'h2', 'h3'] as const
    for (const level of headingLevels) {
      const heading = formattingRules[level]
      if (!heading) continue
      if (heading.fontFamily) {
        style[`--project-${level}-font-family`] = heading.fontFamily
        hasOverrides = true
      }
      if (heading.fontSize != null) {
        style[`--project-${level}-font-size`] = `${heading.fontSize}rem`
        hasOverrides = true
      }
      if (heading.color) {
        style[`--project-${level}-color`] = heading.color
        hasOverrides = true
      }
    }

    const maxWidth = formattingRules.editorMaxWidth === null
      ? 'none'
      : formattingRules.editorMaxWidth
        ? `${formattingRules.editorMaxWidth}px`
        : undefined

    if (maxWidth) hasOverrides = true

    return { hasOverrides, style, maxWidth }
  }, [formattingRules, templateId])
}
