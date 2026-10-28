/** @type {import('next').NextConfig} */
// Backend origin for the proxied routes. Defaults to the EC2 host. Rewrites are
// fixed at build time, so set API_PROXY_TARGET before `next build`. The server
// must accept connections from wherever this app is hosted (AWS security group).
const API_TARGET = (process.env.API_PROXY_TARGET || "http://3.24.13.80:4000").replace(/\/+$/, "");

const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
    ],
  },
  // Proxy the API to the backend so browser requests stay same-origin and
  // CORS is never evaluated. Note: Next 14.2 rejects a `headers` key on
  // rewrites, so the X-Client-Platform header is set by the fetch wrapper in
  // src/lib/api.ts instead.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_TARGET}/api/v1/:path*`,
      },
      // Pothole evidence (photo/video). Proxied so the browser never calls
      // the plain-HTTP backend directly (mixed content) and so the httpOnly
      // session cookie is forwarded. The backend requires an authenticated
      // session for /uploads; presigned S3 URLs remain the primary source.
      {
        source: "/uploads/:path*",
        destination: `${API_TARGET}/uploads/:path*`,
      },
      {
        source: "/api/health",
        destination: `${API_TARGET}/api/health`,
      },
    ];
  },
};

module.exports = nextConfig;
