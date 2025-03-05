<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import { themeColors } from "src/partials/state"

  export let value
  export let disabled = false
  export let scale = 1

  const dispatch = createEventDispatcher()

  const onChange = (e) => {
    value = e.target.checked
    dispatch("change", value)
  }
</script>

<input
  type="checkbox"
  {disabled}
  checked={value}
  onchange={onChange}
  style:height="{20 * scale}px"
  style:width="{36 * scale}px"
  style:background-color={value ? $themeColors.accent : $themeColors["tinted-800"]}
  style:transform="scale({scale})"
/>

<style>
  input[type="checkbox"] {
    appearance: none;
    margin: 0;
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    position: relative;
    transition: background-color 0.2s;
  }

  input[type="checkbox"]:checked::after {
    content: '✓';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    color: white;
  }

  input[type="checkbox"]:disabled {
    opacity: 0.6;
  }
</style>