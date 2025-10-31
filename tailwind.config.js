// tailwind.config.js (Di root folder proyek)

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Ini penting agar semua file di SRC terpindai
    './src/**/*.{js,ts,jsx,tsx,mdx}', 
    // Baris default dari instalasi Next.js biasanya juga ada
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Pastikan font Poppins terdaftar di theme
      fontFamily: {
        sans: ['var(--font-poppins)', 'sans-serif'],
      },
      // ... lainnya
    },
  },
  plugins: [],
};