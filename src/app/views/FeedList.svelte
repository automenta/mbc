<script lang="ts">
	import {batch, flatten, sortBy, uniqBy} from "@welshman/lib"
	import type {TrustedEvent} from "@welshman/util"
	import {FEED, FEEDS, getAddress, getAddressTagValues, getIdFilters, NAMED_BOOKMARKS} from "@welshman/util"
	import {repository} from "@welshman/app"
	import {onMount} from "svelte"
	import {createScroller} from "src/util/misc"
	import {fly} from "src/util/transition"
	import FlexColumn from "src/partials/FlexColumn.svelte"
	import Anchor from "src/partials/Anchor.svelte"
	import Input from "src/partials/Input.svelte"
	import FeedCard from "src/app/shared/FeedCard.svelte"
	import {router} from "src/app/util/router"
	import {displayFeed} from "src/domain"
	import {
		addSinceToFilter,
		feedSearch,
		load,
		userFavoritedFeeds,
		userFeeds,
		userFollows,
		userListFeeds
	} from "src/engine"

	const createFeed = () => router.at("feeds/create").open()

	const editFeed = address => router.at("feeds").of(address).open()

	const loadFeeds = batch(300, (addresseses: string[][]) => {
		const addresses = flatten(addresseses).filter(a => !repository.getEvent(a))

		if (addresses.length > 0) {
			load({skipCache: true, filters: getIdFilters(addresses)})
		}
	})

	const onRepositoryUpdate = ({added}: {added: TrustedEvent[]}) =>
	  loadFeeds(added.filter(e => e.kind === FEEDS).flatMap(e => getAddressTagValues(e.tags)))

	const loadMore = async () => {
		limit += 20
	}

	let q = ""
	let limit = 20
	let initialAddrs = new Set()
	let element

	$: feeds = uniqBy(
	  feed => getAddress(feed.event),
	  sortBy(displayFeed, [...$userFeeds, ...$userListFeeds, ...$userFavoritedFeeds])
	)

	load({
		skipCache: true,
		forcePlatform: false,
		filters: [
			addSinceToFilter({kinds: [FEED, FEEDS, NAMED_BOOKMARKS], authors: Array.from($userFollows)})
		]
	})

	onMount(() => {
		const scroller = createScroller(loadMore, {element})

		initialAddrs = new Set(feeds.map(feed => getAddress(feed.event)))
		repository.on("update", onRepositoryUpdate)

		return () => {
			scroller.stop()
			repository.off("update", onRepositoryUpdate)
		}
	})
</script>

<FlexColumn bind:element>
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<i class="fa fa-rss fa-lg" />
			<h2 class=" text-2xl">Your feeds</h2>
		</div>
		<Anchor accent button on:click={createFeed}>
			<i class="fa fa-plus" /> Feed
		</Anchor>
	</div>
	{#each feeds as feed (feed.event.id)}
		{@const address = getAddress(feed.event)}
		<div in:fly={{y: 20}}>
			<FeedCard {address}>
				<div slot="controls">
					<Anchor on:click={() => editFeed(address)}>
						<i class="fa fa-edit" /> Edit
					</Anchor>
				</div>
			</FeedCard>
		</div>
	{/each}
	{#each $userListFeeds as feed (feed.list.event.id)}
		{@const address = getAddress(feed.list.event)}
		<div in:fly={{y: 20}}>
			<FeedCard {address}>
				<div slot="controls">
					<Anchor on:click={() => editFeed(address)}>
						<i class="fa fa-edit" /> Edit
					</Anchor>
				</div>
			</FeedCard>
		</div>
	{/each}
	{#if $userFeeds.length === 0 && $userListFeeds.length === 0}
		<p class="py-12 text-center">You don't have any feeds yet.</p>
	{/if}
	<div class="flex items-center gap-2">
		<i class="fa fa-circle-nodes fa-lg" />
		<h2 class=" text-2xl">Other feeds</h2>
	</div>
	<p>Below are feeds created by people in your network.</p>
	<Input bind:value={q} placeholder="Search feeds">
		<i class="fa-solid fa-search" slot="before" />
	</Input>
	{#each $feedSearch
	  .searchValues(q)
	  .filter(address => !initialAddrs.has(address))
	  .slice(0, limit) as address (address)}
		<FeedCard {address} />
	{/each}
</FlexColumn>
