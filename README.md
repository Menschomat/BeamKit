# BeamKit

A browser-based designer for printable lamp accessories. The initial prototype generates a P96L honeycomb grid and shows it against an original wireframe of the lamp. Grid dimensions are editable, settings can be imported and exported as JSON, and STL data uses millimetres.

## Development

Use Node 24 (see `.nvmrc`). The first successful dependency install must generate and commit `package-lock.json`. After that, install with `npm ci`.

```sh
npm install
npm run dev
npm test
npm run check
npm run build
```

The static build goes to `dist/`. The plan describes the future mount, accessory connection, offline PWA and Cloudflare Pages deployment. The prototype grid is a geometry sample. It does not yet clip onto the lamp and has not been validated in a slicer or on hardware.

See [PROJECT_PLAN.md](PROJECT_PLAN.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [AGENTS.md](AGENTS.md) for project scope and workflow. Code is [MIT licensed](LICENSE). The project's rights in original generated accessories are dedicated under [CC0 1.0](MODEL_LICENSE.md).
