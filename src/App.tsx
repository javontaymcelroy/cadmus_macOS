import { useEffect } from 'react'
import { useProjectStore } from './stores/projectStore'
import { TemplatePicker } from './components/TemplatePicker'
import { AppShell } from './components/AppShell'
import { ImageGenerationModal } from './components/ImageGenerationModal'
import { useAutoSave } from './hooks/useAutoSave'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

function App() {
  const { currentProject, isLoading, initialize, initializeTheme } = useProjectStore()

  // Initialize hooks
  useAutoSave()
  useKeyboardShortcuts()

  // Initialize app and theme
  useEffect(() => {
    initialize()
    initializeTheme()
  }, [initialize, initializeTheme])

  // Prevent default drag/drop behavior globally for Electron
  // This prevents browser navigation when files are dropped outside of dropzones
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
    
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
    }
    
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)
    
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--border-default)', borderTopColor: 'var(--accent-gold)' }} />
          <p className="font-ui" style={{ color: 'var(--text-muted)' }}>Loading Cadmus...</p>
        </div>
      </div>
    )
  }

  if (!currentProject) {
    return <TemplatePicker />
  }

  return (
    <>
      <AppShell />
      <ImageGenerationModal />
    </>
  )
}

export default App
