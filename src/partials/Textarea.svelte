<svelte:options accessors />

<script lang="ts">
	import Input from "src/partials/Input.svelte"

	export let value
	export let element = null

</script>

<Input {...$$props} bind:element={element} bind:value={value} type="textarea" />
