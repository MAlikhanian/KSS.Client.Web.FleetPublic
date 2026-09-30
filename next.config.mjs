/** @type {import('next').NextConfig} */

// The public Fleet site. It owns its host, so there is no basePath, and it is
// never composed into the Shell. It holds no session and no secret.

const SECURITY_HEADERS = [
  // HTTPS only: the public host is served over TLS and browsers should never
  // fall back to plain HTTP. Scoped to this host (no includeSubDomains).
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  {
    key: 'Content-Security-Policy',
    // Everything is served from this host: no third-party script, font or API.
    // 'unsafe-inline' is required by Next's inline bootstrap scripts.
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // The site renders no <Image>; turning the optimizer off removes the
  // image-optimization endpoint and its whole class of advisories.
  images: { unoptimized: true },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
