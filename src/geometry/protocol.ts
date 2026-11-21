import type { Aperture, GridSettings } from './profile.ts';
export type GridRequest = { id: number; aperture: Aperture; settings: GridSettings };
export type GridMesh = { positions: Float32Array<ArrayBuffer>; indices: Uint32Array<ArrayBuffer> };
export type GridResponse = { id: number } & (GridMesh | { error: string });

import type { Design } from '../domain/project.ts';
import type { AssemblyResult } from '../generators/assembly.ts';
export type GenerationRequest = { id: number; projectRevision: number; project: Design };
export type GenerationResponse = { id: number; projectRevision: number } & ({ result: AssemblyResult } | { error: string });
