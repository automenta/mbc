<script lang="ts">
	import Modal from "src/partials/Modal.svelte"
	import {fade, fly} from "src/util/transition"

	export let onEscape
</script>

<Modal {onEscape}>
	<div slot="wrapper">
		<div
		  class="fixed inset-0 z-modal cursor-pointer bg-black opacity-75"
		  on:click={onEscape}
		  transition:fade|local />
		<div
		  class="fixed bottom-0 left-0 right-0 z-modal rounded-t-2xl bg-neutral-800 pt-8"
		  on:click={onEscape}
		  transition:fly|local={{y: 600, duration: 300}}>
			<div class="flex flex-col justify-center gap-1 text-lg">
				<slot />
			</div>
			<div class="flex h-16 cursor-pointer items-center justify-end p-3 text-tinted-200">
				<i class="fa fa-times fa-2x" on:click|stopPropagation={onEscape} />
			</div>
		</div>
	</div>
</Modal>
