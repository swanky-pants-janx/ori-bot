<script lang="ts">
  interface Props {
    label: string
    checked: boolean
    hint?: string
    disabled?: boolean
    onchange: (checked: boolean) => void
  }

  let { label, checked, hint, disabled = false, onchange }: Props = $props()
</script>

<label class="row" class:disabled>
  <span class="text">
    <span class="label">{label}</span>
    {#if hint}<span class="hint">{hint}</span>{/if}
  </span>
  <input type="checkbox" role="switch" {checked} {disabled} onchange={(e) => onchange(e.currentTarget.checked)} />
  <span class="switch" aria-hidden="true"></span>
</label>

<style>
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    cursor: pointer;
  }

  .row.disabled {
    opacity: 0.5;
    cursor: default;
  }

  .text {
    flex: 1;
    display: grid;
    gap: 1px;
  }

  .label {
    font-size: 12.5px;
    font-weight: 700;
  }

  .hint {
    color: var(--ink-soft);
    font-size: 11px;
    font-weight: 550;
    line-height: 1.3;
  }

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .switch {
    flex: none;
    position: relative;
    width: 34px;
    height: 20px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--paper-3);
    transition: background 0.15s;
  }

  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--ink);
    transition: transform 0.18s cubic-bezier(0.3, 1.4, 0.5, 1);
  }

  input:checked + .switch {
    background: var(--mint);
  }

  input:checked + .switch::after {
    transform: translateX(14px);
  }

  input:focus-visible + .switch {
    outline: 2.5px solid var(--sky);
    outline-offset: 2px;
  }
</style>
