import type { Template } from '../../types/project'
import {
  DocumentRegular,
  NotebookRegular,
  EditRegular,
  VideoRegular,
  HatGraduationRegular
} from '@fluentui/react-icons'

interface TemplateCardProps {
  template: Template
  onClick: () => void
  delay?: number
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  document: DocumentRegular,
  notebook: NotebookRegular,
  edit: EditRegular,
  video: VideoRegular,
  academic: HatGraduationRegular
}

export function TemplateCard({ template, onClick, delay = 0 }: TemplateCardProps) {
  const IconComponent = iconMap[template.icon] || DocumentRegular

  return (
    <button
      onClick={onClick}
      className="template-card p-8 text-left group animate-slide-up focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-default focus-visible:ring-offset-2 h-full flex flex-col min-h-[320px]"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Circular Icon Container */}
      <div className="template-icon-container mb-auto">
        <IconComponent className="w-6 h-6 text-theme-secondary group-hover:text-theme-primary transition-colors duration-300" />
      </div>

      {/* Content area */}
      <div className="mt-auto">
        {/* Title */}
        <h3 className="text-lg font-ui font-medium text-theme-primary mb-2 group-hover:text-theme-accent transition-colors duration-300">
          {template.name}
        </h3>

        {/* Description */}
        <p className="text-sm text-theme-secondary font-ui leading-relaxed group-hover:text-theme-primary transition-colors duration-300 mb-5 line-clamp-3">
          {template.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {template.enabledPasses.slice(0, 3).map(pass => (
            <span
              key={pass}
              className="px-2.5 py-1 bg-theme-active border border-theme-subtle rounded text-xs font-ui text-theme-secondary group-hover:text-theme-primary group-hover:border-theme-default transition-colors"
            >
              {pass.replace(/-/g, ' ')}
            </span>
          ))}
          {template.enabledPasses.length > 3 && (
            <span className="px-2.5 py-1 text-xs font-ui text-theme-muted">
              +{template.enabledPasses.length - 3}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
