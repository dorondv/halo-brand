import type { NextConfig } from 'next';
import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import './src/libs/Env';

// Define the base Next.js configuration
const baseConfig: NextConfig = {
  devIndicators: {
    position: 'bottom-right',
  },
  poweredByHeader: false,
  reactStrictMode: true,
  reactCompiler: true,
  outputFileTracingIncludes: {
    '/': ['./migrations/**/*'],
  },
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
  // Externalize server packages to avoid version conflicts
  serverExternalPackages: ['require-in-the-middle', 'chartjs-node-canvas', 'canvas'],
  // Optimize middleware bundle size by excluding unnecessary dependencies
  webpack: (config, { isServer }) => {
    // Ensure tailwindcss resolves correctly from the project directory
    const projectRoot = process.cwd();
    try {
      const tailwindcssPath = require.resolve('tailwindcss', { paths: [`${projectRoot}/node_modules`] });
      config.resolve.alias = {
        ...config.resolve.alias,
        tailwindcss: tailwindcssPath,
      };
    } catch {
      // Fallback if require.resolve fails
      console.warn('Could not resolve tailwindcss, using default resolution');
    }

    // Ensure resolve paths include the project root and node_modules
    if (!config.resolve.modules) {
      config.resolve.modules = [];
    }
    config.resolve.modules = [
      ...new Set([
        ...config.resolve.modules,
        `${projectRoot}/node_modules`,
        'node_modules',
      ]),
    ];

    if (!isServer) {
      return config;
    }

    // Explicitly externalize native modules to prevent webpack from bundling them
    // These modules use native bindings that cannot be bundled
    const nativeModules = ['chartjs-node-canvas', 'canvas'];

    if (Array.isArray(config.externals)) {
      // Preserve existing externals and add new ones
      config.externals.push(...nativeModules);
    } else if (typeof config.externals === 'function') {
      // Wrap function-based externals to also handle native modules
      // Webpack externals functions can have different signatures:
      // - Webpack 4: (context, request, callback) => void
      // - Webpack 5: (context, request) => string | undefined
      // - Webpack 5: ({ context, request, ... }) => string | undefined
      const originalExternals = config.externals;
      config.externals = (arg1: any, arg2?: any, arg3?: any) => {
        // Determine if this is webpack 5 object style: ({ context, request })
        const isObjectStyle = arg1 && typeof arg1 === 'object' && 'request' in arg1;
        const request = isObjectStyle ? arg1.request : arg2;

        // First check if it's one of our native modules
        if (request && nativeModules.includes(request)) {
          const externalValue = `commonjs ${request}`;

          if (isObjectStyle) {
            // Webpack 5 object style - return the external value
            return externalValue;
          } else if (typeof arg3 === 'function') {
            // Webpack 4 callback style
            arg3(null, externalValue);
            return;
          } else {
            // Webpack 5 function style - return the external value
            return externalValue;
          }
        }

        // Otherwise, delegate to the original function
        if (isObjectStyle) {
          return originalExternals(arg1);
        } else if (typeof arg3 === 'function') {
          return originalExternals(arg1, arg2, arg3);
        } else {
          return originalExternals(arg1, arg2);
        }
      };
    } else if (typeof config.externals === 'object' && config.externals !== null) {
      // Handle object-based externals
      config.externals['chartjs-node-canvas'] = 'commonjs chartjs-node-canvas';
      config.externals.canvas = 'commonjs canvas';
    } else {
      // Initialize as array only if externals is undefined/null
      config.externals = nativeModules;
    }

    // For Edge Runtime (middleware), optimize bundle size
    // Reduce middleware bundle size by externalizing heavy dependencies when possible
    // Note: This is handled via dynamic imports in middleware.ts
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        port: '',
        pathname: '/**',
      },
      // OAuth provider avatar domains
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'graph.facebook.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'platform-lookaside.fbsbx.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        port: '',
        pathname: '/**',
      },
      // Instagram CDN
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'scontent-*.cdninstagram.com',
        port: '',
        pathname: '/**',
      },
      // Facebook CDN
      {
        protocol: 'https',
        hostname: 'scontent-*.fbcdn.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
        port: '',
        pathname: '/**',
      },
      // Twitter/X CDN
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
        port: '',
        pathname: '/**',
      },
      // LinkedIn CDN
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
        port: '',
        pathname: '/**',
      },
      // TikTok CDN
      {
        protocol: 'https',
        hostname: '**.tiktokcdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.tiktokcdn-us.com',
        port: '',
        pathname: '/**',
      },
      // YouTube CDN
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'yt3.ggpht.com',
        port: '',
        pathname: '/**',
      },
      // Threads CDN (uses Instagram CDN)
      {
        protocol: 'https',
        hostname: '**.threads.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

// Initialize the Next-Intl plugin
let configWithPlugins = createNextIntlPlugin('./src/libs/I18n.ts')(baseConfig);

// Conditionally enable bundle analysis
if (process.env.ANALYZE === 'true') {
  configWithPlugins = withBundleAnalyzer()(configWithPlugins);
}

// Conditionally enable Sentry configuration
if (!process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
  configWithPlugins = withSentryConfig(configWithPlugins, {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options
    org: process.env.SENTRY_ORGANIZATION,
    project: process.env.SENTRY_PROJECT,

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    reactComponentAnnotation: {
      enabled: true,
    },

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: '/monitoring',

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Disable Sentry telemetry
    telemetry: false,
  });
}

const nextConfig = configWithPlugins;
export default nextConfig;
