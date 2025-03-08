<script lang="ts">
	import {createEventDispatcher} from "svelte"

	const dispatch = createEventDispatcher()

	const onRemove = () => dispatch("remove")
</script>

<button class="flex items-center justify-between" type="button">
	<div class="flex items-center gap-4">
    <span class="cursor-pointer p-2" on:click={onRemove}>
      <i class="fa fa-times" />
    </span>
		<slot name="label" />
	</div>
	<slot name="data" />
</button>
