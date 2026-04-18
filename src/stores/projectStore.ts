import { create } from 'zustand'
import type { 
  Project, 
  ProjectDocument, 
  Asset, 
  Template,
  Diagnostic,
  BuildResult,
  Character,
  Prop,
  DocumentVersion,
  StoryboardShot,
  Storyboard,
  BlockAnchor,
  AgendaItem,
  TodoItem,
  DocumentLifecycleState,
  Sticker,
  ExtractedMention,
  ScriptReference,
  ScriptReferenceElementType,
  CharacterReferences,
  PropReferences,
  SurroundingScriptContext,
  ScriptContext,
  CharacterDocOutput,
  PropDocOutput,
  ActBreakDocOutput,
  CritiqueIssue,
  IssueResolution,
  StoredCritiqueResolution
} from '../types/project'
import type { SceneState, CharacterEligibility, PipelineResult } from '../../shared/sceneStateTypes'
import type { JSONContent } from '@tiptap/core'
import { getWorkspaceConfig } from '../workspaces'
import { contentToPlainText, contentToPlainTextWithPositions, plainTextOffsetToDocPos } from '../utils/selectionUtils'
import type { WorkspaceLayoutState } from '../../shared/workspaceStateTypes'

// Helper to escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Helper to recursively remove asset images from document content
function removeAssetFromContent(content: JSONContent, assetId: string): JSONContent {
  if (!content.content) return content
  return {
    ...content,
    content: content.content
      .filter(node => !(node.type === 'assetImage' && node.attrs?.assetId === assetId))
      .map(node => removeAssetFromContent(node, assetId))
  }
}

// Helper to generate a stable hash for matching critique issues across analysis runs
// Uses operator + first evidence sceneRef + question substring for fuzzy matching
function generateIssueHash(issue: { operator: string; evidence: { sceneRef: string }[]; question: string }): string {
  const operator = issue.operator
  const sceneRef = issue.evidence[0]?.sceneRef || ''
  // Use first 50 chars of question to allow for minor rephrasing
  const questionPrefix = issue.question.slice(0, 50).toLowerCase().replace(/\s+/g, ' ')
  return `${operator}::${sceneRef}::${questionPrefix}`
}

// Helper to create citation text nodes that link back to source script blocks
// Currently disabled - returns empty array
function createCitationNodes(_scriptContexts?: ScriptContext[]): JSONContent[] {
  // Citations disabled for now
  return []
}

// Helper to create a paragraph with text and optional citations
function createParagraphWithCitations(text: string, scriptContexts?: ScriptContext[]): JSONContent {
  const citations = createCitationNodes(scriptContexts)
  return {
    type: 'paragraph',
    content: [
      { type: 'text', text },
      ...citations
    ]
  }
}

// Generate character note document content template (production-focused)
// These docs prevent contradictions - they make sure costume, blocking, and sound all align
function generateCharacterNoteContent(characterName: string, aiContent?: CharacterDocOutput, scriptContexts?: ScriptContext[]): JSONContent {
  // Default placeholder content if no AI content provided
  const content = aiContent || {
    roleInStory: 'No script evidence yet.',
    backstory: 'No script evidence yet.',
    psychologyUnderStress: 'No script evidence yet.',
    physicalDescription: 'No script evidence yet.',
    wardrobeLogic: 'No script evidence yet.',
    movementHabits: 'No script evidence yet.',
    voiceSpeechPatterns: 'No script evidence yet.',
    relationshipToEnvironment: 'No script evidence yet.',
    arc: 'No script evidence yet.'
  }

  // Add citations only when AI content is provided (not for placeholders)
  const hasCitations = aiContent && scriptContexts && scriptContexts.length > 0

  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: characterName }]
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Role in Story' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.roleInStory, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.roleInStory }] },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Backstory' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.backstory, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.backstory }] },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Psychology Under Stress' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.psychologyUnderStress, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.psychologyUnderStress }] },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Physical Description' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.physicalDescription, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.physicalDescription }] },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Wardrobe Logic' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.wardrobeLogic, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.wardrobeLogic }] },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Movement / Habits' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.movementHabits, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.movementHabits }] },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Voice / Speech Patterns' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.voiceSpeechPatterns, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.voiceSpeechPatterns }] },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Relationship to Environment' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.relationshipToEnvironment, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.relationshipToEnvironment }] },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Arc' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.arc, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.arc }] }
    ]
  }
}

// Default colors for auto-assigned characters - expanded for larger casts
const DEFAULT_CHARACTER_COLORS = [
  '#fbbf24', // Gold (brand color)
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#22c55e', // Green
  '#8b5cf6', // Purple
  '#f97316', // Orange
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f59e0b', // Amber
  '#2563eb', // Dark Blue
  '#dc2626', // Dark Red
  '#16a34a', // Dark Green
  '#7c3aed', // Dark Purple
  '#06b6d4', // Cyan
  '#64748b', // Slate
  '#92400e', // Brown
  '#fb923c', // Light Orange
  '#f472b6', // Light Pink
  '#4ade80', // Light Green
  '#60a5fa', // Light Blue
]

// Default icons for auto-assigned props (Fluent icon names)
// Organized by story element category for meaningful defaults
const DEFAULT_PROP_ICONS = [
  // Objects - most common physical props
  'Diamond',
  'Key',
  'Box',
  'Document',
  // Location/Setting
  'Home',
  'Building',
  'Location',
  // Time
  'Hourglass',
  'Timer',
  // Rules/Systems
  'Gavel',
  'Shield',
  // Information
  'Info',
  'Eye',
  // Status/Identity
  'Crown',
  'Badge',
  // Relationships
  'Heart',
  'Link',
  'Umbrella',
  'Clock'
]

// Brand color for props (gold)
const PROP_BRAND_COLOR = '#fbbf24'

// Generate prop note document content template (production-focused)
// Used so props aren't random and can support story mechanics
function generatePropNoteContent(propName: string, aiContent?: PropDocOutput, scriptContexts?: ScriptContext[]): JSONContent {
  // Default placeholder content if no AI content provided
  const content = aiContent || {
    functionInPlot: 'No script evidence yet.',
    physicalDescription: 'No script evidence yet.',
    condition: 'No script evidence yet.',
    rulesLimitations: 'No script evidence yet.',
    symbolicWeight: 'No script evidence yet.',
    howUsedOnScreen: 'No script evidence yet.'
  }

  // Add citations only when AI content is provided (not for placeholders)
  const hasCitations = aiContent && scriptContexts && scriptContexts.length > 0

  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: propName }]
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Function in Plot' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.functionInPlot, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.functionInPlot }] },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Physical Description' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.physicalDescription, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.physicalDescription }] },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Condition' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.condition, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.condition }] },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Rules / Limitations' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.rulesLimitations, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.rulesLimitations }] },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Symbolic Weight' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.symbolicWeight, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.symbolicWeight }] },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'How Used On Screen' }]
      },
      hasCitations 
        ? createParagraphWithCitations(content.howUsedOnScreen, scriptContexts)
        : { type: 'paragraph', content: [{ type: 'text', text: content.howUsedOnScreen }] }
    ]
  }
}

// Generate act break document content template
// Used to summarize what happens in each act
// sourceDocRefs: Array of {documentId, title} for the screenplay pages that were analyzed
function generateActBreakNoteContent(
  actName: string, 
  aiContent?: ActBreakDocOutput, 
  sourceDocRefs?: Array<{documentId: string, title: string}>
): JSONContent {
  // Default placeholder content if no AI content provided
  const content = aiContent || {
    plotSummary: 'No script content analyzed yet.',
    themes: ['No themes identified yet.'],
    characterArcs: ['No character arcs identified yet.']
  }

  // Add citations only when AI content is provided (not for placeholders)
  const hasCitations = aiContent && sourceDocRefs && sourceDocRefs.length > 0

  // Helper to create citation nodes for act break documents
  // Currently disabled - returns empty array
  const createActCitationNodes = (): JSONContent[] => {
    // Citations disabled for now
    return []
  }

  // Convert themes array to bullet list
  const themesListItems = content.themes.map(theme => ({
    type: 'listItem',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: theme }] }]
  }))

  // Convert character arcs array to bullet list
  const arcsListItems = content.characterArcs.map(arc => ({
    type: 'listItem',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: arc }] }]
  }))

  // Create plot summary paragraph with optional citations
  const plotSummaryParagraph: JSONContent = hasCitations 
    ? {
        type: 'paragraph',
        content: [
          { type: 'text', text: content.plotSummary },
          ...createActCitationNodes()
        ]
      }
    : {
        type: 'paragraph',
        content: [{ type: 'text', text: content.plotSummary }]
      }

  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: actName }]
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Plot Summary' }]
      },
      plotSummaryParagraph,
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Themes & Motifs' }]
      },
      {
        type: 'bulletList',
        content: themesListItems
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Character Arcs' }]
      },
      {
        type: 'bulletList',
        content: arcsListItems
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Your Notes' }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Add your own notes about this act here...' }]
      }
    ]
  }
}

// Character document section headings (for detecting blank vs user-edited docs)
const CHARACTER_DOC_HEADINGS = [
  'Role in Story',
  'Backstory',
  'Psychology Under Stress',
  'Physical Description',
  'Wardrobe Logic',
  'Movement / Habits',
  'Voice / Speech Patterns',
  'Relationship to Environment',
  'Arc'
]

// Prop document section headings (for detecting blank vs user-edited docs)
const PROP_DOC_HEADINGS = [
  'Function in Plot',
  'Physical Description',
  'Condition',
  'Rules / Limitations',
  'Symbolic Weight',
  'How Used On Screen'
]

// Act break document section headings (for detecting blank vs user-edited docs)
const ACT_BREAK_DOC_HEADINGS = [
  'Plot Summary',
  'Themes & Motifs',
  'Character Arcs',
  'Your Notes'
]

// Default placeholder text used in blank documents
const DEFAULT_PLACEHOLDER = 'No script evidence yet.'

// Helper to extract all text from a JSONContent document
function extractAllTextFromDoc(content: JSONContent): string {
  const textParts: string[] = []
  
  function traverse(node: JSONContent) {
    if (node.type === 'text' && node.text) {
      textParts.push(node.text)
    }
    if (node.content) {
      for (const child of node.content) {
        traverse(child)
      }
    }
  }
  
  traverse(content)
  return textParts.join(' ')
}

// Check if a character doc only contains default placeholder content (no user edits)
function isBlankCharacterDoc(content: JSONContent): boolean {
  const text = extractAllTextFromDoc(content)
  
  // Build a regex pattern to remove all known headings and placeholder text
  let cleanedText = text
  
  // Remove all section headings
  for (const heading of CHARACTER_DOC_HEADINGS) {
    cleanedText = cleanedText.replace(new RegExp(heading.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '')
  }
  
  // Remove all placeholder occurrences
  cleanedText = cleanedText.replace(new RegExp(DEFAULT_PLACEHOLDER.replace(/[.]/g, '\\.'), 'g'), '')
  
  // Trim and check what's left - should only be the character name (first heading)
  cleanedText = cleanedText.trim()
  
  // Get the character name from the first heading
  const firstHeading = content.content?.[0]?.content?.[0]?.text || ''
  
  // If only the character name remains (or nothing), document is blank
  return cleanedText === firstHeading || cleanedText === ''
}

// Check if a prop doc only contains default placeholder content (no user edits)
function isBlankPropDoc(content: JSONContent): boolean {
  const text = extractAllTextFromDoc(content)
  
  // Build a regex pattern to remove all known headings and placeholder text
  let cleanedText = text
  
  // Remove all section headings
  for (const heading of PROP_DOC_HEADINGS) {
    cleanedText = cleanedText.replace(new RegExp(heading.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '')
  }
  
  // Remove all placeholder occurrences
  cleanedText = cleanedText.replace(new RegExp(DEFAULT_PLACEHOLDER.replace(/[.]/g, '\\.'), 'g'), '')
  
  // Trim and check what's left - should only be the prop name (first heading)
  cleanedText = cleanedText.trim()
  
  // Get the prop name from the first heading
  const firstHeading = content.content?.[0]?.content?.[0]?.text || ''
  
  // If only the prop name remains (or nothing), document is blank
  return cleanedText === firstHeading || cleanedText === ''
}

// Check if an act break doc only contains default placeholder content (no user edits)
function isBlankActBreakDoc(content: JSONContent): boolean {
  const text = extractAllTextFromDoc(content)
  
  // Build a regex pattern to remove all known headings and placeholder text
  let cleanedText = text
  
  // Remove all section headings
  for (const heading of ACT_BREAK_DOC_HEADINGS) {
    cleanedText = cleanedText.replace(new RegExp(heading.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '')
  }
  
  // Remove placeholder texts used in act break docs
  // NOTE: "Describe your act..." is the initial placeholder when Act Break is first created
  const actBreakPlaceholders = [
    'Describe your act...',
    'No script content analyzed yet.',
    'No themes identified yet.',
    'No character arcs identified yet.',
    'Add your own notes about this act here...'
  ]
  for (const placeholder of actBreakPlaceholders) {
    cleanedText = cleanedText.replace(new RegExp(placeholder.replace(/[.]/g, '\\.'), 'g'), '')
  }
  
  // Trim and check what's left - should only be the act name (first heading)
  cleanedText = cleanedText.trim()
  
  // Find the first heading in the document (may not be the first element due to empty paragraphs)
  let firstHeadingText = ''
  if (content.content) {
    for (const node of content.content) {
      if (node.type === 'heading' && node.content?.[0]?.text) {
        firstHeadingText = node.content[0].text
        break
      }
    }
  }
  
  // If only the act name remains (or nothing), document is blank
  return cleanedText === firstHeadingText || cleanedText === ''
}

// Map of section headings to AI content field names for character docs
const CHARACTER_SECTION_TO_FIELD: Record<string, keyof CharacterDocOutput> = {
  'Role in Story': 'roleInStory',
  'Backstory': 'backstory',
  'Psychology Under Stress': 'psychologyUnderStress',
  'Physical Description': 'physicalDescription',
  'Wardrobe Logic': 'wardrobeLogic',
  'Movement / Habits': 'movementHabits',
  'Voice / Speech Patterns': 'voiceSpeechPatterns',
  'Relationship to Environment': 'relationshipToEnvironment',
  'Arc': 'arc'
}

// Map of section headings to AI content field names for prop docs
const PROP_SECTION_TO_FIELD: Record<string, keyof PropDocOutput> = {
  'Function in Plot': 'functionInPlot',
  'Physical Description': 'physicalDescription',
  'Condition': 'condition',
  'Rules / Limitations': 'rulesLimitations',
  'Symbolic Weight': 'symbolicWeight',
  'How Used On Screen': 'howUsedOnScreen'
}

// Map of section headings to AI content field names for act break docs
const ACT_SECTION_TO_FIELD: Record<string, keyof ActBreakDocOutput> = {
  'Plot Summary': 'plotSummary',
  'Themes & Motifs': 'themes',
  'Character Arcs': 'characterArcs'
}

/**
 * Insert AI suggestions into an existing document using fixPreview nodes.
 * This preserves user content while showing AI suggestions with accept/reject UI.
 * 
 * @param existingContent - The current document content (JSONContent)
 * @param aiContent - AI-generated content for sections
 * @param docType - Type of document ('character' | 'prop' | 'actBreak')
 * @param scriptContexts - Optional ScriptContext[] for character/prop citations
 * @param sourceDocRefs - Optional source document refs for actBreak citations
 * @returns Modified content with fixPreview suggestion nodes inserted
 */
function insertAISuggestionsIntoDoc(
  existingContent: JSONContent,
  aiContent: CharacterDocOutput | PropDocOutput | ActBreakDocOutput,
  docType: 'character' | 'prop' | 'actBreak',
  _scriptContexts?: ScriptContext[],
  _sourceDocRefs?: Array<{documentId: string, title: string}>
): JSONContent {
  // Get the appropriate section mapping based on doc type
  const sectionToField = docType === 'character' 
    ? CHARACTER_SECTION_TO_FIELD 
    : docType === 'prop' 
      ? PROP_SECTION_TO_FIELD 
      : ACT_SECTION_TO_FIELD

  // Deep clone the content to avoid mutation
  const content: JSONContent = JSON.parse(JSON.stringify(existingContent))
  
  if (!content.content) return content
  
  // Helper to get citation nodes based on doc type
  // Currently disabled - returns empty array
  const getCitationNodes = (): JSONContent[] => {
    // Citations disabled for now
    return []
  }
  
  const citations = getCitationNodes()
  const hasCitations = citations.length > 0
  
  // Process the document nodes
  const newContent: JSONContent[] = []
  let i = 0
  
  while (i < content.content.length) {
    const node = content.content[i]
    newContent.push(node)
    
    // Check if this is a section heading (level 2)
    if (node.type === 'heading' && node.attrs?.level === 2) {
      const headingText = node.content?.[0]?.text || ''
      const fieldName = sectionToField[headingText as keyof typeof sectionToField]
      
      if (fieldName) {
        // Get the AI suggestion for this section
        const aiSuggestion = aiContent[fieldName as keyof typeof aiContent]
        
        // Get the next node (section content)
        const nextNode = content.content[i + 1]
        
        if (nextNode && aiSuggestion) {
          // Get existing text from the next node
          const existingText = extractAllTextFromNode(nextNode).trim()
          
          // Check if existing content is a placeholder
          const isPlaceholder = existingText === DEFAULT_PLACEHOLDER ||
            existingText === 'No script content analyzed yet.' ||
            existingText === 'No themes identified yet.' ||
            existingText === 'No character arcs identified yet.' ||
            existingText === 'Add your own notes about this act here...'
          
          // Get AI suggestion text (handle arrays for themes/arcs)
          // Type assertion needed because aiContent is a union type
          const suggestionValue = aiSuggestion as string | string[]
          const aiText = Array.isArray(suggestionValue) 
            ? suggestionValue.join(' • ')
            : suggestionValue
          
          // Only add suggestion if AI content is different from existing
          if (isPlaceholder) {
            // Replace placeholder with AI content directly (with citations)
            i++ // Move past the content node we're replacing
            
            if (Array.isArray(suggestionValue)) {
              // Create bullet list for arrays
              const listItems = suggestionValue.map((item: string) => ({
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }]
              }))
              newContent.push({
                type: 'bulletList',
                content: listItems
              })
              // Add citations after the bullet list
              if (hasCitations) {
                newContent.push({
                  type: 'paragraph',
                  content: citations
                })
              }
            } else {
              // Add citations inline with the text
              newContent.push({
                type: 'paragraph',
                content: hasCitations 
                  ? [{ type: 'text', text: aiText }, ...citations]
                  : [{ type: 'text', text: aiText }]
              })
            }
          } else if (existingText !== aiText && aiText !== existingText) {
            // User has custom content - add fixPreview node after existing content
            newContent.push(nextNode) // Keep existing content
            i++ // Move past the content node
            
            // Generate unique diagnostic ID for this suggestion
            const diagnosticId = `ai-${docType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            
            // Create a paragraph containing a fixPreview node with citations
            // The fixPreview node shows original vs suggestion with accept/reject buttons
            const fixPreviewContent: JSONContent[] = [
              {
                type: 'fixPreview',
                attrs: {
                  diagnosticId: diagnosticId,
                  originalText: existingText,
                  suggestionText: aiText
                }
              }
            ]
            
            // Add citations after the fixPreview if available
            if (hasCitations) {
              fixPreviewContent.push(...citations)
            }
            
            newContent.push({
              type: 'paragraph',
              content: fixPreviewContent
            })
          }
        }
      }
    }
    
    i++
  }
  
  return { ...content, content: newContent }
}

// Helper to extract all text from a single node (recursive)
function extractAllTextFromNode(node: JSONContent): string {
  let text = ''
  if (node.text) {
    text += node.text
  }
  if (node.content) {
    for (const child of node.content) {
      text += extractAllTextFromNode(child)
    }
  }
  return text
}

// Helper to strip character extensions from a character line
// Extensions like (V.O.), (O.S.), (CONT'D), (O.C.), etc. should be removed for matching
function stripCharacterExtensions(characterLine: string): string {
  // Remove common screenplay character extensions
  // This regex matches parenthetical extensions at the end of the name
  // Handles: (V.O.), (O.S.), (CONT'D), (CONT), (O.C.), (PRE-LAP), (FILTERED), etc.
  return characterLine
    .replace(/\s*\([^)]*\)\s*$/g, '') // Remove trailing parentheticals
    .replace(/\s*\([^)]*\)/g, '')     // Remove any remaining parentheticals
    .trim()
}

// Helper to extract character names from document content (for screenplay projects)
function extractCharacterNamesFromContent(content: JSONContent): string[] {
  const characterNames: string[] = []
  
  function traverse(node: JSONContent) {
    // Check if this is a character element
    if (node.type === 'screenplayElement' && node.attrs?.elementType === 'character') {
      // Extract text content
      if (node.content) {
        const textParts: string[] = []
        for (const child of node.content) {
          if (child.type === 'text' && child.text) {
            textParts.push(child.text)
          }
        }
        const fullLine = textParts.join('').trim().toUpperCase()
        // Strip extensions like (V.O.), (O.S.), (CONT'D) to get the base character name
        const name = stripCharacterExtensions(fullLine)
        if (name && !characterNames.includes(name)) {
          characterNames.push(name)
        }
      }
    }
    
    // Traverse children
    if (node.content) {
      node.content.forEach(traverse)
    }
  }
  
  traverse(content)
  return characterNames
}

// Helper to recursively update a single node (character elements, mentions, and their children)
function updateNodeWithCharacterColors(
  node: JSONContent,
  characterLookup: Map<string, { id: string; color: string }>,
  characterIdLookup: Map<string, { name: string; color: string }>
): JSONContent {
  let updatedNode = node
  let nodeChanged = false
  
  // Check if this is a character element that needs updating
  if (node.type === 'screenplayElement' && node.attrs?.elementType === 'character') {
    // Extract text content to match with character
    let textContent = ''
    if (node.content) {
      for (const child of node.content) {
        if (child.type === 'text' && child.text) {
          textContent += child.text
        }
      }
    }
    const fullLine = textContent.trim().toUpperCase()
    // Strip extensions like (V.O.), (O.S.), (CONT'D) to match base character name
    const name = stripCharacterExtensions(fullLine)
    const characterData = characterLookup.get(name)
    
    if (characterData) {
      const currentId = node.attrs.characterId
      const currentColor = node.attrs.characterColor
      
      if (currentId !== characterData.id || currentColor !== characterData.color) {
        updatedNode = {
          ...node,
          attrs: {
            ...node.attrs,
            characterId: characterData.id,
            characterColor: characterData.color
          }
        }
        nodeChanged = true
      }
    }
  }
  
  // Check if this is a character mention that needs updating (color or label)
  if (node.type === 'mention' && node.attrs?.type === 'character') {
    const charId = node.attrs.id
    const charData = characterIdLookup.get(charId)
    
    if (charData) {
      const needsColorUpdate = node.attrs.color !== charData.color
      const needsLabelUpdate = node.attrs.label !== charData.name
      
      if (needsColorUpdate || needsLabelUpdate) {
        updatedNode = {
          ...node,
          attrs: {
            ...node.attrs,
            color: charData.color,
            label: charData.name
          }
        }
        nodeChanged = true
      }
    }
  }
  
  // Recurse into children regardless of whether this node changed
  if (updatedNode.content && updatedNode.content.length > 0) {
    const updatedChildren = updatedNode.content.map(child => 
      updateNodeWithCharacterColors(child, characterLookup, characterIdLookup)
    )
    
    // Check if any children changed
    const childrenChanged = updatedChildren.some((child, i) => child !== updatedNode.content![i])
    
    if (childrenChanged) {
      updatedNode = {
        ...updatedNode,
        content: updatedChildren
      }
      nodeChanged = true
    }
  }
  
  return nodeChanged ? updatedNode : node
}

// Helper to update character elements and mentions in content with characterId and color
function updateCharacterElementsInContent(
  content: JSONContent,
  characterLookup: Map<string, { id: string; color: string }>,
  characterIdLookup?: Map<string, { name: string; color: string }>
): JSONContent {
  if (!content.content) return content
  
  // Create ID lookup if not provided (for backwards compatibility)
  const idLookup = characterIdLookup || new Map<string, { name: string; color: string }>()
  
  const updatedContent = content.content.map(node => 
    updateNodeWithCharacterColors(node, characterLookup, idLookup)
  )
  
  // Check if anything changed
  const changed = updatedContent.some((node, i) => node !== content.content![i])
  
  if (changed) {
    return {
      ...content,
      content: updatedContent
    }
  }
  
  return content
}

// Helper to extract prop names from document content (for screenplay projects)
// Props can appear in action, description, or parenthetical elements
function extractPropNamesFromContent(content: JSONContent, propNames: string[]): string[] {
  const foundProps: string[] = []
  
  function traverse(node: JSONContent) {
    // Check if this node has prop markers
    if (node.type === 'screenplayElement' && node.attrs?.propId) {
      // Extract text content
      if (node.content) {
        const textParts: string[] = []
        for (const child of node.content) {
          if (child.type === 'text' && child.text) {
            textParts.push(child.text)
          }
        }
        const text = textParts.join('').trim().toUpperCase()
        if (text && !foundProps.includes(text)) {
          foundProps.push(text)
        }
      }
    }
    
    // Also check text nodes for known prop names (auto-detection)
    if (node.type === 'text' && node.text) {
      const text = node.text.toUpperCase()
      for (const propName of propNames) {
        if (text.includes(propName.toUpperCase()) && !foundProps.includes(propName.toUpperCase())) {
          foundProps.push(propName.toUpperCase())
        }
      }
    }
    
    // Traverse children
    if (node.content) {
      node.content.forEach(traverse)
    }
  }
  
  traverse(content)
  return foundProps
}

// Helper to recursively update a single node for prop attributes and mentions
function updateNodeWithPropData(
  node: JSONContent,
  propLookup: Map<string, { id: string; icon: string }>,
  propIdLookup: Map<string, { name: string; icon: string }>
): JSONContent {
  let updatedNode = node
  let nodeChanged = false
  
  // Check if this node has prop markers that need updating
  if (node.attrs?.propId) {
    // Extract text content to match with prop
    let textContent = ''
    if (node.content) {
      for (const child of node.content) {
        if (child.type === 'text' && child.text) {
          textContent += child.text
        }
      }
    }
    const name = textContent.trim().toUpperCase()
    const propData = propLookup.get(name)
    
    if (propData) {
      const currentId = node.attrs.propId
      const currentIcon = node.attrs.propIcon
      
      if (currentId !== propData.id || currentIcon !== propData.icon) {
        updatedNode = {
          ...node,
          attrs: {
            ...node.attrs,
            propId: propData.id,
            propIcon: propData.icon,
            propColor: PROP_BRAND_COLOR
          }
        }
        nodeChanged = true
      }
    }
  }
  
  // Check if this is a prop mention that needs updating (label)
  if (node.type === 'mention' && node.attrs?.type === 'prop') {
    const propId = node.attrs.id
    const propData = propIdLookup.get(propId)
    
    if (propData) {
      const needsLabelUpdate = node.attrs.label !== propData.name
      
      if (needsLabelUpdate) {
        updatedNode = {
          ...node,
          attrs: {
            ...node.attrs,
            label: propData.name
          }
        }
        nodeChanged = true
      }
    }
  }
  
  // Recurse into children regardless of whether this node changed
  if (updatedNode.content && updatedNode.content.length > 0) {
    const updatedChildren = updatedNode.content.map(child => 
      updateNodeWithPropData(child, propLookup, propIdLookup)
    )
    
    // Check if any children changed
    const childrenChanged = updatedChildren.some((child, i) => child !== updatedNode.content![i])
    
    if (childrenChanged) {
      updatedNode = {
        ...updatedNode,
        content: updatedChildren
      }
      nodeChanged = true
    }
  }
  
  return nodeChanged ? updatedNode : node
}

// Helper to update prop elements in content with propId and styling
function updatePropElementsInContent(
  content: JSONContent,
  propLookup: Map<string, { id: string; icon: string }>,
  propIdLookup?: Map<string, { name: string; icon: string }>
): JSONContent {
  if (!content.content) return content
  
  // Create ID lookup if not provided (for backwards compatibility)
  const idLookup = propIdLookup || new Map<string, { name: string; icon: string }>()
  
  const updatedContent = content.content.map(node => 
    updateNodeWithPropData(node, propLookup, idLookup)
  )
  
  // Check if anything changed
  const changed = updatedContent.some((node, i) => node !== content.content![i])
  
  if (changed) {
    return {
      ...content,
      content: updatedContent
    }
  }
  
  return content
}

// Helper to extract all asset IDs from document content
function extractAssetIdsFromContent(content: JSONContent): string[] {
  const assetIds: string[] = []
  
  function traverse(node: JSONContent) {
    if (node.type === 'assetImage' && node.attrs?.assetId) {
      assetIds.push(node.attrs.assetId as string)
    }
    if (node.content) {
      node.content.forEach(traverse)
    }
  }
  
  traverse(content)
  return [...new Set(assetIds)] // Return unique IDs
}

// Helper to extract text content from a node
function extractTextFromNode(node: JSONContent): string {
  if (node.type === 'text' && node.text) {
    return node.text
  }
  // Handle mention nodes - extract the label without @ prefix
  if (node.type === 'mention') {
    const label = node.attrs?.label as string
    return label || ''
  }
  if (node.content) {
    return node.content.map(extractTextFromNode).join('')
  }
  return ''
}

// Helper to check if a document contains screenplay elements (scene headings, character, dialogue, etc.)
// Documents without screenplay elements are likely notes/supplementary material
function documentContainsScreenplayElements(content: JSONContent): boolean {
  if (!content.content) return false
  
  for (const node of content.content) {
    if (node.type === 'screenplayElement') {
      const elementType = node.attrs?.elementType as string
      // Check for actual screenplay elements (not just body text)
      if (['scene-heading', 'character', 'dialogue', 'action', 'parenthetical', 'transition', 'shot'].includes(elementType)) {
        return true
      }
    }
  }
  
  return false
}

// Helper to scan a document for character and prop references with scene context
// Returns all references found in the document for both characters and props
function scanDocumentForReferences(
  documentId: string,
  documentTitle: string,
  content: JSONContent,
  characters: Character[],
  props: Prop[]
): { characterRefs: Map<string, ScriptReference[]>; propRefs: Map<string, ScriptReference[]> } {
  const characterRefs = new Map<string, ScriptReference[]>()
  const propRefs = new Map<string, ScriptReference[]>()
  
  // Build lookup maps
  const characterByName = new Map<string, Character>()
  const characterById = new Map<string, Character>()
  for (const char of characters) {
    characterByName.set(char.name.toUpperCase(), char)
    characterById.set(char.id, char)
  }
  
  const propByName = new Map<string, Prop>()
  const propById = new Map<string, Prop>()
  for (const prop of props) {
    propByName.set(prop.name.toUpperCase(), prop)
    propById.set(prop.id, prop)
  }
  
  // Track current scene context as we traverse
  let currentSceneHeading = 'UNKNOWN SCENE'
  let sceneNumber = 0
  
  if (!content.content) return { characterRefs, propRefs }
  
  const nodes = content.content
  
  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
    const node = nodes[nodeIndex]
    
    if (node.type !== 'screenplayElement') continue
    
    const elementType = node.attrs?.elementType as string
    // Use blockId if available, otherwise generate a position-based fallback
    // The fallback allows navigation to work (will scroll to approximate position)
    const blockId = (node.attrs?.blockId as string) || `fallback-${documentId}-${nodeIndex}`
    
    // Update scene context when we hit a scene heading
    if (elementType === 'scene-heading') {
      sceneNumber++
      currentSceneHeading = extractTextFromNode(node).trim() || 'UNKNOWN SCENE'
      continue
    }
    
    // Check for character references via character element
    if (elementType === 'character') {
      const characterIdAttr = node.attrs?.characterId as string | undefined
      
      // Check if this character element contains a mention node
      // The character block may contain @MENTION instead of plain text
      let mentionCharacterId: string | undefined
      let mentionLabel: string | undefined
      if (node.content) {
        for (const child of node.content) {
          if (child.type === 'mention' && child.attrs?.type === 'character') {
            mentionCharacterId = child.attrs.id as string
            mentionLabel = child.attrs.label as string
            break
          }
        }
      }
      
      // Extract text and clean up - remove @ prefix if present (from mentions)
      let characterName = extractTextFromNode(node).trim().toUpperCase()
      if (characterName.startsWith('@')) {
        characterName = characterName.substring(1)
      }
      
      // Use characterId from attrs, or from mention node, or fall back to name lookup
      const effectiveCharacterId = characterIdAttr || mentionCharacterId
      
      // Find character by ID first (from attrs or mention), then by name
      let character = effectiveCharacterId 
        ? characterById.get(effectiveCharacterId) 
        : undefined
      
      // If not found by ID, try by name
      if (!character && characterName) {
        character = characterByName.get(characterName)
      }
      
      // Also try the mention label if available
      if (!character && mentionLabel) {
        character = characterByName.get(mentionLabel.toUpperCase())
      }
      
      if (character) {
        // Look ahead for dialogue to use as context snippet
        let dialoguePreview = ''
        for (let lookAhead = nodeIndex + 1; lookAhead < nodes.length; lookAhead++) {
          const nextNode = nodes[lookAhead]
          if (nextNode.type !== 'screenplayElement') continue
          
          const nextType = nextNode.attrs?.elementType as string
          
          // Skip parentheticals, get the actual dialogue
          if (nextType === 'parenthetical') continue
          
          // Found dialogue - extract preview
          if (nextType === 'dialogue') {
            dialoguePreview = extractTextFromNode(nextNode).trim()
            // Truncate to reasonable length
            if (dialoguePreview.length > 60) {
              dialoguePreview = dialoguePreview.slice(0, 60) + '...'
            }
            break
          }
          
          // Hit another element type, stop looking
          break
        }
        
        const ref: ScriptReference = {
          documentId,
          documentTitle,
          sceneHeading: currentSceneHeading,
          sceneNumber,
          blockId,
          elementType: 'character',
          contextSnippet: dialoguePreview || character.name
        }
        
        const existing = characterRefs.get(character.id) || []
        // Avoid duplicate for same block
        if (!existing.some(r => r.blockId === blockId)) {
          existing.push(ref)
          characterRefs.set(character.id, existing)
        }
      }
    }
    
    // Check for prop references via propId attribute on the element
    if (node.attrs?.propId) {
      const propId = node.attrs.propId as string
      const prop = propById.get(propId)
      
      if (prop) {
        const contextSnippet = extractTextFromNode(node).trim().slice(0, 50)
        const refElementType = (elementType === 'action' || elementType === 'parenthetical') 
          ? elementType as 'action' | 'parenthetical' 
          : 'action'
        const ref: ScriptReference = {
          documentId,
          documentTitle,
          sceneHeading: currentSceneHeading,
          sceneNumber,
          blockId,
          elementType: refElementType,
          contextSnippet: contextSnippet + (contextSnippet.length >= 50 ? '...' : '')
        }
        
        const existing = propRefs.get(prop.id) || []
        if (!existing.some(r => r.blockId === blockId)) {
          existing.push(ref)
          propRefs.set(prop.id, existing)
        }
      }
    }
    
    // Recursively check for @mention nodes within the content of ANY element type
    // This catches character/prop mentions in action, dialogue, parenthetical, etc.
    const scanForMentions = (children: JSONContent[] | undefined) => {
      if (!children) return
      
      for (const child of children) {
        if (child.type === 'mention') {
          const mentionType = child.attrs?.type as string
          const mentionId = child.attrs?.id as string
          
          if (mentionType === 'character' && mentionId) {
            const character = characterById.get(mentionId)
            if (character) {
              const contextSnippet = extractTextFromNode(node).trim().slice(0, 50)
              const refElementType = (elementType === 'action' || elementType === 'parenthetical' || elementType === 'character' || elementType === 'dialogue')
                ? (elementType as ScriptReference['elementType'])
                : 'action'
              const ref: ScriptReference = {
                documentId,
                documentTitle,
                sceneHeading: currentSceneHeading,
                sceneNumber,
                blockId,
                elementType: refElementType,
                contextSnippet: contextSnippet + (contextSnippet.length >= 50 ? '...' : '')
              }
              
              const existing = characterRefs.get(character.id) || []
              // Avoid duplicates for same block
              if (!existing.some(r => r.blockId === blockId)) {
                existing.push(ref)
                characterRefs.set(character.id, existing)
              }
            }
          }
          
          if (mentionType === 'prop' && mentionId) {
            const prop = propById.get(mentionId)
            if (prop) {
              const contextSnippet = extractTextFromNode(node).trim().slice(0, 50)
              const refElementType = (elementType === 'action' || elementType === 'parenthetical')
                ? (elementType as 'action' | 'parenthetical')
                : 'action'
              const ref: ScriptReference = {
                documentId,
                documentTitle,
                sceneHeading: currentSceneHeading,
                sceneNumber,
                blockId,
                elementType: refElementType,
                contextSnippet: contextSnippet + (contextSnippet.length >= 50 ? '...' : '')
              }
              
              const existing = propRefs.get(prop.id) || []
              // Avoid duplicates for same block
              if (!existing.some(r => r.blockId === blockId)) {
                existing.push(ref)
                propRefs.set(prop.id, existing)
              }
            }
          }
        }
        
        // Recurse into nested content
        if (child.content) {
          scanForMentions(child.content)
        }
      }
    }
    
    scanForMentions(node.content)
  }
  
  return { characterRefs, propRefs }
}

// Helper to extract expanded script context for a character/prop from script references
// This function gathers full content blocks where the entity appears, including surrounding context
function extractScriptContextForEntity(
  _entityId: string, // Reserved for future use (e.g., filtering by specific entity)
  _entityType: 'character' | 'prop', // Reserved for future use (e.g., context-aware extraction)
  references: ScriptReference[],
  documents: Record<string, DocumentState>
): ScriptContext[] {
  const contexts: ScriptContext[] = []
  const seenBlocks = new Set<string>() // Deduplicate by blockId

  for (const ref of references) {
    // Skip if we've already processed this block
    if (seenBlocks.has(ref.blockId)) continue
    seenBlocks.add(ref.blockId)

    const docState = documents[ref.documentId]
    if (!docState?.content?.content) continue

    const nodes = docState.content.content
    
    // Find the node with this blockId
    let targetNodeIndex = -1
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (node.attrs?.blockId === ref.blockId) {
        targetNodeIndex = i
        break
      }
    }

    // If not found by blockId, try to find by fallback position
    if (targetNodeIndex === -1 && ref.blockId.startsWith('fallback-')) {
      const parts = ref.blockId.split('-')
      const fallbackIndex = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(fallbackIndex) && fallbackIndex < nodes.length) {
        targetNodeIndex = fallbackIndex
      }
    }

    if (targetNodeIndex === -1) continue

    const targetNode = nodes[targetNodeIndex]
    const elementType = targetNode.attrs?.elementType as string
    const content = extractTextFromNode(targetNode).trim()

    // Build surrounding context - look backward and forward for context
    const surroundingParts: string[] = []
    
    // Look back up to 3 elements for context (but stop at scene heading)
    for (let i = Math.max(0, targetNodeIndex - 3); i < targetNodeIndex; i++) {
      const node = nodes[i]
      if (node.type !== 'screenplayElement') continue
      const nodeType = node.attrs?.elementType as string
      // Stop at scene heading - it's already in ref.sceneHeading
      if (nodeType === 'scene-heading') continue
      const text = extractTextFromNode(node).trim()
      if (text) {
        surroundingParts.push(`[${nodeType.toUpperCase()}] ${text}`)
      }
    }

    // Look forward up to 3 elements for context (but stop at next scene heading)
    for (let i = targetNodeIndex + 1; i < Math.min(nodes.length, targetNodeIndex + 4); i++) {
      const node = nodes[i]
      if (node.type !== 'screenplayElement') continue
      const nodeType = node.attrs?.elementType as string
      // Stop at next scene heading
      if (nodeType === 'scene-heading') break
      const text = extractTextFromNode(node).trim()
      if (text) {
        surroundingParts.push(`[${nodeType.toUpperCase()}] ${text}`)
      }
    }

    // Map element type to ScriptReferenceElementType
    let mappedElementType: ScriptReferenceElementType = 'action'
    if (elementType === 'character' || elementType === 'dialogue' || 
        elementType === 'action' || elementType === 'parenthetical') {
      mappedElementType = elementType as ScriptReferenceElementType
    }

    contexts.push({
      sceneHeading: ref.sceneHeading,
      elementType: mappedElementType,
      content: content,
      surroundingContext: surroundingParts.length > 0 ? surroundingParts.join('\n') : undefined,
      // Preserve source references for citations
      sourceDocumentId: ref.documentId,
      sourceBlockId: ref.blockId,
      sourceDocumentTitle: ref.documentTitle
    })
  }

  return contexts
}

// Document hierarchy types
export type DocumentHierarchyType = 'document' | 'page' | 'note'

/**
 * Determines the hierarchy type of a document based on its nesting level:
 * - 'document': Top-level (no parent)
 * - 'page': Child of a document (parent has no parentId)
 * - 'note': Child of a page (parent has a parentId)
 */
export function getDocumentHierarchyType(
  doc: ProjectDocument,
  allDocs: ProjectDocument[]
): DocumentHierarchyType {
  // Explicitly marked as a note
  if (doc.isNote) {
    return 'note'
  }
  
  // No parent = top-level document
  if (!doc.parentId) {
    return 'document'
  }
  
  // Find the parent
  const parent = allDocs.find(d => d.id === doc.parentId)
  if (!parent) {
    // Parent not found, treat as document
    return 'document'
  }
  
  // If parent has no parentId, this is a page
  if (!parent.parentId) {
    return 'page'
  }
  
  // Special case: if parent is an Act break, treat children as pages (not notes)
  // This allows screenplay pages to be organized under Act breaks
  if (parent.isActBreak) {
    return 'page'
  }
  
  // Parent has a parentId, so this is a note
  return 'note'
}

/**
 * Gets the 1-based page number for a document within its parent.
 * Only meaningful for 'page' type documents.
 */
export function getPageNumber(
  doc: ProjectDocument,
  allDocs: ProjectDocument[]
): number {
  if (!doc.parentId) return 0
  
  // Get all siblings (documents with same parent)
  const siblings = allDocs
    .filter(d => d.parentId === doc.parentId && d.type === 'document')
    .sort((a, b) => a.order - b.order)
  
  // Find this document's position (1-based)
  const index = siblings.findIndex(d => d.id === doc.id)
  return index + 1
}

/**
 * Determines if sub-documents can be created under this document.
 * Only explicitly-flagged notes and special docs (character/prop notes) cannot have children.
 * Regular documents at any nesting depth can accept children.
 */
export function canCreateSubDocument(
  doc: ProjectDocument,
  _allDocs: ProjectDocument[]
): boolean {
  if (doc.isNote || doc.isCharacterNote || doc.isPropNote) return false
  return true
}

/**
 * Gets the parent document for display purposes.
 * Returns null for top-level documents.
 */
export function getParentDocument(
  doc: ProjectDocument,
  allDocs: ProjectDocument[]
): ProjectDocument | null {
  if (!doc.parentId) return null
  return allDocs.find(d => d.id === doc.parentId) || null
}

interface DocumentState {
  content: JSONContent | null
  isDirty: boolean
  lastSaved: string | null
  titleFontFamily?: string // Font family from the first H1
}

interface UIState {
  leftSidebarOpen: boolean
  rightSidebarOpen: boolean
  bottomPanelOpen: boolean
  bottomPanelHeight: number
  leftSidebarWidth: number
  rightSidebarWidth: number
  storyboardPanelWidth: number
  activeModal: 'template-picker' | 'settings' | 'export' | null
  isBuilding: boolean
  viewZoom: number // Zoom percentage (50-200)
  theme: 'dark' | 'light'
  readerMode: boolean // Reader mode preview
  writingPartnerPanelOpen: boolean // Writing Partner panel
  isRunningCritique: boolean // Running dramatic critique analysis
  settingsPanelOpen: boolean // Project settings panel
  drawingMode: boolean // Freehand drawing overlay active
  infiniteCanvas: boolean // Infinite canvas mode - free scroll in all directions
  thoughtPartnerPanelOpen: boolean // Thought Partner chat panel
  thoughtPartnerPanelWidth: number
  thoughtPartnerTextSize: number // Text size in px (12-20)
}

// Citation navigation state
interface CitationTarget {
  blockId: string
  timestamp: number // Used to trigger effect even if same block
}

// Pending fix request state
interface PendingFixRequest {
  diagnostic: Diagnostic
  timestamp: number // Used to trigger effect even for same diagnostic
}

// Batch fix mode state
interface BatchFixState {
  active: boolean
  diagnostics: Diagnostic[]
  timestamp: number
}

// Mention suggestion for scan feature
export interface MentionSuggestion {
  id: string
  documentId: string
  originalText: string
  mentionId: string
  mentionType: 'character' | 'prop'
  mentionLabel: string
  mentionColor: string
  range: { from: number; to: number }
}

// Mention scan state (for "Scan for mentions" feature)
interface MentionScanState {
  active: boolean
  suggestions: MentionSuggestion[]
  timestamp: number
}

// Range navigation state (for "Go to issue")
interface ScrollTargetRange {
  from: number
  to: number
  timestamp: number // Used to trigger effect even for same range
}

// Version history mode state
interface VersionHistoryMode {
  active: boolean
  selectedVersionId: string | null
}

// Storyboard playback state
export type PlaybackSpeed = 0.75 | 1 | 1.25 | 1.5

interface StoryboardPlaybackState {
  isPlaying: boolean
  currentShotIndex: number
  currentTime: number         // Progress within current shot (0-1)
  speed: PlaybackSpeed
}

// Storyboard link mode state
interface StoryboardLinkMode {
  active: boolean
  targetShotId: string | null // Shot being linked
}

// Storyboard UI state
interface StoryboardUIState {
  mode: boolean               // Is storyboard split view active
  linkMode: StoryboardLinkMode
  highlightedBlockId: string | null
  highlightedDocumentId: string | null
}

// Image generation modal state
interface ImageGenerationModalState {
  isOpen: boolean
  selectedText: string
  mentions: ExtractedMention[]
  surroundingContext?: SurroundingScriptContext
}

// Scene heading entry for table of contents
export interface SceneHeadingEntry {
  blockId: string
  text: string
  sceneNumber: number
}

interface ProjectState {
  // Project data
  currentProject: Project | null
  activeDocumentId: string | null
  documents: Record<string, DocumentState>
  assets: Asset[]

  // Build state
  lastBuildResult: BuildResult | null
  diagnostics: Diagnostic[]

  // UI state
  ui: UIState
  expandedFolders: Set<string>
  isLoading: boolean
  error: string | null
  
  // Citation navigation state
  scrollTargetBlock: CitationTarget | null
  
  // Range navigation state (for "Go to issue")
  scrollTargetRange: ScrollTargetRange | null
  
  // Fix preview state
  pendingFixRequest: PendingFixRequest | null
  
  // Batch fix mode state
  batchFixState: BatchFixState | null
  
  // Mention scan state
  mentionScanState: MentionScanState | null
  
  // Version history state
  documentVersions: Record<string, DocumentVersion[]>
  versionHistoryMode: VersionHistoryMode
  
  // Storyboard state (for screenplay projects)
  storyboardPlayback: StoryboardPlaybackState
  storyboardUI: StoryboardUIState
  
  // Agenda items state (for NotesJournal todo tracking)
  agendaItems: AgendaItem[]

  // Image generation modal state
  imageGenerationModal: ImageGenerationModalState

  // Script reference tracking state (for screenplay projects)
  characterReferences: CharacterReferences
  propReferences: PropReferences

  // Scene headings for table of contents (screenplay projects)
  sceneHeadings: Record<string, SceneHeadingEntry[]>

  // Writing Partner / Dramatic Critique state
  critiqueIssues: CritiqueIssue[]
  critiqueResolutions: StoredCritiqueResolution[]  // Persisted resolutions

  // Gated Writing Partner state (scene classification & eligibility)
  sceneState: SceneState | null
  characterEligibility: CharacterEligibility[]
  lastPipelineResult: PipelineResult | null

  // Thought Partner state (conversational AI)
  thoughtPartner: {
    conversationIndex: Array<{ id: string; title: string; createdAt: string; updatedAt: string; messageCount: number }>
    activeConversationId: string | null
    isConversationListOpen: boolean
    messages: Array<{ id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }>
    contextDocument: {
      decisions: string[]
      openQuestions: string[]
      ideas: string[]
      risks: string[]
      considerations: string[]
      lastUpdated: string
    }
    suggestions: Array<{ id: string; title: string; description: string; category: string; prompt: string }>
    isStreaming: boolean
    streamingContent: string
    isLoadingSuggestions: boolean
    _suggestionsContentHash: string
    pendingActions: any[]
    pendingEditorInsertion: { actionId: string; mode: 'insert' | 'replace' | 'delete'; screenplayElements?: any[]; text?: string; insertionPoint: 'cursor' | 'start' | 'end' | 'after-heading'; afterHeading?: string; targetHeading?: string; targetText?: string; pipelineOps?: any[]; anchorBlockId?: string; originalText?: string; opWhy?: string } | null
    agentMode: boolean
    autoAcceptEdits: boolean
    activeQuestion: any | null
    selectionContext: { text: string; documentId: string; documentTitle: string } | null
    referencedDocuments: Array<{ id: string; title: string }>
    // Pipeline state
    usePipeline: boolean
    pipelineState: string
    documentBlockContext: import('../../shared/thoughtPartnerPipelineTypes').DocumentBlockContext | null
    structuredMemory: import('../../shared/thoughtPartnerPipelineTypes').StructuredMemory | null
    currentPipelineActions: import('../../shared/thoughtPartnerPipelineTypes').PipelineAction[]
    consecutiveChatTurns: number
    // Behavior policy (adaptive behavior layer)
    messageFeedback: Record<string, import('../../shared/behaviorPolicyTypes').FeedbackSignal>
    currentBehaviorVector: import('../../shared/behaviorPolicyTypes').BehaviorVector | null
    lastResponseMeta: { expressedDimensions?: Partial<Record<string, number>>; behaviorVectorUsed?: Record<string, number> } | null
    // Cursor context (selection-aware focus window)
    cursorContext: import('../../shared/cursorContextTypes').CursorContext | null
    useCursorContext: boolean
    cursorContextRadius: number
  }

  // Actions
  initialize: () => Promise<void>
  createProject: (template: Template, name: string, basePath: string) => Promise<void>
  openProject: (projectPath: string) => Promise<void>
  importProject: (sourcePath: string, destinationBasePath: string) => Promise<void>
  closeProject: () => void
  
  // Document actions
  setActiveDocument: (docId: string | null) => void
  loadDocumentContent: (docId: string) => Promise<void>
  updateDocumentContent: (docId: string, content: JSONContent) => void
  updateDocumentTitleFont: (docId: string, fontFamily: string | null) => void
  saveDocument: (docId: string) => Promise<void>
  createDocument: (title: string, parentId?: string, screenplayDocType?: 'title-page' | 'page' | 'break', isNote?: boolean, useJournalToolbar?: boolean) => Promise<void>
  deleteDocument: (docId: string) => Promise<void>
  renameDocument: (docId: string, newTitle: string) => Promise<void>
  reorderDocuments: (documentIds: string[]) => Promise<void>
  moveDocument: (docId: string, newParentId: string | undefined, newOrder?: number) => Promise<void>
  
  // Project actions
  renameProject: (newName: string) => Promise<void>
  updateProjectSettings: (settings: Partial<import('../types/project').ProjectSettings>) => Promise<void>
  
  // Asset actions
  addAsset: (filePath: string, fileName: string, category?: 'general' | 'storyboard') => Promise<void>
  addAssetFromBuffer: (buffer: ArrayBuffer, fileName: string, mimeType: string, category?: 'general' | 'storyboard') => Promise<void>
  removeAsset: (assetId: string) => Promise<void>
  updateAssetCategory: (assetId: string, category: 'general' | 'storyboard') => Promise<void>
  addAssetReference: (assetId: string, documentId: string) => void
  removeAssetReference: (assetId: string, documentId: string) => void
  syncAssetReferences: (documentId: string, content: JSONContent) => void
  
  // Scene headings extraction (for screenplay TOC)
  extractSceneHeadings: (documentId: string, content: JSONContent) => void
  
  // Sticker actions (for NotesJournal)
  addSticker: (documentId: string, assetId: string, x: number, y: number, width: number, height: number) => Promise<void>
  updateStickerPosition: (stickerId: string, x: number, y: number) => Promise<void>
  updateStickerSize: (stickerId: string, width: number, height: number) => Promise<void>
  updateStickerRotation: (stickerId: string, rotation: number) => Promise<void>
  removeSticker: (stickerId: string) => Promise<void>
  getStickersForDocument: (documentId: string) => Sticker[]

  // Drawing actions (NotesJournal freehand drawing)
  saveDrawingPaths: (documentId: string, paths: import('../types/project').DrawingPath[]) => Promise<void>
  getDrawingForDocument: (documentId: string) => import('../types/project').DrawingPath[]
  clearDrawing: (documentId: string) => Promise<void>
  toggleDrawingMode: () => void
  setDrawingMode: (mode: boolean) => void

  // Folder expand/collapse (Project Explorer)
  toggleFolder: (folderId: string) => void
  setExpandedFolders: (folders: Set<string>) => void

  // Workspace state persistence
  initializeWorkspaceState: () => Promise<void>
  saveWorkspaceLayout: () => void
  saveDocumentViewState: (docId: string, viewState: import('../../shared/workspaceStateTypes').DocumentViewState) => void

  // UI actions
  toggleLeftSidebar: () => void
  toggleRightSidebar: () => void
  toggleBottomPanel: () => void
  setBottomPanelHeight: (height: number) => void
  setLeftSidebarWidth: (width: number) => void
  setRightSidebarWidth: (width: number) => void
  setStoryboardPanelWidth: (width: number) => void
  setActiveModal: (modal: UIState['activeModal']) => void
  
  // View zoom actions
  setViewZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  initializeZoom: () => Promise<void>
  initializePanelWidths: () => Promise<void>

  // Reader mode actions
  toggleReaderMode: () => void
  setReaderMode: (mode: boolean) => void

  // Infinite canvas actions
  toggleInfiniteCanvas: () => void
  setInfiniteCanvas: (mode: boolean) => void

  // Settings panel actions
  toggleSettingsPanel: () => void
  setSettingsPanelOpen: (open: boolean) => void

  // Thought Partner actions
  toggleThoughtPartnerPanel: () => void
  setThoughtPartnerPanelWidth: (width: number) => void
  setThoughtPartnerTextSize: (size: number) => void
  sendThoughtPartnerMessage: (text: string) => Promise<void>
  editThoughtPartnerMessage: (messageId: string, newText: string) => Promise<void>
  regenerateThoughtPartnerResponse: () => Promise<void>
  loadThoughtPartnerConversationIndex: () => Promise<void>
  loadThoughtPartnerConversation: () => Promise<void>
  switchThoughtPartnerConversation: (conversationId: string) => Promise<void>
  createThoughtPartnerConversation: () => Promise<void>
  deleteThoughtPartnerConversation: (conversationId: string) => Promise<void>
  clearThoughtPartnerConversation: () => Promise<void>
  toggleThoughtPartnerConversationList: () => void
  generateThoughtPartnerSuggestions: () => Promise<void>
  appendThoughtPartnerStreamChunk: (chunk: string) => void
  finalizeThoughtPartnerStream: (message: string, updatedContextDocument?: any, actions?: any[], questions?: any[]) => void
  stopThoughtPartnerStreaming: () => void
  acceptThoughtPartnerAction: (actionId: string) => Promise<void>
  rejectThoughtPartnerAction: (actionId: string) => void
  clearThoughtPartnerEditorInsertion: () => void
  toggleThoughtPartnerAgentMode: () => void
  toggleThoughtPartnerAutoAccept: () => void
  answerThoughtPartnerQuestion: (questionId: string, optionId?: string, customText?: string) => Promise<void>
  skipThoughtPartnerQuestion: (questionId: string) => Promise<void>
  setThoughtPartnerSelectionContext: (context: { text: string; documentId: string; documentTitle: string } | null) => void
  clearThoughtPartnerSelectionContext: () => void
  addThoughtPartnerReference: (doc: { id: string; title: string }) => void
  removeThoughtPartnerReference: (docId: string) => void
  clearThoughtPartnerReferences: () => void
  // Pipeline actions
  setThoughtPartnerUsePipeline: (enabled: boolean) => void
  updateDocumentBlockContext: (context: import('../../shared/thoughtPartnerPipelineTypes').DocumentBlockContext) => void
  setPipelineState: (state: string) => void
  acceptPipelineAction: (actionId: string) => Promise<void>
  rejectPipelineAction: (actionId: string) => void
  approvePlan: (planId: string) => Promise<void>
  revisePlan: (planId: string, feedback: string) => Promise<void>
  rejectPlan: (planId: string) => void
  acceptReflection: (reflectionId: string) => Promise<void>
  editReflection: (reflectionId: string, newInterpretation: string) => Promise<void>
  answerReflectionQuestions: (
    reflectionId: string,
    meaningAnswers: Array<{ questionText: string; answer: string }>,
    executionAnswers: Array<{ questionText: string; answer: string }>
  ) => Promise<void>
  exploreIdea: (ideaCardId: string, expansionPathId?: string) => Promise<void>
  stressTestIdea: (ideaCardId: string) => Promise<void>
  turnIdeaInto: (ideaCardId: string, targetType: 'scene' | 'mechanic') => Promise<void>
  mergeIdeas: (ideaCardIdA: string, ideaCardIdB: string) => Promise<void>
  discardIdea: (ideaCardId: string) => void
  // Cursor context actions (selection-aware focus window)
  updateCursorContext: (context: import('../../shared/cursorContextTypes').CursorContext | null) => void
  toggleUseCursorContext: () => void
  setCursorContextRadius: (radius: number) => void
  // Behavior policy actions (adaptive behavior layer)
  submitMessageFeedback: (messageId: string, signal: import('../../shared/behaviorPolicyTypes').FeedbackSignal) => Promise<void>
  loadBehaviorVector: () => Promise<void>

  // Theme actions
  setTheme: (theme: 'dark' | 'light') => void
  toggleTheme: () => void
  initializeTheme: () => Promise<void>
  
  // Citation navigation actions
  navigateToCitation: (documentId: string, blockId: string) => Promise<void>
  clearScrollTarget: () => void
  
  // Range navigation actions
  navigateToRange: (documentId: string, range: { from: number; to: number }) => Promise<void>
  clearScrollTargetRange: () => void
  
  // Fix preview actions
  requestFix: (diagnostic: Diagnostic) => void
  clearFixRequest: () => void
  removeDiagnostic: (diagnosticId: string) => void
  
  // Batch fix actions
  startBatchFix: (diagnostics: Diagnostic[]) => void
  clearBatchFix: () => void
  
  // Mention scan actions
  scanForMentions: () => Promise<void>
  clearMentionScan: () => void
  
  // Build actions
  runBuild: () => Promise<void>
  runBuildCurrentPage: () => Promise<void>
  regenerateAssetDocs: () => Promise<void>
  regenerateAssetDocsCurrentPage: () => Promise<void>
  removeBlankBlocks: () => void
  clearDiagnostics: () => void
  
  // Character actions (for screenplay projects)
  addCharacter: (name: string, color?: string) => Promise<void>
  updateCharacter: (id: string, updates: Partial<Omit<Character, 'id'>>) => Promise<void>
  removeCharacter: (id: string) => Promise<void>
  getCharacterByName: (name: string) => Character | undefined
  getCharacterById: (id: string) => Character | undefined
  syncCharactersFromDocuments: () => Promise<void>
  updateDocumentCharacterStyling: (docId: string) => void
  navigateToCharacterNote: (characterId: string) => Promise<void>
  
  // Prop actions (for screenplay projects)
  addProp: (name: string, icon?: string) => Promise<void>
  updateProp: (id: string, updates: Partial<Omit<Prop, 'id'>>) => Promise<void>
  removeProp: (id: string) => Promise<void>
  getPropByName: (name: string) => Prop | undefined
  getPropById: (id: string) => Prop | undefined
  syncPropsFromDocuments: () => Promise<void>
  updateDocumentPropStyling: (docId: string) => void
  navigateToPropNote: (propId: string) => Promise<void>
  
  // Script reference tracking actions (for screenplay projects)
  computeAllReferences: () => Promise<void>
  getCharacterReferences: (characterId: string) => ScriptReference[]
  getPropReferences: (propId: string) => ScriptReference[]
  
  // Version history actions
  saveVersion: (docId: string, label?: string) => Promise<void>
  loadVersions: (docId: string) => Promise<void>
  deleteVersion: (docId: string, versionId: string) => Promise<void>
  restoreVersion: (docId: string, versionId: string) => Promise<void>
  setVersionHistoryMode: (active: boolean, selectedVersionId?: string | null) => void
  getVersions: (docId: string) => DocumentVersion[]
  
  // Storyboard actions (for screenplay projects)
  toggleStoryboardMode: () => void
  setStoryboardMode: (active: boolean) => void
  
  // Shot CRUD actions
  addShot: (assetId: string) => Promise<void>
  removeShot: (shotId: string) => Promise<void>
  updateShot: (shotId: string, updates: Partial<StoryboardShot>) => Promise<void>
  reorderShots: (shotIds: string[]) => Promise<void>
  
  // Link mode actions
  startLinkMode: (shotId: string) => void
  cancelLinkMode: () => void
  linkShotToBlock: (shotId: string, anchor: BlockAnchor) => Promise<void>
  unlinkShot: (shotId: string) => Promise<void>
  
  // Playback actions
  playStoryboard: () => void
  pauseStoryboard: () => void
  togglePlayback: () => void
  nextShot: () => void
  prevShot: () => void
  goToShot: (index: number) => Promise<void>
  setPlaybackSpeed: (speed: PlaybackSpeed) => void
  setPlaybackTime: (time: number) => void
  
  // Highlight actions (for editor integration)
  setHighlightedBlock: (blockId: string | null, documentId: string | null) => void
  clearHighlightedBlock: () => void
  
  // Storyboard persistence
  saveStoryboard: () => Promise<void>
  
  // Get shot by ID
  getShot: (shotId: string) => StoryboardShot | undefined
  getShots: () => StoryboardShot[]
  
  // Agenda item actions (for NotesJournal todo tracking)
  loadAgendaItems: () => Promise<void>
  syncDocumentTodos: (docId: string, content: JSONContent) => Promise<void>
  toggleAgendaTodo: (projectPath: string, documentId: string, todoId: string, checked: boolean) => Promise<void>
  markAllAgendaTodosDone: (projectPath: string, documentId: string) => Promise<void>
  updateAgendaItemState: (projectPath: string, documentId: string, state: DocumentLifecycleState, stateNote?: string) => Promise<void>
  removeAgendaItem: (projectPath: string, documentId: string) => Promise<void>
  
  // Image generation modal actions
  openImageGenerationModal: (selectedText: string, mentions: ExtractedMention[], surroundingContext?: SurroundingScriptContext) => void
  closeImageGenerationModal: () => void

  // Writing Partner / Dramatic Critique actions
  toggleWritingPartnerPanel: () => void
  runCritique: () => Promise<void>
  dismissCritiqueIssue: (issueId: string) => void
  clearCritiqueIssues: () => void
  resolveIssue: (issueId: string, resolution: IssueResolution, note?: string) => void
  updateIssueResolution: (issueId: string, resolution: IssueResolution, note?: string) => void

  // Gated Writing Partner actions
  setSceneState: (sceneState: SceneState | null) => void
  setCharacterEligibility: (eligibility: CharacterEligibility[]) => void
  setLastPipelineResult: (result: PipelineResult | null) => void
}

// Debounce timers for workspace state persistence
let _workspaceLayoutSaveTimer: ReturnType<typeof setTimeout> | null = null
let _docViewSaveTimer: ReturnType<typeof setTimeout> | null = null

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  currentProject: null,
  activeDocumentId: null,
  documents: {},
  assets: [],
  lastBuildResult: null,
  diagnostics: [],
  agendaItems: [],
  expandedFolders: new Set<string>(),
  ui: {
    leftSidebarOpen: true,
    rightSidebarOpen: true,
    bottomPanelOpen: false,
    bottomPanelHeight: 320,
    leftSidebarWidth: 345,
    rightSidebarWidth: 320,
    storyboardPanelWidth: 320,
    activeModal: null,
    isBuilding: false,
    viewZoom: 100,
    theme: 'dark',
    readerMode: false,
    writingPartnerPanelOpen: false,
    isRunningCritique: false,
    settingsPanelOpen: false,
    drawingMode: false,
    infiniteCanvas: false,
    thoughtPartnerPanelOpen: false,
    thoughtPartnerPanelWidth: 400,
    thoughtPartnerTextSize: 16
  },
  isLoading: true,
  error: null,
  scrollTargetBlock: null,
  scrollTargetRange: null,
  pendingFixRequest: null,
  batchFixState: null,
  mentionScanState: null,
  documentVersions: {},
  versionHistoryMode: { active: false, selectedVersionId: null },
  
  // Image generation modal initial state
  imageGenerationModal: {
    isOpen: false,
    selectedText: '',
    mentions: [],
  },

  // Storyboard initial state
  storyboardPlayback: {
    isPlaying: false,
    currentShotIndex: 0,
    currentTime: 0,
    speed: 1
  },
  storyboardUI: {
    mode: false,
    linkMode: { active: false, targetShotId: null },
    highlightedBlockId: null,
    highlightedDocumentId: null
  },

  // Script reference tracking initial state
  characterReferences: {},
  propReferences: {},

  // Scene headings for TOC initial state
  sceneHeadings: {},

  // Thought Partner initial state
  thoughtPartner: {
    conversationIndex: [] as Array<{ id: string; title: string; createdAt: string; updatedAt: string; messageCount: number }>,
    activeConversationId: null as string | null,
    isConversationListOpen: false,
    messages: [] as Array<{ id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }>,
    contextDocument: {
      decisions: [] as string[],
      openQuestions: [] as string[],
      ideas: [] as string[],
      risks: [] as string[],
      considerations: [] as string[],
      lastUpdated: new Date().toISOString()
    },
    suggestions: [] as Array<{ id: string; title: string; description: string; category: string; prompt: string }>,
    isStreaming: false,
    streamingContent: '',
    isLoadingSuggestions: false,
    _suggestionsContentHash: '',
    pendingActions: [] as any[],
    pendingEditorInsertion: null as { actionId: string; mode: 'insert' | 'replace'; screenplayElements?: any[]; text?: string; insertionPoint: 'cursor' | 'start' | 'end' | 'after-heading'; afterHeading?: string; targetHeading?: string; targetText?: string } | null,
    agentMode: false,
    autoAcceptEdits: false,
    activeQuestion: null as any | null,
    selectionContext: null as { text: string; documentId: string; documentTitle: string } | null,
    referencedDocuments: [] as Array<{ id: string; title: string }>,
    // Pipeline state
    usePipeline: true,
    pipelineState: 'idle' as string,
    documentBlockContext: null as import('../../shared/thoughtPartnerPipelineTypes').DocumentBlockContext | null,
    structuredMemory: null as import('../../shared/thoughtPartnerPipelineTypes').StructuredMemory | null,
    currentPipelineActions: [] as import('../../shared/thoughtPartnerPipelineTypes').PipelineAction[],
    consecutiveChatTurns: 0,
    // Behavior policy (adaptive behavior layer)
    messageFeedback: {} as Record<string, import('../../shared/behaviorPolicyTypes').FeedbackSignal>,
    currentBehaviorVector: null as import('../../shared/behaviorPolicyTypes').BehaviorVector | null,
    lastResponseMeta: null as { expressedDimensions?: Partial<Record<string, number>>; behaviorVectorUsed?: Record<string, number> } | null,
    // Cursor context (selection-aware focus window)
    cursorContext: null as import('../../shared/cursorContextTypes').CursorContext | null,
    useCursorContext: true,
    cursorContextRadius: 1000,
  },

  // Writing Partner / Dramatic Critique initial state
  critiqueIssues: [],
  critiqueResolutions: [],

  // Gated Writing Partner initial state
  sceneState: null,
  characterEligibility: [],
  lastPipelineResult: null,

  // Initialize app
  initialize: async () => {
    try {
      set({ isLoading: true, error: null })
      
      // Check if this is a fresh app launch or a page refresh
      // sessionStorage persists during refresh but clears on app close/reopen
      const isRefresh = sessionStorage.getItem('cadmus_session_initialized') === 'true'
      
      if (isRefresh) {
        // Page refresh - restore last opened project
        const lastPath = await window.api.project.getLastOpened()
        
        if (lastPath) {
          try {
            const project = await window.api.project.open(lastPath)
            set({ 
              currentProject: project, 
              assets: project.assets,
              isLoading: false 
            })
            
            // For workspaces with derived titles, preload content for child pages
            const workspaceConfig = getWorkspaceConfig(project.templateId)
            if (workspaceConfig.features.deriveTitlesFromContent) {
              const childPages = project.documents.filter(d => d.type === 'document' && d.parentId)
              await Promise.all(childPages.map(async (doc) => {
                try {
                  const content = await window.api.document.load(project.path, doc.id)
                  set(state => ({
                    documents: {
                      ...state.documents,
                      [doc.id]: {
                        content,
                        isDirty: false,
                        lastSaved: new Date().toISOString()
                      }
                    }
                  }))
                } catch (err) {
                  console.error(`Failed to preload document ${doc.id}:`, err)
                }
              }))
            }
            
            // Restore workspace state (active document, panel layout, etc.)
            await get().initializeWorkspaceState()
            if (!get().activeDocumentId && project.documents.length > 0) {
              const firstDoc = project.documents.find(d => d.type === 'document')
              if (firstDoc) {
                await get().setActiveDocument(firstDoc.id)
              }
            }
          } catch {
            // Project doesn't exist anymore, show template picker
            set({ currentProject: null, isLoading: false })
          }
        } else {
          set({ isLoading: false })
        }
      } else {
        // Fresh app launch - show splash screen
        set({ isLoading: false })
      }
      
      // Mark session as initialized (persists through refreshes)
      sessionStorage.setItem('cadmus_session_initialized', 'true')
      
      // Load agenda items for the splashscreen
      await get().loadAgendaItems()
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to initialize',
        isLoading: false 
      })
    }
  },

  // Create new project
  createProject: async (template, name, basePath) => {
    try {
      set({ isLoading: true, error: null })
      
      const project = await window.api.project.create(template, name, basePath)
      
      set({ 
        currentProject: project,
        assets: project.assets,
        documents: {},
        activeDocumentId: null,
        isLoading: false,
        ui: { ...get().ui, activeModal: null }
      })
      
      // Load first document
      if (project.documents.length > 0) {
        const firstDoc = project.documents.find(d => d.type === 'document')
        if (firstDoc) {
          get().setActiveDocument(firstDoc.id)
        }
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create project',
        isLoading: false 
      })
    }
  },

  // Open existing project
  openProject: async (projectPath) => {
    try {
      set({ isLoading: true, error: null })
      
      const project = await window.api.project.open(projectPath)
      
      set({
        currentProject: project,
        assets: project.assets,
        documents: {},
        activeDocumentId: null,
        isLoading: false,
        thoughtPartner: {
          conversationIndex: [],
          activeConversationId: null,
          isConversationListOpen: false,
          messages: [],
          contextDocument: {
            decisions: [],
            openQuestions: [],
            ideas: [],
            risks: [],
            considerations: [],
            lastUpdated: new Date().toISOString()
          },
          suggestions: [],
          isStreaming: false,
          streamingContent: '',
          isLoadingSuggestions: false,
          _suggestionsContentHash: '',
          pendingActions: [],
          pendingEditorInsertion: null,
          agentMode: false,
          autoAcceptEdits: false,
          activeQuestion: null,
          selectionContext: null,
          referencedDocuments: [],
          usePipeline: true,
          pipelineState: 'idle',
          documentBlockContext: null,
          structuredMemory: null,
          currentPipelineActions: [],
          consecutiveChatTurns: 0,
          messageFeedback: {},
          currentBehaviorVector: null,
          lastResponseMeta: null,
          cursorContext: null,
          useCursorContext: true,
          cursorContextRadius: 1000,
        }
      })

      // For workspaces with derived titles, preload content for all child pages
      // so their derived titles are available in the sidebar
      const workspaceConfig = getWorkspaceConfig(project.templateId)
      if (workspaceConfig.features.deriveTitlesFromContent) {
        const childPages = project.documents.filter(d => d.type === 'document' && d.parentId)
        
        // Load content for all child pages in parallel (for derived titles)
        await Promise.all(childPages.map(async (doc) => {
          try {
            const content = await window.api.document.load(project.path, doc.id)
            set(state => ({
              documents: {
                ...state.documents,
                [doc.id]: {
                  content,
                  isDirty: false,
                  lastSaved: new Date().toISOString()
                }
              }
            }))
          } catch (err) {
            console.error(`Failed to preload document ${doc.id}:`, err)
          }
        }))
      }

      // Restore workspace state (active document, panel layout, etc.)
      await get().initializeWorkspaceState()
      if (!get().activeDocumentId && project.documents.length > 0) {
        const firstDoc = project.documents.find(d => d.type === 'document')
        if (firstDoc) {
          get().setActiveDocument(firstDoc.id)
        }
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to open project',
        isLoading: false
      })
    }
  },

  // Import project from another location (copies to destination)
  importProject: async (sourcePath, destinationBasePath) => {
    try {
      set({ isLoading: true, error: null })

      const project = await window.api.project.import(sourcePath, destinationBasePath)

      set({
        currentProject: project,
        assets: project.assets,
        documents: {},
        activeDocumentId: null,
        isLoading: false
      })

      // For workspaces with derived titles, preload content for all child pages
      const workspaceConfig = getWorkspaceConfig(project.templateId)
      if (workspaceConfig.features.deriveTitlesFromContent) {
        const childPages = project.documents.filter(d => d.type === 'document' && d.parentId)
        await Promise.all(childPages.map(async (doc) => {
          try {
            const content = await window.api.document.load(project.path, doc.id)
            set(state => ({
              documents: {
                ...state.documents,
                [doc.id]: {
                  content,
                  isDirty: false,
                  lastSaved: new Date().toISOString()
                }
              }
            }))
          } catch (err) {
            console.error(`Failed to preload document ${doc.id}:`, err)
          }
        }))
      }

      // Load first document
      if (project.documents.length > 0) {
        const firstDoc = project.documents.find(d => d.type === 'document')
        if (firstDoc) {
          get().setActiveDocument(firstDoc.id)
        }
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to import project',
        isLoading: false
      })
    }
  },

  // Close project
  closeProject: () => {
    set({
      currentProject: null,
      activeDocumentId: null,
      documents: {},
      assets: [],
      lastBuildResult: null,
      diagnostics: [],
      thoughtPartner: {
        conversationIndex: [],
        activeConversationId: null,
        isConversationListOpen: false,
        messages: [],
        contextDocument: {
          decisions: [],
          openQuestions: [],
          ideas: [],
          risks: [],
          considerations: [],
          lastUpdated: new Date().toISOString()
        },
        suggestions: [],
        isStreaming: false,
        streamingContent: '',
        isLoadingSuggestions: false,
        _suggestionsContentHash: '',
        pendingActions: [],
        pendingEditorInsertion: null,
        agentMode: false,
        autoAcceptEdits: false,
        activeQuestion: null,
        selectionContext: null,
        referencedDocuments: [],
        usePipeline: true,
        pipelineState: 'idle',
        documentBlockContext: null,
        structuredMemory: null,
        currentPipelineActions: [],
        consecutiveChatTurns: 0,
        messageFeedback: {},
        currentBehaviorVector: null,
        lastResponseMeta: null,
        cursorContext: null,
        useCursorContext: true,
        cursorContextRadius: 1000,
      }
    })
  },

  // Set active document
  setActiveDocument: async (docId) => {
    set({ activeDocumentId: docId })

    // Persist active document to workspace state (replaces sessionStorage approach)
    get().saveWorkspaceLayout()

    if (docId && !get().documents[docId]?.content) {
      await get().loadDocumentContent(docId)
    }
  },

  // Load document content
  loadDocumentContent: async (docId) => {
    const { currentProject, syncCharactersFromDocuments, updateDocumentCharacterStyling } = get()
    if (!currentProject) return

    try {
      const content = await window.api.document.load(currentProject.path, docId)
      
      set(state => ({
        documents: {
          ...state.documents,
          [docId]: {
            content,
            isDirty: false,
            lastSaved: new Date().toISOString()
          }
        }
      }))
      
      // Extract scene headings for screenplay TOC
      if (currentProject.templateId === 'screenplay') {
        get().extractSceneHeadings(docId, content)
      }
      
      // For workspaces with characters panel, sync characters from document and update styling
      const docWorkspaceConfig = getWorkspaceConfig(currentProject.templateId)
      if (docWorkspaceConfig.features.showCharactersPanel) {
        // Sync any new character names to the bank
        await syncCharactersFromDocuments()
        
        // Apply character colors/IDs to the document
        updateDocumentCharacterStyling(docId)
        
        // Save document if styling was updated (check if dirty)
        const updatedDocState = get().documents[docId]
        if (updatedDocState?.isDirty && updatedDocState.content) {
          const projectPath = get().currentProject?.path
          if (projectPath) {
            await window.api.document.save(projectPath, docId, updatedDocState.content)
            set(state => ({
              documents: {
                ...state.documents,
                [docId]: {
                  ...state.documents[docId],
                  isDirty: false,
                  lastSaved: new Date().toISOString()
                }
              }
            }))
          }
        }
      }
    } catch (error) {
      console.error('Failed to load document:', error)
    }
  },

  // Update document content (in memory)
  updateDocumentContent: (docId, content) => {
    set(state => ({
      documents: {
        ...state.documents,
        [docId]: {
          ...state.documents[docId],
          content,
          isDirty: true
        }
      }
    }))
  },

  updateDocumentTitleFont: (docId, fontFamily) => {
    set(state => ({
      documents: {
        ...state.documents,
        [docId]: {
          ...state.documents[docId],
          titleFontFamily: fontFamily || undefined
        }
      }
    }))
  },

  // Save document
  saveDocument: async (docId) => {
    const { currentProject, documents } = get()
    if (!currentProject) return

    const docState = documents[docId]
    if (!docState?.content || !docState.isDirty) return

    try {
      await window.api.document.save(currentProject.path, docId, docState.content)
      
      // Also save the project to persist asset references
      await window.api.project.save(currentProject)
      
      set(state => ({
        documents: {
          ...state.documents,
          [docId]: {
            ...state.documents[docId],
            isDirty: false,
            lastSaved: new Date().toISOString()
          }
        }
      }))
    } catch (error) {
      console.error('Failed to save document:', error)
    }
  },

  // Create new document
  createDocument: async (title, parentId, screenplayDocType, isNote, useJournalToolbar) => {
    const { currentProject } = get()
    if (!currentProject) return

    // Enforce hierarchy rules: notes cannot have children
    if (parentId) {
      const parentDoc = currentProject.documents.find(d => d.id === parentId)
      if (parentDoc && !canCreateSubDocument(parentDoc, currentProject.documents)) {
        console.warn('Cannot create sub-document under a note')
        return
      }
    }

    try {
      const docId = crypto.randomUUID()
      const path = parentId 
        ? `${parentId}/${docId}.json`
        : `${docId}.json`

      const doc: Omit<ProjectDocument, 'createdAt' | 'updatedAt'> = {
        id: docId,
        path,
        title,
        order: currentProject.documents.length,
        type: 'document',
        parentId,
        isNote,
        useJournalToolbar,
        // Mark as act break if screenplayDocType is 'break'
        isActBreak: screenplayDocType === 'break' ? true : undefined
      }

      const newDoc = await window.api.document.create(currentProject.path, doc, currentProject.templateId, screenplayDocType)
      
      // Update project
      const updatedProject = {
        ...currentProject,
        documents: [...currentProject.documents, newDoc]
      }
      
      await window.api.project.save(updatedProject)
      
      set({ currentProject: updatedProject })
      await get().setActiveDocument(docId)
    } catch (error) {
      console.error('Failed to create document:', error)
    }
  },

  // Delete document
  deleteDocument: async (docId) => {
    const { currentProject, activeDocumentId } = get()
    if (!currentProject) return

    try {
      await window.api.document.delete(currentProject.path, docId)
      
      const updatedProject = {
        ...currentProject,
        documents: currentProject.documents.filter(d => d.id !== docId)
      }
      
      await window.api.project.save(updatedProject)
      
      // Update state
      const newDocs = { ...get().documents }
      delete newDocs[docId]

      set({
        currentProject: updatedProject,
        documents: newDocs,
        activeDocumentId: activeDocumentId === docId ? null : activeDocumentId
      })

      // Clean up document view state from workspace
      window.api.workspace?.removeDocumentView(currentProject.path, docId)
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  },

  // Rename document
  renameDocument: async (docId, newTitle) => {
    const { currentProject } = get()
    if (!currentProject) return

    try {
      const updatedProject = {
        ...currentProject,
        documents: currentProject.documents.map(d =>
          d.id === docId ? { ...d, title: newTitle, updatedAt: new Date().toISOString() } : d
        )
      }
      
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
    } catch (error) {
      console.error('Failed to rename document:', error)
    }
  },

  // Reorder documents
  reorderDocuments: async (documentIds) => {
    const { currentProject } = get()
    if (!currentProject) return

    try {
      const updatedProject = {
        ...currentProject,
        documents: currentProject.documents.map(d => ({
          ...d,
          order: documentIds.indexOf(d.id)
        })).sort((a, b) => a.order - b.order)
      }
      
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
    } catch (error) {
      console.error('Failed to reorder documents:', error)
    }
  },

  // Move document to new parent (for nested drag-drop)
  moveDocument: async (docId, newParentId, newOrder) => {
    const { currentProject } = get()
    if (!currentProject) return

    try {
      // Find the document being moved
      const docToMove = currentProject.documents.find(d => d.id === docId)
      if (!docToMove) return

      // Calculate new order if not provided
      let calculatedOrder = newOrder
      if (calculatedOrder === undefined) {
        // Get siblings at the new parent level and append to end
        const newSiblings = currentProject.documents.filter(d => d.parentId === newParentId)
        calculatedOrder = newSiblings.length > 0 
          ? Math.max(...newSiblings.map(d => d.order)) + 1 
          : 0
      }

      const updatedProject = {
        ...currentProject,
        documents: currentProject.documents.map(d => 
          d.id === docId 
            ? { ...d, parentId: newParentId, order: calculatedOrder }
            : d
        )
      }
      
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
    } catch (error) {
      console.error('Failed to move document:', error)
    }
  },

  // Rename project
  renameProject: async (newName) => {
    const { currentProject } = get()
    if (!currentProject) return

    try {
      const updatedProject = {
        ...currentProject,
        name: newName
      }
      
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
    } catch (error) {
      console.error('Failed to rename project:', error)
    }
  },

  // Update project settings
  updateProjectSettings: async (settings) => {
    const { currentProject } = get()
    if (!currentProject) return

    try {
      const updatedProject = {
        ...currentProject,
        settings: {
          ...currentProject.settings,
          ...settings
        }
      }
      
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
    } catch (error) {
      console.error('Failed to update project settings:', error)
    }
  },

  // Add asset
  addAsset: async (filePath, fileName, category = 'general') => {
    const { currentProject } = get()
    if (!currentProject) return

    try {
      const asset = await window.api.asset.upload(currentProject.path, filePath, fileName)
      // Add category to the asset
      const assetWithCategory = { ...asset, category }
      
      set(state => ({
        assets: [...state.assets, assetWithCategory],
        currentProject: state.currentProject 
          ? { ...state.currentProject, assets: [...state.currentProject.assets, assetWithCategory] }
          : null
      }))
    } catch (error) {
      console.error('Failed to add asset:', error)
    }
  },

  // Add asset from buffer (for drag-and-drop)
  addAssetFromBuffer: async (buffer, fileName, mimeType, category = 'general') => {
    const { currentProject } = get()
    if (!currentProject) return

    try {
      const asset = await window.api.asset.uploadFromBuffer(currentProject.path, buffer, fileName, mimeType)
      // Add category to the asset
      const assetWithCategory = { ...asset, category }
      
      set(state => ({
        assets: [...state.assets, assetWithCategory],
        currentProject: state.currentProject 
          ? { ...state.currentProject, assets: [...state.currentProject.assets, assetWithCategory] }
          : null
      }))
    } catch (error) {
      console.error('Failed to add asset from buffer:', error)
    }
  },

  // Update asset category (move between general and storyboard)
  updateAssetCategory: async (assetId, category) => {
    const { currentProject, assets } = get()
    if (!currentProject) return

    try {
      // Find the asset
      const asset = assets.find(a => a.id === assetId)
      if (!asset) return

      // Update the asset in state
      const updatedAssets = assets.map(a => 
        a.id === assetId ? { ...a, category } : a
      )

      set({
        assets: updatedAssets,
        currentProject: {
          ...currentProject,
          assets: updatedAssets
        }
      })

      // Save project to persist the change
      await window.api.project.save({
        ...currentProject,
        assets: updatedAssets
      })
    } catch (error) {
      console.error('Failed to update asset category:', error)
    }
  },

  // Remove asset - also removes from all documents
  removeAsset: async (assetId) => {
    const { currentProject, documents } = get()
    if (!currentProject) return

    try {
      // First, remove the asset images from all loaded documents
      const updatedDocuments: Record<string, DocumentState> = {}
      const docsToSave: string[] = []

      for (const [docId, docState] of Object.entries(documents)) {
        if (docState.content) {
          const updatedContent = removeAssetFromContent(docState.content, assetId)
          // Check if content actually changed (asset was in this document)
          if (JSON.stringify(updatedContent) !== JSON.stringify(docState.content)) {
            updatedDocuments[docId] = {
              ...docState,
              content: updatedContent,
              isDirty: true
            }
            docsToSave.push(docId)
          } else {
            updatedDocuments[docId] = docState
          }
        } else {
          updatedDocuments[docId] = docState
        }
      }

      // Update state with modified documents
      if (docsToSave.length > 0) {
        set({ documents: updatedDocuments })
        
        // Save all affected documents
        for (const docId of docsToSave) {
          const docState = updatedDocuments[docId]
          if (docState?.content) {
            await window.api.document.save(currentProject.path, docId, docState.content)
          }
        }
        
        // Mark documents as saved
        set(state => ({
          documents: Object.fromEntries(
            Object.entries(state.documents).map(([id, doc]) => [
              id,
              docsToSave.includes(id) ? { ...doc, isDirty: false, lastSaved: new Date().toISOString() } : doc
            ])
          )
        }))
      }

      // Now delete the asset file
      await window.api.asset.delete(currentProject.path, assetId)
      
      set(state => ({
        assets: state.assets.filter(a => a.id !== assetId),
        currentProject: state.currentProject 
          ? { ...state.currentProject, assets: state.currentProject.assets.filter(a => a.id !== assetId) }
          : null
      }))
    } catch (error) {
      console.error('Failed to remove asset:', error)
    }
  },

  // Add a reference from an asset to a document
  addAssetReference: (assetId, documentId) => {
    set(state => {
      const assets = state.assets.map(asset => {
        if (asset.id === assetId) {
          // Check if reference already exists
          const hasRef = asset.references.some(ref => ref.documentId === documentId)
          if (!hasRef) {
            return {
              ...asset,
              references: [...asset.references, { documentId }]
            }
          }
        }
        return asset
      })

      const currentProject = state.currentProject
        ? {
            ...state.currentProject,
            assets: state.currentProject.assets.map(asset => {
              if (asset.id === assetId) {
                const hasRef = asset.references.some(ref => ref.documentId === documentId)
                if (!hasRef) {
                  return {
                    ...asset,
                    references: [...asset.references, { documentId }]
                  }
                }
              }
              return asset
            })
          }
        : null

      return { assets, currentProject }
    })
  },

  // Remove a reference from an asset to a document
  removeAssetReference: (assetId, documentId) => {
    set(state => {
      const assets = state.assets.map(asset => {
        if (asset.id === assetId) {
          return {
            ...asset,
            references: asset.references.filter(ref => ref.documentId !== documentId)
          }
        }
        return asset
      })

      const currentProject = state.currentProject
        ? {
            ...state.currentProject,
            assets: state.currentProject.assets.map(asset => {
              if (asset.id === assetId) {
                return {
                  ...asset,
                  references: asset.references.filter(ref => ref.documentId !== documentId)
                }
              }
              return asset
            })
          }
        : null

      return { assets, currentProject }
    })
  },

  // Sync all asset references for a document based on its content
  syncAssetReferences: (documentId, content) => {
    const assetIdsInContent = extractAssetIdsFromContent(content)
    
    set(state => {
      const assets = state.assets.map(asset => {
        const shouldHaveRef = assetIdsInContent.includes(asset.id)
        const hasRef = asset.references.some(ref => ref.documentId === documentId)

        if (shouldHaveRef && !hasRef) {
          // Add reference
          return {
            ...asset,
            references: [...asset.references, { documentId }]
          }
        } else if (!shouldHaveRef && hasRef) {
          // Remove reference
          return {
            ...asset,
            references: asset.references.filter(ref => ref.documentId !== documentId)
          }
        }
        return asset
      })

      const currentProject = state.currentProject
        ? {
            ...state.currentProject,
            assets: assets
          }
        : null

      return { assets, currentProject }
    })
  },

  // Extract scene headings from document content for table of contents
  extractSceneHeadings: (documentId, content) => {
    const headings: SceneHeadingEntry[] = []
    let sceneNumber = 0

    if (content?.content) {
      for (const node of content.content) {
        if (node.type === 'screenplayElement' && node.attrs?.elementType === 'scene-heading') {
          sceneNumber++
          const blockId = node.attrs?.blockId as string
          
          // Extract text from the node
          let text = ''
          if (node.content) {
            for (const child of node.content) {
              if (child.type === 'text' && child.text) {
                text += child.text
              }
            }
          }
          
          if (blockId && text.trim()) {
            headings.push({
              blockId,
              text: text.trim().toUpperCase(),
              sceneNumber
            })
          }
        }
      }
    }

    set(state => ({
      sceneHeadings: {
        ...state.sceneHeadings,
        [documentId]: headings
      }
    }))
  },

  // Sticker actions (for NotesJournal overlay stickers)
  addSticker: async (documentId, assetId, x, y, width, height) => {
    const { currentProject } = get()
    if (!currentProject) return

    const newSticker: Sticker = {
      id: crypto.randomUUID(),
      documentId,
      assetId,
      x,
      y,
      width,
      height,
      zIndex: (currentProject.stickers?.length || 0) + 1
    }

    const updatedProject = {
      ...currentProject,
      stickers: [...(currentProject.stickers || []), newSticker]
    }

    try {
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
      console.log(`[ProjectStore] Added sticker ${newSticker.id} to document ${documentId}`)
    } catch (error) {
      console.error('Failed to add sticker:', error)
    }
  },

  updateStickerPosition: async (stickerId, x, y) => {
    const { currentProject } = get()
    if (!currentProject?.stickers) return

    const updatedProject = {
      ...currentProject,
      stickers: currentProject.stickers.map(s =>
        s.id === stickerId ? { ...s, x, y } : s
      )
    }

    try {
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
    } catch (error) {
      console.error('Failed to update sticker position:', error)
    }
  },

  updateStickerSize: async (stickerId, width, height) => {
    const { currentProject } = get()
    if (!currentProject?.stickers) return

    const updatedProject = {
      ...currentProject,
      stickers: currentProject.stickers.map(s =>
        s.id === stickerId ? { ...s, width, height } : s
      )
    }

    try {
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
    } catch (error) {
      console.error('Failed to update sticker size:', error)
    }
  },

  updateStickerRotation: async (stickerId, rotation) => {
    const { currentProject } = get()
    if (!currentProject?.stickers) return

    const updatedProject = {
      ...currentProject,
      stickers: currentProject.stickers.map(s =>
        s.id === stickerId ? { ...s, rotation } : s
      )
    }

    try {
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
    } catch (error) {
      console.error('Failed to update sticker rotation:', error)
    }
  },

  removeSticker: async (stickerId) => {
    const { currentProject } = get()
    if (!currentProject?.stickers) return

    const updatedProject = {
      ...currentProject,
      stickers: currentProject.stickers.filter(s => s.id !== stickerId)
    }

    try {
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
      console.log(`[ProjectStore] Removed sticker ${stickerId}`)
    } catch (error) {
      console.error('Failed to remove sticker:', error)
    }
  },

  getStickersForDocument: (documentId) => {
    const { currentProject } = get()
    if (!currentProject?.stickers) return []
    return currentProject.stickers.filter(s => s.documentId === documentId)
  },

  // Drawing actions (NotesJournal freehand drawing)
  saveDrawingPaths: async (documentId, paths) => {
    const { currentProject } = get()
    if (!currentProject) return

    const existingDrawings = currentProject.drawings || []
    const existingIndex = existingDrawings.findIndex(d => d.documentId === documentId)

    let updatedDrawings
    if (existingIndex >= 0) {
      updatedDrawings = existingDrawings.map((d, i) =>
        i === existingIndex ? { ...d, paths } : d
      )
    } else {
      updatedDrawings = [...existingDrawings, { documentId, paths }]
    }

    const updatedProject = { ...currentProject, drawings: updatedDrawings }

    try {
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
    } catch (error) {
      console.error('[ProjectStore] Failed to save drawing paths:', error)
    }
  },

  getDrawingForDocument: (documentId) => {
    const { currentProject } = get()
    if (!currentProject?.drawings) return []
    const drawing = currentProject.drawings.find(d => d.documentId === documentId)
    return drawing?.paths || []
  },

  clearDrawing: async (documentId) => {
    const { currentProject } = get()
    if (!currentProject?.drawings) return

    const updatedProject = {
      ...currentProject,
      drawings: currentProject.drawings.filter(d => d.documentId !== documentId)
    }

    try {
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
    } catch (error) {
      console.error('[ProjectStore] Failed to clear drawing:', error)
    }
  },

  // Folder expand/collapse (Project Explorer)
  toggleFolder: (folderId) => {
    set(state => {
      const next = new Set(state.expandedFolders)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return { expandedFolders: next }
    })
    get().saveWorkspaceLayout()
  },

  setExpandedFolders: (folders) => {
    set({ expandedFolders: folders })
  },

  // Workspace state persistence
  initializeWorkspaceState: async () => {
    const { currentProject } = get()
    if (!currentProject?.path) return

    try {
      const workspaceState = await window.api.workspace?.load(currentProject.path)

      if (!workspaceState) {
        // First time opening this project — migrate global panel widths as initial values
        try {
          const globalWidths = await window.api.panelWidths?.get()
          if (globalWidths) {
            set(state => ({
              ui: {
                ...state.ui,
                ...(globalWidths.leftSidebarWidth && { leftSidebarWidth: globalWidths.leftSidebarWidth }),
                ...(globalWidths.rightSidebarWidth && { rightSidebarWidth: globalWidths.rightSidebarWidth }),
                ...(globalWidths.bottomPanelHeight && { bottomPanelHeight: globalWidths.bottomPanelHeight }),
                ...(globalWidths.storyboardPanelWidth && { storyboardPanelWidth: globalWidths.storyboardPanelWidth }),
                ...(globalWidths.thoughtPartnerPanelWidth && { thoughtPartnerPanelWidth: globalWidths.thoughtPartnerPanelWidth }),
              }
            }))
          }

          const globalZoom = await window.api.zoom?.get()
          if (globalZoom && globalZoom >= 50 && globalZoom <= 200) {
            set(state => ({ ui: { ...state.ui, viewZoom: globalZoom } }))
          }
        } catch (err) {
          console.error('[ProjectStore] Migration of global widths failed:', err)
        }

        // Default: expand all parent documents (matching current ProjectExplorer behavior)
        const parentIds = new Set<string>()
        for (const doc of currentProject.documents) {
          if (doc.parentId) parentIds.add(doc.parentId)
        }
        set({ expandedFolders: parentIds })
        return
      }

      const { layout } = workspaceState

      // Rehydrate UI layout state
      set(state => ({
        ui: {
          ...state.ui,
          leftSidebarOpen: layout.leftSidebarOpen,
          rightSidebarOpen: layout.rightSidebarOpen,
          bottomPanelOpen: layout.bottomPanelOpen,
          leftSidebarWidth: layout.leftSidebarWidth,
          rightSidebarWidth: layout.rightSidebarWidth,
          bottomPanelHeight: layout.bottomPanelHeight,
          storyboardPanelWidth: layout.storyboardPanelWidth,
          writingPartnerPanelOpen: layout.writingPartnerPanelOpen,
          settingsPanelOpen: layout.settingsPanelOpen,
          thoughtPartnerPanelOpen: layout.thoughtPartnerPanelOpen,
          thoughtPartnerPanelWidth: layout.thoughtPartnerPanelWidth,
          thoughtPartnerTextSize: layout.thoughtPartnerTextSize,
          readerMode: layout.readerMode,
          drawingMode: layout.drawingMode,
          infiniteCanvas: layout.infiniteCanvas,
          viewZoom: layout.viewZoom,
        },
        expandedFolders: new Set(layout.expandedFolders),
      }))

      // Restore active document
      if (layout.activeDocumentId) {
        const docExists = currentProject.documents.some(
          d => d.id === layout.activeDocumentId
        )
        if (docExists) {
          await get().setActiveDocument(layout.activeDocumentId)
        }
      }
    } catch (err) {
      console.error('[ProjectStore] Failed to load workspace state:', err)
    }
  },

  saveWorkspaceLayout: () => {
    if (_workspaceLayoutSaveTimer) clearTimeout(_workspaceLayoutSaveTimer)
    _workspaceLayoutSaveTimer = setTimeout(() => {
      const { currentProject, ui, activeDocumentId, expandedFolders } = get()
      if (!currentProject?.path) return

      const layout: WorkspaceLayoutState = {
        activeDocumentId,
        leftSidebarOpen: ui.leftSidebarOpen,
        rightSidebarOpen: ui.rightSidebarOpen,
        bottomPanelOpen: ui.bottomPanelOpen,
        leftSidebarWidth: ui.leftSidebarWidth,
        rightSidebarWidth: ui.rightSidebarWidth,
        bottomPanelHeight: ui.bottomPanelHeight,
        storyboardPanelWidth: ui.storyboardPanelWidth,
        writingPartnerPanelOpen: ui.writingPartnerPanelOpen,
        settingsPanelOpen: ui.settingsPanelOpen,
        thoughtPartnerPanelOpen: ui.thoughtPartnerPanelOpen,
        thoughtPartnerPanelWidth: ui.thoughtPartnerPanelWidth,
        thoughtPartnerTextSize: ui.thoughtPartnerTextSize,
        readerMode: ui.readerMode,
        drawingMode: ui.drawingMode,
        infiniteCanvas: ui.infiniteCanvas,
        viewZoom: ui.viewZoom,
        expandedFolders: Array.from(expandedFolders),
      }

      window.api.workspace?.saveLayout(currentProject.path, layout)
    }, 300)
  },

  saveDocumentViewState: (docId, viewState) => {
    if (_docViewSaveTimer) clearTimeout(_docViewSaveTimer)
    _docViewSaveTimer = setTimeout(() => {
      const { currentProject } = get()
      if (!currentProject?.path) return
      window.api.workspace?.saveDocumentView(currentProject.path, docId, viewState)
    }, 500)
  },

  toggleDrawingMode: () => {
    set(state => ({
      ui: { ...state.ui, drawingMode: !state.ui.drawingMode }
    }))
    get().saveWorkspaceLayout()
  },

  setDrawingMode: (mode) => {
    set(state => ({
      ui: { ...state.ui, drawingMode: mode }
    }))
    get().saveWorkspaceLayout()
  },

  // Toggle left sidebar
  toggleLeftSidebar: () => {
    set(state => ({
      ui: { ...state.ui, leftSidebarOpen: !state.ui.leftSidebarOpen }
    }))
    get().saveWorkspaceLayout()
  },

  // Toggle right sidebar
  toggleRightSidebar: () => {
    set(state => ({
      ui: { ...state.ui, rightSidebarOpen: !state.ui.rightSidebarOpen }
    }))
    get().saveWorkspaceLayout()
  },

  // Toggle bottom panel (Problems)
  toggleBottomPanel: () => {
    set(state => ({
      ui: { ...state.ui, bottomPanelOpen: !state.ui.bottomPanelOpen }
    }))
    get().saveWorkspaceLayout()
  },

  // Set bottom panel height
  setBottomPanelHeight: (height) => {
    set(state => ({
      ui: { ...state.ui, bottomPanelHeight: height }
    }))
    get().saveWorkspaceLayout()
  },

  // Set left sidebar width
  setLeftSidebarWidth: (width) => {
    set(state => ({
      ui: { ...state.ui, leftSidebarWidth: width }
    }))
    get().saveWorkspaceLayout()
  },

  // Set right sidebar width
  setRightSidebarWidth: (width) => {
    set(state => ({
      ui: { ...state.ui, rightSidebarWidth: width }
    }))
    get().saveWorkspaceLayout()
  },

  // Set storyboard panel width
  setStoryboardPanelWidth: (width) => {
    set(state => ({
      ui: { ...state.ui, storyboardPanelWidth: width }
    }))
    get().saveWorkspaceLayout()
  },

  // Set active modal
  setActiveModal: (modal) => {
    set(state => ({
      ui: { ...state.ui, activeModal: modal }
    }))
  },

  // View zoom actions
  setViewZoom: (zoom) => {
    // Clamp zoom between 50 and 200
    const clampedZoom = Math.min(200, Math.max(50, zoom))
    set(state => ({
      ui: { ...state.ui, viewZoom: clampedZoom }
    }))
    get().saveWorkspaceLayout()
  },

  zoomIn: () => {
    const { ui } = get()
    const ZOOM_STEPS = [50, 75, 100, 125, 150, 200]
    const currentIndex = ZOOM_STEPS.findIndex(z => z >= ui.viewZoom)
    const nextIndex = Math.min(currentIndex + 1, ZOOM_STEPS.length - 1)
    const newZoom = ZOOM_STEPS[nextIndex]
    set(state => ({
      ui: { ...state.ui, viewZoom: newZoom }
    }))
    get().saveWorkspaceLayout()
  },

  zoomOut: () => {
    const { ui } = get()
    const ZOOM_STEPS = [50, 75, 100, 125, 150, 200]
    const currentIndex = ZOOM_STEPS.findIndex(z => z >= ui.viewZoom)
    const prevIndex = Math.max(currentIndex - 1, 0)
    const newZoom = ZOOM_STEPS[prevIndex]
    set(state => ({
      ui: { ...state.ui, viewZoom: newZoom }
    }))
    get().saveWorkspaceLayout()
  },

  resetZoom: () => {
    set(state => ({
      ui: { ...state.ui, viewZoom: 100 }
    }))
    get().saveWorkspaceLayout()
  },

  initializeZoom: async () => {
    try {
      const savedZoom = await window.api.zoom?.get()
      if (savedZoom && savedZoom >= 50 && savedZoom <= 200) {
        set(state => ({
          ui: { ...state.ui, viewZoom: savedZoom }
        }))
      }
    } catch (error) {
      console.error('[ProjectStore] Failed to initialize zoom:', error)
    }
  },

  initializePanelWidths: async () => {
    try {
      const saved = await window.api.panelWidths?.get()
      if (saved) {
        set(state => ({
          ui: {
            ...state.ui,
            ...(saved.leftSidebarWidth && { leftSidebarWidth: saved.leftSidebarWidth }),
            ...(saved.rightSidebarWidth && { rightSidebarWidth: saved.rightSidebarWidth }),
            ...(saved.bottomPanelHeight && { bottomPanelHeight: saved.bottomPanelHeight }),
            ...(saved.storyboardPanelWidth && { storyboardPanelWidth: saved.storyboardPanelWidth }),
          }
        }))
      }
    } catch (error) {
      console.error('[ProjectStore] Failed to initialize panel widths:', error)
    }
  },

  // Reader mode actions
  toggleReaderMode: () => {
    set(state => ({
      ui: { ...state.ui, readerMode: !state.ui.readerMode }
    }))
    get().saveWorkspaceLayout()
  },

  setReaderMode: (mode) => {
    set(state => ({
      ui: { ...state.ui, readerMode: mode }
    }))
    get().saveWorkspaceLayout()
  },

  // Infinite canvas actions
  toggleInfiniteCanvas: () => {
    set(state => ({
      ui: { ...state.ui, infiniteCanvas: !state.ui.infiniteCanvas }
    }))
    get().saveWorkspaceLayout()
  },

  setInfiniteCanvas: (mode) => {
    set(state => ({
      ui: { ...state.ui, infiniteCanvas: mode }
    }))
    get().saveWorkspaceLayout()
  },

  // Settings panel actions
  toggleSettingsPanel: () => {
    set(state => ({
      ui: { ...state.ui, settingsPanelOpen: !state.ui.settingsPanelOpen }
    }))
    get().saveWorkspaceLayout()
  },

  setSettingsPanelOpen: (open) => {
    set(state => ({
      ui: { ...state.ui, settingsPanelOpen: open }
    }))
    get().saveWorkspaceLayout()
  },

  // Theme actions
  setTheme: (theme) => {
    // Update state
    set(state => ({
      ui: { ...state.ui, theme }
    }))
    // Apply to DOM
    document.documentElement.dataset.theme = theme
    // Persist to electron-store
    window.api.theme?.set(theme)
  },

  toggleTheme: () => {
    const { ui } = get()
    const newTheme = ui.theme === 'dark' ? 'light' : 'dark'
    get().setTheme(newTheme)
  },

  initializeTheme: async () => {
    try {
      const savedTheme = await window.api.theme?.get()
      const theme = savedTheme || 'dark'
      set(state => ({
        ui: { ...state.ui, theme }
      }))
      document.documentElement.dataset.theme = theme
    } catch (error) {
      console.error('[ProjectStore] Failed to initialize theme:', error)
      // Default to dark mode
      document.documentElement.dataset.theme = 'dark'
    }
  },

  // Navigate to a citation source (document and block)
  navigateToCitation: async (documentId, blockId) => {
    const { activeDocumentId, setActiveDocument } = get()
    
    // Switch to the target document first (if needed)
    if (activeDocumentId !== documentId) {
      await setActiveDocument(documentId)
    }
    
    // Set the scroll target after document is active and rendered
    set({ 
      scrollTargetBlock: { 
        blockId, 
        timestamp: Date.now() 
      } 
    })
  },

  // Clear scroll target after scrolling is complete
  clearScrollTarget: () => {
    set({ scrollTargetBlock: null })
  },

  // Navigate to a specific range in a document
  navigateToRange: async (documentId, range) => {
    const { activeDocumentId, setActiveDocument } = get()
    
    // Set the scroll target range first
    set({ 
      scrollTargetRange: { 
        from: range.from,
        to: range.to,
        timestamp: Date.now() 
      } 
    })
    
    // If we need to switch documents, do so
    if (activeDocumentId !== documentId) {
      await setActiveDocument(documentId)
    }
  },

  // Clear scroll target range after scrolling is complete
  clearScrollTargetRange: () => {
    set({ scrollTargetRange: null })
  },

  // Request a fix to be applied (triggers editor to insert fix preview)
  requestFix: (diagnostic) => {
    // First switch to the document containing the diagnostic
    const { activeDocumentId, setActiveDocument } = get()
    
    if (diagnostic.documentId && activeDocumentId !== diagnostic.documentId) {
      setActiveDocument(diagnostic.documentId)
    }
    
    // Remove the diagnostic from the panel immediately when Fix is clicked
    set(state => ({
      diagnostics: state.diagnostics.filter(d => d.id !== diagnostic.id),
      pendingFixRequest: {
        diagnostic,
        timestamp: Date.now()
      }
    }))
  },

  // Clear pending fix request after it's been processed
  clearFixRequest: () => {
    set({ pendingFixRequest: null })
  },

  // Remove a diagnostic from the list (after fix is accepted)
  removeDiagnostic: (diagnosticId) => {
    set(state => ({
      diagnostics: state.diagnostics.filter(d => d.id !== diagnosticId)
    }))
  },

  // Start batch fix mode - shows all fix previews at once
  startBatchFix: (diagnostics) => {
    // Filter to only fixable diagnostics for the active document
    const { activeDocumentId } = get()
    const fixableDiagnostics = diagnostics.filter(d => 
      d.documentId === activeDocumentId &&
      d.suggestions?.[0]?.replacement && 
      d.range
    )
    
    if (fixableDiagnostics.length === 0) return
    
    // Remove these diagnostics from the panel
    set(state => ({
      diagnostics: state.diagnostics.filter(d => 
        !fixableDiagnostics.some(fd => fd.id === d.id)
      ),
      batchFixState: {
        active: true,
        diagnostics: fixableDiagnostics,
        timestamp: Date.now()
      }
    }))
  },

  // Clear batch fix mode
  clearBatchFix: () => {
    set({ batchFixState: null })
  },

  // Scan for mentions - find text that matches character/prop names
  scanForMentions: async () => {
    const { currentProject, documents } = get()
    if (!currentProject || currentProject.templateId !== 'screenplay') return

    const characters = currentProject.characters || []
    const props = currentProject.props || []

    if (characters.length === 0 && props.length === 0) {
      console.log('[ProjectStore] No characters or props to scan for')
      return
    }

    console.log('[ProjectStore] Scanning for mentions...')
    set(state => ({ ui: { ...state.ui, isBuilding: true } }))

    try {
      const suggestions: MentionSuggestion[] = []
      let suggestionCounter = 0

      // Get script documents (not character/prop notes or act breaks)
      const scriptDocs = currentProject.documents.filter(
        doc => !doc.isCharacterNote && !doc.isPropNote && !doc.isActBreak && doc.type === 'document'
      )

      // Load and scan each document
      for (const doc of scriptDocs) {
        let content: JSONContent
        
        if (documents[doc.id]?.content) {
          content = documents[doc.id].content!
        } else {
          try {
            content = await window.api.document.load(currentProject.path, doc.id)
          } catch (error) {
            console.warn(`Failed to load document ${doc.id}:`, error)
            continue
          }
        }

        // Traverse the document content to find text nodes
        const scanNode = (node: JSONContent, basePos: number): number => {
          let pos = basePos

          if (node.type === 'text' && node.text) {
            const text = node.text
            
            // Check for character names
            for (const character of characters) {
              // Create regex that matches whole words only (case insensitive)
              const regex = new RegExp(`\\b${escapeRegex(character.name)}\\b`, 'gi')
              let match
              while ((match = regex.exec(text)) !== null) {
                suggestions.push({
                  id: `mention-${suggestionCounter++}`,
                  documentId: doc.id,
                  originalText: match[0],
                  mentionId: character.id,
                  mentionType: 'character',
                  mentionLabel: character.name,
                  mentionColor: character.color || '#fbbf24',
                  range: { from: pos + match.index, to: pos + match.index + match[0].length }
                })
              }
            }

            // Check for prop names
            for (const prop of props) {
              const regex = new RegExp(`\\b${escapeRegex(prop.name)}\\b`, 'gi')
              let match
              while ((match = regex.exec(text)) !== null) {
                suggestions.push({
                  id: `mention-${suggestionCounter++}`,
                  documentId: doc.id,
                  originalText: match[0],
                  mentionId: prop.id,
                  mentionType: 'prop',
                  mentionLabel: prop.name,
                  mentionColor: '#fbbf24', // Props use amber color
                  range: { from: pos + match.index, to: pos + match.index + match[0].length }
                })
              }
            }

            pos += text.length
          } else if (node.type === 'mention') {
            // Mention nodes count as 1 position
            pos += 1
          } else {
            // For other nodes, handle opening/closing positions
            if (node.content && Array.isArray(node.content)) {
              pos += 1 // Opening position
              for (const child of node.content) {
                pos = scanNode(child, pos)
              }
              pos += 1 // Closing position
            } else if (node.type === 'hardBreak') {
              pos += 1
            } else if (!node.content) {
              // Empty block node (paragraph, etc.)
              pos += 2 // Opening + closing
            }
          }

          return pos
        }

        // Start scanning from position 0 (doc opening position is 0, content starts at 1)
        if (content.content && Array.isArray(content.content)) {
          let pos = 1 // Start after doc opening
          for (const child of content.content) {
            pos = scanNode(child, pos)
          }
        }
      }

      console.log(`[ProjectStore] Found ${suggestions.length} potential mentions`)

      if (suggestions.length === 0) {
        set(state => ({ ui: { ...state.ui, isBuilding: false } }))
        return
      }

      // Set the mention scan state
      set(state => ({
        ui: { ...state.ui, isBuilding: false },
        mentionScanState: {
          active: true,
          suggestions,
          timestamp: Date.now()
        }
      }))

    } catch (error) {
      console.error('[ProjectStore] Scan for mentions failed:', error)
      set(state => ({ ui: { ...state.ui, isBuilding: false } }))
    }
  },

  // Clear mention scan state
  clearMentionScan: () => {
    set({ mentionScanState: null })
  },

  // Run build with pass engine
  runBuild: async () => {
    const { currentProject, documents } = get()
    if (!currentProject) return

    // Open Problems panel and start build
    set(state => ({
      ui: { ...state.ui, isBuilding: true, bottomPanelOpen: true },
      diagnostics: [],
      lastBuildResult: null
    }))

    try {
      // Gather all document contents
      // Load any documents that haven't been loaded yet
      const documentContents: Record<string, JSONContent> = {}
      
      for (const doc of currentProject.documents) {
        if (doc.type !== 'document') continue
        
        // Use cached content if available, otherwise load it
        if (documents[doc.id]?.content) {
          documentContents[doc.id] = documents[doc.id].content!
        } else {
          try {
            const content = await window.api.document.load(currentProject.path, doc.id)
            documentContents[doc.id] = content
          } catch (error) {
            console.warn(`Failed to load document ${doc.id}:`, error)
            // Provide empty content for failed loads
            documentContents[doc.id] = { type: 'doc', content: [] }
          }
        }
      }

      // Call the build IPC
      const result = await window.api.build.run(currentProject, documentContents)

      // Initialize diagnostics with build results
      let allDiagnostics = [...result.diagnostics]

      // Check if API key is configured for AI suggestions
      const hasApiKey = await window.api.aiSuggestions.hasApiKey()
      
      if (hasApiKey) {
        console.log('[ProjectStore] Generating AI suggestions...')
        
        try {
          // Prepare documents for AI analysis with position mappings
          const aiDocumentsWithPositions = currentProject.documents
            .filter(doc => doc.type === 'document')
            .map(doc => {
              const jsonContent = documentContents[doc.id] || { type: 'doc', content: [] }
              const { text, positions } = contentToPlainTextWithPositions(jsonContent)
              return {
                id: doc.id,
                title: doc.title,
                content: text,
                positions // Keep for range conversion later
              }
            })
            .filter(doc => doc.content.length > 0) // Only include non-empty documents
          
          // Create position map for quick lookup
          const positionMap = new Map(aiDocumentsWithPositions.map(doc => [doc.id, doc.positions]))
          
          // Send to AI (without positions)
          const aiDocuments = aiDocumentsWithPositions.map(({ id, title, content }) => ({ id, title, content }))
          
          if (aiDocuments.length > 0) {
            // Generate AI suggestions
            const aiSuggestions = await window.api.aiSuggestions.generate(aiDocuments)
            
            // Fix ranges by converting plain text offsets to document positions
            const fixedSuggestions = aiSuggestions.map(suggestion => {
              if (suggestion.range && suggestion.documentId) {
                const positions = positionMap.get(suggestion.documentId)
                if (positions) {
                  // Convert plain text offsets to TipTap document positions
                  const fromPos = plainTextOffsetToDocPos(suggestion.range.from, positions)
                  const toPos = plainTextOffsetToDocPos(suggestion.range.to, positions)
                  return {
                    ...suggestion,
                    range: { from: fromPos, to: toPos }
                  }
                }
              }
              return suggestion
            })
            
            // Add AI suggestions to diagnostics
            allDiagnostics = [...allDiagnostics, ...fixedSuggestions]
            
            console.log('[ProjectStore] AI suggestions generated:', fixedSuggestions.length)
          }
        } catch (aiError) {
          console.warn('[ProjectStore] AI suggestions failed:', aiError)
          // Don't fail the build if AI suggestions fail
        }

        // Generate AI content for character and prop documents (screenplay only)
        if (currentProject.templateId === 'screenplay') {
          try {
            const characters = currentProject.characters || []
            const props = currentProject.props || []
            
            if (characters.length > 0 || props.length > 0) {
              console.log('[ProjectStore] Generating AI content for character/prop documents...')
              
              // Get candidate documents (exclude character/prop notes and act breaks)
              const candidateDocs = currentProject.documents.filter(doc => 
                doc.type === 'document' && 
                !doc.isCharacterNote && 
                !doc.isPropNote &&
                !doc.isActBreak
              )
              
              // Load all candidate document contents first
              const candidateContents: Map<string, JSONContent> = new Map()
              for (const doc of candidateDocs) {
                try {
                  let content: JSONContent
                  if (documents[doc.id]?.content) {
                    content = documents[doc.id].content!
                  } else {
                    content = await window.api.document.load(currentProject.path, doc.id)
                  }
                  candidateContents.set(doc.id, content)
                } catch (error) {
                  console.warn(`[ProjectStore] Failed to load doc ${doc.id}:`, error)
                }
              }
              
              // Split into script docs (with screenplay elements) and supplementary docs (without)
              const scriptDocs: typeof candidateDocs = []
              const supplementaryDocs: { title: string; content: string }[] = []
              
              for (const doc of candidateDocs) {
                const content = candidateContents.get(doc.id)
                if (!content) continue
                
                // Check if this document contains screenplay elements
                const hasScreenplayElements = documentContainsScreenplayElements(content)
                
                if (hasScreenplayElements && !doc.isNote) {
                  // This is a script document
                  scriptDocs.push(doc)
                } else {
                  // This is a supplementary document (notes, synopsis, etc.)
                  const plainText = contentToPlainText(content)
                  if (plainText.trim().length > 0) {
                    supplementaryDocs.push({
                      title: doc.title,
                      content: plainText
                    })
                    console.log(`[ProjectStore] Added "${doc.title}" as supplementary context`)
                  }
                }
              }
              
              console.log(`[ProjectStore] Found ${scriptDocs.length} script docs and ${supplementaryDocs.length} supplementary docs`)
              
              // Build document state map from loaded contents
              const docStateMap: Record<string, DocumentState> = {}
              for (const doc of scriptDocs) {
                const content = candidateContents.get(doc.id)
                if (content) {
                  docStateMap[doc.id] = { 
                    content: content,
                    isDirty: false,
                    lastSaved: null
                  }
                }
              }
              
              // Scan all script documents for character and prop references
              const allCharacterRefs = new Map<string, ScriptReference[]>()
              const allPropRefs = new Map<string, ScriptReference[]>()
              
              for (const doc of scriptDocs) {
                const content = candidateContents.get(doc.id)
                if (!content) continue
                
                const { characterRefs, propRefs } = scanDocumentForReferences(
                  doc.id,
                  doc.title,
                  content,
                  characters,
                  props
                )
                
                // Merge character refs
                for (const [charId, refs] of characterRefs) {
                  const existing = allCharacterRefs.get(charId) || []
                  allCharacterRefs.set(charId, [...existing, ...refs])
                }
                
                // Merge prop refs
                for (const [propId, refs] of propRefs) {
                  const existing = allPropRefs.get(propId) || []
                  allPropRefs.set(propId, [...existing, ...refs])
                }
              }
              
              // Generate AI content for each character with script references
              for (const character of characters) {
                const refs = allCharacterRefs.get(character.id)
                
                if (!character.noteDocumentId) {
                  console.log(`[ProjectStore] Skipping character "${character.name}" - no noteDocumentId`)
                  continue
                }
                
                if (!refs || refs.length === 0) {
                  console.log(`[ProjectStore] Character "${character.name}" has no script appearances yet`)
                  // Still update the doc if we have supplementary context
                  if (supplementaryDocs.length > 0) {
                    console.log(`[ProjectStore] Attempting to generate from supplementary context only for "${character.name}"`)
                    try {
                      const result = await window.api.documentGeneration.generateCharacter(character.name, [], supplementaryDocs)
                      if (result) {
                        const existingContent = await window.api.document.load(currentProject.path, character.noteDocumentId)
                        const hasUserContent = !isBlankCharacterDoc(existingContent)
                        
                        let noteContent: JSONContent
                        if (hasUserContent && existingContent) {
                          await window.api.version.save(currentProject.path, character.noteDocumentId, existingContent, 'Before AI Update')
                          noteContent = insertAISuggestionsIntoDoc(existingContent, result, 'character', [])
                        } else {
                          noteContent = generateCharacterNoteContent(character.name, result, [])
                        }
                        
                        await window.api.document.save(currentProject.path, character.noteDocumentId, noteContent)
                        set(state => ({
                          documents: {
                            ...state.documents,
                            [character.noteDocumentId!]: {
                              ...state.documents[character.noteDocumentId!],
                              content: noteContent,
                              isDirty: false,
                              lastSaved: new Date().toISOString()
                            }
                          }
                        }))
                        console.log(`[ProjectStore] Generated doc for character "${character.name}" from supplementary context`)
                      }
                    } catch (error) {
                      console.warn(`[ProjectStore] Failed to generate doc for character "${character.name}" from supplementary context:`, error)
                    }
                  }
                  continue
                }
                
                try {
                  const scriptContexts = extractScriptContextForEntity(
                    character.id,
                    'character',
                    refs,
                    docStateMap
                  )
                  
                  if (scriptContexts.length > 0) {
                    console.log(`[ProjectStore] Generating AI content for character "${character.name}" (${scriptContexts.length} contexts, ${supplementaryDocs.length} supplementary docs)`)
                    
                    const result = await window.api.documentGeneration.generateCharacter(character.name, scriptContexts, supplementaryDocs)
                    
                    if (result) {
                      // Load existing document content to check if it has user edits
                      const existingContent = await window.api.document.load(currentProject.path, character.noteDocumentId)
                      const hasUserContent = !isBlankCharacterDoc(existingContent)
                      
                      let noteContent: JSONContent
                      
                      if (hasUserContent && existingContent) {
                        // User has custom content - insert AI suggestions inline instead of overwriting
                        await window.api.version.save(
                          currentProject.path,
                          character.noteDocumentId,
                          existingContent,
                          'Before AI Update'
                        )
                        console.log(`[ProjectStore] Saved version backup for character "${character.name}"`)
                        
                        // Insert AI suggestions as inline recommendations (with citations)
                        noteContent = insertAISuggestionsIntoDoc(existingContent, result, 'character', scriptContexts)
                        console.log(`[ProjectStore] Inserted AI suggestions for character "${character.name}"`)
                      } else {
                        // No user content - generate fresh document with citations
                        noteContent = generateCharacterNoteContent(character.name, result, scriptContexts)
                      }
                      
                      await window.api.document.save(currentProject.path, character.noteDocumentId, noteContent)
                      
                      // Update in-memory state so UI reflects changes immediately
                      set(state => ({
                        documents: {
                          ...state.documents,
                          [character.noteDocumentId!]: {
                            ...state.documents[character.noteDocumentId!],
                            content: noteContent,
                            isDirty: false,
                            lastSaved: new Date().toISOString()
                          }
                        }
                      }))
                      console.log(`[ProjectStore] Updated character doc for "${character.name}"`)
                    }
                  }
                } catch (charError) {
                  console.warn(`[ProjectStore] AI generation failed for character "${character.name}":`, charError)
                }
              }
              
              // Generate AI content for each prop with script references
              for (const prop of props) {
                const refs = allPropRefs.get(prop.id)
                
                if (!prop.noteDocumentId) {
                  console.log(`[ProjectStore] Skipping prop "${prop.name}" - no noteDocumentId`)
                  continue
                }
                
                if (!refs || refs.length === 0) {
                  console.log(`[ProjectStore] Prop "${prop.name}" has no script appearances yet`)
                  // Still update the doc if we have supplementary context
                  if (supplementaryDocs.length > 0) {
                    console.log(`[ProjectStore] Attempting to generate from supplementary context only for prop "${prop.name}"`)
                    try {
                      const result = await window.api.documentGeneration.generateProp(prop.name, [], supplementaryDocs)
                      if (result) {
                        const existingContent = await window.api.document.load(currentProject.path, prop.noteDocumentId)
                        const hasUserContent = !isBlankPropDoc(existingContent)
                        
                        let noteContent: JSONContent
                        if (hasUserContent && existingContent) {
                          await window.api.version.save(currentProject.path, prop.noteDocumentId, existingContent, 'Before AI Update')
                          noteContent = insertAISuggestionsIntoDoc(existingContent, result, 'prop', [])
                        } else {
                          noteContent = generatePropNoteContent(prop.name, result, [])
                        }
                        
                        await window.api.document.save(currentProject.path, prop.noteDocumentId, noteContent)
                        set(state => ({
                          documents: {
                            ...state.documents,
                            [prop.noteDocumentId!]: {
                              ...state.documents[prop.noteDocumentId!],
                              content: noteContent,
                              isDirty: false,
                              lastSaved: new Date().toISOString()
                            }
                          }
                        }))
                        console.log(`[ProjectStore] Generated doc for prop "${prop.name}" from supplementary context`)
                      }
                    } catch (error) {
                      console.warn(`[ProjectStore] Failed to generate doc for prop "${prop.name}" from supplementary context:`, error)
                    }
                  }
                  continue
                }
                
                try {
                  const scriptContexts = extractScriptContextForEntity(
                    prop.id,
                    'prop',
                    refs,
                    docStateMap
                  )
                  
                  if (scriptContexts.length > 0) {
                    console.log(`[ProjectStore] Generating AI content for prop "${prop.name}" (${scriptContexts.length} contexts, ${supplementaryDocs.length} supplementary docs)`)
                    
                    const result = await window.api.documentGeneration.generateProp(prop.name, scriptContexts, supplementaryDocs)
                    
                    if (result) {
                      // Load existing document content to check if it has user edits
                      const existingContent = await window.api.document.load(currentProject.path, prop.noteDocumentId)
                      const hasUserContent = !isBlankPropDoc(existingContent)
                      
                      let noteContent: JSONContent
                      
                      if (hasUserContent && existingContent) {
                        // User has custom content - insert AI suggestions inline instead of overwriting
                        await window.api.version.save(
                          currentProject.path,
                          prop.noteDocumentId,
                          existingContent,
                          'Before AI Update'
                        )
                        console.log(`[ProjectStore] Saved version backup for prop "${prop.name}"`)
                        
                        // Insert AI suggestions as inline recommendations (with citations)
                        noteContent = insertAISuggestionsIntoDoc(existingContent, result, 'prop', scriptContexts)
                        console.log(`[ProjectStore] Inserted AI suggestions for prop "${prop.name}"`)
                      } else {
                        // No user content - generate fresh document with citations
                        noteContent = generatePropNoteContent(prop.name, result, scriptContexts)
                      }
                      
                      await window.api.document.save(currentProject.path, prop.noteDocumentId, noteContent)
                      
                      // Update in-memory state so UI reflects changes immediately
                      set(state => ({
                        documents: {
                          ...state.documents,
                          [prop.noteDocumentId!]: {
                            ...state.documents[prop.noteDocumentId!],
                            content: noteContent,
                            isDirty: false,
                            lastSaved: new Date().toISOString()
                          }
                        }
                      }))
                      console.log(`[ProjectStore] Updated prop doc for "${prop.name}"`)
                    }
                  }
                } catch (propError) {
                  console.warn(`[ProjectStore] AI generation failed for prop "${prop.name}":`, propError)
                }
              }
              
              // Generate AI content for each act break with sibling script content
              // Act breaks are detected by isActBreak flag OR by title pattern (for legacy docs)
              const isActBreakDoc = (d: ProjectDocument) => 
                d.isActBreak || /^act\s*\d+/i.test(d.title)
              
              // Find act breaks and their parent
              const actBreakDocs = currentProject.documents.filter(d => isActBreakDoc(d))
              
              console.log(`[ProjectStore] Found ${actBreakDocs.length} act break documents`)
              
              for (const actBreakDoc of actBreakDocs) {
                try {
                  // Act breaks and screenplay pages are SIBLINGS (both children of title page)
                  const actParentId = actBreakDoc.parentId
                  
                  // Get ALL sibling documents (including act breaks) sorted by order
                  // This gives us the visual ordering in the sidebar
                  const allSiblings = currentProject.documents
                    .filter(d => d.parentId === actParentId && !d.isCharacterNote && !d.isPropNote && !d.isNote)
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                  
                  // Find position of this act break in the sorted list
                  const actBreakIndex = allSiblings.findIndex(d => d.id === actBreakDoc.id)
                  if (actBreakIndex === -1) {
                    console.log(`[ProjectStore] Act break "${actBreakDoc.title}" not found in siblings`)
                    continue
                  }
                  
                  // Find position of next act break (if any)
                  let nextActBreakIndex = allSiblings.length // default to end
                  for (let i = actBreakIndex + 1; i < allSiblings.length; i++) {
                    if (isActBreakDoc(allSiblings[i])) {
                      nextActBreakIndex = i
                      break
                    }
                  }
                  
                  // Collect screenplay pages BETWEEN this act break and the next
                  // These are documents that appear after the act break in the list
                  const actScriptDocs = allSiblings
                    .slice(actBreakIndex + 1, nextActBreakIndex)
                    .filter(d => !isActBreakDoc(d))
                  
                  if (actScriptDocs.length === 0) {
                    console.log(`[ProjectStore] Act break "${actBreakDoc.title}" has no screenplay pages to analyze (index ${actBreakIndex}, next at ${nextActBreakIndex})`)
                    continue
                  }
                  
                  // Collect all script content from sibling docs in this act
                  let actScriptContent = ''
                  for (const scriptDoc of actScriptDocs) {
                    const content = documentContents[scriptDoc.id]
                    if (content) {
                      const plainText = contentToPlainText(content)
                      actScriptContent += `\n\n--- ${scriptDoc.title} ---\n${plainText}`
                    }
                  }
                  
                  if (actScriptContent.trim().length === 0) {
                    console.log(`[ProjectStore] Act break "${actBreakDoc.title}" has empty screenplay pages`)
                    continue
                  }
                  
                  console.log(`[ProjectStore] Generating AI content for act break "${actBreakDoc.title}" (${actScriptDocs.length} screenplay pages)`)
                  
                  const result = await window.api.documentGeneration.generateActBreak(actBreakDoc.title, actScriptContent)
                  
                  if (result) {
                    // Load existing document content to check if it has user edits
                    const existingContent = await window.api.document.load(currentProject.path, actBreakDoc.id)
                    const hasUserContent = !isBlankActBreakDoc(existingContent)
                    
                    let noteContent: JSONContent
                    
                    if (hasUserContent && existingContent) {
                      // User has custom content - insert AI suggestions inline instead of overwriting
                      await window.api.version.save(
                        currentProject.path,
                        actBreakDoc.id,
                        existingContent,
                        'Before AI Update'
                      )
                      console.log(`[ProjectStore] Saved version backup for act break "${actBreakDoc.title}"`)
                      
                      // Create source references for the screenplay pages (for citations)
                      const sourceDocRefs = actScriptDocs.map(d => ({ documentId: d.id, title: d.title }))
                      
                      // Insert AI suggestions as inline recommendations (with citations)
                      noteContent = insertAISuggestionsIntoDoc(existingContent, result, 'actBreak', undefined, sourceDocRefs)
                      console.log(`[ProjectStore] Inserted AI suggestions for act break "${actBreakDoc.title}"`)
                    } else {
                      // No user content - generate fresh document with citations
                      // Create source references for the screenplay pages
                      const sourceDocRefs = actScriptDocs.map(d => ({ documentId: d.id, title: d.title }))
                      noteContent = generateActBreakNoteContent(actBreakDoc.title, result, sourceDocRefs)
                    }
                    
                    await window.api.document.save(currentProject.path, actBreakDoc.id, noteContent)
                    
                    // Update in-memory state so UI reflects changes immediately
                    set(state => ({
                      documents: {
                        ...state.documents,
                        [actBreakDoc.id]: {
                          ...state.documents[actBreakDoc.id],
                          content: noteContent,
                          isDirty: false,
                          lastSaved: new Date().toISOString()
                        }
                      }
                    }))
                    console.log(`[ProjectStore] Updated act break doc for "${actBreakDoc.title}"`)
                  }
                } catch (actError) {
                  console.warn(`[ProjectStore] AI generation failed for act break "${actBreakDoc.title}":`, actError)
                }
              }
              
              console.log('[ProjectStore] AI document generation complete')
            }
          } catch (docGenError) {
            console.warn('[ProjectStore] AI document generation failed:', docGenError)
            // Don't fail the build if document generation fails
          }
        }
      }

      set(state => ({
        ui: { ...state.ui, isBuilding: false },
        lastBuildResult: result,
        diagnostics: allDiagnostics
      }))

      console.log('[ProjectStore] Build complete:', {
        success: result.success,
        diagnosticCount: allDiagnostics.length,
        timing: result.totalTiming
      })
    } catch (error) {
      console.error('[ProjectStore] Build failed:', error)
      
      set(state => ({
        ui: { ...state.ui, isBuilding: false },
        lastBuildResult: {
          success: false,
          diagnostics: [{
            id: 'build-error',
            passId: 'system',
            severity: 'error' as const,
            title: 'Build Failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            documentId: ''
          }],
          passResults: [],
          totalTiming: 0
        },
        diagnostics: [{
          id: 'build-error',
          passId: 'system',
          severity: 'error' as const,
          title: 'Build Failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          documentId: ''
        }]
      }))
    }
  },

  // Run build on current page only
  runBuildCurrentPage: async () => {
    const { currentProject, documents, activeDocumentId } = get()
    if (!currentProject || !activeDocumentId) return

    // Find the active document in the project
    const activeDoc = currentProject.documents.find(doc => doc.id === activeDocumentId)
    if (!activeDoc || activeDoc.type !== 'document') return

    // Open Problems panel and start build
    set(state => ({
      ui: { ...state.ui, isBuilding: true, bottomPanelOpen: true },
      diagnostics: [],
      lastBuildResult: null
    }))

    try {
      // Get content for only the current document
      const documentContents: Record<string, JSONContent> = {}
      
      if (documents[activeDocumentId]?.content) {
        documentContents[activeDocumentId] = documents[activeDocumentId].content!
      } else {
        try {
          const content = await window.api.document.load(currentProject.path, activeDocumentId)
          documentContents[activeDocumentId] = content
        } catch (error) {
          console.warn(`Failed to load document ${activeDocumentId}:`, error)
          documentContents[activeDocumentId] = { type: 'doc', content: [] }
        }
      }

      // Create a modified project with only the current document for the build
      const singleDocProject = {
        ...currentProject,
        documents: [activeDoc]
      }

      // Call the build IPC with only the current document
      const result = await window.api.build.run(singleDocProject, documentContents)

      // Initialize diagnostics with build results
      let allDiagnostics = [...result.diagnostics]

      // Check if API key is configured for AI suggestions
      const hasApiKey = await window.api.aiSuggestions.hasApiKey()
      
      if (hasApiKey) {
        console.log('[ProjectStore] Generating AI suggestions for current page...')
        
        try {
          const jsonContent = documentContents[activeDocumentId] || { type: 'doc', content: [] }
          const { text, positions } = contentToPlainTextWithPositions(jsonContent)
          
          if (text.length > 0) {
            const aiDocuments = [{
              id: activeDocumentId,
              title: activeDoc.title,
              content: text
            }]
            
            // Generate AI suggestions
            const aiSuggestions = await window.api.aiSuggestions.generate(aiDocuments)
            
            // Fix ranges by converting plain text offsets to document positions
            const fixedSuggestions = aiSuggestions.map(suggestion => {
              if (suggestion.range && suggestion.documentId === activeDocumentId) {
                const fromPos = plainTextOffsetToDocPos(suggestion.range.from, positions)
                const toPos = plainTextOffsetToDocPos(suggestion.range.to, positions)
                return {
                  ...suggestion,
                  range: { from: fromPos, to: toPos }
                }
              }
              return suggestion
            })
            
            // Add AI suggestions to diagnostics
            allDiagnostics = [...allDiagnostics, ...fixedSuggestions]
            
            console.log('[ProjectStore] AI suggestions generated:', fixedSuggestions.length)
          }
        } catch (aiError) {
          console.warn('[ProjectStore] AI suggestions failed:', aiError)
        }
      }

      // Update state with results
      set(state => ({
        ui: { ...state.ui, isBuilding: false },
        diagnostics: allDiagnostics,
        lastBuildResult: result
      }))

    } catch (error) {
      console.error('[ProjectStore] Build current page failed:', error)
      set(state => ({
        ui: { ...state.ui, isBuilding: false },
        diagnostics: [{
          id: 'build-error',
          passId: 'system',
          severity: 'error' as const,
          title: 'Build Failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          documentId: ''
        }]
      }))
    }
  },

  // Clear diagnostics
  clearDiagnostics: () => {
    set({ diagnostics: [], lastBuildResult: null })
  },

  // Regenerate asset documents (character/prop docs) with AI
  regenerateAssetDocs: async () => {
    const { currentProject, documents } = get()
    if (!currentProject || currentProject.templateId !== 'screenplay') return

    console.log('[ProjectStore] Regenerating asset documents...')
    set(state => ({ ui: { ...state.ui, isBuilding: true } }))

    try {
      const characters = currentProject.characters || []
      const props = currentProject.props || []
      
      if (characters.length === 0 && props.length === 0) {
        console.log('[ProjectStore] No characters or props to regenerate')
        set(state => ({ ui: { ...state.ui, isBuilding: false } }))
        return
      }

      // Get candidate documents (exclude character/prop notes and act breaks)
      const candidateDocs = currentProject.documents.filter(doc => 
        doc.type === 'document' && 
        !doc.isCharacterNote && 
        !doc.isPropNote &&
        !doc.isActBreak
      )
      
      // Load all candidate document contents first
      const candidateContents: Map<string, JSONContent> = new Map()
      for (const doc of candidateDocs) {
        try {
          let content: JSONContent
          if (documents[doc.id]?.content) {
            content = documents[doc.id].content!
          } else {
            content = await window.api.document.load(currentProject.path, doc.id)
          }
          candidateContents.set(doc.id, content)
        } catch (error) {
          console.warn(`[ProjectStore] Failed to load doc ${doc.id}:`, error)
        }
      }
      
      // Split into script docs (with screenplay elements) and supplementary docs (without)
      const scriptDocs: typeof candidateDocs = []
      const supplementaryDocs: { title: string; content: string }[] = []
      
      for (const doc of candidateDocs) {
        const content = candidateContents.get(doc.id)
        if (!content) continue
        
        // Check if this document contains screenplay elements
        const hasScreenplayElements = documentContainsScreenplayElements(content)
        
        if (hasScreenplayElements && !doc.isNote) {
          // This is a script document
          scriptDocs.push(doc)
        } else {
          // This is a supplementary document (notes, synopsis, etc.)
          const plainText = contentToPlainText(content)
          if (plainText.trim().length > 0) {
            supplementaryDocs.push({
              title: doc.title,
              content: plainText
            })
            console.log(`[ProjectStore] Added "${doc.title}" as supplementary context`)
          }
        }
      }

      // Build document state map for context extraction
      const docStateMap: Record<string, DocumentState> = {}
      for (const doc of scriptDocs) {
        const content = candidateContents.get(doc.id)
        if (content) {
          docStateMap[doc.id] = {
            content: content,
            isDirty: false,
            lastSaved: null
          }
        }
      }

      // Scan all script documents for character and prop references
      const allCharacterRefs = new Map<string, ScriptReference[]>()
      const allPropRefs = new Map<string, ScriptReference[]>()
      
      for (const doc of scriptDocs) {
        const content = candidateContents.get(doc.id)
        if (!content) continue
        
        const { characterRefs, propRefs } = scanDocumentForReferences(
          doc.id,
          doc.title,
          content,
          characters,
          props
        )
        
        for (const [charId, refs] of characterRefs) {
          const existing = allCharacterRefs.get(charId) || []
          allCharacterRefs.set(charId, [...existing, ...refs])
        }
        
        for (const [propId, refs] of propRefs) {
          const existing = allPropRefs.get(propId) || []
          allPropRefs.set(propId, [...existing, ...refs])
        }
      }

      console.log(`[ProjectStore] Processing ${characters.length} characters, ${props.length} props`)
      console.log(`[ProjectStore] Script docs found: ${scriptDocs.length}, Supplementary docs: ${supplementaryDocs.length}`)
      
      // Generate AI content for each character with script references
      for (const character of characters) {
        const refs = allCharacterRefs.get(character.id)
        
        if (!character.noteDocumentId) {
          console.log(`[ProjectStore] Skipping character "${character.name}" - no noteDocumentId`)
          continue
        }
        
        if (!refs || refs.length === 0) {
          console.log(`[ProjectStore] Character "${character.name}" has no script appearances yet`)
          // Still update the doc if we have supplementary context
          if (supplementaryDocs.length > 0) {
            console.log(`[ProjectStore] Attempting to generate from supplementary context only for "${character.name}"`)
            try {
              // Create minimal context to trigger generation with supplementary docs
              const result = await window.api.documentGeneration.generateCharacter(character.name, [], supplementaryDocs)
              if (result) {
                const existingContent = await window.api.document.load(currentProject.path, character.noteDocumentId)
                const hasUserContent = !isBlankCharacterDoc(existingContent)
                
                let noteContent: JSONContent
                if (hasUserContent && existingContent) {
                  await window.api.version.save(currentProject.path, character.noteDocumentId, existingContent, 'Before AI Update')
                  noteContent = insertAISuggestionsIntoDoc(existingContent, result, 'character', [])
                } else {
                  noteContent = generateCharacterNoteContent(character.name, result, [])
                }
                
                await window.api.document.save(currentProject.path, character.noteDocumentId, noteContent)
                set(state => ({
                  documents: {
                    ...state.documents,
                    [character.noteDocumentId!]: {
                      ...state.documents[character.noteDocumentId!],
                      content: noteContent,
                      isDirty: false,
                      lastSaved: new Date().toISOString()
                    }
                  }
                }))
                console.log(`[ProjectStore] Generated doc for character "${character.name}" from supplementary context`)
              }
            } catch (error) {
              console.warn(`[ProjectStore] Failed to generate doc for character "${character.name}" from supplementary context:`, error)
            }
          }
          continue
        }

        try {
          const scriptContexts = extractScriptContextForEntity(
            character.id,
            'character',
            refs,
            docStateMap
          )

          if (scriptContexts.length > 0) {
            console.log(`[ProjectStore] Regenerating doc for character "${character.name}" (${scriptContexts.length} contexts, ${supplementaryDocs.length} supplementary docs)`)
            
            const result = await window.api.documentGeneration.generateCharacter(character.name, scriptContexts, supplementaryDocs)
            
            if (result) {
              const existingContent = await window.api.document.load(currentProject.path, character.noteDocumentId)
              const hasUserContent = !isBlankCharacterDoc(existingContent)
              
              let noteContent: JSONContent
              
              if (hasUserContent && existingContent) {
                // User has custom content - insert AI suggestions inline (with citations)
                await window.api.version.save(
                  currentProject.path,
                  character.noteDocumentId,
                  existingContent,
                  'Before AI Update'
                )
                noteContent = insertAISuggestionsIntoDoc(existingContent, result, 'character', scriptContexts)
                console.log(`[ProjectStore] Inserted AI suggestions for character "${character.name}"`)
              } else {
                // No user content - generate fresh document with citations
                noteContent = generateCharacterNoteContent(character.name, result, scriptContexts)
              }
              
              await window.api.document.save(currentProject.path, character.noteDocumentId, noteContent)
              
              // Update in-memory state
              set(state => ({
                documents: {
                  ...state.documents,
                  [character.noteDocumentId!]: {
                    ...state.documents[character.noteDocumentId!],
                    content: noteContent,
                    isDirty: false,
                    lastSaved: new Date().toISOString()
                  }
                }
              }))
              console.log(`[ProjectStore] Regenerated doc for character "${character.name}"`)
            }
          }
        } catch (error) {
          console.warn(`[ProjectStore] Failed to regenerate doc for character "${character.name}":`, error)
        }
      }

      // Generate AI content for each prop with script references
      for (const prop of props) {
        const refs = allPropRefs.get(prop.id)
        
        if (!prop.noteDocumentId) {
          console.log(`[ProjectStore] Skipping prop "${prop.name}" - no noteDocumentId`)
          continue
        }
        
        if (!refs || refs.length === 0) {
          console.log(`[ProjectStore] Prop "${prop.name}" has no script appearances yet`)
          // Still update the doc if we have supplementary context
          if (supplementaryDocs.length > 0) {
            console.log(`[ProjectStore] Attempting to generate from supplementary context only for prop "${prop.name}"`)
            try {
              const result = await window.api.documentGeneration.generateProp(prop.name, [], supplementaryDocs)
              if (result) {
                const existingContent = await window.api.document.load(currentProject.path, prop.noteDocumentId)
                const hasUserContent = !isBlankPropDoc(existingContent)
                
                let noteContent: JSONContent
                if (hasUserContent && existingContent) {
                  await window.api.version.save(currentProject.path, prop.noteDocumentId, existingContent, 'Before AI Update')
                  noteContent = insertAISuggestionsIntoDoc(existingContent, result, 'prop', [])
                } else {
                  noteContent = generatePropNoteContent(prop.name, result, [])
                }
                
                await window.api.document.save(currentProject.path, prop.noteDocumentId, noteContent)
                set(state => ({
                  documents: {
                    ...state.documents,
                    [prop.noteDocumentId!]: {
                      ...state.documents[prop.noteDocumentId!],
                      content: noteContent,
                      isDirty: false,
                      lastSaved: new Date().toISOString()
                    }
                  }
                }))
                console.log(`[ProjectStore] Generated doc for prop "${prop.name}" from supplementary context`)
              }
            } catch (error) {
              console.warn(`[ProjectStore] Failed to generate doc for prop "${prop.name}" from supplementary context:`, error)
            }
          }
          continue
        }

        try {
          const scriptContexts = extractScriptContextForEntity(
            prop.id,
            'prop',
            refs,
            docStateMap
          )

          if (scriptContexts.length > 0) {
            console.log(`[ProjectStore] Regenerating doc for prop "${prop.name}" (${scriptContexts.length} contexts, ${supplementaryDocs.length} supplementary docs)`)
            
            const result = await window.api.documentGeneration.generateProp(prop.name, scriptContexts, supplementaryDocs)
            
            if (result) {
              const existingContent = await window.api.document.load(currentProject.path, prop.noteDocumentId)
              const hasUserContent = !isBlankPropDoc(existingContent)
              
              let noteContent: JSONContent
              
              if (hasUserContent && existingContent) {
                // User has custom content - insert AI suggestions inline
                await window.api.version.save(
                  currentProject.path,
                  prop.noteDocumentId,
                  existingContent,
                  'Before AI Update'
                )
                noteContent = insertAISuggestionsIntoDoc(existingContent, result, 'prop', scriptContexts)
                console.log(`[ProjectStore] Inserted AI suggestions for prop "${prop.name}"`)
              } else {
                // No user content - generate fresh document with citations
                noteContent = generatePropNoteContent(prop.name, result, scriptContexts)
              }
              
              await window.api.document.save(currentProject.path, prop.noteDocumentId, noteContent)
              
              // Update in-memory state
              set(state => ({
                documents: {
                  ...state.documents,
                  [prop.noteDocumentId!]: {
                    ...state.documents[prop.noteDocumentId!],
                    content: noteContent,
                    isDirty: false,
                    lastSaved: new Date().toISOString()
                  }
                }
              }))
              console.log(`[ProjectStore] Regenerated doc for prop "${prop.name}"`)
            }
          }
        } catch (error) {
          console.warn(`[ProjectStore] Failed to regenerate doc for prop "${prop.name}":`, error)
        }
      }

      // Generate AI content for each act break with sibling script content
      // Act breaks are detected by isActBreak flag OR by title pattern (for legacy docs)
      const isActBreakDoc = (d: ProjectDocument) => 
        d.isActBreak || /^act\s*\d+/i.test(d.title)
      
      const actBreakDocs = currentProject.documents.filter(d => isActBreakDoc(d))
      
      console.log(`[ProjectStore] Found ${actBreakDocs.length} act break documents for regeneration`)
      
      for (const actBreakDoc of actBreakDocs) {
        try {
          // Act breaks and screenplay pages are SIBLINGS (both children of title page)
          const actParentId = actBreakDoc.parentId
          
          // Get ALL sibling documents (including act breaks) sorted by order
          const allSiblings = currentProject.documents
            .filter(d => d.parentId === actParentId && !d.isCharacterNote && !d.isPropNote && !d.isNote)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
          
          // Find position of this act break in the sorted list
          const actBreakIndex = allSiblings.findIndex(d => d.id === actBreakDoc.id)
          if (actBreakIndex === -1) {
            console.log(`[ProjectStore] Act break "${actBreakDoc.title}" not found in siblings`)
            continue
          }
          
          // Find position of next act break (if any)
          let nextActBreakIndex = allSiblings.length
          for (let i = actBreakIndex + 1; i < allSiblings.length; i++) {
            if (isActBreakDoc(allSiblings[i])) {
              nextActBreakIndex = i
              break
            }
          }
          
          // Collect screenplay pages BETWEEN this act break and the next
          const actScriptDocs = allSiblings
            .slice(actBreakIndex + 1, nextActBreakIndex)
            .filter(d => !isActBreakDoc(d))
          
          if (actScriptDocs.length === 0) {
            console.log(`[ProjectStore] Act break "${actBreakDoc.title}" has no screenplay pages to analyze`)
            continue
          }
          
          // Collect all script content from sibling docs in this act
          let actScriptContent = ''
          for (const scriptDoc of actScriptDocs) {
            const content = candidateContents.get(scriptDoc.id)
            if (content) {
              const plainText = contentToPlainText(content)
              actScriptContent += `\n\n--- ${scriptDoc.title} ---\n${plainText}`
            }
          }
          
          if (actScriptContent.trim().length === 0) {
            console.log(`[ProjectStore] Act break "${actBreakDoc.title}" has empty screenplay pages`)
            continue
          }
          
          console.log(`[ProjectStore] Regenerating doc for act break "${actBreakDoc.title}" (${actScriptDocs.length} screenplay pages)`)
          
          const result = await window.api.documentGeneration.generateActBreak(actBreakDoc.title, actScriptContent)
          
          if (result) {
            const existingContent = await window.api.document.load(currentProject.path, actBreakDoc.id)
            const hasUserContent = !isBlankActBreakDoc(existingContent)
            
            let noteContent: JSONContent
            
            if (hasUserContent && existingContent) {
              // User has custom content - insert AI suggestions inline
              await window.api.version.save(
                currentProject.path,
                actBreakDoc.id,
                existingContent,
                'Before AI Update'
              )
              // Create source references for the screenplay pages (for citations)
              const sourceDocRefs = actScriptDocs.map(d => ({ documentId: d.id, title: d.title }))
              noteContent = insertAISuggestionsIntoDoc(existingContent, result, 'actBreak', undefined, sourceDocRefs)
              console.log(`[ProjectStore] Inserted AI suggestions for act break "${actBreakDoc.title}"`)
            } else {
              // No user content - generate fresh document with citations
              // Create source references for the screenplay pages
              const sourceDocRefs = actScriptDocs.map(d => ({ documentId: d.id, title: d.title }))
              noteContent = generateActBreakNoteContent(actBreakDoc.title, result, sourceDocRefs)
            }
            
            await window.api.document.save(currentProject.path, actBreakDoc.id, noteContent)
            
            // Update in-memory state
            set(state => ({
              documents: {
                ...state.documents,
                [actBreakDoc.id]: {
                  ...state.documents[actBreakDoc.id],
                  content: noteContent,
                  isDirty: false,
                  lastSaved: new Date().toISOString()
                }
              }
            }))
            console.log(`[ProjectStore] Regenerated doc for act break "${actBreakDoc.title}"`)
          }
        } catch (error) {
          console.warn(`[ProjectStore] Failed to regenerate doc for act break "${actBreakDoc.title}":`, error)
        }
      }

      console.log('[ProjectStore] Asset document regeneration complete')
    } catch (error) {
      console.error('[ProjectStore] Asset document regeneration failed:', error)
    } finally {
      set(state => ({ ui: { ...state.ui, isBuilding: false } }))
    }
  },

  // Regenerate asset documents for only characters/props found in the current page
  regenerateAssetDocsCurrentPage: async () => {
    const { currentProject, documents, activeDocumentId } = get()
    if (!currentProject || currentProject.templateId !== 'screenplay') return
    if (!activeDocumentId) {
      console.log('[ProjectStore] No active document for current page asset regeneration')
      return
    }

    const activeDoc = currentProject.documents.find(d => d.id === activeDocumentId)
    if (!activeDoc) {
      console.log('[ProjectStore] Active document not found in project')
      return
    }

    console.log(`[ProjectStore] Regenerating asset documents for current page: "${activeDoc.title}"`)
    set(state => ({ ui: { ...state.ui, isBuilding: true } }))

    try {
      const characters = currentProject.characters || []
      const props = currentProject.props || []
      
      if (characters.length === 0 && props.length === 0) {
        console.log('[ProjectStore] No characters or props to regenerate')
        set(state => ({ ui: { ...state.ui, isBuilding: false } }))
        return
      }

      // Load the active document's content
      let activeDocContent: JSONContent
      if (documents[activeDocumentId]?.content) {
        activeDocContent = documents[activeDocumentId].content!
      } else {
        activeDocContent = await window.api.document.load(currentProject.path, activeDocumentId)
      }

      // Check if this document has screenplay elements
      if (!documentContainsScreenplayElements(activeDocContent)) {
        console.log(`[ProjectStore] Document "${activeDoc.title}" doesn't contain screenplay elements`)
        set(state => ({ ui: { ...state.ui, isBuilding: false } }))
        return
      }

      // Scan the current document for character/prop references
      const { characterRefs, propRefs } = scanDocumentForReferences(
        activeDocumentId,
        activeDoc.title,
        activeDocContent,
        characters,
        props
      )

      // Get characters and props found in this document
      const foundCharacterIds = new Set(characterRefs.keys())
      const foundPropIds = new Set(propRefs.keys())

      if (foundCharacterIds.size === 0 && foundPropIds.size === 0) {
        console.log('[ProjectStore] No character or prop references found in current document')
        set(state => ({ ui: { ...state.ui, isBuilding: false } }))
        return
      }

      console.log(`[ProjectStore] Found ${foundCharacterIds.size} characters and ${foundPropIds.size} props in current page`)

      // Get all candidate documents for full context (we need all script docs for proper context extraction)
      const candidateDocs = currentProject.documents.filter(doc => 
        doc.type === 'document' && 
        !doc.isCharacterNote && 
        !doc.isPropNote &&
        !doc.isActBreak
      )
      
      // Load all candidate document contents
      const candidateContents: Map<string, JSONContent> = new Map()
      for (const doc of candidateDocs) {
        try {
          let content: JSONContent
          if (documents[doc.id]?.content) {
            content = documents[doc.id].content!
          } else {
            content = await window.api.document.load(currentProject.path, doc.id)
          }
          candidateContents.set(doc.id, content)
        } catch (error) {
          console.warn(`[ProjectStore] Failed to load doc ${doc.id}:`, error)
        }
      }
      
      // Split into script docs and supplementary docs
      const scriptDocs: typeof candidateDocs = []
      const supplementaryDocs: { title: string; content: string }[] = []
      
      for (const doc of candidateDocs) {
        const content = candidateContents.get(doc.id)
        if (!content) continue
        
        const hasScreenplayElements = documentContainsScreenplayElements(content)
        
        if (hasScreenplayElements && !doc.isNote) {
          scriptDocs.push(doc)
        } else {
          const plainText = contentToPlainText(content)
          if (plainText.trim().length > 0) {
            supplementaryDocs.push({
              title: doc.title,
              content: plainText
            })
          }
        }
      }

      // Build document state map for context extraction
      const docStateMap: Record<string, DocumentState> = {}
      for (const doc of scriptDocs) {
        const content = candidateContents.get(doc.id)
        if (content) {
          docStateMap[doc.id] = {
            content: content,
            isDirty: false,
            lastSaved: null
          }
        }
      }

      // Scan ALL script documents for references (to get complete context for found characters/props)
      const allCharacterRefs = new Map<string, ScriptReference[]>()
      const allPropRefs = new Map<string, ScriptReference[]>()
      
      for (const doc of scriptDocs) {
        const content = candidateContents.get(doc.id)
        if (!content) continue
        
        const { characterRefs: docCharRefs, propRefs: docPropRefs } = scanDocumentForReferences(
          doc.id,
          doc.title,
          content,
          characters,
          props
        )
        
        for (const [charId, refs] of docCharRefs) {
          const existing = allCharacterRefs.get(charId) || []
          allCharacterRefs.set(charId, [...existing, ...refs])
        }
        
        for (const [propId, refs] of docPropRefs) {
          const existing = allPropRefs.get(propId) || []
          allPropRefs.set(propId, [...existing, ...refs])
        }
      }

      // Generate AI content ONLY for characters found in the current document
      for (const character of characters) {
        if (!foundCharacterIds.has(character.id)) continue
        if (!character.noteDocumentId) continue
        
        const refs = allCharacterRefs.get(character.id)
        
        if (!refs || refs.length === 0) {
          // No refs but found in current doc - try with supplementary context
          if (supplementaryDocs.length > 0) {
            try {
              const result = await window.api.documentGeneration.generateCharacter(character.name, [], supplementaryDocs)
              if (result) {
                const existingContent = await window.api.document.load(currentProject.path, character.noteDocumentId)
                const hasUserContent = !isBlankCharacterDoc(existingContent)
                
                let noteContent: JSONContent
                if (hasUserContent && existingContent) {
                  await window.api.version.save(currentProject.path, character.noteDocumentId, existingContent, 'Before AI Update')
                  noteContent = insertAISuggestionsIntoDoc(existingContent, result, 'character', [])
                } else {
                  noteContent = generateCharacterNoteContent(character.name, result, [])
                }
                
                await window.api.document.save(currentProject.path, character.noteDocumentId, noteContent)
                set(state => ({
                  documents: {
                    ...state.documents,
                    [character.noteDocumentId!]: {
                      ...state.documents[character.noteDocumentId!],
                      content: noteContent,
                      isDirty: false,
                      lastSaved: new Date().toISOString()
                    }
                  }
                }))
                console.log(`[ProjectStore] Generated doc for character "${character.name}" from supplementary context`)
              }
            } catch (error) {
              console.warn(`[ProjectStore] Failed to generate doc for character "${character.name}":`, error)
            }
          }
          continue
        }

        try {
          const scriptContexts = extractScriptContextForEntity(
            character.id,
            'character',
            refs,
            docStateMap
          )

          if (scriptContexts.length > 0) {
            console.log(`[ProjectStore] Regenerating doc for character "${character.name}" (${scriptContexts.length} contexts)`)
            
            const result = await window.api.documentGeneration.generateCharacter(character.name, scriptContexts, supplementaryDocs)
            
            if (result) {
              const existingContent = await window.api.document.load(currentProject.path, character.noteDocumentId)
              const hasUserContent = !isBlankCharacterDoc(existingContent)
              
              let noteContent: JSONContent
              if (hasUserContent && existingContent) {
                await window.api.version.save(currentProject.path, character.noteDocumentId, existingContent, 'Before AI Update')
                noteContent = insertAISuggestionsIntoDoc(existingContent, result, 'character', scriptContexts)
              } else {
                noteContent = generateCharacterNoteContent(character.name, result, scriptContexts)
              }
              
              await window.api.document.save(currentProject.path, character.noteDocumentId, noteContent)
              set(state => ({
                documents: {
                  ...state.documents,
                  [character.noteDocumentId!]: {
                    ...state.documents[character.noteDocumentId!],
                    content: noteContent,
                    isDirty: false,
                    lastSaved: new Date().toISOString()
                  }
                }
              }))
              console.log(`[ProjectStore] Regenerated doc for character "${character.name}"`)
            }
          }
        } catch (error) {
          console.warn(`[ProjectStore] Failed to regenerate doc for character "${character.name}":`, error)
        }
      }

      // Generate AI content ONLY for props found in the current document
      for (const prop of props) {
        if (!foundPropIds.has(prop.id)) continue
        if (!prop.noteDocumentId) continue
        
        const refs = allPropRefs.get(prop.id)
        
        if (!refs || refs.length === 0) {
          // No refs but found in current doc - try with supplementary context
          if (supplementaryDocs.length > 0) {
            try {
              const result = await window.api.documentGeneration.generateProp(prop.name, [], supplementaryDocs)
              if (result) {
                const existingContent = await window.api.document.load(currentProject.path, prop.noteDocumentId)
                const hasUserContent = !isBlankPropDoc(existingContent)
                
                let noteContent: JSONContent
                if (hasUserContent && existingContent) {
                  await window.api.version.save(currentProject.path, prop.noteDocumentId, existingContent, 'Before AI Update')
                  noteContent = insertAISuggestionsIntoDoc(existingContent, result, 'prop', [])
                } else {
                  noteContent = generatePropNoteContent(prop.name, result, [])
                }
                
                await window.api.document.save(currentProject.path, prop.noteDocumentId, noteContent)
                set(state => ({
                  documents: {
                    ...state.documents,
                    [prop.noteDocumentId!]: {
                      ...state.documents[prop.noteDocumentId!],
                      content: noteContent,
                      isDirty: false,
                      lastSaved: new Date().toISOString()
                    }
                  }
                }))
                console.log(`[ProjectStore] Generated doc for prop "${prop.name}" from supplementary context`)
              }
            } catch (error) {
              console.warn(`[ProjectStore] Failed to generate doc for prop "${prop.name}":`, error)
            }
          }
          continue
        }

        try {
          const scriptContexts = extractScriptContextForEntity(
            prop.id,
            'prop',
            refs,
            docStateMap
          )

          if (scriptContexts.length > 0) {
            console.log(`[ProjectStore] Regenerating doc for prop "${prop.name}" (${scriptContexts.length} contexts)`)
            
            const result = await window.api.documentGeneration.generateProp(prop.name, scriptContexts, supplementaryDocs)
            
            if (result) {
              const existingContent = await window.api.document.load(currentProject.path, prop.noteDocumentId)
              const hasUserContent = !isBlankPropDoc(existingContent)
              
              let noteContent: JSONContent
              if (hasUserContent && existingContent) {
                await window.api.version.save(currentProject.path, prop.noteDocumentId, existingContent, 'Before AI Update')
                noteContent = insertAISuggestionsIntoDoc(existingContent, result, 'prop', scriptContexts)
              } else {
                noteContent = generatePropNoteContent(prop.name, result, scriptContexts)
              }
              
              await window.api.document.save(currentProject.path, prop.noteDocumentId, noteContent)
              set(state => ({
                documents: {
                  ...state.documents,
                  [prop.noteDocumentId!]: {
                    ...state.documents[prop.noteDocumentId!],
                    content: noteContent,
                    isDirty: false,
                    lastSaved: new Date().toISOString()
                  }
                }
              }))
              console.log(`[ProjectStore] Regenerated doc for prop "${prop.name}"`)
            }
          }
        } catch (error) {
          console.warn(`[ProjectStore] Failed to regenerate doc for prop "${prop.name}":`, error)
        }
      }

      console.log('[ProjectStore] Current page asset document regeneration complete')
    } catch (error) {
      console.error('[ProjectStore] Current page asset document regeneration failed:', error)
    } finally {
      set(state => ({ ui: { ...state.ui, isBuilding: false } }))
    }
  },

  // Remove blank/empty blocks from the active document
  removeBlankBlocks: () => {
    const { activeDocumentId, documents, updateDocumentContent } = get()
    if (!activeDocumentId) return
    
    const docState = documents[activeDocumentId]
    if (!docState?.content?.content) return
    
    const originalContent = docState.content
    const originalBlockCount = originalContent.content?.length || 0
    
    // Filter out empty blocks
    // A block is "empty" if it has no content, or only has empty text nodes
    const filteredContent = originalContent.content?.filter((node: JSONContent) => {
      // Keep headings with content
      if (node.type === 'heading') {
        if (!node.content || node.content.length === 0) return false
        const hasText = node.content.some((child: JSONContent) => 
          child.type === 'text' && child.text && child.text.trim().length > 0
        )
        return hasText
      }
      
      // Keep paragraphs with content
      if (node.type === 'paragraph') {
        if (!node.content || node.content.length === 0) return false
        const hasText = node.content.some((child: JSONContent) => 
          (child.type === 'text' && child.text && child.text.trim().length > 0) ||
          child.type === 'mention' ||
          child.type === 'image' ||
          child.type === 'assetImage'
        )
        return hasText
      }
      
      // Keep screenplayElements with content
      if (node.type === 'screenplayElement') {
        if (!node.content || node.content.length === 0) return false
        const hasText = node.content.some((child: JSONContent) => 
          (child.type === 'text' && child.text && child.text.trim().length > 0) ||
          child.type === 'mention'
        )
        return hasText
      }
      
      // Keep all other node types (lists, images, etc.) by default
      if (node.type && !['paragraph', 'heading', 'screenplayElement'].includes(node.type)) {
        return true
      }
      
      // If no content array, check if it's an inline element
      if (!node.content) {
        return node.type === 'image' || node.type === 'assetImage' || node.type === 'horizontalRule'
      }
      
      return true
    }) || []
    
    const removedCount = originalBlockCount - filteredContent.length
    
    if (removedCount > 0) {
      const newContent: JSONContent = {
        ...originalContent,
        content: filteredContent
      }
      
      updateDocumentContent(activeDocumentId, newContent)
      console.log(`[ProjectStore] Removed ${removedCount} blank block(s) from document`)
    } else {
      console.log('[ProjectStore] No blank blocks found to remove')
    }
  },

  // Character actions (for screenplay projects)
  addCharacter: async (name, color = '#fbbf24') => {
    const { currentProject } = get()
    if (!currentProject) return

    const characterId = crypto.randomUUID()
    const noteDocId = crypto.randomUUID()
    const upperName = name.toUpperCase()

    // Create the character note document
    const noteDoc: Omit<ProjectDocument, 'createdAt' | 'updatedAt'> = {
      id: noteDocId,
      path: `characters/${noteDocId}.json`,
      title: upperName,
      order: currentProject.documents.length,
      type: 'document',
      isCharacterNote: true,
      characterId: characterId
    }

    try {
      // Create the note document file (with default content from backend)
      const newNoteDoc = await window.api.document.create(currentProject.path, noteDoc, currentProject.templateId)

      const newCharacter: Character = {
        id: characterId,
        name: upperName,
        color,
        noteDocumentId: noteDocId
      }

      const updatedProject = {
        ...currentProject,
        characters: [...(currentProject.characters || []), newCharacter],
        documents: [...currentProject.documents, newNoteDoc]
      }

      // Save project FIRST so the document is in project.json
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
      
      // Save the character note content with default template
      // AI generation happens during "Run Build" to analyze full script context
      const noteContent = generateCharacterNoteContent(upperName)
      await window.api.document.save(currentProject.path, noteDocId, noteContent)
      
      console.log(`[ProjectStore] Created character "${upperName}" with note document ${noteDocId}`)
    } catch (error) {
      console.error('Failed to add character:', error)
    }
  },

  updateCharacter: async (id, updates) => {
    const { currentProject, documents } = get()
    if (!currentProject) return

    const updatedProject = {
      ...currentProject,
      characters: (currentProject.characters || []).map(char =>
        char.id === id 
          ? { ...char, ...updates, name: updates.name ? updates.name.toUpperCase() : char.name }
          : char
      )
    }

    try {
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
      
      // If color or name was updated, update all documents with this character
      if (updates.color || updates.name) {
        const updatedChar = updatedProject.characters.find(c => c.id === id)
        if (updatedChar) {
          // Update character styling and labels in all loaded documents
          const updatedDocuments: Record<string, DocumentState> = {}
          
          // Build lookup maps for both name-based and ID-based matching
          const characterLookup = new Map<string, { id: string; color: string }>()
          const characterIdLookup = new Map<string, { name: string; color: string }>()
          for (const char of updatedProject.characters) {
            characterLookup.set(char.name.toUpperCase(), { id: char.id, color: char.color })
            characterIdLookup.set(char.id, { name: char.name, color: char.color })
          }
          
          for (const [docId, docState] of Object.entries(documents)) {
            if (docState?.content) {
              const updatedContent = updateCharacterElementsInContent(docState.content, characterLookup, characterIdLookup)
              if (JSON.stringify(updatedContent) !== JSON.stringify(docState.content)) {
                updatedDocuments[docId] = {
                  ...docState,
                  content: updatedContent,
                  isDirty: true
                }
              }
            }
          }
          
          if (Object.keys(updatedDocuments).length > 0) {
            set(state => ({
              documents: {
                ...state.documents,
                ...updatedDocuments
              }
            }))
            
            // Save the updated documents
            const projectPath = get().currentProject?.path
            if (projectPath) {
              for (const [docId, docState] of Object.entries(updatedDocuments)) {
                if (docState.content) {
                  await window.api.document.save(projectPath, docId, docState.content)
                }
              }
              
              // Mark documents as saved
              set(state => ({
                documents: Object.fromEntries(
                  Object.entries(state.documents).map(([id, doc]) => [
                    id,
                    Object.keys(updatedDocuments).includes(id) 
                      ? { ...doc, isDirty: false, lastSaved: new Date().toISOString() } 
                      : doc
                  ])
                )
              }))
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to update character:', error)
    }
  },

  removeCharacter: async (id) => {
    const { currentProject, activeDocumentId } = get()
    if (!currentProject) return

    // Find the character to get their note document ID
    const character = currentProject.characters?.find(c => c.id === id)
    const noteDocId = character?.noteDocumentId

    try {
      // Delete the note document if it exists
      if (noteDocId) {
        try {
          await window.api.document.delete(currentProject.path, noteDocId)
        } catch (err) {
          console.warn('Failed to delete character note document:', err)
        }
      }

      const updatedProject = {
        ...currentProject,
        characters: (currentProject.characters || []).filter(char => char.id !== id),
        documents: noteDocId 
          ? currentProject.documents.filter(d => d.id !== noteDocId)
          : currentProject.documents
      }

      await window.api.project.save(updatedProject)
      
      // Update state and clear active document if it was the deleted note
      const newDocs = { ...get().documents }
      if (noteDocId) {
        delete newDocs[noteDocId]
      }
      
      set({ 
        currentProject: updatedProject,
        documents: newDocs,
        activeDocumentId: activeDocumentId === noteDocId ? null : activeDocumentId
      })
      
      console.log(`[ProjectStore] Removed character "${character?.name}" and note document`)
    } catch (error) {
      console.error('Failed to remove character:', error)
    }
  },

  getCharacterByName: (name) => {
    const { currentProject } = get()
    if (!currentProject?.characters) return undefined
    
    // Strip extensions like (V.O.), (O.S.), (CONT'D) before matching
    const normalizedName = stripCharacterExtensions(name.toUpperCase().trim())
    return currentProject.characters.find(
      char => char.name.toUpperCase() === normalizedName
    )
  },

  getCharacterById: (id) => {
    const { currentProject } = get()
    if (!currentProject?.characters) return undefined
    return currentProject.characters.find(char => char.id === id)
  },

  // Navigate to a character's note document
  navigateToCharacterNote: async (characterId) => {
    const { currentProject, setActiveDocument } = get()
    if (!currentProject) return

    const character = currentProject.characters?.find(c => c.id === characterId)
    if (!character?.noteDocumentId) {
      console.warn(`Character ${characterId} has no linked note document`)
      return
    }

    await setActiveDocument(character.noteDocumentId)
  },

  // Sync characters from all documents - scans docs for character elements and adds to bank
  syncCharactersFromDocuments: async () => {
    const { currentProject, documents } = get()
    if (!currentProject || currentProject.templateId !== 'screenplay') return

    // Collect all character names from all loaded documents
    const allCharacterNames = new Set<string>()
    
    for (const docState of Object.values(documents)) {
      if (docState?.content) {
        const names = extractCharacterNamesFromContent(docState.content)
        names.forEach(name => allCharacterNames.add(name))
      }
    }

    // Find characters that aren't in the bank yet
    const existingNames = new Set(
      (currentProject.characters || []).map(c => c.name.toUpperCase())
    )
    
    const newCharacters: Character[] = []
    const newDocuments: ProjectDocument[] = []
    let colorIndex = (currentProject.characters || []).length
    
    for (const name of allCharacterNames) {
      if (!existingNames.has(name.toUpperCase())) {
        const characterId = crypto.randomUUID()
        const noteDocId = crypto.randomUUID()
        const upperName = name.toUpperCase()
        
        newCharacters.push({
          id: characterId,
          name: upperName,
          color: DEFAULT_CHARACTER_COLORS[colorIndex % DEFAULT_CHARACTER_COLORS.length],
          noteDocumentId: noteDocId
        })
        
        // Create note document entry (actual file creation happens below)
        newDocuments.push({
          id: noteDocId,
          path: `characters/${noteDocId}.json`,
          title: upperName,
          order: currentProject.documents.length + newDocuments.length,
          type: 'document',
          isCharacterNote: true,
          characterId: characterId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        
        colorIndex++
      }
    }

    if (newCharacters.length === 0) return

    try {
      // Create note document files for each new character (with default content)
      const createdDocs: ProjectDocument[] = []
      for (let i = 0; i < newCharacters.length; i++) {
        const character = newCharacters[i]
        const noteDoc = newDocuments[i]
        
        // Create the document file
        const createdDoc = await window.api.document.create(currentProject.path, {
          id: noteDoc.id,
          path: noteDoc.path,
          title: noteDoc.title,
          order: noteDoc.order,
          type: noteDoc.type,
          isCharacterNote: true,
          characterId: character.id
        }, currentProject.templateId)
        
        createdDocs.push(createdDoc)
      }

      // Add new characters and documents to project and save FIRST
      const updatedProject = {
        ...currentProject,
        characters: [...(currentProject.characters || []), ...newCharacters],
        documents: [...currentProject.documents, ...createdDocs]
      }

      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
      
      // NOW save the custom character note content (documents exist in project.json)
      for (let i = 0; i < newCharacters.length; i++) {
        const character = newCharacters[i]
        const noteDoc = createdDocs[i]
        const noteContent = generateCharacterNoteContent(character.name)
        await window.api.document.save(currentProject.path, noteDoc.id, noteContent)
      }
      
      console.log(`[ProjectStore] Synced ${newCharacters.length} characters from documents:`, 
        newCharacters.map(c => c.name))
    } catch (error) {
      console.error('Failed to sync characters:', error)
    }
  },

  // Update character styling in a document based on character bank
  updateDocumentCharacterStyling: (docId) => {
    const { currentProject, documents } = get()
    if (!currentProject || currentProject.templateId !== 'screenplay') return
    
    const docState = documents[docId]
    if (!docState?.content) return
    
    // Build lookup maps for both name-based and ID-based matching
    const characterLookup = new Map<string, { id: string; color: string }>()
    const characterIdLookup = new Map<string, { name: string; color: string }>()
    for (const char of (currentProject.characters || [])) {
      characterLookup.set(char.name.toUpperCase(), { id: char.id, color: char.color })
      characterIdLookup.set(char.id, { name: char.name, color: char.color })
    }
    
    // Update content (both character elements and mentions)
    const updatedContent = updateCharacterElementsInContent(docState.content, characterLookup, characterIdLookup)
    
    // Check if anything changed
    if (JSON.stringify(updatedContent) !== JSON.stringify(docState.content)) {
      set(state => ({
        documents: {
          ...state.documents,
          [docId]: {
            ...state.documents[docId],
            content: updatedContent,
            isDirty: true
          }
        }
      }))
      console.log(`[ProjectStore] Updated character styling in document ${docId}`)
    }
  },

  // Prop actions (for screenplay projects)
  addProp: async (name, icon = 'Box') => {
    const { currentProject } = get()
    if (!currentProject) return

    const propId = crypto.randomUUID()
    const noteDocId = crypto.randomUUID()
    const upperName = name.toUpperCase()

    // Create the prop note document
    const noteDoc: Omit<ProjectDocument, 'createdAt' | 'updatedAt'> = {
      id: noteDocId,
      path: `props/${noteDocId}.json`,
      title: upperName,
      order: currentProject.documents.length,
      type: 'document',
      isPropNote: true,
      propId: propId
    }

    try {
      // Create the note document file (with default content from backend)
      const newNoteDoc = await window.api.document.create(currentProject.path, noteDoc, currentProject.templateId)

      const newProp: Prop = {
        id: propId,
        name: upperName,
        icon,
        noteDocumentId: noteDocId
      }

      const updatedProject = {
        ...currentProject,
        props: [...(currentProject.props || []), newProp],
        documents: [...currentProject.documents, newNoteDoc]
      }

      // Save project FIRST so the document is in project.json
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
      
      // Save the prop note content with default template
      // AI generation happens during "Run Build" to analyze full script context
      const noteContent = generatePropNoteContent(upperName)
      await window.api.document.save(currentProject.path, noteDocId, noteContent)
      
      console.log(`[ProjectStore] Created prop "${upperName}" with note document ${noteDocId}`)
    } catch (error) {
      console.error('Failed to add prop:', error)
    }
  },

  updateProp: async (id, updates) => {
    const { currentProject, documents } = get()
    if (!currentProject) return

    const updatedProject = {
      ...currentProject,
      props: (currentProject.props || []).map(prop =>
        prop.id === id 
          ? { ...prop, ...updates, name: updates.name ? updates.name.toUpperCase() : prop.name }
          : prop
      )
    }

    try {
      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
      
      // If icon or name was updated, update all documents with this prop
      if (updates.icon || updates.name) {
        const updatedProp = updatedProject.props.find(p => p.id === id)
        if (updatedProp) {
          // Update prop styling and labels in all loaded documents
          const updatedDocuments: Record<string, DocumentState> = {}
          
          // Build lookup maps for both name-based and ID-based matching
          const propLookup = new Map<string, { id: string; icon: string }>()
          const propIdLookup = new Map<string, { name: string; icon: string }>()
          for (const prop of updatedProject.props) {
            propLookup.set(prop.name.toUpperCase(), { id: prop.id, icon: prop.icon })
            propIdLookup.set(prop.id, { name: prop.name, icon: prop.icon })
          }
          
          for (const [docId, docState] of Object.entries(documents)) {
            if (docState?.content) {
              const updatedContent = updatePropElementsInContent(docState.content, propLookup, propIdLookup)
              if (JSON.stringify(updatedContent) !== JSON.stringify(docState.content)) {
                updatedDocuments[docId] = {
                  ...docState,
                  content: updatedContent,
                  isDirty: true
                }
              }
            }
          }
          
          if (Object.keys(updatedDocuments).length > 0) {
            set(state => ({
              documents: {
                ...state.documents,
                ...updatedDocuments
              }
            }))
            
            // Save the updated documents
            const projectPath = get().currentProject?.path
            if (projectPath) {
              for (const [docId, docState] of Object.entries(updatedDocuments)) {
                if (docState.content) {
                  await window.api.document.save(projectPath, docId, docState.content)
                }
              }
              
              // Mark documents as saved
              set(state => ({
                documents: Object.fromEntries(
                  Object.entries(state.documents).map(([id, doc]) => [
                    id,
                    Object.keys(updatedDocuments).includes(id) 
                      ? { ...doc, isDirty: false, lastSaved: new Date().toISOString() } 
                      : doc
                  ])
                )
              }))
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to update prop:', error)
    }
  },

  removeProp: async (id) => {
    const { currentProject, activeDocumentId } = get()
    if (!currentProject) return

    // Find the prop to get their note document ID
    const prop = currentProject.props?.find(p => p.id === id)
    const noteDocId = prop?.noteDocumentId

    try {
      // Delete the note document if it exists
      if (noteDocId) {
        try {
          await window.api.document.delete(currentProject.path, noteDocId)
        } catch (err) {
          console.warn('Failed to delete prop note document:', err)
        }
      }

      const updatedProject = {
        ...currentProject,
        props: (currentProject.props || []).filter(p => p.id !== id),
        documents: noteDocId 
          ? currentProject.documents.filter(d => d.id !== noteDocId)
          : currentProject.documents
      }

      await window.api.project.save(updatedProject)
      
      // Update state and clear active document if it was the deleted note
      const newDocs = { ...get().documents }
      if (noteDocId) {
        delete newDocs[noteDocId]
      }
      
      set({ 
        currentProject: updatedProject,
        documents: newDocs,
        activeDocumentId: activeDocumentId === noteDocId ? null : activeDocumentId
      })
      
      console.log(`[ProjectStore] Removed prop "${prop?.name}" and note document`)
    } catch (error) {
      console.error('Failed to remove prop:', error)
    }
  },

  getPropByName: (name) => {
    const { currentProject } = get()
    if (!currentProject?.props) return undefined
    
    const normalizedName = name.toUpperCase().trim()
    return currentProject.props.find(
      prop => prop.name.toUpperCase() === normalizedName
    )
  },

  getPropById: (id) => {
    const { currentProject } = get()
    if (!currentProject?.props) return undefined
    return currentProject.props.find(prop => prop.id === id)
  },

  // Navigate to a prop's note document
  navigateToPropNote: async (propId) => {
    const { currentProject, setActiveDocument } = get()
    if (!currentProject) return

    const prop = currentProject.props?.find(p => p.id === propId)
    if (!prop?.noteDocumentId) {
      console.warn(`Prop ${propId} has no linked note document`)
      return
    }

    await setActiveDocument(prop.noteDocumentId)
  },

  // Sync props from all documents - scans docs for prop elements and adds to bank
  syncPropsFromDocuments: async () => {
    const { currentProject, documents } = get()
    if (!currentProject || currentProject.templateId !== 'screenplay') return

    // Get existing prop names for detection
    const existingPropNames = (currentProject.props || []).map(p => p.name)
    
    // Collect all prop names from all loaded documents
    const allPropNames = new Set<string>()
    
    for (const docState of Object.values(documents)) {
      if (docState?.content) {
        const names = extractPropNamesFromContent(docState.content, existingPropNames)
        names.forEach(name => allPropNames.add(name))
      }
    }

    // Find props that aren't in the bank yet
    const existingNames = new Set(
      (currentProject.props || []).map(p => p.name.toUpperCase())
    )
    
    const newProps: Prop[] = []
    const newDocuments: ProjectDocument[] = []
    let iconIndex = (currentProject.props || []).length
    
    for (const name of allPropNames) {
      if (!existingNames.has(name.toUpperCase())) {
        const propId = crypto.randomUUID()
        const noteDocId = crypto.randomUUID()
        const upperName = name.toUpperCase()
        
        newProps.push({
          id: propId,
          name: upperName,
          icon: DEFAULT_PROP_ICONS[iconIndex % DEFAULT_PROP_ICONS.length],
          noteDocumentId: noteDocId
        })
        
        // Create note document entry (actual file creation happens below)
        newDocuments.push({
          id: noteDocId,
          path: `props/${noteDocId}.json`,
          title: upperName,
          order: currentProject.documents.length + newDocuments.length,
          type: 'document',
          isPropNote: true,
          propId: propId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        
        iconIndex++
      }
    }

    if (newProps.length === 0) return

    try {
      // Create note document files for each new prop (with default content)
      const createdDocs: ProjectDocument[] = []
      for (let i = 0; i < newProps.length; i++) {
        const prop = newProps[i]
        const noteDoc = newDocuments[i]
        
        // Create the document file
        const createdDoc = await window.api.document.create(currentProject.path, {
          id: noteDoc.id,
          path: noteDoc.path,
          title: noteDoc.title,
          order: noteDoc.order,
          type: noteDoc.type,
          isPropNote: true,
          propId: prop.id
        }, currentProject.templateId)
        
        createdDocs.push(createdDoc)
      }

      // Add new props and documents to project and save FIRST
      const updatedProject = {
        ...currentProject,
        props: [...(currentProject.props || []), ...newProps],
        documents: [...currentProject.documents, ...createdDocs]
      }

      await window.api.project.save(updatedProject)
      set({ currentProject: updatedProject })
      
      // NOW save the custom prop note content (documents exist in project.json)
      for (let i = 0; i < newProps.length; i++) {
        const prop = newProps[i]
        const noteDoc = createdDocs[i]
        const noteContent = generatePropNoteContent(prop.name)
        await window.api.document.save(currentProject.path, noteDoc.id, noteContent)
      }
      
      console.log(`[ProjectStore] Synced ${newProps.length} props from documents:`, 
        newProps.map(p => p.name))
    } catch (error) {
      console.error('Failed to sync props:', error)
    }
  },

  // Update prop styling in a document based on prop bank
  updateDocumentPropStyling: (docId) => {
    const { currentProject, documents } = get()
    if (!currentProject || currentProject.templateId !== 'screenplay') return
    
    const docState = documents[docId]
    if (!docState?.content) return
    
    // Build lookup maps for both name-based and ID-based matching
    const propLookup = new Map<string, { id: string; icon: string }>()
    const propIdLookup = new Map<string, { name: string; icon: string }>()
    for (const prop of (currentProject.props || [])) {
      propLookup.set(prop.name.toUpperCase(), { id: prop.id, icon: prop.icon })
      propIdLookup.set(prop.id, { name: prop.name, icon: prop.icon })
    }
    
    // Update content (both prop elements and mentions)
    const updatedContent = updatePropElementsInContent(docState.content, propLookup, propIdLookup)
    
    // Check if anything changed
    if (JSON.stringify(updatedContent) !== JSON.stringify(docState.content)) {
      set(state => ({
        documents: {
          ...state.documents,
          [docId]: {
            ...state.documents[docId],
            content: updatedContent,
            isDirty: true
          }
        }
      }))
      console.log(`[ProjectStore] Updated prop styling in document ${docId}`)
    }
  },

  // Script reference tracking actions
  
  // Compute all character and prop references across all screenplay documents
  computeAllReferences: async () => {
    const { currentProject, documents, loadDocumentContent } = get()
    if (!currentProject || currentProject.templateId !== 'screenplay') return
    
    const characters = currentProject.characters || []
    const props = currentProject.props || []
    
    if (characters.length === 0 && props.length === 0) {
      set({ characterReferences: {}, propReferences: {} })
      return
    }
    
    // Initialize empty reference maps
    const allCharacterRefs: CharacterReferences = {}
    const allPropRefs: PropReferences = {}
    
    // Initialize with empty arrays for all characters and props
    for (const char of characters) {
      allCharacterRefs[char.id] = []
    }
    for (const prop of props) {
      allPropRefs[prop.id] = []
    }
    
    // Get all non-note screenplay documents (Acts/pages with script content)
    const scriptDocs = currentProject.documents.filter(doc => 
      doc.type === 'document' && 
      !doc.isCharacterNote && 
      !doc.isPropNote &&
      !doc.isNote &&
      !doc.isActBreak
    )
    
    // Load any unloaded documents first (in parallel)
    const unloadedDocs = scriptDocs.filter(doc => !documents[doc.id]?.content)
    if (unloadedDocs.length > 0) {
      await Promise.all(unloadedDocs.map(doc => loadDocumentContent(doc.id)))
    }
    
    // Re-get documents state after loading
    const currentDocuments = get().documents
    
    // Scan each document
    for (const doc of scriptDocs) {
      const docState = currentDocuments[doc.id]
      if (!docState?.content) continue
      
      const { characterRefs, propRefs } = scanDocumentForReferences(
        doc.id,
        doc.title,
        docState.content,
        characters,
        props
      )
      
      // Merge into all references
      for (const [charId, refs] of characterRefs) {
        allCharacterRefs[charId] = [...(allCharacterRefs[charId] || []), ...refs]
      }
      for (const [propId, refs] of propRefs) {
        allPropRefs[propId] = [...(allPropRefs[propId] || []), ...refs]
      }
    }
    
    // Sort references by document order then scene number
    const docOrderMap = new Map<string, number>()
    for (const doc of currentProject.documents) {
      docOrderMap.set(doc.id, doc.order)
    }
    
    const sortRefs = (refs: ScriptReference[]) => {
      return refs.sort((a, b) => {
        const orderA = docOrderMap.get(a.documentId) ?? 0
        const orderB = docOrderMap.get(b.documentId) ?? 0
        if (orderA !== orderB) return orderA - orderB
        return a.sceneNumber - b.sceneNumber
      })
    }
    
    for (const charId of Object.keys(allCharacterRefs)) {
      allCharacterRefs[charId] = sortRefs(allCharacterRefs[charId])
    }
    for (const propId of Object.keys(allPropRefs)) {
      allPropRefs[propId] = sortRefs(allPropRefs[propId])
    }
    
    set({ characterReferences: allCharacterRefs, propReferences: allPropRefs })
  },
  
  // Get references for a specific character
  getCharacterReferences: (characterId) => {
    const { characterReferences } = get()
    return characterReferences[characterId] || []
  },
  
  // Get references for a specific prop
  getPropReferences: (propId) => {
    const { propReferences } = get()
    return propReferences[propId] || []
  },

  // Version history actions
  
  // Save a new version of the current document content
  saveVersion: async (docId, label) => {
    const { currentProject, documents } = get()
    if (!currentProject) return
    
    const docState = documents[docId]
    if (!docState?.content) {
      console.warn('[ProjectStore] Cannot save version: no content for document', docId)
      return
    }
    
    try {
      const version = await window.api.version.save(
        currentProject.path,
        docId,
        docState.content,
        label
      )
      
      // Add to local state (prepend since newest first)
      set(state => ({
        documentVersions: {
          ...state.documentVersions,
          [docId]: [version, ...(state.documentVersions[docId] || [])]
        }
      }))
      
      console.log(`[ProjectStore] Saved version ${version.id} for document ${docId}`)
    } catch (error) {
      console.error('[ProjectStore] Failed to save version:', error)
    }
  },

  // Load all versions for a document
  loadVersions: async (docId) => {
    const { currentProject } = get()
    if (!currentProject) return
    
    try {
      const versions = await window.api.version.load(currentProject.path, docId)
      
      set(state => ({
        documentVersions: {
          ...state.documentVersions,
          [docId]: versions
        }
      }))
      
      console.log(`[ProjectStore] Loaded ${versions.length} versions for document ${docId}`)
    } catch (error) {
      console.error('[ProjectStore] Failed to load versions:', error)
    }
  },

  // Delete a specific version
  deleteVersion: async (docId, versionId) => {
    const { currentProject } = get()
    if (!currentProject) return
    
    try {
      await window.api.version.delete(currentProject.path, docId, versionId)
      
      // Remove from local state
      set(state => ({
        documentVersions: {
          ...state.documentVersions,
          [docId]: (state.documentVersions[docId] || []).filter(v => v.id !== versionId)
        }
      }))
      
      // If the deleted version was selected, deselect it
      const { versionHistoryMode } = get()
      if (versionHistoryMode.selectedVersionId === versionId) {
        set({ versionHistoryMode: { ...versionHistoryMode, selectedVersionId: null } })
      }
      
      console.log(`[ProjectStore] Deleted version ${versionId} for document ${docId}`)
    } catch (error) {
      console.error('[ProjectStore] Failed to delete version:', error)
    }
  },

  // Restore document content from a version
  restoreVersion: async (docId, versionId) => {
    const { documentVersions, updateDocumentContent, saveDocument } = get()
    
    const versions = documentVersions[docId] || []
    const version = versions.find(v => v.id === versionId)
    
    if (!version) {
      console.warn('[ProjectStore] Version not found:', versionId)
      return
    }
    
    // Update document content with version content
    updateDocumentContent(docId, version.content)
    
    // Save the document
    await saveDocument(docId)
    
    // Exit version history mode
    set({ versionHistoryMode: { active: false, selectedVersionId: null } })
    
    console.log(`[ProjectStore] Restored document ${docId} to version ${versionId}`)
  },

  // Toggle version history mode
  setVersionHistoryMode: (active, selectedVersionId = null) => {
    set({ 
      versionHistoryMode: { 
        active, 
        selectedVersionId: selectedVersionId ?? null 
      } 
    })
  },

  // Get versions for a document (synchronous getter)
  getVersions: (docId) => {
    return get().documentVersions[docId] || []
  },

  // =============================================
  // Storyboard Actions (for screenplay projects)
  // =============================================
  
  // Toggle storyboard split view mode
  toggleStoryboardMode: () => {
    set(state => ({
      storyboardUI: {
        ...state.storyboardUI,
        mode: !state.storyboardUI.mode
      }
    }))
  },

  setStoryboardMode: (active) => {
    set(state => ({
      storyboardUI: {
        ...state.storyboardUI,
        mode: active
      }
    }))
  },

  // Add a new shot using an existing asset
  addShot: async (assetId) => {
    const { currentProject, saveStoryboard } = get()
    if (!currentProject) return

    const storyboard = currentProject.storyboard || { shots: [] }
    const newShot: StoryboardShot = {
      id: crypto.randomUUID(),
      assetId,
      order: storyboard.shots.length,
      linkedBlock: null,
      isUnlinked: false
    }

    const updatedStoryboard: Storyboard = {
      ...storyboard,
      shots: [...storyboard.shots, newShot]
    }

    set(state => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, storyboard: updatedStoryboard }
        : null
    }))

    await saveStoryboard()
    console.log(`[ProjectStore] Added shot ${newShot.id} with asset ${assetId}`)
  },

  // Remove a shot
  removeShot: async (shotId) => {
    const { currentProject, saveStoryboard, storyboardPlayback } = get()
    if (!currentProject?.storyboard) return

    const shots = currentProject.storyboard.shots.filter(s => s.id !== shotId)
    // Recompute orders
    const reorderedShots = shots.map((s, i) => ({ ...s, order: i }))

    const updatedStoryboard: Storyboard = {
      ...currentProject.storyboard,
      shots: reorderedShots
    }

    // Adjust current shot index if needed
    let newIndex = storyboardPlayback.currentShotIndex
    if (newIndex >= reorderedShots.length) {
      newIndex = Math.max(0, reorderedShots.length - 1)
    }

    set(state => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, storyboard: updatedStoryboard }
        : null,
      storyboardPlayback: {
        ...state.storyboardPlayback,
        currentShotIndex: newIndex
      }
    }))

    await saveStoryboard()
    console.log(`[ProjectStore] Removed shot ${shotId}`)
  },

  // Update a shot's properties
  updateShot: async (shotId, updates) => {
    const { currentProject, saveStoryboard } = get()
    if (!currentProject?.storyboard) return

    const updatedShots = currentProject.storyboard.shots.map(shot =>
      shot.id === shotId ? { ...shot, ...updates } : shot
    )

    const updatedStoryboard: Storyboard = {
      ...currentProject.storyboard,
      shots: updatedShots
    }

    set(state => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, storyboard: updatedStoryboard }
        : null
    }))

    await saveStoryboard()
  },

  // Reorder shots by providing new order of shot IDs
  reorderShots: async (shotIds) => {
    const { currentProject, saveStoryboard } = get()
    if (!currentProject?.storyboard) return

    const shotMap = new Map(currentProject.storyboard.shots.map(s => [s.id, s]))
    const reorderedShots = shotIds
      .map((id, index) => {
        const shot = shotMap.get(id)
        return shot ? { ...shot, order: index } : null
      })
      .filter((s): s is StoryboardShot => s !== null)

    const updatedStoryboard: Storyboard = {
      ...currentProject.storyboard,
      shots: reorderedShots
    }

    set(state => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, storyboard: updatedStoryboard }
        : null
    }))

    await saveStoryboard()
    console.log(`[ProjectStore] Reordered shots`)
  },

  // Start link mode - selecting a block to link to a shot
  startLinkMode: (shotId) => {
    set(state => ({
      storyboardUI: {
        ...state.storyboardUI,
        linkMode: { active: true, targetShotId: shotId }
      }
    }))
  },

  // Cancel link mode
  cancelLinkMode: () => {
    set(state => ({
      storyboardUI: {
        ...state.storyboardUI,
        linkMode: { active: false, targetShotId: null }
      }
    }))
  },

  // Link a shot to a text block
  linkShotToBlock: async (shotId, anchor) => {
    const { updateShot, cancelLinkMode } = get()

    await updateShot(shotId, {
      linkedBlock: anchor,
      isUnlinked: false
    })

    cancelLinkMode()
    console.log(`[ProjectStore] Linked shot ${shotId} to block ${anchor.blockId}`)
  },

  // Unlink a shot from its text block
  unlinkShot: async (shotId) => {
    const { updateShot } = get()
    await updateShot(shotId, {
      linkedBlock: null,
      isUnlinked: false
    })
    console.log(`[ProjectStore] Unlinked shot ${shotId}`)
  },

  // Playback controls
  playStoryboard: () => {
    const { currentProject } = get()
    if (!currentProject?.storyboard?.shots.length) return

    set(state => ({
      storyboardPlayback: {
        ...state.storyboardPlayback,
        isPlaying: true
      }
    }))
  },

  pauseStoryboard: () => {
    set(state => ({
      storyboardPlayback: {
        ...state.storyboardPlayback,
        isPlaying: false
      }
    }))
  },

  togglePlayback: () => {
    const { storyboardPlayback, playStoryboard, pauseStoryboard } = get()
    if (storyboardPlayback.isPlaying) {
      pauseStoryboard()
    } else {
      playStoryboard()
    }
  },

  nextShot: () => {
    const { currentProject, storyboardPlayback } = get()
    if (!currentProject?.storyboard?.shots.length) return

    const maxIndex = currentProject.storyboard.shots.length - 1
    const newIndex = Math.min(storyboardPlayback.currentShotIndex + 1, maxIndex)

    set(state => ({
      storyboardPlayback: {
        ...state.storyboardPlayback,
        currentShotIndex: newIndex,
        currentTime: 0
      }
    }))
  },

  prevShot: () => {
    const { storyboardPlayback } = get()
    const newIndex = Math.max(storyboardPlayback.currentShotIndex - 1, 0)

    set(state => ({
      storyboardPlayback: {
        ...state.storyboardPlayback,
        currentShotIndex: newIndex,
        currentTime: 0
      }
    }))
  },

  goToShot: async (index) => {
    const { currentProject, navigateToCitation } = get()
    if (!currentProject?.storyboard?.shots.length) return

    const maxIndex = currentProject.storyboard.shots.length - 1
    const clampedIndex = Math.max(0, Math.min(index, maxIndex))

    // Get the shot at this index (shots are sorted by order)
    const sortedShots = [...currentProject.storyboard.shots].sort((a, b) => a.order - b.order)
    const shot = sortedShots[clampedIndex]

    set(state => ({
      storyboardPlayback: {
        ...state.storyboardPlayback,
        currentShotIndex: clampedIndex,
        currentTime: 0
      }
    }))

    // Navigate to the linked block (switches document if needed, scrolls, highlights)
    if (shot?.linkedBlock && !shot.isUnlinked) {
      await navigateToCitation(shot.linkedBlock.documentId, shot.linkedBlock.blockId)
    }
  },

  setPlaybackSpeed: (speed) => {
    set(state => ({
      storyboardPlayback: {
        ...state.storyboardPlayback,
        speed
      }
    }))
  },

  setPlaybackTime: (time) => {
    set(state => ({
      storyboardPlayback: {
        ...state.storyboardPlayback,
        currentTime: Math.max(0, Math.min(1, time))
      }
    }))
  },

  // Highlight actions for editor integration during playback
  setHighlightedBlock: (blockId, documentId) => {
    set(state => ({
      storyboardUI: {
        ...state.storyboardUI,
        highlightedBlockId: blockId,
        highlightedDocumentId: documentId
      }
    }))
  },

  clearHighlightedBlock: () => {
    set(state => ({
      storyboardUI: {
        ...state.storyboardUI,
        highlightedBlockId: null,
        highlightedDocumentId: null
      }
    }))
  },

  // Save storyboard to project file
  saveStoryboard: async () => {
    const { currentProject } = get()
    if (!currentProject) return

    try {
      await window.api.project.save(currentProject)
      console.log('[ProjectStore] Saved storyboard')
    } catch (error) {
      console.error('[ProjectStore] Failed to save storyboard:', error)
    }
  },

  // Getters
  getShot: (shotId) => {
    const { currentProject } = get()
    return currentProject?.storyboard?.shots.find(s => s.id === shotId)
  },

  getShots: () => {
    const { currentProject } = get()
    return currentProject?.storyboard?.shots || []
  },
  
  // Agenda item actions (for NotesJournal todo tracking)
  
  loadAgendaItems: async () => {
    try {
      const items = await window.api.agenda.getAgendaItems()
      set({ agendaItems: items })
    } catch (error) {
      console.error('Failed to load agenda items:', error)
    }
  },
  
  syncDocumentTodos: async (docId: string, content: JSONContent) => {
    const { currentProject } = get()
    if (!currentProject) return
    
    const doc = currentProject.documents.find(d => d.id === docId)
    if (!doc) return
    
    // Sync todos based on workspace config
    const todoWorkspaceConfig = getWorkspaceConfig(currentProject.templateId)
    
    // Skip if todos not enabled for this workspace
    if (!todoWorkspaceConfig.features.enableTodoLists) return
    
    // If todos are only for notes, check if this is a note (has parentId)
    if (todoWorkspaceConfig.features.todoListsOnlyInNotes && !doc.parentId) return
    
    // Extract todos from content
    const todos: TodoItem[] = []
    let todoIndex = 0
    
    const traverse = (node: JSONContent) => {
      if (node.type === 'taskItem') {
        const checked = node.attrs?.checked === true
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
      
      if (node.content) {
        for (const child of node.content) {
          traverse(child)
        }
      }
    }
    
    traverse(content)
    
    // Update backend
    await window.api.agenda.updateAgendaItem(
      currentProject.path,
      docId,
      doc.title,
      currentProject.name,
      currentProject.templateId,
      todos
    )
    
    // Update local state
    const { agendaItems } = get()
    const existingIndex = agendaItems.findIndex(
      item => item.projectPath === currentProject.path && item.documentId === docId
    )
    
    if (todos.length === 0) {
      // Remove if no todos
      if (existingIndex !== -1) {
        const newItems = [...agendaItems]
        newItems.splice(existingIndex, 1)
        set({ agendaItems: newItems })
      }
    } else {
      const now = new Date().toISOString()
      if (existingIndex !== -1) {
        // Update existing
        const newItems = [...agendaItems]
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          documentTitle: doc.title,
          todos,
          lastUpdated: now
        }
        set({ agendaItems: newItems })
      } else {
        // Add new
        const newItem: AgendaItem = {
          projectPath: currentProject.path,
          projectName: currentProject.name,
          templateId: currentProject.templateId,
          documentId: docId,
          documentTitle: doc.title,
          todos,
          state: 'active',
          lastUpdated: now
        }
        set({ agendaItems: [newItem, ...agendaItems] })
      }
    }
  },
  
  toggleAgendaTodo: async (projectPath: string, documentId: string, todoId: string, checked: boolean) => {
    try {
      await window.api.agenda.toggleTodo(projectPath, documentId, todoId, checked)
      
      // Update local state
      const { agendaItems } = get()
      const itemIndex = agendaItems.findIndex(
        item => item.projectPath === projectPath && item.documentId === documentId
      )
      
      if (itemIndex !== -1) {
        const newItems = [...agendaItems]
        const todoIndex = newItems[itemIndex].todos.findIndex(t => t.id === todoId)
        if (todoIndex !== -1) {
          newItems[itemIndex] = {
            ...newItems[itemIndex],
            todos: newItems[itemIndex].todos.map((t, i) => 
              i === todoIndex ? { ...t, checked } : t
            ),
            lastUpdated: new Date().toISOString()
          }
          set({ agendaItems: newItems })
        }
      }
    } catch (error) {
      console.error('Failed to toggle agenda todo:', error)
    }
  },
  
  markAllAgendaTodosDone: async (projectPath: string, documentId: string) => {
    try {
      await window.api.agenda.markAllTodosDone(projectPath, documentId)
      
      // Update local state
      const { agendaItems } = get()
      const itemIndex = agendaItems.findIndex(
        item => item.projectPath === projectPath && item.documentId === documentId
      )
      
      if (itemIndex !== -1) {
        const newItems = [...agendaItems]
        newItems[itemIndex] = {
          ...newItems[itemIndex],
          todos: newItems[itemIndex].todos.map(t => ({ ...t, checked: true })),
          lastUpdated: new Date().toISOString()
        }
        set({ agendaItems: newItems })
      }
    } catch (error) {
      console.error('Failed to mark all todos done:', error)
    }
  },
  
  updateAgendaItemState: async (projectPath: string, documentId: string, state: DocumentLifecycleState, stateNote?: string) => {
    try {
      await window.api.agenda.updateAgendaState(projectPath, documentId, state, stateNote)
      
      // Update local state
      const { agendaItems } = get()
      const itemIndex = agendaItems.findIndex(
        item => item.projectPath === projectPath && item.documentId === documentId
      )
      
      if (itemIndex !== -1) {
        const newItems = [...agendaItems]
        newItems[itemIndex] = {
          ...newItems[itemIndex],
          state,
          stateNote,
          lastUpdated: new Date().toISOString()
        }
        set({ agendaItems: newItems })
      }
    } catch (error) {
      console.error('Failed to update agenda item state:', error)
    }
  },
  
  removeAgendaItem: async (projectPath: string, documentId: string) => {
    try {
      await window.api.agenda.removeAgendaItem(projectPath, documentId)
      
      // Update local state
      const { agendaItems } = get()
      set({
        agendaItems: agendaItems.filter(
          item => !(item.projectPath === projectPath && item.documentId === documentId)
        )
      })
    } catch (error) {
      console.error('Failed to remove agenda item:', error)
    }
  },

  // Image generation modal actions
  openImageGenerationModal: (selectedText: string, mentions: ExtractedMention[], surroundingContext?: SurroundingScriptContext) => {
    set({
      imageGenerationModal: {
        isOpen: true,
        selectedText,
        mentions,
        surroundingContext,
      }
    })
  },

  closeImageGenerationModal: () => {
    set({
      imageGenerationModal: {
        isOpen: false,
        selectedText: '',
        mentions: [],
        surroundingContext: undefined,
      }
    })
  },

  // Writing Partner / Dramatic Critique actions
  toggleWritingPartnerPanel: () => {
    set(state => ({
      ui: { ...state.ui, writingPartnerPanelOpen: !state.ui.writingPartnerPanelOpen }
    }))
  },

  // Thought Partner actions
  toggleThoughtPartnerPanel: () => {
    const wasOpen = get().ui.thoughtPartnerPanelOpen
    set(state => ({
      ui: { ...state.ui, thoughtPartnerPanelOpen: !state.ui.thoughtPartnerPanelOpen }
    }))
    if (!wasOpen) {
      get().loadThoughtPartnerConversationIndex()
    }
    get().saveWorkspaceLayout()
  },

  setThoughtPartnerPanelWidth: (width: number) => {
    set(state => ({
      ui: { ...state.ui, thoughtPartnerPanelWidth: width }
    }))
    get().saveWorkspaceLayout()
  },

  setThoughtPartnerTextSize: (size: number) => {
    const clamped = Math.min(Math.max(size, 12), 20)
    set(state => ({
      ui: { ...state.ui, thoughtPartnerTextSize: clamped }
    }))
    get().saveWorkspaceLayout()
  },

  appendThoughtPartnerStreamChunk: (chunk: string) => {
    set(state => ({
      thoughtPartner: {
        ...state.thoughtPartner,
        streamingContent: state.thoughtPartner.streamingContent + chunk
      }
    }))
  },

  finalizeThoughtPartnerStream: (message: string, updatedContextDocument?: any, actions?: any[], questions?: any[]) => {
    const state = get()
    const convId = state.thoughtPartner.activeConversationId
    const newMessage = {
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant' as const,
      content: message,
      timestamp: new Date().toISOString(),
      ...(actions && actions.length > 0 ? { actions } : {}),
      ...(questions && questions.length > 0 ? { questions } : {})
    }
    const updatedMessages = [...state.thoughtPartner.messages, newMessage]
    const contextDoc = updatedContextDocument || state.thoughtPartner.contextDocument

    // Auto-title: if this is the first exchange (1 user + 1 assistant = 2 messages total)
    let updatedIndex = state.thoughtPartner.conversationIndex
    if (updatedMessages.length === 2 && convId) {
      const firstUserMsg = updatedMessages.find(m => m.role === 'user')
      if (firstUserMsg) {
        const autoTitle = firstUserMsg.content.slice(0, 50).replace(/\n/g, ' ').trim() + (firstUserMsg.content.length > 50 ? '...' : '')
        updatedIndex = updatedIndex.map(c =>
          c.id === convId ? { ...c, title: autoTitle, updatedAt: new Date().toISOString(), messageCount: updatedMessages.length } : c
        )
      }
    } else if (convId) {
      updatedIndex = updatedIndex.map(c =>
        c.id === convId ? { ...c, updatedAt: new Date().toISOString(), messageCount: updatedMessages.length } : c
      )
    }

    set({
      thoughtPartner: {
        ...state.thoughtPartner,
        messages: updatedMessages,
        contextDocument: contextDoc,
        conversationIndex: updatedIndex,
        isStreaming: false,
        streamingContent: '',
        pendingActions: [
          ...state.thoughtPartner.pendingActions,
          ...(actions || [])
        ],
        activeQuestion: questions && questions.length > 0 ? questions[0] : null
      }
    })

    // Reset pipeline state to idle if no pending pipeline actions
    const hasActivePipelineActions = (state.thoughtPartner.currentPipelineActions || []).some(
      (a: any) => a.status === 'pending'
    )
    if (!hasActivePipelineActions) {
      set(prev => ({
        thoughtPartner: { ...prev.thoughtPartner, pipelineState: 'idle' }
      }))
    }

    // Auto-save conversation
    if (state.currentProject?.path && convId) {
      window.api.thoughtPartner?.saveConversation(state.currentProject.path, convId, {
        messages: updatedMessages,
        contextDocument: contextDoc,
        lastUpdated: new Date().toISOString()
      })
      // Also save updated index (for title/messageCount updates)
      window.api.thoughtPartner?.saveConversationIndex(state.currentProject.path, {
        activeConversationId: convId,
        conversations: updatedIndex
      })
    }
  },

  stopThoughtPartnerStreaming: () => {
    window.api.thoughtPartner?.stopStreaming()
    set(state => ({
      thoughtPartner: {
        ...state.thoughtPartner,
        isStreaming: false,
        streamingContent: ''
      }
    }))
  },

  sendThoughtPartnerMessage: async (text: string) => {
    const state = get()
    if (!state.currentProject || state.thoughtPartner.isStreaming) return

    // Pipeline state lock: block new sends while pipeline is in a non-idle active state
    const lockedStates = ['orchestrating', 'reflecting', 'planning', 'context_gathering', 'reading', 'patching', 'verifying', 'repairing', 'applying']
    if (lockedStates.includes(state.thoughtPartner.pipelineState)) return

    // If no active conversation, create one first
    if (!state.thoughtPartner.activeConversationId) {
      await get().createThoughtPartnerConversation()
    }

    const userMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user' as const,
      content: text,
      timestamp: new Date().toISOString()
    }
    const messagesWithUser = [...get().thoughtPartner.messages, userMessage]

    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        messages: messagesWithUser,
        isStreaming: true,
        streamingContent: '',
        suggestions: []
      }
    }))

    // Build conscious context from active document
    let consciousContext: { title: string; content: string } | null = null
    if (state.activeDocumentId) {
      const activeDoc = state.currentProject.documents.find(d => d.id === state.activeDocumentId)
      const docState = state.documents[state.activeDocumentId]
      if (activeDoc && docState?.content) {
        consciousContext = {
          title: activeDoc.title,
          content: contentToPlainText(docState.content)
        }
      }
    }

    // Build subconscious context from full project
    const subconsciousContext = {
      projectName: state.currentProject.name,
      templateType: state.currentProject.templateId,
      documents: state.currentProject.documents
        .filter(d => d.type === 'document')
        .map(d => {
          const ds = state.documents[d.id]
          return {
            title: d.title,
            content: ds?.content ? contentToPlainText(ds.content) : '',
            isActive: d.id === state.activeDocumentId
          }
        }),
      characters: state.currentProject.characters?.map(c => {
        const noteDoc = c.noteDocumentId ? state.documents[c.noteDocumentId] : null
        return { name: c.name, notes: noteDoc?.content ? contentToPlainText(noteDoc.content) : undefined }
      }),
      props: state.currentProject.props?.map(p => {
        const noteDoc = p.noteDocumentId ? state.documents[p.noteDocumentId] : null
        return { name: p.name, notes: noteDoc?.content ? contentToPlainText(noteDoc.content) : undefined }
      }),
      settings: {
        synopsis: (() => {
          const synopsisDoc = state.currentProject!.documents.find(d => d.title?.toLowerCase().includes('synopsis'))
          if (!synopsisDoc) return undefined
          const ds = state.documents[synopsisDoc.id]
          return ds?.content ? contentToPlainText(ds.content) : undefined
        })()
      }
    }

    try {
      const currentState = get()

      // Gather blocks from ALL project documents for the context gather phase
      let allDocumentBlockContext: import('../../shared/contextGatherTypes').MultiDocumentBlockContext | null = null
      if (currentState.thoughtPartner.usePipeline && currentState.currentProject) {
        const docs: import('../../shared/contextGatherTypes').MultiDocumentBlockContext['documents'] = []
        for (const doc of currentState.currentProject.documents.filter(d => d.type === 'document')) {
          const docState = currentState.documents[doc.id]
          if (!docState?.content?.content) continue
          const blocks: import('../../shared/contextGatherTypes').DocumentBlock[] = []
          for (const node of docState.content.content) {
            const blockId = (node.attrs as any)?.blockId as string
            if (!blockId) continue
            let text = ''
            const extractText = (n: any): void => {
              if (n.type === 'text' && n.text) { text += n.text; return }
              if (n.content) n.content.forEach(extractText)
            }
            extractText(node)
            if (!text.trim()) continue
            // djb2 hash
            let hash = 5381
            for (let i = 0; i < text.length; i++) {
              hash = ((hash << 5) + hash) + text.charCodeAt(i)
              hash = hash & hash
            }
            blocks.push({
              blockId,
              type: node.type || 'paragraph',
              text,
              textHash: (hash >>> 0).toString(16),
            })
          }
          if (blocks.length > 0) {
            docs.push({ documentId: doc.id, documentTitle: doc.title, blocks })
          }
        }
        if (docs.length > 0) {
          allDocumentBlockContext = { documents: docs }
        }
      }

      const response = await (window.api as any).thoughtPartner?.sendMessage({
        message: text,
        conversationHistory: currentState.thoughtPartner.messages.filter(m => m.role !== 'system'),
        consciousContext,
        subconsciousContext,
        contextDocument: currentState.thoughtPartner.contextDocument,
        agentMode: currentState.thoughtPartner.agentMode,
        selectionContext: currentState.thoughtPartner.selectionContext,
        referencedDocuments: currentState.thoughtPartner.referencedDocuments.map(ref => {
          const docState = state.documents[ref.id]
          return {
            id: ref.id,
            title: ref.title,
            content: docState?.content ? contentToPlainText(docState.content) : ''
          }
        }),
        // Pipeline fields
        usePipeline: currentState.thoughtPartner.usePipeline,
        documentBlockContext: currentState.thoughtPartner.documentBlockContext,
        structuredMemory: currentState.thoughtPartner.structuredMemory,
        allDocumentBlockContext,
        // Intent classification context
        currentPipelineActions: currentState.thoughtPartner.currentPipelineActions,
        consecutiveChatTurns: currentState.thoughtPartner.consecutiveChatTurns,
        // Behavior policy vector
        behaviorVector: currentState.thoughtPartner.currentBehaviorVector || undefined,
        // Cursor context (only when Focus toggle is on)
        cursorContext: currentState.thoughtPartner.useCursorContext && currentState.thoughtPartner.cursorContext
          ? currentState.thoughtPartner.cursorContext
          : undefined,
      })

      if (!response) {
        get().finalizeThoughtPartnerStream('Thought Partner API is not available. Please restart the app.', undefined)
        return
      }

      if (response.error) {
        get().finalizeThoughtPartnerStream(response.error, undefined)
      } else if (response.message !== undefined) {
        const actions = (response as any).actions as any[] | undefined
        const questions = (response as any).questions as any[] | undefined
        const pipelineActions = (response as any).pipelineActions as any[] | undefined
        const updatedStructuredMemory = (response as any).updatedStructuredMemory

        // Capture current auto-accept state BEFORE we auto-enable agent mode
        const { agentMode: wasAgentMode, autoAcceptEdits } = get().thoughtPartner

        get().finalizeThoughtPartnerStream(response.message, response.updatedContextDocument, actions, questions)

        // Handle pipeline-specific response data
        if (pipelineActions && pipelineActions.length > 0) {
          set(prev => ({
            thoughtPartner: {
              ...prev.thoughtPartner,
              currentPipelineActions: pipelineActions,
              pipelineState: 'awaiting_approval',
            }
          }))
        }

        if (updatedStructuredMemory) {
          set(prev => ({
            thoughtPartner: {
              ...prev.thoughtPartner,
              structuredMemory: updatedStructuredMemory,
            }
          }))
        }

        // Always auto-send content actions (insert/replace) to the editor as AIPreview.
        // Non-content actions (create-character, create-prop) still require agent mode or explicit accept.
        if (actions && actions.length > 0) {
          for (const action of actions) {
            const isContentAction = action.type === 'insert-content' || action.type === 'replace-content'
            if (isContentAction || wasAgentMode || autoAcceptEdits) {
              await get().acceptThoughtPartnerAction(action.id)
            }
          }
        }

        // Always auto-send pipeline edit actions to the editor.
        // Plan actions are NEVER auto-accepted — they require explicit user approval.
        // Non-edit pipeline actions still require agent mode or explicit accept.
        if (pipelineActions && pipelineActions.length > 0) {
          for (const pa of pipelineActions) {
            if (pa.type === 'plan') continue // Plans require explicit approval
            if (pa.type === 'reflection') continue // Reflections require explicit confirmation
            if (pa.type === 'idea') continue // Ideas require explicit interaction
            if (autoAcceptEdits) {
              await get().acceptPipelineAction(pa.id)
            }
          }
        }

        // Capture behavior policy response metadata for the feedback loop
        const expressedDimensions = (response as any).expressedDimensions
        const behaviorVectorUsed = (response as any).behaviorVectorUsed
        if (expressedDimensions || behaviorVectorUsed) {
          set(prev => ({
            thoughtPartner: {
              ...prev.thoughtPartner,
              lastResponseMeta: { expressedDimensions, behaviorVectorUsed },
            }
          }))
        }

        // Update consecutive chat turns streak counter
        // Reset on edit actions OR question tool calls (both indicate active engagement, not passive chat)
        const hadEditActions = pipelineActions?.some((pa: any) => pa.type === 'edit')
        const hadQuestions = questions && questions.length > 0
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            consecutiveChatTurns: (hadEditActions || hadQuestions) ? 0 : prev.thoughtPartner.consecutiveChatTurns + 1,
          }
        }))
      }
    } catch (err: any) {
      get().finalizeThoughtPartnerStream(
        `Error: ${err.message || 'Failed to get response'}`,
        undefined
      )
    }
  },

  editThoughtPartnerMessage: async (messageId: string, newText: string) => {
    const state = get()
    if (!state.currentProject || state.thoughtPartner.isStreaming) return

    // Find the message index
    const msgIndex = state.thoughtPartner.messages.findIndex(m => m.id === messageId)
    if (msgIndex === -1) return

    // Truncate: keep only messages BEFORE the edited message
    const truncatedMessages = state.thoughtPartner.messages.slice(0, msgIndex)

    // Clear stale state from truncated messages and set truncated history
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        messages: truncatedMessages,
        pendingActions: [],
        pendingEditorInsertion: null,
        activeQuestion: null,
        currentPipelineActions: [],
        pipelineState: 'idle',
      }
    }))

    // Auto-save the truncated conversation
    const convId = state.thoughtPartner.activeConversationId
    if (convId && state.currentProject?.path) {
      window.api.thoughtPartner?.saveConversation(state.currentProject.path, convId, {
        messages: truncatedMessages,
        contextDocument: state.thoughtPartner.contextDocument,
        lastUpdated: new Date().toISOString(),
      })
    }

    // Send the edited message — this appends the new user message + gets AI response
    await get().sendThoughtPartnerMessage(newText)
  },

  regenerateThoughtPartnerResponse: async () => {
    const state = get()
    if (!state.currentProject || state.thoughtPartner.isStreaming) return
    if (state.thoughtPartner.messages.length === 0) return

    // Find the last user message
    let lastUserMsg: typeof state.thoughtPartner.messages[0] | null = null
    for (let i = state.thoughtPartner.messages.length - 1; i >= 0; i--) {
      if (state.thoughtPartner.messages[i].role === 'user') {
        lastUserMsg = state.thoughtPartner.messages[i]
        break
      }
    }
    if (!lastUserMsg) return

    // Resend by editing the last user message with the same content
    await get().editThoughtPartnerMessage(lastUserMsg.id, lastUserMsg.content)
  },

  loadThoughtPartnerConversationIndex: async () => {
    const state = get()
    if (!state.currentProject?.path) return

    try {
      const index = await window.api.thoughtPartner?.loadConversationIndex(state.currentProject.path)
      if (!index) return

      set(prev => ({
        thoughtPartner: {
          ...prev.thoughtPartner,
          conversationIndex: index.conversations,
          activeConversationId: index.activeConversationId
        }
      }))

      // Load the active conversation, or create one if none exist
      if (index.activeConversationId) {
        get().loadThoughtPartnerConversation()
      } else if (index.conversations.length === 0) {
        await get().createThoughtPartnerConversation()
      }
    } catch (err) {
      console.error('[ProjectStore] Failed to load thought partner index:', err)
    }
  },

  loadThoughtPartnerConversation: async () => {
    const state = get()
    const convId = state.thoughtPartner.activeConversationId
    if (!state.currentProject?.path || !convId) return

    try {
      const saved = await window.api.thoughtPartner?.loadConversation(state.currentProject.path, convId)
      if (saved) {
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            messages: saved.messages,
            contextDocument: saved.contextDocument
          }
        }))
      }

      // Generate suggestions if no messages yet
      if (!saved || saved.messages.length === 0) {
        get().generateThoughtPartnerSuggestions()
      }
    } catch (err) {
      console.error('[ProjectStore] Failed to load thought partner conversation:', err)
    }
  },

  switchThoughtPartnerConversation: async (conversationId: string) => {
    const state = get()
    if (!state.currentProject?.path) return
    if (conversationId === state.thoughtPartner.activeConversationId) return

    // Stop streaming if active
    if (state.thoughtPartner.isStreaming) {
      get().stopThoughtPartnerStreaming()
    }

    // Update active ID in state and on disk
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        activeConversationId: conversationId,
        messages: [],
        contextDocument: { decisions: [], openQuestions: [], ideas: [], risks: [], considerations: [], lastUpdated: new Date().toISOString() },
        suggestions: [],
        isStreaming: false,
        streamingContent: '',
        isConversationListOpen: false
      }
    }))

    // Save updated index
    const updatedState = get()
    window.api.thoughtPartner?.saveConversationIndex(state.currentProject.path, {
      activeConversationId: conversationId,
      conversations: updatedState.thoughtPartner.conversationIndex
    })

    // Load the conversation data
    get().loadThoughtPartnerConversation()
  },

  createThoughtPartnerConversation: async () => {
    const state = get()
    if (!state.currentProject?.path) return

    // Stop streaming if active
    if (state.thoughtPartner.isStreaming) {
      get().stopThoughtPartnerStreaming()
    }

    try {
      const meta = await window.api.thoughtPartner?.createConversation(state.currentProject.path)
      if (!meta) return

      set(prev => ({
        thoughtPartner: {
          ...prev.thoughtPartner,
          conversationIndex: [meta, ...prev.thoughtPartner.conversationIndex],
          activeConversationId: meta.id,
          messages: [],
          contextDocument: { decisions: [], openQuestions: [], ideas: [], risks: [], considerations: [], lastUpdated: new Date().toISOString() },
          suggestions: [],
          isStreaming: false,
          streamingContent: '',
          isConversationListOpen: false,
          consecutiveChatTurns: 0,
        }
      }))

      // Generate suggestions for the new conversation
      get().generateThoughtPartnerSuggestions()
    } catch (err) {
      console.error('[ProjectStore] Failed to create thought partner conversation:', err)
    }
  },

  deleteThoughtPartnerConversation: async (conversationId: string) => {
    const state = get()
    if (!state.currentProject?.path) return

    // Stop streaming if deleting the active conversation
    if (conversationId === state.thoughtPartner.activeConversationId && state.thoughtPartner.isStreaming) {
      get().stopThoughtPartnerStreaming()
    }

    try {
      const updatedIndex = await window.api.thoughtPartner?.deleteConversation(state.currentProject.path, conversationId)
      if (!updatedIndex) return

      const wasActive = conversationId === state.thoughtPartner.activeConversationId

      set(prev => ({
        thoughtPartner: {
          ...prev.thoughtPartner,
          conversationIndex: updatedIndex.conversations,
          activeConversationId: wasActive ? updatedIndex.activeConversationId : prev.thoughtPartner.activeConversationId,
          ...(wasActive ? {
            messages: [],
            contextDocument: { decisions: [], openQuestions: [], ideas: [], risks: [], considerations: [], lastUpdated: new Date().toISOString() },
            suggestions: [],
            isStreaming: false,
            streamingContent: ''
          } : {})
        }
      }))

      // If we deleted the active one, load the new active or create a new one
      if (wasActive) {
        if (updatedIndex.activeConversationId) {
          get().loadThoughtPartnerConversation()
        } else {
          await get().createThoughtPartnerConversation()
        }
      }
    } catch (err) {
      console.error('[ProjectStore] Failed to delete thought partner conversation:', err)
    }
  },

  clearThoughtPartnerConversation: async () => {
    const state = get()
    const convId = state.thoughtPartner.activeConversationId
    if (!state.currentProject?.path || !convId) return

    // Delete the current conversation and create a fresh one
    await get().deleteThoughtPartnerConversation(convId)
  },

  toggleThoughtPartnerConversationList: () => {
    set(state => ({
      thoughtPartner: {
        ...state.thoughtPartner,
        isConversationListOpen: !state.thoughtPartner.isConversationListOpen
      }
    }))
  },

  generateThoughtPartnerSuggestions: async () => {
    const state = get()
    if (!state.currentProject) return

    // Build context for hashing
    const subconsciousContext = {
      projectName: state.currentProject.name,
      templateType: state.currentProject.templateId,
      documents: state.currentProject.documents
        .filter(d => d.type === 'document')
        .map(d => {
          const ds = state.documents[d.id]
          return {
            title: d.title,
            content: ds?.content ? contentToPlainText(ds.content) : '',
            isActive: d.id === state.activeDocumentId
          }
        }),
      characters: state.currentProject.characters?.map(c => ({ name: c.name })),
      props: state.currentProject.props?.map(p => ({ name: p.name }))
    }

    // Compute a simple content hash to detect changes
    const hashSource = JSON.stringify({
      name: subconsciousContext.projectName,
      template: subconsciousContext.templateType,
      docs: subconsciousContext.documents.map(d => d.title + ':' + d.content.slice(0, 500)),
      chars: subconsciousContext.characters?.map(c => c.name),
      props: subconsciousContext.props?.map(p => p.name)
    })
    let contentHash = 0
    for (let i = 0; i < hashSource.length; i++) {
      contentHash = ((contentHash << 5) - contentHash + hashSource.charCodeAt(i)) | 0
    }
    const hashStr = contentHash.toString(36)

    // Check in-memory cache first
    if (hashStr === state.thoughtPartner._suggestionsContentHash && state.thoughtPartner.suggestions.length > 0) {
      return
    }

    set(prev => ({
      thoughtPartner: { ...prev.thoughtPartner, isLoadingSuggestions: true }
    }))

    try {
      // Check disk cache before making API call
      const projectPath = state.currentProject.path
      if (projectPath) {
        const diskCache = await (window.api as any).thoughtPartner?.loadSuggestionsCache(projectPath)
        if (diskCache && diskCache.contentHash === hashStr && diskCache.suggestions.length > 0) {
          set(prev => ({
            thoughtPartner: {
              ...prev.thoughtPartner,
              suggestions: diskCache.suggestions,
              isLoadingSuggestions: false,
              _suggestionsContentHash: hashStr
            }
          }))
          return
        }
      }

      // Cache miss — call API
      const suggestions = await window.api.thoughtPartner?.getSuggestions({ subconsciousContext })
      const result = suggestions || []

      set(prev => ({
        thoughtPartner: {
          ...prev.thoughtPartner,
          suggestions: result,
          isLoadingSuggestions: false,
          _suggestionsContentHash: hashStr
        }
      }))

      // Persist to disk for next session
      if (projectPath && result.length > 0) {
        ;(window.api as any).thoughtPartner?.saveSuggestionsCache(projectPath, {
          contentHash: hashStr,
          suggestions: result,
          cachedAt: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error('[ProjectStore] Failed to generate suggestions:', err)
      set(prev => ({
        thoughtPartner: { ...prev.thoughtPartner, isLoadingSuggestions: false }
      }))
    }
  },

  acceptThoughtPartnerAction: async (actionId: string) => {
    const state = get()
    const action = state.thoughtPartner.pendingActions.find((a: any) => a.id === actionId)
    if (!action) return

    // Mark as executing
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        pendingActions: prev.thoughtPartner.pendingActions.map((a: any) =>
          a.id === actionId ? { ...a, status: 'executing' } : a
        )
      }
    }))

    try {
      switch (action.type) {
        case 'create-character': {
          const { name, color } = action.content
          // Dedup check
          const existing = state.currentProject?.characters?.find(
            (c: any) => c.name.toLowerCase() === name.toLowerCase()
          )
          if (!existing) {
            await get().addCharacter(name, color)
          }
          break
        }
        case 'create-prop': {
          const { name, icon } = action.content
          // Dedup check
          const existing = state.currentProject?.props?.find(
            (p: any) => p.name.toLowerCase() === name.toLowerCase()
          )
          if (!existing) {
            await get().addProp(name, icon)
          }
          break
        }
        case 'insert-content': {
          // Set pending editor insertion — the editor component picks this up
          set(prev => ({
            thoughtPartner: {
              ...prev.thoughtPartner,
              pendingEditorInsertion: {
                actionId,
                mode: 'insert',
                screenplayElements: action.content.screenplayElements,
                text: action.content.text,
                insertionPoint: action.content.insertionPoint || 'end',
                afterHeading: action.content.afterHeading
              }
            }
          }))
          break
        }
        case 'replace-content': {
          // Set pending editor replacement — the editor finds the block(s) and replaces them
          set(prev => ({
            thoughtPartner: {
              ...prev.thoughtPartner,
              pendingEditorInsertion: {
                actionId,
                mode: 'replace',
                screenplayElements: action.content.screenplayElements,
                text: action.content.text,
                insertionPoint: 'after-heading',
                targetHeading: action.content.targetHeading,
                targetText: action.content.targetText
              }
            }
          }))
          break
        }
      }

      // Mark as completed (for insert-content, this means "dispatched to editor")
      // and update the action on the message too
      const finalStatus = (action.type === 'insert-content' || action.type === 'replace-content') ? 'accepted' : 'completed'
      set(prev => ({
        thoughtPartner: {
          ...prev.thoughtPartner,
          pendingActions: prev.thoughtPartner.pendingActions.map((a: any) =>
            a.id === actionId ? { ...a, status: finalStatus } : a
          ),
          messages: prev.thoughtPartner.messages.map((m: any) => {
            if (!m.actions) return m
            return {
              ...m,
              actions: m.actions.map((a: any) =>
                a.id === actionId ? { ...a, status: finalStatus } : a
              )
            }
          })
        }
      }))

      // Auto-save so the accepted/completed status persists across refreshes
      const convId = state.thoughtPartner.activeConversationId
      if (state.currentProject?.path && convId) {
        const updatedState = get()
        window.api.thoughtPartner?.saveConversation(state.currentProject.path, convId, {
          messages: updatedState.thoughtPartner.messages,
          contextDocument: updatedState.thoughtPartner.contextDocument,
          lastUpdated: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error('[ProjectStore] Failed to execute thought partner action:', err)
      set(prev => ({
        thoughtPartner: {
          ...prev.thoughtPartner,
          pendingActions: prev.thoughtPartner.pendingActions.map((a: any) =>
            a.id === actionId ? { ...a, status: 'failed' } : a
          ),
          messages: prev.thoughtPartner.messages.map((m: any) => {
            if (!m.actions) return m
            return {
              ...m,
              actions: m.actions.map((a: any) =>
                a.id === actionId ? { ...a, status: 'failed' } : a
              )
            }
          })
        }
      }))

      // Also persist failed status so it doesn't revert to pending on refresh
      const convId = state.thoughtPartner.activeConversationId
      if (state.currentProject?.path && convId) {
        const updatedState = get()
        window.api.thoughtPartner?.saveConversation(state.currentProject.path, convId, {
          messages: updatedState.thoughtPartner.messages,
          contextDocument: updatedState.thoughtPartner.contextDocument,
          lastUpdated: new Date().toISOString()
        })
      }
    }
  },

  rejectThoughtPartnerAction: (actionId: string) => {
    const state = get()
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        pendingActions: prev.thoughtPartner.pendingActions.map((a: any) =>
          a.id === actionId ? { ...a, status: 'rejected' } : a
        ),
        messages: prev.thoughtPartner.messages.map((m: any) => {
          if (!m.actions) return m
          return {
            ...m,
            actions: m.actions.map((a: any) =>
              a.id === actionId ? { ...a, status: 'rejected' } : a
            )
          }
        })
      }
    }))

    // Auto-save so the rejected status persists across refreshes
    const convId = state.thoughtPartner.activeConversationId
    if (state.currentProject?.path && convId) {
      const updatedState = get()
      window.api.thoughtPartner?.saveConversation(state.currentProject.path, convId, {
        messages: updatedState.thoughtPartner.messages,
        contextDocument: updatedState.thoughtPartner.contextDocument,
        lastUpdated: new Date().toISOString()
      })
    }
  },

  clearThoughtPartnerEditorInsertion: () => {
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        pendingEditorInsertion: null,
        pipelineState: prev.thoughtPartner.pipelineState === 'applying' ? 'idle' : prev.thoughtPartner.pipelineState
      }
    }))
  },

  toggleThoughtPartnerAgentMode: () => {
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        agentMode: !prev.thoughtPartner.agentMode
      }
    }))
  },

  toggleThoughtPartnerAutoAccept: () => {
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        autoAcceptEdits: !prev.thoughtPartner.autoAcceptEdits
      }
    }))
  },

  answerThoughtPartnerQuestion: async (questionId: string, optionId?: string, customText?: string) => {
    const state = get()
    // Find the question on the active question or in messages
    const activeQ = state.thoughtPartner.activeQuestion
    if (!activeQ || activeQ.id !== questionId || activeQ.status !== 'active') return

    // Determine the answer text
    const answerText = optionId
      ? activeQ.options.find((o: any) => o.id === optionId)?.label || customText || ''
      : customText || ''

    // Mark the question as answered on the message that contains it, and clear activeQuestion
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        activeQuestion: null,
        messages: prev.thoughtPartner.messages.map((m: any) => {
          if (!m.questions) return m
          return {
            ...m,
            questions: m.questions.map((q: any) =>
              q.id === questionId
                ? { ...q, status: 'answered', selectedOptionId: optionId || undefined, customAnswer: customText || undefined }
                : q
            )
          }
        })
      }
    }))

    // Auto-save the updated conversation
    const convId = state.thoughtPartner.activeConversationId
    if (state.currentProject?.path && convId) {
      const updatedState = get()
      window.api.thoughtPartner?.saveConversation(state.currentProject.path, convId, {
        messages: updatedState.thoughtPartner.messages,
        contextDocument: updatedState.thoughtPartner.contextDocument,
        lastUpdated: new Date().toISOString()
      })
    }

    // Now continue the conversation — send the answer as a follow-up message
    // The conversation builder will reconstruct the tool response from the answered question
    await get().sendThoughtPartnerMessage(answerText)
  },

  skipThoughtPartnerQuestion: async (questionId: string) => {
    const state = get()
    const activeQ = state.thoughtPartner.activeQuestion
    if (!activeQ || activeQ.id !== questionId) return

    // Mark the question as skipped on the message that contains it
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        activeQuestion: null,
        messages: prev.thoughtPartner.messages.map((m: any) => {
          if (!m.questions) return m
          return {
            ...m,
            questions: m.questions.map((q: any) =>
              q.id === questionId ? { ...q, status: 'skipped' } : q
            )
          }
        })
      }
    }))

    // Auto-save
    const convId = state.thoughtPartner.activeConversationId
    if (state.currentProject?.path && convId) {
      const updatedState = get()
      window.api.thoughtPartner?.saveConversation(state.currentProject.path, convId, {
        messages: updatedState.thoughtPartner.messages,
        contextDocument: updatedState.thoughtPartner.contextDocument,
        lastUpdated: new Date().toISOString()
      })
    }

    // Continue conversation with a skip note
    await get().sendThoughtPartnerMessage("I'd prefer to skip this question and move on.")
  },

  setThoughtPartnerSelectionContext: (context) => {
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        selectionContext: context
      }
    }))
  },

  clearThoughtPartnerSelectionContext: () => {
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        selectionContext: null
      }
    }))
  },

  updateCursorContext: (context) => {
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        cursorContext: context
      }
    }))
  },

  toggleUseCursorContext: () => {
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        useCursorContext: !prev.thoughtPartner.useCursorContext,
        // Clear computed context when toggling off
        ...(!prev.thoughtPartner.useCursorContext ? {} : { cursorContext: null }),
      }
    }))
  },

  setCursorContextRadius: (radius) => {
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        cursorContextRadius: radius
      }
    }))
  },

  addThoughtPartnerReference: (doc) => {
    set(prev => {
      const already = prev.thoughtPartner.referencedDocuments.some(r => r.id === doc.id)
      if (already) return prev
      return {
        thoughtPartner: {
          ...prev.thoughtPartner,
          referencedDocuments: [...prev.thoughtPartner.referencedDocuments, { id: doc.id, title: doc.title }]
        }
      }
    })
  },

  removeThoughtPartnerReference: (docId) => {
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        referencedDocuments: prev.thoughtPartner.referencedDocuments.filter(r => r.id !== docId)
      }
    }))
  },

  clearThoughtPartnerReferences: () => {
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        referencedDocuments: []
      }
    }))
  },

  // Pipeline actions
  setThoughtPartnerUsePipeline: (enabled: boolean) => {
    set(prev => ({
      thoughtPartner: { ...prev.thoughtPartner, usePipeline: enabled }
    }))
  },

  updateDocumentBlockContext: (context) => {
    set(prev => ({
      thoughtPartner: { ...prev.thoughtPartner, documentBlockContext: context }
    }))
  },

  setPipelineState: (state: string) => {
    set(prev => ({
      thoughtPartner: { ...prev.thoughtPartner, pipelineState: state }
    }))
  },

  acceptPipelineAction: async (actionId: string) => {
    const state = get()
    const action = state.thoughtPartner.currentPipelineActions.find(a => a.id === actionId)
    if (!action) return

    if (action.type === 'create-character' && action.content?.name) {
      // Same as legacy create-character handling
      const name = action.content.name
      if (state.currentProject?.characters?.some(c => c.name.toUpperCase() === name.toUpperCase())) {
        console.log('[Pipeline] Character already exists:', name)
      } else {
        const newChar = { id: `char-${Date.now()}`, name, color: '#808080', noteDocumentId: '' }
        set(prev => ({
          currentProject: prev.currentProject ? {
            ...prev.currentProject,
            characters: [...(prev.currentProject.characters || []), newChar]
          } : prev.currentProject
        }))
      }
    } else if (action.type === 'create-prop' && action.content?.name) {
      const name = action.content.name
      if (state.currentProject?.props?.some(p => p.name.toUpperCase() === name.toUpperCase())) {
        console.log('[Pipeline] Prop already exists:', name)
      } else {
        const newProp = { id: `prop-${Date.now()}`, name, icon: 'Box24Regular', noteDocumentId: '' }
        set(prev => ({
          currentProject: prev.currentProject ? {
            ...prev.currentProject,
            props: [...(prev.currentProject.props || []), newProp]
          } : prev.currentProject
        }))
      }
    } else if (action.type === 'edit' && action.patchList) {
      // Build pendingEditorInsertion from pipeline patch ops
      const ops = action.patchList.ops
      if (ops.length > 0) {
        const firstOp = ops[0]
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            pendingEditorInsertion: {
              actionId,
              mode: firstOp.type === 'delete' ? 'delete' : firstOp.type === 'insert' ? 'insert' : 'replace',
              text: firstOp.content,
              screenplayElements: firstOp.screenplayElements,
              insertionPoint: 'cursor' as const,
              pipelineOps: ops,
              anchorBlockId: firstOp.anchor?.blockId,
              originalText: firstOp.anchor?.textSnapshot,
              targetText: firstOp.anchor?.textSnapshot,
              opWhy: firstOp.why,
            }
          }
        }))
      }
    }

    // Mark action as accepted and reset chat streak
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        currentPipelineActions: prev.thoughtPartner.currentPipelineActions.map(a =>
          a.id === actionId ? { ...a, status: 'accepted' as const } : a
        ),
        pipelineState: 'applying',
        consecutiveChatTurns: 0,
      }
    }))
  },

  rejectPipelineAction: (actionId: string) => {
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        currentPipelineActions: prev.thoughtPartner.currentPipelineActions.map(a =>
          a.id === actionId ? { ...a, status: 'rejected' as const } : a
        ),
        pipelineState: 'completed',
      }
    }))
  },

  approvePlan: async (planId: string) => {
    const state = get()
    const planAction = state.thoughtPartner.currentPipelineActions.find(
      a => a.type === 'plan' && a.structuredPlan?.id === planId
    )
    if (!planAction?.structuredPlan || !state.currentProject) return

    // Mark plan as approved
    const approvedPlan = { ...planAction.structuredPlan, status: 'approved' as const }
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        currentPipelineActions: prev.thoughtPartner.currentPipelineActions.map(a =>
          a.id === planAction.id ? { ...a, structuredPlan: approvedPlan } : a
        ),
        pipelineState: 'context_gathering',
      }
    }))

    // Build context for the IPC call (same pattern as sendThoughtPartnerMessage)
    const currentState = get()
    const subconsciousContext = {
      projectName: currentState.currentProject!.name,
      templateType: currentState.currentProject!.templateId,
      documents: [],
      characters: [],
      props: [],
      settings: {},
    }

    // Gather blocks from all project documents
    let allDocumentBlockContext: import('../../shared/contextGatherTypes').MultiDocumentBlockContext | null = null
    if (currentState.currentProject) {
      const docs: import('../../shared/contextGatherTypes').MultiDocumentBlockContext['documents'] = []
      for (const doc of currentState.currentProject.documents.filter(d => d.type === 'document')) {
        const docState = currentState.documents[doc.id]
        if (!docState?.content?.content) continue
        const blocks: import('../../shared/contextGatherTypes').DocumentBlock[] = []
        for (const node of docState.content.content) {
          const blockId = (node.attrs as any)?.blockId as string
          if (!blockId) continue
          let text = ''
          const extractText = (n: any): void => {
            if (n.type === 'text' && n.text) { text += n.text; return }
            if (n.content) n.content.forEach(extractText)
          }
          extractText(node)
          if (!text.trim()) continue
          let hash = 5381
          for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) + hash) + text.charCodeAt(i)
            hash = hash & hash
          }
          blocks.push({ blockId, type: node.type || 'paragraph', text, textHash: (hash >>> 0).toString(16) })
        }
        if (blocks.length > 0) {
          docs.push({ documentId: doc.id, documentTitle: doc.title, blocks })
        }
      }
      if (docs.length > 0) {
        allDocumentBlockContext = { documents: docs }
      }
    }

    // Execute the plan via IPC
    try {
      const response = await (window.api as any).thoughtPartner?.executePlan({
        structuredPlan: approvedPlan,
        message: currentState.thoughtPartner.messages[currentState.thoughtPartner.messages.length - 1]?.content || '',
        subconsciousContext,
        documentBlockContext: currentState.thoughtPartner.documentBlockContext,
        allDocumentBlockContext,
        structuredMemory: currentState.thoughtPartner.structuredMemory,
        usePipeline: true,
      })

      if (response?.pipelineActions?.length > 0) {
        // Auto-accept edit actions from approved plans
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            currentPipelineActions: [
              ...prev.thoughtPartner.currentPipelineActions,
              ...response.pipelineActions,
            ],
            pipelineState: 'awaiting_approval',
          }
        }))

        for (const pa of response.pipelineActions) {
          if (pa.type === 'edit' && get().thoughtPartner.autoAcceptEdits) {
            await get().acceptPipelineAction(pa.id)
          }
        }
      } else if (response?.error) {
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            pipelineState: 'failed',
          }
        }))
      }
    } catch (err) {
      console.error('[ProjectStore] Plan execution failed:', err)
      set(prev => ({
        thoughtPartner: {
          ...prev.thoughtPartner,
          pipelineState: 'failed',
        }
      }))
    }
  },

  revisePlan: async (planId: string, feedback: string) => {
    const state = get()
    const planAction = state.thoughtPartner.currentPipelineActions.find(
      a => a.type === 'plan' && a.structuredPlan?.id === planId
    )
    if (!planAction?.structuredPlan) return

    // Mark plan as revised
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        currentPipelineActions: prev.thoughtPartner.currentPipelineActions.map(a =>
          a.id === planAction.id
            ? { ...a, structuredPlan: { ...a.structuredPlan!, status: 'revised' as const } }
            : a
        ),
      }
    }))

    // Send revision as a follow-up message
    await get().sendThoughtPartnerMessage(
      `I'd like to revise the plan. Feedback: ${feedback}\n\nPlease update the plan using produce_plan again with these changes.`
    )
  },

  rejectPlan: (planId: string) => {
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        currentPipelineActions: prev.thoughtPartner.currentPipelineActions.map(a =>
          a.type === 'plan' && a.structuredPlan?.id === planId
            ? { ...a, status: 'rejected' as const, structuredPlan: { ...a.structuredPlan!, status: 'rejected' as const } }
            : a
        ),
        pipelineState: 'idle',
      }
    }))
  },

  acceptReflection: async (reflectionId: string) => {
    const state = get()
    const reflectionAction = state.thoughtPartner.currentPipelineActions.find(
      a => a.type === 'reflection' && a.reflection?.id === reflectionId
    )
    if (!reflectionAction?.reflection || !state.currentProject) return

    // Mark reflection as accepted
    const acceptedReflection = { ...reflectionAction.reflection, status: 'accepted' as const }
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        currentPipelineActions: prev.thoughtPartner.currentPipelineActions.map(a =>
          a.id === reflectionAction.id ? { ...a, reflection: acceptedReflection } : a
        ),
        pipelineState: 'orchestrating',
      }
    }))

    // Build context (same pattern as approvePlan)
    const currentState = get()
    const subconsciousContext = {
      projectName: currentState.currentProject!.name,
      templateType: currentState.currentProject!.templateId,
      documents: [],
      characters: [],
      props: [],
      settings: {},
    }

    let allDocumentBlockContext: import('../../shared/contextGatherTypes').MultiDocumentBlockContext | null = null
    if (currentState.currentProject) {
      const docs: import('../../shared/contextGatherTypes').MultiDocumentBlockContext['documents'] = []
      for (const doc of currentState.currentProject.documents.filter(d => d.type === 'document')) {
        const docState = currentState.documents[doc.id]
        if (!docState?.content?.content) continue
        const blocks: import('../../shared/contextGatherTypes').DocumentBlock[] = []
        for (const node of docState.content.content) {
          const blockId = (node.attrs as any)?.blockId as string
          if (!blockId) continue
          let text = ''
          const extractText = (n: any): void => {
            if (n.type === 'text' && n.text) { text += n.text; return }
            if (n.content) n.content.forEach(extractText)
          }
          extractText(node)
          if (!text.trim()) continue
          let hash = 5381
          for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) + hash) + text.charCodeAt(i)
            hash = hash & hash
          }
          blocks.push({ blockId, type: node.type || 'paragraph', text, textHash: (hash >>> 0).toString(16) })
        }
        if (blocks.length > 0) {
          docs.push({ documentId: doc.id, documentTitle: doc.title, blocks })
        }
      }
      if (docs.length > 0) {
        allDocumentBlockContext = { documents: docs }
      }
    }

    try {
      const response = await (window.api as any).thoughtPartner?.acceptReflection({
        reflection: acceptedReflection,
        message: currentState.thoughtPartner.messages[currentState.thoughtPartner.messages.length - 1]?.content || '',
        subconsciousContext,
        documentBlockContext: currentState.thoughtPartner.documentBlockContext,
        allDocumentBlockContext,
        structuredMemory: currentState.thoughtPartner.structuredMemory,
        usePipeline: true,
        conversationHistory: currentState.thoughtPartner.messages.filter(m => m.role !== 'system'),
        consciousContext: null,
        contextDocument: currentState.thoughtPartner.contextDocument,
        agentMode: currentState.thoughtPartner.agentMode,
        selectionContext: currentState.thoughtPartner.selectionContext,
        referencedDocuments: currentState.thoughtPartner.referencedDocuments.map(ref => {
          const docState = state.documents[ref.id]
          return { id: ref.id, title: ref.title, content: docState?.content ? contentToPlainText(docState.content) : '' }
        }),
      })

      if (response?.pipelineActions?.length > 0) {
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            currentPipelineActions: [
              ...prev.thoughtPartner.currentPipelineActions,
              ...response.pipelineActions,
            ],
            pipelineState: response.pipelineActions.some((a: any) => a.type === 'plan') ? 'planning' :
                           response.pipelineActions.some((a: any) => a.type === 'reflection') ? 'reflecting' :
                           'awaiting_approval',
          }
        }))

        // Auto-accept edit actions, skip plans and reflections
        for (const pa of response.pipelineActions) {
          if (pa.type === 'plan' || pa.type === 'reflection') continue
          if (pa.type === 'edit' && get().thoughtPartner.autoAcceptEdits) {
            await get().acceptPipelineAction(pa.id)
          }
        }
      }

      if (response?.updatedStructuredMemory) {
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            structuredMemory: response.updatedStructuredMemory,
          }
        }))
      }

      if (response?.message) {
        get().finalizeThoughtPartnerStream(response.message, response.updatedContextDocument)
      }
    } catch (err) {
      console.error('[ProjectStore] Reflection acceptance failed:', err)
      set(prev => ({
        thoughtPartner: {
          ...prev.thoughtPartner,
          pipelineState: 'failed',
        }
      }))
    }
  },

  editReflection: async (reflectionId: string, newInterpretation: string) => {
    const state = get()
    const reflectionAction = state.thoughtPartner.currentPipelineActions.find(
      a => a.type === 'reflection' && a.reflection?.id === reflectionId
    )
    if (!reflectionAction?.reflection || !state.currentProject) return

    // Mark reflection as edited
    const editedReflection = {
      ...reflectionAction.reflection,
      status: 'edited' as const,
      editedInterpretation: newInterpretation,
    }
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        currentPipelineActions: prev.thoughtPartner.currentPipelineActions.map(a =>
          a.id === reflectionAction.id ? { ...a, reflection: editedReflection } : a
        ),
        pipelineState: 'orchestrating',
      }
    }))

    // Build context (same pattern)
    const currentState = get()
    const subconsciousContext = {
      projectName: currentState.currentProject!.name,
      templateType: currentState.currentProject!.templateId,
      documents: [],
      characters: [],
      props: [],
      settings: {},
    }

    let allDocumentBlockContext: import('../../shared/contextGatherTypes').MultiDocumentBlockContext | null = null
    if (currentState.currentProject) {
      const docs: import('../../shared/contextGatherTypes').MultiDocumentBlockContext['documents'] = []
      for (const doc of currentState.currentProject.documents.filter(d => d.type === 'document')) {
        const docState = currentState.documents[doc.id]
        if (!docState?.content?.content) continue
        const blocks: import('../../shared/contextGatherTypes').DocumentBlock[] = []
        for (const node of docState.content.content) {
          const blockId = (node.attrs as any)?.blockId as string
          if (!blockId) continue
          let text = ''
          const extractText = (n: any): void => {
            if (n.type === 'text' && n.text) { text += n.text; return }
            if (n.content) n.content.forEach(extractText)
          }
          extractText(node)
          if (!text.trim()) continue
          let hash = 5381
          for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) + hash) + text.charCodeAt(i)
            hash = hash & hash
          }
          blocks.push({ blockId, type: node.type || 'paragraph', text, textHash: (hash >>> 0).toString(16) })
        }
        if (blocks.length > 0) {
          docs.push({ documentId: doc.id, documentTitle: doc.title, blocks })
        }
      }
      if (docs.length > 0) {
        allDocumentBlockContext = { documents: docs }
      }
    }

    try {
      const response = await (window.api as any).thoughtPartner?.editReflection({
        reflection: editedReflection,
        newInterpretation,
        message: currentState.thoughtPartner.messages[currentState.thoughtPartner.messages.length - 1]?.content || '',
        subconsciousContext,
        documentBlockContext: currentState.thoughtPartner.documentBlockContext,
        allDocumentBlockContext,
        structuredMemory: currentState.thoughtPartner.structuredMemory,
        usePipeline: true,
        conversationHistory: currentState.thoughtPartner.messages.filter(m => m.role !== 'system'),
        consciousContext: null,
        contextDocument: currentState.thoughtPartner.contextDocument,
        agentMode: currentState.thoughtPartner.agentMode,
        selectionContext: currentState.thoughtPartner.selectionContext,
        referencedDocuments: currentState.thoughtPartner.referencedDocuments.map(ref => {
          const docState = state.documents[ref.id]
          return { id: ref.id, title: ref.title, content: docState?.content ? contentToPlainText(docState.content) : '' }
        }),
      })

      if (response?.pipelineActions?.length > 0) {
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            currentPipelineActions: [
              ...prev.thoughtPartner.currentPipelineActions,
              ...response.pipelineActions,
            ],
            pipelineState: response.pipelineActions.some((a: any) => a.type === 'plan') ? 'planning' :
                           response.pipelineActions.some((a: any) => a.type === 'reflection') ? 'reflecting' :
                           'awaiting_approval',
          }
        }))

        for (const pa of response.pipelineActions) {
          if (pa.type === 'plan' || pa.type === 'reflection') continue
          if (pa.type === 'edit' && get().thoughtPartner.autoAcceptEdits) {
            await get().acceptPipelineAction(pa.id)
          }
        }
      }

      if (response?.updatedStructuredMemory) {
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            structuredMemory: response.updatedStructuredMemory,
          }
        }))
      }

      if (response?.message) {
        get().finalizeThoughtPartnerStream(response.message, response.updatedContextDocument)
      }
    } catch (err) {
      console.error('[ProjectStore] Reflection edit failed:', err)
      set(prev => ({
        thoughtPartner: {
          ...prev.thoughtPartner,
          pipelineState: 'failed',
        }
      }))
    }
  },

  answerReflectionQuestions: async (
    reflectionId: string,
    meaningAnswers: Array<{ questionText: string; answer: string }>,
    executionAnswers: Array<{ questionText: string; answer: string }>
  ) => {
    const state = get()
    const reflectionAction = state.thoughtPartner.currentPipelineActions.find(
      a => a.type === 'reflection' && a.reflection?.id === reflectionId
    )
    if (!reflectionAction?.reflection || !state.currentProject) return

    // Mark reflection as answered
    const answeredReflection = { ...reflectionAction.reflection, status: 'answered' as const }
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        currentPipelineActions: prev.thoughtPartner.currentPipelineActions.map(a =>
          a.id === reflectionAction.id ? { ...a, reflection: answeredReflection } : a
        ),
        pipelineState: 'orchestrating',
      }
    }))

    // Build context (same pattern)
    const currentState = get()
    const subconsciousContext = {
      projectName: currentState.currentProject!.name,
      templateType: currentState.currentProject!.templateId,
      documents: [],
      characters: [],
      props: [],
      settings: {},
    }

    let allDocumentBlockContext: import('../../shared/contextGatherTypes').MultiDocumentBlockContext | null = null
    if (currentState.currentProject) {
      const docs: import('../../shared/contextGatherTypes').MultiDocumentBlockContext['documents'] = []
      for (const doc of currentState.currentProject.documents.filter(d => d.type === 'document')) {
        const docState = currentState.documents[doc.id]
        if (!docState?.content?.content) continue
        const blocks: import('../../shared/contextGatherTypes').DocumentBlock[] = []
        for (const node of docState.content.content) {
          const blockId = (node.attrs as any)?.blockId as string
          if (!blockId) continue
          let text = ''
          const extractText = (n: any): void => {
            if (n.type === 'text' && n.text) { text += n.text; return }
            if (n.content) n.content.forEach(extractText)
          }
          extractText(node)
          if (!text.trim()) continue
          let hash = 5381
          for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) + hash) + text.charCodeAt(i)
            hash = hash & hash
          }
          blocks.push({ blockId, type: node.type || 'paragraph', text, textHash: (hash >>> 0).toString(16) })
        }
        if (blocks.length > 0) {
          docs.push({ documentId: doc.id, documentTitle: doc.title, blocks })
        }
      }
      if (docs.length > 0) {
        allDocumentBlockContext = { documents: docs }
      }
    }

    try {
      const response = await (window.api as any).thoughtPartner?.answerReflectionQuestions({
        reflection: answeredReflection,
        meaningAnswers,
        executionAnswers,
        message: currentState.thoughtPartner.messages[currentState.thoughtPartner.messages.length - 1]?.content || '',
        subconsciousContext,
        documentBlockContext: currentState.thoughtPartner.documentBlockContext,
        allDocumentBlockContext,
        structuredMemory: currentState.thoughtPartner.structuredMemory,
        usePipeline: true,
        conversationHistory: currentState.thoughtPartner.messages.filter(m => m.role !== 'system'),
        consciousContext: null,
        contextDocument: currentState.thoughtPartner.contextDocument,
        agentMode: currentState.thoughtPartner.agentMode,
        selectionContext: currentState.thoughtPartner.selectionContext,
        referencedDocuments: currentState.thoughtPartner.referencedDocuments.map(ref => {
          const docState = state.documents[ref.id]
          return { id: ref.id, title: ref.title, content: docState?.content ? contentToPlainText(docState.content) : '' }
        }),
      })

      if (response?.pipelineActions?.length > 0) {
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            currentPipelineActions: [
              ...prev.thoughtPartner.currentPipelineActions,
              ...response.pipelineActions,
            ],
            pipelineState: response.pipelineActions.some((a: any) => a.type === 'plan') ? 'planning' :
                           response.pipelineActions.some((a: any) => a.type === 'reflection') ? 'reflecting' :
                           'awaiting_approval',
          }
        }))

        for (const pa of response.pipelineActions) {
          if (pa.type === 'plan' || pa.type === 'reflection') continue
          if (pa.type === 'edit' && get().thoughtPartner.autoAcceptEdits) {
            await get().acceptPipelineAction(pa.id)
          }
        }
      }

      if (response?.updatedStructuredMemory) {
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            structuredMemory: response.updatedStructuredMemory,
          }
        }))
      }

      if (response?.message) {
        get().finalizeThoughtPartnerStream(response.message, response.updatedContextDocument)
      }
    } catch (err) {
      console.error('[ProjectStore] Reflection questions answer failed:', err)
      set(prev => ({
        thoughtPartner: {
          ...prev.thoughtPartner,
          pipelineState: 'failed',
        }
      }))
    }
  },

  // ===== Idea Card Actions =====

  exploreIdea: async (ideaCardId: string, expansionPathId?: string) => {
    const state = get()
    const ideaAction = state.thoughtPartner.currentPipelineActions.find(
      a => a.type === 'idea' && a.ideaCards?.some(ic => ic.id === ideaCardId)
    )
    if (!ideaAction?.ideaCards || !state.currentProject) return

    const ideaCard = ideaAction.ideaCards.find(ic => ic.id === ideaCardId)
    if (!ideaCard) return

    // Mark the idea as exploring
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        currentPipelineActions: prev.thoughtPartner.currentPipelineActions.map(a =>
          a.id === ideaAction.id ? {
            ...a,
            ideaCards: a.ideaCards?.map(ic =>
              ic.id === ideaCardId ? { ...ic, status: 'exploring' as const, exploringPathId: expansionPathId } : ic
            )
          } : a
        ),
        pipelineState: 'orchestrating',
        isStreaming: true,
        streamingContent: '',
      }
    }))

    // Build context (same pattern as reflection actions)
    const currentState = get()
    const subconsciousContext = {
      projectName: currentState.currentProject!.name,
      templateType: currentState.currentProject!.templateId,
      documents: [], characters: [], props: [], settings: {},
    }

    let allDocumentBlockContext: import('../../shared/contextGatherTypes').MultiDocumentBlockContext | null = null
    if (currentState.currentProject) {
      const docs: import('../../shared/contextGatherTypes').MultiDocumentBlockContext['documents'] = []
      for (const doc of currentState.currentProject.documents.filter(d => d.type === 'document')) {
        const docState = currentState.documents[doc.id]
        if (!docState?.content?.content) continue
        const blocks: import('../../shared/contextGatherTypes').DocumentBlock[] = []
        for (const node of docState.content.content) {
          const blockId = (node.attrs as any)?.blockId as string
          if (!blockId) continue
          let text = ''
          const extractText = (n: any): void => {
            if (n.type === 'text' && n.text) { text += n.text; return }
            if (n.content) n.content.forEach(extractText)
          }
          extractText(node)
          if (!text.trim()) continue
          let hash = 5381
          for (let i = 0; i < text.length; i++) { hash = ((hash << 5) + hash) + text.charCodeAt(i); hash = hash & hash }
          blocks.push({ blockId, type: node.type || 'paragraph', text, textHash: (hash >>> 0).toString(16) })
        }
        if (blocks.length > 0) docs.push({ documentId: doc.id, documentTitle: doc.title, blocks })
      }
      if (docs.length > 0) allDocumentBlockContext = { documents: docs }
    }

    try {
      const response = await (window.api as any).thoughtPartner?.exploreIdea({
        ideaCard,
        expansionPathId: expansionPathId || null,
        message: currentState.thoughtPartner.messages[currentState.thoughtPartner.messages.length - 1]?.content || '',
        subconsciousContext,
        documentBlockContext: currentState.thoughtPartner.documentBlockContext,
        allDocumentBlockContext,
        structuredMemory: currentState.thoughtPartner.structuredMemory,
        usePipeline: true,
        conversationHistory: currentState.thoughtPartner.messages.filter(m => m.role !== 'system'),
        consciousContext: null,
        contextDocument: currentState.thoughtPartner.contextDocument,
        agentMode: currentState.thoughtPartner.agentMode,
        selectionContext: currentState.thoughtPartner.selectionContext,
        referencedDocuments: currentState.thoughtPartner.referencedDocuments.map(ref => {
          const docState = state.documents[ref.id]
          return { id: ref.id, title: ref.title, content: docState?.content ? contentToPlainText(docState.content) : '' }
        }),
      })

      if (response?.pipelineActions?.length > 0) {
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            currentPipelineActions: [...prev.thoughtPartner.currentPipelineActions, ...response.pipelineActions],
            pipelineState: response.pipelineActions.some((a: any) => a.type === 'plan') ? 'planning' :
                           response.pipelineActions.some((a: any) => a.type === 'reflection') ? 'reflecting' :
                           'awaiting_approval',
          }
        }))
        for (const pa of response.pipelineActions) {
          if (pa.type === 'plan' || pa.type === 'reflection' || pa.type === 'idea') continue
          if (pa.type === 'edit' && get().thoughtPartner.autoAcceptEdits) await get().acceptPipelineAction(pa.id)
        }
      }
      if (response?.updatedStructuredMemory) {
        set(prev => ({ thoughtPartner: { ...prev.thoughtPartner, structuredMemory: response.updatedStructuredMemory } }))
      }
      if (response?.message) {
        get().finalizeThoughtPartnerStream(response.message, response.updatedContextDocument)
      }
    } catch (err) {
      console.error('[ProjectStore] Idea exploration failed:', err)
      set(prev => ({ thoughtPartner: { ...prev.thoughtPartner, pipelineState: 'failed', isStreaming: false } }))
    }
  },

  stressTestIdea: async (ideaCardId: string) => {
    const state = get()
    const ideaAction = state.thoughtPartner.currentPipelineActions.find(
      a => a.type === 'idea' && a.ideaCards?.some(ic => ic.id === ideaCardId)
    )
    if (!ideaAction?.ideaCards || !state.currentProject) return

    const ideaCard = ideaAction.ideaCards.find(ic => ic.id === ideaCardId)
    if (!ideaCard) return

    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        currentPipelineActions: prev.thoughtPartner.currentPipelineActions.map(a =>
          a.id === ideaAction.id ? {
            ...a, ideaCards: a.ideaCards?.map(ic =>
              ic.id === ideaCardId ? { ...ic, status: 'stress-testing' as const } : ic
            )
          } : a
        ),
        pipelineState: 'orchestrating',
        isStreaming: true,
        streamingContent: '',
      }
    }))

    const currentState = get()
    const subconsciousContext = {
      projectName: currentState.currentProject!.name,
      templateType: currentState.currentProject!.templateId,
      documents: [], characters: [], props: [], settings: {},
    }

    let allDocumentBlockContext: import('../../shared/contextGatherTypes').MultiDocumentBlockContext | null = null
    if (currentState.currentProject) {
      const docs: import('../../shared/contextGatherTypes').MultiDocumentBlockContext['documents'] = []
      for (const doc of currentState.currentProject.documents.filter(d => d.type === 'document')) {
        const docState = currentState.documents[doc.id]
        if (!docState?.content?.content) continue
        const blocks: import('../../shared/contextGatherTypes').DocumentBlock[] = []
        for (const node of docState.content.content) {
          const blockId = (node.attrs as any)?.blockId as string
          if (!blockId) continue
          let text = ''
          const extractText = (n: any): void => {
            if (n.type === 'text' && n.text) { text += n.text; return }
            if (n.content) n.content.forEach(extractText)
          }
          extractText(node)
          if (!text.trim()) continue
          let hash = 5381
          for (let i = 0; i < text.length; i++) { hash = ((hash << 5) + hash) + text.charCodeAt(i); hash = hash & hash }
          blocks.push({ blockId, type: node.type || 'paragraph', text, textHash: (hash >>> 0).toString(16) })
        }
        if (blocks.length > 0) docs.push({ documentId: doc.id, documentTitle: doc.title, blocks })
      }
      if (docs.length > 0) allDocumentBlockContext = { documents: docs }
    }

    try {
      const response = await (window.api as any).thoughtPartner?.stressTestIdea({
        ideaCard,
        message: currentState.thoughtPartner.messages[currentState.thoughtPartner.messages.length - 1]?.content || '',
        subconsciousContext,
        documentBlockContext: currentState.thoughtPartner.documentBlockContext,
        allDocumentBlockContext,
        structuredMemory: currentState.thoughtPartner.structuredMemory,
        usePipeline: true,
        conversationHistory: currentState.thoughtPartner.messages.filter(m => m.role !== 'system'),
        consciousContext: null,
        contextDocument: currentState.thoughtPartner.contextDocument,
        agentMode: currentState.thoughtPartner.agentMode,
        selectionContext: currentState.thoughtPartner.selectionContext,
        referencedDocuments: currentState.thoughtPartner.referencedDocuments.map(ref => {
          const docState = state.documents[ref.id]
          return { id: ref.id, title: ref.title, content: docState?.content ? contentToPlainText(docState.content) : '' }
        }),
      })

      if (response?.pipelineActions?.length > 0) {
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            currentPipelineActions: [...prev.thoughtPartner.currentPipelineActions, ...response.pipelineActions],
            pipelineState: 'awaiting_approval',
          }
        }))
        for (const pa of response.pipelineActions) {
          if (pa.type === 'plan' || pa.type === 'reflection' || pa.type === 'idea') continue
          if (pa.type === 'edit' && get().thoughtPartner.autoAcceptEdits) await get().acceptPipelineAction(pa.id)
        }
      }
      if (response?.updatedStructuredMemory) {
        set(prev => ({ thoughtPartner: { ...prev.thoughtPartner, structuredMemory: response.updatedStructuredMemory } }))
      }
      if (response?.message) {
        get().finalizeThoughtPartnerStream(response.message, response.updatedContextDocument)
      }
    } catch (err) {
      console.error('[ProjectStore] Idea stress test failed:', err)
      set(prev => ({ thoughtPartner: { ...prev.thoughtPartner, pipelineState: 'failed', isStreaming: false } }))
    }
  },

  turnIdeaInto: async (ideaCardId: string, targetType: 'scene' | 'mechanic') => {
    const state = get()
    const ideaAction = state.thoughtPartner.currentPipelineActions.find(
      a => a.type === 'idea' && a.ideaCards?.some(ic => ic.id === ideaCardId)
    )
    if (!ideaAction?.ideaCards || !state.currentProject) return

    const ideaCard = ideaAction.ideaCards.find(ic => ic.id === ideaCardId)
    if (!ideaCard) return

    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        currentPipelineActions: prev.thoughtPartner.currentPipelineActions.map(a =>
          a.id === ideaAction.id ? {
            ...a, ideaCards: a.ideaCards?.map(ic =>
              ic.id === ideaCardId ? { ...ic, status: 'converted' as const } : ic
            )
          } : a
        ),
        pipelineState: 'orchestrating',
        isStreaming: true,
        streamingContent: '',
      }
    }))

    const currentState = get()
    const subconsciousContext = {
      projectName: currentState.currentProject!.name,
      templateType: currentState.currentProject!.templateId,
      documents: [], characters: [], props: [], settings: {},
    }

    let allDocumentBlockContext: import('../../shared/contextGatherTypes').MultiDocumentBlockContext | null = null
    if (currentState.currentProject) {
      const docs: import('../../shared/contextGatherTypes').MultiDocumentBlockContext['documents'] = []
      for (const doc of currentState.currentProject.documents.filter(d => d.type === 'document')) {
        const docState = currentState.documents[doc.id]
        if (!docState?.content?.content) continue
        const blocks: import('../../shared/contextGatherTypes').DocumentBlock[] = []
        for (const node of docState.content.content) {
          const blockId = (node.attrs as any)?.blockId as string
          if (!blockId) continue
          let text = ''
          const extractText = (n: any): void => {
            if (n.type === 'text' && n.text) { text += n.text; return }
            if (n.content) n.content.forEach(extractText)
          }
          extractText(node)
          if (!text.trim()) continue
          let hash = 5381
          for (let i = 0; i < text.length; i++) { hash = ((hash << 5) + hash) + text.charCodeAt(i); hash = hash & hash }
          blocks.push({ blockId, type: node.type || 'paragraph', text, textHash: (hash >>> 0).toString(16) })
        }
        if (blocks.length > 0) docs.push({ documentId: doc.id, documentTitle: doc.title, blocks })
      }
      if (docs.length > 0) allDocumentBlockContext = { documents: docs }
    }

    try {
      const response = await (window.api as any).thoughtPartner?.turnIdeaInto({
        ideaCard,
        targetType,
        message: currentState.thoughtPartner.messages[currentState.thoughtPartner.messages.length - 1]?.content || '',
        subconsciousContext,
        documentBlockContext: currentState.thoughtPartner.documentBlockContext,
        allDocumentBlockContext,
        structuredMemory: currentState.thoughtPartner.structuredMemory,
        usePipeline: true,
        conversationHistory: currentState.thoughtPartner.messages.filter(m => m.role !== 'system'),
        consciousContext: null,
        contextDocument: currentState.thoughtPartner.contextDocument,
        agentMode: currentState.thoughtPartner.agentMode,
        selectionContext: currentState.thoughtPartner.selectionContext,
        referencedDocuments: currentState.thoughtPartner.referencedDocuments.map(ref => {
          const docState = state.documents[ref.id]
          return { id: ref.id, title: ref.title, content: docState?.content ? contentToPlainText(docState.content) : '' }
        }),
      })

      if (response?.pipelineActions?.length > 0) {
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            currentPipelineActions: [...prev.thoughtPartner.currentPipelineActions, ...response.pipelineActions],
            pipelineState: response.pipelineActions.some((a: any) => a.type === 'plan') ? 'planning' : 'awaiting_approval',
          }
        }))
        for (const pa of response.pipelineActions) {
          if (pa.type === 'plan' || pa.type === 'reflection' || pa.type === 'idea') continue
          if (pa.type === 'edit' && get().thoughtPartner.autoAcceptEdits) await get().acceptPipelineAction(pa.id)
        }
      }
      if (response?.updatedStructuredMemory) {
        set(prev => ({ thoughtPartner: { ...prev.thoughtPartner, structuredMemory: response.updatedStructuredMemory } }))
      }
      if (response?.message) {
        get().finalizeThoughtPartnerStream(response.message, response.updatedContextDocument)
      }
    } catch (err) {
      console.error('[ProjectStore] Idea conversion failed:', err)
      set(prev => ({ thoughtPartner: { ...prev.thoughtPartner, pipelineState: 'failed', isStreaming: false } }))
    }
  },

  mergeIdeas: async (ideaCardIdA: string, ideaCardIdB: string) => {
    const state = get()
    if (!state.currentProject) return

    // Find both cards across all idea actions
    let ideaCardA: import('../../shared/thoughtPartnerPipelineTypes').IdeaCard | undefined
    let ideaCardB: import('../../shared/thoughtPartnerPipelineTypes').IdeaCard | undefined
    for (const a of state.thoughtPartner.currentPipelineActions) {
      if (a.type !== 'idea' || !a.ideaCards) continue
      for (const ic of a.ideaCards) {
        if (ic.id === ideaCardIdA) ideaCardA = ic
        if (ic.id === ideaCardIdB) ideaCardB = ic
      }
    }
    if (!ideaCardA || !ideaCardB) return

    // Mark both as merged
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        currentPipelineActions: prev.thoughtPartner.currentPipelineActions.map(a =>
          a.type === 'idea' && a.ideaCards ? {
            ...a, ideaCards: a.ideaCards.map(ic => {
              if (ic.id === ideaCardIdA) return { ...ic, status: 'merged' as const }
              if (ic.id === ideaCardIdB) return { ...ic, status: 'merged' as const, mergedWith: ideaCardIdA }
              return ic
            })
          } : a
        ),
        pipelineState: 'orchestrating',
        isStreaming: true,
        streamingContent: '',
      }
    }))

    const currentState = get()
    const subconsciousContext = {
      projectName: currentState.currentProject!.name,
      templateType: currentState.currentProject!.templateId,
      documents: [], characters: [], props: [], settings: {},
    }

    let allDocumentBlockContext: import('../../shared/contextGatherTypes').MultiDocumentBlockContext | null = null
    if (currentState.currentProject) {
      const docs: import('../../shared/contextGatherTypes').MultiDocumentBlockContext['documents'] = []
      for (const doc of currentState.currentProject.documents.filter(d => d.type === 'document')) {
        const docState = currentState.documents[doc.id]
        if (!docState?.content?.content) continue
        const blocks: import('../../shared/contextGatherTypes').DocumentBlock[] = []
        for (const node of docState.content.content) {
          const blockId = (node.attrs as any)?.blockId as string
          if (!blockId) continue
          let text = ''
          const extractText = (n: any): void => {
            if (n.type === 'text' && n.text) { text += n.text; return }
            if (n.content) n.content.forEach(extractText)
          }
          extractText(node)
          if (!text.trim()) continue
          let hash = 5381
          for (let i = 0; i < text.length; i++) { hash = ((hash << 5) + hash) + text.charCodeAt(i); hash = hash & hash }
          blocks.push({ blockId, type: node.type || 'paragraph', text, textHash: (hash >>> 0).toString(16) })
        }
        if (blocks.length > 0) docs.push({ documentId: doc.id, documentTitle: doc.title, blocks })
      }
      if (docs.length > 0) allDocumentBlockContext = { documents: docs }
    }

    try {
      const response = await (window.api as any).thoughtPartner?.mergeIdeas({
        ideaCardA,
        ideaCardB,
        message: currentState.thoughtPartner.messages[currentState.thoughtPartner.messages.length - 1]?.content || '',
        subconsciousContext,
        documentBlockContext: currentState.thoughtPartner.documentBlockContext,
        allDocumentBlockContext,
        structuredMemory: currentState.thoughtPartner.structuredMemory,
        usePipeline: true,
        conversationHistory: currentState.thoughtPartner.messages.filter(m => m.role !== 'system'),
        consciousContext: null,
        contextDocument: currentState.thoughtPartner.contextDocument,
        agentMode: currentState.thoughtPartner.agentMode,
        selectionContext: currentState.thoughtPartner.selectionContext,
        referencedDocuments: currentState.thoughtPartner.referencedDocuments.map(ref => {
          const docState = state.documents[ref.id]
          return { id: ref.id, title: ref.title, content: docState?.content ? contentToPlainText(docState.content) : '' }
        }),
      })

      if (response?.pipelineActions?.length > 0) {
        set(prev => ({
          thoughtPartner: {
            ...prev.thoughtPartner,
            currentPipelineActions: [...prev.thoughtPartner.currentPipelineActions, ...response.pipelineActions],
            pipelineState: 'awaiting_approval',
          }
        }))
      }
      if (response?.updatedStructuredMemory) {
        set(prev => ({ thoughtPartner: { ...prev.thoughtPartner, structuredMemory: response.updatedStructuredMemory } }))
      }
      if (response?.message) {
        get().finalizeThoughtPartnerStream(response.message, response.updatedContextDocument)
      }
    } catch (err) {
      console.error('[ProjectStore] Idea merge failed:', err)
      set(prev => ({ thoughtPartner: { ...prev.thoughtPartner, pipelineState: 'failed', isStreaming: false } }))
    }
  },

  discardIdea: (ideaCardId: string) => {
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        currentPipelineActions: prev.thoughtPartner.currentPipelineActions.map(a =>
          a.type === 'idea' && a.ideaCards?.some(ic => ic.id === ideaCardId) ? {
            ...a,
            ideaCards: a.ideaCards?.map(ic =>
              ic.id === ideaCardId ? { ...ic, status: 'discarded' as const } : ic
            )
          } : a
        ),
      }
    }))
  },

  // Behavior policy actions (adaptive behavior layer)
  submitMessageFeedback: async (messageId: string, signal: import('../../shared/behaviorPolicyTypes').FeedbackSignal) => {
    const state = get()
    const currentFeedback = state.thoughtPartner.messageFeedback[messageId]

    // Toggle: if same signal clicked again, clear it
    if (currentFeedback === signal) {
      const updated = { ...state.thoughtPartner.messageFeedback }
      delete updated[messageId]
      set(prev => ({
        thoughtPartner: { ...prev.thoughtPartner, messageFeedback: updated }
      }))
      return
    }

    // Set new signal
    set(prev => ({
      thoughtPartner: {
        ...prev.thoughtPartner,
        messageFeedback: { ...prev.thoughtPartner.messageFeedback, [messageId]: signal }
      }
    }))

    // Build context for the bandit
    const meta = state.thoughtPartner.lastResponseMeta
    const projectPath = state.currentProject?.path || null
    const context = {
      intentPolicy: 'chat-only',
      hasSelection: !!state.thoughtPartner.selectionContext,
      consecutiveChatTurns: state.thoughtPartner.consecutiveChatTurns,
      messageLength: (state.thoughtPartner.messages.find(m => m.role === 'user' && state.thoughtPartner.messages.indexOf(m) < state.thoughtPartner.messages.map(m2 => m2.id).indexOf(messageId))?.content.length || 0) < 50 ? 'short' as const : 'medium' as const,
      templateType: state.currentProject?.templateId || 'default',
      pipelineState: state.thoughtPartner.pipelineState,
      hasActions: state.thoughtPartner.currentPipelineActions.some(a => (a as any).type === 'edit'),
      hasQuestions: false,
      hasPlan: state.thoughtPartner.currentPipelineActions.some(a => (a as any).type === 'plan'),
      hasReflection: state.thoughtPartner.currentPipelineActions.some(a => (a as any).type === 'reflection'),
      hasIdeas: state.thoughtPartner.currentPipelineActions.some(a => (a as any).type === 'idea'),
    }

    try {
      const result = await (window.api as any).behaviorPolicy?.submitFeedback({
        messageId,
        conversationId: state.thoughtPartner.activeConversationId,
        signal,
        projectPath,
        context,
        vectorSnapshot: state.thoughtPartner.currentBehaviorVector || {
          initiative: 0.5, toolUsage: 0.5, verbosity: 0.5, structuralStyle: 0.5,
          tone: 0.5, riskTolerance: 0.5, autonomy: 0.5, clarificationFreq: 0.5,
        },
        expressedDimensions: meta?.expressedDimensions || {},
      })
      if (result?.updatedVector) {
        set(prev => ({
          thoughtPartner: { ...prev.thoughtPartner, currentBehaviorVector: result.updatedVector }
        }))
      }
    } catch (err) {
      console.error('[ProjectStore] Failed to submit feedback:', err)
    }
  },

  loadBehaviorVector: async () => {
    const state = get()
    const projectPath = state.currentProject?.path || null
    const context = {
      intentPolicy: 'chat-only',
      hasSelection: false,
      consecutiveChatTurns: 0,
      messageLength: 'medium' as const,
      templateType: state.currentProject?.templateId || 'default',
      pipelineState: 'idle',
      hasActions: false,
      hasQuestions: false,
      hasPlan: false,
      hasReflection: false,
      hasIdeas: false,
    }
    try {
      const vector = await (window.api as any).behaviorPolicy?.getVector(projectPath, context)
      if (vector) {
        set(prev => ({
          thoughtPartner: { ...prev.thoughtPartner, currentBehaviorVector: vector }
        }))
      }
    } catch (err) {
      console.error('[ProjectStore] Failed to load behavior vector:', err)
    }
  },

  runCritique: async () => {
    const { currentProject, documents } = get()
    if (!currentProject || currentProject.templateId !== 'screenplay') {
      console.log('[ProjectStore] Critique only available for screenplay projects')
      return
    }

    // Check if API key is available
    const hasApiKey = await window.api.dramaticCritique?.hasApiKey()
    if (!hasApiKey) {
      console.log('[ProjectStore] No API key configured for dramatic critique')
      return
    }

    console.log('[ProjectStore] Running dramatic critique...')
    set(state => ({
      ui: { ...state.ui, isRunningCritique: true, writingPartnerPanelOpen: true }
    }))

    try {
      // Get all candidate documents (exclude character/prop notes and act breaks)
      const candidateDocs = currentProject.documents.filter(doc => 
        doc.type === 'document' && 
        !doc.isCharacterNote && 
        !doc.isPropNote &&
        !doc.isActBreak
      )
      
      // Load all candidate document contents and split into script vs supplementary
      const scriptDocs: typeof candidateDocs = []
      const supplementaryDocs: { title: string; content: string }[] = []
      
      for (const doc of candidateDocs) {
        let content = documents[doc.id]?.content
        if (!content) {
          try {
            content = await window.api.document.load(currentProject.path, doc.id)
          } catch (error) {
            console.warn(`Failed to load document ${doc.id}:`, error)
            continue
          }
        }
        
        // Check if this document contains screenplay elements
        const hasScreenplayElements = documentContainsScreenplayElements(content)
        
        if (hasScreenplayElements && !doc.isNote) {
          scriptDocs.push(doc)
        } else {
          // This is a supplementary document (notes, synopsis, etc.)
          const plainText = contentToPlainText(content)
          if (plainText.trim().length > 0) {
            supplementaryDocs.push({
              title: doc.title,
              content: plainText
            })
          }
        }
      }
      
      console.log(`[ProjectStore] Critique: ${scriptDocs.length} script docs, ${supplementaryDocs.length} supplementary docs`)

      // Build screenplay text from script documents
      let screenplayText = ''
      for (const doc of scriptDocs) {
        let content = documents[doc.id]?.content
        if (!content) {
          try {
            content = await window.api.document.load(currentProject.path, doc.id)
          } catch (error) {
            console.warn(`Failed to load document ${doc.id}:`, error)
            continue
          }
        }
        
        // Convert content to plain text
        const text = contentToPlainText(content)
        screenplayText += `\n--- ${doc.title} ---\n${text}\n`
      }

      // Gather entity documents (character notes, prop notes)
      const entityDocs: { type: 'character' | 'prop' | 'location'; name: string; content: string }[] = []

      // Add character note documents
      for (const character of currentProject.characters || []) {
        if (character.noteDocumentId) {
          const noteDoc = currentProject.documents.find(d => d.id === character.noteDocumentId)
          if (noteDoc) {
            let content = documents[noteDoc.id]?.content
            if (!content) {
              try {
                content = await window.api.document.load(currentProject.path, noteDoc.id)
              } catch (error) {
                console.warn(`Failed to load character note ${noteDoc.id}:`, error)
                continue
              }
            }
            const text = contentToPlainText(content)
            entityDocs.push({ type: 'character', name: character.name, content: text })
          }
        }
      }

      // Add prop note documents
      for (const prop of currentProject.props || []) {
        if (prop.noteDocumentId) {
          const noteDoc = currentProject.documents.find(d => d.id === prop.noteDocumentId)
          if (noteDoc) {
            let content = documents[noteDoc.id]?.content
            if (!content) {
              try {
                content = await window.api.document.load(currentProject.path, noteDoc.id)
              } catch (error) {
                console.warn(`Failed to load prop note ${noteDoc.id}:`, error)
                continue
              }
            }
            const text = contentToPlainText(content)
            entityDocs.push({ type: 'prop', name: prop.name, content: text })
          }
        }
      }

      console.log(`[ProjectStore] Critique input: ${screenplayText.length} chars screenplay, ${entityDocs.length} entity docs, ${supplementaryDocs.length} supplementary docs`)

      // Call the critique service with supplementary context
      const issues = await window.api.dramaticCritique.generate(screenplayText, entityDocs, supplementaryDocs)

      // Apply saved resolutions to matching issues
      const { critiqueResolutions } = get()
      const issuesWithResolutions = issues.map(issue => {
        const issueHash = generateIssueHash(issue)
        const savedResolution = critiqueResolutions.find(r => r.issueHash === issueHash)
        
        if (savedResolution) {
          return {
            ...issue,
            resolution: savedResolution.resolution,
            resolutionNote: savedResolution.note,
            resolvedAt: savedResolution.timestamp
          }
        }
        return issue
      })

      console.log(`[ProjectStore] Critique complete: ${issues.length} issues found, ${issuesWithResolutions.filter(i => i.resolution !== 'unresolved').length} with saved resolutions`)
      set(state => ({
        ui: { ...state.ui, isRunningCritique: false },
        critiqueIssues: issuesWithResolutions
      }))

    } catch (error) {
      console.error('[ProjectStore] Critique failed:', error)
      set(state => ({
        ui: { ...state.ui, isRunningCritique: false }
      }))
    }
  },

  dismissCritiqueIssue: (issueId: string) => {
    set(state => ({
      critiqueIssues: state.critiqueIssues.filter(issue => issue.id !== issueId)
    }))
  },

  clearCritiqueIssues: () => {
    set({ critiqueIssues: [] })
  },

  resolveIssue: (issueId: string, resolution: IssueResolution, note?: string) => {
    const { critiqueIssues, critiqueResolutions } = get()
    const issue = critiqueIssues.find(i => i.id === issueId)
    
    if (!issue) return
    
    const timestamp = Date.now()
    const issueHash = generateIssueHash(issue)
    
    // Update the issue in the current list
    const updatedIssues = critiqueIssues.map(i => 
      i.id === issueId 
        ? { ...i, resolution, resolutionNote: note, resolvedAt: timestamp }
        : i
    )
    
    // Save/update the resolution for persistence
    const existingResolutionIndex = critiqueResolutions.findIndex(r => r.issueHash === issueHash)
    let updatedResolutions: StoredCritiqueResolution[]
    
    if (existingResolutionIndex >= 0) {
      // Update existing resolution
      updatedResolutions = critiqueResolutions.map((r, i) => 
        i === existingResolutionIndex
          ? { ...r, resolution, note, timestamp }
          : r
      )
    } else {
      // Add new resolution
      updatedResolutions = [
        ...critiqueResolutions,
        { issueHash, resolution, note, timestamp }
      ]
    }
    
    set({
      critiqueIssues: updatedIssues,
      critiqueResolutions: updatedResolutions
    })
    
    console.log(`[ProjectStore] Issue ${issueId} resolved as "${resolution}"${note ? ` with note: ${note}` : ''}`)
  },

  updateIssueResolution: (issueId: string, resolution: IssueResolution, note?: string) => {
    // Alias for resolveIssue - can be used when changing an existing resolution
    get().resolveIssue(issueId, resolution, note)
  },

  // Gated Writing Partner actions
  setSceneState: (sceneState: SceneState | null) => {
    set({ sceneState })
  },

  setCharacterEligibility: (eligibility: CharacterEligibility[]) => {
    set({ characterEligibility: eligibility })
  },

  setLastPipelineResult: (result: PipelineResult | null) => {
    set({
      lastPipelineResult: result,
      sceneState: result?.sceneState || null,
      characterEligibility: result?.eligibility || []
    })
  }
}))
