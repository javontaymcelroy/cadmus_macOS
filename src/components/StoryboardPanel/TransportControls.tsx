/**
 * TransportControls
 * 
 * Playback control bar for storyboard: play/pause, prev/next, speed, timeline.
 */

import { useCallback, useMemo } from 'react'
import { useProjectStore, type PlaybackSpeed } from '../../stores/projectStore'
import { clsx } from 'clsx'
import {
  PlayRegular,
  PauseRegular,
  PreviousRegular,
  NextRegular
} from '@fluentui/react-icons'

const SPEED_OPTIONS: PlaybackSpeed[] = [0.75, 1, 1.25, 1.5]

export function TransportControls() {
  const {
    currentProject,
    storyboardPlayback,
    togglePlayback,
    nextShot,
    prevShot,
    goToShot,
    setPlaybackSpeed,
    setPlaybackTime
  } = useProjectStore()

  const shots = currentProject?.storyboard?.shots || []
  const hasShots = shots.length > 0

  // Note: overall progress calculation available if needed for scrubber display

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

  return (
    <div className="transport-controls p-3 bg-theme-secondary">
      {/* Timeline Scrubber */}
      <div 
        onClick={handleTimelineClick}
        className={clsx(
          'timeline-scrubber h-2 rounded-full mb-3 cursor-pointer',
          'bg-theme-hover overflow-hidden',
          !hasShots && 'opacity-50 cursor-not-allowed'
        )}
      >
        {/* Shot segments */}
        <div className="relative h-full flex">
          {shots.map((shot, index) => (
            <div
              key={shot.id}
              className={clsx(
                'h-full flex-1 border-r border-theme-subtle last:border-r-0',
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
        <div className="text-xs font-ui text-theme-muted min-w-[60px]">
          {hasShots ? `${storyboardPlayback.currentShotIndex + 1} / ${shots.length}` : '0 / 0'}
        </div>

        {/* Center: Playback controls */}
        <div className="flex items-center gap-1">
          {/* Previous */}
          <button
            onClick={prevShot}
            disabled={!hasShots || storyboardPlayback.currentShotIndex === 0}
            className={clsx(
              'transport-btn p-2 rounded-lg transition-colors',
              hasShots && storyboardPlayback.currentShotIndex > 0
                ? 'text-theme-secondary hover:text-theme-primary hover:bg-theme-hover'
                : 'text-theme-muted cursor-not-allowed'
            )}
            title="Previous Shot (←)"
          >
            <PreviousRegular className="w-5 h-5" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlayback}
            disabled={!hasShots}
            className={clsx(
              'transport-btn-primary p-3 rounded-xl transition-all',
              hasShots
                ? 'bg-amber-400 text-black hover:bg-amber-300 active:scale-95'
                : 'bg-theme-hover text-theme-muted cursor-not-allowed'
            )}
            title={storyboardPlayback.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {storyboardPlayback.isPlaying ? (
              <PauseRegular className="w-5 h-5" />
            ) : (
              <PlayRegular className="w-5 h-5" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={nextShot}
            disabled={!hasShots || storyboardPlayback.currentShotIndex >= shots.length - 1}
            className={clsx(
              'transport-btn p-2 rounded-lg transition-colors',
              hasShots && storyboardPlayback.currentShotIndex < shots.length - 1
                ? 'text-theme-secondary hover:text-theme-primary hover:bg-theme-hover'
                : 'text-theme-muted cursor-not-allowed'
            )}
            title="Next Shot (→)"
          >
            <NextRegular className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Speed control */}
        <button
          onClick={handleSpeedClick}
          disabled={!hasShots}
          className={clsx(
            'min-w-[60px] px-2 py-1 rounded text-xs font-ui font-medium transition-colors',
            hasShots
              ? 'text-theme-secondary hover:text-theme-accent hover:bg-theme-hover'
              : 'text-theme-muted cursor-not-allowed'
          )}
          title="Change playback speed"
        >
          {speedLabel}
        </button>
      </div>
    </div>
  )
}
