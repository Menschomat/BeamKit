<script lang="ts">
  import type { Field } from '../domain/definitions.ts';
  let { field, value, disabled = false, prefix, onchange }: { field: Field; value: number; disabled?: boolean; prefix: string; onchange: (value: number) => void } = $props();
  let id = $derived(`${prefix}-${field.key}`);
  let invalid = $derived(!Number.isFinite(value) || value < field.min || value > field.max);
</script>
{#if field.choices}
<div class="parameter">
  <label class="section-heading" for={id}>{field.label}</label>
  <select {id} {disabled} {value} onchange={event => onchange(Number(event.currentTarget.value))}>
    {#each field.choices as choice}<option value={choice.value}>{choice.label}</option>{/each}
  </select>
</div>
{:else}
<div class="parameter">
  <div class="parameter-heading">
    <label id={`${id}-label`} for={id}>{field.label}</label>
    <div class="number-wrap"><input {id} type="number" {disabled} min={field.min} max={field.max} step={field.step} {value}
      aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : field.help ? `${id}-help` : undefined}
      oninput={event => onchange(event.currentTarget.valueAsNumber)} /><span>{field.unit}</span></div>
  </div>
  <input aria-label={`${field.label} slider`} aria-labelledby={`${id}-label`} type="range" {disabled} min={field.min} max={field.max} step={field.step} {value}
    oninput={event => onchange(event.currentTarget.valueAsNumber)} />
  {#if invalid}<p class="field-error" id={`${id}-error`}>Use {field.min}–{field.max} {field.unit}.</p>
  {:else if field.help}<p class="field-help" id={`${id}-help`}>{field.help}</p>{/if}
</div>
{/if}
