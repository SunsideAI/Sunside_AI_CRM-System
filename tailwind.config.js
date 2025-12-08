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
      }
    },
  },
  plugins: [],
}
