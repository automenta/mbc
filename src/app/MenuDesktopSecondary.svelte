<script lang="ts">
	import {slide} from "src/util/transition"

	export let onEscape
</script>

<svelte:body
  on:keydown={e => {
    if (e.key === "Escape") {
      onEscape()
    }
  }} />

<div class="fixed inset-0 cursor-pointer" on:click={onEscape} />

<div
  class="absolute left-0 w-72 pr-px"
  on:click={onEscape}
  style="bottom: 4.5rem"
  transition:slide|local={{duration: 300}}>
	<div class="overflow-hidden rounded-t-xl bg-neutral-800">
		<slot />
	</div>
</div>
