import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  ...(isDev && {
    experimental: {
      // @ts-ignore: allowedDevOrigins is an undocumented/experimental feature in Turbopack
      allowedDevOrigins: [
        'localhost:3000', 
        'localhost:9000',
        'localhost:9002', 
        '9000-firebase-scparkingcarduse-1774317835856.cluster-y75up3teuvc62qmnwys4deqv6y.cloudworkstations.dev',
        '*.cloudworkstations.dev', 
        '*.idx.google.com'
      ],
    },
  }),
};

export default nextConfig;
