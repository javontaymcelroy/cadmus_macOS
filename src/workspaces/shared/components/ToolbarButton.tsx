import { clsx } from 'clsx'

export interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}

export function ToolbarButton({ onClick, isActive, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'p-2 rounded-md transition-colors',
        isActive 
          ? 'bg-theme-active text-theme-accent' 
          : 'text-theme-secondary hover:text-theme-accent hover:bg-theme-hover',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )
}

export function ToolbarDivider() {
  return <div className="w-px h-6 bg-theme-tertiary mx-1" style={{ backgroundColor: 'var(--border-default)' }} />
}
