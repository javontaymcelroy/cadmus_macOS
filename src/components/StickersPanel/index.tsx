import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useProjectStore } from '../../stores/projectStore'
import { clsx } from 'clsx'
import type { Asset } from '../../types/project'
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  FluentProvider,
  createDarkTheme
} from '@fluentui/react-components'
import type { BrandVariants } from '@fluentui/react-components'
import { DeleteRegular } from '@fluentui/react-icons'

// Import default stickers
import balloonAnimalSticker from '../../workspaces/notes-journal/assets/stickers/balloonanimal.svg'
import cactusSticker from '../../workspaces/notes-journal/assets/stickers/cactus.svg'
import catSticker from '../../workspaces/notes-journal/assets/stickers/cat.svg'
import deerSticker from '../../workspaces/notes-journal/assets/stickers/deer.svg'
import fishSticker from '../../workspaces/notes-journal/assets/stickers/fish.svg'
import foxSticker from '../../workspaces/notes-journal/assets/stickers/fox.svg'
import frappeSticker from '../../workspaces/notes-journal/assets/stickers/frappe.svg'
import groupSticker from '../../workspaces/notes-journal/assets/stickers/Group.svg'
import heySticker from '../../workspaces/notes-journal/assets/stickers/hey.svg'
import leafSticker from '../../workspaces/notes-journal/assets/stickers/leaf.svg'
import lipsSticker from '../../workspaces/notes-journal/assets/stickers/lips.svg'
import lips2Sticker from '../../workspaces/notes-journal/assets/stickers/lips2.svg'
import pizzaSticker from '../../workspaces/notes-journal/assets/stickers/pizza.svg'
import powerSticker from '../../workspaces/notes-journal/assets/stickers/power.svg'
import skullSticker from '../../workspaces/notes-journal/assets/stickers/skull.svg'
import thumbsUpSticker from '../../workspaces/notes-journal/assets/stickers/thumbsUp.svg'
import unicornSticker from '../../workspaces/notes-journal/assets/stickers/unicorn.svg'
import vibesSticker from '../../workspaces/notes-journal/assets/stickers/vibes.svg'
import watermelonSticker from '../../workspaces/notes-journal/assets/stickers/watermelon.svg'
import yeeSticker from '../../workspaces/notes-journal/assets/stickers/yee.svg'

// Default stickers bundled with the app
interface DefaultSticker {
  id: string
  name: string
  src: string
}

const DEFAULT_STICKERS: DefaultSticker[] = [
  { id: 'default:balloonAnimal', name: 'Balloon Animal', src: balloonAnimalSticker },
  { id: 'default:cactus', name: 'Cactus', src: cactusSticker },
  { id: 'default:cat', name: 'Cat', src: catSticker },
  { id: 'default:deer', name: 'Deer', src: deerSticker },
  { id: 'default:fish', name: 'Fish', src: fishSticker },
  { id: 'default:fox', name: 'Fox', src: foxSticker },
  { id: 'default:frappe', name: 'Frappe', src: frappeSticker },
  { id: 'default:group', name: 'Group', src: groupSticker },
  { id: 'default:hey', name: 'Hey', src: heySticker },
  { id: 'default:leaf', name: 'Leaf', src: leafSticker },
  { id: 'default:lips', name: 'Lips', src: lipsSticker },
  { id: 'default:lips2', name: 'Lips 2', src: lips2Sticker },
  { id: 'default:pizza', name: 'Pizza', src: pizzaSticker },
  { id: 'default:power', name: 'Power', src: powerSticker },
  { id: 'default:skull', name: 'Skull', src: skullSticker },
  { id: 'default:thumbsUp', name: 'Thumbs Up', src: thumbsUpSticker },
  { id: 'default:unicorn', name: 'Unicorn', src: unicornSticker },
  { id: 'default:vibes', name: 'Vibes', src: vibesSticker },
  { id: 'default:watermelon', name: 'Watermelon', src: watermelonSticker },
  { id: 'default:yee', name: 'Yee', src: yeeSticker },
]

// Export for use in StickerOverlay
export { DEFAULT_STICKERS }
export type { DefaultSticker }

// Custom brand colors matching the gold theme
const customBrand: BrandVariants = {
  10: '#1a1a1a',
  20: '#1a1a1a',
  30: '#1a1a1a',
  40: '#1a1a1a',
  50: '#1a1a1a',
  60: '#1a1a1a',
  70: '#fbbf24',
  80: '#fbbf24',
  90: '#fbbf24',
  100: '#fbbf24',
  110: '#fbbf24',
  120: '#fbbf24',
  130: '#fbbf24',
  140: '#fbbf24',
  150: '#fbbf24',
  160: '#fbbf24'
}

const darkTheme = {
  ...createDarkTheme(customBrand),
  colorNeutralBackground1: 'transparent',
  colorNeutralBackground1Hover: '#2a2a2a',
  colorNeutralBackground1Pressed: '#333333',
  colorNeutralBackground2: 'transparent',
  colorNeutralBackground3: 'transparent',
  colorSubtleBackground: 'transparent',
  colorSubtleBackgroundHover: '#2a2a2a',
  colorNeutralForeground1: '#ffffff',
  colorNeutralForeground2: 'rgba(255,255,255,0.8)',
  colorNeutralStroke1: '#333333'
}

export function StickersPanel() {
  const { currentProject, assets, addAsset, addAssetFromBuffer, removeAsset } = useProjectStore()
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const [menuOpenAssetId, setMenuOpenAssetId] = useState<string | null>(null)
  const [deleteDialogAssetId, setDeleteDialogAssetId] = useState<string | null>(null)
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null)

  // Filter to only show images (stickers are image-only)
  const imageAssets = assets.filter(a => a.type === 'image')

  // Handle drag start for uploaded stickers
  const handleStickerDragStart = (e: React.DragEvent, asset: Asset) => {
    if (!currentProject || asset.type !== 'image') {
      e.preventDefault()
      return
    }

    setDraggingAssetId(asset.id)

    // Set custom data transfer with sticker information
    const stickerData = JSON.stringify({
      assetId: asset.id,
      assetPath: asset.path,
      projectPath: currentProject.path,
      name: asset.name,
      isDefault: false,
    })
    
    e.dataTransfer.setData('application/x-cadmus-sticker', stickerData)
    e.dataTransfer.effectAllowed = 'copy'
    
    // Set a drag image (the thumbnail)
    const dragImage = e.currentTarget.querySelector('img') as HTMLImageElement | null
    if (dragImage) {
      e.dataTransfer.setDragImage(dragImage, 20, 20)
    }
  }

  // Handle drag start for default stickers
  const handleDefaultStickerDragStart = (e: React.DragEvent, sticker: DefaultSticker) => {
    setDraggingAssetId(sticker.id)

    // Set custom data transfer with default sticker information
    const stickerData = JSON.stringify({
      assetId: sticker.id,
      assetPath: sticker.src,
      name: sticker.name,
      isDefault: true,
    })
    
    e.dataTransfer.setData('application/x-cadmus-sticker', stickerData)
    e.dataTransfer.effectAllowed = 'copy'
    
    // Set a drag image (the thumbnail)
    const dragImage = e.currentTarget.querySelector('img') as HTMLImageElement | null
    if (dragImage) {
      e.dataTransfer.setDragImage(dragImage, 20, 20)
    }
  }

  const handleStickerDragEnd = () => {
    setDraggingAssetId(null)
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      try {
        // Check if file has path property directly (Electron adds this in some cases)
        const fileWithPath = file as File & { path?: string }
        
        // Try direct path first (Electron adds this to File objects from drag-drop)
        const filePath = fileWithPath.path
        
        if (filePath) {
          await addAsset(filePath, file.name)
        } else {
          // No file path available - read file as ArrayBuffer and upload via IPC
          const buffer = await file.arrayBuffer()
          await addAssetFromBuffer(buffer, file.name, file.type)
        }
      } catch (error) {
        console.error('Failed to add sticker:', error)
      }
    }
  }, [addAsset, addAssetFromBuffer])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
    },
    noClick: imageAssets.length > 0
  })

  const handleDeleteConfirm = async () => {
    if (deleteDialogAssetId) {
      await removeAsset(deleteDialogAssetId)
      setDeleteDialogAssetId(null)
      if (selectedAsset === deleteDialogAssetId) {
        setSelectedAsset(null)
      }
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const renderStickerPreview = (asset: Asset) => {
    if (asset.type === 'image' && currentProject) {
      // For images, show a thumbnail using the custom cadmus-asset protocol
      const assetUrl = window.api.utils.getAssetUrl(currentProject.path, asset.path)
      const isSvg = asset.name.toLowerCase().endsWith('.svg') || asset.mimeType === 'image/svg+xml'
      
      return (
        <img 
          src={assetUrl} 
          alt={asset.name}
          className="w-full h-full object-contain"
          style={isSvg ? { filter: 'drop-shadow(2px 2px 0px rgba(0,0,0,0.5))' } : undefined}
          onError={(e) => {
            // Fallback to icon on error
            e.currentTarget.style.display = 'none'
          }}
        />
      )
    }
    
    return (
      <div className="w-full h-full rounded-lg bg-ink-700 flex items-center justify-center text-ink-300">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    )
  }

  // Get the asset being deleted for dialog content
  const assetToDelete = deleteDialogAssetId ? imageAssets.find(a => a.id === deleteDialogAssetId) : null

  if (!currentProject) return null

  return (
    <FluentProvider theme={darkTheme} style={{ background: 'transparent', height: '100%' }}>
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme-subtle bg-theme-header">
        <h2 className="text-xs font-ui font-medium uppercase tracking-wider text-theme-muted">
          Stickers
        </h2>
        <span className="text-xs text-theme-muted font-ui">
          {DEFAULT_STICKERS.length + imageAssets.length} total
        </span>
      </div>

      {/* Stickers content - scrollable area */}
      <div className="flex-1 overflow-auto p-3">
        {/* Default Stickers Section */}
        <div className="mb-4">
          <h3 className="text-[10px] font-ui font-medium uppercase tracking-wider text-theme-muted mb-2 px-1">
            Default Stickers
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {DEFAULT_STICKERS.map((sticker) => (
              <div
                key={sticker.id}
                draggable
                onDragStart={(e) => handleDefaultStickerDragStart(e, sticker)}
                onDragEnd={handleStickerDragEnd}
                onClick={() => setSelectedAsset(sticker.id === selectedAsset ? null : sticker.id)}
                className={clsx(
                  'relative group rounded-xl overflow-hidden bg-ink-800/30 cursor-grab active:cursor-grabbing transition-all duration-200',
                  selectedAsset === sticker.id && 'ring-2 ring-gold-400',
                  draggingAssetId === sticker.id && 'opacity-50'
                )}
                style={{
                  filter: selectedAsset === sticker.id 
                    ? 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))' 
                    : undefined
                }}
                title={`${sticker.name} - Drag to place on page`}
              >
                <div 
                  className="aspect-square p-2 flex items-center justify-center transition-all duration-200 group-hover:scale-105"
                  style={{
                    filter: 'drop-shadow(2px 2px 0px rgba(0,0,0,0.5))'
                  }}
                >
                  <img 
                    src={sticker.src} 
                    alt={sticker.name}
                    className="w-full h-full object-contain transition-all duration-200 group-hover:drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Uploaded Stickers Section */}
        {imageAssets.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[10px] font-ui font-medium uppercase tracking-wider text-theme-muted mb-2 px-1">
              My Stickers
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {imageAssets.map((asset) => (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => handleStickerDragStart(e, asset)}
                  onDragEnd={handleStickerDragEnd}
                  onClick={() => setSelectedAsset(asset.id === selectedAsset ? null : asset.id)}
                  className={clsx(
                    'relative group rounded-xl overflow-hidden bg-ink-800/30 cursor-grab active:cursor-grabbing transition-all duration-200',
                    selectedAsset === asset.id && 'ring-2 ring-gold-400',
                    draggingAssetId === asset.id && 'opacity-50'
                  )}
                  style={{
                    filter: selectedAsset === asset.id 
                      ? 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))' 
                      : undefined
                  }}
                  title="Drag to place on page"
                >
                  {/* Preview */}
                  <div className="aspect-square p-2 flex items-center justify-center transition-all duration-200 group-hover:scale-105">
                    <div className="w-full h-full transition-all duration-200 group-hover:drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]">
                      {renderStickerPreview(asset)}
                    </div>
                  </div>
                  
                  {/* Delete button overlay */}
                  <Menu
                    open={menuOpenAssetId === asset.id}
                    onOpenChange={(_, data) => setMenuOpenAssetId(data.open ? asset.id : null)}
                    positioning="below-end"
                  >
                    <MenuTrigger disableButtonEnhancement>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenAssetId(asset.id)
                        }}
                        className={clsx(
                          'absolute top-1 right-1 p-1 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity',
                          menuOpenAssetId === asset.id && 'opacity-100 text-red-400/80'
                        )}
                        title="Delete"
                      >
                        <svg className="w-3 h-3 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </MenuTrigger>
                    <MenuPopover style={{ 
                      background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.98) 0%, rgba(18, 18, 18, 0.99) 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.08)', 
                      borderRadius: '12px',
                      boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.05), 0 4px 24px rgba(0, 0, 0, 0.5)'
                    }}>
                      <MenuList style={{ backgroundColor: 'transparent' }}>
                        <MenuItem
                          icon={<DeleteRegular />}
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteDialogAssetId(asset.id)
                            setMenuOpenAssetId(null)
                          }}
                          style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.8)' }}
                        >
                          Delete
                        </MenuItem>
                      </MenuList>
                    </MenuPopover>
                  </Menu>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upload dropzone - fixed at bottom */}
      <div
        {...getRootProps()}
        className={clsx(
          'border-t border-theme-subtle p-3 transition-all duration-300',
          isDragActive && 'bg-theme-active'
        )}
      >
        <input {...getInputProps()} />
        <div className={clsx(
          'text-center py-4 px-4 rounded-lg border border-dashed transition-colors',
          isDragActive ? 'border-theme-accent bg-theme-hover' : 'border-theme-default'
        )}>
          <p className="text-xs text-theme-muted font-ui font-medium mb-1">
            {isDragActive ? 'Drop stickers here...' : 'Drop images to add stickers'}
          </p>
          <p className="text-[10px] text-theme-muted font-ui">
            PNG, JPG, GIF, SVG
          </p>
        </div>
      </div>

      {/* Selected sticker details */}
      {selectedAsset && (
        <div className="border-t border-theme-subtle p-4">
          {(() => {
            // Check if it's a default sticker
            const defaultSticker = DEFAULT_STICKERS.find(s => s.id === selectedAsset)
            if (defaultSticker) {
              return (
                <div className="space-y-2">
                  <h3 className="text-sm font-ui font-medium text-theme-primary truncate">
                    {defaultSticker.name}
                  </h3>
                  <p className="text-[10px] text-theme-muted font-ui">
                    Built-in sticker
                  </p>
                  <p className="text-xs text-theme-muted font-ui italic">
                    Drag to place on page
                  </p>
                </div>
              )
            }
            
            // Otherwise it's an uploaded asset
            const asset = imageAssets.find(a => a.id === selectedAsset)
            if (!asset) return null
            
            return (
              <div className="space-y-3">
                <h3 className="text-sm font-ui font-medium text-theme-primary truncate">
                  {asset.name}
                </h3>
                <dl className="space-y-2 text-xs font-ui">
                  <div className="flex justify-between">
                    <dt className="text-theme-muted">Size</dt>
                    <dd className="text-theme-secondary">{formatFileSize(asset.size)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-theme-muted">Added</dt>
                    <dd className="text-theme-secondary">
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-theme-muted font-ui italic">
                  Drag sticker to place on page
                </p>
              </div>
            )
          })()}
        </div>
      )}
    </div>

    {/* Delete Confirmation Dialog */}
    <Dialog
      open={deleteDialogAssetId !== null}
      onOpenChange={(_, data) => {
        if (!data.open) setDeleteDialogAssetId(null)
      }}
    >
      <DialogSurface style={{ 
        background: 'linear-gradient(135deg, rgba(18, 18, 18, 0.98) 0%, rgba(10, 10, 10, 0.99) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.05), 0 8px 40px rgba(0, 0, 0, 0.6)'
      }}>
        <DialogBody>
          <DialogTitle style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>Delete Sticker?</DialogTitle>
          <DialogContent style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            Are you sure you want to delete "{assetToDelete?.name}"?
          </DialogContent>
          <DialogActions>
            <Button
              appearance="secondary"
              onClick={() => setDeleteDialogAssetId(null)}
              style={{ 
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: 'rgba(255,255,255,0.8)'
              }}
            >
              Cancel
            </Button>
            <Button
              appearance="primary"
              onClick={handleDeleteConfirm}
              style={{ 
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                color: '#050505',
                borderRadius: '10px',
                fontWeight: 600
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
    </FluentProvider>
  )
}
