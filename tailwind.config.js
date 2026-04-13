/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // CRM Intelligence Editorial Design System
      colors: {
        // Primary Brand Colors
        'primary': {
          DEFAULT: '#460E74',
          container: '#5E2C8C',
          fixed: '#F0DBFF',
          'fixed-dim': '#D4BBEB',
        },
        // Secondary Accent
        'secondary': {
          DEFAULT: '#8127CF',
          container: '#E8D5F9',
          'fixed-variant': '#6B21A8',
        },
        // Tertiary (for inactive states)
        'tertiary': {
          DEFAULT: '#7C7C8A',
          container: '#E5E5EA',
        },
        // Surface Hierarchy
        'surface': {
          DEFAULT: '#F9F9FF',        // Canvas background
          bright: '#FFFFFF',
          dim: '#F0F0F8',
          container: '#F0F3FF',      // Primary sectioning
          'container-low': '#F0F3FF',
          'container-lowest': '#FFFFFF', // Actionable cards
          'container-high': '#E8EAF6',
          variant: '#E1E2EC',
        },
        // On-colors (Text)
        'on': {
          primary: '#FFFFFF',
          'primary-container': '#F0DBFF',
          secondary: '#FFFFFF',
          'secondary-container': '#460E74',
          surface: '#151C27',        // Main text - NOT pure black
          'surface-variant': '#44474F',
          background: '#151C27',
        },
        // Semantic colors
        'success': {
          DEFAULT: '#10B981',
          container: '#D1FAE5',
        },
        'warning': {
          DEFAULT: '#F59E0B',
          container: '#FEF3C7',
        },
        'error': {
          DEFAULT: '#EF4444',
          container: '#FEE2E2',
        },
        // Outline (Ghost Border)
        'outline': {
          DEFAULT: '#79747E',
          variant: '#CAC4D0',
        },
        // Legacy support (transition)
        'sunside': {
          primary: '#460E74',
          secondary: '#8127CF',
          accent: '#F59E0B',
          light: '#F9F9FF',
          dark: '#151C27',
        }
      },
      // Typography
      fontFamily: {
        'display': ['Manrope', 'sans-serif'],  // Headlines
        'body': ['Inter', 'sans-serif'],        // UI & Body
        'sans': ['Inter', 'sans-serif'],        // Default
      },
      fontSize: {
        'display-lg': ['3.5rem', { lineHeight: '1.2', fontWeight: '700' }],
        'display-md': ['2.75rem', { lineHeight: '1.2', fontWeight: '700' }],
        'display-sm': ['2.25rem', { lineHeight: '1.25', fontWeight: '600' }],
        'headline-lg': ['2rem', { lineHeight: '1.3', fontWeight: '600' }],
        'headline-md': ['1.75rem', { lineHeight: '1.3', fontWeight: '600' }],
        'headline-sm': ['1.5rem', { lineHeight: '1.35', fontWeight: '600' }],
        'title-lg': ['1.375rem', { lineHeight: '1.4', fontWeight: '500' }],
        'title-md': ['1rem', { lineHeight: '1.5', fontWeight: '500' }],
        'title-sm': ['0.875rem', { lineHeight: '1.5', fontWeight: '500' }],
        'body-lg': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['0.875rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['0.75rem', { lineHeight: '1.5', fontWeight: '400' }],
        'label-lg': ['0.875rem', { lineHeight: '1.4', fontWeight: '500' }],
        'label-md': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        'label-sm': ['0.6875rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      // Border Radius (Soft AI vibe)
      borderRadius: {
        'sm': '0.5rem',   // 8px
        'md': '0.75rem',  // 12px - Primary for buttons
        'lg': '1rem',     // 16px
        'xl': '1.25rem',  // 20px
        '2xl': '1.5rem',  // 24px
        '3xl': '2rem',    // 32px
      },
      // Box Shadow (Ambient Light style)
      boxShadow: {
        'ambient-sm': '0 4px 20px rgba(21, 28, 39, 0.04)',
        'ambient-md': '0 8px 40px rgba(21, 28, 39, 0.05)',
        'ambient-lg': '0 12px 60px rgba(21, 28, 39, 0.06)',
        'ambient-xl': '0 20px 80px rgba(21, 28, 39, 0.08)',
        'glow-primary': '0 0 40px rgba(70, 14, 116, 0.15)',
        'glow-secondary': '0 0 40px rgba(129, 39, 207, 0.15)',
        'card': '0 4px 24px rgba(21, 28, 39, 0.04)',
        'card-hover': '0 8px 32px rgba(21, 28, 39, 0.06)',
        'none': 'none',
      },
      // Backdrop Blur (Glassmorphism)
      backdropBlur: {
        'glass': '12px',
        'glass-lg': '20px',
      },
      // Background Image (Gradients)
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #460E74 0%, #5E2C8C 100%)',
        'gradient-secondary': 'linear-gradient(135deg, #8127CF 0%, #460E74 100%)',
        'gradient-surface': 'linear-gradient(180deg, #F9F9FF 0%, #F0F3FF 100%)',
        'gradient-card': 'linear-gradient(135deg, #FFFFFF 0%, #F9F9FF 100%)',
      },
      // Spacing
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      // Animation
      animation: {
        'wiggle': 'wiggle 0.5s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      // Transition
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
    },
  },
  plugins: [],
}
