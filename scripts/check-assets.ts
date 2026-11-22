import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
async function walk(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(join(path, entry.name)) : [join(path, entry.name)]))).flat();
}
const files = await walk('dist');
const forbidden = files.filter(path => /(?:^|\/)(?:etc|reference)\/|\.(?:step|stp|obj|mtl|stl)$/i.test(path));
if (forbidden.length) throw new Error('Private CAD or generated print files entered dist: ' + forbidden.join(', '));
for (const path of files.filter(path => /\.(?:js|html|css|json)$/.test(path))) {
  if ((await readFile(path, 'utf8')).includes('SmallRig_Vibe_P96L_Light')) throw new Error(`Private reference content found in ${path}`);
}
for (const filename of ['dist/_headers', 'dist/404.html', 'dist/manifest.webmanifest']) {
  if (!files.includes(filename)) throw new Error(`Static build misses ${filename}`);
}
const sw = await readFile('dist/sw.js', 'utf8');
const runtimeAssets = files.filter(path => /^dist\/assets\/.*\.(?:js|css|wasm)$/.test(path));
for (const path of ['dist/index.html', 'dist/icon-512.png', ...runtimeAssets]) {
  if (!sw.includes(path.slice('dist/'.length))) throw new Error(`Offline cache misses ${path}`);
}
console.log(`Checked ${files.length} built files. Pages files are present, the preview is precached, and private assets are excluded.`);
