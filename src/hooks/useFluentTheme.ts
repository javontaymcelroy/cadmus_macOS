import { useProjectStore } from '../stores/projectStore'
import { cadmusDarkTheme, cadmusLightTheme } from '../utils/fluentTheme'

export function useFluentTheme() {
  const theme = useProjectStore(s => s.ui.theme)
  return theme === 'light' ? cadmusLightTheme : cadmusDarkTheme
}
