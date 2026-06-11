/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required to enable instrumentation.ts startup hook in Next.js < 15
  
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['jsonwebtoken', 'bcryptjs', 'nodemailer'],
};

export default nextConfig;
