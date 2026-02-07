import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useProjectStore } from '../../stores/projectStore'
import { useWorkspace } from '../../workspaces/useWorkspace'
import { clsx } from 'clsx'
import type { Asset, AssetCategory } from '../../types/project'
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
import { DeleteRegular, VideoClipRegular, ImageRegular } from '@fluentui/react-icons'

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

// Asset section type for the panel
type AssetSection = 'general' | 'storyboard'

export function AssetsPanel() {
  const { currentProject, assets, addAsset, addAssetFromBuffer, removeAsset, updateAssetCategory } = useProjectStore()
  const { showStoryboardPanel } = useWorkspace()
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const [menuOpenAssetId, setMenuOpenAssetId] = useState<string | null>(null)
  const [deleteDialogAssetId, setDeleteDialogAssetId] = useState<string | null>(null)
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<AssetSection | null>('general')
  const [dropTargetSection, setDropTargetSection] = useState<AssetSection | null>(null)
  
  // Filter assets by category
  const generalAssets = assets.filter(a => !a.category || a.category === 'general')
  const storyboardAssets = assets.filter(a => a.category === 'storyboard')

  // Handle drag start for assets - sets data transfer with asset info
  const handleAssetDragStart = (e: React.DragEvent, asset: Asset) => {
    if (!currentProject || asset.type !== 'image') {
      e.preventDefault()
      return
    }

    setDraggingAssetId(asset.id)

    // Set custom data transfer with asset information
    const assetData = JSON.stringify({
      assetId: asset.id,
      assetPath: asset.path,
      projectPath: currentProject.path,
      name: asset.name,
    })
    
    e.dataTransfer.setData('application/x-cadmus-asset', assetData)
    e.dataTransfer.effectAllowed = 'copy'
    
    // Set a drag image (the thumbnail)
    const dragImage = e.currentTarget.querySelector('img') as HTMLImageElement | null
    if (dragImage) {
      e.dataTransfer.setDragImage(dragImage, 20, 20)
    }
  }

  const handleAssetDragEnd = () => {
    setDraggingAssetId(null)
    setDropTargetSection(null)
  }

  // Handle drop on a section to move asset between categories
  const handleSectionDrop = useCallback(async (e: React.DragEvent, targetCategory: AssetCategory) => {
    e.preventDefault()
    e.stopPropagation()
    setDropTargetSection(null)

    // Check for asset data from internal drag
    const assetDataStr = e.dataTransfer.getData('application/x-cadmus-asset')
    if (assetDataStr) {
      try {
        const assetData = JSON.parse(assetDataStr) as {
          assetId: string
          assetPath: string
          projectPath: string
          name: string
        }
        
        // Find the asset and check if it needs to be moved
        const asset = assets.find(a => a.id === assetData.assetId)
        if (asset) {
          const currentCategory = asset.category || 'general'
          if (currentCategory !== targetCategory) {
            await updateAssetCategory(assetData.assetId, targetCategory)
          }
        }
      } catch (err) {
        console.error('Failed to parse asset data:', err)
      }
    }
  }, [assets, updateAssetCategory])

  // Handle drag over for section drops
  const handleSectionDragOver = useCallback((e: React.DragEvent, category: AssetCategory) => {
    // Check if this is an internal asset drag
    if (e.dataTransfer.types.includes('application/x-cadmus-asset')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropTargetSection(category)
    }
  }, [])

  // Handle drag leave for section drops
  const handleSectionDragLeave = useCallback(() => {
    setDropTargetSection(null)
  }, [])

  // Create onDrop handler for a specific category
  const createOnDrop = useCallback((category: AssetCategory) => {
    return async (acceptedFiles: File[]) => {
      console.log('[RENDERER] onDrop called for', category, ', files:', acceptedFiles.length)
      
      for (const file of acceptedFiles) {
        try {
          const fileWithPath = file as File & { path?: string }
          const filePath = fileWithPath.path
          
          if (filePath) {
            await addAsset(filePath, file.name, category)
          } else {
            const buffer = await file.arrayBuffer()
            await addAssetFromBuffer(buffer, file.name, file.type, category)
          }
        } catch (error) {
          console.error('Failed to add asset:', error)
        }
      }
    }
  }, [addAsset, addAssetFromBuffer])

  // Dropzone for general assets
  const { 
    getRootProps: getGeneralRootProps, 
    getInputProps: getGeneralInputProps, 
    isDragActive: isGeneralDragActive 
  } = useDropzone({
    onDrop: createOnDrop('general'),
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
      'application/pdf': ['.pdf']
    },
    noClick: generalAssets.length > 0
  })

  // Dropzone for storyboard assets
  const { 
    getRootProps: getStoryboardRootProps, 
    getInputProps: getStoryboardInputProps, 
    isDragActive: isStoryboardDragActive 
  } = useDropzone({
    onDrop: createOnDrop('storyboard'),
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
      'application/pdf': ['.pdf']
    },
    noClick: storyboardAssets.length > 0
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

  const getAssetIcon = (asset: Asset) => {
    switch (asset.type) {
      case 'image':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )
      case 'pdf':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
    }
  }

  const renderAssetPreview = (asset: Asset) => {
    if (asset.type === 'image' && currentProject) {
      // For images, show a thumbnail using the custom cadmus-asset protocol
      const assetUrl = window.api.utils.getAssetUrl(currentProject.path, asset.path)
      return (
        <div className="w-10 h-10 rounded bg-ink-800 overflow-hidden flex items-center justify-center">
          <img 
            src={assetUrl} 
            alt={asset.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to icon on error
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
      )
    }
    
    return (
      <div className="w-10 h-10 rounded bg-ink-700 flex items-center justify-center text-ink-300">
        {getAssetIcon(asset)}
      </div>
    )
  }

  // Get the asset being deleted for dialog content
  const assetToDelete = deleteDialogAssetId ? assets.find(a => a.id === deleteDialogAssetId) : null

  // Helper to render asset list for a category
  const renderAssetList = (
    assetList: Asset[], 
    category: AssetCategory,
    getRootProps: ReturnType<typeof useDropzone>['getRootProps'],
    getInputProps: ReturnType<typeof useDropzone>['getInputProps'],
    isDragActive: boolean
  ) => (
    <div
      {...getRootProps()}
      className={clsx(
        'dropzone-modern transition-all duration-300',
        isDragActive && 'active'
      )}
    >
      <input {...getInputProps()} />
      
      {assetList.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-theme-muted font-ui mb-1">
            {isDragActive ? 'Drop files here...' : 'No assets yet'}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation()
              const input = document.createElement('input')
              input.type = 'file'
              input.multiple = true
              input.accept = 'image/*,.pdf'
              input.onchange = async (ev) => {
                const files = (ev.target as HTMLInputElement).files
                if (files) {
                  for (const file of Array.from(files)) {
                    try {
                      const filePath = window.api.utils.getPathForFile(file)
                      if (filePath) {
                        await addAsset(filePath, file.name, category)
                      }
                    } catch (error) {
                      console.error('Failed to add asset:', error)
                    }
                  }
                }
              }
              input.click()
            }}
            className="text-xs text-theme-accent font-ui transition-colors hover:opacity-80"
          >
            + Add files
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {isDragActive && (
            <div className="p-3 rounded-lg bg-theme-active border border-theme-default text-center mb-2">
              <p className="text-xs text-theme-accent font-ui">Drop files to add</p>
            </div>
          )}
          
          {assetList.map((asset) => (
            <div
              key={asset.id}
              draggable={asset.type === 'image'}
              onDragStart={(e) => handleAssetDragStart(e, asset)}
              onDragEnd={handleAssetDragEnd}
              onClick={() => setSelectedAsset(asset.id === selectedAsset ? null : asset.id)}
              className={clsx(
                'list-item-modern flex items-center gap-3 p-2 transition-all duration-200',
                asset.type === 'image' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                selectedAsset === asset.id && 'active',
                draggingAssetId === asset.id && 'opacity-50'
              )}
              title={asset.type === 'image' ? 'Drag to insert into document' : undefined}
            >
              {renderAssetPreview(asset)}
              
              <div className="flex-1 min-w-0">
                <p className="text-sm text-theme-primary font-ui truncate">
                  {asset.name}
                </p>
                <p className="text-xs text-theme-muted font-ui mt-0.5">
                  {formatFileSize(asset.size)} • {asset.type}
                </p>
              </div>
              
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
                      'btn-icon-modern p-1.5',
                      menuOpenAssetId === asset.id && 'text-red-400/80'
                    )}
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                      onClick={async (e) => {
                        e.stopPropagation()
                        setMenuOpenAssetId(null)
                        await removeAsset(asset.id)
                        if (selectedAsset === asset.id) {
                          setSelectedAsset(null)
                        }
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
          
          <div className="pt-2 text-center">
            <button
              onClick={(e) => {
                e.stopPropagation()
                const input = document.createElement('input')
                input.type = 'file'
                input.multiple = true
                input.accept = 'image/*,.pdf'
                input.onchange = async (ev) => {
                  const files = (ev.target as HTMLInputElement).files
                  if (files) {
                    for (const file of Array.from(files)) {
                      try {
                        const filePath = window.api.utils.getPathForFile(file)
                        if (filePath) {
                          await addAsset(filePath, file.name, category)
                        }
                      } catch (error) {
                        console.error('Failed to add asset:', error)
                      }
                    }
                  }
                }
                input.click()
              }}
              className="text-xs text-theme-muted hover:text-theme-accent font-ui transition-colors"
            >
              + Add more files
            </button>
          </div>
        </div>
      )}
    </div>
  )

  if (!currentProject) return null

  return (
    <FluentProvider theme={darkTheme} style={{ background: 'transparent', height: '100%' }}>
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme-subtle bg-theme-header">
        <h2 className="text-xs font-ui font-medium uppercase tracking-wider text-theme-muted">
          Assets
        </h2>
        <span className="text-xs text-theme-muted font-ui">
          {assets.length} files
        </span>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto">
        {/* General Assets Section */}
        <div 
          className={clsx(
            "border-b border-theme-subtle transition-all",
            dropTargetSection === 'general' && "bg-blue-500/10"
          )}
          onDragOver={(e) => handleSectionDragOver(e, 'general')}
          onDragLeave={handleSectionDragLeave}
          onDrop={(e) => handleSectionDrop(e, 'general')}
        >
          <button
            onClick={() => setExpandedSection(expandedSection === 'general' ? null : 'general')}
            className={clsx(
              "w-full flex items-center justify-between px-4 py-2.5 hover:bg-theme-hover transition-colors",
              dropTargetSection === 'general' && "bg-blue-500/20"
            )}
          >
            <div className="flex items-center gap-2">
              <ImageRegular className={clsx(
                "w-4 h-4",
                dropTargetSection === 'general' ? "text-blue-400" : "text-theme-muted"
              )} />
              <span className={clsx(
                "text-xs font-ui font-medium",
                dropTargetSection === 'general' ? "text-blue-300" : "text-theme-secondary"
              )}>
                {dropTargetSection === 'general' ? 'Drop to move here' : 'Document Assets'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-theme-muted font-ui">{generalAssets.length}</span>
              <svg 
                className={clsx(
                  "w-4 h-4 text-theme-muted transition-transform",
                  expandedSection === 'general' && "rotate-180"
                )} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {expandedSection === 'general' && (
            <div className="px-3 pb-3">
              {renderAssetList(
                generalAssets, 
                'general',
                getGeneralRootProps,
                getGeneralInputProps,
                isGeneralDragActive
              )}
            </div>
          )}
        </div>

        {/* Storyboard Assets Section - only shown for screenplay projects */}
        {showStoryboardPanel && (
        <div
          className={clsx(
            "border-b border-theme-subtle transition-all",
            dropTargetSection === 'storyboard' && "bg-amber-500/10"
          )}
          onDragOver={(e) => handleSectionDragOver(e, 'storyboard')}
          onDragLeave={handleSectionDragLeave}
          onDrop={(e) => handleSectionDrop(e, 'storyboard')}
        >
          <button
            onClick={() => setExpandedSection(expandedSection === 'storyboard' ? null : 'storyboard')}
            className={clsx(
              "w-full flex items-center justify-between px-4 py-2.5 hover:bg-theme-hover transition-colors",
              dropTargetSection === 'storyboard' && "bg-amber-500/20"
            )}
          >
            <div className="flex items-center gap-2">
              <VideoClipRegular className={clsx(
                "w-4 h-4",
                dropTargetSection === 'storyboard' ? "text-amber-400" : "text-theme-muted"
              )} />
              <span className={clsx(
                "text-xs font-ui font-medium",
                dropTargetSection === 'storyboard' ? "text-amber-300" : "text-theme-secondary"
              )}>
                {dropTargetSection === 'storyboard' ? 'Drop to move here' : 'Storyboard Assets'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-theme-muted font-ui">{storyboardAssets.length}</span>
              <svg
                className={clsx(
                  "w-4 h-4 text-theme-muted transition-transform",
                  expandedSection === 'storyboard' && "rotate-180"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {expandedSection === 'storyboard' && (
            <div className="px-3 pb-3">
              {renderAssetList(
                storyboardAssets,
                'storyboard',
                getStoryboardRootProps,
                getStoryboardInputProps,
                isStoryboardDragActive
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Selected asset details */}
      {selectedAsset && (
        <div className="border-t border-theme-subtle p-4">
          {(() => {
            const asset = assets.find(a => a.id === selectedAsset)
            if (!asset) return null
            
            return (
              <div className="space-y-3">
                <h3 className="text-sm font-ui font-medium text-theme-primary truncate">
                  {asset.name}
                </h3>
                <dl className="space-y-2 text-xs font-ui">
                  <div className="flex justify-between">
                    <dt className="text-theme-muted">Type</dt>
                    <dd className="text-theme-secondary">{asset.mimeType || asset.type}</dd>
                  </div>
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
                  <div className="flex justify-between">
                    <dt className="text-theme-muted">Category</dt>
                    <dd className="text-theme-secondary capitalize">{asset.category || 'general'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-theme-muted">References</dt>
                    <dd className="text-theme-secondary">{asset.references.length} docs</dd>
                  </div>
                </dl>
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
          <DialogTitle style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>Delete Asset?</DialogTitle>
          <DialogContent style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            Are you sure you want to delete "{assetToDelete?.name}"? 
            {assetToDelete && assetToDelete.references.length > 0 && (
              <span className="block mt-2 text-gold-400/80">
                This asset is referenced in {assetToDelete.references.length} document(s). 
                All instances will be removed.
              </span>
            )}
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
