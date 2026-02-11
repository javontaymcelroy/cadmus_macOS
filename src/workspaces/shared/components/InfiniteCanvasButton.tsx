import { WhiteboardRegular } from '@fluentui/react-icons'
import { useProjectStore } from '../../../stores/projectStore'
import { ToolbarButton } from './ToolbarButton'

export function InfiniteCanvasButton() {
  const infiniteCanvas = useProjectStore(state => state.ui.infiniteCanvas)
  const toggleInfiniteCanvas = useProjectStore(state => state.toggleInfiniteCanvas)

  return (
    <ToolbarButton
      onClick={toggleInfiniteCanvas}
      isActive={infiniteCanvas}
      title={infiniteCanvas ? "Exit Infinite Canvas" : "Infinite Canvas Mode"}
    >
      <WhiteboardRegular className="w-4 h-4" />
    </ToolbarButton>
  )
}
