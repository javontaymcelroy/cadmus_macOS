import { useState } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import {
  AddRegular,
  LinkRegular,
  DeleteRegular,
  EditRegular
} from '@fluentui/react-icons'

interface WebLink {
  id: string
  title: string
  url: string
}

export function WebLinksPanel() {
  const { currentProject } = useProjectStore()
  const [links, setLinks] = useState<WebLink[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newUrl, setNewUrl] = useState('')

  const handleAddLink = () => {
    if (!newTitle.trim() || !newUrl.trim()) return
    
    const newLink: WebLink = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      url: newUrl.trim().startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`
    }
    
    setLinks(prev => [...prev, newLink])
    setNewTitle('')
    setNewUrl('')
    setIsAdding(false)
  }

  const handleEditLink = (id: string) => {
    const link = links.find(l => l.id === id)
    if (link) {
      setEditingId(id)
      setNewTitle(link.title)
      setNewUrl(link.url)
    }
  }

  const handleUpdateLink = () => {
    if (!editingId || !newTitle.trim() || !newUrl.trim()) return
    
    setLinks(prev => prev.map(link => 
      link.id === editingId 
        ? { ...link, title: newTitle.trim(), url: newUrl.trim().startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}` }
        : link
    ))
    setEditingId(null)
    setNewTitle('')
    setNewUrl('')
  }

  const handleDeleteLink = (id: string) => {
    setLinks(prev => prev.filter(link => link.id !== id))
  }

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank')
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setNewTitle('')
    setNewUrl('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editingId) {
        handleUpdateLink()
      } else {
        handleAddLink()
      }
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (!currentProject) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme-subtle bg-theme-header">
        <h2 className="text-xs font-ui font-medium uppercase tracking-wider text-theme-muted">
          Web Links
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className="btn-icon-modern w-7 h-7 flex items-center justify-center"
          title="Add Link"
        >
          <AddRegular className="w-4 h-4" />
        </button>
      </div>

      {/* Links list */}
      <div className="flex-1 overflow-auto p-2">
        {/* Add/Edit form */}
        {(isAdding || editingId) && (
          <div className="p-3 mb-2 rounded-lg bg-theme-hover border border-theme-subtle">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Link title"
              className="input-modern w-full text-sm mb-2"
              autoFocus
            />
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com"
              className="input-modern w-full text-sm mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={editingId ? handleUpdateLink : handleAddLink}
                disabled={!newTitle.trim() || !newUrl.trim()}
                className="flex-1 py-1.5 text-xs font-ui font-medium text-theme-accent bg-theme-active border border-theme-default rounded-md hover:bg-theme-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {editingId ? 'Update' : 'Add'}
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs font-ui text-theme-muted hover:text-theme-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Links */}
        {links.length === 0 && !isAdding ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-theme-hover flex items-center justify-center mb-4">
              <LinkRegular className="w-6 h-6 text-theme-muted" />
            </div>
            <p className="text-sm text-theme-muted font-ui font-medium mb-1">No web links</p>
            <button
              onClick={() => setIsAdding(true)}
              className="text-xs text-theme-accent font-ui font-medium transition-colors hover:opacity-80"
            >
              Add link
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {links.map((link) => (
              <div
                key={link.id}
                className="list-item-modern group flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                onClick={() => handleOpenLink(link.url)}
              >
                <div className="w-7 h-7 rounded-md bg-theme-hover flex items-center justify-center shrink-0">
                  <LinkRegular className="w-3.5 h-3.5 text-theme-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-theme-secondary font-ui font-medium truncate group-hover:text-theme-primary transition-colors">
                    {link.title}
                  </p>
                  <p className="text-[10px] text-theme-muted font-ui truncate">
                    {link.url}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditLink(link.id)
                    }}
                    className="btn-icon-modern p-1"
                    title="Edit"
                  >
                    <EditRegular className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteLink(link.id)
                    }}
                    className="btn-icon-modern p-1 hover:text-red-400/80"
                    title="Delete"
                  >
                    <DeleteRegular className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
