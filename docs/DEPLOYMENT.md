# Static build and deployment preparation

Nothing in this work authorizes publishing. These instructions prepare a portable
static build. Deployment, origin checks, and GitHub branch protection require a
later authorized release step.

## Build

Use Node 24 and `npm ci`. Run `npm run check`, `npm test`, `npm run schema`,
`npm run build`, and `npm run check:assets`. The output directory is `dist`.
`npm run preview -- --host 127.0.0.1` serves the production build locally.
A development server does not provide production offline caching.

## Cloudflare Pages

The included `wrangler.toml` names `dist` as the Pages build output directory.
For a Git-based Pages build, set the build command to `npm run build`, output to
`dist`, and Node to the version in `.nvmrc`. No account secrets, Functions, backend,
cross-origin isolation, or runtime network imports are required.

`public/_headers` prevents persistent caching of the service worker, manifest and
index while caching hashed assets immutably. A top-level `404.html` prevents
Cloudflare Pages' automatic SPA fallback from turning missing JS/WASM requests
into the editor HTML. This app has one route and needs no `_redirects` rules.
Cloudflare does not support 404 rewrites in `_redirects`.

References checked 2026-11-21:
- https://developers.cloudflare.com/pages/configuration/serving-pages/
- https://developers.cloudflare.com/pages/configuration/redirects/

After an authorized deployment, check HTTPS, manifest scope, root navigation,
`.wasm` MIME type (`application/wasm`), worker paths, missing-asset 404 status,
cache headers and both fresh and upgraded installs on that actual origin.
Do not mark a release verified from a local preview alone.

## Offline and update behavior

The production cache includes the entry script, worker, WASM, catalogue code,
JSON schemas and app icons. The footer reports offline readiness only when the
required assets are present in browser caches and the service worker is active.

Updates prompt rather than replacing the editor. The save-and-reload action is
disabled during generation; it commits the current design to IndexedDB before
activating the waiting worker. Export is synchronous and revision-gated.

`tests/browser/update.spec.ts` builds two actual production versions into temporary
directories, switches the server, checks the update prompt, and verifies that the
design survives activation. `restart.spec.ts` closes Chromium completely and
checks restoration and offline generation in the same persisted browser profile.

Install UI, platform storage eviction, browser/OS differences and hardware fit
still require release checks. JSON and the ZIP bundle remain portable backups.
