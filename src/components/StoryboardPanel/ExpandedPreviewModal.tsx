/**
 * ExpandedPreviewModal
 * 
 * Full-screen modal for viewing storyboard playback with transport controls.
 */

import { useCallback, useEffect, useMemo } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import type { StoryboardShot } from '../../types/project'
import { getBlockText } from '../../utils/blockAnchoring'
import { clsx } from 'clsx'
import type { JSONContent } from '@tiptap/core'
import {
  DismissRegular,
  ImageRegular,
  PlayRegular,
  PauseRegular,
  PreviousRegular,
  NextRegular
} from '@fluentui/react-icons'
import type { PlaybackSpeed } from '../../stores/projectStore'

const SPEED_OPTIONS: PlaybackSpeed[] = [0.75, 1, 1.25, 1.5]

interface ExpandedPreviewModalProps {
  isOpen: boolean
  onClose: () => void
}

// Helper to check if a block is a dialogue element
function isDialogueBlock(doc: JSONContent, blockId: string): boolean {
  let isDialogue = false
  
  function traverse(node: JSONContent): void {
    if (isDialogue) return
    if (node.attrs?.blockId === blockId) {
      isDialogue = node.type === 'screenplayElement' && node.attrs?.elementType === 'dialogue'
      return
    }
    if (node.content) {
      for (const child of node.content) {
        traverse(child)
      }
    }
  }
  
  traverse(doc)
  return isDialogue
}

export function ExpandedPreviewModal({ isOpen, onClose }: ExpandedPreviewModalProps) {
  const {
    currentProject,
    assets,
    documents,
    storyboardPlayback,
    togglePlayback,
    nextShot,
    prevShot,
    goToShot,
    setPlaybackSpeed,
    setPlaybackTime
  } = useProjectStore()

  const shots = useMemo(() => {
    const shotsList = currentProject?.storyboard?.shots || []
    return [...shotsList].sort((a, b) => a.order - b.order)
  }, [currentProject?.storyboard?.shots])

  const hasShots = shots.length > 0
  const currentShot: StoryboardShot | null = shots[storyboardPlayback.currentShotIndex] || null

  // Get the asset for current shot
  const asset = useMemo(() => {
    if (!currentShot) return null
    return assets.find(a => a.id === currentShot.assetId)
  }, [assets, currentShot])

  // Get asset URL
  const assetUrl = useMemo(() => {
    if (!asset || !currentProject) return null
    return window.api.utils.getAssetUrl(currentProject.path, asset.path)
  }, [asset, currentProject])

  // Get the linked text and check if it's dialogue
  const { linkedText, isDialogue } = useMemo(() => {
    if (!currentShot?.linkedBlock || currentShot.isUnlinked) {
      return { linkedText: null, isDialogue: false }
    }
    
    const docContent = documents[currentShot.linkedBlock.documentId]?.content
    if (!docContent) {
      return { linkedText: null, isDialogue: false }
    }
    
    const text = getBlockText(docContent, currentShot.linkedBlock.blockId)
    const dialogue = isDialogueBlock(docContent, currentShot.linkedBlock.blockId)
    
    return { linkedText: text, isDialogue: dialogue }
  }, [currentShot, documents])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      // Space to play/pause
      if (e.key === ' ' && hasShots) {
        e.preventDefault()
        togglePlayback()
        return
      }

      // Arrow keys for navigation
      if (e.key === 'ArrowLeft' && hasShots && storyboardPlayback.currentShotIndex > 0) {
        e.preventDefault()
        prevShot()
        return
      }
      if (e.key === 'ArrowRight' && hasShots && storyboardPlayback.currentShotIndex < shots.length - 1) {
        e.preventDefault()
        nextShot()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, hasShots, storyboardPlayback.currentShotIndex, shots.length, togglePlayback, prevShot, nextShot, onClose])

  // Handle timeline click
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (shots.length === 0) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = x / rect.width
    
    // Calculate which shot this corresponds to
    const shotIndex = Math.floor(percent * shots.length)
    const withinShot = (percent * shots.length) % 1
    
    goToShot(Math.min(shotIndex, shots.length - 1))
    setPlaybackTime(withinShot)
  }, [shots.length, goToShot, setPlaybackTime])

  // Format speed label
  const speedLabel = useMemo(() => {
    return `${storyboardPlayback.speed}x`
  }, [storyboardPlayback.speed])

  // Cycle through speeds
  const handleSpeedClick = useCallback(() => {
    const currentIndex = SPEED_OPTIONS.indexOf(storyboardPlayback.speed)
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length
    setPlaybackSpeed(SPEED_OPTIONS[nextIndex])
  }, [storyboardPlayback.speed, setPlaybackSpeed])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Full screen container with consistent layout */}
      <div className="relative w-full h-full max-w-[1600px] max-h-[900px] mx-auto flex flex-col p-8">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 p-2 text-white/60 hover:text-white transition-colors z-10"
          title="Close (Escape)"
        >
          <DismissRegular className="w-6 h-6" />
        </button>

        {/* Main preview area - takes up available space */}
        <div className="relative rounded-lg overflow-hidden flex-1 min-h-0 bg-black">
          {/* Image - fills the frame */}
          <div className="relative w-full h-full">
            {currentShot && assetUrl ? (
              <img
                src={assetUrl}
                alt={asset?.name || 'Shot'}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-black">
                <ImageRegular className="w-16 h-16 text-white/15 mb-3" />
                <span className="text-sm text-white/25 font-ui">
                  {shots.length === 0 ? 'No shots added' : 'Select a shot'}
                </span>
              </div>
            )}

            {/* Progress bar - only show when playing */}
            {storyboardPlayback.isPlaying && currentShot && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                <div 
                  className="h-full bg-amber-400 transition-all duration-100"
                  style={{ width: `${storyboardPlayback.currentTime * 100}%` }}
                />
              </div>
            )}

            {/* Shot counter overlay */}
            {shots.length > 0 && (
              <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-black/70 text-sm font-ui font-medium text-white">
                {storyboardPlayback.currentShotIndex + 1} / {shots.length}
              </div>
            )}
          </div>
        </div>

        {/* Caption */}
        <div className="bg-ink-900 px-8 py-4 flex items-center justify-center flex-shrink-0">
          {linkedText ? (
            <p className="text-lg text-white font-ui text-center leading-relaxed line-clamp-2">
              {isDialogue ? `"${linkedText}"` : linkedText}
            </p>
          ) : (
            <p className="text-base text-white/40 font-ui italic text-center">
              {currentShot ? 'No linked text' : 'Caption will appear here'}
            </p>
          )}
        </div>

        {/* Transport Controls */}
        <div className="mt-4 p-5 bg-ink-900/80 rounded-lg backdrop-blur-sm flex-shrink-0">
          {/* Timeline Scrubber */}
          <div 
            onClick={handleTimelineClick}
            className={clsx(
              'timeline-scrubber h-3 rounded-full mb-5 cursor-pointer',
              'bg-white/10 overflow-hidden',
              !hasShots && 'opacity-50 cursor-not-allowed'
            )}
          >
            {/* Shot segments */}
            <div className="relative h-full flex">
              {shots.map((shot, index) => (
                <div
                  key={shot.id}
                  className={clsx(
                    'h-full flex-1 border-r border-white/10 last:border-r-0',
                    index < storyboardPlayback.currentShotIndex && 'bg-amber-400',
                    index === storyboardPlayback.currentShotIndex && 'bg-amber-400/60'
                  )}
                  style={index === storyboardPlayback.currentShotIndex ? {
                    background: `linear-gradient(90deg, #fbbf24 ${storyboardPlayback.currentTime * 100}%, rgba(251, 191, 36, 0.3) ${storyboardPlayback.currentTime * 100}%)`
                  } : undefined}
                />
              ))}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            {/* Left: Shot counter */}
            <div className="text-sm font-ui text-white/60 min-w-[80px]">
              {hasShots ? `${storyboardPlayback.currentShotIndex + 1} / ${shots.length}` : '0 / 0'}
            </div>

            {/* Center: Playback controls */}
            <div className="flex items-center gap-2">
              {/* Previous */}
              <button
                onClick={prevShot}
                disabled={!hasShots || storyboardPlayback.currentShotIndex === 0}
                className={clsx(
                  'p-3 rounded-xl transition-colors',
                  hasShots && storyboardPlayback.currentShotIndex > 0
                    ? 'text-white/70 hover:text-white hover:bg-white/10'
                    : 'text-white/30 cursor-not-allowed'
                )}
                title="Previous Shot (←)"
              >
                <PreviousRegular className="w-6 h-6" />
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlayback}
                disabled={!hasShots}
                className={clsx(
                  'p-4 rounded-2xl transition-all',
                  hasShots
                    ? 'bg-amber-400 text-black hover:bg-amber-300 active:scale-95'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                )}
                title={storyboardPlayback.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {storyboardPlayback.isPlaying ? (
                  <PauseRegular className="w-7 h-7" />
                ) : (
                  <PlayRegular className="w-7 h-7" />
                )}
              </button>

              {/* Next */}
              <button
                onClick={nextShot}
                disabled={!hasShots || storyboardPlayback.currentShotIndex >= shots.length - 1}
                className={clsx(
                  'p-3 rounded-xl transition-colors',
                  hasShots && storyboardPlayback.currentShotIndex < shots.length - 1
                    ? 'text-white/70 hover:text-white hover:bg-white/10'
                    : 'text-white/30 cursor-not-allowed'
                )}
                title="Next Shot (→)"
              >
                <NextRegular className="w-6 h-6" />
              </button>
            </div>

            {/* Right: Speed control */}
            <button
              onClick={handleSpeedClick}
              disabled={!hasShots}
              className={clsx(
                'min-w-[80px] px-3 py-1.5 rounded-lg text-sm font-ui font-medium transition-colors',
                hasShots
                  ? 'text-white/70 hover:text-white hover:bg-white/10'
                  : 'text-white/30 cursor-not-allowed'
              )}
              title="Change playback speed"
            >
              {speedLabel}
            </button>
          </div>
        </div>

        {/* Keyboard hints */}
        <div className="mt-2 flex items-center justify-center gap-6 text-xs text-white/30 font-ui">
          <span>Space: Play/Pause</span>
          <span>←/→: Prev/Next</span>
          <span>Esc: Close</span>
        </div>
      </div>
    </div>
  )
}
