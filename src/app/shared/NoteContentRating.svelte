<script lang="ts">
	import {ctx, switcher} from "@welshman/lib"
	import {displayRelayUrl, getTag} from "@welshman/util"
	import {displayProfileByPubkey} from "@welshman/app"
	import Anchor from "src/partials/Anchor.svelte"
	import Rating from "src/partials/Rating.svelte"
	import {router} from "src/app/util/router"

	export let note, rating

	const tag = getTag(["r", "p", "e"], note.tags)

	let href
	let display

	if (tag) {
		const [type, value] = tag
		const relays = ctx.app.router.Event(note).getUrls()

		href = switcher(type, {
			r: router.at("relays").of(value).toString(),
			p: router.at("people").of(value, {relays}).toString(),
			e: router.at("notes").of(value, {relays}).toString(),
			default: null
		})

		display = switcher(type, {
			r: displayRelayUrl(value),
			p: displayProfileByPubkey(value),
			e: "a note",
			default: null
		})
	}
</script>

{#if display}
	<div class="mb-4 flex items-center gap-2 border-l-2 border-solid border-neutral-600 pl-2">
		Rated
		{#if href}
			<Anchor modal underline {href}>{display}</Anchor>
		{:else}
			{display}
		{/if}
		<div class="text-sm">
			<Rating inert value={rating} />
		</div>
	</div>
{/if}
