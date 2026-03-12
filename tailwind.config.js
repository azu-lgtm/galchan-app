/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        base: '#FDF4F6',
        secondary: '#EDD5D9',
        accent: '#B07A85',
        'accent-dark': '#8E5C68',
        'text-primary': '#3D2B2E',
        'text-secondary': '#8E5C68',
        'border-soft': '#DBBFC4',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Hiragino Sans"',
          '"Hiragino Kaku Gothic ProN"',
          '"Noto Sans JP"',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 2px 12px rgba(61, 43, 46, 0.08)',
        'soft-md': '0 4px 20px rgba(61, 43, 46, 0.10)',
      },
    },
  },
  plugins: [],
}
