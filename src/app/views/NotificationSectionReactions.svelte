<script lang="ts">
	import {onMount} from "svelte"
	import {ago, DAY, groupBy, int} from "@welshman/lib"
	import {pubkey} from "@welshman/app"
	import FlexColumn from "src/partials/FlexColumn.svelte"
	import NotificationItem from "src/app/shared/NotificationItem.svelte"
	import NoteReactions from "src/app/shared/NoteReactions.svelte"
	import {reactionNotifications, setChecked} from "src/engine"

	export let limit

	const interval = int(DAY)

	const getBucket = e => Math.round(ago(e.created_at) / interval)

	const shouldAddEvent = (event, getContext) => event.pubkey === $pubkey

	$: notificationsGrouped = groupBy(getBucket, $reactionNotifications)
	$: notifications = Array.from(notificationsGrouped.entries()).slice(0, limit)

	onMount(() => {
		setChecked("reactions/*")

		return () => {
			setChecked("reactions/*")
		}
	})
</script>

<FlexColumn>
	{#each notifications as [seconds, events], i (seconds)}
		<NotificationItem
		  depth={0}
		  {notifications}
		  {interval}
		  {shouldAddEvent}
		  {events}
		  {i}
		  let:event
		  let:context>
			<NoteReactions {context} {event} />
		</NotificationItem>
	{:else}
		<p class="py-12 text-center">No notifications found - check back later!</p>
	{/each}
</FlexColumn>
