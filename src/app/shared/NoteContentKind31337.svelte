<script lang="ts">
	import {fromPairs} from "src/lib"
	import type {TrustedEvent} from "src/util"
	import {getTag, getTagValue, getTagValues, tagsFromIMeta} from "src/util"
	import Chips from "src/partials/Chips.svelte"
	import NoteContentLinks from "src/app/shared/NoteContentLinks.svelte"

	export let note: TrustedEvent
	export let showMedia: boolean

	const imeta = getTag("imeta", note.tags)
	const categories = getTagValues("c", note.tags)
	const {cover, subject, title} = fromPairs(note.tags)
</script>

<div class="flex flex-col gap-2 overflow-hidden text-ellipsis">
	<div class="flex justify-between">
		<h3 class=" text-2xl">{title || subject}</h3>
		<Chips items={categories}>
			<div let:item slot="item">
				<i class="fa fa-tag" />
				{item}
			</div>
		</Chips>
	</div>
	{#if imeta}
		<NoteContentLinks {showMedia} urls={[getTagValue("url", tagsFromIMeta(imeta.slice(1)))]} />
	{/if}
	{#if cover}
		<NoteContentLinks {showMedia} urls={[cover]} />
	{/if}
</div>
