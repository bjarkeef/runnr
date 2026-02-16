import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Optimize production builds
  poweredByHeader: false,
  compress: true, // Enables gzip compression automatically
  
  // Experimental features for better performance
  experimental: {
    optimizePackageImports: [
      'lucide-react', 
      'recharts', 
      '@radix-ui/react-avatar', 
      '@radix-ui/react-dialog', 
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      'react-leaflet',
      'date-fns'
    ],
  },
  
  // Image optimization (if needed in future)
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
