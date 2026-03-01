import { TextAlignJustifyRegular, DismissRegular } from '@fluentui/react-icons'

interface SelectionContextChipProps {
  text: string
  onRemove: () => void
}

export function SelectionContextChip({ text, onRemove }: SelectionContextChipProps) {
  const truncated = text.length > 50 ? text.slice(0, 47) + '...' : text

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-400 max-w-full"
      style={{ fontSize: 11, fontFamily: 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif' }}
      title={`Selection: "${text}"`}
    >
      <TextAlignJustifyRegular className="w-3 h-3 flex-shrink-0" />
      <span className="truncate">&ldquo;{truncated}&rdquo;</span>
      <button
        onClick={onRemove}
        className="flex-shrink-0 p-0.5 rounded hover:bg-purple-500/30 transition-colors"
        title="Remove selection context"
      >
        <DismissRegular className="w-3 h-3" />
      </button>
    </div>
  )
}
