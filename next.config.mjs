/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three и связанные пакеты поставляют ESM — транспилируем для стабильной сборки
  transpilePackages: [
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    '@react-three/xr',
    '@react-three/postprocessing',
  ],
};

export default nextConfig;
