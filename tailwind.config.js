/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Colores para modo oscuro
        darkBg: '#0d1523',
        darkCard: '#141e2e',
        darkAccent: '#0e88c9',
        
        // Colores para modo claro
        lightBg: '#f8fafc',
        lightCard: '#ffffff',
        lightAccent: '#0369a1',
      },
    },
  },
  plugins: [],
};
