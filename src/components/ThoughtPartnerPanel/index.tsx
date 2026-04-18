import { useCallback, useEffect, useRef, useState } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { clsx } from 'clsx'
import {
  HatGraduationSparkleRegular,
  SendRegular,
  StopRegular,
  SparkleRegular,
  TextFontSizeRegular,
  AddCircleRegular,
  SubtractCircleRegular,
  BotSparkleFilled,
  FlashCheckmarkRegular,
  DismissRegular,
  EditRegular,
  CursorClickRegular,
  CursorClickFilled,
} from '@fluentui/react-icons'
import { MessageBubble } from './MessageBubble'
import { SuggestionCard } from './SuggestionCard'
import { ContextChip } from './ContextChip'
import { SelectionContextChip } from './SelectionContextChip'
import { ReferenceDocumentChip } from './ReferenceDocumentChip'
import { CursorContextChip } from './CursorContextChip'
import { ContextDocumentView } from './ContextDocumentView'
import { ConversationSelector } from './ConversationSelector'
import { ActionCard } from './ActionCard'
import { QuestionCard } from './QuestionCard'
import { PlanCard } from './PlanCard'
import { ReflectionCard } from './ReflectionCard'
import { IdeaCardsGroup } from './IdeaCard'

export function ThoughtPartnerPanel() {
  const {
    thoughtPartner,
    activeDocumentId,
    currentProject,
    ui,
    sendThoughtPartnerMessage,
    editThoughtPartnerMessage,
    regenerateThoughtPartnerResponse,
    stopThoughtPartnerStreaming,
    appendThoughtPartnerStreamChunk,
    setThoughtPartnerTextSize,
    acceptThoughtPartnerAction,
    rejectThoughtPartnerAction,
    toggleThoughtPartnerAgentMode,
    toggleThoughtPartnerAutoAccept,
    answerThoughtPartnerQuestion,
    skipThoughtPartnerQuestion,
    clearThoughtPartnerSelectionContext,
    addThoughtPartnerReference,
    removeThoughtPartnerReference,
    setPipelineState,
    acceptPipelineAction,
    rejectPipelineAction,
    approvePlan,
    revisePlan,
    rejectPlan,
    acceptReflection,
    editReflection,
    answerReflectionQuestions,
    exploreIdea,
    stressTestIdea,
    turnIdeaInto,
    mergeIdeas,
    discardIdea,
    submitMessageFeedback,
    toggleUseCursorContext,
    setCursorContextRadius,
  } = useProjectStore()

  const [inputText, setInputText] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [excludeConscious, setExcludeConscious] = useState(false)
  const [showTextSizeControl, setShowTextSizeControl] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const textSize = ui.thoughtPartnerTextSize

  // Get active document title for the context chip
  const activeDoc = activeDocumentId
    ? currentProject?.documents.find(d => d.id === activeDocumentId)
    : null

  // Set up streaming chunk listener
  useEffect(() => {
    const unsubChunk = window.api.thoughtPartner?.onChunk((chunk: string) => {
      appendThoughtPartnerStreamChunk(chunk)
    })
    return () => { unsubChunk?.() }
  }, [appendThoughtPartnerStreamChunk])

  // Set up pipeline state listener
  useEffect(() => {
    const unsubPipeline = (window.api as any).thoughtPartner?.onPipelineState?.((state: string) => {
      setPipelineState(state)
    })
    return () => { unsubPipeline?.() }
  }, [setPipelineState])

  // Auto-scroll to bottom when messages change or streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thoughtPartner.messages, thoughtPartner.streamingContent])

  // All project documents for @mention popover
  const allDocuments = currentProject?.documents.filter(d => d.type === 'document') ?? []
  const mentionResults = mentionQuery !== null
    ? allDocuments.filter(d =>
        d.id !== activeDocumentId &&
        !thoughtPartner.referencedDocuments.some(r => r.id === d.id) &&
        d.title.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 6)
    : []

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputText(value)

    // Detect @mention: look for @ followed by non-space text at cursor
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = value.slice(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionIndex(0)
    } else {
      setMentionQuery(null)
    }
  }, [])

  const selectMention = useCallback((doc: { id: string; title: string }) => {
    // Replace @query with empty string and add as reference
    const cursorPos = textareaRef.current?.selectionStart ?? inputText.length
    const textBeforeCursor = inputText.slice(0, cursorPos)
    const atIdx = textBeforeCursor.lastIndexOf('@')
    if (atIdx >= 0) {
      const newText = inputText.slice(0, atIdx) + inputText.slice(cursorPos)
      setInputText(newText)
    }
    addThoughtPartnerReference({ id: doc.id, title: doc.title })
    setMentionQuery(null)
    textareaRef.current?.focus()
  }, [inputText, addThoughtPartnerReference])

  const handleSend = useCallback(() => {
    const text = inputText.trim()
    if (!text || thoughtPartner.isStreaming) return
    setInputText('')
    setMentionQuery(null)
    if (editingMessageId) {
      editThoughtPartnerMessage(editingMessageId, text)
      setEditingMessageId(null)
    } else {
      sendThoughtPartnerMessage(text)
    }
  }, [inputText, thoughtPartner.isStreaming, editingMessageId, sendThoughtPartnerMessage, editThoughtPartnerMessage])

  const handleEditMessage = useCallback((msgId: string, content: string) => {
    setEditingMessageId(msgId)
    setInputText(content)
    textareaRef.current?.focus()
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null)
    setInputText('')
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex(i => Math.min(i + 1, mentionResults.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectMention(mentionResults[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend, mentionQuery, mentionResults, mentionIndex, selectMention])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
    const data = e.dataTransfer.getData('application/cadmus-docref')
    if (!data) return
    try {
      const doc = JSON.parse(data) as { id: string; title: string }
      if (doc.id === activeDocumentId) return // already in conscious context
      addThoughtPartnerReference({ id: doc.id, title: doc.title })
    } catch { /* ignore malformed data */ }
  }, [activeDocumentId, addThoughtPartnerReference])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/cadmus-docref')) {
      e.preventDefault()
      setIsDraggingOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only reset if leaving the container (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false)
    }
  }, [])

  const handleSuggestionClick = useCallback((prompt: string) => {
    sendThoughtPartnerMessage(prompt)
  }, [sendThoughtPartnerMessage])

  const hasMessages = thoughtPartner.messages.length > 0
  const showSuggestions = !hasMessages && !thoughtPartner.isStreaming

  // Find the last assistant message for regenerate button
  let lastAssistantMsgId: string | null = null
  for (let i = thoughtPartner.messages.length - 1; i >= 0; i--) {
    if (thoughtPartner.messages[i].role === 'assistant') {
      lastAssistantMsgId = thoughtPartner.messages[i].id
      break
    }
  }

  return (
    <div className="flex flex-col h-full bg-theme-panel" style={{ fontFamily: 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme-subtle bg-theme-header">
        <div className="flex items-center gap-2">
          <HatGraduationSparkleRegular className="w-4.5 h-4.5 text-[var(--accent-gold)]" />
          <h2 className="text-xs font-ui font-medium uppercase tracking-wider text-theme-muted">
            Thought Partner
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {/* Text size toggle */}
          <button
            onClick={() => setShowTextSizeControl(!showTextSizeControl)}
            className={clsx('btn-icon-modern p-1', showTextSizeControl && 'active')}
            title="Text size"
          >
            <TextFontSizeRegular className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Text size control bar */}
      {showTextSizeControl && (
        <div className="flex items-center justify-center gap-3 px-4 py-2 border-b border-theme-subtle bg-theme-secondary">
          <button
            onClick={() => setThoughtPartnerTextSize(textSize - 1)}
            disabled={textSize <= 12}
            className={clsx(
              'p-1 rounded transition-colors',
              textSize <= 12 ? 'text-theme-muted cursor-not-allowed' : 'text-theme-secondary hover:bg-theme-active hover:text-theme-primary'
            )}
            title="Decrease text size"
          >
            <SubtractCircleRegular className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-theme-secondary min-w-[32px] text-center tabular-nums"
                style={{ fontFamily: 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif' }}>
            {textSize}px
          </span>
          <button
            onClick={() => setThoughtPartnerTextSize(textSize + 1)}
            disabled={textSize >= 20}
            className={clsx(
              'p-1 rounded transition-colors',
              textSize >= 20 ? 'text-theme-muted cursor-not-allowed' : 'text-theme-secondary hover:bg-theme-active hover:text-theme-primary'
            )}
            title="Increase text size"
          >
            <AddCircleRegular className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Conversation Selector */}
      <ConversationSelector />

      {/* Context Document Drawer */}
      <ContextDocumentView contextDocument={thoughtPartner.contextDocument} />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {/* Empty state / Suggestions */}
        {showSuggestions && (
          <div className="flex flex-col items-center py-6 px-2">
            <div className="w-10 h-10 rounded-full bg-[var(--accent-gold-muted)] flex items-center justify-center mb-3">
              <HatGraduationSparkleRegular className="w-5 h-5 text-[var(--accent-gold)]" />
            </div>
            <p className="text-theme-muted text-center mb-4 max-w-[240px]"
               style={{ fontSize: textSize - 1, fontFamily: 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif' }}>
              I'm your thought partner. Let's think through your project together.
            </p>

            {/* Suggestion Cards */}
            {thoughtPartner.isLoadingSuggestions ? (
              <div className="flex items-center gap-2 text-theme-muted"
                   style={{ fontSize: textSize - 2, fontFamily: 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif' }}>
                <SparkleRegular className="w-3.5 h-3.5 animate-pulse text-[var(--accent-gold)]" />
                Analyzing your project...
              </div>
            ) : thoughtPartner.suggestions.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 w-full">
                {thoughtPartner.suggestions.map(suggestion => (
                  <SuggestionCard
                    key={suggestion.id}
                    title={suggestion.title}
                    description={suggestion.description}
                    category={suggestion.category}
                    onClick={() => handleSuggestionClick(suggestion.prompt)}
                    textSize={textSize}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* Chat Messages */}
        {thoughtPartner.messages.map(msg => (
          <div key={msg.id} className="space-y-2">
            <MessageBubble
              role={msg.role as 'user' | 'assistant'}
              content={msg.content}
              textSize={textSize}
              messageId={msg.id}
              feedback={thoughtPartner.messageFeedback?.[msg.id] || null}
              onEdit={msg.role === 'user' && !thoughtPartner.isStreaming ? () => handleEditMessage(msg.id, msg.content) : undefined}
              onRegenerate={msg.id === lastAssistantMsgId && !thoughtPartner.isStreaming ? () => regenerateThoughtPartnerResponse() : undefined}
              onThumbsUp={msg.role === 'assistant' && !thoughtPartner.isStreaming ? () => submitMessageFeedback(msg.id, 'thumbs_up') : undefined}
              onThumbsDown={msg.role === 'assistant' && !thoughtPartner.isStreaming ? () => submitMessageFeedback(msg.id, 'thumbs_down') : undefined}
            />
            {/* Action cards for this message */}
            {msg.role === 'assistant' && (msg as any).actions?.length > 0 && (
              <div className="ml-8 space-y-1.5">
                {(msg as any).actions.map((action: any) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    onAccept={() => acceptThoughtPartnerAction(action.id)}
                    onReject={() => rejectThoughtPartnerAction(action.id)}
                    textSize={textSize}
                  />
                ))}
              </div>
            )}
            {/* Question cards for this message */}
            {msg.role === 'assistant' && (msg as any).questions?.length > 0 && (
              <div className="ml-8 space-y-1.5">
                {(msg as any).questions.map((question: any) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    onSelectOption={(qId, optId) => answerThoughtPartnerQuestion(qId, optId)}
                    onSubmitCustom={(qId, text) => answerThoughtPartnerQuestion(qId, undefined, text)}
                    onSkip={(qId) => skipThoughtPartnerQuestion(qId)}
                    textSize={textSize}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Streaming message — strip action block syntax from display */}
        {thoughtPartner.isStreaming && thoughtPartner.streamingContent && (
          <MessageBubble
            role="assistant"
            content={thoughtPartner.streamingContent.replace(/```(?:action:|context-update|question)[\s\S]*$/m, '').trim()}
            isStreaming
            textSize={textSize}
          />
        )}

        {/* Streaming placeholder (no content yet) */}
        {thoughtPartner.isStreaming && !thoughtPartner.streamingContent && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-[var(--accent-gold-muted)] flex items-center justify-center flex-shrink-0">
              <HatGraduationSparkleRegular className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
            </div>
            <div className="px-3 py-2 rounded-xl rounded-tl-sm bg-theme-elevated">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-gold)] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-gold)] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-gold)] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Pipeline status bar */}
        {thoughtPartner.pipelineState !== 'idle' && thoughtPartner.pipelineState !== 'completed' && thoughtPartner.pipelineState !== 'failed' && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-theme-elevated text-xs text-theme-secondary">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-gold)] animate-pulse" />
            <span>
              {thoughtPartner.pipelineState === 'orchestrating' && 'Thinking...'}
              {thoughtPartner.pipelineState === 'reflecting' && 'Understanding your intent...'}
              {thoughtPartner.pipelineState === 'planning' && 'Reviewing plan...'}
              {thoughtPartner.pipelineState === 'reading' && 'Reading document blocks...'}
              {thoughtPartner.pipelineState === 'patching' && 'Generating patch...'}
              {thoughtPartner.pipelineState === 'verifying' && 'Verifying changes...'}
              {thoughtPartner.pipelineState === 'repairing' && 'Repairing patch...'}
              {thoughtPartner.pipelineState === 'awaiting_approval' && 'Ready for review'}
              {thoughtPartner.pipelineState === 'applying' && 'Applying changes...'}
            </span>
          </div>
        )}

        {/* Pipeline actions */}
        {thoughtPartner.currentPipelineActions.map(action => (
          <div key={action.id} className="px-2">
            {action.type === 'reflection' && action.reflection ? (
              <ReflectionCard
                action={action}
                onAccept={(reflectionId) => acceptReflection(reflectionId)}
                onEdit={(reflectionId, newInterpretation) => editReflection(reflectionId, newInterpretation)}
                onAnswer={(reflectionId, meaningAnswers, executionAnswers) =>
                  answerReflectionQuestions(reflectionId, meaningAnswers, executionAnswers)
                }
                textSize={textSize}
              />
            ) : action.type === 'plan' && action.structuredPlan ? (
              <PlanCard
                action={action}
                onApprove={(planId) => approvePlan(planId)}
                onRevise={(planId, feedback) => revisePlan(planId, feedback)}
                onReject={(planId) => rejectPlan(planId)}
                textSize={textSize}
              />
            ) : action.type === 'idea' && action.ideaCards ? (
              <IdeaCardsGroup
                action={action}
                onExplore={(ideaCardId, expansionPathId) => exploreIdea(ideaCardId, expansionPathId)}
                onStressTest={(ideaCardId) => stressTestIdea(ideaCardId)}
                onTurnInto={(ideaCardId, targetType) => turnIdeaInto(ideaCardId, targetType)}
                onMerge={(ideaCardIdA, ideaCardIdB) => mergeIdeas(ideaCardIdA, ideaCardIdB)}
                onDiscard={(ideaCardId) => discardIdea(ideaCardId)}
                otherPendingIdeaCards={
                  thoughtPartner.currentPipelineActions
                    .filter(a => a.type === 'idea' && a.id !== action.id)
                    .flatMap(a => a.ideaCards || [])
                    .filter(ic => ic.status === 'pending')
                }
                textSize={textSize}
              />
            ) : (
              <div className="rounded-lg border border-theme-subtle bg-theme-elevated p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-theme-primary">{action.description}</span>
                  {action.verifyResult?.status === 'pass' && (
                    <span className="text-xs text-green-500 flex items-center gap-1">
                      <FlashCheckmarkRegular className="w-3 h-3" /> Verified
                    </span>
                  )}
                  {action.verifyResult?.status === 'fail' && (
                    <span className="text-xs text-yellow-500">Needs review</span>
                  )}
                </div>

                {/* Show patch ops with "why" */}
                {action.patchList?.ops.map((op, i) => (
                  <div key={op.id || i} className="text-xs space-y-1 border-t border-theme-subtle pt-1.5 mt-1.5">
                    <div className="text-theme-secondary italic">{op.why}</div>
                    {op.anchor?.textSnapshot && op.type === 'replace' && (
                      <div className="bg-red-500/20 border border-red-500/30 rounded px-2 py-1 line-through text-red-400/70">
                        {op.anchor.textSnapshot.slice(0, 100)}{op.anchor.textSnapshot.length > 100 ? '...' : ''}
                      </div>
                    )}
                    {op.content && (
                      <div className="bg-green-500/20 border border-green-500/30 rounded px-2 py-1 text-theme-primary">
                        {op.content.slice(0, 200)}{op.content.length > 200 ? '...' : ''}
                      </div>
                    )}
                  </div>
                ))}

                {/* Accept/Reject buttons */}
                {(action.status === 'pending' || action.status === 'verified') && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => acceptPipelineAction(action.id)}
                      className="flex-1 px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-500 text-white transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => rejectPipelineAction(action.id)}
                      className="flex-1 px-2 py-1 text-xs rounded bg-theme-elevated hover:bg-theme-hover text-theme-secondary border border-theme-subtle transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                )}
                {action.status === 'accepted' && (
                  <div className="text-xs text-green-500">Accepted</div>
                )}
                {action.status === 'rejected' && (
                  <div className="text-xs text-theme-tertiary">Rejected</div>
                )}
                {action.status === 'failed' && (
                  <div className="text-xs text-red-500">Failed</div>
                )}
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-theme-subtle px-3 py-2.5 space-y-2 bg-theme-header">
        {/* Context Chips */}
        {(activeDoc && !excludeConscious || thoughtPartner.selectionContext || thoughtPartner.referencedDocuments.length > 0 || (thoughtPartner.useCursorContext && thoughtPartner.cursorContext)) && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeDoc && !excludeConscious && (
                <ContextChip
                  title={activeDoc.title}
                  onRemove={() => setExcludeConscious(true)}
                />
              )}
              {thoughtPartner.selectionContext && (
                <SelectionContextChip
                  text={thoughtPartner.selectionContext.text}
                  onRemove={() => clearThoughtPartnerSelectionContext()}
                />
              )}
              {thoughtPartner.referencedDocuments.map(ref => (
                <ReferenceDocumentChip
                  key={ref.id}
                  title={ref.title}
                  onRemove={() => removeThoughtPartnerReference(ref.id)}
                />
              ))}
            </div>
            {thoughtPartner.useCursorContext && thoughtPartner.cursorContext && (
              <CursorContextChip
                cursorContext={thoughtPartner.cursorContext}
                radius={thoughtPartner.cursorContextRadius}
                onRadiusChange={(r) => setCursorContextRadius(r)}
                onRemove={() => toggleUseCursorContext()}
              />
            )}
          </div>
        )}

        {/* Edit mode indicator */}
        {editingMessageId && (
          <div className="flex items-center justify-between px-2 py-1 rounded-md bg-[var(--accent-gold-muted)]">
            <div className="flex items-center gap-1.5 text-[var(--accent-gold)]" style={{ fontSize: textSize - 1 }}>
              <EditRegular className="w-3 h-3" />
              <span>Editing message</span>
            </div>
            <button
              onClick={handleCancelEdit}
              className="p-0.5 rounded hover:bg-[var(--accent-gold-border)] text-[var(--accent-gold)] transition-colors"
              title="Cancel edit"
            >
              <DismissRegular className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input container with buttons inside */}
        <div
          className={clsx(
            'relative flex flex-col rounded-lg bg-theme-elevated',
            'border transition-colors',
            isDraggingOver
              ? 'border-sky-500/50 bg-sky-500/5'
              : editingMessageId
                ? 'border-[var(--accent-gold-border)]'
                : thoughtPartner.agentMode
                  ? 'border-blue-500/30 focus-within:border-blue-400'
                  : 'border-theme-subtle focus-within:border-[var(--accent-gold-border)]'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {/* @mention popover */}
          {mentionQuery !== null && mentionResults.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-theme-subtle bg-theme-elevated shadow-lg overflow-hidden z-10">
              {mentionResults.map((doc, i) => (
                <button
                  key={doc.id}
                  className={clsx(
                    'w-full text-left px-3 py-1.5 text-sm transition-colors',
                    i === mentionIndex
                      ? 'bg-sky-500/15 text-sky-400'
                      : 'text-theme-secondary hover:bg-theme-active'
                  )}
                  style={{ fontFamily: 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif' }}
                  onMouseDown={(e) => { e.preventDefault(); selectMention(doc) }}
                >
                  {doc.title}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={thoughtPartner.agentMode ? 'What should I write?' : "What's on your mind?"}
            style={{ fontSize: textSize, fontFamily: 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif', height: '150px' }}
            className="w-full resize-none bg-transparent rounded-t-lg px-3 pt-3 pb-1 text-theme-primary placeholder:text-theme-muted focus:outline-none"
          />
          {/* Bottom bar with buttons */}
          <div className="flex items-center justify-between px-2 py-1.5">
            {/* Left: Agent mode + Auto accept toggles */}
            <div className="flex items-center gap-1">
              <button
                onClick={toggleThoughtPartnerAgentMode}
                className={clsx(
                  'flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors',
                  thoughtPartner.agentMode
                    ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                    : 'text-theme-muted hover:text-theme-secondary hover:bg-theme-active'
                )}
                title={thoughtPartner.agentMode ? 'Agent Mode ON — click to disable' : 'Agent Mode OFF — click to enable writing to editor'}
              >
                <BotSparkleFilled className="w-5 h-5" />
                {thoughtPartner.agentMode && (
                  <span className="text-[10px] font-medium uppercase tracking-wider"
                        style={{ fontFamily: 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif' }}>
                    Agent
                  </span>
                )}
              </button>
              <button
                onClick={toggleThoughtPartnerAutoAccept}
                className={clsx(
                  'flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors',
                  thoughtPartner.autoAcceptEdits
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'text-theme-muted hover:text-theme-secondary hover:bg-theme-active'
                )}
                title={thoughtPartner.autoAcceptEdits ? 'Auto Accept ON — edits go straight to editor' : 'Auto Accept OFF — click to auto-accept all edits'}
              >
                <FlashCheckmarkRegular className="w-5 h-5" />
                {thoughtPartner.autoAcceptEdits && (
                  <span className="text-[10px] font-medium uppercase tracking-wider"
                        style={{ fontFamily: 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif' }}>
                    Auto
                  </span>
                )}
              </button>
              <button
                onClick={() => toggleUseCursorContext()}
                className={clsx(
                  'flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors',
                  thoughtPartner.useCursorContext
                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                    : 'text-theme-muted hover:text-theme-secondary hover:bg-theme-active'
                )}
                title={thoughtPartner.useCursorContext ? 'Focus ON — your cursor position is sent to the assistant' : 'Focus OFF — click to send cursor context to assistant'}
              >
                {thoughtPartner.useCursorContext
                  ? <CursorClickFilled className="w-5 h-5" />
                  : <CursorClickRegular className="w-5 h-5" />
                }
                {thoughtPartner.useCursorContext && (
                  <span className="text-[10px] font-medium uppercase tracking-wider"
                        style={{ fontFamily: 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif' }}>
                    Focus
                  </span>
                )}
              </button>
            </div>

            {/* Right: Send or Stop */}
            {thoughtPartner.isStreaming ? (
              <button
                onClick={stopThoughtPartnerStreaming}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                title="Stop"
              >
                <StopRegular className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!inputText.trim()}
                className={clsx(
                  'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                  inputText.trim()
                    ? 'bg-[var(--accent-gold-muted)] text-[var(--accent-gold)] hover:bg-[var(--accent-gold-border)]'
                    : 'text-theme-muted cursor-not-allowed'
                )}
                title={editingMessageId ? 'Update message' : 'Send'}
              >
                <SendRegular className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
