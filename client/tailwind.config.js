/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        schneider: {
          green: '#00E676',       // Vibrant Electric Green accent
          brand: '#009639',       // Official Schneider Green
          darkgreen: '#007A2E',   // Darker shade for hover states
          lightgreen: '#E6F9F0',  // Soft light green background
          cyber: '#0F172A',       // Cyber Security dark navy header text
          dark: '#030712',        // Obsidian dark background
          card: '#FFFFFF',        // White surface card
        },
        wrong: '#EF4444',         // Reserved strictly for wrong answer feedback
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(0, 230, 118, 0.6)' },
          '50%': { boxShadow: '0 0 35px rgba(0, 230, 118, 1)' },
        },
        shakeRed: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-12px)' },
          '40%, 80%': { transform: 'translateX(12px)' },
        },
        flashRed: {
          '0%, 100%': { backgroundColor: 'rgba(239, 68, 68, 0.95)' },
          '50%': { backgroundColor: 'rgba(185, 28, 28, 0.95)' },
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 1.5s infinite ease-in-out',
        'shake-red': 'shakeRed 0.4s ease-in-out',
        'flash-red': 'flashRed 0.5s infinite ease-in-out',
      }
    },
  },
  plugins: [],
};
