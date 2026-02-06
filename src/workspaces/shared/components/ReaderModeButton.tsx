import { clsx } from 'clsx'
import { BookOpenRegular } from '@fluentui/react-icons'
import { useProjectStore } from '../../../stores/projectStore'

export function ReaderModeButton() {
  const readerMode = useProjectStore(state => state.ui.readerMode)
  const toggleReaderMode = useProjectStore(state => state.toggleReaderMode)

  return (
    <button
      onClick={toggleReaderMode}
      className={clsx(
        'flex items-center justify-center w-8 h-8 shrink-0 self-center rounded-md transition-colors border',
        readerMode
          ? 'bg-white/90 text-black border-white/50'
          : 'bg-theme-tertiary text-theme-primary hover:bg-theme-active border-theme-default'
      )}
      title={readerMode ? "Exit Reader Mode" : "Preview in Reader Mode"}
    >
      <BookOpenRegular className="w-4 h-4" />
    </button>
  )
}
