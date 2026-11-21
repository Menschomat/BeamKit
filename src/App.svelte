<script lang="ts">
  import { registerSW } from 'virtual:pwa-register';
  import { loadProject, saveProject, projectNames } from './storage/projects.ts';
  import { onMount } from 'svelte';
  import { p96l } from './catalog/p96l.ts';
  import { defaultGrid, gridFields, validateGrid } from './geometry/profile.ts';
  import type { GridMesh, GridRequest, GridResponse } from './geometry/protocol.ts';
  import { binaryStl, download } from './export.ts';
  import { decodeProject, encodeProject, licenseUrl } from './project.ts';
  import { createViewport } from './viewport.ts';

  let saving = $state(false);
  let saveRevision = 0;
  let offlineReady = $state(false);
  let updateReady = $state(false);
  let applyUpdate: ((reload?: boolean) => Promise<void>) | undefined;
  let storageError = $state('');
  let booting = $state(true);
  let savedNames = $state<string[]>([]);
  let projectName = $state('My P96L grid');
  let undoStack = $state<string[]>([]);
  let redoStack = $state<string[]>([]);
  let saveTimer: ReturnType<typeof setTimeout>;
  let settings = $state({ ...defaultGrid });
  let mesh = $state.raw<GridMesh | null>(null);
  let current = $state(false);
  let status = $state('Generating grid…');
  let importError = $state('');
  let previewError = $state('');
  let mode = $state<'assembly' | 'exploded' | 'grid'>('exploded');
  let host: HTMLDivElement;
  let fileInput: HTMLInputElement;
  let viewport: ReturnType<typeof createViewport> | undefined;
  let worker: Worker | undefined;
  let requestId = 0;
  let timer: ReturnType<typeof setTimeout>;
  let pending: GridRequest | undefined;
  let active: number | undefined;

  function dispatchLatest() {
    if (!worker || !pending || active !== undefined) return;
    active = pending.id;
    worker.postMessage(pending);
    pending = undefined;
  }

  function rebuild() {
    const id = ++requestId;
    clearTimeout(timer);
    pending = undefined;
    current = false;
    try {
      validateGrid(settings);
    } catch (error) {
      status = (error as Error).message;
      return;
    }
    if (!worker) {
      status = 'Geometry worker unavailable.';
      return;
    }
    if (!booting) {
      const snapshot = { ...settings };
      const revision = ++saveRevision;
      saving = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveProject('_autosave', snapshot).then(() => {
          if (revision === saveRevision) saving = false;
        }).catch(() => { storageError = 'Autosave failed. Save JSON to back up your design.'; });
      }, 300);
    }
    status = 'Generating grid…';
    timer = setTimeout(() => {
      pending = { id, aperture: p96l.aperture, settings: { ...settings } };
      dispatchLatest();
    }, 120);
  }

  function startWorker() {
    worker = new Worker(new URL('./geometry/grid.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<GridResponse>) => {
      if (data.id !== active) return;
      active = undefined;
      dispatchLatest();
      if (data.id !== requestId) return;
      if ('error' in data) {
        status = data.error;
        return;
      }
      mesh = data;
      current = true;
      status = 'Grid ready';
    };
    worker.onerror = () => {
      current = false;
      status = 'The geometry worker failed. Retry generation to continue.';
      worker?.terminate();
      worker = undefined;
      active = undefined;
    };
  }

  function retryGeneration() {
    worker?.terminate();
    active = undefined;
    pending = undefined;
    startWorker();
    rebuild();
  }

  onMount(() => {
    applyUpdate = registerSW({
      onOfflineReady() { offlineReady = true; },
      onNeedRefresh() { updateReady = true; },
      onRegisterError() { storageError = 'Offline preparation failed. Keep this tab online and try again later.'; },
    });
    try {
      viewport = createViewport(host);
    } catch {
      previewError = '3D preview needs WebGL. Grid generation and export still work.';
    }
    startWorker();
    void loadProject('_autosave').then(saved => {
      if (saved) settings = saved;
      return projectNames();
    }).then(names => { savedNames = names; }).catch(() => {
      storageError = 'Local storage is unavailable. Use JSON files to keep your design.';
    }).finally(() => { booting = false; rebuild(); });
    viewport?.update(mesh, mode);
    return () => {
      clearTimeout(timer);
      clearTimeout(saveTimer);
      worker?.terminate();
      viewport?.dispose();
    };
  });

  $effect(() => {
    const activeMesh = mesh;
    const activeMode = mode;
    viewport?.update(activeMesh, activeMode);
  });

  async function importProject() {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    importError = '';
    try {
      if (file.size > 64 * 1024) throw new Error('The project file is too large.');
      replaceSettings(decodeProject(await file.text()));
    } catch (error) {
      importError = (error as Error).message;
    }
  }

  function setField(key: keyof typeof settings, value: number) {
    undoStack = [...undoStack.slice(-99), JSON.stringify(settings)];
    redoStack = [];
    settings[key] = value;
    rebuild();
  }

  function replaceSettings(next: typeof settings) {
    undoStack = [...undoStack.slice(-99), JSON.stringify(settings)];
    redoStack = [];
    settings = { ...next };
    rebuild();
  }

  function history(direction: 'undo' | 'redo') {
    const source = direction === 'undo' ? undoStack : redoStack;
    const snapshot = source.at(-1);
    if (!snapshot) return;
    if (direction === 'undo') {
      redoStack = [...redoStack, JSON.stringify(settings)]; undoStack = source.slice(0, -1);
    } else {
      undoStack = [...undoStack, JSON.stringify(settings)]; redoStack = source.slice(0, -1);
    }
    settings = JSON.parse(snapshot);
    rebuild();
  }

  async function saveNamed() {
    if (!projectName.trim() || projectName.trim() === '_autosave') return;
    try {
      await saveProject(projectName.trim(), { ...settings });
      savedNames = await projectNames();
      storageError = '';
    } catch { storageError = 'Project could not be saved. Save JSON to back up your design.'; }
  }

  async function openNamed(name: string) {
    try {
      const saved = await loadProject(name);
      if (saved) { replaceSettings(saved); projectName = name; }
    } catch { storageError = 'The saved project could not be opened.'; }
  }

  async function updateApp() {
    if (!current || booting) return;
    try {
      await saveProject('_autosave', { ...settings });
      await applyUpdate?.(true);
    } catch { storageError = 'Could not save before updating. Save JSON before reloading.'; }
  }

  function exportGrid() {
    if (!mesh || !current) return;
    download('p96l-honeycomb.stl', new Blob([binaryStl(mesh)], { type: 'model/stl' }));
  }

  function saveJson() {
    try {
      download('p96l-honeycomb.json', new Blob([encodeProject(settings)], { type: 'application/json' }));
      importError = '';
    } catch (error) {
      importError = (error as Error).message;
    }
  }
</script>

<header class="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
  <div class="flex items-baseline gap-3">
    <h1 class="text-2xl font-bold tracking-tight">BeamKit</h1>
    <span class="text-sm text-muted">Lamp attachment designer</span>
  </div>
  <div class="flex flex-wrap gap-2">
    <input aria-label="Select project JSON" type="file" accept=".json,application/json" bind:this={fileInput} onchange={importProject} hidden />
    <button disabled={booting} onclick={() => fileInput.click()}>Import JSON</button>
    <button disabled={booting} onclick={saveJson}>Save JSON</button>
    <button class="primary" disabled={!current} onclick={exportGrid}>Export STL</button>
  </div>
</header>

{#if storageError}<p role="alert" class="px-5 py-2">{storageError}</p>{/if}
{#if importError}<p class="border-b border-line px-5 py-2" role="alert">{importError}</p>{/if}

<main class="workspace grid gap-3 p-3">
  <aside class="panel space-y-6">
    <section>
      <h2>Local projects</h2>
      <label for="project-name">Project name</label>
      <input id="project-name" bind:value={projectName} />
      <button disabled={booting} onclick={saveNamed}>Save locally</button>
      {#each savedNames as name}<button onclick={() => openNamed(name)}>{name}</button>{/each}
      <p class="text-sm text-muted">Stored in this browser. JSON is your portable backup.</p>
    </section>
    <section>
      <h2>Lamp</h2>
      <p class="mt-2 font-semibold">{p96l.label}</p>
      <p class="text-sm text-muted">110 × 60 × 11.5 mm</p>
    </section>
    <section>
      <h2>Attachment</h2>
      <p class="mt-2 font-semibold">Honeycomb</p>
      <p class="text-sm text-muted">Grid prototype. Mount geometry is pending.</p>
    </section>
  </aside>

  <section class="panel viewport-panel" aria-label="Grid preview">
    <div class="flex flex-wrap items-center gap-2">
      {#each [['assembly', 'Assembled'], ['exploded', 'Exploded'], ['grid', 'Grid only']] as [value, label]}
        <button aria-pressed={mode === value} class:primary={mode === value}
          onclick={() => { mode = value as typeof mode; }}>{label}</button>
      {/each}
      <button disabled={booting} onclick={retryGeneration}>Retry generation</button>
      <button class="ml-auto" onclick={() => viewport?.fit()}>Fit view</button>
    </div>
    <div class="viewport" bind:this={host}></div>
    {#if previewError}<p role="status">{previewError}</p>{/if}
    {#if mode !== 'grid'}<p class="text-sm text-muted">Lamp reference · procedural wireframe</p>{/if}
  </section>

  <aside class="panel">
    <h2>Honeycomb settings</h2>
    <div class="flex flex-wrap gap-2 mt-3">
      <button disabled={booting || !undoStack.length} onclick={() => history('undo')}>Undo</button>
      <button disabled={booting || !redoStack.length} onclick={() => history('redo')}>Redo</button>
      <button disabled={booting} onclick={() => replaceSettings(defaultGrid)}>Reset preset</button>
    </div>
    {#each gridFields as field (field.key)}
      <label class="mt-5 block text-sm font-semibold" for={field.key}>{field.label}</label>
      <div class="mt-2 flex items-center gap-2">
        <input disabled={booting} aria-label={field.label + ' slider'} type="range" min={field.min} max={field.max}
          step={field.step} value={settings[field.key]}
          oninput={(event) => setField(field.key, event.currentTarget.valueAsNumber)} />
        <input disabled={booting} id={field.key} type="number" min={field.min} max={field.max}
          step={field.step} value={settings[field.key]}
          oninput={(event) => setField(field.key, event.currentTarget.valueAsNumber)} />
        <span class="text-xs text-muted">mm</span>
      </div>
    {/each}
  </aside>
</main>

<footer class="flex flex-wrap justify-between gap-2 border-t border-line px-5 py-3 text-sm">
  <span role="status">{offlineReady ? 'Offline ready · ' : ''}{status} · {saving ? 'Saving…' : 'Saved locally'}{#if mesh && !current} · Previous preview shown{/if}</span>
  {#if updateReady}<button disabled={!current || booting} onclick={updateApp}>Save and reload update</button>{/if}
  <a class="underline" href={licenseUrl} target="_blank" rel="noreferrer">Generated geometry · CC0 1.0</a>
</footer>
