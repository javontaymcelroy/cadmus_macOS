/**
 * Thought Partner Pipeline — OpenAI Function Calling Tool Schemas
 *
 * Defines the tools exposed to the orchestrator model and the JSON schema
 * enforced on the patcher model's response.
 */

// ===== Tools exposed to the orchestrator (o3-mini) =====

export const ASK_QUESTION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'ask_question',
    description:
      'Ask the writer a focused question with 2-4 selectable options to gather preferences or make creative decisions. Use this instead of writing questions in your text. Call at most once per response. Do NOT promise to call this function later — if you need to ask, call it NOW in this response.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        questionText: {
          type: 'string',
          description: 'The question to ask the writer',
        },
        options: {
          type: 'array',
          description:
            '2-4 specific, actionable options representing genuinely different directions',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Short option label (2-6 words)',
              },
              description: {
                type: 'string',
                description: 'One-line explanation of what this option means',
              },
            },
            required: ['label', 'description'],
            additionalProperties: false,
          },
        },
        category: {
          type: 'string',
          enum: ['tone', 'structure', 'character', 'plot', 'style', 'general'],
          description: 'Category of the question',
        },
      },
      required: ['questionText', 'options', 'category'],
      additionalProperties: false,
    },
  },
}

export const PLAN_EDIT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'plan_edit',
    description:
      'Plan an edit to the document. Call this when the user wants to change, add, remove, rewrite, or produce content. Returns an edit plan that will be executed as a structured patch. Do NOT write content directly — always use this tool for edits.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: 'What the edit achieves in 1-2 sentences',
        },
        constraints: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Rules and constraints for this edit (tone, format, scope limits)',
        },
        scope: {
          type: 'string',
          enum: ['selection', 'document'],
          description:
            'Whether the edit targets the highlighted selection or the full document',
        },
        patchStrategy: {
          type: 'string',
          enum: ['replace', 'insert', 'delete', 'mixed'],
          description: 'The primary type of edit operation',
        },
        targetBlockIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Block IDs of the blocks to read and/or modify. Get these from the [block:ID] prefixes in the document context. REQUIRED: you must specify at least one target block ID. If you cannot identify specific blocks, do NOT call plan_edit — instead call reflect_understanding or ask_question to clarify scope.',
        },
        maxBlocksAffected: {
          type: 'number',
          description:
            'Maximum number of blocks this edit should touch. Be conservative.',
        },
      },
      required: [
        'goal',
        'constraints',
        'scope',
        'patchStrategy',
        'targetBlockIds',
        'maxBlocksAffected',
      ],
      additionalProperties: false,
    },
  },
}

export const CREATE_CHARACTER_TOOL = {
  type: 'function' as const,
  function: {
    name: 'create_character',
    description: 'Propose creating a new character in the project.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Character name in UPPERCASE',
        },
        reason: {
          type: 'string',
          description: 'Why this character is needed',
        },
      },
      required: ['name', 'reason'],
      additionalProperties: false,
    },
  },
}

export const CREATE_PROP_TOOL = {
  type: 'function' as const,
  function: {
    name: 'create_prop',
    description: 'Propose creating a new prop in the project.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Prop name',
        },
        reason: {
          type: 'string',
          description: 'Why this prop is needed',
        },
      },
      required: ['name', 'reason'],
      additionalProperties: false,
    },
  },
}

export const PRODUCE_PLAN_TOOL = {
  type: 'function' as const,
  function: {
    name: 'produce_plan',
    description:
      'Produce a structured plan for a complex edit. Use this instead of plan_edit when the request involves multiple steps, cross-section changes, structural reorganization, rewrites exceeding 3 blocks, or high-impact changes to plot, tone, or voice. The plan will be shown to the writer for approval before any edits are made. You MUST NOT produce patches or content — only the plan.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: 'What the overall edit achieves in 1-2 sentences',
        },
        scope: {
          type: 'string',
          enum: ['selection', 'section', 'document', 'multi-document'],
          description: 'The scope of the planned changes',
        },
        assumptions: {
          type: 'array',
          items: { type: 'string' },
          description:
            "Assumptions the plan is making about the writer's intent, project state, or creative direction",
        },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'What this step does',
              },
              targetBlockIds: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Block IDs this step will modify (from [block:ID] prefixes). Empty array if the step creates new content.',
              },
              estimatedImpact: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'How much this step changes the document',
              },
            },
            required: ['description', 'targetBlockIds', 'estimatedImpact'],
            additionalProperties: false,
          },
          description: 'Ordered list of edit steps to execute',
        },
        risks: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Potential risks or side effects of this edit (continuity breaks, tone shifts, etc.)',
        },
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'The question to ask before executing',
              },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    description: { type: 'string' },
                  },
                  required: ['label', 'description'],
                  additionalProperties: false,
                },
                description: '2-4 options for this question',
              },
            },
            required: ['text', 'options'],
            additionalProperties: false,
          },
          description: 'Up to 2 questions to resolve before executing (optional)',
        },
        acceptanceCriteria: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Specific, testable criteria that the final edit must satisfy. The verifier will check these.',
        },
      },
      required: [
        'goal',
        'scope',
        'assumptions',
        'steps',
        'risks',
        'questions',
        'acceptanceCriteria',
      ],
      additionalProperties: false,
    },
  },
}

export const REFLECT_UNDERSTANDING_TOOL = {
  type: 'function' as const,
  function: {
    name: 'reflect_understanding',
    description:
      "Reflect on your understanding of the writer's intent BEFORE planning or editing. Use this when the request is complex, ambiguous, or could be interpreted multiple ways. Do NOT use this for simple clear requests (e.g. \"fix the typo\", \"add a period\"). After reflecting, the writer will confirm, correct, or ask questions before you proceed.",
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        interpretation: {
          type: 'string',
          description:
            'Your interpretation of what the writer wants, starting with "I understand you want to..." — be specific about the creative intent, not just the mechanical action.',
        },
        diagnosis: {
          type: 'string',
          description:
            'The underlying issue or opportunity you see. What is the deeper creative problem or goal behind the request?',
        },
        route: {
          type: 'string',
          enum: ['respond', 'execute_now', 'ask_align', 'plan'],
          description:
            'Recommended next step: "respond" if the writer asked a question, wants feedback, or wants discussion (NO edits), "execute_now" if confidence is high and edit is straightforward, "ask_align" if you need alignment questions answered first, "plan" if the change is complex enough for a structured plan.',
        },
        confidence: {
          type: 'number',
          description:
            'How confident you are in your interpretation, 0 to 1. Above 0.8 = very sure. Below 0.5 = genuinely ambiguous.',
        },
        proposedScope: {
          type: 'string',
          enum: ['selection', 'section', 'document', 'multi-document'],
          description: 'The scope of changes you anticipate.',
        },
        meaningQuestions: {
          type: 'array',
          description:
            'At most 1 question about creative MEANING or intent. Empty array if none needed.',
          items: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'The question about creative meaning/intent.',
              },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    description: { type: 'string' },
                  },
                  required: ['label', 'description'],
                  additionalProperties: false,
                },
                description: '2-4 options for this question.',
              },
            },
            required: ['text', 'options'],
            additionalProperties: false,
          },
        },
        executionQuestions: {
          type: 'array',
          description:
            'At most 1 question about HOW to execute. Empty array if none needed.',
          items: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'The question about execution approach.',
              },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    description: { type: 'string' },
                  },
                  required: ['label', 'description'],
                  additionalProperties: false,
                },
                description: '2-4 options for this question.',
              },
            },
            required: ['text', 'options'],
            additionalProperties: false,
          },
        },
      },
      required: [
        'interpretation',
        'diagnosis',
        'route',
        'confidence',
        'proposedScope',
        'meaningQuestions',
        'executionQuestions',
      ],
      additionalProperties: false,
    },
  },
}

export const PROPOSE_IDEAS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'propose_ideas',
    description:
      'Propose 1-4 structured idea cards when brainstorming, exploring creative directions, or responding to open-ended questions about plot, mechanics, themes, or world-building. Each card is a self-contained creative spark with a provocative hook, core insight, expansion paths, and risks. Use this instead of writing paragraph-form idea lists. Quality over quantity — fewer, sharper ideas beat many vague ones.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        ideas: {
          type: 'array',
          description: '1-4 structured idea cards. Each must be distinct and substantive.',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Short, memorable title for the idea (3-8 words)',
              },
              hook: {
                type: 'string',
                description: 'Provocative 1-2 sentence framing that makes the reader lean in',
              },
              coreInsight: {
                type: 'string',
                description: 'What makes this idea genuinely interesting — the creative kernel',
              },
              whyItMatters: {
                type: 'string',
                description: 'How this impacts the project theme, gameplay, narrative, or structure',
              },
              expansionPaths: {
                type: 'array',
                description: '2-3 specific directions to deepen this idea',
                items: {
                  type: 'object',
                  properties: {
                    label: {
                      type: 'string',
                      description: 'Short label for this direction (3-6 words)',
                    },
                    description: {
                      type: 'string',
                      description: 'One sentence explaining what exploring this direction would involve',
                    },
                  },
                  required: ['label', 'description'],
                  additionalProperties: false,
                },
              },
              risks: {
                type: 'array',
                items: { type: 'string' },
                description: 'What could go wrong with this idea (1-3 risks)',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Category tags: pacing, lore, mechanics, character, tone, structure, theme, world-building, etc.',
              },
            },
            required: ['title', 'hook', 'coreInsight', 'whyItMatters', 'expansionPaths', 'risks', 'tags'],
            additionalProperties: false,
          },
        },
      },
      required: ['ideas'],
      additionalProperties: false,
    },
  },
}

// ===== JSON Schema for the patcher model (gpt-4o) response_format =====

/**
 * This is NOT a function tool — it's the schema enforced on the patcher model's
 * response via `response_format: { type: 'json_schema', json_schema: ... }`.
 * The patcher model MUST return a response matching this schema.
 */
export const PRODUCE_PATCH_SCHEMA = {
  name: 'patch_result',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      ops: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['insert', 'replace', 'delete'],
              description: 'The type of patch operation',
            },
            anchorBlockId: {
              type: 'string',
              description:
                'The blockId of the target block. For insert: the block to insert before/after. For replace/delete: the block being modified.',
            },
            insertPosition: {
              type: 'string',
              enum: ['before', 'after', 'replace'],
              description:
                'Where to place content relative to the anchor block. "replace" for replace/delete ops, "before"/"after" for insert ops.',
            },
            content: {
              type: ['string', 'null'],
              description:
                'The new text content. Required for insert and replace ops. Use double newlines between paragraphs. Null for delete ops.',
            },
            screenplayElements: {
              type: ['array', 'null'],
              description:
                'For screenplay projects: structured elements instead of plain text. Null for prose projects.',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: [
                      'scene-heading',
                      'action',
                      'character',
                      'dialogue',
                      'parenthetical',
                      'transition',
                      'shot',
                    ],
                  },
                  text: { type: 'string' },
                },
                required: ['type', 'text'],
                additionalProperties: false,
              },
            },
            why: {
              type: 'string',
              description:
                'Brief explanation of why this specific operation is needed',
            },
            sourceSpanIds: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Span IDs from the working set that this operation is based on. At least one required. Format: "documentId:blockId"',
            },
          },
          required: ['type', 'anchorBlockId', 'insertPosition', 'content', 'screenplayElements', 'why', 'sourceSpanIds'],
          additionalProperties: false,
        },
      },
    },
    required: ['ops'],
    additionalProperties: false,
  },
}

// ===== Patcher system prompt =====

export const PATCHER_SYSTEM_PROMPT = `You are a precise document patcher. Given an edit plan and a working set of document blocks, produce a list of patch operations.

WORKING SET MODEL:
- You receive a curated working set of document blocks, each labeled with a span ID: [span:documentId:blockId]
- The working set contains both context blocks (read-only reference) and target blocks (the blocks you may modify).
- You may ONLY modify blocks listed in the TARGET BLOCKS section.
- Every patch operation MUST include "sourceSpanIds" — the span IDs of blocks you referenced when making the edit.

RULES:
1. Only modify blocks listed in the TARGET BLOCKS section.
2. Use the exact blockId from the span ID for each operation's anchorBlockId.
3. For replace ops: provide the complete replacement content.
4. For insert ops: provide the new content and specify whether to insert before or after the anchor block.
5. For delete ops: just reference the anchor block to delete.
6. Each operation must include a brief "why" explaining the change.
7. Each operation must include "sourceSpanIds" — cite the working set spans you relied on. At least one is required.
8. Use double newlines (\\n\\n) between paragraphs in content.
9. For screenplay projects, use screenplayElements instead of content.
10. Stay within the declared scope and constraints.
11. Be conservative — change as little as necessary to achieve the goal.
12. Do NOT invent content from blocks you haven't seen. Only use information from the working set.`

export const PATCHER_SCREENPLAY_ADDENDUM = `
SCREENPLAY FORMAT:
- scene-heading: "INT./EXT. LOCATION - TIME" in UPPERCASE
- action: Visual description, one beat per line, use @CHARACTER_NAME for references
- character: Character name in UPPERCASE (no @ prefix)
- dialogue: What the character says
- parenthetical: (brief acting direction) — lowercase, in parens
- transition: "CUT TO:", "FADE OUT:" in UPPERCASE
- shot: "CLOSE ON:", "ANGLE ON:" in UPPERCASE`
