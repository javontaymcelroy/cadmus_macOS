import { DocumentRegular, DismissRegular } from '@fluentui/react-icons'

interface ReferenceDocumentChipProps {
  title: string
  onRemove: () => void
}

export function ReferenceDocumentChip({ title, onRemove }: ReferenceDocumentChipProps) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-sky-500/15 border border-sky-500/30 text-sky-400 max-w-full"
      style={{ fontSize: 11, fontFamily: 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif' }}
      title={`Referenced: ${title}`}
    >
      <DocumentRegular className="w-3 h-3 flex-shrink-0" />
      <span className="truncate">{title}</span>
      <button
        onClick={onRemove}
        className="flex-shrink-0 p-0.5 rounded hover:bg-sky-500/30 transition-colors"
        title="Remove reference"
      >
        <DismissRegular className="w-3 h-3" />
      </button>
    </div>
  )
}
