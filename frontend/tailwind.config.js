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
        fadeIn: 'fadeIn 0.35s ease-out both',
        scaleUp: 'scaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        pop: 'pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        shake: 'shake 0.5s ease-in-out both',
        'glow-pulse': 'glowPulse 1.6s ease-in-out infinite',
        'ring-ping': 'ringPing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite',
        burst: 'burst 0.9s ease-out both',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleUp: {
          from: { opacity: '0', transform: 'scale(0.85)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        pop: {
          '0%': { transform: 'scale(0.4)', opacity: '0' },
          '60%': { transform: 'scale(1.12)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-8px)' },
          '40%, 80%': { transform: 'translateX(8px)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 30px 6px rgba(239, 68, 68, 0.45)' },
          '50%': { boxShadow: '0 0 60px 18px rgba(239, 68, 68, 0.75)' },
        },
        ringPing: {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '80%, 100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        burst: {
          '0%': { transform: 'scale(0.2)', opacity: '0.9' },
          '100%': { transform: 'scale(2.6)', opacity: '0' },
        },
      }
    },
  },
  plugins: [],
};
