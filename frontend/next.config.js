/** @type {import('next').NextConfig} */
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
  // Proxy the API to the EC2 backend so browser requests stay same-origin and
  // CORS is never evaluated. Note: Next 14.2 rejects a `headers` key on
  // rewrites, so the X-Client-Platform header is set by the fetch wrapper in
  // src/lib/api.ts instead.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://32.199.22.201:4000/api/v1/:path*",
      },
      // Pothole evidence (photo/video). Proxied for two reasons: pointing
      // the browser straight at the backend would be blocked as mixed
      // content, since this site is served over HTTPS and the backend is
      // not; and proxying keeps evidence same-origin.
      //
      // NOTE: the backend serves this route without auth and with
      // `Access-Control-Allow-Origin: *`, so every evidence object is
      // publicly readable by URL. That is a backend concern and should be
      // flagged to whoever owns it — presigned URLs exist to avoid it.
      {
        source: "/uploads/:path*",
        destination: "http://32.199.22.201:4000/uploads/:path*",
      },
      {
        source: "/api/health",
        destination: "http://32.199.22.201:4000/api/health",
      },
    ];
  },
};

module.exports = nextConfig;
