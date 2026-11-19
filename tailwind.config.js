/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#13161b',
        surface: '#191d23',
        raised: '#1e232a',
        ink: '#e8ecf1',
        mute: '#8b95a5',
        emerald: { vault: '#10b981' },
        amber: { vault: '#f59e0b' },
        coral: { vault: '#ff5d5d' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
