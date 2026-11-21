import type { GridMesh } from './protocol.ts';

export type OverhangOptions = {
  /** Maximum surface angle from vertical; a horizontal underside is 90 degrees. */
  maxOverhangDegrees?: number;
  bedToleranceMm?: number;
};
export type OverhangReport = {
  downwardAreaMm2: number;
  steepOverhangAreaMm2: number;
  maxOverhangDegrees: number;
  steepTriangleIndices: number[];
  bedContactAreaMm2: number;
  degenerateTriangleIndices: number[];
};

/** Rotate the front face onto the bed without reflecting the solid or changing scale. */
export function orientFrontDown(mesh: GridMesh, sharedFrontZ?: number): GridMesh {
  if (mesh.positions.length === 0 || mesh.positions.length % 3 !== 0 || !mesh.positions.every(Number.isFinite)) {
    throw new Error('Print orientation requires finite three-dimensional vertices.');
  }
  let frontZ = sharedFrontZ ?? -Infinity;
  if (sharedFrontZ === undefined) {
    for (let i = 2; i < mesh.positions.length; i += 3) frontZ = Math.max(frontZ, mesh.positions[i]);
  }
  const positions = new Float32Array(mesh.positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = mesh.positions[i];
    positions[i + 1] = -mesh.positions[i + 1];
    positions[i + 2] = frontZ - mesh.positions[i + 2];
  }
  return { positions, indices: new Uint32Array(mesh.indices) };
}

/**
 * Find local downward-facing overhang candidates on an already bed-oriented mesh.
 * This cannot establish bridge support, layer connectivity, adhesion, or print success.
 */
export function analyzeOverhangs(mesh: GridMesh, options: OverhangOptions = {}): OverhangReport {
  const limit = options.maxOverhangDegrees ?? 45;
  const bedToleranceMm = options.bedToleranceMm ?? 0.05;
  if (!Number.isFinite(limit) || limit < 0 || limit > 90 || !Number.isFinite(bedToleranceMm) || bedToleranceMm < 0) {
    throw new Error('Use an overhang limit from 0 to 90 degrees and a nonnegative bed tolerance.');
  }
  if (mesh.positions.length % 3 !== 0 || mesh.indices.length % 3 !== 0 || !mesh.positions.every(Number.isFinite)) {
    throw new Error('Overhang analysis requires finite vertices and complete triangles.');
  }
  const report: OverhangReport = {
    downwardAreaMm2: 0, steepOverhangAreaMm2: 0, maxOverhangDegrees: 0,
    steepTriangleIndices: [], bedContactAreaMm2: 0, degenerateTriangleIndices: [],
  };
  for (let triangle = 0; triangle < mesh.indices.length / 3; triangle++) {
    const ids = [0, 1, 2].map(vertex => mesh.indices[triangle * 3 + vertex] * 3);
    if (ids.some(id => id + 2 >= mesh.positions.length)) throw new Error('Overhang analysis found an invalid vertex index.');
    const [a, b, c] = ids.map(id => mesh.positions.subarray(id, id + 3));
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const magnitude = Math.hypot(nx, ny, nz);
    if (!(magnitude > 0)) { report.degenerateTriangleIndices.push(triangle); continue; }
    if (nz >= -magnitude * 1e-10) continue;
    const area = magnitude / 2;
    if ([a, b, c].every(point => Math.abs(point[2]) <= bedToleranceMm)) {
      report.bedContactAreaMm2 += area;
      continue;
    }
    const angle = Math.asin(Math.min(1, -nz / magnitude)) * 180 / Math.PI;
    report.downwardAreaMm2 += area;
    report.maxOverhangDegrees = Math.max(report.maxOverhangDegrees, angle);
    if (angle > limit + 1e-7) {
      report.steepOverhangAreaMm2 += area;
      report.steepTriangleIndices.push(triangle);
    }
  }
  return report;
}
