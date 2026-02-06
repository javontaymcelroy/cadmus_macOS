/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cadmus brand colors - pure blacks with golden accent
        ink: {
          50: '#e5e5e5',
          100: '#b3b3b3',
          200: '#8a8a8a',
          300: '#666666',
          400: '#4d4d4d',
          500: '#333333',
          600: '#262626',
          700: '#1a1a1a',
          800: '#121212',
          900: '#0a0a0a',
          950: '#050505',
        },
        parchment: {
          50: '#fdfcfb',
          100: '#faf8f5',
          200: '#f5f0e8',
          300: '#ede5d8',
          400: '#e2d5c1',
          500: '#d4c3a8',
        },
        // Golden yellow brand color
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        accent: {
          gold: '#fbbf24',
          sage: '#6b8e6b',
          navy: '#2d4a6f',
        }
      },
      fontFamily: {
        'display': ['Playfair Display', 'Georgia', 'serif'],
        'body': ['Source Serif Pro', 'Georgia', 'serif'],
        'mono': ['Space Mono', 'Menlo', 'monospace'],
        'ui': ['Kode Mono', 'monospace'],
      },
      fontSize: {
        'editor': ['18px', '1.75'],
      },
      spacing: {
        'sidebar': '280px',
        'panel': '320px',
      },
      boxShadow: {
        'panel': '0 0 40px rgba(0, 0, 0, 0.1)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      // Override focus ring to use gold
      ringColor: {
        DEFAULT: '#fbbf24',
      },
    },
  },
  plugins: [],
}
