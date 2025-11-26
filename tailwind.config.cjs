/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        celeste: {
          50: '#f0faff',
          100: '#e0f7ff',
          200: '#b9ecff',
          300: '#8adfff',
          400: '#5ccfff',
          500: '#22c7f2',
          600: '#12add6',
          700: '#0c89aa',
          800: '#0b6f89',
          900: '#0c5a71',
        },
      },
    },
  },
  plugins: [],
};
