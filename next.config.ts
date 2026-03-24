import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  experimental: {
    allowedDevOrigins: [
      'localhost:3000', 
      'localhost:9000',
      'localhost:9002', 
      '9000-firebase-scparkingcarduse-1774317835856.cluster-y75up3teuvc62qmnwys4deqv6y.cloudworkstations.dev',
      '*.cloudworkstations.dev', 
      '*.idx.google.com'
    ],
  },
};

export default nextConfig;
