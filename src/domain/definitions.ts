import type { Aperture } from '../geometry/profile.ts';
import type { LampReference } from '../geometry/lamp-reference.ts';

export type Field = { key: string; label: string; min: number; max: number; step: number; unit: 'mm' | '°'; help?: string; choices?: readonly { value: number; label: string }[] };
export type DefinitionRef = { id: string; revision: number };
export type Bounds = { min: [number, number, number]; max: [number, number, number] };
export type Diagnostic = { level: 'info' | 'warning'; code: string; message: string };
export type LampDefinition = DefinitionRef & LampReference & {
  label: string;
  provenance: { source: string; confidence: 'reference-only' | 'measured'; note: string };
  keepouts: { id: string; bounds: Bounds; confidence: 'provisional' | 'measured' }[];
  mounts: string[];
  mountingFacts?: { rightSideInsetMm: number; rearFaceInsetMm: number };
};
export type MountDefinition = DefinitionRef & {
  label: string; fields: readonly Field[]; defaults: Record<string, number>;
  supportedApertures: ApertureKind[];
};
export type ApertureKind = 'rounded-rectangle' | 'circle' | 'polygon';
export type OpticalAperture = { kind: 'rounded-rectangle'; dimensions: Aperture }
  | { kind: 'circle'; diameter: number }
  | { kind: 'polygon'; points: [number, number][] };
export type AttachmentDefinition = DefinitionRef & {
  label: string; description: string; fields: readonly Field[]; defaults: Record<string, number>;
  supportedApertures: ApertureKind[];
};
export type ConnectionDefinition = DefinitionRef & {
  label: string; status: 'awaiting-fit-tests'; engagementDirection: '+Z';
  supportedApertures: ApertureKind[]; reason: string;
};
