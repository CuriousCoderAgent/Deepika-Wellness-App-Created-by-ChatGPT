/**
 * Security headers for the web surface.
 *
 * The staging deployment sent HSTS (from the platform) and nothing else: no
 * content-type protection, no framing policy, no referrer policy, no
 * permissions policy, and an `X-Powered-By` advertising the framework. The
 * coach console renders member health records, so a clickjacked or
 * MIME-confused page there is a real exposure rather than a checklist item.
 *
 * The CSP is deliberately not free of `unsafe-inline` yet. Next.js needs it
 * for the bundle's inlined bootstrap unless nonces are threaded through every
 * route, which is worth doing and is a bigger change than this. Saying so
 * plainly beats shipping a policy that looks strict and is disabled by a
 * console error on first load.
 */

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  // Vercel Blob serves private uploads; data:/blob: cover inlined icons and
  // locally previewed meal photos.
  "img-src 'self' data: blob: https://*.blob.vercel-storage.com",
  "font-src 'self' data:",
  // See the note above: the honest current state, not the target.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.blob.vercel-storage.com",
  // Nothing here is meant to be embedded, and nothing embeds anything.
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Not a real defence, but there is no reason to announce the stack and its
  // version to a scanner.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Belt and braces with frame-ancestors, for anything that only
          // understands the older header.
          { key: "X-Frame-Options", value: "DENY" },
          // A member record's URL must not leak to a third-party site.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The web surface needs none of these. Camera, location and health
          // data are used by the phone app, which this header does not govern.
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // Nothing under /api should be cached by an intermediary; every one of
        // these responses is a single member's data.
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, private",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
