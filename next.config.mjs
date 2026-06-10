/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@sara/ambient-agent-client"],
  experimental: {
    optimizePackageImports: ["@chakra-ui/react"],
  },
  async rewrites() {
    const origin = (process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:8000").replace(
      /\/$/,
      "",
    );
    return [
      {
        source: "/ai-triage-study/:path*",
        destination: `${origin}/ai-triage-study/:path*`,
      },
      {
        source: "/user/:path*",
        destination: `${origin}/user/:path*`,
      },
    ];
  },
};

export default nextConfig;
