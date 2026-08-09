import type { MetadataRoute } from 'next'

/**
 * The sales and admin areas live on their own subdomains and are already behind
 * auth, but their internal paths (/sales, /admin) are reachable on the apex host
 * where the proxy answers 404. Disallowing them keeps those URLs out of search
 * results entirely rather than relying on the 404 alone.
 */
export default function robots(): MetadataRoute.Robots {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'autonomo.id'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/sales', '/admin', '/login', '/verify', '/api'],
    },
    sitemap: `https://${root}/sitemap.xml`,
  }
}
