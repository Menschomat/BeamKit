import type { Field, LampDefinition, MountDefinition } from '../domain/definitions.ts';
import type { Point } from '../geometry/profile.ts';

// The front arc is a schematic parabola, with Y measured across the wand.
const halfAperture = 17.5;
const edgeDepth = 6.5;
const front: Point[] = Array.from({ length: 33 }, (_, index) => {
  const y = halfAperture * (index / 16 - 1);
  return [y, -edgeDepth * (y / halfAperture) ** 2];
});

export const tl21c: LampDefinition = {
  id: 'neewer.tl21c',
  revision: 1,
  label: 'Neewer TL21C',
  body: { width: 228, height: 41.6, depth: 45, radius: 2.5 },
  aperture: { width: 218, height: 2 * halfAperture, radius: 3 },
  detail: {
    rearSeamFromBack: 0,
    crossSection: [
      ...front, [20, -11], [20.8, -16], [20.8, -23], [20.2, -29],
      [19.4, -35], [15, -44], [14, -45], [-14, -45], [-15, -44],
      [-19.4, -35], [-20.2, -29], [-20.8, -23], [-20.8, -16], [-20, -11],
    ],
    apertureEdgeDepth: edgeDepth,
    markers: [
      { side: 'left-edge', centerAlongEdge: 0, centerZ: -24, width: 6.35, height: 6.35, radius: 3.175, outwardOffset: 0.03 },
      { side: 'right-edge', centerAlongEdge: 0, centerZ: -24, width: 6.35, height: 6.35, radius: 3.175, outwardOffset: 0.03 },
    ],
    rearMarkers: [
      { centerX: 24, centerY: 0, width: 4, height: 9, radius: 1.8 },
      { centerX: 2, centerY: 0, width: 25, height: 11, radius: 1 },
      { centerX: -21, centerY: 0, width: 6, height: 6, radius: 3 },
      { centerX: -30, centerY: -6, width: 6, height: 6, radius: 3 },
      { centerX: -30, centerY: 6, width: 6, height: 6, radius: 3 },
      { centerX: -39, centerY: 0, width: 6, height: 6, radius: 3 },
    ],
  },
  provenance: {
    source: 'Neewer product specifications, accessory cavity measurements and product photos',
    confidence: 'reference-only',
    note: 'Clip contact dimensions and aperture are estimates. See docs/TL21C_MEASUREMENTS.md.',
  },
  mounts: ['neewer.tl21c.side-clips', 'neewer.tl21c.slide-on'],
  keepouts: [
    { id: 'rear-usb-and-controls', bounds: { min: [-65, -28, -65], max: [45, 28, -40] }, confidence: 'provisional' },
    { id: 'left-end-thread', bounds: { min: [-133, -25, -48], max: [-114, 25, 3] }, confidence: 'provisional' },
    { id: 'right-end-thread', bounds: { min: [114, -25, -48], max: [133, 25, 3] }, confidence: 'provisional' },
  ],
};

const fields: readonly Field[] = [
  { key: 'fitClearancePerSideMm', label: 'Fit clearance per side', min: 0.2, max: 1, step: 0.05, unit: 'mm',
    help: 'Adjust to match your lamp. Try the short fit coupon first.' },
  { key: 'supportThicknessMm', label: 'Clip thickness', min: 1.6, max: 2.4, step: 0.4, unit: 'mm' },
  { key: 'retainingLipMm', label: 'Hook reach', min: 0.8, max: 1.8, step: 0.1, unit: 'mm' },
];

export const tl21cFlatSideClips: MountDefinition = {
  id: 'neewer.tl21c.side-clips', revision: 1, label: 'Open-back side clips · prototype',
  strategy: 'wand-side-clips', fields,
  defaults: { fitClearancePerSideMm: 0.35, supportThicknessMm: 2, retainingLipMm: 1.4 },
  supportedApertures: ['rounded-rectangle'],
};

const frontClearance: Field = {
  key: 'frontClearanceMm', label: 'Diffuser clearance', min: 0.6, max: 2, step: 0.1, unit: 'mm',
  help: 'Gap above the curved diffuser for light grids. Check the fit coupon first.',
};

export const tl21cSideClips: MountDefinition = {
  ...tl21cFlatSideClips, revision: 2, fields: [...fields, frontClearance],
  defaults: { ...tl21cFlatSideClips.defaults, frontClearanceMm: 0.8 },
};

export const tl21cSlideOnRails: MountDefinition = {
  id: 'neewer.tl21c.slide-on', revision: 1, label: 'Slide-on rails', strategy: 'wand-slide-on',
  fields: [
    { ...fields[0], label: 'Rail clearance per side', help: 'Check that the coupon slides over the end cap and along the housing.' },
    { key: 'supportThicknessMm', label: 'Rail thickness', min: 2.4, max: 3.6, step: 0.4, unit: 'mm' },
    frontClearance,
  ],
  defaults: { fitClearancePerSideMm: 0.45, supportThicknessMm: 2.8, frontClearanceMm: 0.8 },
  supportedApertures: ['rounded-rectangle'],
};

export const tl21cSlideOn: MountDefinition = {
  ...tl21cSlideOnRails, revision: 2, label: 'Slide-on rings', strategy: 'wand-slide-on-rings',
  fields: [
    { ...tl21cSlideOnRails.fields[0], label: 'Ring clearance per side' },
    { ...tl21cSlideOnRails.fields[1], label: 'Ring thickness' },
    frontClearance,
  ],
};
