/**
 * ShotThumbnail
 * 
 * Displays a single shot in the storyboard list with thumbnail,
 * linked text preview, and action buttons.
 */

import { useCallback, useMemo } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { clsx } from 'clsx'
import type { StoryboardShot } from '../../types/project'
import { getBlockText } from '../../utils/blockAnchoring'
import {
  DeleteRegular,
  LinkRegular,
  LinkDismissRegular,
  WarningRegular,
  ClockRegular
} from '@fluentui/react-icons'

interface ShotThumbnailProps {
  shot: StoryboardShot
  index: number
  isActive: boolean
  isPlaying: boolean
}

export function ShotThumbnail({ shot, index, isActive, isPlaying }: ShotThumbnailProps) {
  const { 
    currentProject, 
    assets,
    documents,
    removeShot, 
    startLinkMode,
    unlinkShot,
    goToShot
  } = useProjectStore()

  // Get the asset for this shot
  const asset = useMemo(() => {
    return assets.find(a => a.id === shot.assetId)
  }, [assets, shot.assetId])

  // Get the linked text preview
  const linkedText = useMemo(() => {
    if (!shot.linkedBlock || shot.isUnlinked) return null
    
    const docContent = documents[shot.linkedBlock.documentId]?.content
    if (!docContent) return null
    
    const text = getBlockText(docContent, shot.linkedBlock.blockId)
    return text
  }, [shot.linkedBlock, shot.isUnlinked, documents])

  // Truncate text for preview
  const truncatedText = useMemo(() => {
    if (!linkedText) return null
    if (linkedText.length <= 60) return linkedText
    return linkedText.slice(0, 57) + '...'
  }, [linkedText])

  // Format duration
  const formattedDuration = useMemo(() => {
    if (!shot.durationMs) return null
    const seconds = Math.round(shot.durationMs / 1000)
    return `${seconds}s`
  }, [shot.durationMs])

  // Get asset URL
  const assetUrl = useMemo(() => {
    if (!asset || !currentProject) return null
    return window.api.utils.getAssetUrl(currentProject.path, asset.path)
  }, [asset, currentProject])

  const handleClick = useCallback(() => {
    goToShot(index)
  }, [goToShot, index])

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (shot.linkedBlock && !shot.isUnlinked) {
      unlinkShot(shot.id)
    } else {
      startLinkMode(shot.id)
    }
  }, [shot.id, shot.linkedBlock, shot.isUnlinked, startLinkMode, unlinkShot])

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    removeShot(shot.id)
  }, [removeShot, shot.id])

  return (
    <div
      onClick={handleClick}
      className={clsx(
        'shot-thumbnail group relative rounded-lg overflow-hidden cursor-pointer',
        'border transition-all duration-200',
        isActive
          ? 'border-amber-400/50 bg-amber-400/5 shadow-lg shadow-amber-400/10'
          : 'border-theme-subtle bg-theme-hover hover:border-theme-default hover:bg-theme-active',
        isPlaying && isActive && 'ring-2 ring-amber-400/30'
      )}
    >
      <div className="flex gap-3 p-2 items-center">
        {/* Thumbnail Image */}
        <div className="relative w-20 h-14 flex-shrink-0 rounded-md overflow-hidden bg-theme-tertiary">
          {assetUrl ? (
            <img
              src={assetUrl}
              alt={asset?.name || 'Shot'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xs text-theme-muted">No image</span>
            </div>
          )}
          
          {/* Shot number badge */}
          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-ui font-bold text-white">
            {index + 1}
          </div>

          {/* Playing indicator */}
          {isPlaying && isActive && (
            <div className="absolute inset-0 bg-amber-400/20 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center">
                <div className="w-0 h-0 border-l-[8px] border-l-black border-y-[5px] border-y-transparent ml-0.5" />
              </div>
            </div>
          )}
        </div>

        {/* Shot Info - middle section */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {/* Linked text or placeholder */}
          <div className="flex items-start gap-1">
            {shot.isUnlinked ? (
              <div className="flex items-center gap-1 text-amber-500">
                <WarningRegular className="w-3 h-3 flex-shrink-0" />
                <span className="text-xs font-ui font-medium">Unlinked</span>
              </div>
            ) : linkedText ? (
              <p className="text-sm text-theme-secondary font-ui line-clamp-2">
                {truncatedText}
              </p>
            ) : (
              <p className="text-sm text-theme-muted font-ui italic">
                No linked text
              </p>
            )}
          </div>

          {/* Duration */}
          {formattedDuration && (
            <div className="flex items-center gap-1 text-theme-muted mt-1">
              <ClockRegular className="w-3 h-3" />
              <span className="text-[10px] font-ui">{formattedDuration}</span>
            </div>
          )}
        </div>

        {/* Action buttons - always visible, at end, centered vertically */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleLinkClick}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              shot.linkedBlock && !shot.isUnlinked
                ? 'text-amber-500 hover:bg-amber-400/10'
                : 'text-theme-muted hover:text-amber-500 hover:bg-theme-hover'
            )}
            title={shot.linkedBlock && !shot.isUnlinked ? 'Unlink' : 'Link to text'}
          >
            {shot.linkedBlock && !shot.isUnlinked ? (
              <LinkDismissRegular className="w-5 h-5" />
            ) : (
              <LinkRegular className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={handleDeleteClick}
            className="p-2 rounded-lg text-theme-muted hover:text-red-500 hover:bg-red-400/10 transition-colors"
            title="Delete shot"
          >
            <DeleteRegular className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Active indicator bar */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400" />
      )}
    </div>
  )
}
