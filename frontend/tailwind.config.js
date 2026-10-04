/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        arena: {
          dark: '#0A0F1D',
          card: '#131D31',
          elevated: '#1E2B45',
          border: '#2A3B5C',
          gold: '#FACC15',
          silver: '#CBD5E1',
          bronze: '#F97316',
        },
        quadrant: {
          red: '#EF4444',
          blue: '#3B82F6',
          amber: '#F59E0B',
          green: '#10B981',
        },
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounce 2s infinite',
      }
    },
  },
  plugins: [],
};
