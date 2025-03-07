<script lang="ts">
	import {onDestroy, onMount} from "svelte"
	import {createScroller} from "src/util/misc"
	import Tabs from "src/partials/Tabs.svelte"
	import OnboardingTasks from "src/app/shared/OnboardingTasks.svelte"
	import NotificationSectionMain from "src/app/views/NotificationSectionMain.svelte"
	import NotificationSectionReactions from "src/app/views/NotificationSectionReactions.svelte"
	import {router} from "src/app/util/router"
	import {
		listenForNotifications,
		sessionWithMeta,
		unreadMainNotifications,
		unreadReactionNotifications
	} from "src/engine"

	const allTabs = ["Mentions & Replies", "Reactions"]

	const setActiveTab = tab => router.at("notifications").at(tab).push()

	const loadMore = async () => {
		limit += 2
	}

	export let activeTab = allTabs[0]

	let limit = 2
	let innerWidth = 0
	let element = null
	let notificationSubscription // Variable to hold the subscription

	document.title = "Notifications"

	onMount(() => {
		notificationSubscription = listenForNotifications() // Use listenForNotifications and assign to subscription
		console.log("Notifications.svelte: Subscription START - notificationSubscription") // ADDED LOG

		const scroller = createScroller(loadMore, {element})

		return () => {
			scroller.stop()
			if (notificationSubscription && typeof notificationSubscription.unsub === "function") {
				notificationSubscription.unsub() // Unsubscribe on unmount
			}
		}
	})

	onDestroy(() => { // ADDED onDestroy BLOCK
		if (notificationSubscription) {
			notificationSubscription.close() // Close the subscription
			notificationSubscription = undefined // Good practice
			console.log("Notifications.svelte: Subscription EVENT: CLOSE - notificationSubscription") // ADDED LOG
		}
	})
</script>

<svelte:window bind:innerWidth />

<Tabs {activeTab} {setActiveTab} tabs={allTabs}>
	<div class="flex gap-2" let:tab slot="tab">
		<div>{tab}</div>
		{#if activeTab !== tab}
			{#if tab === allTabs[0] && $unreadMainNotifications.length > 0}
				<div class="h-6 rounded-full bg-neutral-700 px-2">
					{$unreadMainNotifications.length}
				</div>
			{:else if tab === allTabs[1] && $unreadReactionNotifications.length > 0}
				<div class="h-6 rounded-full bg-neutral-700 px-2">
					{$unreadReactionNotifications.length}
				</div>
			{/if}
		{/if}
	</div>
</Tabs>

{#if $sessionWithMeta?.onboarding_tasks_completed}
	<OnboardingTasks />
{/if}

<div bind:this={element}>
	{#if activeTab === allTabs[0]}
		<NotificationSectionMain {limit} />
	{:else if activeTab === allTabs[1]}
		<NotificationSectionReactions {limit} />
	{/if}
</div>
