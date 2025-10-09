/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
        'display': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        'desert': {
          50: '#fdf8f3',
          100: '#f9ede0',
          200: '#f2d8c0',
          300: '#e8bc95',
          400: '#dc9968',
          500: '#d17d47',
          600: '#c3653c',
          700: '#a25034',
          800: '#824131',
          900: '#6a372a',
        },
        'ethereal': {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        }
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, rgba(12, 74, 110, 0.8) 0%, rgba(106, 55, 42, 0.6) 100%)',
        'glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
}
