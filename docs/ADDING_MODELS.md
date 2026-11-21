# Adding a lamp or attachment

## Contracts

Use millimetres and right-handed coordinates. The front opening is centered at
X=Y=0, front plane Z=0, and emitted light follows +Z. Keep rendering and persistence
out of generator modules. The domain includes rounded-rectangle, circular and
constrained polygon aperture types; current generators accept rounded rectangles
only. Unsupported combinations must be rejected until a matching algorithm exists.

`src/catalog/registry.ts` contains typed, versioned lamps, mounts, attachments,
connection metadata and exporters. Every editable parameter has a label, unit,
minimum, maximum, step and explicit default. `src/domain/project.ts` resolves
references and rejects missing, unknown, incompatible or unsupported settings.
`src/generators/assembly.ts` receives validated plain settings plus the kernel,
returns named printable parts, local transforms, bounds, volume, diagnostics,
connection metadata and engine provenance, and disposes all kernel intermediates.

## Lamp

Record independent measurements and their provenance. Add body and aperture
primitives, an original procedural preview, available mount IDs, and explicit
access envelopes for plugs, fingers, switches, dials, screw heads and cooling.
Keep the private source out of `src/` and `public/`. A reference-only model must
not be labeled physically measured. Retain prior definition revisions.

Reuse the collar strategy only where the contact geometry and mounting mechanics
fit. Otherwise implement a separate mount strategy and compatibility rule; a
matching aperture alone is insufficient. Never silently reuse a P96L collar for
a physically different lamp. The synthetic rectangle test fixture exercises
shape reuse without claiming a second real lamp is supported.

## Attachment

Register a stable ID, revision, parameter schema, defaults and aperture support.
Implement the attachment solid in the kernel layer and test default, boundary,
and meaningful invalid configurations. Current attachment strategies are the
honeycomb and diffusion-sheet holder; neither assumes P96L body dimensions.
The assembly owns the lamp collar and unions the attachment with a controlled
0.4 mm joint overlap before final solid validation. Add a separate strategy
when a new attachment needs a different construction algorithm.

Check bounds, one connected solid, positive volume, finite coordinates, closed
and consistently oriented topology, clear apertures and mandatory keepouts.
Inspect STL scale and slicer wall paths, then print-test the relevant lamp.

## Revisions and exports

The project schema, generator, kernel and definition revisions are separate.
Reproduce supported historical algorithms or reject them explicitly. Original
prototype JSON imports retain honeycomb revision 1 and standalone geometry;
adding a collar is an explicit upgrade. Do not run executable imports.

Regenerate `public/project.schema.json` with `npm run schema` after an intentional
schema change. Add historical fixtures and migration tests. Generated mesh arrays
never enter JSON. Lamp preview geometry never enters a printable part or STL.

Modular connections remain blocked until hardware fit and retention tests define
a real interface. A proposed connection ID is not a compatibility or retention
certificate. Add physical connection dimensions, tolerances, engagement direction,
retention features and clearance tests together after that gate passes.
