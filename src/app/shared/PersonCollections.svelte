<script lang="ts">
	import Chip from "src/partials/Chip.svelte"
	import Subheading from "src/partials/Subheading.svelte"
	import FeedItem from "src/app/shared/FeedItem.svelte"
	import {deriveCollections, loadLabels} from "src/engine"

	export let pubkey

	const collections = deriveCollections(pubkey)

	const setSelection = collection => {
		selection = collection
	}

	let selection

	loadLabels([pubkey])
</script>

<div class="flex gap-2">
	<div class="my-1">Select a collection:</div>
	<div class="-mb-2">
		{#each $collections as collection (collection.name)}
			<Chip class="mb-2 mr-2 inline-block cursor-pointer" on:click={() => setSelection(collection)}
			>{collection.name}</Chip>
		{/each}
	</div>
</div>

{#if selection}
	<Subheading>#{selection.name}</Subheading>
	{#each selection.ids as id (id)}
		<FeedItem note={{id}} />
	{/each}
{/if}
