// FeedbackLogger — Append-only structured feedback logging for behavior policy
// Writes JSONL to .cadmus/thought-partner/feedback/

import * as fs from 'fs'
import * as path from 'path'
import type {
  FeedbackEntry,
  InteractionContext,
  BehaviorDimension,
} from '../../shared/behaviorPolicyTypes'

const FEEDBACK_DIR = 'feedback'
const THOUGHT_PARTNER_DIR = '.cadmus/thought-partner'
const MAX_LOG_AGE_DAYS = 90

export class FeedbackLogger {
  private ensureFeedbackDir(projectPath: string): string {
    const dir = path.join(projectPath, THOUGHT_PARTNER_DIR, FEEDBACK_DIR)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  private dailyLogPath(projectPath: string): string {
    const dir = this.ensureFeedbackDir(projectPath)
    const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    return path.join(dir, `feedback-${date}.jsonl`)
  }

  logFeedback(projectPath: string, entry: FeedbackEntry): void {
    try {
      const logPath = this.dailyLogPath(projectPath)
      const line = JSON.stringify(entry) + '\n'
      fs.appendFileSync(logPath, line, 'utf-8')
      this.updateSummary(projectPath, entry)
    } catch (err) {
      console.error('[FeedbackLogger] Failed to log feedback:', err)
    }
  }

  loadRecentFeedback(projectPath: string, limit: number = 50): FeedbackEntry[] {
    try {
      const dir = this.ensureFeedbackDir(projectPath)
      const files = fs.readdirSync(dir)
        .filter(f => f.startsWith('feedback-') && f.endsWith('.jsonl'))
        .sort()
        .reverse()

      const entries: FeedbackEntry[] = []
      for (const file of files) {
        if (entries.length >= limit) break
        const content = fs.readFileSync(path.join(dir, file), 'utf-8')
        const lines = content.trim().split('\n').filter(Boolean).reverse()
        for (const line of lines) {
          if (entries.length >= limit) break
          try {
            entries.push(JSON.parse(line))
          } catch { /* skip malformed lines */ }
        }
      }
      return entries
    } catch {
      return []
    }
  }

  getFeedbackSummary(projectPath: string): {
    totalThumbsUp: number
    totalThumbsDown: number
    recentEntries: FeedbackEntry[]
  } {
    try {
      const dir = this.ensureFeedbackDir(projectPath)
      const summaryPath = path.join(dir, 'feedback-summary.json')
      let summary = { totalThumbsUp: 0, totalThumbsDown: 0 }
      if (fs.existsSync(summaryPath)) {
        summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))
      }
      const recentEntries = this.loadRecentFeedback(projectPath, 10)
      return { ...summary, recentEntries }
    } catch {
      return { totalThumbsUp: 0, totalThumbsDown: 0, recentEntries: [] }
    }
  }

  private updateSummary(projectPath: string, entry: FeedbackEntry): void {
    try {
      const dir = this.ensureFeedbackDir(projectPath)
      const summaryPath = path.join(dir, 'feedback-summary.json')
      let summary = { totalThumbsUp: 0, totalThumbsDown: 0 }
      if (fs.existsSync(summaryPath)) {
        summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))
      }
      if (entry.signal === 'thumbs_up') summary.totalThumbsUp++
      else summary.totalThumbsDown++
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8')
    } catch (err) {
      console.error('[FeedbackLogger] Failed to update summary:', err)
    }
  }

  rotateOldLogs(projectPath: string): void {
    try {
      const dir = this.ensureFeedbackDir(projectPath)
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - MAX_LOG_AGE_DAYS)
      const cutoffStr = cutoff.toISOString().slice(0, 10)

      const files = fs.readdirSync(dir)
        .filter(f => f.startsWith('feedback-') && f.endsWith('.jsonl'))
      for (const file of files) {
        const dateMatch = file.match(/feedback-(\d{4}-\d{2}-\d{2})\.jsonl/)
        if (dateMatch && dateMatch[1] < cutoffStr) {
          fs.unlinkSync(path.join(dir, file))
          console.log(`[FeedbackLogger] Rotated old log: ${file}`)
        }
      }
    } catch (err) {
      console.error('[FeedbackLogger] Failed to rotate logs:', err)
    }
  }

  /**
   * Heuristic analysis of which behavior dimensions a response expressed.
   * Returns a partial map of dimension → intensity (0..1).
   */
  static analyzeResponseDimensions(
    responseText: string,
    userMessageLength: number,
    context: InteractionContext
  ): Partial<Record<BehaviorDimension, number>> {
    const dims: Partial<Record<BehaviorDimension, number>> = {}

    // --- Verbosity: ratio of response length to user message length ---
    const responseLen = responseText.length
    if (userMessageLength > 0) {
      const ratio = responseLen / userMessageLength
      if (ratio > 3) dims.verbosity = Math.min(1, 0.5 + (ratio - 3) * 0.1)
      else if (ratio < 0.5) dims.verbosity = Math.max(0, 0.5 - (0.5 - ratio) * 0.5)
      else dims.verbosity = 0.3 + (ratio / 6) * 0.4
    } else {
      dims.verbosity = responseLen > 500 ? 0.8 : responseLen > 200 ? 0.5 : 0.2
    }

    // --- Structural style: presence of lists, headings, bullets ---
    const hasBullets = /^[\s]*[-•*]\s/m.test(responseText)
    const hasNumberedList = /^[\s]*\d+\.\s/m.test(responseText)
    const hasHeadings = /^#{1,4}\s/m.test(responseText)
    const structuralScore = (hasBullets ? 0.3 : 0) + (hasNumberedList ? 0.3 : 0) + (hasHeadings ? 0.4 : 0)
    dims.structuralStyle = Math.min(1, structuralScore)

    // --- Tone: lexical signals ---
    const formalWords = ['therefore', 'consequently', 'regarding', 'furthermore', 'nevertheless', 'accordingly', 'subsequently']
    const casualWords = ['yeah', 'cool', "let's", 'hey', 'gonna', 'wanna', 'kinda', 'btw', 'fyi']
    const lowerText = responseText.toLowerCase()
    const formalCount = formalWords.filter(w => lowerText.includes(w)).length
    const casualCount = casualWords.filter(w => lowerText.includes(w)).length
    const hasContractions = /\b\w+'(t|re|ve|ll|d|s)\b/i.test(responseText)
    const toneScore = 0.5 + (formalCount * 0.1) - (casualCount * 0.1) - (hasContractions ? 0.1 : 0)
    dims.tone = Math.max(0, Math.min(1, toneScore))

    // --- Initiative: proactive suggestions ---
    const proactivePatterns = [
      /you might also/i, /have you considered/i, /i noticed/i,
      /another approach/i, /you could also/i, /it might be worth/i,
      /one thing to consider/i, /a suggestion/i, /additionally/i,
    ]
    const proactiveCount = proactivePatterns.filter(p => p.test(responseText)).length
    dims.initiative = Math.min(1, 0.2 + proactiveCount * 0.2)

    // --- Tool usage: from context flags ---
    if (context.hasActions || context.hasPlan) {
      dims.toolUsage = 0.9
    } else if (context.hasReflection) {
      dims.toolUsage = 0.5
    } else {
      dims.toolUsage = 0.1
    }

    // --- Clarification frequency: from context ---
    if (context.hasQuestions) {
      dims.clarificationFreq = 0.8
    } else if (context.hasReflection) {
      dims.clarificationFreq = 0.6
    } else {
      dims.clarificationFreq = 0.1
    }

    // --- Autonomy: acted without asking first ---
    if (context.hasActions && !context.hasQuestions && !context.hasReflection) {
      dims.autonomy = 0.8
    } else if (context.hasActions && context.hasReflection) {
      dims.autonomy = 0.4
    } else {
      dims.autonomy = 0.2
    }

    // --- Risk tolerance: bold language ---
    const boldPatterns = [
      /radical/i, /unconventional/i, /what if we completely/i,
      /bold/i, /experimental/i, /break the rules/i, /push the boundaries/i,
    ]
    const safePatterns = [
      /perhaps/i, /you might consider/i, /a small adjustment/i,
      /conservative/i, /safe/i, /careful/i,
    ]
    const boldCount = boldPatterns.filter(p => p.test(responseText)).length
    const safeCount = safePatterns.filter(p => p.test(responseText)).length
    dims.riskTolerance = Math.max(0, Math.min(1, 0.4 + boldCount * 0.15 - safeCount * 0.1))

    return dims
  }
}

// Singleton
let feedbackLoggerInstance: FeedbackLogger | null = null
export function getFeedbackLogger(): FeedbackLogger {
  if (!feedbackLoggerInstance) {
    feedbackLoggerInstance = new FeedbackLogger()
  }
  return feedbackLoggerInstance
}
