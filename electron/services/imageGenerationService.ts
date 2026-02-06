import pLimit from 'p-limit'
import Store from 'electron-store'
import { DEFAULT_PROMPT_TEMPLATE, STYLE_MODIFIERS, type ImageStyle, type ImageSize } from '../../shared/imageGenerationPrompts'

// Re-export types for backwards compatibility
export type { ImageStyle, ImageSize }

// Detailed storyboard style description to append to prompts
// This replaces the reference image approach to avoid character contamination
// Style inspired by dramatic film storyboards with strong silhouette work
const STORYBOARD_STYLE_DESCRIPTION = `

ART STYLE (CRITICAL - follow exactly):
- Dramatic film storyboard with strong silhouette/backlighting aesthetic
- HIGH CONTRAST black and white - deep blacks against bright whites
- Characters often rendered as bold silhouettes against lighter backgrounds
- Rough, expressive marker strokes with visible texture
- MONOCHROME GRAYSCALE ONLY - absolutely no color
- Dramatic cinematic composition and lighting
- Strong use of negative space and shadow shapes
- Raw, gestural quality typical of professional pre-production storyboards
- Loose linework, not polished - capture the energy and mood
- NO TEXT, NO WORDS, NO CAPTIONS, NO LABELS - pure illustration only`

export interface ImageGenSettings {
  apiKey?: string
  defaultPromptTemplate: string
  defaultStyle: ImageStyle
  defaultSize: ImageSize
  useReferenceImages: boolean  // Now controls whether to append detailed style description
}

export interface ImageGenOptions {
  style: ImageStyle
  size: ImageSize
  customPrompt?: string
  projectPath: string
  useReferenceImages?: boolean
}

export interface GeneratedImageResult {
  success: boolean
  imageBuffer?: Buffer
  error?: string
  errorCode?: number
}

// OpenAI API response types
interface OpenAIImageResponse {
  created: number
  data: Array<{
    url?: string
    b64_json?: string
    revised_prompt?: string
  }>
}

interface OpenAIErrorResponse {
  error: {
    message: string
    type: string
    param?: string
    code?: string
  }
}

export class ImageGenerationService {
  private store: Store
  private limiter: ReturnType<typeof pLimit>
  private pendingPrompts: Set<string> = new Set()

  constructor() {
    this.store = new Store({
      name: 'image-generation-settings',
      encryptionKey: 'cadmus-image-gen-v1'  // Basic encryption for API key storage
    })
    
    // Rate limiter: 1 concurrent request, minimum 1 second between requests
    this.limiter = pLimit(1)
  }

  /**
   * Get current image generation settings
   */
  getSettings(): ImageGenSettings {
    // Validate stored size - map old DALL-E 3 sizes to gpt-image-1 sizes
    let storedSize = this.store.get('defaultSize') as string | undefined
    if (storedSize === '1792x1024') storedSize = '1536x1024'
    if (storedSize === '1024x1792') storedSize = '1024x1536'
    
    return {
      apiKey: this.store.get('apiKey') as string | undefined,
      // Always use code default for prompt - don't persist user edits
      defaultPromptTemplate: DEFAULT_PROMPT_TEMPLATE,
      defaultStyle: (this.store.get('defaultStyle') as ImageStyle) || 'storyboard-sketch',
      defaultSize: (storedSize as ImageSize) || '1536x1024',
      useReferenceImages: (this.store.get('useReferenceImages') as boolean) ?? true
    }
  }

  /**
   * Update image generation settings
   */
  setSettings(settings: Partial<ImageGenSettings>): void {
    if (settings.apiKey !== undefined) {
      this.store.set('apiKey', settings.apiKey)
    }
    if (settings.defaultPromptTemplate !== undefined) {
      this.store.set('defaultPromptTemplate', settings.defaultPromptTemplate)
    }
    if (settings.defaultStyle !== undefined) {
      this.store.set('defaultStyle', settings.defaultStyle)
    }
    if (settings.defaultSize !== undefined) {
      this.store.set('defaultSize', settings.defaultSize)
    }
    if (settings.useReferenceImages !== undefined) {
      this.store.set('useReferenceImages', settings.useReferenceImages)
    }
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    const apiKey = this.store.get('apiKey') as string | undefined
    return !!apiKey && apiKey.length > 0
  }

  /**
   * Generate an image using OpenAI's gpt-image-1 generations API
   * Uses detailed text description for storyboard style instead of reference images
   */
  async generateImage(prompt: string, options: ImageGenOptions): Promise<GeneratedImageResult> {
    const apiKey = this.store.get('apiKey') as string | undefined
    
    if (!apiKey) {
      return {
        success: false,
        error: 'API key not configured. Please add your OpenAI API key in the settings.',
        errorCode: 401
      }
    }

    // Dedupe identical prompts - if already processing this exact prompt, skip
    const promptHash = this.hashPrompt(prompt + options.size + options.style)
    if (this.pendingPrompts.has(promptHash)) {
      return {
        success: false,
        error: 'Duplicate request - this prompt is already being processed.',
        errorCode: 409
      }
    }

    // Build final prompt with style modifiers and storyboard style description
    let finalPrompt = prompt
    
    // Add style modifier if not custom
    if (options.style !== 'custom' && STYLE_MODIFIERS[options.style]) {
      finalPrompt = prompt + STYLE_MODIFIERS[options.style]
    }
    
    // Append detailed storyboard style description (replaces reference image approach)
    // This ensures consistent storyboard aesthetic without character contamination
    if (options.useReferenceImages !== false) {
      finalPrompt = finalPrompt + STORYBOARD_STYLE_DESCRIPTION
    }

    // Queue the request through the rate limiter
    return this.limiter(async () => {
      this.pendingPrompts.add(promptHash)
      
      try {
        // Always use gpt-image-1 generations API (no reference image)
        const result = await this.callGptImageGenerationWithRetry(finalPrompt, options.size, apiKey)
        return result
      } finally {
        this.pendingPrompts.delete(promptHash)
      }
    })
  }

  /**
   * Call gpt-image-1 generations API with retry logic
   */
  private async callGptImageGenerationWithRetry(
    prompt: string,
    size: ImageSize,
    apiKey: string,
    maxRetries: number = 5
  ): Promise<GeneratedImageResult> {
    let lastError: Error | null = null
    let lastErrorCode: number | undefined
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.callGptImageGeneration(prompt, size, apiKey)
        return result
      } catch (error) {
        lastError = error as Error
        const errorMessage = lastError.message || ''
        const codeMatch = errorMessage.match(/status (\d+)/)
        lastErrorCode = codeMatch ? parseInt(codeMatch[1], 10) : undefined
        
        if (lastErrorCode === 401 || lastErrorCode === 403 || lastErrorCode === 400) {
          console.error(`[ImageGen] Non-retryable error (${lastErrorCode}):`, errorMessage)
          break
        }
        
        if (lastErrorCode === 429 || (lastErrorCode && lastErrorCode >= 500)) {
          const baseDelay = Math.min(1000 * Math.pow(2, attempt), 32000)
          const jitter = baseDelay * (0.5 + Math.random())
          const delay = Math.floor(jitter)
          console.log(`[ImageGen] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
          await this.sleep(delay)
          continue
        }
        
        console.error(`[ImageGen] Unknown error:`, errorMessage)
        break
      }
    }
    
    return {
      success: false,
      error: this.formatError(lastError, lastErrorCode),
      errorCode: lastErrorCode
    }
  }

  /**
   * Call gpt-image-1 generations endpoint (no reference image - style via text description)
   */
  private async callGptImageGeneration(
    prompt: string,
    size: ImageSize,
    apiKey: string
  ): Promise<GeneratedImageResult> {
    // Ensure size is valid for gpt-image-1
    let validSize: string = size
    if (size === '1792x1024' as ImageSize) validSize = '1536x1024'
    if (size === '1024x1792' as ImageSize) validSize = '1024x1536'
    
    console.log('[ImageGen] Calling gpt-image-1 generations API...')
    console.log('[ImageGen] Prompt length:', prompt.length)
    console.log('[ImageGen] Size:', validSize)
    
    // Note: gpt-image-1 does not support response_format parameter
    // It returns b64_json by default
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: prompt,
        n: 1,
        size: validSize,
      })
    })

    const responseText = await response.text()
    
    if (!response.ok) {
      console.error(`[ImageGen] gpt-image-1 API error (status ${response.status}):`, responseText)
      
      let errorMessage = `API request failed with status ${response.status}`
      try {
        const errorData = JSON.parse(responseText) as OpenAIErrorResponse
        if (errorData.error?.message) {
          errorMessage = errorData.error.message
        }
      } catch {
        // Use generic message
      }
      
      throw new Error(`${errorMessage} (status ${response.status})`)
    }

    const data = JSON.parse(responseText) as OpenAIImageResponse
    
    if (!data.data || data.data.length === 0) {
      throw new Error('No image data returned from API')
    }

    const imageData = data.data[0]
    
    if (imageData.revised_prompt) {
      console.log('[ImageGen] Revised prompt:', imageData.revised_prompt.substring(0, 200) + '...')
    }
    
    if (imageData.b64_json) {
      const imageBuffer = Buffer.from(imageData.b64_json, 'base64')
      console.log('[ImageGen] Successfully generated image, size:', imageBuffer.length)
      return { success: true, imageBuffer }
    } else if (imageData.url) {
      const imageResponse = await fetch(imageData.url)
      const arrayBuffer = await imageResponse.arrayBuffer()
      const imageBuffer = Buffer.from(arrayBuffer)
      console.log('[ImageGen] Successfully fetched image from URL, size:', imageBuffer.length)
      return { success: true, imageBuffer }
    }

    throw new Error('No image data in response')
  }

  /**
   * Format error message for display to user
   */
  private formatError(error: Error | null, errorCode?: number): string {
    if (!error) {
      return 'Unknown error occurred'
    }

    const message = error.message || ''
    
    // Provide user-friendly messages for common errors
    if (errorCode === 401) {
      return 'Invalid API key. Please check your OpenAI API key in settings.'
    }
    if (errorCode === 403) {
      return 'API access denied. Check your API key permissions and ensure your region supports OpenAI. Full error: ' + message
    }
    if (errorCode === 429) {
      return 'Rate limit exceeded. Please wait a moment and try again.'
    }
    if (errorCode && errorCode >= 500) {
      return 'OpenAI service is temporarily unavailable. Please try again later.'
    }
    if (message.includes('fetch') || message.includes('network') || message.includes('ENOTFOUND')) {
      return 'Unable to connect to OpenAI. Please check your internet connection.'
    }
    if (message.includes('content_policy')) {
      return 'The prompt was rejected due to content policy. Please modify your selection and try again.'
    }

    return message
  }

  /**
   * Simple hash function for prompt deduplication
   */
  private hashPrompt(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(36)
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Build the full prompt from template, selected text, and context
   * 
   * Supports three template variables:
   * - ${selectedText}: The text selected in the screenplay
   * - ${contextSection}: Combined context (mentions + surrounding context)
   * - ${surroundingContext}: Kept for backwards compatibility, replaced with contextSection
   */
  buildPrompt(
    selectedText: string,
    contextSection: string,
    promptTemplate?: string
  ): string {
    const template = promptTemplate || this.getSettings().defaultPromptTemplate
    
    // Replace all supported template variables
    // ${surroundingContext} is treated the same as ${contextSection} for backwards compatibility
    return template
      .replace(/\$\{selectedText\}/g, selectedText)
      .replace(/\$\{contextSection\}/g, contextSection || '')
      .replace(/\$\{surroundingContext\}/g, contextSection || '')
  }
}

// Singleton instance
let imageGenService: ImageGenerationService | null = null

export function getImageGenerationService(): ImageGenerationService {
  if (!imageGenService) {
    imageGenService = new ImageGenerationService()
  }
  return imageGenService
}
