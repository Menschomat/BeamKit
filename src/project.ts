import { z } from 'zod';
import { p96l } from './catalog/p96l.ts';
import { gridFields, validateGrid } from './geometry/profile.ts';
import type { GridSettings } from './geometry/profile.ts';

export const outputLicense = 'CC0-1.0';
export const licenseUrl = 'https://creativecommons.org/publicdomain/zero/1.0/';
export const maximumProjectBytes = 64 * 1024;
const parameters = z.strictObject(Object.fromEntries(gridFields.map(field => [
  field.key, z.number().min(field.min).max(field.max),
])) as Record<keyof GridSettings, z.ZodNumber>);
export const projectSchema = z.strictObject({
  format: z.literal('beamkit-grid-prototype'),
  schemaVersion: z.literal(1),
  units: z.literal('mm'),
  lamp: z.strictObject({ id: z.literal(p96l.id), revision: z.literal(p96l.revision) }),
  attachment: z.strictObject({ id: z.literal('honeycomb'), revision: z.literal(1), parameters }),
  outputLicense: z.literal(outputLicense),
});

export function encodeProject(settings: GridSettings) {
  validateGrid(settings);
  return JSON.stringify(projectSchema.parse({
    format: 'beamkit-grid-prototype', schemaVersion: 1, units: 'mm',
    lamp: { id: p96l.id, revision: p96l.revision },
    attachment: { id: 'honeycomb', revision: 1, parameters: settings }, outputLicense,
  }), null, 2) + '\n';
}

export function decodeProject(json: string): GridSettings {
  if (new TextEncoder().encode(json).byteLength > maximumProjectBytes) {
    throw new Error('The project file is too large (maximum 64 KiB).');
  }
  const data = JSON.parse(json);
  // The original application name used the same geometry revision and settings.
  if (data?.format === 'lightform-grid-prototype') data.format = 'beamkit-grid-prototype';
  const result = projectSchema.safeParse(data);
  if (!result.success) {
    throw new Error('Unsupported or invalid project: ' + result.error.issues.map(issue =>
      `${issue.path.join('.') || 'project'}: ${issue.message}`).join('; '));
  }
  validateGrid(result.data.attachment.parameters);
  return result.data.attachment.parameters;
}
