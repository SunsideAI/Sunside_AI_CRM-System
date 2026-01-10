/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Sunside AI Farben
        'sunside': {
          primary: '#7C3AED',    // Lila (Hauptfarbe)
          secondary: '#1a1a2e',  // Dunkelblau
          accent: '#F59E0B',     // Orange
          light: '#F3F4F6',      // Hellgrau
          dark: '#111827',       // Fast Schwarz
        }
      },
      animation: {
        'wiggle': 'wiggle 0.5s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
