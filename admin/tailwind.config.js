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
        dark: {
          bg: '#0A0B0E',
          surface: '#12141A',
          card: '#181B22',
          border: '#232733',
          hover: '#1F2430',
        },
        brand: {
          cyan: '#00F2FE',
          pink: '#FE2C55',
          blue: '#25F4EE',
          purple: '#7928CA',
          emerald: '#10B981',
          amber: '#F59E0B',
          red: '#EF4444',
        },
      },
    },
  },
  plugins: [],
};
