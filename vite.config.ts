import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({ plugins: [svelte(), tailwindcss(), VitePWA({
  registerType: 'prompt',
  includeAssets: ['icon.svg', 'project.schema.json'],
  manifest: {
    name: 'BeamKit Lamp Attachment Designer', short_name: 'BeamKit',
    description: 'Local parametric lamp accessory prototypes',
    theme_color: '#F4F4F6', background_color: '#F4F4F6',
    display: 'standalone', start_url: './', scope: './',
    icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,wasm,svg,json}'],
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    navigateFallbackDenylist: [/^\/assets\//],
  },
})] });
