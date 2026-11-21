import type { GridMesh } from './geometry/protocol.ts';
import { licenseUrl, outputLicense } from './project.ts';

export function binaryStl({ positions, indices }: GridMesh) {
  const triangleCount = indices.length / 3;
  const data = new ArrayBuffer(84 + triangleCount * 50);
  const bytes = new Uint8Array(data);
  bytes.set(new TextEncoder().encode(`Lightform | mm | ${outputLicense} | ${licenseUrl}`));
  const view = new DataView(data);
  view.setUint32(80, triangleCount, true);
  for (let face = 0; face < triangleCount; face++) {
    const a = indices[face * 3] * 3;
    const b = indices[face * 3 + 1] * 3;
    const c = indices[face * 3 + 2] * 3;
    const u = [0, 1, 2].map((axis) => positions[b + axis] - positions[a + axis]);
    const v = [0, 1, 2].map((axis) => positions[c + axis] - positions[a + axis]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...normal);
    const offset = 84 + face * 50;
    normal.forEach((value, axis) => view.setFloat32(offset + axis * 4, length ? value / length : 0, true));
    [a, b, c].forEach((start, vertex) => {
      for (let axis = 0; axis < 3; axis++) {
        view.setFloat32(offset + 12 + (vertex * 3 + axis) * 4, positions[start + axis], true);
      }
    });
  }
  return data;
}

export function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
