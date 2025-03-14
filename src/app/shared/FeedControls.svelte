<script lang="ts">
	import {debounce} from "throttle-debounce"
	import {equals, not, sortBy, uniqBy} from "@welshman/lib"
	import {getAddress} from "@welshman/util"
	import {synced} from "@welshman/store"
	import {getFeedArgs, isSearchFeed, makeScopeFeed, makeSearchFeed, Scope} from "@welshman/feeds"
	import {signer} from "@welshman/app"
	import {toSpliced} from "src/util/misc"
	import {slideAndFade} from "src/util/transition"
	import {boolCtrl} from "src/partials/utils"
	import Card from "src/partials/Card.svelte"
	import Modal from "src/partials/Modal.svelte"
	import Input from "src/partials/Input.svelte"
	import Chip from "src/partials/Chip.svelte"
	import Anchor from "src/partials/Anchor.svelte"
	import FeedForm from "src/app/shared/FeedForm.svelte"
	import {router} from "src/app/util"
	import {displayFeed, makeFeed, normalizeFeedDefinition, readFeed} from "src/domain"
	import {deleteEvent, userFavoritedFeeds, userFeeds, userListFeeds} from "src/engine"

	export let feed
	export let updateFeed

	feed.definition = normalizeFeedDefinition(feed.definition)

	const form = boolCtrl()
	const expanded = synced("FeedControls/expanded", false)

	const toggleExpanded = () => expanded.update(not)

	const openForm = () => {
		savePoint = {...feed}
		$form.enable()
	}

	const closeForm = () => {
		feed = savePoint
		$form.disable()
	}

	const getSearch = definition => (getFeedArgs(definition)?.find(isSearchFeed)?.[1] as string) || ""

	const setFeedDefinition = definition => {
		feed = {...feed, definition}
		search = getSearch(definition)
		$form.disable()
		updateFeed(feed)
	}

	const setSubFeed = subFeed => {
		const idx = feed.definition.findIndex(f => f[0] === subFeed[0])

		setFeedDefinition(
		  idx >= 0 ? toSpliced(feed.definition, idx, 1, subFeed) : [...feed.definition, subFeed]
		)
	}

	const removeSubFeed = subFeed => {
		setFeedDefinition(feed.definition.filter(f => f !== subFeed))
	}

	const setFeed = newFeed => {
		feed = newFeed
		setFeedDefinition(feed.definition)
	}

	const createFeed = () => {
		const definition = normalizeFeedDefinition(makeScopeFeed(Scope.Follows))

		setFeed(makeFeed({definition}))
		openForm()
	}

	const exitForm = event => {
		if (event) {
			if (feed.list) {
				deleteEvent(feed.list.event)
			}

			setFeed(readFeed(event))
		}

		closeForm()
	}

	const onSearchBlur = debounce(500, () => {
		const text = search.trim()

		if (text) {
			setSubFeed(makeSearchFeed(text))
		} else {
			removeSubFeed(subFeeds.find(isSearchFeed))
		}
	})

	let savePoint
	let search = getSearch(feed.definition)

	$: subFeeds = getFeedArgs(feed.definition as any)
	$: allFeeds = uniqBy(
	  feed => getAddress(feed.event),
	  sortBy(displayFeed, [...$userFeeds, ...$userListFeeds, ...$userFavoritedFeeds])
	)
</script>

<div class="flex flex-col">
	<div class="flex flex-grow items-center justify-end gap-2">
		<Input bind:value={search} class="hidden xs:block" dark on:input={onSearchBlur}>
			<div class="hidden text-white xs:block" slot="after">
				<i class="fa fa-search" />
			</div>
		</Input>
		<slot name="controls" />
		{#if $signer}
			<Anchor button low on:click={toggleExpanded}>Customize</Anchor>
		{/if}
	</div>
	{#if $expanded}
		<div transition:slideAndFade class="pt-4">
			<Card class="flex flex-col gap-2">
				<div class="flex items-center justify-between">
					<p class=" text-2xl">Your Feeds</p>
					<Anchor on:click={toggleExpanded}>
						<i class="fa fa-lg fa-times transition-all duration-700" class:rotate-180={$expanded} />
					</Anchor>
				</div>
				<div class="flex flex-wrap gap-1">
					{#each allFeeds as other}
						<Chip
						  class="cursor-pointer"
						  accent={equals(other.definition, feed.definition)}
						  on:click={() => setFeed(other)}>
							{displayFeed(other)}
						</Chip>
					{/each}
					<Chip class="cursor-pointer" on:click={createFeed}>
						<i class="fa fa-plus" />
						Add feed
					</Chip>
				</div>
				<div class="my-4 flex flex-col-reverse justify-between gap-2 sm:flex-row">
					<div class="flex flex-col gap-2 sm:flex-row">
						<Anchor button href={router.at("lists").toString()}>Manage lists</Anchor>
						<Anchor button href={router.at("feeds").toString()}>Manage feeds</Anchor>
					</div>
					<Anchor button accent on:click={openForm}>Edit feed</Anchor>
				</div>
			</Card>
		</div>
	{/if}
</div>

{#if $form.enabled}
	<Modal onEscape={closeForm}>
		<FeedForm
		  {feed}
		  exit={exitForm}
		  showDelete={Boolean(feed.event)}
		  apply={() => setFeedDefinition(feed.definition)} />
	</Modal>
{/if}
