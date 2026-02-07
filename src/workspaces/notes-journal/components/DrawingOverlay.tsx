import { useEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReactSketchCanvas, type ReactSketchCanvasRef } from 'react-sketch-canvas'
import { clsx } from 'clsx'
import { useProjectStore } from '../../../stores/projectStore'
import type { DrawingPath } from '../../../types/project'

// Stroke color presets
const STROKE_COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Gold', value: '#fbbf24' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Black', value: '#000000' },
]

const STROKE_WIDTH = 3
const ERASER_WIDTH = 20

// Inline SVG icons
const PenIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
)

const EraserIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15m0 0l3.75-3.75M4.5 12l3.75 3.75" />
    <rect x="3" y="14" width="12" height="6" rx="1" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-45 9 17)" />
  </svg>
)

const UndoIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
  </svg>
)

const RedoIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

// Floating drawing tools bar
function DrawingToolsBar({
  isEraser,
  strokeColor,
  onToggleEraser,
  onSetPen,
  onColorChange,
  onClear,
  onUndo,
  onRedo,
}: {
  isEraser: boolean
  strokeColor: string
  onToggleEraser: () => void
  onSetPen: () => void
  onColorChange: (color: string) => void
  onClear: () => void
  onUndo: () => void
  onRedo: () => void
}) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-1.5 px-3 py-2 bg-theme-elevated border border-theme-default rounded-xl shadow-xl">
      {/* Pen / Eraser */}
      <button
        onClick={onSetPen}
        className={clsx(
          'p-2 rounded-lg transition-colors',
          !isEraser ? 'bg-theme-active text-theme-accent' : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-hover'
        )}
        title="Pen"
      >
        <PenIcon />
      </button>
      <button
        onClick={onToggleEraser}
        className={clsx(
          'p-2 rounded-lg transition-colors',
          isEraser ? 'bg-theme-active text-theme-accent' : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-hover'
        )}
        title="Eraser"
      >
        <EraserIcon />
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-theme-subtle mx-1" />

      {/* Color swatches */}
      <div className="flex items-center gap-1">
        {STROKE_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => onColorChange(color.value)}
            className={clsx(
              'w-5 h-5 rounded-full border-2 transition-all',
              strokeColor === color.value
                ? 'border-theme-accent scale-110'
                : 'border-transparent hover:scale-110'
            )}
            style={{ backgroundColor: color.value }}
            title={color.name}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-theme-subtle mx-1" />

      {/* Undo / Redo */}
      <button
        onClick={onUndo}
        className="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-hover transition-colors"
        title="Undo"
      >
        <UndoIcon />
      </button>
      <button
        onClick={onRedo}
        className="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-hover transition-colors"
        title="Redo"
      >
        <RedoIcon />
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-theme-subtle mx-1" />

      {/* Clear */}
      <button
        onClick={onClear}
        className="p-2 rounded-lg text-theme-secondary hover:text-red-400 hover:bg-theme-hover transition-colors"
        title="Clear All"
      >
        <TrashIcon />
      </button>
    </div>
  )
}

interface DrawingOverlayProps {
  documentId: string
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function DrawingOverlay({ documentId, containerRef }: DrawingOverlayProps) {
  const {
    ui,
    saveDrawingPaths,
    getDrawingForDocument,
    clearDrawing,
    setDrawingMode,
  } = useProjectStore()

  const canvasRef = useRef<ReactSketchCanvasRef>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastDocIdRef = useRef<string | null>(null)
  const isLoadingRef = useRef(false)

  const [isEraser, setIsEraser] = useState(false)
  const [strokeColor, setStrokeColor] = useState('#ffffff')

  const isActive = ui.drawingMode

  // Load saved paths when document changes
  useEffect(() => {
    if (!canvasRef.current) return
    if (lastDocIdRef.current === documentId) return

    isLoadingRef.current = true
    lastDocIdRef.current = documentId

    canvasRef.current.resetCanvas()
    const savedPaths = getDrawingForDocument(documentId)
    if (savedPaths.length > 0) {
      const canvasPaths = savedPaths.map(p => ({
        paths: p.paths,
        strokeWidth: p.strokeWidth,
        strokeColor: p.strokeColor,
        drawMode: p.drawMode,
      }))
      canvasRef.current.loadPaths(canvasPaths)
    }

    // Small delay to let loadPaths finish before allowing saves
    setTimeout(() => { isLoadingRef.current = false }, 100)
  }, [documentId, getDrawingForDocument])

  // Reload paths when drawing mode is activated
  useEffect(() => {
    if (!isActive || !canvasRef.current) return

    isLoadingRef.current = true
    canvasRef.current.resetCanvas()
    const savedPaths = getDrawingForDocument(documentId)
    if (savedPaths.length > 0) {
      const canvasPaths = savedPaths.map(p => ({
        paths: p.paths,
        strokeWidth: p.strokeWidth,
        strokeColor: p.strokeColor,
        drawMode: p.drawMode,
      }))
      canvasRef.current.loadPaths(canvasPaths)
    }
    setTimeout(() => { isLoadingRef.current = false }, 100)
  }, [isActive, documentId, getDrawingForDocument])

  // Debounced save on stroke change
  const handleStrokeEnd = useCallback(async () => {
    if (!canvasRef.current || isLoadingRef.current) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!canvasRef.current) return
      try {
        const exported = await canvasRef.current.exportPaths()
        const paths = Array.isArray(exported) ? exported : []
        const drawingPaths: DrawingPath[] = paths.map(p => ({
          paths: p.paths,
          strokeWidth: p.strokeWidth,
          strokeColor: p.strokeColor,
          drawMode: p.drawMode,
        }))
        await saveDrawingPaths(documentId, drawingPaths)
      } catch (error) {
        console.error('[DrawingOverlay] Failed to export/save paths:', error)
      }
    }, 800)
  }, [documentId, saveDrawingPaths])

  // Toggle eraser
  const handleToggleEraser = useCallback(() => {
    setIsEraser(true)
    canvasRef.current?.eraseMode(true)
  }, [])

  // Switch to pen
  const handleSetPen = useCallback(() => {
    setIsEraser(false)
    canvasRef.current?.eraseMode(false)
  }, [])

  // Change color (also switch to pen mode)
  const handleColorChange = useCallback((color: string) => {
    setStrokeColor(color)
    setIsEraser(false)
    canvasRef.current?.eraseMode(false)
  }, [])

  // Clear canvas
  const handleClear = useCallback(async () => {
    canvasRef.current?.resetCanvas()
    await clearDrawing(documentId)
  }, [documentId, clearDrawing])

  // Undo/Redo
  const handleUndo = useCallback(() => {
    canvasRef.current?.undo()
    handleStrokeEnd()
  }, [handleStrokeEnd])

  const handleRedo = useCallback(() => {
    canvasRef.current?.redo()
    handleStrokeEnd()
  }, [handleStrokeEnd])

  // Escape key exits drawing mode
  useEffect(() => {
    if (!isActive) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawingMode(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isActive, setDrawingMode])

  // Reset eraser when drawing mode deactivates
  useEffect(() => {
    if (!isActive) {
      setIsEraser(false)
      canvasRef.current?.eraseMode(false)
    }
  }, [isActive])

  // Cleanup save timeout
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  return (
    <>
      {/* Drawing canvas overlay — fixed width centered on content area for stable coordinates */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          width: 4000,
          zIndex: isActive ? 15 : 5,
          pointerEvents: isActive ? 'auto' : 'none',
          cursor: isActive ? (isEraser ? 'cell' : 'crosshair') : 'default',
        }}
      >
        <ReactSketchCanvas
          ref={canvasRef}
          strokeColor={strokeColor}
          strokeWidth={STROKE_WIDTH}
          eraserWidth={ERASER_WIDTH}
          canvasColor="transparent"
          style={{
            border: 'none',
            borderRadius: 0,
          }}
          onStroke={handleStrokeEnd}
        />
      </div>

      {/* Floating tools bar */}
      {isActive && createPortal(
        <DrawingToolsBar
          isEraser={isEraser}
          strokeColor={strokeColor}
          onToggleEraser={handleToggleEraser}
          onSetPen={handleSetPen}
          onColorChange={handleColorChange}
          onClear={handleClear}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />,
        document.body
      )}
    </>
  )
}
