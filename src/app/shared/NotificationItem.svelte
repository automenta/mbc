<script lang="ts">
	import {ago} from "@welshman/lib"
	import FeedItem from "src/app/shared/FeedItem.svelte"
	import NoteReducer from "src/app/shared/NoteReducer.svelte"
	import {formatTimestampAsDate} from "src/util/misc"

	export let i
	export let depth
	export let events
	export let interval
	export let notifications
	export let shouldAddEvent = undefined

	let items = []

	$: date = formatTimestampAsDate(ago(notifications[i][0], interval))
	$: prev = i === 0 ? "" : formatTimestampAsDate(ago(notifications[i - 1][0], interval))
</script>

{#if prev !== date && items.length > 0}
	<div class="flex items-center gap-4">
		<small class="whitespace-nowrap text-neutral-100">{date}</small>
		<div class="h-px w-full bg-neutral-600" />
	</div>
{/if}

<NoteReducer
  bind:items
  depth={1}
  {events}
  let:event
  let:getContext
  {shouldAddEvent}
  shouldAwait
  shouldSort>
	<slot context={getContext(event)} {event} />
	<FeedItem {depth} {getContext} note={event} showLoading topLevel />
</NoteReducer>
