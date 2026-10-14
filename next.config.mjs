import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** LAN IP for testing on phone/Mac Safari (ipconfig → IPv4). Override via LAN_DEV_HOST in .env.local */
const lanDevHost = process.env.LAN_DEV_HOST || '192.168.100.200';

const cpuCount = typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
// Default webpack parallelism (~100) blew the Windows heap on large ERP pages.
// Forcing 1 worker made every localhost navigation recompile in series. 4 is the middle.
const devCompileWorkers = Math.max(2, Math.min(4, cpuCount || 2));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Off: Next 16 Turbopack panics on Windows ("Panic in async function" / PoisonError).
  // Dev server uses webpack (`npm run dev` → next dev --webpack). Do not re-enable Turbopack.
  reactCompiler: false,

  // Keep webpack scoped to this app when a parent package-lock.json exists.
  outputFileTracingRoot: __dirname,

  // Required when opening dev server as http://<LAN-IP>:3000 (not localhost) — otherwise blank page
  allowedDevOrigins: [lanDevHost, `${lanDevHost}:3000`],

  // Performance optimizations
  compress: true,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,

  // Keep recently opened screens compiled. A 15s / 2-page buffer recompiled almost every click.
  onDemandEntries: {
    maxInactiveAge: 3 * 60 * 1000,
    pagesBufferLength: 6,
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.wasabisys.com',
      },
      {
        protocol: 'https',
        hostname: '**.idrivee2.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [75, 85], // Allow quality 75 and 85
    minimumCacheTTL: 31536000, // 1 year cache for optimized images
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Headers for static assets
  async headers() {
    return [
      {
        source: '/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/assets/employee/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400', // 1 day for employee assets
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'geolocation=*',
          },
        ],
      },
    ];
  },

  // Route aliases for older / mistyped vehicle links
  async rewrites() {
    return [
      {
        source: '/default-avatar.png',
        destination: '/default-avatar.svg',
      },
      {
        source: '/favicon.ico',
        destination: '/favicon.png',
      },
    ];
  },

  async redirects() {
    return [
      {
        source: '/Settings/User/:userId/edit',
        destination: '/Settings/User/edit/:userId',
        permanent: false,
      },
      {
        source: '/asset/vehicle',
        destination: '/HRM/Asset/Vehicle/dashboard',
        permanent: false,
      },
      {
        source: '/asset/page/vehicle',
        destination: '/HRM/Asset/Vehicle/dashboard',
        permanent: false,
      },
    ];
  },

  // Experimental optimizations
  experimental: {
    optimizeCss: false, // Disabled due to 'unsupported color function lab' error
    optimizePackageImports: ['lucide-react', 'react-phone-input-2', 'recharts', 'date-fns'],
    webpackMemoryOptimizations: true,
    cpus: devCompileWorkers,
    preloadEntriesOnStart: false,
    serverSourceMaps: false,
  },

  // Webpack optimizations
  webpack: (config, { isServer, dev }) => {
    // Production builds stay single-threaded so a full ERP compile does not exhaust the Windows heap.
    // Dev uses a few workers so localhost is not stuck compiling one module at a time.
    config.parallelism = dev ? devCompileWorkers : 1;

    if (dev) {
      config.watchOptions = {
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
        aggregateTimeout: 300,
      };
      if (config.cache && typeof config.cache === 'object') {
        config.cache = {
          ...config.cache,
          compression: false,
          maxMemoryGenerations: 1,
        };
      }
    }

    if (!isServer && !dev) {
      // Production client-side optimizations
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk for node_modules
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // Common chunk for shared code
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },

  // Keep webpack as the only bundler. `npm run build` passes --webpack (Next 16
  // defaults to Turbopack, which errors when a webpack() config is present).
};

export default nextConfig;
