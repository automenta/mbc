<script lang="ts">
	import {NAMED_BOOKMARKS} from "@welshman/util"
	import FeedForm from "src/app/shared/FeedForm.svelte"
	import {router} from "src/app/util"
	import {mapListToFeed, readFeed, readUserList} from "src/domain"
	import {deriveEvent} from "src/engine"

	export let address

	const event = deriveEvent(address)

	const exit = () => router.clearModals()

	const getFeed = () =>
	  address.startsWith(NAMED_BOOKMARKS) ? mapListToFeed(readUserList($event)) : readFeed($event)
</script>

{#if $event}
	<FeedForm showDelete showSave feed={getFeed()} {exit} />
{:else}
	<p class="text-center">Sorry, we weren't able to find that feed.</p>
{/if}
