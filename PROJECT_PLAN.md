# Lamp Attachment Designer — Project Plan

Status: implementation started
Date: 2026-11-21
First supported lamp: SmallRig Vibe P96L

## 1. Product goal

Build an installable, offline-capable web app that generates printable accessories for photographic lights. Users select a lamp, choose a compatible mount and attachment, adjust dimensions, inspect the result in 3D, and download printable models and portable JSON settings.

The first complete workflow is a SmallRig P96L honeycomb attachment. The architecture must also support other lamp shapes, mounting mechanisms, grids, snoots, diffuser holders, and diffuser shells without duplicating the editor or geometry pipeline.

All model generation, project storage, import, and export run locally in the browser. Ship static assets suitable for Cloudflare Pages. No Fusion dependency, accounts, backend, or subscription services are required.

## 2. Chosen stack

| Area | Decision | Reason |
| --- | --- | --- |
| Interface | Svelte with TypeScript | User preference; reactive parameter controls with a small application shell |
| Build | Vite and the official Svelte plugin | Standard static build, worker and asset support |
| Styling | Tailwind CSS through its Vite plugin | Consistent responsive controls and design tokens |
| 3D preview | Three.js behind a viewport adapter | Direct control over camera, overlays, geometry lifetime, and exports |
| Solid geometry | Manifold WASM, behind a geometry-kernel adapter | Browser-side mesh solid operations; validate suitability in the first technical milestone |
| Background computation | Dedicated Web Worker | Keep geometry generation off the UI thread |
| PWA | vite-plugin-pwa / Workbox | Manifest, offline asset caching, and controlled update prompt |
| Validation | Zod with a published JSON Schema for project files | Runtime checking and an externally understandable settings format |
| Local persistence | IndexedDB behind a storage adapter | Autosave and named local projects without a server |
| Verification | Vitest and Playwright | Geometry, serialization, UI, and production PWA checks |
| Hosting | Cloudflare Pages, static dist output | Portable deployment without runtime server code |

Use plain Svelte with Vite initially. SvelteKit is not necessary for this single-workspace editor. If a later public catalogue needs routes and prerendered pages, reassess SvelteKit with a static adapter; core generators and project files must remain reusable.

Choose supported stable package releases during implementation, pin the runtime/toolchain and dependency lockfile, and record the actual geometry-kernel version. Do not depend on floating CDN imports or experimental browser APIs. Keep framework code out of geometry and serialization modules.

## 3. Core architecture: lamp, mount, connection, attachment

The lamp-specific mount is the reusable foundation. It attaches to the real lamp and exposes a documented accessory connection. An attachment consumes that connection and the available optical opening.

| Concept | Responsibility |
| --- | --- |
| Lamp definition | Physical dimensions, front opening, coordinate frames, control/port keepouts, source provenance, available mounts |
| Mount definition and generator | Lamp contact geometry, fit allowances, retention features, support surfaces, output connection |
| Connection specification | Mechanical interface identity, version, dimensions, engagement direction, tolerances, retention and clearance rules |
| Attachment definition and generator | Parametric optical or mechanical body, supported connections, parameter schema, restrictions |
| Assembly resolver | Check compatibility, compute transforms, detect relevant conflicts, and generate printable parts |
| Project document | Explicit selected definitions and revisions, normalized settings, output mode, and generator provenance |

Do not assume one universal connection works for every lamp. Introduce a versioned rectangular connection family for the P96L after a fit prototype; leave room for circular, magnetic, rail, and other families. Compatibility depends on geometry and clearance, not just matching a string ID.

Provide two output modes where supported:

- Integrated: mount and attachment are fused into one printable solid using generator-defined overlap and a supported joint.
- Modular: a separate reusable mount and replaceable attachment use a physically modeled, versioned connection with retention and tolerances.

Deliver integrated output first to prove fit and geometry. Introduce modular output after testing its connection. The software separation exists from day one in both modes. Do not represent an untested two-part fit as production-ready.

### Geometry contracts

Use millimetres and a right-handed system throughout: lamp front opening centred at the origin, front plane at Z=0, emitted light along +Z. Store an explicit transform for each reference envelope and local part frame.

Generators accept validated plain data and a kernel interface. They return named printable parts, assembly transforms, connection metadata, bounds, diagnostics, and provenance. Three.js objects and Svelte state must never appear in generator inputs or persistent files.

Support rounded-rectangle and circular aperture descriptions, plus a constrained polygon form when needed. A common aperture contract lets attachments adapt to different lamps; it does not guarantee every attachment supports every aperture. Unsupported combinations are explained in the editor.

Keep lamp-reference meshes separate from printable solids. A lamp mesh is a visual aid and must never accidentally become part of an STL.

### Extension registration

Use typed, build-time registries for lamps, mounts, connections, attachments, and exporters. Registry entries expose stable IDs, revision, metadata, parameter definitions, defaults, validation, and generation functions. Provide schema-driven basic fields with optional custom Svelte panels for complex generators.

Adding a lamp normally means adding a definition, wireframe profile, keepouts, and mount implementation or existing mount configuration. Adding an attachment means implementing its generator and schema, plus compatibility rules and geometry fixtures. Neither should require changes throughout the editor.

Do not load executable plugins from imported project JSON. Later declarative lamp-profile imports can use a restricted data schema; new arbitrary mount algorithms remain reviewed source modules.

## 4. Geometry pipeline and print correctness

Pipeline: validate settings, resolve definitions, resolve compatibility, generate mount, generate attachment, assemble or fuse, validate solids, build display mesh, and export the resolved revision.

Use Manifold for constructive solid geometry rather than assembling visually overlapping Three.js meshes. For the honeycomb, evaluate a 2D cell pattern clipped to an aperture and extruded to depth, with shared walls and a connected boundary frame. Benchmark this against batched solid subtraction before choosing the implementation.

The viewport and exporter consume the same generated result. A temporary lower-detail preview is allowed while editing, but the final export must be regenerated and checked at print quality. Disable export while inputs are invalid, generation is pending, or the visible mesh belongs to older settings.

Worker requests carry IDs and project revisions. Debounce continuous changes, keep only the newest pending request, discard stale results, and transfer typed arrays rather than copying large meshes. A busy synchronous WASM operation may not support cooperative cancellation; terminate and recreate the worker when necessary. Handle worker errors and retry without losing settings.

Explicitly release Manifold/WASM objects and dispose replaced Three.js buffers/materials. Start with single-threaded WASM so cross-origin isolation and SharedArrayBuffer headers are not prerequisites. Confirm the selected package build actually supports this during the technical spike.

Before export, check kernel status, finite coordinates, positive volume, valid topology, expected connected-component count, dimensions, and relevant keepouts. Require one connected solid per printable part unless a generator explicitly declares otherwise. Report thin walls and print-profile constraints separately from geometric validity. Do not silently repair away intentional features.

Physical suitability still requires print testing: mesh validity cannot certify clip strength, material temperature performance, fit, or light distribution.

## 5. Initial P96L design scope

The provided community STEP model was inspected in Fusion before the web-app decision. It contains one solid body. Model measurements:

| Feature | Model value |
| --- | --- |
| Main housing | 110 × 60 mm |
| Thickness | 11.5 mm |
| Maximum envelope including protrusions | 110.4 × 61.7 mm |
| Front panel | 105 × 55 mm |
| Front-panel corner radius | 3.5 mm |
| Housing corner radius | 6 mm |

These are reference-model values, not confirmed production dimensions. Measure the actual lamp and record dimension confidence before finalizing contact surfaces. Capture control, USB, and mounting-screw keepouts explicitly. Generate an original wireframe from independent measurements and simple geometric primitives. Include front and rear contours, a front aperture or bezel inset, a rear seam, and sparse control or connector location markers when useful. Use low contrast and avoid triangulation, logos, LED textures, and imported or traced third-party geometry. The wireframe and fit keepouts remain distinct from exported solids.

Initial mount concept: shallow collar supported on the housing, a small diffuser clearance, and localized retaining features that leave controls and heat-dissipating surfaces accessible. Exact clip geometry remains a prototype decision. Parametrize fit allowance, engagement, support thickness, and accessible cutouts; distinguish mount fit clearance from accessory-connection clearance.

Honeycomb starting preset: 6 mm clear opening across flats, 12 mm depth, and 0.8 mm shared wall thickness. These are experimental defaults, not a print-validated design. Expose cell opening, depth, wall thickness, perimeter frame width, aperture inset, and orientation. Bound ranges according to the chosen lamp, connection, kernel cost, and print constraints.

Separate optical concepts in the interface: a honeycomb restricts spill; a diffuser spreads light. A printed diffuser holder can retain commercial diffusion material, while a printed translucent shell has material-dependent transmission and colour. Do not promise a calibrated optical effect or a measured beam angle from geometry alone.

## 6. JSON project format and compatibility

JSON import/export is part of the first usable release, not a later convenience. Store design intent rather than generated triangle arrays. Keep project schema version separate from generator, lamp, mount, attachment, and connection revisions.

Illustrative format, subject to validation during milestone 1:

```json
{
  "format": "lamp-attachment-project",
  "schemaVersion": 1,
  "units": "mm",
  "name": "P96L honeycomb prototype",
  "engine": {
    "generatorVersion": "0.1.0",
    "kernel": "manifold",
    "kernelVersion": "recorded-at-export"
  },
  "lamp": { "id": "smallrig.p96l", "revision": 1 },
  "mount": {
    "id": "smallrig.p96l.collar",
    "revision": 1,
    "parameters": { "fitClearancePerSideMm": 0.3 }
  },
  "attachment": {
    "id": "honeycomb",
    "revision": 1,
    "parameters": {
      "cellOpeningAcrossFlatsMm": 6,
      "depthMm": 12,
      "wallThicknessMm": 0.8
    }
  },
  "assembly": { "mode": "integrated", "connection": null },
  "printProfile": { "nozzleDiameterMm": 0.4 },
  "export": { "format": "stl", "quality": "print" }
}
```

The example values are proposed defaults. Persist all resolved generator settings explicitly rather than relying on defaults that might change. Keep optional camera/UI preferences separate from design parameters. Modular projects record the exact connection ID, version, and resolved interface parameters.

Import flow: limit input size, parse JSON as data, validate its format and version, migrate supported old schemas, resolve definitions, validate parameters and compatibility, show a summary, then replace the active project as one undoable action. Preserve the previous project until import succeeds. Unknown fields and unsupported revisions produce explicit diagnostics rather than silent reinterpretation.

Retain historical definition revisions while supported. A schema migration does not imply geometry equivalence. When a historical generator cannot be reproduced, offer an explicit upgrade with a changed-geometry notice; never silently run a newer algorithm under an older revision. Promise reproducible settings and dimensionally equivalent geometry within documented tolerances, not byte-identical STL across engines and browsers.

Use File/Blob downloads and a standard file input as the baseline. Native file-system pickers are optional enhancements. JSON is the portable backup; browser autosave is not cloud sync and can be cleared by the browser or user.

## 7. Workspace and interaction

Desktop: lamp, mount, and attachment selectors on the left, a central 3D viewport, and settings on the right. Use the Opaline palette: #F4F4F6 canvas, #E7E7E7 secondary surfaces, #D2D2D4 borders, #FF634A accent, and dark text on coral controls. Smaller screens use collapsible panels and touch-compatible orbit controls.

Provide assembled, isolated-part, exploded modular, and cross-section views as appropriate; lamp visibility/transparency; dimension overlays; camera reset; build status; undo/redo; reset-to-preset; named local projects; JSON import/export; and printable-part export.

Use labelled number inputs alongside sliders, keyboard access, visible focus, and errors linked to fields. Retain the last valid preview while editing but mark it as outdated. Units and clearance conventions must be explicit. Avoid requiring colour alone to communicate errors.

STL is the first print format. STL has no unit metadata: document millimetres and verify dimensions in Bambu Studio. Export modular parts as separately named files with an optional ZIP bundle and project JSON. Add 3MF later for units and multi-part packaging after selecting and testing a maintained writer. Do not promise STEP export from a mesh-only kernel.

## 8. PWA, offline operation, and deployment

Provide a web manifest, app icons including maskable icons, standalone display, suitable theme colours, HTTPS, and install guidance where supported. Installation UX varies by browser and OS; the app remains usable as a normal website.

Precache the application shell, worker, WASM binary, fonts/icons, and initial P96L catalogue assets. Lazy-load later lamp assets with an explicit make-available-offline action. Report offline readiness only after required assets are cached. The core workflow must open, generate, import, and export offline after initial preparation.

Use a prompted update flow: autosave, wait for generation/export to finish, ask the user to reload, then activate the new worker. Do not automatically replace a running design session. Test updates between actual production builds, including catalogue/schema changes and stale caches. Check configured precache size limits for the WASM asset rather than assuming it will be included.

Local IndexedDB stores projects and autosave history; browser cache stores application assets. Handle quota/write failures visibly. Bundle runtime dependencies locally. No external network request is needed to regenerate an already available lamp design.

Deploy the Vite build using npm run build with dist as the Cloudflare Pages output directory. Supply a compatible Node version and a lockfile. Serve WASM with the correct MIME type, avoid treating missing asset requests as HTML, and use appropriate cache headers for the service worker and versioned assets. Initially use a single editor route to avoid routing configuration complexity. Verify HTTPS, manifest scope, worker URLs, and fresh and upgraded installs on the deployed origin.

The deployable output remains portable to other static hosts. No Cloudflare-specific API belongs in the geometry or project format. Public deployment is a later step; this task produces a plan only.

## 9. Suggested source boundaries

| Directory | Contents |
| --- | --- |
| src/app | Svelte workspace, editor commands, state, and accessible controls |
| src/domain | Definition types, project model, units, compatibility, and diagnostics |
| src/catalog | Versioned lamp, mount, connection, and attachment registrations |
| src/generators | Mount and attachment algorithms, with no UI imports |
| src/geometry | Kernel adapter, solid validation, worker protocol, and worker entry |
| src/viewport | Three.js adapter, controls, overlays, and resource lifecycle |
| src/serialization | JSON schema, validators, migrations, and provenance |
| src/export | STL and future exporter adapters |
| src/storage | IndexedDB persistence adapter |
| src/pwa | Registration, offline readiness, and update handling |
| tests/fixtures | Historical projects, geometry cases, and extension fixtures |
| docs | Architecture decisions, adding models, print results, and deployment guide |

Start as one repository and one application. Enforce module boundaries through imports and tests; split into independently published packages only if real reuse requires it.

## 10. Delivery milestones and acceptance gates

| Milestone | Deliverables | Acceptance gate |
| --- | --- | --- |
| 0 — Geometry feasibility | Svelte/Vite/Tailwind shell; worker-loaded Manifold; sample clipped grid; printable STL; benchmark | Representative P96L grid opens at correct scale in Bambu Studio; valid connected solid; repeated rebuilds do not show sustained resource growth; WASM loads from static assets |
| 1 — Domain and files | Registries, connection contracts, project schema, validation, migration scaffolding, JSON import/export | Round trip preserves all resolved settings; invalid/unsupported files leave the current design intact; geometry core runs without UI dependencies |
| 2 — First useful editor | P96L reference, parametric collar and honeycomb, interactive preview, diagnostics, integrated STL, fit-test export | UI stays responsive during generation; stale results never overwrite current ones; preview and STL have matching bounds and intended parts |
| 3 — Physical fit and modular connection | Print-tested collar, documented tolerance settings, versioned accessory connection, modular part exports | Fit prototype attaches/removes without obstructing required controls; tested attachment retention; inspect sliced output for thin walls, closed cells, and missing clip features |
| 4 — Installed offline workflow | Manifest, service worker, IndexedDB autosave, install guidance, update prompt | Production build completes the P96L workflow offline after preparation; browser restart restores settings; update preserves work; Chromium and Safari workflows checked |
| 5 — Expansion proof | Second independently measured lamp; a second attachment such as a diffusion-sheet holder; extension guide | Existing honeycomb works through compatible mount interfaces; second attachment uses the P96L connection; no duplicated editor or P96L-specific branches in generic generators |
| 6 — Release preparation | CI, deployment config/docs, attribution, fixtures, validation report | Static deployment passes asset, offline, JSON, export-scale, and update checks; known physical/optical limitations documented |

Milestone 0 is a go/no-go gate for the kernel choice. If it fails on correctness or practical performance, evaluate an alternative browser kernel before building the editor around its API. Benchmark the full reference workload, including corner clipping, mount union, and final export, not just a simple cube.

Desktop is the primary design target; mobile must remain usable with bounded geometry complexity. Record reference device/browser, build time, peak practical memory behaviour, and triangle counts during milestone 0 before setting performance budgets. Explicit upper bounds prevent pathological cell counts and unbounded imported parameter values.

## 11. Verification strategy

Test meaningful geometry properties: expected bounds, finite coordinates, positive volume, connection dimensions, connected parts, edge-cell clipping, and keepout clearance. Use minimum/maximum valid settings and representative failure cases. Avoid relying on exact triangle order or fragile binary STL snapshots.

Test JSON round trips, older-version migrations, unknown IDs, unsupported revisions, oversized inputs, and atomic failure. Test worker errors and out-of-order responses. Browser tests cover changing a parameter, generating, downloading/reimporting JSON, exporting a valid STL, and restoring autosave. Run offline and update tests against built assets served over a service-worker-compatible origin.

Physically print a small mount fit test before a full accessory. Check exports in Bambu Studio for scale, open honeycomb channels, wall paths, retention geometry, and intended print orientation. Record material, nozzle, layer settings, tolerances, and the lamp used. Fit validation is lamp-revision and print-profile dependent.

Use controlled photo/lux comparisons for optical presets later. Any illustrative beam display must say it is an estimate and must not be presented as a calibrated simulation.

## 12. Provenance and scope boundaries

Application code is MIT licensed. Lightform dedicates its rights, if any, in its original generated accessory geometry under CC0 1.0 Universal, which permits commercial reuse without attribution. Include the SPDX identifier and canonical CC0 URL in the export interface and export bundle. This dedication covers project-owned output and leaves third-party and user-contributed rights with their holders.

The previously consulted community model by 727Thing (Thingiverse item 7402666) remains a private measurement reference. Keep its archive, meshes, images and conversions out of the repository, build and exported models. Record the provenance of future measured profiles and maintain an independent procedural preview.

Use feature branches off main, Conventional Commits, reviewable pull requests, protected main on GitHub, and automated checks. See CONTRIBUTING.md and AGENTS.md for the workflow. GitHub publication and Cloudflare deployment are later release steps.

First release excludes arbitrary CAD upload and automatic mount inference, arbitrary executable plugins, full optical ray tracing, slicer integration, cloud sync, user accounts, STEP output, and unrestricted multi-attachment stacks. Extension contracts should allow later work without suggesting that it is already implemented.

Remaining physical inputs: actual lamp measurements, desired spill control/use distance, available nozzle/material, and preferred retention feel. These do not block building the software foundation; they do block claiming a print-validated mount and calibrated optical preset.

## 13. Technical references

- CC0 dedication: https://creativecommons.org/publicdomain/zero/1.0/

Checked 2026-11-21. Decisions above are project recommendations, not guarantees of indefinite dependency compatibility.

- Svelte: https://svelte.dev/docs/svelte/overview
- Vite templates and build tooling: https://vite.dev/guide/
- Vite static deployment: https://vite.dev/guide/static-deploy.html
- Tailwind Vite integration: https://tailwindcss.com/docs/installation/using-vite
- Three.js documentation: https://threejs.org/docs/
- Manifold WASM API: https://manifoldcad.org/docs/jsapi/
- Manifold memory management: https://manifoldcad.org/docs/jsapi/documents/Using_Manifold.html
- Svelte PWA integration: https://vite-pwa-org.netlify.app/frameworks/svelte
- PWA update prompts: https://vite-pwa-org.netlify.app/guide/prompt-for-update
- Offline PWA operation: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
- Cloudflare Pages static deployment: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- Reference-model source: https://www.thingiverse.com/thing:7402666
