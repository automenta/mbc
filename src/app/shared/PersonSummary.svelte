<script lang="ts">
	import {tagPubkey} from "@welshman/app"
	import cx from "classnames"
	import Anchor from "src/partials/Anchor.svelte"
	import PersonCircle from "src/app/shared/PersonCircle.svelte"
	import PersonAbout from "src/app/shared/PersonAbout.svelte"
	import PersonName from "src/app/shared/PersonName.svelte"
	import PersonActions from "src/app/shared/PersonActions.svelte"
	import PersonHandle from "src/app/shared/PersonHandle.svelte"
	import {router} from "src/app/util/router"
	import {derived} from "svelte/store"
	import {follow, unfollow, userFollows} from "src/engine"

	export let pubkey
	export let inert = false
	export let hideActions = false
	export let hideFollowActions = false

	const following = derived(userFollows, $m => $m.has(pubkey))

	const unfollowPerson = () => unfollow(pubkey)
	const followPerson = () => follow(tagPubkey(pubkey))

	const showDetail = () => router.at("people").of(pubkey).open()
</script>

<div class="relative flex flex-grow flex-col gap-4">
	<div class="relative grid grid-cols-4 gap-4">
		<Anchor
		  class={cx("col-span-3 flex gap-4 overflow-hidden", {"col-span-4": hideActions})}
		  on:click={inert ? null : showDetail}>
			<PersonCircle class="h-14 w-14" {pubkey} />
			<div class="mr-16 flex min-w-0 flex-grow flex-col gap-1">
				<PersonName class="text-lg" {pubkey} />
				<PersonHandle {pubkey} />
			</div>
		</Anchor>
		{#if !hideActions}
			<div class="flex items-start justify-end">
				<div class="flex items-center justify-end gap-2">
					{#if !hideFollowActions}
						{#if $following}
							<Anchor button low class="border-none bg-tinted-800-d" on:click={unfollowPerson}
							>Followed
							</Anchor>
						{:else}
							<Anchor button accent on:click={followPerson}>Follow</Anchor>
						{/if}
					{/if}
					<slot name="actions" {pubkey}>
						<PersonActions {pubkey} />
					</slot>
				</div>
			</div>
		{/if}
	</div>
	<PersonAbout {pubkey} truncate />
</div>
