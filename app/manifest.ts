import type { MetadataRoute } from 'next';

/**
 * Constitution: Client Platform Requirements — installable PWA. Next.js's
 * `app/manifest.ts` convention auto-generates and auto-links
 * `/manifest.webmanifest`; no manual <link rel="manifest"> tag needed.
 *
 * Icons are placeholders (a solid accent-green square) generated for this
 * amendment — replace public/icons/icon-192.png and icon-512.png with real
 * branding via Personalización once the building's actual logo/mark exists.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Habitat — Backoffice',
    short_name: 'Habitat',
    description: 'Building administrator backoffice for Habitat.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f7f5',
    theme_color: '#1f4d2e',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
