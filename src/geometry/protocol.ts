import type { Aperture, GridSettings } from './profile.ts';
export type GridRequest = { id: number; aperture: Aperture; settings: GridSettings };
export type GridMesh = { positions: Float32Array<ArrayBuffer>; indices: Uint32Array<ArrayBuffer> };
export type GridResponse = { id: number } & (GridMesh | { error: string });
