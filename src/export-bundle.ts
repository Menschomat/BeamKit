import { storedZip } from './zip.ts';
import { multicolor3mf } from './export-3mf.ts';
import { orientFrontDown } from './geometry/printability.ts';
import { binaryStl } from './export.ts';
import { encodeDesign } from './domain/project.ts';
import type { Design } from './domain/project.ts';
import type { AssemblyResult } from './generators/assembly.ts';
import { licenseUrl, outputLicense } from './project.ts';

/** Portable uncompressed ZIP: only original printable geometry, settings and dedication. */
export function exportBundle(project: Design, result: AssemblyResult): ArrayBuffer {
  const text = new TextEncoder();
  const models = project.export.format === '3mf'
    ? [{ name: `${result.parts[0].name}-multicolor.3mf`, data: new Uint8Array(multicolor3mf(result, project.export.orientation)) }]
    : result.parts.map(part => ({ name: `${part.name}.stl`, data: new Uint8Array(binaryStl(project.export.orientation === 'front-down' ? orientFrontDown(part.mesh) : part.mesh)) }));
  const entries = [
    ...models,
    { name: 'project.json', data: text.encode(encodeDesign(project)) },
    { name: 'OUTPUT_LICENSE.txt', data: text.encode(`BeamKit original generator output\nSPDX-License-Identifier: ${outputLicense}\n${licenseUrl}\n\nBeamKit dedicates its rights, if any, in its original generated geometry under CC0 1.0 Universal. Third-party and user-contributed rights remain with their holders.\n\nModel coordinates are millimetres. Lamp previews are excluded.\nPrototype: fit, retention, heat and optical behavior require hardware testing.\n`) },
  ];
  return storedZip(entries);
}
