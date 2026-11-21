import type { AttachmentDefinition, Field } from '../domain/definitions.ts';

export const gridPatternIds = ['honeycomb', 'square-eggcrate', 'rectangular-eggcrate', 'parallel-louvers'] as const;
export type GridPatternId = typeof gridPatternIds[number];

export function isGridPattern(id: string): id is GridPatternId {
  return gridPatternIds.some(pattern => pattern === id);
}

const commonFields: readonly Field[] = [
  { key: 'depth', label: 'Depth', min: 4.8, max: 35, step: 0.1, unit: 'mm' },
  { key: 'wall', label: 'Wall thickness', min: 0.4, max: 2, step: 0.1, unit: 'mm' },
  { key: 'frame', label: 'Frame width', min: 1.6, max: 5, step: 0.1, unit: 'mm' },
  { key: 'inset', label: 'Aperture inset', min: 0, max: 4, step: 0.2, unit: 'mm' },
];
const commonDefaults = { depth: 12, wall: 0.8, frame: 1.6, inset: 0 };

function opening(key: string, label: string): Field {
  return { key, label, min: 2, max: 15, step: 0.1, unit: 'mm' };
}

export const extraGridPatterns: readonly AttachmentDefinition[] = [
  {
    id: 'square-eggcrate', revision: 1, label: 'Square eggcrate',
    description: 'Equal clear cell widths along both lamp axes.',
    fields: [opening('opening', 'Clear cell width'), ...commonFields],
    defaults: { ...commonDefaults, opening: 6 },
    supportedApertures: ['rounded-rectangle'],
  },
  {
    id: 'rectangular-eggcrate', revision: 1, label: 'Rectangular eggcrate',
    description: 'Use a smaller opening along the axis where you want less spill.',
    fields: [
      opening('openingX', 'Clear opening A'), opening('openingY', 'Clear opening B'), ...commonFields,
      { key: 'orientation', label: 'Cell orientation', min: 0, max: 90, step: 90, unit: '°',
        choices: [{ value: 0, label: 'A along long edge' }, { value: 90, label: 'A along short edge' }] },
    ],
    defaults: { ...commonDefaults, openingX: 4, openingY: 10, orientation: 0 },
    supportedApertures: ['rounded-rectangle'],
  },
  {
    id: 'parallel-louvers', revision: 1, label: 'Parallel louvers',
    description: 'Reduce spill across the slats and keep broader coverage along them.',
    fields: [
      opening('spacing', 'Clear slat spacing'), ...commonFields,
      { key: 'orientation', label: 'Slat direction', min: 0, max: 90, step: 90, unit: '°',
        choices: [{ value: 0, label: 'Parallel to long edge' }, { value: 90, label: 'Parallel to short edge' }] },
    ],
    defaults: { ...commonDefaults, spacing: 6, orientation: 0 },
    supportedApertures: ['rounded-rectangle'],
  },
];
