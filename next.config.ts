// next.config.ts
module.exports = {
  eslint: {
    ignoreDuringBuilds: !process.env.CI,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'export',
};
