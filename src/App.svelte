<script lang="ts">
  import { onMount } from 'svelte';
  import workerUrl from './geometry/grid.worker.ts?worker&url';
  import { isOfflineReady } from './pwa/readiness.ts';
  import { registerSW } from 'virtual:pwa-register';
  import ParameterField from './app/ParameterField.svelte';
  import { isGridPattern } from './catalog/grid-patterns.ts';
  import { attachments, lamps, resolveDefinition } from './catalog/registry.ts';
  import { attachmentDefinition, createDesign, decodeDesign, defaultMountForLamp, encodeDesign, mountDefinition, printDiagnostics, supportsMulticolor, validateDesign } from './domain/project.ts';
  import type { Design } from './domain/project.ts';
  import { orientFrontDown } from './geometry/printability.ts';
  import { multicolor3mf } from './export-3mf.ts';
  import { gridMaterialLabel, materialRegions } from './domain/materials.ts';
  import { exportBundle } from './export-bundle.ts';
  import { binaryStl, download } from './export.ts';
  import { licenseUrl } from './project.ts';
  import type { AssemblyResult } from './generators/assembly.ts';
  import { GeometryController } from './geometry/controller.ts';
  import { autosaveHistory, deleteProject, loadProject, projectNames, saveProject } from './storage/projects.ts';
  import type { createViewport, PreviewPose } from './viewport.ts';

  type ThemePreference = 'system' | 'light' | 'dark';
  const themeKey = 'beamkit-theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  function loadTheme(): ThemePreference {
    try {
      const value = localStorage.getItem(themeKey);
      if (value === 'light' || value === 'dark') return value;
    } catch { /* Storage may be unavailable in this browser. */ }
    return 'system';
  }
  let themePreference = $state<ThemePreference>(loadTheme());
  let systemDark = $state(systemTheme.matches);
  const theme = $derived(themePreference === 'system' ? (systemDark ? 'dark' : 'light') : themePreference);

  let project = $state<Design>(createDesign());
  let result = $state.raw<AssemblyResult | null>(null);
  let current = $state(false), booting = $state(true), saving = $state(false), saved = $state(false);
  let status = $state('Preparing workspace…'), error = $state(''), storageError = $state(''), previewError = $state('');
  let offlineReady = $state(false), updateReady = $state(false);
  let importCandidate = $state<Design | null>(null);
  let names = $state<string[]>([]), localName = $state('P96L honeycomb');
  let historyItems = $state<{ key: string; project: Design }[]>([]);
  let undoStack = $state<string[]>([]), redoStack = $state<string[]>([]);
  let settingsTab = $state<'attachment' | 'mount' | 'print'>('attachment');
  let pose = $state<PreviewPose>('assembly');
  let host: HTMLDivElement, fileInput: HTMLInputElement;
  let importDialog = $state<HTMLDialogElement>();
  let projectDialog = $state<HTMLDialogElement>();
  let viewport: ReturnType<typeof createViewport> | undefined, controller: GeometryController | undefined;
  let applyUpdate: ((reload?: boolean) => Promise<void>) | undefined;
  let revision = 0, previewRevisionFloor = 0, saveRevision = 0, disposed = false;
  let saveTimer: ReturnType<typeof setTimeout>;
  const selectedLamp = $derived(resolveDefinition(lamps, project.lamp));
  const selectedMount = $derived(project.mount ? mountDefinition(project.mount) : null);
  const exportPrefix = $derived(selectedLamp.id.split('.').at(-1));
  const definition = $derived(attachmentDefinition(project));
  const previewResult = $derived(result?.lampId === selectedLamp.id ? result : null);
  const multicolorAvailable = $derived(supportsMulticolor(project));
  const multicolor = $derived(project.export.format === '3mf');
  const diagnostics = $derived(result && current ? result.diagnostics : printDiagnostics(project));
  const dimensions = $derived(previewResult?.parts[0] ? previewResult.parts[0].bounds.max.map((v, i) => v - previewResult!.parts[0].bounds.min[i]) : null);
  const settingsTabs = [
    { id: 'attachment', label: 'Attachment' },
    { id: 'mount', label: 'Fit' },
    { id: 'print', label: 'Print' },
  ] as const;

  function scheduleSave(snapshot: Design) {
    clearTimeout(saveTimer); saving = true; saved = false;
    const id = ++saveRevision;
    saveTimer = setTimeout(() => {
      void saveProject('_autosave', snapshot).then(() => {
        if (id === saveRevision && !disposed) { saving = false; saved = true; storageError = ''; }
      }).catch(() => { if (!disposed) { saving = false; storageError = 'Autosave failed. Save JSON to keep a portable backup.'; } });
    }, 300);
  }
  function rebuild(live = false) {
    ++revision; current = false; error = ''; status = 'Generating print geometry…';
    // Intermediate previews are useful only within the same design and output mode.
    if (!live) previewRevisionFloor = revision;
    clearTimeout(saveTimer); ++saveRevision; saving = false; saved = false;
    try {
      const snapshot = validateDesign($state.snapshot(project));
      controller?.request(snapshot, revision);
      if (!booting) scheduleSave(snapshot);
    } catch (cause) { controller?.invalidate(); error = (cause as Error).message; status = 'Check the marked settings'; }
  }
  function remember() { undoStack = [...undoStack.slice(-79), JSON.stringify(project)]; redoStack = []; }
  function replace(next: Design) { remember(); project = structuredClone(next); localName = project.name; rebuild(); }
  function changeParameter(group: 'mount' | 'attachment', key: string, value: number) {
    remember(); const selection = project[group]; if (selection) selection.parameters[key] = value; rebuild(true);
  }
  function changeAttachment(id: string, keepGridDimensions = false) {
    const entry = attachments.find(a => a.id === id)!; remember();
    const parameters = { ...entry.defaults };
    if (keepGridDimensions) {
      for (const key of ['depth', 'wall', 'frame', 'inset']) parameters[key] = project.attachment.parameters[key];
    }
    project.attachment = { id, revision: entry.revision, parameters };
    if (!project.mount) project.mount = defaultMountForLamp(selectedLamp);
    if (!supportsMulticolor(project)) project.export.format = 'stl';
    project.name = `${selectedLamp.label} ${entry.label.toLowerCase()}`; rebuild();
  }
  function changeMode(mode: Design['assembly']['mode']) {
    remember(); project.assembly.mode = mode;
    if (mode !== 'standalone' && !project.mount) project.mount = defaultMountForLamp(selectedLamp);
    if (!supportsMulticolor(project)) project.export.format = 'stl';
    rebuild();
  }
  function changeMulticolor(enabled: boolean) {
    remember();
    project.export.format = enabled && supportsMulticolor(project) ? '3mf' : 'stl';
    rebuild();
  }
  function changeTheme(preference: ThemePreference) {
    themePreference = preference;
    try { localStorage.setItem(themeKey, preference); }
    catch { /* Apply the choice for this session when storage is unavailable. */ }
  }
  function history(direction: 'undo' | 'redo') {
    const stack = direction === 'undo' ? undoStack : redoStack, snapshot = stack.at(-1); if (!snapshot) return;
    if (direction === 'undo') { redoStack = [...redoStack, JSON.stringify(project)]; undoStack = stack.slice(0, -1); }
    else { undoStack = [...undoStack, JSON.stringify(project)]; redoStack = stack.slice(0, -1); }
    project = JSON.parse(snapshot); localName = project.name; rebuild();
  }
  function resetPreset() {
    const next = structuredClone($state.snapshot(project));
    next.attachment.parameters = { ...definition.defaults };
    if (next.mount && selectedMount) next.mount.parameters = { ...selectedMount.defaults };
    replace(validateDesign(next));
  }
  function changeLamp(id: string) {
    const lamp = lamps.find(entry => entry.id === id)!;
    const mount = defaultMountForLamp(lamp);
    if (!mount) { error = 'No supported mount is registered for this lamp.'; return; }
    remember(); project.lamp = { id: lamp.id, revision: lamp.revision };
    project.mount = mount;
    project.name = `${lamp.label} ${definition.label.toLowerCase()}`;
    localName = project.name;
    rebuild();
  }
  async function importProject() {
    const file = fileInput.files?.[0]; fileInput.value = ''; if (!file) return;
    try {
      if (file.size > 65536) throw new Error('Project exceeds the 64 KiB limit.');
      importCandidate = decodeDesign(await file.text()); error = '';
    }
    catch (cause) { error = (cause as Error).message; }
    projectDialog?.close();
  }
  function confirmImport() { if (importCandidate) { replace($state.snapshot(importCandidate)); importCandidate = null; } }
  function saveJson() {
    try { download(`${exportPrefix}-accessory.json`, new Blob([encodeDesign($state.snapshot(project))], { type: 'application/json' })); }
    catch (cause) { error = (cause as Error).message; }
  }
  function exportParts() {
    if (!current || !result || result.projectRevision !== revision) return;
    if (multicolor) {
      const model = multicolor3mf(result, project.export.orientation);
      download(`${result.parts[0].name}-multicolor.3mf`, new Blob([model], { type: 'model/3mf' }));
      return;
    }
    for (const part of result.parts) download(`${part.name}.stl`, new Blob([binaryStl(project.export.orientation === 'front-down' ? orientFrontDown(part.mesh) : part.mesh)], { type: 'model/stl' }));
  }
  function saveBundle() {
    if (!current || !result || result.projectRevision !== revision) return;
    download(`${exportPrefix}-accessory.zip`, new Blob([exportBundle($state.snapshot(project), result)], { type: 'application/zip' }));
  }
  async function saveNamed() {
    try {
      const name = localName.trim(); if (!name || name.startsWith('_') || name.length > 100) throw new Error('Use a project name of 1–100 characters, without a leading underscore.');
      const snapshot = validateDesign({ ...$state.snapshot(project), name });
      await saveProject(name, snapshot); names = await projectNames(); storageError = '';
    } catch (cause) { storageError = (cause as Error).message; }
  }
  async function openNamed(name: string) {
    try { const next = await loadProject(name); if (next) { replace(next); projectDialog?.close(); } }
    catch { storageError = 'Could not open this local project. The current design is unchanged.'; }
  }
  async function removeNamed(name: string) {
    try { await deleteProject(name); names = await projectNames(); } catch { storageError = 'Could not delete the local project.'; }
  }
  async function showHistory() {
    try { historyItems = await autosaveHistory(); } catch { storageError = 'Could not read autosave history.'; }
  }
  async function updateApp() {
    if (!current || booting) return;
    try { clearTimeout(saveTimer); await saveProject('_autosave', $state.snapshot(project)); await applyUpdate?.(true); }
    catch { storageError = 'Save JSON before reloading: local save failed.'; }
  }
  function keydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !(event.target instanceof HTMLInputElement)) {
      event.preventDefault(); history(event.shiftKey ? 'redo' : 'undo');
    }
  }
  onMount(() => {
    disposed = false;
    const updateSystemTheme = (event: MediaQueryListEvent) => { systemDark = event.matches; };
    systemTheme.addEventListener('change', updateSystemTheme);
    const refreshReadiness = () => { void isOfflineReady(new URL(workerUrl, document.baseURI).href).then(ready => { if (!disposed) offlineReady = ready; }); };
    navigator.serviceWorker?.addEventListener('controllerchange', refreshReadiness);
    if ('serviceWorker' in navigator) void navigator.serviceWorker.ready.then(refreshReadiness);
    applyUpdate = registerSW({ onOfflineReady() { refreshReadiness(); }, onNeedRefresh() { updateReady = true; }, onRegisterError() { storageError = 'Offline preparation failed. JSON backup and online editing remain available.'; } });
    void import('./viewport.ts').then(({ createViewport }) => {
      if (disposed) return;
      try {
        viewport = createViewport(host);
        viewport.update(previewResult, pose, theme, selectedLamp);
      }
      catch { previewError = 'WebGL preview is unavailable. Geometry and STL export still work.'; }
    }).catch(() => { previewError = 'The preview could not load. Geometry and STL export still work.'; });
    controller = new GeometryController(() => new Worker(workerUrl, { type: 'module' }), generated => {
      if (generated.projectRevision < previewRevisionFloor || disposed) return;
      result = generated;
      current = generated.projectRevision === revision;
      if (current) status = 'Print geometry ready';
    }, message => { current = false; error = message; status = 'Generation stopped'; });
    void loadProject('_autosave').then(next => { if (next && !disposed) { project = next; localName = next.name; } return projectNames(); })
      .then(list => { if (!disposed) names = list; }).catch(() => { storageError = 'Local storage is unavailable. Use JSON files to keep your work.'; })
      .finally(() => { if (!disposed) { booting = false; rebuild(); } });
    return () => {
      disposed = true;
      systemTheme.removeEventListener('change', updateSystemTheme);
      navigator.serviceWorker?.removeEventListener('controllerchange', refreshReadiness);
      clearTimeout(saveTimer); controller?.dispose(); viewport?.dispose();
    };
  });
  $effect.pre(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    const surface = getComputedStyle(root).getPropertyValue('--header-surface').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface);
  });
  $effect(() => {
    const activeResult = previewResult;
    const activePose = pose;
    const activeTheme = theme;
    const lamp = selectedLamp;
    viewport?.update(activeResult, activePose, activeTheme, lamp);
  });
  $effect(() => { if (importCandidate && importDialog && !importDialog.open) importDialog.showModal(); });
</script>

<svelte:window onkeydown={keydown} />
<a class="skip-link" href="#workspace">Skip to workspace</a>
<div class="app-shell">
  <header class="app-header">
    <a class="brand" href="/" aria-label="BeamKit workspace"><span class="brand-mark" aria-hidden="true">B<span>↗</span></span><strong>BeamKit</strong></a>
    <div class="header-actions">
      <button class="quiet" onclick={() => projectDialog?.showModal()}>Project</button>
      <button class="primary" disabled={!current} onclick={exportParts}>{multicolor ? 'Export 3MF' : 'Export STL'}</button>
    </div>
  </header>
  <input aria-label="Select project JSON" type="file" accept=".json,application/json" bind:this={fileInput} onchange={importProject} hidden />
  {#if updateReady}<div class="notice"><span>A new version is ready.</span><button disabled={!current} onclick={updateApp}>Save and reload update</button></div>{/if}
  {#if storageError}<p class="notice error-notice" role="alert">{storageError}</p>{/if}
  {#if error}<div class="notice error-notice" role="alert"><span>{error}</span><button onclick={() => rebuild()}>Retry generation</button></div>{/if}

  <main id="workspace" class="workspace">
    <section class="stage" aria-label="Accessory preview">
      <div class="stage-header">
        <div class="stage-title" class:lamp-picker={lamps.length > 1}>
          <h1>{selectedLamp.label}</h1>
          {#if dimensions}
            <p class="dimensions" aria-label="Model dimensions">{dimensions.map(value => value.toFixed(1)).join(' × ')} mm</p>
          {/if}
          {#if lamps.length > 1}
            <select aria-label="Lamp" disabled={booting} value={project.lamp.id} onchange={event => changeLamp(event.currentTarget.value)}>
              {#each lamps as lamp}<option value={lamp.id}>{lamp.label}</option>{/each}
            </select>
          {/if}
        </div>
        <div class="pose-toggle" role="group" aria-label="Preview pose">
          <button aria-pressed={pose === 'assembly'} onclick={() => pose = 'assembly'}><span>Assembled</span></button>
          <button aria-pressed={pose === 'print'} onclick={() => pose = 'print'}><span>Print pose</span></button>
        </div>
      </div>
      <div class="preview-area">
        <div class="viewport" bind:this={host}></div>
        {#if !current && result}<span class="stale-badge">Updating preview…</span>{/if}
        {#if previewError}<p class="preview-error">{previewError}</p>{/if}
      </div>
    </section>
    <aside aria-label="Parameters" class="settings-panel">
      <div class="settings-tabs" role="group" aria-label="Parameter groups">
        {#each settingsTabs as { id, label }}
          <button aria-pressed={settingsTab === id} onclick={() => settingsTab = id}>{label}</button>
        {/each}
      </div>
      {#if settingsTab === 'attachment'}
        <div class="parameter">
          <label class="section-heading" for="attachment">Attachment type</label>
          <select id="attachment" disabled={booting} value={project.attachment.id}
            onchange={event => changeAttachment(event.currentTarget.value,
              isGridPattern(project.attachment.id) && isGridPattern(event.currentTarget.value))}>
            {#each attachments as attachment}<option value={attachment.id}>{attachment.label}</option>{/each}
          </select>
        </div>
      {/if}
      {#key settingsTab}
        <div class="settings-scroll">
          <div class="settings-body">
            {#if settingsTab === 'attachment'}
              {#each definition.fields as field (field.key)}
                <ParameterField {field} value={project.attachment.parameters[field.key]} disabled={booting} prefix="attachment" onchange={value => changeParameter('attachment', field.key, value)} />
              {/each}
            {:else if settingsTab === 'mount'}
              {#if project.assembly.mode !== 'standalone' && project.mount}
                {#each (selectedMount?.fields ?? []).filter(field => field.key !== 'frontClearanceMm' || isGridPattern(project.attachment.id)) as field}
                  <ParameterField {field} value={project.mount.parameters[field.key]} disabled={booting} prefix="mount" onchange={value => changeParameter('mount', field.key, value)} />
                {/each}
              {:else}
                <p class="field-help">Select a mounted model or fit coupon under Print to adjust lamp fit.</p>
              {/if}
            {:else}
              <div class="parameter">
                <label for="output-mode" class="section-heading">Output</label>
                <select id="output-mode" disabled={booting} value={project.assembly.mode} onchange={event => changeMode(event.currentTarget.value as Design['assembly']['mode'])}>
                  <option value="integrated">Mounted accessory</option>
                  <option value="fit-test">Fit coupon only</option>
                  <option value="standalone">Attachment only</option>
                </select>
              </div>
              {#if multicolorAvailable}
                <div class="multicolor-settings">
                  <label class="check-row"><input type="checkbox" checked={multicolor} disabled={booting} onchange={event => changeMulticolor(event.currentTarget.checked)} /> Multicolor printing</label>
                  {#if multicolor}
                    <ul class="material-key">
                      {#each Object.values(materialRegions) as region}
                        <li><i style:background={region.color}></i>{region === materialRegions.honeycomb ? gridMaterialLabel(project.attachment.id) : region.label}</li>
                      {/each}
                    </ul>
                    <p class="field-help">Assign the three 3MF parts to filaments in your slicer.</p>
                  {/if}
                </div>
              {/if}
              <details class="print-notes">
                <summary>Print notes</summary>
                <p>Starting point for a 0.4 mm nozzle on a Bambu Lab printer: front face on the bed, 0.20 mm layers, 4 walls, and 0–10% infill.</p>
                <div class="parameter">
                  <label for="material" class="section-heading">Planned material</label>
                  <select id="material" value={project.printProfile.material} onchange={event => { remember(); project.printProfile.material = event.currentTarget.value as Design['printProfile']['material']; rebuild(); }}>
                    <option value="unspecified">Choose in slicer</option><option>PLA</option><option>PETG</option><option>ASA</option>
                  </select>
                </div>
                {#each diagnostics as note}<p class:warning={note.level === 'warning'}>{note.message}</p>{/each}
              </details>
            {/if}
          </div>
          <div class="settings-footer"><button class="quiet" disabled={booting} onclick={resetPreset}>Reset preset</button></div>
        </div>
      {/key}
    </aside>
  </main>
  <footer class="status-bar">
    <span role="status"><i class:ready={current}></i>{status}{#if saving} · Saving…{:else if saved} · Saved locally{/if}{#if offlineReady} · Offline ready{/if}</span>
    <a href={licenseUrl} target="_blank" rel="noreferrer">Model output · CC0 1.0</a>
  </footer>
</div>

<dialog class="editor-dialog" bind:this={projectDialog} aria-labelledby="project-title">
  <div class="dialog-header"><h2 id="project-title">Project</h2><button class="quiet" onclick={() => projectDialog?.close()}>Close</button></div>
  <form class="project-form" onsubmit={event => { event.preventDefault(); void saveNamed(); }}>
    <label class="section-heading" for="project-name">Project name</label>
    <div class="project-name-row">
      <input id="project-name" bind:value={localName} maxlength="100" required />
      <button disabled={booting} type="submit">Save locally</button>
    </div>
  </form>
  {#if storageError}<p class="field-error" role="alert">{storageError}</p>{/if}
  {#each names as name}
    <div class="saved-project">
      <button class="quiet" onclick={() => openNamed(name)}>{name}</button>
      <button class="quiet" aria-label={`Delete ${name}`} onclick={() => removeNamed(name)}>Delete</button>
    </div>
  {/each}
  <div class="project-actions">
    <button disabled={booting} onclick={() => fileInput.click()}>Import JSON</button>
    <button disabled={booting} onclick={saveJson}>Save JSON</button>
    <button disabled={!current} onclick={saveBundle}>Save bundle</button>
    <button disabled={booting || !undoStack.length} onclick={() => { history('undo'); projectDialog?.close(); }}>Undo</button>
    <button disabled={booting || !redoStack.length} onclick={() => { history('redo'); projectDialog?.close(); }}>Redo</button>
  </div>
  <div class="parameter">
    <label class="section-heading" for="theme">Theme</label>
    <select id="theme" value={themePreference} onchange={event => changeTheme(event.currentTarget.value as ThemePreference)}>
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </div>
  <details ontoggle={event => { if (event.currentTarget.open) void showHistory(); }}>
    <summary>Autosave history</summary>
    {#each historyItems.slice(0, 5) as item}
      <button class="history-item" onclick={() => { replace(item.project); historyItems = []; projectDialog?.close(); }}>{new Date(Number(item.key.split(':')[1])).toLocaleString()}</button>
    {/each}
  </details>
  <details>
    <summary>Install app</summary>
    <p class="field-help">Use the install icon in Chrome, or Share → Add to Dock or Add to Home Screen in Safari. Wait for “Offline ready” before using BeamKit offline.</p>
  </details>
</dialog>

{#if importCandidate}
  <dialog class="editor-dialog" bind:this={importDialog} aria-labelledby="import-title" oncancel={() => importCandidate = null}>
    <h2 id="import-title">Import project</h2>
    <dl class="import-summary">
      <div><dt>Name</dt><dd>{importCandidate.name}</dd></div>
      <div><dt>Lamp</dt><dd>{resolveDefinition(lamps, importCandidate.lamp).label}</dd></div>
      <div><dt>Attachment</dt><dd>{attachmentDefinition(importCandidate).label}</dd></div>
      <div><dt>Output</dt><dd>{importCandidate.assembly.mode === 'fit-test' ? 'Fit coupon' : importCandidate.assembly.mode === 'standalone' ? 'Attachment only' : 'Mounted accessory'}</dd></div>
    </dl>
    <p class="field-help">Import replaces the current design. You can undo it.</p>
    <div class="dialog-actions">
      <button onclick={() => importCandidate = null}>Cancel import</button>
      <button class="primary" onclick={confirmImport}>Import design</button>
    </div>
  </dialog>
{/if}
