/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kt: {
          50: '#f2f8fe',
          100: '#e3f0fc',
          200: '#c8e1f7',
          300: '#9ccaf0',
          400: '#5aa8e6',
          500: '#1e8ad8',
          600: '#0a72c0',
          700: '#085c9c',
          800: '#0b4b7d',
          900: '#0d3d66',
        },
        line: '#d4e6f6',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'] },
    },
  },
  plugins: [],
};
