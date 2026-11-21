import { materialRegions } from './domain/materials.ts';
import type { Design } from './domain/project.ts';
import type { AssemblyResult } from './generators/assembly.ts';
import { orientFrontDown } from './geometry/printability.ts';
import { licenseUrl, outputLicense } from './project.ts';
import { storedZip } from './zip.ts';

const coreNamespace = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
const modelRelationship = 'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel';
const xml = '<?xml version="1.0" encoding="UTF-8"?>';

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
}

/** One Core 3MF build object whose three components are closed filament regions. */
export function multicolor3mf(result: AssemblyResult, orientation: Design['export']['orientation']): ArrayBuffer {
  if (result.parts.length !== 1 || result.regions?.length !== 3) {
    throw new Error('Multicolor export requires three regions from the current integrated model.');
  }
  const { regions } = result;
  const frontZ = result.parts[0].bounds.max[2];
  const definitions = regions.map(({ material, name }) => ({ label: name, color: materialRegions[material].color }));
  const baseMaterials = definitions.map(({ label, color }) =>
    `<base name="${escapeXml(label)}" displaycolor="${color}"/>`).join('');
  const objects = regions.map((region, index) => {
    const mesh = orientation === 'front-down' ? orientFrontDown(region.mesh, frontZ) : region.mesh;
    const vertices: string[] = [];
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const [x, y, z] = mesh.positions.subarray(i, i + 3);
      vertices.push(`<vertex x="${x}" y="${y}" z="${z}"/>`);
    }
    const triangles: string[] = [];
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = mesh.indices.subarray(i, i + 3);
      triangles.push(`<triangle v1="${a}" v2="${b}" v3="${c}"/>`);
    }
    return `<object id="${index + 2}" type="model" name="${escapeXml(definitions[index].label)}" pid="1" pindex="${index}">` +
      `<mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh></object>`;
  }).join('');
  const components = regions.map((_, index) => `<component objectid="${index + 2}"/>`).join('');
  const model = `${xml}<model unit="millimeter" xml:lang="en-US" xmlns="${coreNamespace}">` +
    `<metadata name="Title">BeamKit multicolor light grid</metadata>` +
    `<metadata name="LicenseTerms">${outputLicense} ${licenseUrl}</metadata>` +
    `<resources><basematerials id="1">${baseMaterials}</basematerials>${objects}` +
    `<object id="5" type="model" name="BeamKit light grid"><components>${components}</components></object></resources>` +
    `<build><item objectid="5"/></build></model>`;

  const types = `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
  const relationships = `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rel0" Type="${modelRelationship}" Target="/3D/3dmodel.model"/></Relationships>`;
  const encoder = new TextEncoder();
  return storedZip([
    { name: '[Content_Types].xml', data: encoder.encode(types) },
    { name: '_rels/.rels', data: encoder.encode(relationships) },
    { name: '3D/3dmodel.model', data: encoder.encode(model) },
  ]);
}
