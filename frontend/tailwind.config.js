/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#0F1117',
          50: '#f4f4f6',
          100: '#e8e9ed',
          200: '#c5c8d1',
          300: '#9ca2b0',
          400: '#6b7384',
          500: '#4a5264',
          600: '#343b4f',
          700: '#252c3e',
          800: '#181e2f',
          900: '#0F1117',
        },
        gold: {
          DEFAULT: '#C9A84C',
          light: '#E8C97A',
          dark: '#9B7A2E',
        },
        cream: '#F7F4EE',
        parchment: '#EDE9DF',
        success: {
          DEFAULT: '#1d6b4a',
          muted: '#e8f5ef',
        },
        danger: {
          DEFAULT: '#b42318',
          muted: '#fef2f2',
        },
      },
      boxShadow: {
        panel: '0 1px 3px rgba(15, 17, 23, 0.06)',
        soft: '0 4px 24px -6px rgba(15, 17, 23, 0.12), 0 2px 8px -4px rgba(15, 17, 23, 0.06)',
        lift: '0 8px 30px -8px rgba(15, 17, 23, 0.14)',
      },
      transitionDuration: {
        400: '400ms',
      },
    },
  },
  plugins: [],
}
