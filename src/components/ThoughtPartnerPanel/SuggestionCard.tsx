import { SearchRegular, QuestionCircleRegular, WarningRegular, LightbulbRegular } from '@fluentui/react-icons'
import { clsx } from 'clsx'

interface SuggestionCardProps {
  title: string
  description: string
  category: string
  onClick: () => void
  textSize?: number
}

const FONT_FAMILY = 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif'

const categoryConfig: Record<string, { icon: typeof SearchRegular; color: string; bg: string }> = {
  explore: { icon: SearchRegular, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  question: { icon: QuestionCircleRegular, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  risk: { icon: WarningRegular, color: 'text-red-400', bg: 'bg-red-400/10' },
  idea: { icon: LightbulbRegular, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
}

export function SuggestionCard({ title, description, category, onClick, textSize = 13 }: SuggestionCardProps) {
  const config = categoryConfig[category] || categoryConfig.explore
  const Icon = config.icon

  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex flex-col gap-2 p-3 rounded-lg border border-theme-subtle',
        'hover:border-theme-default hover:bg-theme-active transition-all text-left',
        'cursor-pointer group'
      )}
      style={{ fontFamily: FONT_FAMILY }}
    >
      <div className={clsx('w-7 h-7 rounded-md flex items-center justify-center', config.bg)}>
        <Icon className={clsx('w-4 h-4', config.color)} />
      </div>
      <div className="font-semibold text-theme-primary group-hover:text-theme-accent transition-colors"
           style={{ fontSize: textSize - 1 }}>
        {title}
      </div>
      <div className="text-theme-muted leading-relaxed"
           style={{ fontSize: textSize - 2 }}>
        {description}
      </div>
    </button>
  )
}
