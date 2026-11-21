import wasmUrl from 'manifold-3d/manifold.wasm?url';
/** Confirm the current entry point, worker and WASM really exist in browser caches. */
export async function isOfflineReady(workerUrl: string) {
  if (!('serviceWorker' in navigator) || !('caches' in window)) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.active) return false;
  const script = [...document.scripts].find(script => script.type === 'module')?.src;
  if (!script) return false;
  const required = [new URL('index.html', document.baseURI).href, script, workerUrl, new URL(wasmUrl, document.baseURI).href];
  const responses = await Promise.all(required.map(url => caches.match(url, { ignoreSearch: true })));
  return responses.every(response => response?.ok);
}
