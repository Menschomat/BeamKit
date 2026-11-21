<script lang="ts">
  import { onMount } from 'svelte';
  import workerUrl from './geometry/grid.worker.ts?worker&url';
  import { isOfflineReady } from './pwa/readiness.ts';
  import { registerSW } from 'virtual:pwa-register';
  import ParameterField from './app/ParameterField.svelte';
  import { attachments, connections, lamps, mounts, resolveDefinition } from './catalog/registry.ts';
  import { attachmentDefinition, createDesign, decodeDesign, encodeDesign, printDiagnostics, supportsMulticolor, validateDesign } from './domain/project.ts';
  import type { Design } from './domain/project.ts';
  import { orientFrontDown } from './geometry/printability.ts';
  import { multicolor3mf } from './export-3mf.ts';
  import { materialRegions } from './domain/materials.ts';
  import { exportBundle } from './export-bundle.ts';
  import { binaryStl, download } from './export.ts';
  import { licenseUrl } from './project.ts';
  import type { AssemblyResult } from './generators/assembly.ts';
  import { GeometryController } from './geometry/controller.ts';
  import { autosaveHistory, deleteProject, loadProject, projectNames, saveProject } from './storage/projects.ts';
  import type { createViewport } from './viewport.ts';
  import type { ViewOptions } from './viewport.ts';

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
  let view = $state<ViewOptions>({ mode: 'assembly', lampVisible: true, keepoutsVisible: false, lampOpacity: 0.65 });
  let showDimensions = $state(true), installOpen = $state(false), mobilePanel = $state<'model' | 'settings' | null>(null);
  let host: HTMLDivElement, fileInput: HTMLInputElement;
  let importDialog = $state<HTMLDialogElement>();
  let viewport: ReturnType<typeof createViewport> | undefined, controller: GeometryController | undefined;
  let applyUpdate: ((reload?: boolean) => Promise<void>) | undefined;
  let revision = 0, saveRevision = 0, disposed = false;
  let saveTimer: ReturnType<typeof setTimeout>;
  const selectedLamp = $derived(resolveDefinition(lamps, project.lamp));
  const selectedMount = $derived(project.mount ? resolveDefinition(mounts, project.mount) : null);
  const definition = $derived(attachmentDefinition(project));
  const multicolorAvailable = $derived(supportsMulticolor(project));
  const multicolor = $derived(project.export.format === '3mf');
  const diagnostics = $derived(result && current ? result.diagnostics : printDiagnostics(project));
  const dimensions = $derived(result?.parts[0] ? result.parts[0].bounds.max.map((v, i) => v - result!.parts[0].bounds.min[i]) : null);
  const triangleCount = $derived(result?.parts.reduce((sum, part) => sum + part.mesh.indices.length / 3, 0) ?? 0);

  function scheduleSave(snapshot: Design) {
    clearTimeout(saveTimer); saving = true; saved = false;
    const id = ++saveRevision;
    saveTimer = setTimeout(() => {
      void saveProject('_autosave', snapshot).then(() => {
        if (id === saveRevision && !disposed) { saving = false; saved = true; storageError = ''; }
      }).catch(() => { if (!disposed) { saving = false; storageError = 'Autosave failed. Save JSON to keep a portable backup.'; } });
    }, 300);
  }
  function rebuild() {
    ++revision; current = false; error = ''; status = 'Generating print geometry…';
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
    remember(); const selection = project[group]; if (selection) selection.parameters[key] = value; rebuild();
  }
  function changeAttachment(id: string) {
    const entry = attachments.find(a => a.id === id)!; remember();
    project.attachment = { id, revision: entry.revision, parameters: { ...entry.defaults } };
    if (!project.mount && selectedLamp.mounts.length) {
      const mount = mounts.find(entry => selectedLamp.mounts.includes(entry.id))!;
      project.mount = { id: mount.id, revision: mount.revision, parameters: { ...mount.defaults } };
    }
    if (!supportsMulticolor(project)) project.export.format = 'stl';
    project.name = `${selectedLamp.label} ${entry.label.toLowerCase()}`; rebuild();
  }
  function changeMode(mode: Design['assembly']['mode']) {
    remember(); project.assembly.mode = mode;
    if (mode !== 'standalone' && !project.mount) project.mount = createDesign().mount;
    if (!supportsMulticolor(project)) project.export.format = 'stl';
    rebuild();
  }
  function changeMulticolor(enabled: boolean) {
    remember();
    project.export.format = enabled && supportsMulticolor(project) ? '3mf' : 'stl';
    rebuild();
  }
  function history(direction: 'undo' | 'redo') {
    const stack = direction === 'undo' ? undoStack : redoStack, snapshot = stack.at(-1); if (!snapshot) return;
    if (direction === 'undo') { redoStack = [...redoStack, JSON.stringify(project)]; undoStack = stack.slice(0, -1); }
    else { undoStack = [...undoStack, JSON.stringify(project)]; redoStack = stack.slice(0, -1); }
    project = JSON.parse(snapshot); rebuild();
  }
  function resetPreset() {
    const next = structuredClone($state.snapshot(project));
    next.attachment.parameters = { ...definition.defaults };
    if (next.mount && selectedMount) next.mount.parameters = { ...selectedMount.defaults };
    replace(validateDesign(next));
  }
  function changeLamp(id: string) {
    const lamp = lamps.find(entry => entry.id === id)!;
    const mount = mounts.find(entry => lamp.mounts.includes(entry.id));
    if (!mount) { error = 'No supported mount is registered for this lamp.'; return; }
    remember(); project.lamp = { id: lamp.id, revision: lamp.revision };
    project.mount = { id: mount.id, revision: mount.revision, parameters: { ...mount.defaults } };
    rebuild();
  }
  async function importProject() {
    const file = fileInput.files?.[0]; fileInput.value = ''; if (!file) return;
    try { if (file.size > 65536) throw new Error('Project exceeds the 64 KiB limit.'); importCandidate = decodeDesign(await file.text()); error = ''; }
    catch (cause) { error = (cause as Error).message; }
  }
  function confirmImport() { if (importCandidate) { replace($state.snapshot(importCandidate)); importCandidate = null; } }
  function saveJson() {
    try { download('p96l-accessory.json', new Blob([encodeDesign($state.snapshot(project))], { type: 'application/json' })); }
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
    download('p96l-accessory.zip', new Blob([exportBundle($state.snapshot(project), result)], { type: 'application/zip' }));
  }
  async function saveNamed() {
    try {
      const name = localName.trim(); if (!name || name.startsWith('_') || name.length > 100) throw new Error('Use a project name of 1–100 characters, without a leading underscore.');
      const snapshot = validateDesign({ ...$state.snapshot(project), name });
      await saveProject(name, snapshot); names = await projectNames(); storageError = '';
    } catch (cause) { storageError = (cause as Error).message; }
  }
  async function openNamed(name: string) {
    try { const next = await loadProject(name); if (next) replace(next); }
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
    const refreshReadiness = () => { void isOfflineReady(new URL(workerUrl, document.baseURI).href).then(ready => { if (!disposed) offlineReady = ready; }); };
    navigator.serviceWorker?.addEventListener('controllerchange', refreshReadiness);
    if ('serviceWorker' in navigator) void navigator.serviceWorker.ready.then(refreshReadiness);
    applyUpdate = registerSW({ onOfflineReady() { refreshReadiness(); }, onNeedRefresh() { updateReady = true; }, onRegisterError() { storageError = 'Offline preparation failed. JSON backup and online editing remain available.'; } });
    void import('./viewport.ts').then(({ createViewport }) => {
      if (disposed) return;
      try { viewport = createViewport(host); viewport.update(result, { ...view }); }
      catch { previewError = 'WebGL preview is unavailable. Geometry and STL export still work.'; }
    }).catch(() => { previewError = 'The preview could not load. Geometry and STL export still work.'; });
    controller = new GeometryController(() => new Worker(workerUrl, { type: 'module' }), generated => {
      if (generated.projectRevision !== revision || disposed) return;
      result = generated; current = true; status = 'Print geometry ready';
    }, message => { current = false; error = message; status = 'Generation stopped'; });
    void loadProject('_autosave').then(next => { if (next && !disposed) { project = next; localName = next.name; } return projectNames(); })
      .then(list => { if (!disposed) names = list; }).catch(() => { storageError = 'Local storage is unavailable. Use JSON files to keep your work.'; })
      .finally(() => { if (!disposed) { booting = false; rebuild(); } });
    return () => { disposed = true; navigator.serviceWorker?.removeEventListener('controllerchange', refreshReadiness); clearTimeout(saveTimer); controller?.dispose(); viewport?.dispose(); };
  });
  $effect(() => { const activeResult = result; const options = { ...view }; viewport?.update(activeResult, options); });
  $effect(() => { if (importCandidate && importDialog && !importDialog.open) importDialog.showModal(); });
</script>

<svelte:window onkeydown={keydown} />
<a class="skip-link" href="#workspace">Skip to workspace</a>
<div class="app-shell">
  <header class="app-header">
    <a class="brand" href="/" aria-label="BeamKit workspace"><span class="brand-mark" aria-hidden="true">B<span>↗</span></span><strong>BeamKit</strong></a>
    <div class="header-context"><span class="separator">/</span><h1>Lamp attachment designer</h1></div>
    <div class="header-right"><span class="local-badge"><i></i> Local workspace</span><button class="quiet" onclick={() => installOpen = !installOpen}>Install app</button></div>
  </header>
  <div class="command-bar">
    <div class="command-left"><span class="document-icon" aria-hidden="true">▱</span><span>{project.name}</span><span class="save-state">{booting ? 'Opening…' : saving ? 'Saving…' : saved ? 'Saved locally' : 'Unsaved changes'}</span></div>
    <div class="command-actions">
      <div class="history-actions"><button class="icon-button" title="Undo" aria-label="Undo" disabled={booting || !undoStack.length} onclick={() => history('undo')}>↶</button><button class="icon-button" title="Redo" aria-label="Redo" disabled={booting || !redoStack.length} onclick={() => history('redo')}>↷</button></div>
      <input aria-label="Select project JSON" type="file" accept=".json,application/json" bind:this={fileInput} onchange={importProject} hidden />
      <button class="quiet" disabled={booting} onclick={() => fileInput.click()}>Import JSON</button><button class="quiet" disabled={booting} onclick={saveJson}>Save JSON</button>
      <button class="quiet bundle-action" disabled={!current} onclick={saveBundle}>Save bundle</button>
      <button class="primary" disabled={!current} onclick={exportParts}><span aria-hidden="true">↓</span> {multicolor ? 'Export 3MF' : 'Export STL'}</button>
    </div>
  </div>
  {#if installOpen}<div class="notice install-guide"><strong>Install BeamKit</strong><p>In Chrome, use the install icon in the address bar. On Safari, use Share → Add to Dock or Add to Home Screen. Open once online and wait for “Offline ready”. Browser storage can be cleared; keep JSON backups.</p><button onclick={() => installOpen = false}>Close guidance</button></div>{/if}
  {#if updateReady}<div class="notice"><span>A new version is ready. Your design will be saved before reloading.</span><button disabled={!current} onclick={updateApp}>Save and reload update</button></div>{/if}
  {#if storageError}<p class="notice error-notice" role="alert">{storageError}</p>{/if}
  {#if error}<div class="notice error-notice" role="alert"><span>{error}</span><button onclick={rebuild}>Retry generation</button></div>{/if}
  <div class="mobile-tools"><button aria-expanded={mobilePanel === 'model'} onclick={() => mobilePanel = mobilePanel === 'model' ? null : 'model'}>Model & projects</button><button aria-expanded={mobilePanel === 'settings'} onclick={() => mobilePanel = mobilePanel === 'settings' ? null : 'settings'}>Parameters</button></div>
  <main id="workspace" class="workspace">
    <aside class:mobile-open={mobilePanel === 'model'} class="model-panel sidebar">
      <div class="panel-label"><span>Design setup</span><span class="step-count">01 / 03</span></div>
      <section class="setup-section"><label class="section-heading" for="lamp">Lamp</label><select id="lamp" disabled={booting} value={project.lamp.id} onchange={event => changeLamp(event.currentTarget.value)}>{#each lamps as lamp}<option value={lamp.id}>{lamp.label}</option>{/each}</select><p class="spec-line">{selectedLamp.body.width} × {selectedLamp.body.height} × {selectedLamp.body.depth} mm <span class="tiny-badge">Reference</span></p></section>
      <section class="setup-section"><h2 class="section-heading">One printable model</h2><p class="field-help">The mount and light-control structure form a single accessory. STL export places its front face on the bed.</p><details class="advanced-output"><summary>Advanced test tools</summary><label class="section-heading" for="output-mode">Output</label><select id="output-mode" disabled={booting} value={project.assembly.mode} onchange={event => changeMode(event.currentTarget.value as Design['assembly']['mode'])}><option value="integrated">Single integrated model</option><option value="fit-test">Fit coupon only</option><option value="standalone">Attachment only</option></select><p class="field-help">The fit coupon tests lamp contact and control access before the full print.</p></details></section>
      <section class="setup-section"><h2 class="section-heading">Attachment</h2><div class="attachment-list">{#each attachments as attachment}<button disabled={booting} class="attachment-option" class:selected={project.attachment.id === attachment.id && project.attachment.revision === attachment.revision} aria-pressed={project.attachment.id === attachment.id && project.attachment.revision === attachment.revision} onclick={() => changeAttachment(attachment.id)}><span class="attachment-glyph" aria-hidden="true">{attachment.id === 'honeycomb' ? '⬡' : '▣'}</span><span><strong>{attachment.label}</strong><small>{attachment.id === 'honeycomb' ? 'Spill control' : 'Commercial diffusion material'}</small></span><span class="radio-dot" aria-hidden="true"></span></button>{/each}</div></section>
      <section class="setup-section mount-summary"><h2 class="section-heading">Lamp access</h2><p class="field-help">USB, switch, button and dial access volumes are excluded from the collar.</p><details><summary>Modular connection</summary><p class="field-help">{connections[0].reason}</p></details></section>
      <details class="projects-section" open><summary>Local projects <span>{names.length}</span></summary><label for="project-name" class="project-name-label">Project name</label><input id="project-name" bind:value={localName} maxlength="100" /><button class="full-width" disabled={booting} onclick={saveNamed}>Save locally</button>{#each names as name}<div class="saved-project"><button class="quiet" onclick={() => openNamed(name)}>{name}</button><button class="quiet icon-button" aria-label={`Delete ${name}`} onclick={() => removeNamed(name)}>×</button></div>{/each}<button class="text-button" onclick={showHistory}>View autosave history</button>{#each historyItems.slice(0, 5) as item}<button class="history-item" onclick={() => { replace(item.project); historyItems = []; }}>{new Date(Number(item.key.split(':')[1])).toLocaleString()}</button>{/each}<p class="field-help">Stored in this browser. JSON is your portable backup.</p></details>
    </aside>
    <section class="stage" aria-label="Accessory preview">
      <div class="stage-header"><div><span class="eyebrow">{selectedLamp.label} / {project.assembly.mode === 'fit-test' ? 'Collar' : definition.label}</span><h2>{project.assembly.mode === 'fit-test' ? 'Collar fit test' : `${definition.label} assembly`}</h2></div><span class="prototype-badge">Prototype</span></div>
      <div class="viewport" bind:this={host}></div>
      {#if !current && result}<span class="stale-badge">Previous geometry · updating</span>{/if}
      {#if previewError}<p class="preview-error">{previewError}</p>{/if}
      <div class="view-toolbar"><div class="segmented" aria-label="Preview view">{#each [['assembly','Assembled'],['part','Part only'],['section','Section'],['print','Print pose']] as [mode, label]}<button aria-pressed={view.mode === mode} class:active={view.mode === mode} onclick={() => view.mode = mode as ViewOptions['mode']}>{label}</button>{/each}</div><div class="camera-actions"><button class="quiet" onclick={() => viewport?.fit(true)}>Front view</button><button class="quiet" onclick={() => viewport?.fit()}>Fit view</button></div></div>
      <div class="view-options"><label><input type="checkbox" bind:checked={view.lampVisible} /> Lamp reference</label><label><input type="checkbox" bind:checked={view.keepoutsVisible} /> Access volumes</label><label><input type="checkbox" bind:checked={showDimensions} /> Dimensions</label><label class="opacity-control">Opacity<input aria-label="Lamp reference opacity" type="range" min="0.1" max="0.8" step="0.05" bind:value={view.lampOpacity} /></label></div>
      {#if showDimensions && dimensions}<div class="dimension-strip"><span><small>Width</small>{dimensions[0].toFixed(1)} <em>mm</em></span><span><small>Height</small>{dimensions[1].toFixed(1)} <em>mm</em></span><span><small>Depth</small>{dimensions[2].toFixed(1)} <em>mm</em></span><span class="mesh-stat"><small>Print mesh</small>{triangleCount.toLocaleString()} <em>triangles</em></span></div>{/if}
      <div class="stage-footnote"><span>Orbit to inspect · scroll to zoom</span><span>mm · +Z light direction</span></div>
    </section>
    <aside class:mobile-open={mobilePanel === 'settings'} class="settings-panel sidebar">
      <div class="panel-label"><span>Parameters</span><button class="text-button" disabled={booting} onclick={resetPreset}>Reset preset</button></div>
      <div class="settings-tabs">{#each [['attachment','Attachment'],['mount','Fit'],['print','Print']] as [tab, label]}<button class:active={settingsTab === tab} aria-pressed={settingsTab === tab} onclick={() => settingsTab = tab as typeof settingsTab}>{label}</button>{/each}</div>
      <div class="settings-body">
        {#if settingsTab === 'attachment'}<div class="settings-intro"><h2>{definition.label}</h2><p>{definition.description}</p></div>{#each definition.fields as field}<ParameterField {field} value={project.attachment.parameters[field.key]} disabled={booting} prefix="attachment" onchange={value => changeParameter('attachment', field.key, value)} />{/each}
        {:else if settingsTab === 'mount'}<div class="settings-intro"><h2>Lamp fit</h2><p>Clearance is specified per side. Access envelopes always take priority.</p></div>{#if project.mount}{#each selectedMount?.fields ?? [] as field}<ParameterField {field} value={project.mount.parameters[field.key]} disabled={booting} prefix="mount" onchange={value => changeParameter('mount', field.key, value)} />{/each}{:else}<p class="field-help">Choose an integrated output to edit the lamp fit.</p>{/if}
        {:else}<div class="settings-intro"><h2>Print profile</h2><p>Designed around a Bambu Lab printer with a 0.4 mm nozzle. Assign filaments and slice in your preferred slicer.</p></div>{#if multicolorAvailable}
          <div class="multicolor-settings">
            <label><input type="checkbox" checked={multicolor} disabled={booting} onchange={event => changeMulticolor(event.currentTarget.checked)} /> Multicolor printing</label>
            {#if multicolor}
              <ul class="material-key">
                {#each Object.values(materialRegions) as region}
                  <li><i style:background={region.color}></i>{region.label}</li>
                {/each}
              </ul>
              <p class="field-help">The 0.8 mm liner runs around the grid. Import the 3MF as one object with three parts, then assign filaments in your slicer.</p>
            {/if}
          </div>
        {/if}
        <dl class="print-specs"><div><dt>Nozzle diameter</dt><dd>0.4 mm</dd></div><div><dt>Default grid walls</dt><dd>0.8 mm · 2 nominal paths</dd></div><div><dt>Model scale</dt><dd>Millimetres</dd></div><div><dt>Print orientation</dt><dd>Front face on bed</dd></div><div><dt>Starting setup</dt><dd>0.20 mm layers · 4 walls</dd></div><div><dt>Infill</dt><dd>0–10% · inspect in slicer</dd></div></dl><label for="material" class="section-heading">Planned material</label><select id="material" value={project.printProfile.material} onchange={event => { remember(); project.printProfile.material = event.currentTarget.value as Design['printProfile']['material']; rebuild(); }}><option value="unspecified">Choose in slicer</option><option>PLA</option><option>PETG</option><option>ASA</option></select><p class="field-help">Material choice does not certify temperature resistance. Confirm walls, orientation, supports and fit in the slicer.</p>{/if}
      </div>
      <details class="diagnostics" open><summary><span class="warning-dot"></span>Print notes <span>{diagnostics.length}</span></summary>{#each diagnostics as note}<p class:warning={note.level === 'warning'}>{note.message}</p>{/each}</details>
    </aside>
  </main>
  <footer class="status-bar"><span role="status"><i class:ready={current}></i>{status}{#if current && result}<span class="status-detail"> · {Math.round(result.elapsedMs)} ms · 1 connected part{#if result.printAnalysis && result.printAnalysis.steepOverhangAreaMm2 < 0.00001} · 45° check passed{/if}</span>{/if} · {saving ? 'Saving…' : saved ? 'Saved locally' : 'Not saved'}{#if offlineReady} · Offline ready{/if}</span><a href={licenseUrl} target="_blank" rel="noreferrer">Generated output · CC0 1.0 ↗</a></footer>
</div>
{#if importCandidate}<dialog class="import-dialog" bind:this={importDialog} aria-labelledby="import-title" oncancel={() => importCandidate = null}><span class="eyebrow">Project import</span><h2 id="import-title">Review this design</h2><dl><div><dt>Name</dt><dd>{importCandidate.name}</dd></div><div><dt>Lamp</dt><dd>{importCandidate.lamp.id} · rev {importCandidate.lamp.revision}</dd></div><div><dt>Attachment</dt><dd>{importCandidate.attachment.id} · rev {importCandidate.attachment.revision}</dd></div><div><dt>Output</dt><dd>{importCandidate.assembly.mode} · mm</dd></div></dl><p>Your current design stays intact until you import. You can undo the replacement.</p><div class="dialog-actions"><button onclick={() => importCandidate = null}>Cancel import</button><button class="primary" onclick={confirmImport}>Import design</button></div></dialog>{/if}
