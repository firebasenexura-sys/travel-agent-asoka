/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pastikan Next pakai tsconfig root yang sudah kita batasi cakupannya
  typescript: {
    tsconfigPath: './tsconfig.json'
  },
  // supaya build tidak gagal hanya karena masalah ESLint
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    // taruh opsi experimental lain di sini jika diperlukan
  },
  images: {
    // contoh: remotePatterns: [{ protocol: 'https', hostname: '**' }]
  }
};

export default nextConfig;
