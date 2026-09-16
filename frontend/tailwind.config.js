/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ville: {
          50: '#eef6ff',
          100: '#d9ebff',
          500: '#0055A4',
          600: '#004a8f',
          700: '#003c74',
        },
      },
    },
  },
  plugins: [],
};
