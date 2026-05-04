/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required to enable instrumentation.ts startup hook in Next.js < 15
  experimental: {
    instrumentationHook: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['pg', 'pg-pool', '@prisma/adapter-pg', '@prisma/client', '.prisma/client', 'jsonwebtoken', 'bcryptjs', 'nodemailer'],
};

export default nextConfig;
