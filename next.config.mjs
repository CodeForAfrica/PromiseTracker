import { withSentryConfig } from "@sentry/nextjs";
import { withPayload } from "@payloadcms/next/withPayload";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config here
  eslint: {
    ignoreDuringBuilds: false,
  },
  output: "standalone",
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      ".cjs": [".cts", ".cjs"],
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };

    // Handle SVG imports - support both React components and URLs
    // First, exclude SVG from the default file loader
    const fileLoaderRule = webpackConfig.module.rules.find((rule) =>
      rule.test?.test?.(".svg")
    );
    if (fileLoaderRule) {
      fileLoaderRule.exclude = /\.svg$/i;
    }

    // Handle *.svg?url imports as URLs
    webpackConfig.module.rules.push({
      test: /\.svg$/i,
      type: "asset/resource",
      resourceQuery: /url/, // *.svg?url
    });

    // Handle *.svg imports as React components (for client-side JS/TS files)
    webpackConfig.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      resourceQuery: { not: [/url/] }, // exclude if *.svg?url
      use: ["@svgr/webpack"],
    });

    // Fallback: Handle any remaining SVG imports as assets
    webpackConfig.module.rules.push({
      test: /\.svg$/i,
      type: "asset/resource",
      resourceQuery: { not: [/url/] },
      issuer: { not: [/\.[jt]sx?$/] }, // Only if not handled by SVGR rule above
    });

    return webpackConfig;
  },
};

export default withSentryConfig(
  withPayload(nextConfig, { devBundleServerPackages: false }),
  {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options

    org: process.env.SENTRY_ORG,

    project: process.env.SENTRY_PROJECT,

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: "/monitoring",

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  }
);
