/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#d9283f',
          600: '#b91c1c',
          700: '#991b1b'
        }
      }
    }
  },
  plugins: []
};

