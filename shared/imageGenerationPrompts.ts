/**
 * Image Generation Prompts - SINGLE SOURCE OF TRUTH
 * 
 * ========================================
 * EDIT THE PROMPT HERE TO UPDATE THE APP
 * ========================================
 * 
 * This file is shared between the frontend (renderer) and backend (main process).
 * Changes here will be reflected in both places after rebuilding.
 */

// Default prompt template
// Note: Storyboard style instructions are appended separately by the service
export const DEFAULT_PROMPT_TEMPLATE = `Create a storyboard illustration of this scene:
\${selectedText}

\${contextSection}

CRITICAL RULES:
1. NO TEXT whatsoever - no captions, labels, titles, dialogue, or words of any kind
2. PURE ILLUSTRATION ONLY - just the visual scene, nothing else
3. Draw characters exactly as described in the context above
4. Single panel showing this specific moment`

// Style-specific prompt modifiers
export const STYLE_MODIFIERS = {
  'storyboard-sketch': '',
  'cinematic': ' More dramatic lighting and camera angle.',
  'toon-boom': ' Slightly cleaner line work.',
  'custom': '',
} as const

// Type exports
export type ImageStyle = keyof typeof STYLE_MODIFIERS
// gpt-image-1 supported sizes
export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536'

export const SIZE_OPTIONS: { value: ImageSize; label: string; aspect: string }[] = [
  { value: '1536x1024', label: '1536 x 1024', aspect: 'Landscape (3:2)' },
  { value: '1024x1024', label: '1024 x 1024', aspect: 'Square (1:1)' },
  { value: '1024x1536', label: '1024 x 1536', aspect: 'Portrait (2:3)' },
]
