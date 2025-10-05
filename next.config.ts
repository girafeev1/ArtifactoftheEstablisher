module.exports = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  experimental: {
    esmExternals: false,
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
};
