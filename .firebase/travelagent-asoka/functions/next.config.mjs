// next.config.mjs
var nextConfig = {
  reactStrictMode: true,
  experimental: {
    // tambahkan opsi experimental kamu bila ada
  },
  images: {
    // contoh: remotePatterns: [{ protocol: 'https', hostname: '**' }]
  }
};
var next_config_default = nextConfig;
export {
  next_config_default as default
};
