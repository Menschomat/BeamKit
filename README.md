# BeamKit

Design printable SmallRig P96L accessories in your browser. Choose a honeycomb
or diffusion sheet holder, adjust the geometry, and export one integrated STL in
millimetres. The front face is placed on the print bed for the current presets.
An optional fit coupon is available under Advanced test tools.

For an integrated honeycomb, open **Print → Multicolor printing** to preview
and export one 3MF with three parts: the honeycomb, a 0.8 mm black perimeter
liner, and the outer shell with clips. Import it as a single multipart model
and assign a filament to each part in the slicer. The preview colors identify
the regions, while the slicer controls the real filaments and printer settings.

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

The static build goes to `dist/`. The [print test guide](docs/PRINT_TESTS.md)
records the starting dimensions and checks for the click-on prototype. Physical
fit, retention, heat and optical behavior still need hardware testing.


See [PROJECT_PLAN.md](PROJECT_PLAN.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [AGENTS.md](AGENTS.md) for project scope and workflow. Code is [MIT licensed](LICENSE). The project's rights in original generated accessories are dedicated under [CC0 1.0](MODEL_LICENSE.md).
