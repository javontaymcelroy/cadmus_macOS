import { clsx } from 'clsx'
import {
  HatGraduationSparkleRegular,
  PersonRegular,
  EditRegular,
  ArrowSyncRegular,
  ThumbLikeRegular,
  ThumbLikeFilled,
  ThumbDislikeRegular,
  ThumbDislikeFilled,
} from '@fluentui/react-icons'
import type { FeedbackSignal } from '../../../shared/behaviorPolicyTypes'

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  isStreaming?: boolean
  textSize?: number
  messageId?: string
  feedback?: FeedbackSignal | null
  onEdit?: () => void
  onRegenerate?: () => void
  onThumbsUp?: () => void
  onThumbsDown?: () => void
}

const FONT_FAMILY = 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif'

export function MessageBubble({ role, content, isStreaming, textSize = 13, messageId: _messageId, feedback, onEdit, onRegenerate, onThumbsUp, onThumbsDown }: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className="group/msg">
      <div className={clsx('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
        {/* Avatar */}
        <div
          className={clsx(
            'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
            isUser
              ? 'bg-[var(--accent-gold-muted)] text-[var(--accent-gold)]'
              : 'bg-[var(--accent-gold-muted)] text-[var(--accent-gold)]'
          )}
        >
          {isUser ? (
            <PersonRegular className="w-3.5 h-3.5" />
          ) : (
            <HatGraduationSparkleRegular className="w-3.5 h-3.5" />
          )}
        </div>

        {/* Message content */}
        <div
          className={clsx(
            'max-w-[85%] px-3 py-2 rounded-xl leading-relaxed',
            isUser
              ? 'bg-[var(--accent-gold-muted)] text-theme-primary rounded-tr-sm'
              : 'bg-theme-elevated text-theme-primary rounded-tl-sm'
          )}
          style={{ fontSize: textSize, fontFamily: FONT_FAMILY }}
        >
          <div className="whitespace-pre-wrap break-words">
            {content}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-[var(--accent-gold)] ml-0.5 animate-pulse rounded-sm" />
            )}
          </div>
        </div>

        {/* Edit button for user messages */}
        {isUser && onEdit && !isStreaming && (
          <button
            onClick={onEdit}
            className="self-center opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded hover:bg-theme-elevated text-theme-secondary hover:text-theme-primary"
            title="Edit message"
          >
            <EditRegular className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Assistant message actions: regenerate + thumbs feedback */}
      {!isUser && !isStreaming && (onRegenerate || onThumbsUp || onThumbsDown) && (
        <div className={clsx(
          'ml-8 mt-1 flex items-center gap-1',
          // Always show if feedback is given, otherwise show on hover
          feedback ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100',
          'transition-opacity'
        )}>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-theme-secondary hover:text-theme-primary hover:bg-theme-elevated transition-colors"
              style={{ fontSize: textSize - 1 }}
            >
              <ArrowSyncRegular className="w-3 h-3" />
              <span>Regenerate</span>
            </button>
          )}
          {(onThumbsUp || onThumbsDown) && (
            <>
              {onRegenerate && <span className="text-theme-muted mx-0.5">|</span>}
              {onThumbsUp && (
                <button
                  onClick={onThumbsUp}
                  className={clsx(
                    'p-1 rounded transition-colors',
                    feedback === 'thumbs_up'
                      ? 'text-emerald-400'
                      : 'text-theme-secondary hover:text-emerald-400 hover:bg-theme-elevated'
                  )}
                  title="Good response"
                >
                  {feedback === 'thumbs_up'
                    ? <ThumbLikeFilled className="w-3.5 h-3.5" />
                    : <ThumbLikeRegular className="w-3.5 h-3.5" />
                  }
                </button>
              )}
              {onThumbsDown && (
                <button
                  onClick={onThumbsDown}
                  className={clsx(
                    'p-1 rounded transition-colors',
                    feedback === 'thumbs_down'
                      ? 'text-red-400'
                      : 'text-theme-secondary hover:text-red-400 hover:bg-theme-elevated'
                  )}
                  title="Poor response"
                >
                  {feedback === 'thumbs_down'
                    ? <ThumbDislikeFilled className="w-3.5 h-3.5" />
                    : <ThumbDislikeRegular className="w-3.5 h-3.5" />
                  }
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
