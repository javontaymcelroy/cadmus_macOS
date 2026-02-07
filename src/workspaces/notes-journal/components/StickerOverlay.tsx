import { useCallback, useEffect, useState, useRef, RefObject } from 'react'
import { Rnd } from 'react-rnd'
import { useProjectStore } from '../../../stores/projectStore'
import type { Sticker } from '../../../types/project'
import { DEFAULT_STICKERS } from '../../../components/StickersPanel'

interface StickerDropData {
  assetId: string
  assetPath: string
  projectPath?: string
  name: string
  isDefault?: boolean
}

interface StickerOverlayProps {
  documentId: string
  containerRef: RefObject<HTMLDivElement | null>
  dropZoneRef?: RefObject<HTMLDivElement | null>
}

// Local transform state for smooth dragging/resizing
interface LocalTransform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

const DEFAULT_STICKER_SIZE = 100

export function StickerOverlay({ documentId, containerRef, dropZoneRef }: StickerOverlayProps) {
  const {
    currentProject,
    addSticker,
    updateStickerPosition,
    updateStickerSize,
    updateStickerRotation,
    removeSticker,
    getStickersForDocument,
    ui
  } = useProjectStore()

  const zoomScale = ui.viewZoom / 100
  
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null)
  const [hoveredStickerId, setHoveredStickerId] = useState<string | null>(null)
  const [draggingStickerId, setDraggingStickerId] = useState<string | null>(null)
  const [rotatingStickerId, setRotatingStickerId] = useState<string | null>(null)
  const [localRotations, setLocalRotations] = useState<Record<string, number>>({})
  const rotationRef = useRef<number>(0) // Track latest rotation during drag (avoids stale closure)

  // Track local transforms during drag/resize to avoid glitchy updates
  const [localTransforms, setLocalTransforms] = useState<Record<string, LocalTransform>>({})
  const isSavingRef = useRef<Record<string, boolean>>({})
  
  const stickers = getStickersForDocument(documentId)
  
  // Get the effective transform for a sticker (local override or from store)
  const getEffectiveTransform = useCallback((sticker: Sticker): LocalTransform => {
    return localTransforms[sticker.id] || {
      x: sticker.x,
      y: sticker.y,
      width: sticker.width,
      height: sticker.height,
      rotation: sticker.rotation || 0
    }
  }, [localTransforms])

  // Get effective rotation (local during drag, or from store)
  const getEffectiveRotation = useCallback((sticker: Sticker): number => {
    if (localRotations[sticker.id] !== undefined) return localRotations[sticker.id]
    return sticker.rotation || 0
  }, [localRotations])

  // Handle sticker drop from the StickersPanel
  const handleDrop = useCallback((e: DragEvent) => {
    const stickerDataStr = e.dataTransfer?.getData('application/x-cadmus-sticker')
    if (!stickerDataStr || !containerRef.current) return

    e.preventDefault()
    e.stopPropagation()

    try {
      const stickerData: StickerDropData = JSON.parse(stickerDataStr)

      // Calculate drop position relative to the content wrapper
      // getBoundingClientRect accounts for scroll position of parent containers
      const contentRect = containerRef.current.getBoundingClientRect()
      // Calculate scale from visual vs layout size to account for CSS transforms
      const scale = contentRect.width / containerRef.current.offsetWidth || 1

      const x = (e.clientX - contentRect.left) / scale - DEFAULT_STICKER_SIZE / 2
      const y = (e.clientY - contentRect.top) / scale - DEFAULT_STICKER_SIZE / 2

      // Add the sticker at the drop position
      addSticker(
        documentId,
        stickerData.assetId,
        Math.max(0, x),
        Math.max(0, y),
        DEFAULT_STICKER_SIZE,
        DEFAULT_STICKER_SIZE
      )
    } catch (err) {
      console.error('Failed to handle sticker drop:', err)
    }
  }, [containerRef, documentId, addSticker])

  const handleDragOver = useCallback((e: DragEvent) => {
    const hasStickerData = e.dataTransfer?.types.includes('application/x-cadmus-sticker')
    if (hasStickerData) {
      e.preventDefault()
      e.dataTransfer!.dropEffect = 'copy'
    }
  }, [])

  // Set up drop handlers on the drop zone (outer scrollable container if provided)
  useEffect(() => {
    const dropTarget = (dropZoneRef || containerRef).current
    if (!dropTarget) return

    dropTarget.addEventListener('drop', handleDrop)
    dropTarget.addEventListener('dragover', handleDragOver)

    return () => {
      dropTarget.removeEventListener('drop', handleDrop)
      dropTarget.removeEventListener('dragover', handleDragOver)
    }
  }, [dropZoneRef, containerRef, handleDrop, handleDragOver])

  // Handle keyboard shortcuts for selected sticker
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedStickerId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        removeSticker(selectedStickerId)
        setSelectedStickerId(null)
      }
      if (e.key === 'Escape') {
        setSelectedStickerId(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedStickerId, removeSticker])

  // Click outside to deselect - listen on outer container for full coverage
  useEffect(() => {
    const container = (dropZoneRef || containerRef).current
    if (!container || !selectedStickerId) return

    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is on a sticker element
      const target = e.target as HTMLElement
      const isOnSticker = target.closest('[data-sticker-id]')
      if (!isOnSticker) {
        setSelectedStickerId(null)
      }
    }

    // Use mousedown to deselect before other handlers
    container.addEventListener('mousedown', handleClickOutside)
    return () => container.removeEventListener('mousedown', handleClickOutside)
  }, [dropZoneRef, containerRef, selectedStickerId])

  // Handle drag during movement (update local state only)
  const handleDrag = useCallback((stickerId: string, x: number, y: number) => {
    setLocalTransforms(prev => ({
      ...prev,
      [stickerId]: {
        ...prev[stickerId],
        x,
        y
      }
    }))
  }, [])

  // Handle drag stop (persist to store)
  const handleDragStop = useCallback(async (stickerId: string, x: number, y: number) => {
    // Update local state immediately
    setLocalTransforms(prev => ({
      ...prev,
      [stickerId]: {
        ...prev[stickerId],
        x,
        y
      }
    }))
    
    // Mark as saving
    isSavingRef.current[stickerId] = true
    
    // Persist to store
    await updateStickerPosition(stickerId, x, y)
    
    // Clear saving flag and local transform after save completes
    isSavingRef.current[stickerId] = false
    setLocalTransforms(prev => {
      const { [stickerId]: _, ...rest } = prev
      return rest
    })
    
    setDraggingStickerId(null)
  }, [updateStickerPosition])

  // Handle resize during movement (update local state only)
  const handleResize = useCallback((stickerId: string, width: number, height: number, x: number, y: number) => {
    setLocalTransforms(prev => ({
      ...prev,
      [stickerId]: { x, y, width, height, rotation: prev[stickerId]?.rotation || 0 }
    }))
  }, [])

  // Handle resize stop (persist to store)
  const handleResizeStop = useCallback(async (stickerId: string, width: number, height: number, x: number, y: number) => {
    // Update local state immediately
    setLocalTransforms(prev => ({
      ...prev,
      [stickerId]: { x, y, width, height, rotation: prev[stickerId]?.rotation || 0 }
    }))

    // Mark as saving
    isSavingRef.current[stickerId] = true

    // Persist to store
    await updateStickerSize(stickerId, width, height)
    await updateStickerPosition(stickerId, x, y)

    // Clear saving flag and local transform after save completes
    isSavingRef.current[stickerId] = false
    setLocalTransforms(prev => {
      const { [stickerId]: _, ...rest } = prev
      return rest
    })
  }, [updateStickerSize, updateStickerPosition])

  // Handle rotation via mouse drag on the rotation handle
  const handleRotationStart = useCallback((e: React.MouseEvent, stickerId: string, sticker: Sticker) => {
    e.preventDefault()
    e.stopPropagation()
    setRotatingStickerId(stickerId)

    const initialRotation = sticker.rotation ?? 0
    rotationRef.current = initialRotation

    // Calculate the initial angle from center to mouse so we can compute deltas
    const stickerEl = document.querySelector(`[data-sticker-id="${stickerId}"]`)?.closest('.react-draggable') as HTMLElement
    if (!stickerEl) return

    const rect = stickerEl.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Calculate angle from center to current mouse position
      const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * 180 / Math.PI
      let degrees = initialRotation + (angle - startAngle)

      // Snap to 15-degree increments when holding Shift
      if (moveEvent.shiftKey) {
        degrees = Math.round(degrees / 15) * 15
      }

      rotationRef.current = degrees
      setLocalRotations(prev => ({
        ...prev,
        [stickerId]: degrees
      }))
    }

    const handleMouseUp = async () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      const finalRotation = rotationRef.current
      setRotatingStickerId(null)

      // Persist to store
      await updateStickerRotation(stickerId, finalRotation)

      // Clear local rotation after save
      setLocalRotations(prev => {
        const { [stickerId]: _, ...rest } = prev
        return rest
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [updateStickerRotation])

  if (!currentProject || stickers.length === 0) {
    // Still render an invisible overlay to handle drops
    return (
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 10 }}
      />
    )
  }

  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    >
      {stickers.map((sticker: Sticker) => {
        // Check if this is a default sticker
        const isDefaultSticker = sticker.assetId.startsWith('default:')
        
        let assetUrl: string
        let assetName: string
        let isSvg = false
        
        if (isDefaultSticker) {
          // Find the default sticker by ID
          const defaultSticker = DEFAULT_STICKERS.find(s => s.id === sticker.assetId)
          if (!defaultSticker) return null
          assetUrl = defaultSticker.src
          assetName = defaultSticker.name
          isSvg = true // All default stickers are SVGs
        } else {
          // Find the uploaded asset
          const asset = currentProject.assets.find(a => a.id === sticker.assetId)
          if (!asset) return null
          assetUrl = window.api.utils.getAssetUrl(currentProject.path, asset.path)
          assetName = asset.name
          isSvg = asset.name.toLowerCase().endsWith('.svg') || asset.mimeType === 'image/svg+xml'
        }

        const isSelected = selectedStickerId === sticker.id
        const isHovered = hoveredStickerId === sticker.id
        const isDraggingThis = draggingStickerId === sticker.id
        const isRotatingThis = rotatingStickerId === sticker.id

        // Get the effective transform (local during drag/resize, or from store)
        const transform = getEffectiveTransform(sticker)
        const rotation = getEffectiveRotation(sticker)

        const getImageFilter = () => {
          const baseShadow = isSvg ? 'drop-shadow(2px 2px 0px rgba(0,0,0,0.5))' : ''
          return baseShadow || undefined
        }

        return (
          <Rnd
            key={sticker.id}
            data-sticker-id={sticker.id}
            position={{ x: transform.x, y: transform.y }}
            size={{ width: transform.width, height: transform.height }}
            onDragStart={() => {
              setDraggingStickerId(sticker.id)
              // Initialize local transform from current sticker state
              setLocalTransforms(prev => ({
                ...prev,
                [sticker.id]: {
                  x: sticker.x,
                  y: sticker.y,
                  width: sticker.width,
                  height: sticker.height,
                  rotation: sticker.rotation || 0
                }
              }))
            }}
            onDrag={(_e, d) => {
              handleDrag(sticker.id, d.x, d.y)
            }}
            onDragStop={(_e, d) => {
              handleDragStop(sticker.id, d.x, d.y)
            }}
            onResizeStart={() => {
              // Initialize local transform from current sticker state
              setLocalTransforms(prev => ({
                ...prev,
                [sticker.id]: {
                  x: sticker.x,
                  y: sticker.y,
                  width: sticker.width,
                  height: sticker.height,
                  rotation: sticker.rotation || 0
                }
              }))
            }}
            onResize={(_e, _direction, ref, _delta, position) => {
              handleResize(
                sticker.id,
                parseInt(ref.style.width),
                parseInt(ref.style.height),
                position.x,
                position.y
              )
            }}
            onResizeStop={(_e, _direction, ref, _delta, position) => {
              handleResizeStop(
                sticker.id,
                parseInt(ref.style.width),
                parseInt(ref.style.height),
                position.x,
                position.y
              )
            }}
            scale={zoomScale}
            lockAspectRatio
            className="pointer-events-auto"
            style={{
              zIndex: isSelected ? 100 : (sticker.zIndex || 1),
              // Scale up on hover (matching StickersPanel)
              transform: isHovered && !isSelected && !isDraggingThis ? 'scale(1.05)' : undefined,
              transition: isRotatingThis ? undefined : 'transform 0.2s ease',
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              setSelectedStickerId(sticker.id)
            }}
            onMouseEnter={() => setHoveredStickerId(sticker.id)}
            onMouseLeave={() => setHoveredStickerId(null)}
            enableResizing={isSelected ? {
              top: false,
              right: false,
              bottom: false,
              left: false,
              topRight: true,
              bottomRight: true,
              bottomLeft: true,
              topLeft: true,
            } : false}
            resizeHandleStyles={{
              topRight: {
                width: 14,
                height: 14,
                right: -7,
                top: -7,
                background: '#fbbf24',
                borderRadius: '50%',
                border: '2px solid #000',
                cursor: 'ne-resize'
              },
              bottomRight: {
                width: 14,
                height: 14,
                right: -7,
                bottom: -7,
                background: '#fbbf24',
                borderRadius: '50%',
                border: '2px solid #000',
                cursor: 'se-resize'
              },
              bottomLeft: {
                width: 14,
                height: 14,
                left: -7,
                bottom: -7,
                background: '#fbbf24',
                borderRadius: '50%',
                border: '2px solid #000',
                cursor: 'sw-resize'
              },
              topLeft: {
                width: 14,
                height: 14,
                left: -7,
                top: -7,
                background: '#fbbf24',
                borderRadius: '50%',
                border: '2px solid #000',
                cursor: 'nw-resize'
              },
            }}
            minWidth={50}
            minHeight={50}
          >
            <div
              className={`w-full h-full relative ${isSelected ? 'ring-2 ring-gold-400 rounded' : ''}`}
              data-sticker-id={sticker.id}
              style={{
                transform: rotation ? `rotate(${rotation}deg)` : undefined,
                transition: isRotatingThis ? undefined : 'transform 0.2s ease',
              }}
            >
              <img
                src={assetUrl}
                alt={assetName}
                className="w-full h-full object-contain select-none"
                style={{ filter: getImageFilter() }}
                draggable={false}
              />
              {/* Delete button when selected */}
              {isSelected && (
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    removeSticker(sticker.id)
                    setSelectedStickerId(null)
                  }}
                  className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold hover:bg-red-600 transition-colors shadow-lg"
                  style={{ zIndex: 9999 }}
                  title="Delete sticker (Delete key)"
                >
                  ×
                </button>
              )}
              {/* Rotation handle when selected - positioned at bottom center */}
              {isSelected && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
                  style={{ top: '100%', zIndex: 9999 }}
                >
                  {/* Connecting line */}
                  <div className="w-px h-5 bg-gold-400" />
                  {/* Rotation grab handle */}
                  <div
                    onMouseDown={(e) => handleRotationStart(e, sticker.id, sticker)}
                    className="w-4 h-4 rounded-full bg-gold-400 border-2 border-black cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                    title="Drag to rotate (hold Shift to snap)"
                  />
                </div>
              )}
            </div>
          </Rnd>
        )
      })}
    </div>
  )
}
