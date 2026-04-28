/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      // iOS PWA でキャッシュされて古いまま表示される問題を防ぐため、HTMLは毎回取得
      {
        source: "/",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
      {
        source: "/((?!_next/static|_next/image|api|.*\\.(?:ico|png|jpg|jpeg|svg|webp|woff2?)).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
    ]
  },
}

module.exports = nextConfig
