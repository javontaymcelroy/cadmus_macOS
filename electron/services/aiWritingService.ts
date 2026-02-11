/**
 * AI Writing Service
 * 
 * Uses OpenAI's reasoning model (o3-mini) to generate creative writing content.
 * Provides generative and revision commands:
 * 
 * GENERATIVE (create new content):
 * - Continue Writing: Maintains voice, mood, and style
 * - Dialogue Generator: Produces character-appropriate dialogue
 * - Describe Setting: Creates rich environment details
 * - Expand Prompt: Turns a short prompt into a full scene
 * - Write from POV: Writes in a specific character's voice
 * 
 * REVISION (rework selected text):
 * - Rework: Revises selected text while maintaining tone and consistency
 * 
 * For screenplays, outputs structured JSON with proper element types.
 * References characters/props using @NAME syntax for proper mention rendering.
 */

import Store from 'electron-store'

// Types for AI Writing commands
// Generative: continue, dialogue, setting, expand, pov
// Revision: rework, adjustTone, shorten, clearer, elaborate, tension, soften, imagery, pacing, voice, contradiction
export type AIWritingCommand =
  | 'continue' | 'dialogue' | 'setting' | 'expand' | 'pov' | 'negativeSpace'
  | 'rework' | 'adjustTone' | 'shorten' | 'clearer' | 'elaborate'
  | 'tension' | 'soften' | 'imagery' | 'pacing' | 'voice' | 'contradiction'
  | 'scriptDoctor'
  | 'fixGrammar' | 'makeLonger' | 'makeConcise' | 'actionItems' | 'extractQuestions' | 'summarize'
  | 'customPrompt'
  | 'ask'
  | 'makeConsistent'

// Screenplay element types
export type ScreenplayElementType = 
  | 'scene-heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'

export interface ScreenplayElement {
  type: ScreenplayElementType
  text: string
}

// Character/Prop info for AI context
export interface CharacterInfo {
  id: string
  name: string
  color?: string
}

export interface PropInfo {
  id: string
  name: string
  icon?: string
}

// Supplementary context from project documents (synopsis, notes, character docs, etc.)
export interface SupplementaryContext {
  synopsis?: string           // Main story synopsis/overview
  characterNotes?: Array<{ name: string; content: string }>  // Character notes/bibles
  propNotes?: Array<{ name: string; content: string }>       // Prop notes
  otherNotes?: Array<{ title: string; content: string }>     // Any other supplementary docs
}

// Scene context for current scene awareness
export interface SceneContext {
  sceneHeading?: string
  charactersInScene: string[]
  precedingAction?: string
}

export interface AIWritingRequest {
  command: AIWritingCommand
  context: string
  selection?: string
  characterName?: string
  characters?: CharacterInfo[]  // Full character data with IDs
  props?: PropInfo[]            // Full prop data with IDs
  settingHint?: string
  documentTitle?: string
  templateType?: string  // 'screenplay' | 'notes-journal' | 'blog' | etc.
  toneOption?: string    // For adjustTone command: calm, tense, playful, etc.
  customPromptText?: string  // For customPrompt command: the user's custom instruction
  supplementaryContext?: SupplementaryContext  // Background context from project docs
  sceneContext?: SceneContext  // Structured scene context (current scene heading, characters in scene, etc.)
  targetRuntimeMinutes?: number  // Target runtime for screenplay projects
  userQuestion?: string  // User's freeform question for the 'ask' command
}

export interface AIWritingResponse {
  text: string
  error?: string
  // For screenplay, includes structured elements
  screenplayElements?: ScreenplayElement[]
  isScreenplay?: boolean
  // Character/prop mapping for mention resolution
  characterMap?: Record<string, CharacterInfo>
  propMap?: Record<string, PropInfo>
}

// Build supplementary context section for the AI
function buildSupplementaryContextSection(supplementaryContext?: SupplementaryContext): string {
  if (!supplementaryContext) return ''
  
  let section = ''
  
  // Add synopsis if available
  if (supplementaryContext.synopsis && supplementaryContext.synopsis.trim().length > 0) {
    section += `\n=== STORY BACKGROUND ===\n${supplementaryContext.synopsis}\n`
  }
  
  // Add character notes if available
  if (supplementaryContext.characterNotes && supplementaryContext.characterNotes.length > 0) {
    section += `\n=== CHARACTER BACKGROUNDS ===\n`
    for (const char of supplementaryContext.characterNotes) {
      // Truncate if too long
      const content = char.content.length > 1000 ? char.content.slice(0, 1000) + '...' : char.content
      section += `\n[${char.name}]\n${content}\n`
    }
  }
  
  // Add prop notes if available
  if (supplementaryContext.propNotes && supplementaryContext.propNotes.length > 0) {
    section += `\n=== PROP/OBJECT DETAILS ===\n`
    for (const prop of supplementaryContext.propNotes) {
      const content = prop.content.length > 500 ? prop.content.slice(0, 500) + '...' : prop.content
      section += `\n[${prop.name}]\n${content}\n`
    }
  }
  
  // Add other supplementary notes
  if (supplementaryContext.otherNotes && supplementaryContext.otherNotes.length > 0) {
    section += `\n=== ADDITIONAL CONTEXT ===\n`
    for (const note of supplementaryContext.otherNotes) {
      const content = note.content.length > 1500 ? note.content.slice(0, 1500) + '...' : note.content
      section += `\n[${note.title}]\n${content}\n`
    }
  }
  
  if (section.length > 0) {
    section = `\n--- PROJECT CONTEXT ---\nUse this background information to inform your writing. Keep characters consistent with their established traits and behaviors. Maintain story consistency.\n${section}\n--- END PROJECT CONTEXT ---\n`
  }
  
  return section
}

// Build the character/prop reference guide for the AI
function buildEntityReferenceGuide(characters?: CharacterInfo[], props?: PropInfo[]): string {
  let guide = ''
  
  if (characters && characters.length > 0) {
    guide += `\nCHARACTER NAME FORMATTING (for @ syntax only - NOT a cast list to use):\n`
    for (const char of characters) {
      guide += `- @${char.name.toUpperCase()}\n`
    }
    guide += `\nIMPORTANT: This list is ONLY for name formatting. Do NOT use characters just because they're listed here.\n`
    guide += `ONLY write about characters who ALREADY APPEAR in the context/scene above.\n`
    guide += `When referencing a character, use @CHARACTER_NAME syntax.\n`
  }
  
  if (props && props.length > 0) {
    guide += `\nPROP NAME FORMATTING (for @ syntax only):\n`
    for (const prop of props) {
      guide += `- @${prop.name.toUpperCase()}\n`
    }
    guide += `\nWhen referencing a prop, use @PROP_NAME syntax.\n`
  }
  
  if (characters?.length || props?.length) {
    guide += `\nFORMATTING: Use @ prefix when referencing characters or props.\n`
    guide += `Example: "@NURSE EMILY checks on the patient"\n`
  }
  
  return guide
}

// Base philosophy for collaborative writing assistance (used for prose/non-screenplay)
const WRITING_PARTNER_PHILOSOPHY = `
=== YOUR ROLE ===
You are a collaborative WRITING PARTNER, not an editor or critic. The writer is developing a DRAFT - work in progress, not finished text. Your job is to help them explore and develop their ideas while staying true to THEIR voice.

=== STYLE ADOPTION (CRITICAL) ===
Before suggesting anything, ANALYZE the writer's existing style from the context provided:
- Sentence structure: Do they use short punchy sentences? Long flowing ones? Fragments?
- Word choice: Simple/direct or literary/poetic? Genre-specific vocabulary?
- Rhythm: Fast-paced or contemplative? Sparse or detailed?
- Voice: Formal, conversational, gritty, lyrical?
- Action line style: Minimal ("She runs.") or descriptive ("She bolts, feet pounding concrete.")?

YOU MUST MATCH THEIR STYLE EXACTLY. If their action lines are terse, yours should be too. If they write flowing descriptions, match that energy. Never impose a different style.

=== CONTEXT AWARENESS ===
Consider the FULL context when making suggestions:
- The current SCENE: What's the setting? What's happening? What's the emotional beat?
- CHARACTER backgrounds: Use their established traits, history, and relationships from the character notes
- STORY context: How does this moment fit into the larger narrative from the synopsis?
- PRECEDING text: What just happened? What are the characters reacting to?
- The MOMENT: What is this specific beat trying to accomplish dramatically?

=== DRAFT MINDSET ===
This is a DRAFT. The writer is exploring, not polishing. Your suggestions should:
- Help them discover what they're trying to say
- Offer possibilities, not corrections
- Preserve their creative vision and instincts
- Build on what's working, not replace it
`

// Cinematic philosophy for screenplay writing - CONDENSED
const CINEMATIC_WRITING_PHILOSOPHY = `
=== SCREENPLAY RULES ===
1. One action per line. One visual beat.
2. Show behavior, not feelings: "She hesitates" not "She feels uncertain"
3. Cause → effect: What happens, then what it causes
4. No prose: Cut "as if", "with determination", "observing quietly"
5. Dialogue must function (command/reveal/attack) or cut it

=== SCENE CONTINUITY ===
- ONLY use characters in the context text - ignore the character list for casting
- Continue the NARRATIVE THREAD - not a montage of all characters
- NO new scene headings unless asked
- Follow what just happened - cause → effect
`

// Base system prompt for screenplay format awareness
function buildScreenplayFormatGuide(characters?: CharacterInfo[], props?: PropInfo[]): string {
  const entityGuide = buildEntityReferenceGuide(characters, props)
  
  return `You are writing for a SCREENPLAY. You MUST output valid JSON with an array of screenplay elements.
${CINEMATIC_WRITING_PHILOSOPHY}
${entityGuide}
SCREENPLAY ELEMENT TYPES:
- "scene-heading": Location/time headers like "INT. HOSPITAL - DAY" or "EXT. STREET - NIGHT" (always UPPERCASE)
- "action": Describes what we SEE and HEAR. Visual descriptions, character movements, environment details. USE @CHARACTER_NAME when mentioning characters!
- "character": Character name before they speak (UPPERCASE, EXACT name from the character list - NO @ prefix for this element type)
- "dialogue": The words a character speaks (normal case). USE @CHARACTER_NAME when one character addresses another!
- "parenthetical": Brief acting direction before dialogue, like "(whispering)" or "(to herself)"
- "transition": Scene transitions like "CUT TO:", "FADE OUT:", "DISSOLVE TO:" (always UPPERCASE)
- "shot": Camera directions like "CLOSE ON:", "ANGLE ON:", "POV:" (always UPPERCASE)

OUTPUT FORMAT - You MUST respond with ONLY this JSON structure, no other text:
{
  "elements": [
    { "type": "scene-heading", "text": "INT. LOCATION - TIME" },
    { "type": "action", "text": "@CHARACTER_NAME does something." },
    { "type": "character", "text": "CHARACTER NAME" },
    { "type": "parenthetical", "text": "(acting direction)" },
    { "type": "dialogue", "text": "What they say to @OTHER_CHARACTER." }
  ]
}

FORMATTING RULES:
- Scene headings: Always start with INT. or EXT., include location and time
- Action: Write in present tense, be visual and specific. USE @NAMES for character/prop references!
- Character element: UPPERCASE name only, NO @ prefix (this is the speaker label)
- Dialogue: Natural speech. USE @NAMES when addressing/mentioning other characters!
- Parentheticals: Brief, in parentheses, lowercase
- Keep dialogue exchanges natural with action beats between

CAMERA DIRECTION RULES:
- Action lines should NOT contain camera directions (no "CLOSE ON", "TIGHT ON", "ANGLE ON", "TWO-SHOT", etc.)
- Camera directions go in "shot" elements ONLY, and should be used SPARINGLY
- Spec scripts focus on STORY, not camera - let the action tell the story

IMPORTANT: 
- Output ONLY the JSON object, no markdown code blocks, no explanation.
- USE EXACT CHARACTER NAMES from the provided list!
- In action and dialogue text, ALWAYS use @NAME syntax to reference characters/props!`
}

// System prompts for each command - SCREENPLAY versions
// Designed as collaborative writing partner tools
function getScreenplaySystemPrompt(command: AIWritingCommand, characters?: CharacterInfo[], props?: PropInfo[], toneOption?: string): string {
  const formatGuide = buildScreenplayFormatGuide(characters, props)
  
  const commandPrompts: Record<AIWritingCommand, string> = {
    continue: `${formatGuide}

Your task: EXTEND the current moment of the screenplay — not advance the plot.

You are doing EMPATHETIC MIMICRY. Read the energy, rhythm, and texture of what's on the page. Feel the vibe. Then produce the next few beats that the SAME WRITER would produce if they kept typing. Your output should be indistinguishable from their work.

SCENE CONTEXT:
The user prompt includes a "CURRENT SCENE" section that tells you:
- The scene heading (location/time) - STAY THERE
- Characters IN this scene - ONLY use these characters
- Recent action - continue from THIS point

WHAT "CONTINUE" MEANS:
- Extend existing behavior, body language, small physical actions
- Continue an exchange that's already happening
- Add micro-beats: a glance, a shift in posture, a pause, breath
- Match the current energy level — if it's quiet, stay quiet; if it's tense, stay tense
- Let the scene BREATHE — real scenes have texture between plot points

FORBIDDEN — DO NOT:
- Introduce NEW characters, props, or information not already present
- Escalate tension or stakes beyond what's already established
- Create a scene turn, reveal, or plot twist
- Start a new action sequence or dramatic event
- Add a phone ringing, radio crackling, door opening, someone arriving — no external interruptions
- Skip ahead in time
- Create new scene headings
- Write prose flourishes ("as if", "in quiet composure")

Think of it this way: if the writer wanted the NEXT BIG THING to happen, they'd write it themselves. They want you to fill in the CONNECTIVE TISSUE — the natural beats that exist between dramatic moments.

Generate 2-4 elements. Keep it SHORT. Less is more.`,

    dialogue: `${formatGuide}

Your task: Generate dialogue for characters in this scene.

SCENE CONTEXT:
The user prompt includes a "CURRENT SCENE" section that tells you:
- The scene heading (location/time) - STAY THERE
- Characters IN this scene - ONLY use these characters
- Recent action - continue from THIS point

RULES:
- Characters listed in "CURRENT SCENE" are the ONLY ones you may use
- Every line must FUNCTION (command, reveal, deflect, attack)
- Cut polite filler - "Good morning" is dead weight
- Include brief action beats between lines
- If silence works better, use silence

Generate dialogue with action beats.`,

    setting: `${formatGuide}

Your task: Describe the current setting from the context.

SCENE CONTEXT:
The user prompt includes a "CURRENT SCENE" section showing the scene heading.
Describe THAT location - the one in the scene heading.

RULES:
- Describe THIS location from the scene heading - don't invent a new one
- NO new scene headings
- What the camera SEES - not mood or atmosphere
- 3-5 visual details max, one per line
- Details should locate us, reveal character, or create tension

Generate setting description.`,

    expand: `${formatGuide}

Your task: Expand the prompt into visual beats.

SCENE CONTEXT:
The user prompt includes a "CURRENT SCENE" section that tells you:
- The scene heading - STAY THERE
- Characters IN this scene - ONLY use these characters

RULES:
- Expand THIS moment with characters from "CURRENT SCENE"
- NO new scene headings unless asked
- Cause → reaction → result structure
- One action per line
- 5-10 beats max

Generate expanded scene.`,

    pov: `${formatGuide}

Your task: Write from a character's POV through behavior.

SCENE CONTEXT:
The user prompt includes a "CURRENT SCENE" section listing characters present.
The POV character must be one of those characters.

RULES:
- Character must be in the "CURRENT SCENE" list
- Show what they DO, not think/feel
- "She counts the exits" not "She feels nervous"
- NO new scene headings
- Stay in current scene

Generate POV-focused content.`,

    negativeSpace: `${formatGuide}

Your task: Create a moment of NEGATIVE SPACE — texture that exists for its own sake.

SCENE CONTEXT:
The user prompt includes a "CURRENT SCENE" section. Stay there. Use only present characters.

WHAT NEGATIVE SPACE IS:
- A pause. A breath. Waiting.
- Environmental detail noticed by a character (how rain sounds on the window, a flickering light)
- Habitual behavior (how someone holds their coffee, adjusts their glasses, taps a pen)
- An awkward beat that's true to life (silence that goes on a beat too long)
- Physical texture (the sound of a chair scraping, the hum of fluorescents)
- A moment that normally you wouldn't think to write

WHAT NEGATIVE SPACE IS NOT:
- Plot advancement of ANY kind
- Backstory revelation
- New character introductions
- Conflict resolution
- Foreshadowing or setup
- Thematic statements
- Anything "meaningful" in a plot sense

The moment should feel like LIFE — the boring, textured, specific reality between dramatic beats.
Think: what would a documentary camera capture if it just kept rolling between takes?

Generate 2-4 elements of pure texture. Output JSON with screenplay elements.`,

    rework: `${formatGuide}

Your task is to apply CINEMATIC GRAMMAR to this text.

You're not "improving prose" - you're translating to screen language.

APPROACH:
- Identify the VISUAL BEATS: What does the camera actually see?
- Compress stacked descriptions into single actions
- Replace feelings with behaviors: "She's nervous" → "Her hand trembles"
- Cut inert dialogue (polite exchanges that don't advance anything)
- Think: CAUSE → REACTION → CORRECTION
- If something is told twice, cut one

Ask: "What can I remove and still have this understood?" Then remove it.`,

    // SELECTION-BASED EDITING TOOLS - Collaborative suggestions

    adjustTone: `${formatGuide}

Your task is to suggest how this text might feel if shifted toward "${toneOption || 'the requested tone'}".

APPROACH:
- This is a DRAFT - you're offering a possibility, not fixing something broken
- The core story beat and meaning must stay identical
- Show how the same moment might land with different emotional coloring
- Match the writer's style - only the emotional temperature changes
- Use character knowledge to ensure reactions feel authentic`,

    shorten: `${formatGuide}

Your task is to COMPRESS this text using cinematic economy.

Screenplay shortening is NOT about "keeping all beats but trimmer." It's about collapsing multiple tells into single visual actions.

APPROACH:
- If three sentences describe one moment, make it ONE sentence showing the key action
- Cut adjectives that don't change what the camera sees
- Cut dialogue that's polite but dramatically inert
- Trust the image: "She's exhausted and defeated" → "She slumps" (the slump shows both)
- Remove anything the audience can infer from context
- One action, one line. Then the next.

EXAMPLE:
BEFORE: "She moves with weary determination, her steps heavy with exhaustion, forcing herself toward the door."
AFTER: "She drags herself to the door."

Same beat. Fewer words. Camera can shoot it.`,

    clearer: `${formatGuide}

Your task is to make the VISUAL CAUSE-EFFECT CHAIN obvious.

Clarity in screenwriting = the audience instantly understands what happened and what it means through ACTION.

APPROACH:
- Identify what the camera needs to show for the beat to land
- Strip anything that obscures the action (extra description, stacked metaphors)
- Make the sequence unmistakable: A happens → B reacts → C results
- If the meaning is buried in description, surface it through behavior
- Cut anything the audience doesn't need to see to understand

Clarity often means FEWER words, not more. The visual should do the work.`,

    elaborate: `${formatGuide}

Your task is to add VISUAL BEATS that change the rhythm - NOT description.

BE CAREFUL: Elaboration in screenwriting is dangerous. More words often means less impact.

APPROACH:
- Only add if something is genuinely MISSING from the visual chain
- Add ACTIONS or REACTIONS, never feelings or internal states
- Each addition should be a new beat the camera captures, not elaboration of existing beats
- Ask: "Does adding this change what happens, or just describe it more?" If the latter, don't add it.
- Consider: A pause. A look. A small physical action. These elaborate without overwriting.

EXAMPLE OF GOOD ELABORATION:
BEFORE: "She takes the pills."
AFTER: "She takes the pills. Hesitates. Then swallows."
(Added a beat of hesitation - new visual information, not description)

EXAMPLE OF BAD ELABORATION:
BEFORE: "She takes the pills."
AFTER: "She takes the pills with trembling fingers, her reluctance evident in every movement."
(Just described the same action more - no new visual beat)`,

    tension: `${formatGuide}

Your task is to heighten tension through COMPRESSION and SILENCE, not description.

Tension in screenwriting comes from what's NOT said, from pauses, from small physical stakes.

APPROACH:
- REMOVE words, don't add them. Tension lives in economy.
- Add SILENCE: Cut dialogue. Let a look carry the weight.
- Add PHYSICAL STAKES: A hand that shakes. A door that creaks. A clock that ticks.
- Shorten sentences. Fragment them. Make the rhythm urgent.
- Think: What small visual detail would make the audience hold their breath?

WRONG WAY TO ADD TENSION:
"The tension in the room was palpable as everyone waited, their anxiety mounting with each passing second."

RIGHT WAY:
"Silence. No one moves. The clock ticks."

Tension = compression + silence + physical detail.`,

    soften: `${formatGuide}

Your task is to suggest how this moment might land more gently.

APPROACH:
- Same events, same outcome - only the delivery changes
- This might serve the writer's intention better than the current version
- Use character knowledge - how would THIS character soften the blow?
- Reduce jarring elements while preserving meaning
- Match the writer's voice`,

    imagery: `${formatGuide}

Your task is to COMPRESS and CLARIFY imagery through cinematic grammar.

THIS IS NOT ABOUT MAKING IT "MORE VIVID" - it's about making it MORE VISUAL and LESS WORDY.

APPROACH:
- Count the tells: If the text describes the same idea multiple ways, COLLAPSE into one visual action
- Replace description with behavior: "She's exhausted" → "She drags her feet"
- Strip adjectives that don't change the shot: "weary determination" → just show the action
- Think CAUSE → REACTION: What happens, then what changes?
- If dialogue is polite/inert ("Good morning"), consider cutting it or making it functional
- One action line = one visual beat. Break up compound descriptions.

EXAMPLE OF THE PROBLEM:
"Patients file in a disciplined line at the nurse's station. Each steps forward like clockwork, reaching for a paper cup filled with pills and a matching cup of tangy orange juice."
This is OVERWRITTEN. Multiple metaphors for one visual.

CINEMATIC VERSION:
"Patients line up. Cups slide out. They drink."
Same information. Trusts the image.

Remember: Your job is usually to SUBTRACT, not add.`,

    pacing: `${formatGuide}

Your task is to suggest how the rhythm of this text might flow better.

APPROACH:
- Same content, restructured for better reading rhythm
- Study the writer's natural pacing elsewhere - match it
- Vary sentence length to create natural flow
- Balance density with breathing room
- This is about how it FEELS to read, not what it says`,

    voice: `${formatGuide}

Your task is to suggest how this text might better match the surrounding style.

APPROACH:
- Study the screenplay's voice - vocabulary, rhythm, tone
- Adjust this selection to harmonize with that voice
- Preserve meaning completely
- This is about consistency, not correction
- If it already matches, say so`,

    contradiction: `${formatGuide}

Your task is to identify and suggest fixes for any logical contradictions.

APPROACH:
- Only flag CLEAR contradictions or impossibilities
- Make minimal changes - preserve everything that works
- If no contradiction exists, confirm the text is consistent
- Don't over-edit; this is about logic, not style
- Reference character/story context to verify consistency`,

    scriptDoctor: `${formatGuide}

Your task is to act as a SCRIPT DOCTOR — diagnose and correct screenplay craft, writing quality, and formatting in the selected text.

You are a senior script doctor. You think like a filmmaker, not a copyeditor. Every fix must serve the SCREEN — what the camera sees, what the audience feels, what the actor plays.

=== BEFORE YOU TOUCH ANYTHING: REASON ===

Read the selected text AND the surrounding context. Ask yourself:
- What is this scene DOING dramatically? Setup? Escalation? Release? Texture?
- Who are these characters? What do they want right now? What are they hiding?
- What has just happened? What does the audience already know?
- Is the writer building tension, establishing rhythm, or paying something off?

Your corrections must serve the dramatic purpose you've identified. Do NOT apply rules mechanically. Every change should have a REASON rooted in what the scene needs.

=== WHAT YOU DIAGNOSE AND FIX ===

1. SHOTS AND CAMERA DIRECTION — ACTIVELY IMPLEMENT THESE:
   You MUST look for opportunities to add shots and camera direction. This is a screenplay — the writer is telling a camera where to look. Help them do that.

   USE THESE when the moment calls for it:
   - CLOSE ON / CLOSE UP — When a small detail carries dramatic weight: a trembling hand, a letter, a reaction. If the audience needs to SEE something specific, call the shot.
     Example: A character notices a wedding ring is missing → INSERT: "CLOSE ON his left hand — bare ring finger."
   - ANGLE ON — To shift visual focus within a scene. A new character enters, something changes, attention moves.
     Example: Mid-conversation, a door opens → "ANGLE ON the doorway — SARAH stands there, soaking wet."
   - INSERT — For critical props, text, screens, objects. If the audience must read or register something.
     Example: A phone buzzes → INSERT: "Phone screen — '3 missed calls from MOM'"
   - POV — When the audience needs to see THROUGH a character's eyes. What they're watching, scanning, noticing.
     Example: Character scopes a room → "POV — scanning the bar. Stops on a man in a red jacket."
   - WIDER / WIDE SHOT — To establish geography, show isolation, reveal scale.
   - OVER THE SHOULDER / TWO-SHOT — For conversation dynamics, power shifts.
   - TRACKING / MOVING — When the camera should follow action.

   Don't add shots to every line. But when a moment has visual specificity — when WHERE the camera is changes what the audience feels — call it.

2. TRANSITIONS AND CUTS — ACTIVELY IMPLEMENT THESE:
   Transitions are RHYTHM tools. They control how the audience moves between moments.

   USE THESE:
   - CUT TO: — Hard shift. New scene, new energy, new location. The default between scenes, but also powerful MID-SCENE for jarring interruption.
     Example: Character says "I would never—" CUT TO: them doing exactly that.
   - SMASH CUT TO: — Violent contrast. Peaceful moment → chaos. Lie → truth. Dream → reality. Use when the juxtaposition IS the point.
     Example: "Everything's going to be fine." SMASH CUT TO: building on fire.
   - MATCH CUT TO: — Visual or thematic rhyme between two shots. Same shape, same motion, same composition — different context.
     Example: A spinning basketball → a spinning globe on a teacher's desk.
   - JUMP CUT: — Time compression within the same scene. Same framing, time skips. Shows passage of time or repetition.
   - DISSOLVE TO: — Gentle transition. Time passing. Memory. Reflection. Softer than a cut.
   - INTERCUT — Simultaneous action across locations. Phone calls, parallel events, cross-cutting.
     Example: "INTERCUT — PHONE CONVERSATION" then alternate between both sides.
   - PRELAP / PRELAP AUDIO — Sound from the NEXT scene bleeds into the current one before the visual cut. Creates anticipation.
   - FADE IN: / FADE OUT. — Opening/closing. Or a long passage of time.

   Look for: scene changes that lack transitions, moments where the CONTRAST between two beats is the point, parallel action, time compression, and anywhere the rhythm of cuts would improve pacing.

3. CLICHÉ AND DEAD WRITING:
   - Dialogue that sounds written, not spoken. "We need to talk." "You don't understand." "It's not what it looks like." — kill these unless a character would genuinely say them in THIS moment
   - Action lines that describe mood instead of behavior: "Tension fills the room" → what does the camera SEE?
   - Predictable setups and payoffs. If the audience can finish the line, it's dead
   - Metaphors and similes in action lines. Screenplays don't have metaphors. They have images.

4. SHOW, DON'T TELL — CINEMATIC THINKING:
   - If a line TELLS emotion ("He's angry"), replace it with BEHAVIOR the camera captures ("He grips the steering wheel until his knuckles go white")
   - Internal states must become external action. No one can film "she felt conflicted"
   - Exposition buried in dialogue: characters explaining things they both already know
   - If you can remove a line and the audience still understands, remove it

5. DIALOGUE — NATURALISTIC / HEIGHTENED REALISM:
   - Dialogue should sound like real people talking — but tighter, sharper, more intentional
   - Characters interrupt, ramble, pivot mid-thought, repeat themselves, let emotion steer rhythm
   - NOT poetic or stylized on the page. Conversational, messy, reactive
   - Each character should sound DIFFERENT — vocabulary, rhythm, what they avoid saying
   - Subtext over text. What characters DON'T say matters more than what they do
   - BUT: don't overdo it. Only add messiness where it fits THIS character in THIS moment. A composed character doesn't suddenly ramble without reason.
   - Clean dialogue is fine when the scene calls for it

6. PARENTHETICALS AND OTHER ELEMENTS:
   - PARENTHETICALS — Add (beat), (sotto), (continuing), (off character), (into phone), (re: something) where they clarify delivery. Keep them brief (5-7 words max). Never use them for physical action.
   - V.O. / O.S. — Flag any off-screen or voice-over dialogue that's implied but unmarked
   - Scene headings: INT./EXT. LOCATION - TIME
   - Character names: ALL CAPS on first introduction
   - Action lines: present tense, active voice, one visual beat per line

=== RULES ===
- Preserve ALL story beats — change HOW it reads, not WHAT happens
- Match the writer's voice. If they're sparse, stay sparse. If they're dense, match that energy
- ACTIVELY look for shot and transition opportunities — don't be passive about this
- If something works, leave it alone. Script doctoring is surgery, not a rewrite
- When you fix dialogue, think about what THIS character would actually say given who they are, what just happened, and what they want

Output JSON with corrected screenplay elements.`,

    // General document commands (not typically used in screenplay mode, but included for type completeness)
    fixGrammar: `${formatGuide}\n\nYour task is to fix grammar, spelling, punctuation, and capitalization errors in the selected text. Only fix actual errors — do not rephrase or change style. Preserve intentional capitalization in brand names, proper nouns, and stylistic choices. Output JSON with screenplay elements.`,
    makeLonger: `${formatGuide}\n\nYour task is to expand the selected text with more detail and depth while maintaining the writer's style. Output JSON with screenplay elements.`,
    makeConcise: `${formatGuide}\n\nYour task is to make the selected text more concise by removing redundancy while preserving all key information. Output JSON with screenplay elements.`,
    actionItems: `${formatGuide}\n\nYour task is to extract actionable tasks from the selected text. Output as action elements in JSON format.`,
    extractQuestions: `${formatGuide}\n\nYour task is to extract questions and unknowns from the selected text. Output as action elements in JSON format.`,
    summarize: `${formatGuide}\n\nYour task is to synthesize and summarize the selected text. Output as action elements in JSON format.`,
    customPrompt: `${formatGuide}\n\nYou will receive a custom instruction from the user about how to process the selected text. Follow their instruction precisely while maintaining proper screenplay formatting. Output JSON with screenplay elements.`,
    ask: `${formatGuide}

You are a creative writing assistant for screenwriters. The user will ask you a freeform question or request about their screenplay — they might need help continuing a dialogue exchange, introducing a character, brainstorming a scene direction, solving a story problem, or anything else.

YOUR APPROACH:
- Read the user's question carefully
- Consider the full context: the screenplay so far, characters, props, scene context, and runtime target
- Generate screenplay-formatted content that directly addresses their question
- The output should be READY TO INSERT into the screenplay — not advice, not explanation, just the content itself

RULES:
- Output ONLY valid JSON with an "elements" array — no commentary, no preamble
- Use proper screenplay formatting (scene headings, action, character, dialogue, parenthetical, transition)
- Stay consistent with the established characters, tone, and world
- Use @NAME syntax for character/prop references
- If the question is about dialogue, produce dialogue. If about a scene, produce a scene. Match the output format to what they're asking for.
- Generate 3-8 elements depending on what's needed`,

    makeConsistent: `${formatGuide}

Your task: Standardize the SELECTED text so every line/item follows the same formatting pattern.

CRITICAL SCOPING RULE — Where to detect the pattern:
- Detect the dominant pattern from the SELECTED TEXT ITSELF (and its immediate surrounding lines if provided)
- Do NOT detect patterns from the document title, sidebar labels, file paths, metadata, or unrelated sections
- The "surrounding document" is provided ONLY so you understand the project context — it is NOT a style source

This is a TWO-PHASE operation. You MUST complete Phase 1 before Phase 2.

=== PHASE 1: DETECT & FREEZE (from SELECTED TEXT only) ===
Examine ONLY the selected lines. Build a style signature by checking:
- Bullet/list marker (-, *, •, numbered, none)
- Casing (lowercase, UPPERCASE, Title Case, Sentence case, camelCase, kebab-case, snake_case)
- Prefix/category tokens (feat/, fix/, TODO:, [tag], etc. — ONLY if they appear in the selected lines)
- Word separators (hyphens, underscores, slashes, spaces, dots)
- Punctuation (trailing periods, colons, semicolons, none)
- Phrasing style (imperative verbs, noun phrases, gerunds, full sentences, fragments)
- Structure template (the overall shape of each line)

Count how many selected lines follow each pattern variant. The MAJORITY wins.
If the selection is too small to determine a majority (e.g., 2 lines with different patterns), use the SURROUNDING LINES (provided as context) to break the tie.

FREEZE the rule as a rigid format string describing the exact structure each line must follow.

=== PHASE 2: LOCKED TRANSFORM ===
Apply the frozen rule to EVERY item in the selected text. No exceptions.

- If an item already matches, keep it as-is
- If an item is close but not exact, fix it
- If an item has a completely different format, rewrite it to match the frozen rule
- Preserve the semantic meaning/intent of each item — only change form, not content

CRITICAL CONSTRAINTS:
- The frozen rule comes from the SELECTED TEXT, not from document titles or metadata
- Once frozen, the rule is ABSOLUTE. Every output line MUST comply.
- Do NOT invent a pattern that doesn't exist in the selection (e.g., don't add prefixes if no selected lines have prefixes)
- Output ONLY valid JSON with an "elements" array — no commentary, no reasoning, no preamble`
  }

  return commandPrompts[command]
}

// System prompts for non-screenplay (prose) content
// Designed as collaborative writing partner tools
const PROSE_SYSTEM_PROMPTS: Record<AIWritingCommand, string> = {
  continue: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to EXTEND the current moment — not advance the plot.

You are doing EMPATHETIC MIMICRY. Read the energy, rhythm, and texture of what's on the page. Feel the vibe. Then produce the next few sentences that the SAME WRITER would produce if they kept typing.

BEFORE WRITING:
- Study the writer's sentence structure, rhythm, vocabulary, tone
- Feel the POV and narrative distance
- Read the current ENERGY LEVEL — is this quiet? tense? mundane? intimate?

THEN EXTEND (not advance):
- Continue existing behavior, observations, sensory detail
- Match the current energy — if it's quiet, stay quiet; if it's tense, hold tension
- Add micro-beats: a glance, a gesture, a thought, a sensory detail
- Let the moment BREATHE

FORBIDDEN — DO NOT:
- Introduce new characters, objects, or information not already present
- Escalate tension or stakes beyond what's established
- Create a scene turn, reveal, or dramatic event
- Have someone arrive, a phone ring, or any external interruption
- Skip ahead in time
- Summarize or recap

The writer wants CONNECTIVE TISSUE — the natural beats between dramatic moments. If they wanted the next big thing to happen, they'd write it themselves.

Keep it SHORT. 2-4 sentences. Less is more.
Output ONLY the continuation, nothing else.`,

  dialogue: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to generate DIALOGUE for this scene.

BEFORE WRITING:
- Study the dialogue style in the context - how does this writer handle speech?
- Reference character notes - how would THESE characters speak?
- What does each character want in this moment?

THEN write dialogue that:
- Sounds like THIS writer wrote it
- Reflects each character's established voice
- Serves the dramatic purpose of the scene
- Output ONLY the dialogue, nothing else`,

  setting: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to describe the SETTING/ENVIRONMENT.

BEFORE WRITING:
- How does this writer handle description? Dense or spare?
- What senses do they typically engage?
- What's their descriptive rhythm?

THEN describe:
- Match their descriptive style exactly
- Ground details in the story's world
- Create atmosphere appropriate to the moment
- Output ONLY the description, nothing else`,

  expand: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to EXPAND a brief prompt into a fuller scene.

BEFORE EXPANDING:
- Study the writer's existing style
- Consider character backgrounds from notes
- How does this fit the larger story?

THEN expand:
- Write in THEIR voice, not a generic one
- Let character knowledge inform behavior
- Create something that feels like it belongs in THIS story
- Output ONLY the expanded scene, nothing else`,

  pov: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to write from a specific CHARACTER'S point of view.

BEFORE WRITING:
- Who IS this character? (Use character notes)
- How do they see the world?
- What's their internal voice like?
- How does the writer handle POV elsewhere?

THEN write:
- In this character's authentic voice
- With their specific observations and reactions
- Matching the writer's style
- Output ONLY the POV text, nothing else`,

  negativeSpace: `${WRITING_PARTNER_PHILOSOPHY}

Your task: Create a moment of NEGATIVE SPACE — texture that exists for its own sake.

BEFORE WRITING, study the writer's style for handling quiet moments, transitions, and non-dramatic beats.

WHAT NEGATIVE SPACE IS:
- A pause. A breath. Waiting.
- Environmental detail noticed by a character (how rain sounds, a flickering light)
- Habitual behavior (how someone holds their coffee, adjusts their glasses)
- An awkward beat that's true to life (silence, fidgeting, looking away)
- Physical texture of the world (sounds, light, temperature, smell)
- A moment you wouldn't think to write — but that makes a scene feel real

WHAT NEGATIVE SPACE IS NOT:
- Plot advancement of ANY kind
- Backstory or exposition
- New character introductions
- Conflict resolution or creation
- Foreshadowing, setup, or payoff
- Thematic statements
- Anything narratively "useful"

Write in the writer's EXACT style. The moment should feel like life continuing between dramatic beats.
Output ONLY the text, no explanations.`,

  rework: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to SUGGEST an alternative version of this text.

REMEMBER: This is a DRAFT. You're offering ONE possibility, not THE answer.

APPROACH:
- First identify what's WORKING - the core intention, the feeling
- Consider: How might this land more clearly? More powerfully?
- Keep the writer's voice INTACT
- Offer something that feels like a natural evolution
- Output ONLY the suggested text, no explanations`,

  // SELECTION-BASED EDITING TOOLS - Collaborative suggestions

  adjustTone: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to suggest how this text might feel if shifted toward the requested tone.

APPROACH:
- This is a DRAFT - you're offering a possibility
- Core meaning stays identical
- Show how the same moment might land differently
- Match the writer's style exactly
- Output the suggested version only, no explanations`,

  shorten: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to suggest a tighter version of this text.

APPROACH:
- Every story beat MUST remain
- Preserve the writer's voice while trimming excess
- Subtext stays intact
- This might already be right; only tighten what benefits from it
- Output the suggested version only, no explanations`,

  clearer: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to suggest how this moment might read more clearly.

APPROACH:
- First understand what the writer is TRYING to convey
- Use character knowledge to verify actions make sense
- Don't add new information - help what's there land better
- Match the writer's style
- Output the suggested version only, no explanations`,

  elaborate: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to suggest how this moment might be enhanced with detail.

APPROACH:
- Add ONLY what serves the moment
- NO exposition, backstory, or new plot
- Use character knowledge for authentic details
- Match the writer's descriptive style
- Output the suggested version only, no explanations`,

  tension: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to suggest how this moment might carry more tension.

APPROACH:
- Use ONLY what's already in the text
- Consider story context - what stakes exist?
- Tighten prose, sharpen words, add urgency
- Outcome stays the same; reading experience intensifies
- Output the suggested version only, no explanations`,

  soften: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to suggest how this moment might land more gently.

APPROACH:
- Same events, same outcome - delivery changes
- Use character knowledge for authentic softening
- Match the writer's voice
- Output the suggested version only, no explanations`,

  imagery: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to suggest sharper, more specific imagery.

APPROACH:
- Replace vague descriptions with concrete, specific details
- Match the writer's style - if they're minimal, keep it minimal but precise
- Use story/character context to choose meaningful details
- Don't change the story, just make it more vivid
- Output the suggested version only, no explanations`,

  pacing: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to suggest how the rhythm of this text might flow better.

APPROACH:
- Same content, restructured for better reading rhythm
- Study the writer's natural pacing elsewhere - match it
- Vary sentence length to create natural flow
- This is about how it FEELS to read, not what it says
- Output the suggested version only, no explanations`,

  voice: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to suggest how this text might better match the surrounding style.

APPROACH:
- Study the writing's voice - vocabulary, rhythm, tone
- Adjust this selection to harmonize with that voice
- Preserve meaning completely
- This is about consistency, not correction
- If it already matches, confirm that
- Output the suggested version only, no explanations`,

  contradiction: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to identify and suggest fixes for any logical contradictions.

APPROACH:
- Only flag CLEAR contradictions or impossibilities
- Make minimal changes - preserve everything that works
- If no contradiction exists, confirm the text is consistent
- Reference character/story context to verify consistency
- Don't over-edit; this is about logic, not style
- Output the suggested version only, no explanations`,

  scriptDoctor: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to act as a SCRIPT DOCTOR for this narrative text.

=== BEFORE YOU TOUCH ANYTHING: REASON ===
Read the selection and context. What is this moment doing dramatically? Who are these characters? What just happened? Your fixes must serve the scene's purpose, not apply rules blindly.

WHAT YOU DIAGNOSE AND FIX:
1. CLICHÉ / DEAD WRITING: Predictable phrasing, overused expressions, dialogue that sounds written instead of spoken. Kill it unless the character would genuinely say it.
2. SHOW vs TELL: "She felt angry" → show it through behavior, action, physical detail. Internal states need external expression.
3. DIALOGUE: Should feel naturalistic — people interrupt, deflect, circle back. But only when it fits the character and moment. Clean dialogue is fine when the scene calls for it. Each character should sound distinct.
4. SCENE STRUCTURE: Missing breaks, unclear transitions, pacing that needs beats or room to breathe.
5. POV: Inconsistent point of view, head-hopping within scenes.
6. STAGE DIRECTION: Vague or missing physical action — ground the reader in space and behavior.

APPROACH:
- Preserve the writer's voice and story beats completely
- Every fix must have a reason. Don't apply rules mechanically.
- Match the writer's style — sparse stays sparse, dense stays dense
- If it's already strong, say so. Don't fix what isn't broken.
- Output the suggested version only, no explanations`,

  // GENERAL DOCUMENT COMMANDS (non-creative writing)

  fixGrammar: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to fix GRAMMAR, SPELLING, PUNCTUATION, and CAPITALIZATION errors in the selected text.

APPROACH:
- Fix spelling mistakes, typos, and grammatical errors
- Correct punctuation (commas, periods, semicolons, apostrophes, etc.)
- Fix capitalization errors (sentence beginnings, proper nouns, etc.)
- Preserve intentional capitalization in brand names, person names, and stylistic choices
- Fix subject-verb agreement, tense consistency, and pronoun references
- Do NOT change the writer's style, word choice, or sentence structure
- Do NOT rephrase or "improve" — only fix actual errors
- If the text is already correct, return it unchanged
- Output the corrected version only, no explanations`,

  makeLonger: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to EXPAND the selected text with more detail and depth.

APPROACH:
- Add supporting details, examples, or elaboration
- Flesh out ideas that are mentioned briefly
- Maintain the writer's voice and style exactly
- Don't add tangential information — stay on topic
- Don't pad with filler or redundant phrasing
- Roughly double the length while keeping quality high
- Output the expanded version only, no explanations`,

  makeConcise: `${WRITING_PARTNER_PHILOSOPHY}

Your task is to make the selected text MORE CONCISE.

APPROACH:
- Remove redundancy and repetition
- Tighten wordy phrases ("in order to" → "to", "due to the fact that" → "because")
- Eliminate filler words and unnecessary qualifiers
- Preserve ALL key information and meaning
- Maintain the writer's voice — don't strip personality
- Aim for roughly half the length while keeping all substance
- Output the concise version only, no explanations`,

  actionItems: `You are a helpful assistant that extracts actionable tasks from text.

Your task is to generate a clear list of ACTION ITEMS from the selected text.

APPROACH:
- Identify concrete tasks, decisions needed, and follow-ups
- Write each action item as a clear, actionable statement starting with a verb
- Use bullet points (- ) for each item
- Group related items if there are many
- Include who is responsible if mentioned in the text
- Include deadlines or timeframes if mentioned
- Only extract items that are genuinely actionable — skip background info
- Output ONLY the action items list, no explanations or preamble`,

  extractQuestions: `You are a helpful assistant that identifies questions and unknowns in text.

Your task is to EXTRACT QUESTIONS and unknowns from the selected text.

APPROACH:
- Identify explicit questions asked in the text
- Surface implicit questions — things left unresolved or unclear
- Note assumptions that should be validated
- Flag decisions that still need to be made
- Use bullet points (- ) for each question
- Phrase each as a clear question ending with ?
- Order from most important/urgent to least
- Output ONLY the questions list, no explanations or preamble`,

  summarize: `You are a helpful assistant that synthesizes and summarizes text.

Your task is to SYNTHESIZE AND SUMMARIZE the selected text.

APPROACH:
- Distill the key points and main takeaways
- Preserve the most important information
- Use clear, direct language
- Structure with bullet points if there are multiple distinct points
- Include any conclusions or decisions mentioned
- Keep the summary to roughly 20-30% of the original length
- Don't add interpretation — stick to what's actually in the text
- Output ONLY the summary, no explanations or preamble`,

  customPrompt: `You are a thoughtful writing assistant that helps users process and refine their notes.

You will receive:
1. The user's SELECTED TEXT they want you to work with
2. A CUSTOM INSTRUCTION describing what they want done
3. The CURRENT DOCUMENT for immediate context
4. OTHER JOURNAL ENTRIES from their project for broader context

CRITICAL APPROACH — Evidence-Based (Internal Process):
- BEFORE generating output, review ALL provided journal entries and notes
- Look for related topics, themes, prior thinking, and relevant details across the user's notes
- Ground your output in what the user has ALREADY WRITTEN — draw from their existing notes
- If no relevant notes exist or notes are empty, work from the selected text alone
- Do NOT fabricate connections or pretend notes say things they don't

OUTPUT FORMAT:
- Output ONLY the result — no reasoning, no preamble, no explanation, no outro
- Format the output so it fits naturally into the document as if the user wrote it
- Match the writer's voice, tone, and formatting style from the surrounding context`,

  ask: `${WRITING_PARTNER_PHILOSOPHY}

You are a creative writing assistant. The user will ask you a freeform question or request about their writing — they might need help continuing a dialogue, introducing a character, brainstorming a direction, solving a story problem, or anything else.

YOUR APPROACH:
- Read the user's question carefully
- Consider the full context: the document so far, characters, props, supplementary notes
- Generate content that directly addresses their question
- The output should be READY TO INSERT into the document — not advice, not explanation, just the content itself

RULES:
- Output ONLY the content — no commentary, no preamble, no explanation
- Match the writer's existing voice, tone, and style
- Stay consistent with established characters and world
- If the question is about dialogue, produce dialogue. If about description, produce description. Match the output to what they're asking for.
- Use @NAME syntax for character/prop references when appropriate`,

  makeConsistent: `${WRITING_PARTNER_PHILOSOPHY}

Your task: Standardize the SELECTED text so every line/item follows the same formatting pattern.

CRITICAL SCOPING RULE — Where to detect the pattern:
- Detect the dominant pattern from the SELECTED TEXT ITSELF (and its immediate surrounding lines if provided)
- Do NOT detect patterns from the document title, sidebar labels, file paths, metadata, or unrelated sections
- The "surrounding document" is provided ONLY so you understand the project context — it is NOT a style source

This is a TWO-PHASE operation. You MUST complete Phase 1 before Phase 2.

=== PHASE 1: DETECT & FREEZE (from SELECTED TEXT only) ===
Examine ONLY the selected lines. Build a style signature by checking:
- Bullet/list marker (-, *, •, numbered, none)
- Casing (lowercase, UPPERCASE, Title Case, Sentence case, camelCase, kebab-case, snake_case)
- Prefix/category tokens (feat/, fix/, TODO:, [tag], etc. — ONLY if they appear in the selected lines)
- Word separators (hyphens, underscores, slashes, spaces, dots)
- Punctuation (trailing periods, colons, semicolons, none)
- Phrasing style (imperative verbs, noun phrases, gerunds, full sentences, fragments)
- Structure template (the overall shape of each line)

Count how many selected lines follow each pattern variant. The MAJORITY wins.
If the selection is too small to determine a majority (e.g., 2 lines with different patterns), use the SURROUNDING LINES (provided as context) to break the tie.

FREEZE the rule as a rigid format string describing the exact structure each line must follow.

=== PHASE 2: LOCKED TRANSFORM ===
Apply the frozen rule to EVERY item in the selected text. No exceptions.

- If an item already matches, keep it as-is
- If an item is close but not exact, fix it
- If an item has a completely different format, rewrite it to match the frozen rule
- Preserve the semantic meaning/intent of each item — only change form, not content

CRITICAL CONSTRAINTS:
- The frozen rule comes from the SELECTED TEXT, not from document titles or metadata
- Once frozen, the rule is ABSOLUTE. Every output line MUST comply.
- Do NOT invent a pattern that doesn't exist in the selection (e.g., don't add prefixes if no selected lines have prefixes)
- Output ONLY the rewritten text — no commentary, no reasoning, no preamble`
}

// User prompt builders
function buildScreenplayUserPrompt(request: AIWritingRequest): string {
  const { command, context, selection, characterName, characters, props, settingHint, documentTitle, toneOption, supplementaryContext, sceneContext, targetRuntimeMinutes } = request

  let prompt = ''

  // For makeConsistent, skip the document title — it pollutes pattern detection
  if (documentTitle && command !== 'makeConsistent') {
    prompt += `Screenplay: "${documentTitle}"\n\n`
  }

  // Add runtime target awareness
  if (targetRuntimeMinutes) {
    prompt += `=== RUNTIME TARGET ===\nThis screenplay has a target runtime of ${targetRuntimeMinutes} minutes (~${targetRuntimeMinutes} pages). Keep content proportional to this target. Do not over-write.\n\n`
  }

  // Add supplementary context (synopsis, character notes, etc.)
  const suppContext = buildSupplementaryContextSection(supplementaryContext)
  if (suppContext) {
    prompt += suppContext + '\n'
  }
  
  // Add structured scene context - this tells AI exactly where we are and who is present
  if (sceneContext) {
    prompt += `=== CURRENT SCENE ===\n`
    if (sceneContext.sceneHeading) {
      prompt += `Location: ${sceneContext.sceneHeading}\n`
    }
    if (sceneContext.charactersInScene && sceneContext.charactersInScene.length > 0) {
      prompt += `Characters IN this scene: ${sceneContext.charactersInScene.map(c => c.toUpperCase()).join(', ')}\n`
      prompt += `ONLY use these characters - they are the ones present.\n`
    }
    if (sceneContext.precedingAction) {
      prompt += `Recent action: ${sceneContext.precedingAction.slice(0, 500)}\n`
    }
    prompt += '\n'
  }
  
  // Remind about available characters/props (for name formatting only)
  if (characters && characters.length > 0) {
    prompt += `All project characters (for formatting only - NOT a casting list): ${characters.map(c => c.name.toUpperCase()).join(', ')}\n`
  }
  if (props && props.length > 0) {
    prompt += `Props in this project: ${props.map(p => p.name.toUpperCase()).join(', ')}\n`
  }
  prompt += '\n'
  
  // Add context with cinematic framing
  prompt += `=== THE WRITER'S WORK (analyze for cinematic grammar) ===\n`
  prompt += `Study this text through a CINEMATIC lens before responding:\n`
  prompt += `- Count tells per beat: Are they stacking description, or one action per line?\n`
  prompt += `- What's the visual cause-effect chain? (A happens → B reacts → C results)\n`
  prompt += `- What could be CUT and still be understood?\n`
  prompt += `- Is dialogue functional (commands, tests, reveals) or inert (polite filler)?\n\n`
  prompt += `---\n${context}\n---\n\n`
  
  switch (command) {
    case 'continue':
      prompt += `=== YOUR TASK ===\nEXTEND the current moment. Do NOT advance the plot.\n\nRefer to the "CURRENT SCENE" section above:\n- Use ONLY the characters listed there\n- Stay in the location from the scene heading\n- Match the ENERGY of the recent action — if it's quiet, stay quiet\n\nALLOWED MOVES:\n- Extend existing behavior (a character continues what they're doing)\n- Physical micro-beats (shifting weight, adjusting something, a glance)\n- Sensory detail the camera would catch\n- Continue an exchange already in progress\n- Silence, pause, breath\n\nFORBIDDEN:\n- New characters, props, or information\n- Escalation, reveals, plot turns\n- External interruptions (phone, radio, door, arrival)\n- New scene headings\n- Prose flourishes\n\n2-4 elements. SHORT. Output JSON with screenplay elements.`
      break
      
    case 'dialogue':
      prompt += `=== YOUR TASK ===\nGenerate dialogue for characters IN THIS SCENE.\n\nRefer to the "CURRENT SCENE" section above for who is present. Use ONLY those characters.\n\nEvery line must FUNCTION (command, reveal, deflect, attack). Cut polite filler. Use action beats between lines. Do NOT introduce new speakers. Output JSON with screenplay elements.`
      break
      
    case 'setting':
      if (settingHint) {
        prompt += `Setting focus: ${settingHint}\n\n`
      }
      prompt += `=== YOUR TASK ===\nDescribe the CURRENT SETTING - the location in the "CURRENT SCENE" section.\n\nWhat does the camera SEE in THIS place? 3-5 specific visual details max. No mood descriptions. Do NOT create a new scene heading. Output JSON with screenplay elements.`
      break
      
    case 'expand':
      const textToExpand = selection || context.split('\n').slice(-3).join('\n')
      prompt += `Prompt to expand:\n---\n${textToExpand}\n---\n\n`
      prompt += `=== YOUR TASK ===\nExpand THIS moment with characters from "CURRENT SCENE" section.\n\nDo NOT create a new scene heading unless explicitly asked. Use ONLY characters listed in "CURRENT SCENE". Build visual beats: inciting action → reaction → result. 5-10 beats, staying in the current location. Output JSON with screenplay elements.`
      break
      
    case 'pov':
      const povCharacter = characterName || (characters && characters.length > 0 ? characters[0].name : 'the main character')
      prompt += `Character POV: ${povCharacter}\n\n`
      prompt += `=== YOUR TASK ===\nShow ${povCharacter}'s perspective through BEHAVIOR in THIS scene.\n\nThe character must be in the "CURRENT SCENE" character list. Stay in the scene heading location. What do they DO, notice, avoid? "She counts the exits" not "She feels nervous." Let behavior imply psychology. Output JSON with screenplay elements.`
      break
      
    case 'negativeSpace':
      prompt += `=== YOUR TASK ===\nCreate a moment of NEGATIVE SPACE in this scene.\n\nRefer to the "CURRENT SCENE" section above. Stay in the location. Use only characters present.\n\nProduce a moment that does NOT:\n- Advance the plot\n- Reveal backstory\n- Introduce new characters\n- Resolve any tension\n- Set up or pay off anything\n\nInstead, create:\n- A pause, a breath, waiting\n- Environmental detail a character notices\n- Habitual behavior (how they hold their coffee, adjust a sleeve)\n- An awkward beat true to life\n- Texture that exists for texture's sake\n\nThink: what would a documentary camera capture if it kept rolling between takes?\n2-4 elements of pure texture. Output JSON with screenplay elements.`
      break

    case 'rework':
      if (!selection) {
        prompt += `No text selected to rework.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nApply cinematic grammar. Identify what the camera sees. Compress stacked descriptions into single actions. Replace feelings with behavior. Cut inert dialogue. Output JSON with screenplay elements.`
      break
      
    // SELECTION-BASED EDITING COMMANDS
    case 'adjustTone':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nSuggest how this might feel if shifted toward "${toneOption}". Same story beat, different emotional coloring. Keep the writer's style. Output JSON with screenplay elements.`
      break
      
    case 'shorten':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nCompress using cinematic economy. Collapse multiple tells into single visual actions. Cut adjectives that don't change the shot. Trust the image to carry meaning. Output JSON with screenplay elements.`
      break
      
    case 'clearer':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nMake the visual cause-effect chain unmistakable. Strip anything that obscures the action. Clarity = the audience instantly understands what happened through what they SEE. Output JSON with screenplay elements.`
      break
      
    case 'elaborate':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nAdd visual BEATS only if something is genuinely missing. A pause. A look. A small physical action. Don't describe more - add new things the camera captures. Be careful: more words often means less impact. Output JSON with screenplay elements.`
      break
      
    case 'tension':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nHeighten tension through COMPRESSION and SILENCE. Remove words. Cut dialogue. Add physical stakes (a trembling hand, a ticking clock). Fragment sentences. Tension = economy + silence + physical detail. Output JSON with screenplay elements.`
      break
      
    case 'soften':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nSuggest how this might land more gently. Same events, softer delivery. Match the writer's voice. Output JSON with screenplay elements.`
      break
      
    case 'imagery':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nApply cinematic compression. Count the tells - if there are multiple descriptions for one beat, COLLAPSE them. Replace feelings with behavior. Cut inert dialogue. Think: CAUSE → REACTION. Output JSON with screenplay elements.`
      break
      
    case 'pacing':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nSuggest how this might flow better rhythmically. Study the writer's pacing elsewhere and match it. Output JSON with screenplay elements.`
      break
      
    case 'voice':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nSuggest how this might better match the voice of the surrounding script. Study the style above, then harmonize. Output JSON with screenplay elements.`
      break
      
    case 'contradiction':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nCheck for logical contradictions using your knowledge of the characters and story. If you find one, suggest a minimal fix. If not, confirm it's consistent. Output JSON with screenplay elements.`
      break

    case 'scriptDoctor':
      if (!selection) {
        prompt += `No text selected for Script Doctor.`
        break
      }
      prompt += `=== SELECTED TEXT (diagnose and correct) ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nAct as Script Doctor. FIRST reason about the scene's dramatic purpose and characters from context. THEN diagnose and fix:\n`
      prompt += `1. SHOTS — Actively add CLOSE ON, ANGLE ON, INSERT, POV, WIDER where they clarify visual intent or carry dramatic weight. If a detail matters, call the shot.\n`
      prompt += `2. TRANSITIONS — Actively add CUT TO:, SMASH CUT TO:, MATCH CUT TO:, JUMP CUT, DISSOLVE TO:, INTERCUT, PRELAP where they control rhythm, create contrast, compress time, or connect parallel action.\n`
      prompt += `3. CLICHÉ / DEAD WRITING — kill written-sounding dialogue, mood-as-action, predictable exchanges\n`
      prompt += `4. SHOW DON'T TELL — replace told emotion with filmed behavior. Cut exposition characters already know.\n`
      prompt += `5. DIALOGUE — naturalistic/heightened realism where it fits the character and moment. Subtext over text.\n`
      prompt += `6. PARENTHETICALS — add (beat), (sotto), (off character) etc. where they clarify delivery. V.O./O.S. where implied but unmarked.\n`
      prompt += `7. FORMATTING — scene headings, ALL-CAPS introductions, present tense, one beat per line\n\n`
      prompt += `Preserve ALL story beats. Match the writer's voice. ACTIVELY implement shots and transitions — don't be passive. Output JSON with screenplay elements.`
      break

    // General document commands (fallback for screenplay context)
    case 'fixGrammar':
    case 'makeLonger':
    case 'makeConcise':
    case 'actionItems':
    case 'extractQuestions':
    case 'summarize':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nProcess the selected text according to the system instructions. Output JSON with screenplay elements.`
      break

    case 'customPrompt':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== USER'S INSTRUCTION ===\n${request.customPromptText || 'Process the selected text.'}\n\n`
      prompt += `=== YOUR TASK ===\nFollow the user's instruction above. Apply it to the selected text using the surrounding context. Output JSON with screenplay elements.`
      break

    case 'makeConsistent':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SURROUNDING DOCUMENT (reference only — do NOT extract patterns from this) ===\n---\n${context}\n---\n\n`
      prompt += `=== SELECTED TEXT (detect the dominant pattern HERE, then standardize all lines to match) ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nPhase 1: Look at ONLY the SELECTED TEXT lines. Find the majority formatting pattern among them. Ignore the document title, sidebar, and metadata — those are not style sources. Freeze the pattern as a strict rule.\nPhase 2: Rewrite every selected line to match the frozen rule. If a line already matches, keep it. If it doesn't, transform it. Preserve meaning, enforce format.\nOutput JSON with screenplay elements.`
      break

    case 'ask':
      prompt += `=== USER'S QUESTION ===\n${request.userQuestion || 'Help me with the next part of my screenplay.'}\n\n`
      prompt += `=== YOUR TASK ===\nAnswer the user's question by generating screenplay-formatted content that addresses what they're asking for. Use the full context above (document, characters, props, scene context) to produce something that fits naturally into their screenplay. Output JSON with screenplay elements.`
      break
  }

  prompt += `\n\nRemember:
- Output ONLY valid JSON with "elements" array, no other text.
- ONLY use characters from the CONTEXT TEXT - not from the character list!
- FOLLOW THE THREAD: Continue what just happened, don't create a montage.
- NO prose flourishes: Cut "as if", "in quiet composure", "observing the routine"
- ONE ACTION PER LINE: One thing happens, then the next.
- NO CAMERA DIRECTIONS in action lines.
- Use @NAME syntax for characters/props that appear.`

  return prompt
}

function buildProseUserPrompt(request: AIWritingRequest): string {
  const { command, context, selection, characterName, characters, settingHint, documentTitle, toneOption, supplementaryContext } = request
  
  let prompt = ''
  
  // For makeConsistent, skip the document title — it pollutes pattern detection
  if (documentTitle && command !== 'makeConsistent') {
    prompt += `Document: "${documentTitle}"\n\n`
  }

  // Add supplementary context (synopsis, character notes, etc.)
  const suppContext = buildSupplementaryContextSection(supplementaryContext)
  if (suppContext) {
    prompt += suppContext + '\n'
  }

  // For makeConsistent, the context is added in the switch case with proper labeling
  // For other commands, add the standard style analysis framing
  if (command !== 'makeConsistent') {
    prompt += `=== THE WRITER'S WORK (study their style carefully) ===\n`
    prompt += `Analyze their style before responding:\n`
    prompt += `- Sentence structure and rhythm\n`
    prompt += `- Vocabulary and tone\n`
    prompt += `- Descriptive density\n\n`
    prompt += `---\n${context}\n---\n\n`
  }
  
  switch (command) {
    case 'continue':
      prompt += `=== YOUR TASK ===\nEXTEND the current moment. Do NOT advance the plot.\n\nMatch the writer's style EXACTLY — your output should be indistinguishable from their writing.\n\nALLOWED: extend existing behavior, sensory detail, micro-beats, continue an exchange in progress.\nFORBIDDEN: new characters/objects/info, escalation, reveals, external interruptions, time skips.\n\n2-4 sentences. Keep it SHORT.`
      break
      
    case 'dialogue':
      if (characters && characters.length > 0) {
        prompt += `Available characters: ${characters.map(c => c.name).join(', ')}\n\n`
      }
      prompt += `=== YOUR TASK ===\nGenerate dialogue that sounds like THIS writer wrote it. Use character notes to understand how each person speaks.`
      break
      
    case 'setting':
      if (settingHint) {
        prompt += `Setting focus: ${settingHint}\n\n`
      }
      prompt += `=== YOUR TASK ===\nDescribe the setting in the SAME descriptive style as the writer. Match their level of detail.`
      break
      
    case 'expand':
      const textToExpand = selection || context.split('\n').slice(-3).join('\n')
      prompt += `Prompt to expand:\n---\n${textToExpand}\n---\n\n`
      prompt += `=== YOUR TASK ===\nExpand this into a fuller scene, writing in the SAME style as the surrounding text. Use character knowledge.`
      break
      
    case 'pov':
      const povName = characterName || (characters && characters.length > 0 ? characters[0].name : 'the main character')
      prompt += `Character: ${povName}\n\n`
      prompt += `=== YOUR TASK ===\nWrite from ${povName}'s perspective. Use their character notes to understand how they see the world. Match the existing writing style.`
      break

    case 'negativeSpace':
      prompt += `=== YOUR TASK ===\nCreate a moment of NEGATIVE SPACE.\n\nProduce a moment that does NOT:\n- Advance the plot\n- Reveal backstory\n- Introduce new characters\n- Resolve any tension\n- Set up or pay off anything\n\nInstead, create:\n- A pause, a breath, waiting\n- Environmental detail a character notices\n- Habitual behavior\n- An awkward beat true to life\n- Texture that exists for texture's sake\n\nMatch the writer's EXACT style. Output only the text.`
      break
      
    case 'rework':
      if (!selection) {
        prompt += `No text selected to rework.`
        break
      }
      prompt += `=== SELECTED TEXT (the writer is exploring this) ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nOffer a suggestion for how this might read differently. This is a DRAFT - you're helping the writer explore, not fixing mistakes. Keep their voice.`
      break
      
    // SELECTION-BASED EDITING COMMANDS
    case 'adjustTone':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nSuggest how this might feel if shifted toward "${toneOption}". Same story beat, different emotional coloring. Keep the writer's style.`
      break
      
    case 'shorten':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nSuggest a tighter version. Keep ALL beats - tighten, don't cut. Match the writer's voice.`
      break
      
    case 'clearer':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nSuggest how this might read more clearly. What is the writer TRYING to convey? Help that land better. Don't add new information. Match their style.`
      break
      
    case 'elaborate':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nSuggest how to add texture to this moment. Use character knowledge for authentic details. NO exposition or new plot. Match the writer's descriptive style.`
      break
      
    case 'tension':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nSuggest how this might carry more tension. Use ONLY what's already here - tighten, sharpen, add urgency. Same outcome, heightened experience.`
      break
      
    case 'soften':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nSuggest how this might land more gently. Same events, softer delivery. Match the writer's voice.`
      break
      
    case 'imagery':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nSuggest sharper imagery. Replace vague with concrete details. Match the writer's descriptive style.`
      break
      
    case 'pacing':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nSuggest how this might flow better rhythmically. Study the writer's pacing in the context above and match it.`
      break
      
    case 'voice':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nSuggest how this might better match the voice of the surrounding text. Study the style above, then harmonize.`
      break
      
    case 'contradiction':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nCheck for logical contradictions using your knowledge of the characters and story. If you find one, suggest a minimal fix. If not, confirm it's consistent.`
      break

    case 'scriptDoctor':
      if (!selection) {
        prompt += `No text selected for Script Doctor.`
        break
      }
      prompt += `=== SELECTED TEXT (diagnose and correct) ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nAct as Script Doctor. FIRST reason about what this scene is doing dramatically and who these characters are from context. THEN diagnose and fix:\n`
      prompt += `1. CLICHÉ / DEAD WRITING — predictable phrasing, overused expressions, dialogue that sounds written not spoken\n`
      prompt += `2. SHOW vs TELL — emotions told that should be shown through behavior and physical detail\n`
      prompt += `3. DIALOGUE — make it naturalistic where appropriate. People interrupt, deflect, circle back. But only when it fits the character and moment.\n`
      prompt += `4. SCENE STRUCTURE — pacing, transitions, beats that need room to breathe\n`
      prompt += `5. POV / STAGE DIRECTION — consistency, grounding the reader in space and behavior\n\n`
      prompt += `Preserve ALL story beats. Match the writer's voice. Every fix must have a reason. If it's already strong, leave it alone.`
      break

    // GENERAL DOCUMENT COMMANDS
    case 'fixGrammar':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nFix all grammar, spelling, punctuation, and capitalization errors. Preserve intentional capitalization in brand names, person names, and stylistic choices. Do NOT change the writer's style, word choice, or sentence structure. Only fix actual errors. If the text is already correct, return it unchanged.`
      break

    case 'makeLonger':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nExpand this text with more detail and depth. Add supporting details, examples, or elaboration. Stay on topic. Match the writer's voice and style. Roughly double the length while keeping quality high.`
      break

    case 'makeConcise':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nMake this text more concise. Remove redundancy, tighten wordy phrases, eliminate filler. Preserve ALL key information and meaning. Maintain the writer's voice.`
      break

    case 'actionItems':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nExtract a clear list of action items from this text. Write each as a concrete, actionable statement starting with a verb. Use bullet points (- ). Include who is responsible and deadlines if mentioned. Only extract genuinely actionable items.`
      break

    case 'extractQuestions':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nExtract all questions and unknowns from this text. Include explicit questions, implicit unknowns, assumptions to validate, and decisions still needed. Use bullet points (- ). Phrase each as a clear question ending with ?`
      break

    case 'summarize':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nSynthesize and summarize this text. Distill the key points and main takeaways. Use bullet points if there are multiple distinct points. Keep to roughly 20-30% of the original length. Stick to what's actually in the text.`
      break

    case 'customPrompt':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SELECTED TEXT ===\n---\n${selection}\n---\n\n`
      prompt += `=== USER'S INSTRUCTION ===\n${request.customPromptText || 'Process the selected text.'}\n\n`
      prompt += `=== YOUR TASK ===\nFollow the user's instruction above. Review ALL journal entries provided in the context to find relevant information. Ground your output in what the user has already written. Output ONLY the result — no reasoning, no preamble, no explanation, no outro. Format it so it fits naturally into the document.`
      break

    case 'makeConsistent':
      if (!selection) {
        prompt += `No text selected.`
        break
      }
      prompt += `=== SURROUNDING DOCUMENT (reference only — do NOT extract patterns from this) ===\n---\n${context}\n---\n\n`
      prompt += `=== SELECTED TEXT (detect the dominant pattern HERE, then standardize all lines to match) ===\n---\n${selection}\n---\n\n`
      prompt += `=== YOUR TASK ===\nPhase 1: Look at ONLY the SELECTED TEXT lines. Find the majority formatting pattern among them. Ignore the document title, sidebar, and metadata — those are not style sources. Freeze the pattern as a strict rule.\nPhase 2: Rewrite every selected line to match the frozen rule. If a line already matches, keep it. If it doesn't, transform it. Preserve meaning, enforce format.\nOutput ONLY the rewritten text.`
      break

    case 'ask':
      prompt += `=== USER'S QUESTION ===\n${request.userQuestion || 'Help me with the next part of my writing.'}\n\n`
      prompt += `=== YOUR TASK ===\nAnswer the user's question by generating content that addresses what they're asking for. Use the full context above (document, characters, notes) to produce something that fits naturally into their writing. Output ONLY the content — no commentary, no preamble.`
      break
  }

  prompt += `\n\nRemember: MATCH THE WRITER'S STYLE - your output should feel like THEY wrote it.`

  return prompt
}

export class AIWritingService {
  private store: Store
  private isGenerating: boolean = false

  constructor() {
    this.store = new Store({
      name: 'image-generation-settings',
      encryptionKey: 'cadmus-image-gen-v1'
    })
  }

  hasApiKey(): boolean {
    const apiKey = this.store.get('apiKey') as string | undefined
    return !!apiKey && apiKey.length > 0
  }

  private getApiKey(): string | null {
    const apiKey = this.store.get('apiKey') as string | undefined
    return apiKey && apiKey.length > 0 ? apiKey : null
  }

  async generate(request: AIWritingRequest): Promise<AIWritingResponse> {
    if (this.isGenerating) {
      return { text: '', error: 'Generation already in progress' }
    }

    const apiKey = this.getApiKey()
    if (!apiKey) {
      return { text: '', error: 'No API key configured. Please add your OpenAI API key in settings.' }
    }

    const hasContext = request.context && request.context.trim().length > 0
    const hasSelection = request.selection && request.selection.trim().length > 0
    if (!hasContext && !hasSelection) {
      return { text: '', error: 'No context provided. Please write some text first.' }
    }

    this.isGenerating = true
    const isScreenplay = request.templateType === 'screenplay'
    console.log(`[AIWriting] Generating ${request.command} (screenplay: ${isScreenplay})...`)
    if (request.characters?.length) {
      console.log(`[AIWriting] Characters: ${request.characters.map(c => c.name).join(', ')}`)
    }
    if (request.props?.length) {
      console.log(`[AIWriting] Props: ${request.props.map(p => p.name).join(', ')}`)
    }

    try {
      // Truncate context if too long
      const maxContextLength = 8000
      let truncatedContext = request.context
      if (truncatedContext.length > maxContextLength) {
        truncatedContext = '...' + truncatedContext.slice(-maxContextLength)
      }
      
      const truncatedRequest = { ...request, context: truncatedContext }
      
      // Choose prompts based on template type
      const systemPrompt = isScreenplay 
        ? getScreenplaySystemPrompt(request.command, request.characters, request.props, request.toneOption)
        : PROSE_SYSTEM_PROMPTS[request.command]
      
      const userPrompt = isScreenplay
        ? buildScreenplayUserPrompt(truncatedRequest)
        : buildProseUserPrompt(truncatedRequest)

      // Log prompt sizes for debugging
      console.log(`[AIWriting] Prompt sizes - System: ${systemPrompt.length} chars, User: ${userPrompt.length} chars, Total: ${systemPrompt.length + userPrompt.length} chars`)

      // Token budgets by command type
      // Reasoning-heavy commands need more tokens (o3-mini reasoning tokens eat into this budget)
      // Continue is capped low to prevent over-generation (the "next action sequence" problem)
      const reasoningCommands: AIWritingCommand[] = ['scriptDoctor', 'negativeSpace', 'makeConsistent']
      const shortCommands: AIWritingCommand[] = ['continue']
      const maxTokens = reasoningCommands.includes(request.command) ? 16384
        : shortCommands.includes(request.command) ? 2048
        : 4096

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'o3-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: maxTokens
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error?.message || `API request failed with status ${response.status}`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error.message || 'API returned an error')
      }

      // Log the response structure for debugging
      console.log('[AIWriting] API response structure:', {
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length,
        hasMessage: !!data.choices?.[0]?.message,
        messageKeys: data.choices?.[0]?.message ? Object.keys(data.choices[0].message) : [],
        finishReason: data.choices?.[0]?.finish_reason,
        usage: data.usage
      })

      const generatedText = data.choices?.[0]?.message?.content?.trim()
      
      if (!generatedText) {
        // Log more details about what we received
        console.error('[AIWriting] No text in response. Full choice:', JSON.stringify(data.choices?.[0], null, 2))
        throw new Error('No text generated')
      }

      console.log(`[AIWriting] Generated ${generatedText.length} characters`)

      // Build character/prop maps for mention resolution
      const characterMap: Record<string, CharacterInfo> = {}
      const propMap: Record<string, PropInfo> = {}
      
      if (request.characters) {
        for (const char of request.characters) {
          characterMap[char.name.toUpperCase()] = char
        }
      }
      if (request.props) {
        for (const prop of request.props) {
          propMap[prop.name.toUpperCase()] = prop
        }
      }

      // For screenplay, parse the JSON response
      if (isScreenplay) {
        try {
          // Try multiple methods to extract JSON from the response
          let jsonStr = generatedText
          
          // Method 1: Remove markdown code blocks if present
          const codeBlockMatch = generatedText.match(/```(?:json)?\s*([\s\S]*?)```/)
          if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim()
            console.log('[AIWriting] Extracted JSON from code block')
          }
          
          // Method 2: Find JSON object with "elements" key
          if (!codeBlockMatch) {
            // Find the first { and last } that contains "elements"
            const startIdx = jsonStr.indexOf('{')
            const endIdx = jsonStr.lastIndexOf('}')
            if (startIdx !== -1 && endIdx > startIdx) {
              const extracted = jsonStr.slice(startIdx, endIdx + 1)
              if (extracted.includes('"elements"')) {
                jsonStr = extracted
                console.log('[AIWriting] Extracted JSON by brace matching')
              }
            }
          }
          
          console.log('[AIWriting] Attempting to parse JSON:', jsonStr.slice(0, 200) + '...')
          
          const parsed = JSON.parse(jsonStr)
          
          if (parsed.elements && Array.isArray(parsed.elements)) {
            // Validate elements
            const validElements: ScreenplayElement[] = parsed.elements
              .filter((el: { type?: string; text?: string }) => 
                el.type && el.text && 
                ['scene-heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'shot'].includes(el.type)
              )
              .map((el: { type: string; text: string }) => ({
                type: el.type as ScreenplayElementType,
                text: el.text.trim()
              }))
            
            console.log(`[AIWriting] Parsed ${validElements.length} valid screenplay elements`)
            
            if (validElements.length > 0) {
              // Also create a plain text version for fallback
              const plainText = validElements.map(el => el.text).join('\n\n')
              return {
                text: plainText,
                screenplayElements: validElements,
                isScreenplay: true,
                characterMap,
                propMap
              }
            } else {
              console.warn('[AIWriting] No valid elements found in parsed JSON')
            }
          } else {
            console.warn('[AIWriting] Parsed JSON missing "elements" array:', Object.keys(parsed))
          }
          
          // If parsing failed, fall back to plain text but still mark as screenplay attempt
          console.warn('[AIWriting] Failed to parse screenplay elements, using plain text')
          return { text: generatedText, characterMap, propMap }
          
        } catch (parseErr) {
          console.warn('[AIWriting] JSON parse error, attempting truncated recovery:', parseErr)
          console.warn('[AIWriting] Raw response was:', generatedText.slice(0, 500))
          
          // Method 3: Recover elements from truncated JSON
          // If the model ran out of tokens, we may have partial but valid elements
          try {
            const elementsMatch = generatedText.match(/"elements"\s*:\s*\[/)
            if (elementsMatch) {
              const arrayStart = generatedText.indexOf('[', generatedText.indexOf('"elements"'))
              if (arrayStart !== -1) {
                // Extract individual element objects using regex
                const elementRegex = /\{\s*"type"\s*:\s*"([^"]+)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g
                const recoveredElements: ScreenplayElement[] = []
                let match
                while ((match = elementRegex.exec(generatedText)) !== null) {
                  const type = match[1]
                  const text = match[2].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim()
                  if (type && text && ['scene-heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'shot'].includes(type)) {
                    recoveredElements.push({ type: type as ScreenplayElementType, text })
                  }
                }
                
                if (recoveredElements.length > 0) {
                  console.log(`[AIWriting] Recovered ${recoveredElements.length} elements from truncated JSON`)
                  const plainText = recoveredElements.map(el => el.text).join('\n\n')
                  return {
                    text: plainText,
                    screenplayElements: recoveredElements,
                    isScreenplay: true,
                    characterMap,
                    propMap
                  }
                }
              }
            }
          } catch (recoveryErr) {
            console.warn('[AIWriting] Truncated recovery also failed:', recoveryErr)
          }
          
          return { text: generatedText, characterMap, propMap }
        }
      }

      return { text: generatedText }

    } catch (error) {
      console.error('[AIWriting] Error:', error)
      return { 
        text: '', 
        error: error instanceof Error ? error.message : 'Failed to generate text' 
      }
    } finally {
      this.isGenerating = false
    }
  }
}

// Singleton instance
let instance: AIWritingService | null = null

export function getAIWritingService(): AIWritingService {
  if (!instance) {
    instance = new AIWritingService()
  }
  return instance
}
