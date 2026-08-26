import type { MetadataRoute } from 'next';

/**
 * The web app manifest, as a Next file convention rather than a static file in
 * public/ — see node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md.
 *
 * This is not decoration. On iOS, Safari delivers Web Push ONLY to a site that
 * has been added to the Home Screen, and a site cannot be added without a valid
 * manifest served over HTTPS. So this file is the precondition for every iPhone
 * notification Renki will ever send.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Renki',
    short_name: 'Renki',
    description: 'Share rides from campus with people you have actually met.',
    start_url: '/rides',
    // 'standalone' is what removes the browser chrome and makes the installed
    // app feel like an app. It is also what `display-mode: standalone` matches
    // against, which is how the install banner knows to hide itself.
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      // Android crops icons to a circle. A 'maskable' icon keeps its content
      // inside a 40% safe zone so the mark is not clipped; without one, Android
      // shrinks the whole icon into a white circle instead.
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
