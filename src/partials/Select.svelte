<script lang="ts">
  import Input from "src/partials/Input.svelte"

  export let value
  export let onChange = null
  export let dark = false
</script>

<Input type="select" dark={dark} {...$$props} bind:value={value} on:change={() => onChange && onChange(value)}>
  <slot />
  <slot slot="before" name="before" />
  <slot slot="after" name="after" />
</Input>
