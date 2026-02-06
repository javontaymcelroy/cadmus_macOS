/**
 * useStoryboardPlayback Hook
 * 
 * Manages the storyboard playback state machine:
 * - Advances through shots based on duration
 * - Syncs with editor highlighting
 */

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useProjectStore } from '../stores/projectStore'
import { getShotDuration } from '../utils/blockAnchoring'

// Minimum time between playback ticks (ms)
const TICK_INTERVAL = 50

export function useStoryboardPlayback() {
  const {
    currentProject,
    documents,
    storyboardPlayback,
    storyboardUI,
    setPlaybackTime,
    nextShot,
    pauseStoryboard,
    setHighlightedBlock,
    clearHighlightedBlock
  } = useProjectStore()


  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastTickRef = useRef<number>(Date.now())

  // Get shots sorted by order
  const shots = useMemo(() => {
    const shotsList = currentProject?.storyboard?.shots || []
    return [...shotsList].sort((a, b) => a.order - b.order)
  }, [currentProject?.storyboard?.shots])

  // Current shot
  const currentShot = shots[storyboardPlayback.currentShotIndex] || null

  // Get duration for current shot
  const currentShotDuration = useMemo(() => {
    if (!currentShot) return 3500
    // Build document content map from store documents (filter nulls)
    const documentContents: Record<string, import('@tiptap/core').JSONContent> = {}
    for (const [id, state] of Object.entries(documents)) {
      if (state?.content) {
        documentContents[id] = state.content
      }
    }
    return getShotDuration(currentShot, documentContents)
  }, [currentShot, documents])

  // Update editor highlighting based on current shot
  // This effect sets the highlighted block in the store whenever the shot changes
  useEffect(() => {
    // Only highlight when storyboard panel is visible
    if (!storyboardUI.mode) {
      clearHighlightedBlock()
      return
    }

    // Set highlighted block based on current shot's linked block
    const linkedBlock = currentShot?.linkedBlock
    const isUnlinked = currentShot?.isUnlinked
    
    if (linkedBlock && !isUnlinked) {
      setHighlightedBlock(linkedBlock.blockId, linkedBlock.documentId)
    } else {
      clearHighlightedBlock()
    }
  }, [
    storyboardUI.mode,
    storyboardPlayback.currentShotIndex,
    currentShot,
    setHighlightedBlock,
    clearHighlightedBlock
  ])

  // Main playback tick
  const tick = useCallback(() => {
    const now = Date.now()
    const delta = now - lastTickRef.current
    lastTickRef.current = now

    // Calculate effective delta based on speed
    const effectiveDelta = delta * storyboardPlayback.speed

    // Calculate new time
    const currentTimeMs = storyboardPlayback.currentTime * currentShotDuration
    const newTimeMs = currentTimeMs + effectiveDelta
    const newProgress = Math.min(newTimeMs / currentShotDuration, 1)

    setPlaybackTime(newProgress)

    // Check if shot is complete
    if (newProgress >= 1) {
      if (storyboardPlayback.currentShotIndex < shots.length - 1) {
        nextShot()
      } else {
        pauseStoryboard()
      }
    }
  }, [
    storyboardPlayback.speed,
    storyboardPlayback.currentTime,
    storyboardPlayback.currentShotIndex,
    currentShotDuration,
    shots.length,
    setPlaybackTime,
    nextShot,
    pauseStoryboard
  ])

  // Handle playback state changes
  useEffect(() => {
    if (storyboardPlayback.isPlaying) {
      // Start playback
      lastTickRef.current = Date.now()
      
      // Start tick interval
      tickIntervalRef.current = setInterval(tick, TICK_INTERVAL)
    } else {
      // Stop playback
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current)
        tickIntervalRef.current = null
      }
    }

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current)
        tickIntervalRef.current = null
      }
    }
  }, [storyboardPlayback.isPlaying, tick])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current)
      }
    }
  }, [])

  return {
    currentShot,
    currentShotDuration,
    isPlaying: storyboardPlayback.isPlaying,
    currentTime: storyboardPlayback.currentTime,
    speed: storyboardPlayback.speed
  }
}
