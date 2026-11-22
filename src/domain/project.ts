import { isGridPattern } from '../catalog/grid-patterns.ts';
import { z } from 'zod';
import { attachments, historicalAttachments, historicalMounts, lamps, mounts, resolveDefinition } from '../catalog/registry.ts';
import { decodeProject as decodeLegacy, encodeProject as encodeLegacy } from '../project.ts';
import { defaultGrid, gridFields } from '../geometry/profile.ts';
import type { Diagnostic, Field, LampDefinition } from './definitions.ts';

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
  export: z.strictObject({ format: z.enum(['stl', '3mf']), quality: z.literal('print'), orientation: z.enum(['front-down', 'assembly']) }),
});
export type Design = z.infer<typeof designSchema>;
export function defaultMountForLamp(lamp: LampDefinition): Design['mount'] {
  const mount = mounts.find(entry => lamp.mounts.includes(entry.id));
  return mount ? { id: mount.id, revision: mount.revision, parameters: { ...mount.defaults } } : null;
}

export function createDesign(format: Design['export']['format'] = '3mf', lamp = lamps[0]): Design {
  const mount = defaultMountForLamp(lamp);
  const name = lamp.id === lamps[0].id ? 'P96L honeycomb' : `${lamp.label} honeycomb`;
  return { format: 'lamp-attachment-project', schemaVersion: 1, units: 'mm', name, engine: { ...engine },
    lamp: { id: lamp.id, revision: lamp.revision },
    mount,
    attachment: { id: attachments[0].id, revision: attachments[0].revision, parameters: { ...attachments[0].defaults } },
    assembly: { mode: mount ? 'integrated' : 'standalone', connection: null },
    printProfile: { printer: 'bambu-lab', nozzleDiameterMm: 0.4, material: 'unspecified' }, export: { format: mount ? format : 'stl', quality: 'print', orientation: 'front-down' } };
}
export const legacyAttachment = { id: 'honeycomb', revision: 1, label: 'Honeycomb · original grid', description: 'Original standalone grid geometry.', fields: gridFields.map(f => ({ ...f, unit: 'mm' as const })), defaults: defaultGrid, supportedApertures: ['rounded-rectangle' as const] };
export function attachmentDefinition(project: Design) { return resolveDefinition([...attachments, ...historicalAttachments, legacyAttachment], project.attachment); }
export function mountDefinition(mount: NonNullable<Design['mount']>) {
  return resolveDefinition([...mounts, ...historicalMounts], mount);
}
function validateParameters(fields: readonly Field[], parameters: Record<string, number>) {
  const expected = new Set(fields.map(field => field.key));
  for (const key of Object.keys(parameters)) if (!expected.has(key)) throw new Error(`Unknown parameter ${key}.`);
  for (const field of fields) {
    const value = parameters[field.key];
    if (field.choices && !field.choices.some(choice => choice.value === value)) {
      throw new Error(`Choose a supported value for ${field.label.toLowerCase()}.`);
    }
    if (!Number.isFinite(value) || value < field.min || value > field.max) throw new Error(`${field.label} must be between ${field.min} and ${field.max} ${field.unit}.`);
  }
}
export function supportsMulticolor(project: Design) {
  return project.assembly.mode === 'integrated' && project.mount !== null &&
    isGridPattern(project.attachment.id) &&
    (project.attachment.id !== 'honeycomb' || project.attachment.revision >= 3);
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
    const mount = mountDefinition(project.mount);
    if (!lamp.mounts.includes(mount.id)) throw new Error('This mount is not compatible with the selected lamp.');
    validateParameters(mount.fields, project.mount.parameters);
  }
  if (project.assembly.mode !== 'standalone' && !project.mount) throw new Error('An integrated accessory or fit test requires a mount.');
  if (project.attachment.revision === 1 && project.attachment.id === 'honeycomb' && project.assembly.mode !== 'standalone') throw new Error('Original grids support standalone output only. Upgrade explicitly to add a collar.');
  if (project.export.format === '3mf' && !supportsMulticolor(project)) {
    throw new Error('Multicolor export requires an integrated light grid.');
  }
  return project;
}
export function encodeDesign(project: Design) { return JSON.stringify(validateDesign(project), null, 2) + '\n'; }
export function decodeDesign(json: string): Design {
  if (new TextEncoder().encode(json).byteLength > 65536) throw new Error('Project exceeds the 64 KiB limit.');
  const data = JSON.parse(json);
  if (['beamkit-grid-prototype', 'lightform-grid-prototype'].includes(data?.format)) {
    const parameters = decodeLegacy(json);
    const project = createDesign('stl');
    project.name = 'Imported original grid'; project.mount = null;
    project.attachment = { id: 'honeycomb', revision: 1, parameters };
    project.assembly.mode = 'standalone';
    return useCurrentDesign(validateDesign(project));
  }
  if (data?.engine?.generatorVersion === '0.2.0' && data.export && data.export.orientation === undefined) data.export.orientation = 'assembly';
  return useCurrentDesign(validateDesign(data));
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
  if ((project.mount?.revision ?? 0) >= 3) notes.push({ level: 'warning', code: 'snap-prototype', message: 'Test click force, release and retention using the fit coupon and your intended material.' });
  if (project.mount && project.mount.revision >= 4 &&
      project.mount.parameters.retainingLipMm <= 1.5 + project.mount.parameters.fitClearancePerSideMm) {
    notes.push({ level: 'warning', code: 'corner-overlap', message: 'Hook reach does not overlap the modeled rear shoulder at this clearance. Increase hook reach or reduce fit clearance.' });
  }
  if (project.assembly.mode !== 'standalone' && project.mount && mountDefinition(project.mount).strategy === 'wand-side-clips' &&
      project.mount.parameters.retainingLipMm <= project.mount.parameters.fitClearancePerSideMm) {
    notes.push({ level: 'warning', code: 'wand-hook-overlap', message: 'The clips do not reach behind the modeled shoulder at this clearance. Adjust hook reach and print a fit coupon.' });
  }
  return notes;
}
// Original JSON encoding stays available for users who need the historical grid format.
export { encodeLegacy };

function useCurrentDesign(project: Design): Design {
  const attachment = attachments.find(entry => entry.id === project.attachment.id)!;
  const mount = mounts.find(entry => entry.id === project.mount?.id);
  const olderAttachment = project.attachment.revision < attachment.revision;
  const olderMount = project.mount !== null && mount !== undefined && project.mount.revision < mount.revision;
  if (!olderAttachment && !olderMount) return project;

  const originalGrid = project.attachment.id === 'honeycomb' && project.attachment.revision === 1;
  const next = createDesign('stl', resolveDefinition(lamps, project.lamp));
  next.name = project.name;
  next.lamp = project.lamp;
  next.printProfile = project.printProfile;
  next.assembly.mode = originalGrid ? 'integrated' : project.assembly.mode;
  next.attachment = { id: attachment.id, revision: attachment.revision, parameters: {
    ...attachment.defaults, ...project.attachment.parameters,
  } };
  for (const field of attachment.fields) {
    const value = next.attachment.parameters[field.key];
    next.attachment.parameters[field.key] = Math.min(field.max, Math.max(field.min, value));
  }
  if (olderAttachment) {
    const parameters = next.attachment.parameters;
    // Historical shallow grids and holders may need extra depth for the print ramps.
    const minimumDepth = attachment.id === 'diffusion-sheet-holder'
      ? Math.max(attachment.defaults.depth, 3.5 + Math.SQRT2 * parameters.ledge + 2 * parameters.sheetThickness)
      : attachment.defaults.depth;
    parameters.depth = Math.max(parameters.depth, minimumDepth);
  }
  if (project.mount && next.mount) {
    if (olderMount) {
      const { engagementMm, retainingLipMm } = next.mount.parameters;
      next.mount.parameters = { ...next.mount.parameters, ...project.mount.parameters };
      if (mount?.strategy !== 'wand-side-clips') {
        if (project.mount.revision < 5) next.mount.parameters.engagementMm = engagementMm;
        if (project.mount.revision < 4) next.mount.parameters.retainingLipMm = retainingLipMm;
      }
    } else {
      next.mount = project.mount;
    }
  } else if (!originalGrid) {
    next.mount = null;
  }
  if (project.mount && (!olderMount || mount?.strategy === 'wand-side-clips' || project.mount.revision >= 5)) {
    next.export.orientation = project.export.orientation;
  }
  if (project.export.format === '3mf' && supportsMulticolor(next)) next.export.format = '3mf';
  return validateDesign(next);
}
