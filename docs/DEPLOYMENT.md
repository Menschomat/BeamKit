# Static build and deployment preparation

## Build

Use Node 24 and `npm ci`. Run `npm run check`, `npm test`, `npm run schema`,
`npm run build`, and `npm run check:assets`. The output directory is `dist`.
`npm run preview -- --host 127.0.0.1` serves the production build locally.
A development server does not provide production offline caching.

## Cloudflare Pages

Create a Git-integrated Pages project from the GitHub repository after pushing
`main`. Use these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | `npm run build && npm run check:assets` |
| Build output directory | `dist` |
| Node.js | 24 from `.nvmrc` |

Pages installs dependencies from the repository. The app builds into static
assets and needs no account secrets or Functions. The included `wrangler.toml`
also points to `dist` for local testing with `npx wrangler pages dev`.
The GitHub Actions workflow runs tests independently of the Pages build and
deployment.

`public/_headers` revalidates the root document, service worker, and manifest.
Hashed assets cache immutably. The top-level `404.html` makes missing assets
return a 404. [Pages serving rules](https://developers.cloudflare.com/pages/configuration/serving-pages/)

[Git integration setup](https://developers.cloudflare.com/pages/get-started/git-integration/) ·
[Pages build image](https://developers.cloudflare.com/pages/configuration/build-image/)

After the first deployment, check HTTPS, manifest scope, root navigation,
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
