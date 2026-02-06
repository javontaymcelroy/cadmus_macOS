/**
 * AssetPicker
 * 
 * Modal dialog for selecting an asset to create a new storyboard shot.
 */

import { useState, useCallback } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { clsx } from 'clsx'
import type { Asset } from '../../types/project'
import {
  DismissRegular,
  CheckmarkRegular
} from '@fluentui/react-icons'

interface AssetPickerProps {
  assets: Asset[]
  onSelect: (assetId: string) => void
  onClose: () => void
}

export function AssetPicker({ assets, onSelect, onClose }: AssetPickerProps) {
  const { currentProject } = useProjectStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleSelect = useCallback(() => {
    if (selectedId) {
      onSelect(selectedId)
    }
  }, [selectedId, onSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && selectedId) {
      handleSelect()
    }
  }, [onClose, selectedId, handleSelect])

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div 
        className="asset-picker-modal bg-theme-elevated border border-theme-default rounded-xl shadow-2xl w-[400px] max-h-[500px] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-subtle">
          <h3 className="text-sm font-ui font-semibold text-theme-primary">Select Image</h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-theme-muted hover:text-theme-primary hover:bg-theme-hover transition-colors"
          >
            <DismissRegular className="w-4 h-4" />
          </button>
        </div>

        {/* Asset Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {assets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-theme-secondary font-ui">No images in assets</p>
              <p className="text-xs text-theme-muted font-ui mt-1">
                Add images to your project assets first
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {assets.map(asset => {
                const assetUrl = currentProject 
                  ? window.api.utils.getAssetUrl(currentProject.path, asset.path)
                  : null

                return (
                  <button
                    key={asset.id}
                    onClick={() => setSelectedId(asset.id)}
                    className={clsx(
                      'aspect-square rounded-lg overflow-hidden border-2 transition-all',
                      'focus:outline-none focus:ring-2 focus:ring-amber-400/50',
                      selectedId === asset.id
                        ? 'border-amber-400 ring-2 ring-amber-400/30'
                        : 'border-transparent hover:border-theme-default'
                    )}
                  >
                    {assetUrl ? (
                      <img
                        src={assetUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-theme-tertiary flex items-center justify-center">
                        <span className="text-[10px] text-theme-muted">{asset.name}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-theme-subtle">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm font-ui text-theme-secondary hover:text-theme-primary hover:bg-theme-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedId}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-ui font-medium flex items-center gap-1.5 transition-colors',
              selectedId
                ? 'bg-amber-400 text-black hover:bg-amber-300'
                : 'bg-theme-hover text-theme-muted cursor-not-allowed'
            )}
          >
            <CheckmarkRegular className="w-4 h-4" />
            Add Shot
          </button>
        </div>
      </div>
    </div>
  )
}
