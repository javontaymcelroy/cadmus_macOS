/**
 * PlaybackPreview
 * 
 * Large preview display for the currently playing/selected shot in the storyboard.
 */

import { useMemo } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import type { StoryboardShot } from '../../types/project'
import { getBlockText } from '../../utils/blockAnchoring'
import { ImageRegular } from '@fluentui/react-icons'
import type { JSONContent } from '@tiptap/core'

interface PlaybackPreviewProps {
  shot: StoryboardShot | null
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

export function PlaybackPreview({ shot }: PlaybackPreviewProps) {
  const { currentProject, assets, documents, storyboardPlayback } = useProjectStore()

  // Get the asset for this shot
  const asset = useMemo(() => {
    if (!shot) return null
    return assets.find(a => a.id === shot.assetId)
  }, [assets, shot])

  // Get asset URL
  const assetUrl = useMemo(() => {
    if (!asset || !currentProject) return null
    return window.api.utils.getAssetUrl(currentProject.path, asset.path)
  }, [asset, currentProject])

  // Get the linked text and check if it's dialogue
  const { linkedText, isDialogue } = useMemo(() => {
    if (!shot?.linkedBlock || shot.isUnlinked) {
      return { linkedText: null, isDialogue: false }
    }
    
    const docContent = documents[shot.linkedBlock.documentId]?.content
    if (!docContent) {
      return { linkedText: null, isDialogue: false }
    }
    
    const text = getBlockText(docContent, shot.linkedBlock.blockId)
    const dialogue = isDialogueBlock(docContent, shot.linkedBlock.blockId)
    
    return { linkedText: text, isDialogue: dialogue }
  }, [shot, documents])

  // Get total shots count
  const totalShots = currentProject?.storyboard?.shots.length || 0

  return (
    <div className="playback-preview flex flex-col">
      {/* Image container */}
      <div className="relative aspect-video bg-black overflow-hidden">
        {shot && assetUrl ? (
          <img
            src={assetUrl}
            alt={asset?.name || 'Shot'}
            className="w-full h-full object-contain"
          />
        ) : (
          /* Empty state - black screen */
          <div className="w-full h-full flex flex-col items-center justify-center bg-black">
            <ImageRegular className="w-10 h-10 text-white/15 mb-2" />
            <span className="text-xs text-white/25 font-ui">
              {totalShots === 0 ? 'No shots added' : 'Select a shot'}
            </span>
          </div>
        )}

        {/* Progress bar - only show when playing */}
        {storyboardPlayback.isPlaying && shot && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div 
              className="h-full bg-amber-400 transition-all duration-100"
              style={{ width: `${storyboardPlayback.currentTime * 100}%` }}
            />
          </div>
        )}

        {/* Shot counter overlay - only show when there are shots */}
        {totalShots > 0 && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-xs font-ui font-medium text-white">
            {storyboardPlayback.currentShotIndex + 1} / {totalShots}
          </div>
        )}
      </div>

      {/* Caption below the image */}
      <div className="bg-theme-tertiary px-3 py-2 min-h-[48px] flex items-center justify-center">
        {linkedText ? (
          <p className="text-sm text-theme-primary font-ui line-clamp-2 text-center">
            {isDialogue ? `"${linkedText}"` : linkedText}
          </p>
        ) : (
          <p className="text-xs text-theme-muted font-ui italic text-center">
            {shot ? 'No linked text' : 'Caption will appear here'}
          </p>
        )}
      </div>
    </div>
  )
}
