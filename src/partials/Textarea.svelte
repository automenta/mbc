<svelte:options accessors />

<script lang="ts">
  import Input from "src/partials/Input.svelte";

  export let value
  export let element = null

</script>

<Input type="textarea" {...$$props} bind:value={value} bind:element={element} />
