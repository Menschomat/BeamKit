# Implementation and validation report

Date: 2026-11-21. This is an implementation checkpoint, not a completed release.

## Implemented

- Original procedural P96L reference and a standalone parametric honeycomb.
- UI-independent Manifold generator used by the worker and real-kernel tests.
- Solid status, positive volume, finite vertices, and connected-component validation.
- Strict versioned project validation with Zod and a published `public/project.schema.json`.
- Explicit compatibility migration for the original Lightform prototype name.
- Undo/redo, preset reset, named IndexedDB projects, and debounced autosave.
- Generation retry, stale-response protection, and export gating.
- Production service worker precaches the shell, geometry worker, and local WASM.
- Prompted update action saves the design before activation.
- Dependency versions and lockfile, plus a production Playwright workflow.

## Evidence

Node 24.15.0 on macOS, Manifold 3.5.5 (see lockfile for exact dependency resolution).
Real-kernel tests cover minimum, default, and maximum grid settings: expected
bounds within 0.001 mm, positive oriented volume, two incident triangles per
mesh edge, one connected solid, and binary STL size.

A 24-rebuild default-grid benchmark including STL serialization measured roughly
6 ms median on this machine. Process RSS stayed around 136 MB after warmup;
this short observation does not prove absence of browser/WASM memory leaks.

The production Chromium workflow checks generation, parameter edits, JSON download
and reimport, atomic invalid import, undo/redo, STL download, autosave restoration,
and generation after offline reload. Run `npm run build` before `npm run test:browser`.
A visible installed-Chrome session also opened the editor with a ready grid and
no console errors. This is not a Safari check.

## Remaining gates

Milestone 0 remains open: inspect scale and open cells in Bambu Studio, benchmark
mount union and an alternative subtraction algorithm, and measure longer-running
browser resource behavior. Current timings cover the standalone grid only.

Milestones 1 and 2 remain partial: full lamp/mount/connection/attachment registries,
the general assembly project schema, collar/retention geometry, aperture inset,
orientation, import summary, and integrated fit-test exports are still pending.
The published schema deliberately describes only the existing grid prototype.

Milestone 3 requires actual lamp measurements, explicit control/port/screw keepouts,
material/nozzle selection, sliced-output inspection, and physical fit/retention
trials before defining a modular connection. Current schematic markers are not
fit keepouts. Heat and optical performance remain unverified.

Milestone 4 remains partial: cross-build update behavior, Safari, full browser
restart, maskable raster icons, install guidance, and quota failure testing need
verification. The offline test covers reload in a running Chromium context.

Milestones 5 and 6 remain open: independently measured second lamp, second
attachment, extension guide, release/deployment validation. Nothing was published
or deployed.

Dependency audit reported three moderate build-tool advisories in Workbox's
transitive glob/minimatch dependencies. A compatible `npm audit fix` did not
resolve them. Recheck before release; no forced major dependency overrides were
applied. Production builds also report a large application chunk and harmless
third-party annotation / Node-externalization warnings.
