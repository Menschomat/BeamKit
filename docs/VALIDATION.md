# Implementation and validation

The local editor supports two integrated P96L accessories, the honeycomb and
diffusion sheet holder. Its default STL is one connected solid in millimetres,
oriented front-face down. The optional fit coupon lives under Advanced test tools.
The latest mount revision places two hooks in the existing right corners and leaves the center of that edge open.
It includes four front seats and access cutouts based on the reference dimensions.
Earlier project revisions remain supported, with an explicit upgrade action.

The default honeycomb is 113.8 × 63.8 × 30.5 mm and uses 27,156 mm³ of solid
geometry, about 3.6% less than the initial 28,178 mm³ integrated design. The two
presets have a maximum downward slope of below 45° from vertical outside bed
contact, with zero triangles flagged above 45°. The holder’s deeper sheet pocket
and tapered seat use more geometric volume than the original prototype holder.
These checks measure mesh geometry. Slicer toolpaths and real print behavior
remain to be checked. See [print tests](PRINT_TESTS.md).

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
