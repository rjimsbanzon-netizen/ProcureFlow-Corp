/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { brand: {
    50: '#f0f9ff', 100: '#e0f2fe', 500: '#a64f32',
    600: '#a64f32', 700: '#873e27', 800: '#713722', 900: '#592c1f'
  } } } }, plugins: []
};
