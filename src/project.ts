import { p96l } from './catalog/p96l.ts';
import { gridFields, validateGrid } from './geometry/profile.ts';
import type { GridSettings } from './geometry/profile.ts';

export const outputLicense = 'CC0-1.0';
export const licenseUrl = 'https://creativecommons.org/publicdomain/zero/1.0/';

export function encodeProject(settings: GridSettings) {
  validateGrid(settings);
  return JSON.stringify({
    format: 'lightform-grid-prototype',
    schemaVersion: 1,
    units: 'mm',
    lamp: { id: p96l.id, revision: p96l.revision },
    attachment: { id: 'honeycomb', revision: 1, parameters: settings },
    outputLicense,
  }, null, 2) + '\n';
}

export function decodeProject(json: string): GridSettings {
  const data = JSON.parse(json);
  if (data?.format !== 'lightform-grid-prototype' || data.schemaVersion !== 1 ||
      data.units !== 'mm' || data.lamp?.id !== p96l.id || data.lamp.revision !== p96l.revision ||
      data.attachment?.id !== 'honeycomb' || data.attachment.revision !== 1) {
    throw new Error('This file is not a supported Lightform grid prototype.');
  }
  const settings = Object.fromEntries(gridFields.map(({ key }) => [
    key, data.attachment.parameters?.[key],
  ])) as GridSettings;
  validateGrid(settings);
  return settings;
}
