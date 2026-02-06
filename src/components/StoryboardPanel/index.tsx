/**
 * StoryboardPanel
 * 
 * Main storyboard panel component for screenplay projects.
 * Displays a list of shots, playback controls, and allows linking shots to script blocks.
 */

import { useCallback, useMemo, useState } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { clsx } from 'clsx'
import { ShotThumbnail } from './ShotThumbnail'
import { PlaybackPreview } from './PlaybackPreview'
import { TransportControls } from './TransportControls'
import { AssetPicker } from './AssetPicker'
// StoryboardShot type used in child components
import {
  AddRegular,
  LinkRegular,
  ArrowSortRegular,
  ImageRegular,
  ArrowExpandRegular
} from '@fluentui/react-icons'
import { ExpandedPreviewModal } from './ExpandedPreviewModal'

export function StoryboardPanel() {
  const { 
    currentProject,
    assets,
    storyboardUI,
    storyboardPlayback,
    addShot,
    reorderShots,
    cancelLinkMode,
    updateAssetCategory
  } = useProjectStore()

  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false)
  const [isExpandedPreviewOpen, setIsExpandedPreviewOpen] = useState(false)
  const [draggedShotId, setDraggedShotId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isDropTargetActive, setIsDropTargetActive] = useState(false)

  // Get shots sorted by order
  const shots = useMemo(() => {
    const shotsList = currentProject?.storyboard?.shots || []
    return [...shotsList].sort((a, b) => a.order - b.order)
  }, [currentProject?.storyboard?.shots])

  // Get image assets for picker
  const imageAssets = useMemo(() => {
    return assets.filter(a => a.type === 'image')
  }, [assets])

  // Handle adding a new shot
  const handleAddShot = useCallback(async (assetId: string) => {
    await addShot(assetId)
    setIsAssetPickerOpen(false)
  }, [addShot])

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, shotId: string) => {
    setDraggedShotId(shotId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', shotId)
  }, [])

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null)
  }, [])

  // Handle drop - reorder shots
  const handleDrop = useCallback(async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    setDragOverIndex(null)
    
    if (!draggedShotId) return

    const currentIndex = shots.findIndex(s => s.id === draggedShotId)
    if (currentIndex === -1 || currentIndex === targetIndex) {
      setDraggedShotId(null)
      return
    }

    // Reorder shots
    const newOrder = [...shots]
    const [removed] = newOrder.splice(currentIndex, 1)
    newOrder.splice(targetIndex, 0, removed)

    await reorderShots(newOrder.map(s => s.id))
    setDraggedShotId(null)
  }, [draggedShotId, shots, reorderShots])

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedShotId(null)
    setDragOverIndex(null)
  }, [])

  // Handle drop from Assets panel - add asset as a shot
  const handleAssetDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDropTargetActive(false)
    
    // Check for asset data from the Assets panel
    const assetDataStr = e.dataTransfer.getData('application/x-cadmus-asset')
    if (assetDataStr) {
      try {
        const assetData = JSON.parse(assetDataStr) as {
          assetId: string
          assetPath: string
          projectPath: string
          name: string
        }
        
        // First, move the asset to storyboard category if it isn't already
        const asset = assets.find(a => a.id === assetData.assetId)
        if (asset && asset.category !== 'storyboard') {
          await updateAssetCategory(assetData.assetId, 'storyboard')
        }
        
        // Add the asset as a new shot
        await addShot(assetData.assetId)
      } catch (err) {
        console.error('Failed to parse asset data:', err)
      }
    }
  }, [assets, addShot, updateAssetCategory])

  // Handle drag over for asset drops
  const handleAssetDragOver = useCallback((e: React.DragEvent) => {
    // Check if this is an asset drag (not a shot reorder)
    if (e.dataTransfer.types.includes('application/x-cadmus-asset')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDropTargetActive(true)
    }
  }, [])

  // Handle drag leave for asset drops
  const handleAssetDragLeave = useCallback((e: React.DragEvent) => {
    // Only deactivate if leaving the panel entirely
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDropTargetActive(false)
    }
  }, [])

  // Current shot during playback
  const currentShot = shots[storyboardPlayback.currentShotIndex] || null

  return (
    <div 
      className={clsx(
        "storyboard-panel flex flex-col h-full bg-theme-secondary transition-all",
        isDropTargetActive && "ring-2 ring-inset ring-amber-400/50"
      )}
      onDragOver={handleAssetDragOver}
      onDragLeave={handleAssetDragLeave}
      onDrop={handleAssetDrop}
    >
      {/* Header */}
      <div className="storyboard-header flex items-center justify-between px-4 py-3 border-b border-theme-subtle bg-theme-header">
        <h2 className="text-xs font-ui font-semibold uppercase tracking-wider text-theme-muted">
          Storyboard
        </h2>
        <div className="flex items-center gap-1">
          {/* Link Mode Indicator */}
          {storyboardUI.linkMode.active && (
            <button
              onClick={cancelLinkMode}
              className="btn-icon-modern p-1.5 text-black bg-amber-400"
              title="Cancel Link Mode (Esc)"
            >
              <LinkRegular className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Playback Preview - always visible */}
      <div className="storyboard-preview border-b border-theme-subtle relative group">
        <PlaybackPreview shot={currentShot} />
        {/* Expand button - appears on hover */}
        <button
          onClick={() => setIsExpandedPreviewOpen(true)}
          className="absolute top-2 left-2 p-1.5 rounded-md bg-black/60 text-white/70 hover:text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all"
          title="Expand Preview"
        >
          <ArrowExpandRegular className="w-4 h-4" />
        </button>
      </div>

      {/* Shot List */}
      <div className="storyboard-shots flex-1 overflow-y-auto p-3 min-h-0">
        {shots.length === 0 ? (
          <div className={clsx(
            "h-full flex flex-col items-center justify-center text-center rounded-lg transition-all",
            isDropTargetActive && "bg-amber-400/10 border-2 border-dashed border-amber-400/50"
          )}>
            <div className={clsx(
              "w-12 h-12 rounded-full flex items-center justify-center mb-3",
              isDropTargetActive ? "bg-amber-400/20" : "bg-theme-hover"
            )}>
              {isDropTargetActive ? (
                <ImageRegular className="w-6 h-6 text-amber-400" />
              ) : (
                <ArrowSortRegular className="w-6 h-6 text-theme-muted" />
              )}
            </div>
            <p className="text-sm text-theme-secondary font-ui font-medium mb-2">
              {isDropTargetActive ? 'Drop to add shot' : 'No shots yet'}
            </p>
            <p className="text-xs text-theme-muted font-ui mb-4">
              {isDropTargetActive 
                ? 'Release to add this image as a storyboard shot'
                : imageAssets.length > 0 
                  ? 'Drag images here or click below to add a shot'
                  : 'Add images to your assets first'}
            </p>
            
            {/* Add Shot Button - prominent in empty state */}
            <button
              onClick={() => setIsAssetPickerOpen(true)}
              disabled={imageAssets.length === 0}
              className={clsx(
                'px-4 py-2.5 rounded-lg transition-all',
                'flex items-center justify-center gap-2',
                imageAssets.length === 0
                  ? 'bg-theme-hover text-theme-muted cursor-not-allowed'
                  : 'bg-amber-400 text-black hover:bg-amber-300 font-medium'
              )}
              title={imageAssets.length === 0 ? 'Add images to Assets first' : 'Add Shot'}
            >
              <AddRegular className="w-4 h-4" />
              <span className="text-sm font-ui">Add Shot</span>
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {shots.map((shot, index) => (
                <div
                  key={shot.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, shot.id)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={clsx(
                    'transition-transform',
                    draggedShotId === shot.id && 'opacity-50',
                    dragOverIndex === index && 'transform translate-y-1'
                  )}
                >
                  {/* Drop indicator */}
                  {dragOverIndex === index && draggedShotId !== shot.id && (
                    <div className="h-0.5 bg-amber-400 rounded-full mb-2" />
                  )}
                  <ShotThumbnail
                    shot={shot}
                    index={index}
                    isActive={index === storyboardPlayback.currentShotIndex}
                    isPlaying={storyboardPlayback.isPlaying}
                  />
                </div>
              ))}
            </div>

            {/* Add Shot Button - dashed style when shots exist */}
            <button
              onClick={() => setIsAssetPickerOpen(true)}
              disabled={imageAssets.length === 0}
              className={clsx(
                'w-full mt-3 p-3 rounded-lg border-2 border-dashed transition-all',
                'flex items-center justify-center gap-2',
                imageAssets.length === 0
                  ? 'border-theme-subtle text-theme-muted cursor-not-allowed'
                  : 'border-theme-default text-theme-muted hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400'
              )}
              title={imageAssets.length === 0 ? 'Add images to Assets first' : 'Add Shot'}
            >
              <AddRegular className="w-4 h-4" />
              <span className="text-xs font-ui font-medium">Add Shot</span>
            </button>
          </>
        )}
      </div>

      {/* Transport Controls */}
      <div className="storyboard-transport border-t border-theme-subtle">
        <TransportControls />
      </div>

      {/* Asset Picker Modal */}
      {isAssetPickerOpen && (
        <AssetPicker
          assets={imageAssets}
          onSelect={handleAddShot}
          onClose={() => setIsAssetPickerOpen(false)}
        />
      )}

      {/* Expanded Preview Modal */}
      <ExpandedPreviewModal
        isOpen={isExpandedPreviewOpen}
        onClose={() => setIsExpandedPreviewOpen(false)}
      />
    </div>
  )
}
