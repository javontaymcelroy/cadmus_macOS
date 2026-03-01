import { DocumentRegular, DismissRegular } from '@fluentui/react-icons'

interface ContextChipProps {
  title: string
  onRemove: () => void
}

export function ContextChip({ title, onRemove }: ContextChipProps) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--accent-gold-muted)] border border-[var(--accent-gold-border)] text-[var(--accent-gold)] max-w-full"
      style={{ fontSize: 11, fontFamily: 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif' }}
    >
      <DocumentRegular className="w-3 h-3 flex-shrink-0" />
      <span className="truncate">{title}</span>
      <button
        onClick={onRemove}
        className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--accent-gold-border)] transition-colors"
        title="Remove active document context"
      >
        <DismissRegular className="w-3 h-3" />
      </button>
    </div>
  )
}
