import { z } from 'zod';
import { attachments, historicalAttachments, historicalMounts, lamps, mounts, resolveDefinition } from '../catalog/registry.ts';
import { decodeProject as decodeLegacy, encodeProject as encodeLegacy } from '../project.ts';
import { defaultGrid, gridFields } from '../geometry/profile.ts';
import type { Diagnostic, Field } from './definitions.ts';

export const engine = { generatorVersion: '0.3.0', kernel: 'manifold', kernelVersion: '3.5.5' } as const;
const ref = z.strictObject({ id: z.string().min(1).max(100), revision: z.number().int().positive() });
const selection = ref.extend({ parameters: z.record(z.string(), z.number().finite()) }).strict();
export const designSchema = z.strictObject({
  format: z.literal('lamp-attachment-project'), schemaVersion: z.literal(1), units: z.literal('mm'),
  name: z.string().trim().min(1).max(100),
  engine: z.strictObject({ generatorVersion: z.enum(['0.2.0', '0.3.0']), kernel: z.literal('manifold'), kernelVersion: z.literal('3.5.5') }),
  lamp: ref, mount: selection.nullable(), attachment: selection,
  assembly: z.strictObject({ mode: z.enum(['integrated', 'fit-test', 'standalone']), connection: z.null() }),
  printProfile: z.strictObject({ printer: z.literal('bambu-lab'), nozzleDiameterMm: z.literal(0.4), material: z.enum(['unspecified', 'PLA', 'PETG', 'ASA']) }),
  export: z.strictObject({ format: z.literal('stl'), quality: z.literal('print'), orientation: z.enum(['front-down', 'assembly']) }),
});
export type Design = z.infer<typeof designSchema>;
export function createDesign(): Design {
  return { format: 'lamp-attachment-project', schemaVersion: 1, units: 'mm', name: 'P96L honeycomb', engine: { ...engine },
    lamp: { id: lamps[0].id, revision: lamps[0].revision },
    mount: { id: mounts[0].id, revision: mounts[0].revision, parameters: { ...mounts[0].defaults } },
    attachment: { id: attachments[0].id, revision: attachments[0].revision, parameters: { ...attachments[0].defaults } },
    assembly: { mode: 'integrated', connection: null },
    printProfile: { printer: 'bambu-lab', nozzleDiameterMm: 0.4, material: 'unspecified' }, export: { format: 'stl', quality: 'print', orientation: 'front-down' } };
}
export const legacyAttachment = { id: 'honeycomb', revision: 1, label: 'Honeycomb · original grid', description: 'Original standalone grid geometry.', fields: gridFields.map(f => ({ ...f, unit: 'mm' as const })), defaults: defaultGrid, supportedApertures: ['rounded-rectangle' as const] };
export function attachmentDefinition(project: Design) { return resolveDefinition([...attachments, ...historicalAttachments, legacyAttachment], project.attachment); }
function validateParameters(fields: readonly Field[], parameters: Record<string, number>) {
  const expected = new Set(fields.map(field => field.key));
  for (const key of Object.keys(parameters)) if (!expected.has(key)) throw new Error(`Unknown parameter ${key}.`);
  for (const field of fields) {
    const value = parameters[field.key];
    if (!Number.isFinite(value) || value < field.min || value > field.max) throw new Error(`${field.label} must be between ${field.min} and ${field.max} ${field.unit}.`);
  }
}
export function validateDesign(input: unknown): Design {
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) throw new Error('Unsupported or invalid project: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  const project = parsed.data;
  const lamp = resolveDefinition(lamps, project.lamp);
  const attachment = attachmentDefinition(project);
  validateParameters(attachment.fields, project.attachment.parameters);
  if (!attachment.supportedApertures.includes('rounded-rectangle')) throw new Error('Attachment does not support this aperture.');
  if (project.mount) {
    const mount = resolveDefinition([...mounts, ...historicalMounts], project.mount);
    if (!lamp.mounts.includes(mount.id)) throw new Error('This mount is not compatible with the selected lamp.');
    validateParameters(mount.fields, project.mount.parameters);
  }
  if (project.assembly.mode !== 'standalone' && !project.mount) throw new Error('An integrated accessory or fit test requires a mount.');
  if (project.attachment.revision === 1 && project.attachment.id === 'honeycomb' && project.assembly.mode !== 'standalone') throw new Error('Original grids support standalone output only. Upgrade explicitly to add a collar.');
  return project;
}
export function encodeDesign(project: Design) { return JSON.stringify(validateDesign(project), null, 2) + '\n'; }
export function decodeDesign(json: string): Design {
  if (new TextEncoder().encode(json).byteLength > 65536) throw new Error('Project exceeds the 64 KiB limit.');
  const data = JSON.parse(json);
  if (['beamkit-grid-prototype', 'lightform-grid-prototype'].includes(data?.format)) {
    const parameters = decodeLegacy(json);
    const project = createDesign();
    project.name = 'Imported original grid'; project.mount = null;
    project.attachment = { id: 'honeycomb', revision: 1, parameters };
    project.assembly.mode = 'standalone';
    return validateDesign(project);
  }
  if (data?.engine?.generatorVersion === '0.2.0' && data.export && data.export.orientation === undefined) data.export.orientation = 'assembly';
  return validateDesign(data);
}
export function upgradeLegacy(project: Design): Design {
  const next = createDesign(); next.name = project.name;
  next.attachment.parameters = { ...next.attachment.parameters, ...project.attachment.parameters };
  return next;
}
export function printDiagnostics(project: Design): Diagnostic[] {
  const notes: Diagnostic[] = [
    { level: 'warning', code: 'physical-unverified', message: 'Prototype: lamp fit, retention, heat resistance and optical behavior require hardware tests.' },
  ];
  if (project.assembly.mode !== 'standalone') notes.push({ level: 'warning', code: 'reference-dimensions', message: 'Lamp-fit dimensions and access cutouts use an unconfirmed reference. Test the fit coupon before the complete accessory.' });
  const wall = project.attachment.parameters.wall;
  if (wall < 0.8) notes.push({ level: 'warning', code: 'thin-wall', message: 'Walls below 0.8 mm leave fewer than two nominal 0.4 mm nozzle paths. Check wall generation in your slicer.' });
  if (project.mount && project.mount.parameters.engagementMm <= 11.5 && project.mount.parameters.retainingLipMm > 0) notes.push({ level: 'info', code: 'lip-omitted', message: 'Rear lips are omitted because engagement does not extend behind the 11.5 mm housing.' });
  if (project.printProfile.material === 'unspecified') notes.push({ level: 'info', code: 'material', message: 'Choose a material in your slicer and test temperature performance on the lamp.' });
  if ((project.mount?.revision ?? 0) >= 3) notes.push({ level: 'warning', code: 'snap-prototype', message: 'Two spring tabs use the recessed right-side dimensions. Click force, rear-corner clearance and fatigue are unverified; test the fit coupon in the intended material.' });
  return notes;
}
// Original JSON encoding stays available for users who need the historical grid format.
export { encodeLegacy };

export function upgradePrintDesign(project: Design): Design {
  const next = createDesign();
  next.name = project.name; next.printProfile = { ...project.printProfile };
  const attachment = attachments.find(entry => entry.id === project.attachment.id)!;
  next.attachment = { id: attachment.id, revision: attachment.revision, parameters: { ...attachment.defaults, ...project.attachment.parameters } };
  if (next.attachment.id === 'honeycomb' && next.attachment.parameters.frame === 2) next.attachment.parameters.frame = 1.6;
  next.attachment.parameters.depth = Math.max(next.attachment.parameters.depth, attachment.defaults.depth);
  if (project.mount) next.mount!.parameters = { ...next.mount!.parameters, ...project.mount.parameters, engagementMm: 14.5, retainingLipMm: 1.3, accessCutoutWidthMm: 85 };
  return validateDesign(next);
}
