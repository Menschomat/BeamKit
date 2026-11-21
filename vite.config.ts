import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({ plugins: [svelte(), tailwindcss(), { name: 'beamkit-build-meta',
  transformIndexHtml(html) { return html.replace('</head>', `<meta name="beamkit-build" content="${process.env.BEAMKIT_BUILD_ID ?? '0.2.0'}" /></head>`); } }, VitePWA({
  registerType: 'prompt',
  includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'project.schema.json', 'legacy-grid.schema.json'],
  manifest: {
    name: 'BeamKit Lamp Attachment Designer', short_name: 'BeamKit',
    description: 'Local parametric lamp accessory prototypes',
    theme_color: '#F4F4F6', background_color: '#F4F4F6',
    display: 'standalone', start_url: './', scope: './',
    icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,wasm,svg,json,png}'],
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    navigateFallbackDenylist: [/^\/assets\//],
  },
})] });
