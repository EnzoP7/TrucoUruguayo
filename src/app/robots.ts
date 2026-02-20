import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/game'],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/game'],
      },
    ],
    sitemap: 'https://trucouruguayo.com/sitemap.xml',
    host: 'https://trucouruguayo.com',
  }
}
