import path from "path";
import type { NextConfig } from "next";

const CLASSNAMES_FRAGMENTS = [
  "/antd/node_modules/classnames/index.js",
  "/rc-pagination/node_modules/classnames/index.js",
];

const config: NextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/dashboard/projects",
        destination: "/projects",
        permanent: true,
      },
      {
        source: "/dashboard/projects/:projectId",
        destination: "/projects/:projectId",
        permanent: true,
      },
      {
        source: "/dashboard/projects/:projectId/invoice/:invoiceNumber/preview",
        destination: "/projects/:projectId/invoice/:invoiceNumber/preview",
        permanent: true,
      },
      {
        source: "/dashboard/finance",
        destination: "/finance",
        permanent: true,
      },
      {
        source: "/dashboard/accounting",
        destination: "/accounting",
        permanent: true,
      },
      {
        source: "/dashboard/client-accounts",
        destination: "/client-accounts",
        permanent: true,
      },
      {
        source: "/dashboard/coaching-sessions",
        destination: "/coaching-sessions",
        permanent: true,
      },
      {
        source: "/dashboard/tools",
        destination: "/tools",
        permanent: true,
      },
    ];
  },
  transpilePackages: [
    "@refinedev/antd",
    "@refinedev/core",
    "@refinedev/nextjs-router",
    "@ant-design/icons",
    "antd",
    "rc-util",
    "rc-picker",
    "rc-table",
    "rc-tree",
    "rc-pagination",
    "rc-menu",
    "rc-tabs",
    "rc-select",
    "rc-dropdown",
  ],
  webpack: (webpackConfig) => {
    webpackConfig.module = webpackConfig.module ?? {};
    webpackConfig.module.parser = webpackConfig.module.parser ?? {};
    webpackConfig.module.parser.javascript = {
      ...webpackConfig.module.parser.javascript,
      importMeta: true,
    };
    webpackConfig.module.rules = webpackConfig.module.rules ?? [];
    webpackConfig.module.rules.push({
      test: (resource: string) =>
        CLASSNAMES_FRAGMENTS.some((fragment) =>
          resource.replace(/\\/g, "/").endsWith(fragment),
        ),
      enforce: "post",
      use: [
        {
          loader: path.resolve(__dirname, "scripts/replaceImportMetaLoader.js"),
        },
      ],
    });
    return webpackConfig;
  },
};

export default config;
