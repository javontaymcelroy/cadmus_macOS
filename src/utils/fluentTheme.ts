import { createDarkTheme, createLightTheme } from '@fluentui/react-components'
import type { BrandVariants } from '@fluentui/react-components'

const brandColors: BrandVariants = {
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
  160: '#fbbf24',
}

export const cadmusDarkTheme = {
  ...createDarkTheme(brandColors),
  colorNeutralBackground1: 'transparent',
  colorNeutralBackground1Hover: '#2a2a2a',
  colorNeutralBackground1Pressed: '#333333',
  colorNeutralBackground2: 'transparent',
  colorNeutralBackground3: 'transparent',
  colorSubtleBackground: 'transparent',
  colorSubtleBackgroundHover: '#2a2a2a',
  colorNeutralForeground1: '#ffffff',
  colorNeutralForeground2: 'rgba(255,255,255,0.8)',
  colorNeutralStroke1: '#333333',
}

export const cadmusLightTheme = {
  ...createLightTheme(brandColors),
  colorNeutralBackground1: 'transparent',
  colorNeutralBackground1Hover: 'rgba(0, 0, 0, 0.04)',
  colorNeutralBackground1Pressed: 'rgba(0, 0, 0, 0.07)',
  colorNeutralBackground2: 'transparent',
  colorNeutralBackground3: 'transparent',
  colorSubtleBackground: 'transparent',
  colorSubtleBackgroundHover: 'rgba(0, 0, 0, 0.04)',
  colorNeutralForeground1: '#1a1a1a',
  colorNeutralForeground2: 'rgba(0, 0, 0, 0.72)',
  colorNeutralStroke1: 'rgba(0, 0, 0, 0.15)',
}
