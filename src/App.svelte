<script lang="ts">
  import { onMount } from 'svelte';
  import { p96l } from './catalog/p96l.ts';
  import { defaultGrid, gridFields, validateGrid } from './geometry/profile.ts';
  import type { GridMesh, GridResponse } from './geometry/protocol.ts';
  import { binaryStl, download } from './export.ts';
  import { decodeProject, encodeProject, licenseUrl } from './project.ts';
  import { createViewport } from './viewport.ts';

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

  function rebuild() {
    const id = ++requestId;
    clearTimeout(timer);
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
    status = 'Generating grid…';
    timer = setTimeout(() => worker?.postMessage({
      id, aperture: p96l.aperture, settings: { ...settings },
    }), 120);
  }

  onMount(() => {
    try {
      viewport = createViewport(host);
    } catch {
      previewError = '3D preview needs WebGL. Grid generation and export still work.';
    }
    worker = new Worker(new URL('./geometry/grid.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<GridResponse>) => {
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
      status = 'The geometry worker failed. Reload to try again.';
      worker?.terminate();
      worker = undefined;
    };
    rebuild();
    viewport?.update(mesh, mode);
    return () => {
      clearTimeout(timer);
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
      settings = decodeProject(await file.text());
      rebuild();
    } catch (error) {
      importError = (error as Error).message;
    }
  }

  function setField(key: keyof typeof settings, value: number) {
    settings[key] = value;
    rebuild();
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
    <h1 class="text-2xl font-bold tracking-tight">Lightform</h1>
    <span class="text-sm text-muted">Lamp attachment designer</span>
  </div>
  <div class="flex flex-wrap gap-2">
    <input aria-label="Select project JSON" type="file" accept=".json,application/json" bind:this={fileInput} onchange={importProject} hidden />
    <button onclick={() => fileInput.click()}>Import JSON</button>
    <button onclick={saveJson}>Save JSON</button>
    <button class="primary" disabled={!current} onclick={exportGrid}>Export STL</button>
  </div>
</header>

{#if importError}<p class="border-b border-line px-5 py-2" role="alert">{importError}</p>{/if}

<main class="workspace grid gap-3 p-3">
  <aside class="panel space-y-6">
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
      <button class="ml-auto" onclick={() => viewport?.fit()}>Fit view</button>
    </div>
    <div class="viewport" bind:this={host}></div>
    {#if previewError}<p role="status">{previewError}</p>{/if}
    {#if mode !== 'grid'}<p class="text-sm text-muted">Lamp reference · procedural wireframe</p>{/if}
  </section>

  <aside class="panel">
    <h2>Honeycomb settings</h2>
    {#each gridFields as field (field.key)}
      <label class="mt-5 block text-sm font-semibold" for={field.key}>{field.label}</label>
      <div class="mt-2 flex items-center gap-2">
        <input aria-label={field.label + ' slider'} type="range" min={field.min} max={field.max}
          step={field.step} value={settings[field.key]}
          oninput={(event) => setField(field.key, event.currentTarget.valueAsNumber)} />
        <input id={field.key} type="number" min={field.min} max={field.max}
          step={field.step} value={settings[field.key]}
          oninput={(event) => setField(field.key, event.currentTarget.valueAsNumber)} />
        <span class="text-xs text-muted">mm</span>
      </div>
    {/each}
  </aside>
</main>

<footer class="flex flex-wrap justify-between gap-2 border-t border-line px-5 py-3 text-sm">
  <span role="status">{status}{#if mesh && !current} · Previous preview shown{/if}</span>
  <a class="underline" href={licenseUrl} target="_blank" rel="noreferrer">Generated geometry · CC0 1.0</a>
</footer>
