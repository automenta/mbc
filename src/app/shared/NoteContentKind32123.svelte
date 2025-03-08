<script lang="ts">
	import Card from "src/partials/Card.svelte"
	import NoteContentLinks from "src/app/shared/NoteContentLinks.svelte"

	export let note

	const {title, creator, enclosure, link} = JSON.parse(note.content)
</script>

<Card class="flex flex-col gap-4" interactive on:click={() => window.open(link)}>
	<p class=" text-xl">{title} | {creator}</p>
	<NoteContentLinks urls={[enclosure]} />
</Card>
