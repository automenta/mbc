<script lang="ts">
	import {getAddress, NAMED_PEOPLE, NAMED_RELAYS, NAMED_TOPICS} from "@welshman/util"
	import {tagPubkey} from "@welshman/app"
	import {isAuthorFeed, isRelayFeed, makeListFeed} from "@welshman/feeds"
	import Card from "src/partials/Card.svelte"
	import Anchor from "src/partials/Anchor.svelte"
	import Popover2 from "src/partials/Popover2.svelte"
	import ListForm from "src/app/shared/ListForm.svelte"
	import {isMentionFeed, isTopicFeed, makeUserList} from "src/domain"

	export let feed
	export let onChange

	const openForm = () => {
		formIsOpen = true
	}

	const closeForm = event => {
		formIsOpen = false

		if (event) {
			onChange(makeListFeed({addresses: [getAddress(event)]}))
		}
	}

	let formIsOpen = false

	$: list = (() => {
		if (isAuthorFeed(feed)) {
			return makeUserList({kind: NAMED_PEOPLE, tags: feed.slice(1).map(tagPubkey)})
		} else if (isMentionFeed(feed)) {
			return makeUserList({kind: NAMED_PEOPLE, tags: feed.slice(2).map(tagPubkey)})
		} else if (isRelayFeed(feed)) {
			return makeUserList({kind: NAMED_RELAYS, tags: feed.slice(1).map(url => ["r", url])})
		} else if (isTopicFeed(feed)) {
			return makeUserList({
				kind: NAMED_TOPICS,
				tags: feed.slice(2).map(topic => ["t", topic])
			})
		} else {
			throw new Error(`Invalid feed type ${feed[0]} passed to FeedFormSaveAsList`)
		}
	})()
</script>

<div class="flex flex-col items-end">
	<Anchor class="text-neutral-500" on:click={openForm} underline>Save selection as list</Anchor>
	{#if formIsOpen}
		<div class="relative w-full">
			<Popover2 onClose={closeForm}>
				<Card class="mt-2 shadow-xl">
					<ListForm {list} exit={closeForm} hide={["type", "tags"]} />
				</Card>
			</Popover2>
		</div>
	{/if}
</div>
