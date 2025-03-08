<script lang="ts">
	export let url

	const onLoad = () => {
		loaded = true
	}

	let loaded = false
</script>

<video
  class="max-h-96 object-contain object-center"
  class:hidden={!loaded}
  controls
  on:click|stopPropagation
  on:loadeddata={onLoad}
  src={url} />

{#if !loaded}
	<div class="shimmer h-64 w-96" />
{/if}
