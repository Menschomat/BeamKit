# BeamKit

Design printable SmallRig P96L and [Neewer TL21C](docs/TL21C_MEASUREMENTS.md)
accessories in your browser. Choose the lamp from its name above the 3D view. Use
**Attachment type** to choose a honeycomb, square or rectangular eggcrate, parallel louvers,
or a diffusion sheet holder. Adjust the geometry and export a 3MF or STL in
millimetres. The current presets place the front face on the print
bed. Use **Print → Output → Fit coupon only** to test fit with a smaller print.

Rectangular eggcrate and louvers can turn 90° to change the direction of spill
control. The presets are starting dimensions. Beam angles require measurement.

New designs start in multicolor mode. The 3MF contains a near-black grid,
a 0.8 mm granite-gray inner shell, and a lemon-yellow outer shell with clips.
Import it as one multipart model and assign the filaments in your slicer.
Turn off **Print → Multicolor printing** to export one integrated STL.

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

The static build goes to `dist/`. See the [Cloudflare Pages setup](docs/DEPLOYMENT.md)
for Git integration and deployment checks. The [print test guide](docs/PRINT_TESTS.md)
records the starting dimensions and checks for the click-on prototype. Physical
fit, retention, heat and optical behavior still need hardware testing.


See [PROJECT_PLAN.md](PROJECT_PLAN.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [AGENTS.md](AGENTS.md) for project scope and workflow. Code is [MIT licensed](LICENSE). The project's rights in original generated accessories are dedicated under [CC0 1.0](MODEL_LICENSE.md).
