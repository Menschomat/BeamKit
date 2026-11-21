# BeamKit

A browser-based designer for printable lamp accessories. The initial prototype generates a P96L honeycomb grid and shows it against an original wireframe of the lamp. Grid dimensions are editable, settings can be imported and exported as JSON, and STL data uses millimetres.

## Development

Use Node 24 (see `.nvmrc`). Dependencies are pinned with `package-lock.json`; install with `npm ci`.

```sh
npm ci
npm run dev
npm test
npm run check
npm run build
```

The editor includes undo/redo, named local projects, IndexedDB autosave, and production offline caching. The footer reports when caching and autosave finish. Use JSON downloads for portable backups. An available update offers a save-and-reload action.

Run `npx playwright install chromium` once, then `npm run build` and `npm run test:browser` for the production workflow test. Offline caching is enabled in production builds, not the development server.

See [the validation report](docs/VALIDATION.md) for milestone status and unverified checks.

The static build goes to `dist/`. The plan describes the future mount, accessory connection and Cloudflare Pages deployment. The prototype grid is a geometry sample. It does not yet clip onto the lamp and has not been validated in a slicer or on hardware.

See [PROJECT_PLAN.md](PROJECT_PLAN.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [AGENTS.md](AGENTS.md) for project scope and workflow. Code is [MIT licensed](LICENSE). The project's rights in original generated accessories are dedicated under [CC0 1.0](MODEL_LICENSE.md).
