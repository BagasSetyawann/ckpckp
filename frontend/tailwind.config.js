/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fb',
          400: '#36aaf6',
          500: '#0c8fe7',
          600: '#0070c5',
          700: '#0058a0',
          800: '#004b84',
          900: '#003f6e',
          950: '#002848',
        },
        secondary: {
          50: '#f5f7f9',
          100: '#eaeff4',
          200: '#d3dde7',
          300: '#adc0d2',
          400: '#819db8',
          500: '#5f7e9f',
          600: '#4b6583',
          700: '#3d526b',
          800: '#35465a',
          900: '#2e3b4c',
        },
        government: {
          red: '#c1272d',
          gold: '#f5a623',
          blue: '#003580',
          green: '#1a7a4a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [],
}
