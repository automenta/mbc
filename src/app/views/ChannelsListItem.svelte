<script lang="ts">
	import {derived} from "svelte/store"
	import {displayProfileByPubkey, profiles, pubkey} from "@welshman/app"
	import {without} from "@welshman/lib"
	import PersonCircles from "src/app/shared/PersonCircles.svelte"
	import Card from "src/partials/Card.svelte"
	import {router} from "src/app/util/router"
	import {channelHasNewMessages} from "src/engine"
	import {displayList} from "src/util/misc"

	export let channel

	const pubkeys = channel.id.split(",")
	const members = pubkeys.length === 1 ? pubkeys : without([$pubkey], pubkeys)
	const membersDisplay = derived(profiles, () => members.map(displayProfileByPubkey))

	const enter = () => router.at("channels").of(pubkeys).push()

	$: showAlert = channelHasNewMessages(channel)
</script>

<Card interactive on:click={enter}>
	<div class="flex justify-between gap-8 px-2 py-4">
		<div class="flex gap-8" class:flex-col={members.length > 3}>
			<PersonCircles pubkeys={members} />
			<h2>{displayList($membersDisplay)}</h2>
		</div>
		<div class="relative">
			<i class="fa fa-bell" class:text-neutral-600={!showAlert} />
			{#if showAlert}
				<div class="absolute right-0 top-0 mt-1 h-1 w-1 rounded-full bg-accent" />
			{/if}
		</div>
	</div>
</Card>
