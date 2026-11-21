import { openDB } from 'idb';
import { decodeProject, encodeProject } from '../project.ts';
import type { GridSettings } from '../geometry/profile.ts';

function database() {
  return openDB('beamkit', 1, { upgrade(db) { db.createObjectStore('projects'); } });
}
export async function saveProject(name: string, settings: GridSettings) {
  const json = encodeProject(settings);
  const db = await database();
  try { await db.put('projects', json, name); } finally { db.close(); }
}
export async function loadProject(name: string): Promise<GridSettings | undefined> {
  const db = await database();
  try {
    const json = await db.get('projects', name);
    return json === undefined ? undefined : decodeProject(json);
  } finally { db.close(); }
}
export async function projectNames(): Promise<string[]> {
  const db = await database();
  try { return (await db.getAllKeys('projects')).map(String).filter(name => name !== '_autosave'); }
  finally { db.close(); }
}
