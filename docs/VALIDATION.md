# Implementation and validation

The local editor supports two integrated P96L accessories, the honeycomb and
diffusion sheet holder. Its default STL is one connected solid in millimetres,
oriented front-face down. The optional fit coupon lives under Advanced test tools.
The latest mount places four compact hooks in the existing corners and leaves both short edges open between them.
It includes four front seats and access cutouts based on the reference dimensions.
The editor automatically updates older saved designs to the current model.

The default honeycomb is 113.8 × 63.8 × 28.5 mm and uses 26,946 mm³ of solid
geometry, about 4.4% less than the initial 28,178 mm³ integrated design. The two
presets have a maximum downward slope below 45° from vertical outside bed
contact, with zero triangles flagged above 45°. The holder’s deeper sheet pocket
and tapered seat use more geometric volume than the original prototype holder.
These checks measure mesh geometry. Slicer toolpaths and real print behavior
remain to be checked. See [print tests](PRINT_TESTS.md).

Multicolor mode partitions the same honeycomb solid into three closed regions
with no bulk overlap. The [Core 3MF](https://3mf.io/spec/core-v1-3-0/) package
uses millimetres and groups the regions under one build object. Bambu Studio
2.9 and OrcaSlicer CLI tools loaded the default export as three manifold parts with dimensions
113.8 × 63.8 × 28.5 mm and a minimum Z of 0. Filament assignment, actual sliced
toolpaths and material compatibility remain hardware and slicer checks.

| Plan milestone | Evidence and remaining gate |
| --- | --- |
| Geometry feasibility | Manifold 3.5.5 generates closed, connected solids with clear access volumes. The benchmark records assembly, STL and alternative subtraction timings. Node RSS grew across 600 builds. The browser recycles its worker after 32 successful builds to bound the lifetime of each WASM heap. Long-session browser memory and Bambu Studio import remain to be checked. |
| Domain and projects | Typed catalogue, versioned strict JSON, legacy migration and confirmation before replacement. Geometry runs independently of the UI. |
| Editor | Parametric integrated geometry, local history, responsive panels, section and print views, and validated STL and ZIP downloads. The private CAD files are ignored and excluded from built assets. |
| Physical fit and modular connection | Actual fit, click force, retention, fatigue, heat and optics require hardware. Modular output remains gated on tested mechanical fit. |
| Offline | Chromium workflow, full restart and two production builds with a prompted update. Core WebKit workflows are covered. Native Safari installation and platform storage eviction remain to be checked. |
| Expansion | A second attachment and synthetic lamp fixture exercise the geometry. A second independently measured lamp is deferred. |
| Release | CI, build asset checks and Cloudflare Pages preparation are in place. Deployed-origin checks require an authorized deployment. |

The authorized dependency audit reported three moderate entries in the Workbox
build dependency chain. See the [editor design review](DESIGN_REVIEW.md) for
the taste gate results. The gate remained open with 37 findings, including
marketing layout requirements that conflict with the editor workspace.
