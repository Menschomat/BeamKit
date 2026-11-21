import { openDB } from 'idb';
import { decodeDesign, encodeDesign } from '../domain/project.ts';
import type { Design } from '../domain/project.ts';
function database() { return openDB('beamkit', 1, { upgrade(db) { db.createObjectStore('projects'); } }); }
let writes = Promise.resolve();
export function saveProject(name: string, project: Design): Promise<void> {
  const json = encodeDesign(project);
  const write = writes.catch(() => {}).then(async () => {
    const db = await database();
    try {
      const tx = db.transaction('projects', 'readwrite');
      await tx.store.put(json, name);
      if (name === '_autosave') {
        await tx.store.put(json, `_history:${Date.now()}`);
        const keys = (await tx.store.getAllKeys()).filter(key => String(key).startsWith('_history:'));
        for (const key of keys.slice(0, Math.max(0, keys.length - 20))) await tx.store.delete(key);
      }
      await tx.done;
    } finally { db.close(); }
  });
  writes = write;
  return write;
}
export async function loadProject(name: string): Promise<Design | undefined> {
  await writes.catch(() => {});
  const db = await database();
  try { const json = await db.get('projects', name); return json === undefined ? undefined : decodeDesign(json); }
  finally { db.close(); }
}
export async function projectNames(): Promise<string[]> {
  const db = await database();
  try { return (await db.getAllKeys('projects')).map(String).filter(name => !name.startsWith('_')); } finally { db.close(); }
}
export async function deleteProject(name: string) {
  const db = await database(); try { await db.delete('projects', name); } finally { db.close(); }
}
export async function autosaveHistory(): Promise<{ key: string; project: Design }[]> {
  const db = await database();
  try {
    const keys = (await db.getAllKeys('projects')).map(String).filter(key => key.startsWith('_history:')).reverse();
    return await Promise.all(keys.map(async key => ({ key, project: decodeDesign(await db.get('projects', key)) })));
  } finally { db.close(); }
}
