import { useProjectStore } from '../../stores/projectStore'
import { clsx } from 'clsx'
import {
  ChevronDownRegular,
  ChatAddRegular,
  DeleteRegular,
  ChatRegular
} from '@fluentui/react-icons'

const FONT_FAMILY = 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif'

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(isoString).toLocaleDateString()
}

export function ConversationSelector() {
  const {
    thoughtPartner,
    switchThoughtPartnerConversation,
    createThoughtPartnerConversation,
    deleteThoughtPartnerConversation,
    toggleThoughtPartnerConversationList
  } = useProjectStore()

  const activeConv = thoughtPartner.conversationIndex.find(
    c => c.id === thoughtPartner.activeConversationId
  )

  const hasMultipleConversations = thoughtPartner.conversationIndex.length > 1

  return (
    <div className="border-b border-theme-subtle" style={{ fontFamily: FONT_FAMILY }}>
      {/* Active conversation row */}
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={toggleThoughtPartnerConversationList}
          className="flex items-center gap-1.5 min-w-0 flex-1 group"
        >
          <ChatRegular className="w-3.5 h-3.5 text-theme-muted flex-shrink-0" />
          <span className="text-[11px] text-theme-secondary truncate group-hover:text-theme-primary transition-colors">
            {activeConv?.title || 'New Conversation'}
          </span>
          {hasMultipleConversations && (
            <ChevronDownRegular
              className={clsx(
                'w-3.5 h-3.5 text-theme-muted flex-shrink-0 transition-transform',
                thoughtPartner.isConversationListOpen && 'rotate-180'
              )}
            />
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); createThoughtPartnerConversation() }}
          className="btn-icon-modern p-1 flex-shrink-0"
          title="New conversation"
        >
          <ChatAddRegular className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded conversation list */}
      {thoughtPartner.isConversationListOpen && thoughtPartner.conversationIndex.length > 0 && (
        <div className="max-h-[200px] overflow-y-auto border-t border-theme-subtle">
          {thoughtPartner.conversationIndex.map(conv => (
            <div
              key={conv.id}
              onClick={() => switchThoughtPartnerConversation(conv.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors group',
                conv.id === thoughtPartner.activeConversationId
                  ? 'bg-theme-active'
                  : 'hover:bg-theme-hover'
              )}
            >
              <ChatRegular className="w-3.5 h-3.5 text-theme-muted flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-theme-primary truncate">
                  {conv.title}
                </div>
                <div className="text-[10px] text-theme-muted">
                  {formatRelativeTime(conv.updatedAt)}
                  {conv.messageCount > 0 && ` · ${conv.messageCount} msgs`}
                </div>
              </div>
              {thoughtPartner.conversationIndex.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteThoughtPartnerConversation(conv.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/15 text-theme-muted hover:text-red-400 transition-all flex-shrink-0"
                  title="Delete conversation"
                >
                  <DeleteRegular className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
