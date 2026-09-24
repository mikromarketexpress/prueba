/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        's-bg': '#080d18',
        's-neon': '#00e676',
        's-glass': 'rgba(255, 255, 255, 0.05)',
      },
      borderRadius: {
        's-standard': '10px',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}

