import { useCallback, useMemo } from 'react'
import { clsx } from 'clsx'
import { 
  DismissRegular, 
  ArrowResetRegular, 
  DeleteRegular,
  ChevronDownRegular,
  HistoryRegular
} from '@fluentui/react-icons'
import { useProjectStore } from '../../../stores/projectStore'
import type { DocumentVersion } from '../../../types/project'
import type { JSONContent } from '@tiptap/core'

// Extract paragraphs from JSONContent as array of { type, text }
interface Paragraph {
  type: 'heading' | 'paragraph'
  level?: number
  text: string
}

function extractParagraphs(content: JSONContent): Paragraph[] {
  const paragraphs: Paragraph[] = []
  
  const extractNodeText = (node: JSONContent): string => {
    let text = ''
    if (node.type === 'text' && node.text) {
      text += node.text
    }
    if (node.content) {
      node.content.forEach(child => {
        text += extractNodeText(child)
      })
    }
    return text
  }
  
  const traverse = (node: JSONContent) => {
    if (node.type === 'heading') {
      paragraphs.push({
        type: 'heading',
        level: node.attrs?.level || 1,
        text: extractNodeText(node)
      })
    } else if (node.type === 'paragraph' || node.type === 'screenplayElement') {
      const text = extractNodeText(node)
      if (text) {
        paragraphs.push({
          type: 'paragraph',
          text
        })
      }
    } else if (node.content) {
      node.content.forEach(traverse)
    }
  }
  
  traverse(content)
  return paragraphs
}

// Simple word-level diff
interface DiffSegment {
  type: 'same' | 'added' | 'removed'
  text: string
}

function computeWordDiff(oldText: string, newText: string): DiffSegment[] {
  const oldWords = oldText.split(/(\s+)/)
  const newWords = newText.split(/(\s+)/)
  
  const segments: DiffSegment[] = []
  
  const m = oldWords.length
  const n = newWords.length
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }
  
  let i = m, j = n
  const result: DiffSegment[] = []
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ type: 'same', text: oldWords[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', text: newWords[j - 1] })
      j--
    } else {
      result.unshift({ type: 'removed', text: oldWords[i - 1] })
      i--
    }
  }
  
  for (const seg of result) {
    if (segments.length > 0 && segments[segments.length - 1].type === seg.type) {
      segments[segments.length - 1].text += seg.text
    } else {
      segments.push({ ...seg })
    }
  }
  
  return segments
}

interface ParagraphDiff {
  type: 'heading' | 'paragraph'
  level?: number
  segments: DiffSegment[]
  status: 'same' | 'modified' | 'added' | 'removed'
}

function computeParagraphDiff(oldParagraphs: Paragraph[], newParagraphs: Paragraph[]): ParagraphDiff[] {
  const result: ParagraphDiff[] = []
  
  let oldIdx = 0
  let newIdx = 0
  
  while (oldIdx < oldParagraphs.length || newIdx < newParagraphs.length) {
    const oldPara = oldParagraphs[oldIdx]
    const newPara = newParagraphs[newIdx]
    
    if (!oldPara && newPara) {
      result.push({
        type: newPara.type,
        level: newPara.level,
        segments: [{ type: 'added', text: newPara.text }],
        status: 'added'
      })
      newIdx++
    } else if (oldPara && !newPara) {
      result.push({
        type: oldPara.type,
        level: oldPara.level,
        segments: [{ type: 'removed', text: oldPara.text }],
        status: 'removed'
      })
      oldIdx++
    } else if (oldPara && newPara) {
      const similarity = computeSimilarity(oldPara.text, newPara.text)
      
      if (similarity > 0.5) {
        const segments = computeWordDiff(oldPara.text, newPara.text)
        const hasChanges = segments.some(s => s.type !== 'same')
        result.push({
          type: newPara.type,
          level: newPara.level,
          segments,
          status: hasChanges ? 'modified' : 'same'
        })
        oldIdx++
        newIdx++
      } else {
        const nextOldMatch = newParagraphs.slice(newIdx + 1).findIndex(p => computeSimilarity(oldPara.text, p.text) > 0.5)
        const nextNewMatch = oldParagraphs.slice(oldIdx + 1).findIndex(p => computeSimilarity(newPara.text, p.text) > 0.5)
        
        if (nextNewMatch !== -1 && (nextOldMatch === -1 || nextNewMatch <= nextOldMatch)) {
          result.push({
            type: oldPara.type,
            level: oldPara.level,
            segments: [{ type: 'removed', text: oldPara.text }],
            status: 'removed'
          })
          oldIdx++
        } else {
          result.push({
            type: newPara.type,
            level: newPara.level,
            segments: [{ type: 'added', text: newPara.text }],
            status: 'added'
          })
          newIdx++
        }
      }
    }
  }
  
  return result
}

function computeSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))
  
  if (wordsA.size === 0 && wordsB.size === 0) return 1
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  
  let intersection = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++
  }
  
  return intersection / (wordsA.size + wordsB.size - intersection)
}

function renderSegment(segment: DiffSegment, index: number) {
  if (segment.type === 'same') {
    return <span key={index}>{segment.text}</span>
  }
  if (segment.type === 'removed') {
    return (
      <span 
        key={index} 
        className="bg-red-500/30 text-red-300 line-through decoration-red-400"
      >
        {segment.text}
      </span>
    )
  }
  if (segment.type === 'added') {
    return (
      <span 
        key={index} 
        className="bg-green-500/30 text-green-300"
      >
        {segment.text}
      </span>
    )
  }
  return null
}

interface VersionHistoryPanelProps {
  versions: DocumentVersion[]
  selectedVersionId: string | null
  onClose: () => void
  useMonospaceFont?: boolean
}

export function VersionHistoryPanel({ versions, selectedVersionId, onClose, useMonospaceFont = false }: VersionHistoryPanelProps) {
  const { 
    setVersionHistoryMode, 
    restoreVersion, 
    deleteVersion,
    activeDocumentId,
    documents
  } = useProjectStore()
  
  const selectedVersion = useMemo(() => {
    return versions.find(v => v.id === selectedVersionId) || versions[0] || null
  }, [versions, selectedVersionId])
  
  const currentContent = activeDocumentId ? documents[activeDocumentId]?.content : null
  
  const paragraphDiffs = useMemo(() => {
    if (!selectedVersion?.content || !currentContent) return []
    
    const oldParagraphs = extractParagraphs(selectedVersion.content)
    const newParagraphs = extractParagraphs(currentContent)
    
    return computeParagraphDiff(oldParagraphs, newParagraphs)
  }, [selectedVersion?.content, currentContent])
  
  const handleVersionSelect = useCallback((versionId: string) => {
    setVersionHistoryMode(true, versionId)
  }, [setVersionHistoryMode])
  
  const handleRestore = useCallback(async () => {
    if (!activeDocumentId || !selectedVersion) return
    
    const confirmed = window.confirm(
      `Are you sure you want to restore this version from ${formatDate(selectedVersion.timestamp)}? This will replace the current document content.`
    )
    
    if (confirmed) {
      await restoreVersion(activeDocumentId, selectedVersion.id)
    }
  }, [activeDocumentId, selectedVersion, restoreVersion])
  
  const handleDelete = useCallback(async () => {
    if (!activeDocumentId || !selectedVersion) return
    
    const confirmed = window.confirm(
      `Are you sure you want to delete this version from ${formatDate(selectedVersion.timestamp)}? This action cannot be undone.`
    )
    
    if (confirmed) {
      await deleteVersion(activeDocumentId, selectedVersion.id)
    }
  }, [activeDocumentId, selectedVersion, deleteVersion])
  
  if (!selectedVersion) {
    return (
      <div className="flex-1 flex flex-col bg-ink-900 border-l border-ink-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-700">
          <h3 className="text-sm font-medium text-white">Version History</h3>
          <button
            onClick={onClose}
            className="p-1 text-ink-400 hover:text-white transition-colors"
            title="Close version history"
          >
            <DismissRegular className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-ink-400 text-sm">No versions saved yet</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex-1 flex flex-col bg-ink-900 border-l border-ink-700 min-w-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-700 bg-ink-800/50">
        <HistoryRegular className="w-5 h-5 text-gold-400" />
        <h3 className="text-sm font-medium text-white">Version History</h3>
        
        <div className="relative flex-1 max-w-[280px]">
          <select
            value={selectedVersion.id}
            onChange={(e) => handleVersionSelect(e.target.value)}
            className="w-full appearance-none bg-ink-700 border border-ink-600 rounded-md px-3 py-1.5 pr-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold-400/50"
          >
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {formatDate(version.timestamp)}
                {version.label && ` - ${version.label}`}
              </option>
            ))}
          </select>
          <ChevronDownRegular className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleRestore}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-400 bg-green-400/10 rounded-md hover:bg-green-400/20 transition-colors"
            title="Restore this version"
          >
            <ArrowResetRegular className="w-4 h-4" />
            Restore
          </button>
          
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
            title="Delete this version"
          >
            <DeleteRegular className="w-4 h-4" />
          </button>
          
          <button
            onClick={onClose}
            className="p-1.5 text-ink-400 hover:text-white transition-colors"
            title="Close version history"
          >
            <DismissRegular className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="px-4 py-2 border-b border-ink-700/50 bg-ink-800/30">
        <div className="flex items-center gap-4 text-xs text-ink-400">
          <span>{formatDate(selectedVersion.timestamp)}</span>
          <span>•</span>
          <span>{selectedVersion.wordCount.toLocaleString()} words</span>
          {selectedVersion.label && (
            <>
              <span>•</span>
              <span className="text-gold-400">{selectedVersion.label}</span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="py-8 px-6">
          <div 
            className="max-w-3xl mx-auto space-y-4"
            style={{ fontFamily: useMonospaceFont ? "'Courier New', Courier, monospace" : undefined }}
          >
            {paragraphDiffs.map((para, paraIndex) => {
              if (para.type === 'heading') {
                const HeadingTag = `h${para.level || 1}` as keyof JSX.IntrinsicElements
                return (
                  <HeadingTag 
                    key={paraIndex}
                    className={clsx(
                      "font-bold text-white",
                      para.level === 1 && "text-2xl",
                      para.level === 2 && "text-xl",
                      para.level === 3 && "text-lg"
                    )}
                  >
                    {para.segments.map((seg, segIndex) => renderSegment(seg, segIndex))}
                  </HeadingTag>
                )
              }
              
              return (
                <p key={paraIndex} className="text-white/90 leading-relaxed">
                  {para.segments.map((seg, segIndex) => renderSegment(seg, segIndex))}
                </p>
              )
            })}
            {paragraphDiffs.length === 0 && (
              <p className="text-ink-400 italic">No differences found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) {
    return 'Just now'
  }
  
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000)
    return `${mins} minute${mins === 1 ? '' : 's'} ago`
  }
  
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return `${days} day${days === 1 ? '' : 's'} ago`
  }
  
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
