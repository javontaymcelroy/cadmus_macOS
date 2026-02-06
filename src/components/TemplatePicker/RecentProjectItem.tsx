import { useState } from 'react'
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
import {
  FolderRegular,
  MoreHorizontalRegular,
  EditRegular,
  DeleteRegular
} from '@fluentui/react-icons'

interface RecentProjectItemProps {
  name: string
  path: string
  onOpen: () => void
  onRename: (newName: string) => void
  onDelete: () => void
}

export function RecentProjectItem({ name, path, onOpen, onRename, onDelete }: RecentProjectItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(name)

  const handleRename = () => {
    if (editName.trim() && editName !== name) {
      onRename(editName.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setEditName(name)
      setIsEditing(false)
    }
  }

  const handleDeleteConfirm = () => {
    onDelete()
    setIsDeleteDialogOpen(false)
  }

  return (
    <FluentProvider theme={darkTheme} style={{ background: 'transparent' }}>
      <Menu
        open={isMenuOpen}
        onOpenChange={(_, data) => setIsMenuOpen(data.open)}
        positioning="below-end"
      >
        <MenuTrigger disableButtonEnhancement>
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onContextMenu={(e) => {
              e.preventDefault()
              setIsMenuOpen(true)
            }}
            onClick={onOpen}
            className={`list-item-modern w-full px-3 py-2.5 text-left cursor-pointer transition-all duration-200 ${
              isMenuOpen 
                ? 'active' 
                : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                <FolderRegular className="w-4 h-4 text-white/50" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="input-modern w-full text-sm py-1"
                  />
                ) : (
                  <>
                    <p className="text-sm font-ui text-white/80 truncate">{name}</p>
                    <p className="text-xs font-ui text-white/30 truncate mt-0.5">{path}</p>
                  </>
                )}
              </div>
              {(isHovered || isMenuOpen) && !isEditing && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsMenuOpen(true)
                  }}
                  className="btn-icon-modern p-1.5"
                >
                  <MoreHorizontalRegular className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </MenuTrigger>

        <MenuPopover style={{ 
          background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.98) 0%, rgba(18, 18, 18, 0.99) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)', 
          borderRadius: '12px',
          boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.05), 0 4px 24px rgba(0, 0, 0, 0.5), 0 8px 48px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(20px)'
        }}>
          <MenuList style={{ backgroundColor: 'transparent' }}>
            <MenuItem
              icon={<EditRegular />}
              onClick={(e) => {
                e.stopPropagation()
                setIsEditing(true)
                setIsMenuOpen(false)
              }}
              style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.8)' }}
            >
              Rename
            </MenuItem>
            <MenuItem
              icon={<DeleteRegular />}
              onClick={(e) => {
                e.stopPropagation()
                setIsDeleteDialogOpen(true)
                setIsMenuOpen(false)
              }}
              style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.8)' }}
            >
              Delete
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(_, data) => setIsDeleteDialogOpen(data.open)}
      >
        <DialogSurface style={{ 
          background: 'linear-gradient(135deg, rgba(18, 18, 18, 0.98) 0%, rgba(10, 10, 10, 0.99) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.05), 0 8px 40px rgba(0, 0, 0, 0.6)'
        }}>
          <DialogBody>
            <DialogTitle style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>Move to Trash?</DialogTitle>
            <DialogContent style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Are you sure you want to delete "{name}"? The project folder will be moved to Trash and can be recovered from there.
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setIsDeleteDialogOpen(false)}
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
