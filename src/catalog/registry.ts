import { extraGridPatterns } from './grid-patterns.ts';
import { p96l } from './p96l.ts';
import type { AttachmentDefinition, ConnectionDefinition, Field, LampDefinition, MountDefinition } from '../domain/definitions.ts';
import { gridFields } from '../geometry/profile.ts';

const cornerMountFields: readonly Field[] = [
  { key: 'fitClearancePerSideMm', label: 'Fit clearance per side', min: 0.15, max: 1, step: 0.05, unit: 'mm', help: 'Gap on each side of the lamp housing. Start with the fit test.' },
  { key: 'engagementMm', label: 'Corner clip depth', min: 14.5, max: 19, step: 0.5, unit: 'mm' },
  { key: 'supportThicknessMm', label: 'Support thickness', min: 1.6, max: 3.2, step: 0.4, unit: 'mm' },
  { key: 'diffuserClearanceMm', label: 'Front clearance', min: 0.4, max: 2, step: 0.2, unit: 'mm' },
  { key: 'retainingLipMm', label: 'Hook reach', min: 1.8, max: 2.6, step: 0.1, unit: 'mm', help: 'Sets how far the spring hooks reach behind the lamp. Retention needs print testing.' },
  { key: 'accessCutoutWidthMm', label: 'Control access width', min: 60, max: 85, step: 1, unit: 'mm', help: 'Open access on both long sides. Positions are provisional.' },
];
const cornerMount: MountDefinition = {
  id: 'smallrig.p96l.collar', revision: 5, label: 'Four corner clips · prototype', fields: cornerMountFields,
  defaults: { fitClearancePerSideMm: 0.3, engagementMm: 14.5, supportThicknessMm: 1.6,
    diffuserClearanceMm: 0.8, retainingLipMm: 2.1, accessCutoutWidthMm: 85 },
  supportedApertures: ['rounded-rectangle'],
};
export const mountFields: readonly Field[] = [
  ...cornerMountFields,
  { key: 'plateClearanceWidthMm', label: 'Plate clearance width', min: 40, max: 88, step: 1, unit: 'mm',
    help: 'Width of the recess along the threaded edge, centered on the screw.' },
];
export const mounts: readonly MountDefinition[] = [{
  ...cornerMount, revision: 6, fields: mountFields,
  defaults: { ...cornerMount.defaults, plateClearanceWidthMm: 72 },
}];
export const attachments: readonly AttachmentDefinition[] = [
  { id: 'honeycomb', revision: 3, label: 'Honeycomb', description: 'Restricts spill with open hexagonal cells.',
    fields: [...gridFields.map(field => ({ ...field, ...(field.key === 'depth' ? { min: 4.8 } : field.key === 'frame' ? { min: 1.6 } : {}), unit: 'mm' as const })),
      { key: 'inset', label: 'Aperture inset', min: 0, max: 4, step: 0.2, unit: 'mm' },
      { key: 'orientation', label: 'Cell orientation', min: 0, max: 60, step: 5, unit: '°' }],
    defaults: { opening: 6, depth: 12, wall: 0.8, frame: 1.6, inset: 0, orientation: 0 },
    supportedApertures: ['rounded-rectangle'],
  },
  { id: 'diffusion-sheet-holder', revision: 2, label: 'Diffusion sheet holder',
    description: 'An open frame with a shallow ledge for removable commercial diffusion material.',
    fields: [
      { key: 'depth', label: 'Holder depth', min: 6.4, max: 12, step: 0.4, unit: 'mm' },
      { key: 'wall', label: 'Frame wall', min: 1.2, max: 3.2, step: 0.4, unit: 'mm' },
      { key: 'ledge', label: 'Sheet ledge', min: 1.2, max: 4, step: 0.4, unit: 'mm' },
      { key: 'sheetThickness', label: 'Sheet thickness', min: 0.1, max: 1, step: 0.1, unit: 'mm' },
    ], defaults: { depth: 6.4, wall: 1.6, ledge: 2, sheetThickness: 0.3 }, supportedApertures: ['rounded-rectangle'],
  },
  ...extraGridPatterns,
];
export const lamps: readonly LampDefinition[] = [{ ...p96l,
  provenance: { source: 'Reference-model dimensions recorded in PROJECT_PLAN.md', confidence: 'reference-only',
    note: 'Housing and aperture dimensions have not been checked against a physical lamp. Preview is independently procedural.' },
  mounts: ['smallrig.p96l.collar'],
  mountingFacts: { rightSideInsetMm: 0.8, rearFaceInsetMm: 1.5, plateSeat: p96l.detail.mountingSeat },
  keepouts: [
    // Conservative access volumes from private reference measurements, expanded for use.
    { id: 'usb-cable-access', bounds: { min: [-49, -50, -13.5], max: [-29, -26, 0.4] }, confidence: 'provisional' },
    { id: 'mounting-screw-access', bounds: { min: [-12, -50, -14], max: [12, -24, 0.4] }, confidence: 'provisional' },
    { id: 'switch-and-button-access', bounds: { min: [-44, 25, -14], max: [-14, 50, 0.4] }, confidence: 'provisional' },
    { id: 'dial-finger-access', bounds: { min: [-75, -24, -14], max: [-50, 24, 0.4] }, confidence: 'provisional' },
  ],
}];
export const connections: readonly ConnectionDefinition[] = [{
  id: 'rectangular-accessory', revision: 1, label: 'Rectangular accessory interface', status: 'awaiting-fit-tests',
  engagementDirection: '+Z', supportedApertures: ['rounded-rectangle'],
  reason: 'Modular export is unavailable until collar fit and a retained connection are tested on hardware.',
}];
export const exporters = [{ id: 'stl', revision: 1, label: 'Binary STL', units: 'mm' }] as const;

export function resolveDefinition<T extends { id: string; revision: number }>(entries: readonly T[], ref: { id: string; revision: number }): T {
  const entry = entries.find(entry => entry.id === ref.id && entry.revision === ref.revision);
  if (!entry) throw new Error(`Unsupported definition ${ref.id} revision ${ref.revision}.`);
  return entry;
}

// Historical revisions remain reproducible; they are not choices for new designs.
export const historicalMounts: readonly MountDefinition[] = [cornerMount, {
  ...cornerMount, revision: 4, label: 'Right corner clips · prototype',
  fields: cornerMountFields.map(field => field.key === 'engagementMm' ? { ...field, min: 16.5 } : field),
  defaults: { ...cornerMount.defaults, engagementMm: 16.5 },
}, {
  ...cornerMount, revision: 3, label: 'Two-tab click mount · prototype',
  fields: cornerMountFields.map(field => field.key === 'engagementMm'
    ? { ...field, label: 'Spring tab length', min: 14, max: 18 }
    : field.key === 'retainingLipMm' ? { ...field, min: 0.8, max: 1.6 } : field),
  defaults: { ...cornerMount.defaults, engagementMm: 14.5, retainingLipMm: 1.3 },
}, { ...cornerMount, revision: 2, fields: cornerMountFields.map(f => f.key === 'engagementMm' ? { ...f, min: 4, max: 13 } : f.key === 'retainingLipMm' ? { ...f, min: 0, max: 0.8 } : f), defaults: { ...cornerMount.defaults, engagementMm: 12.5, retainingLipMm: 0.4 } }, { ...cornerMount, revision: 1, fields: cornerMountFields.map(f => f.key === 'engagementMm' ? { ...f, min: 4, max: 13 } : f.key === 'retainingLipMm' ? { ...f, min: 0, max: 0.8 } : f),
  defaults: { ...cornerMount.defaults, engagementMm: 12.5, retainingLipMm: 0.4, accessCutoutWidthMm: 76 } }];
export const historicalAttachments: readonly AttachmentDefinition[] = [
  { ...attachments[0], revision: 2, defaults: { ...attachments[0].defaults, frame: 2 }, fields: [...gridFields.map(field => ({ ...field, unit: 'mm' as const })), ...attachments[0].fields.slice(4)] },
  { ...attachments[1], revision: 1, fields: attachments[1].fields.map(field => field.key === 'depth' ? { ...field, min: 3.2 } : field), defaults: { ...attachments[1].defaults, depth: 4 } },
];
