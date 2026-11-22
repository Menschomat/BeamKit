<script lang="ts">
  import { tick } from 'svelte';
  import type { LampDefinition } from '../domain/definitions.ts';

  let { lamps, selected, disabled, onchange }: {
    lamps: readonly LampDefinition[];
    selected: LampDefinition;
    disabled: boolean;
    onchange: (id: string) => void;
  } = $props();

  let open = $state(false);
  let picker: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let menu = $state<HTMLDivElement>();

  async function showMenu() {
    open = true;
    await tick();
    if (open) menu?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }

  function closeMenu(restoreFocus = false) {
    open = false;
    if (restoreFocus) trigger.focus();
  }

  function dismissOutside(event: PointerEvent | FocusEvent) {
    if (open && event.target instanceof Node && !picker.contains(event.target)) closeMenu();
  }

  function navigate(event: KeyboardEvent) {
    if (!open) {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      void showMenu();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (!menu) return;
    const options = Array.from(menu.querySelectorAll('button'));
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    switch (event.key) {
      case 'ArrowDown': next = (current + 1) % options.length; break;
      case 'ArrowUp': next = (current + options.length - 1) % options.length; break;
      case 'Home': next = 0; break;
      case 'End': next = options.length - 1; break;
      default: return;
    }
    event.preventDefault();
    options[next]?.focus();
  }

  function selectLamp(id: string, event: MouseEvent) {
    closeMenu(event.detail === 0);
    if (selected.id !== id) onchange(id);
  }
</script>

<svelte:window onpointerdown={dismissOutside} onfocusin={dismissOutside} />

<div class="lamp-picker" bind:this={picker}>
  <h1>
    <button class="lamp-trigger" bind:this={trigger} {disabled} aria-label={`Lamp: ${selected.label}`}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? 'lamp-models' : undefined}
      onclick={() => open ? closeMenu() : showMenu()} onkeydown={navigate}>
      {selected.label}
      <span class="lamp-chevron" aria-hidden="true"></span>
    </button>
  </h1>
  {#if open}
    <div class="lamp-menu" id="lamp-models" role="menu" aria-label="Lamp models" bind:this={menu}>
      {#each lamps as lamp (lamp.id)}
        <button type="button" role="menuitemradio" aria-checked={lamp.id === selected.id} tabindex="-1"
          onclick={event => selectLamp(lamp.id, event)} onkeydown={navigate}>
          {lamp.label}
          {#if lamp.id === selected.id}<span class="lamp-check" aria-hidden="true"></span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
