<style>
	.loading-bar::after {
		content: "";
		position: absolute;
		top: 0;
		right: -50px;
		width: 50px;
		height: 100%;
		background: linear-gradient(to left, rgba(0, 0, 0, 0), var(--accent));
	}

	.loading-bar-content > * {
		@apply z-feature;
	}
</style>

<script lang="ts">
	import type {Thunk} from "@welshman/app"
	import {abortThunk, thunks} from "@welshman/app"
	import {PublishStatus} from "@welshman/net"
	import {now} from "@welshman/signer"
	import {LOCAL_RELAY_URL, type TrustedEvent} from "@welshman/util"
	import {tweened} from "svelte/motion"
	import {userSettings} from "src/engine"
	import Anchor from "src/partials/Anchor.svelte"
	import {timestamp1} from "src/util/misc"

	const rendered = now()

	export let event: TrustedEvent
	export let onReplyAbort: (thunk: Thunk) => void

	const completed = tweened(0)

	const abort = () => {
		abortThunk(thunk)
		onReplyAbort(thunk)
	}

	$: thunk = $thunks[event.id] as Thunk
	$: status = thunk?.status
	$: relays = thunk?.request?.relays.filter(r => r !== LOCAL_RELAY_URL)
	$: statuses = Object.entries($status || {})
	  .filter(([k, v]) => k !== LOCAL_RELAY_URL)
	  .map(([k, v]) => v)
	$: pending = statuses.filter(s => s.status === PublishStatus.Pending).length
	$: failed = statuses.filter(
	  s => s.status === PublishStatus.Failure || s.status === PublishStatus.Aborted
	).length
	$: timeout = statuses.filter(s => s.status === PublishStatus.Timeout).length
	$: success = statuses.filter(s => s.status === PublishStatus.Success).length
	$: total = relays?.length || 0
	$: isPending = pending > 0
	$: isCompleted = total === success + failed + timeout

	$: {
		if (thunk && statuses.length > 0) {
			$completed = ((total - pending) / total) * 80
		}
	}
</script>

{#if thunk}
	<div
	  class="loading-bar-content relative flex h-6 w-full items-center justify-between overflow-hidden rounded-md pl-4 text-sm"
	  class:bg-neutral-500={thunk && (isPending || isCompleted)}
	  class:border={!(isPending || isCompleted)}
	  class:px-4={thunk && isPending}
	  on:click|stopPropagation>
		{#if isPending || isCompleted}
			<div
			  class="loading-bar absolute left-0 top-0 h-full bg-accent"
			  style="width: {20 + $completed}%" />
			{#if isPending}
        <span class="sm:hidden">
          {success}/{total} relays
        </span>
				<span class="hidden sm:inline">
          Publishing... {total - pending} of {total} relays
        </span>
			{:else}
        <span class="sm:hidden">
          {success}/{total} relays
        </span>
				<span class="hidden sm:inline">
          Published to {success}/{total} relays
        </span>
				<Anchor
				  class=" z-feature rounded-r-md bg-tinted-100-d px-4 py-1 uppercase text-tinted-700-d"
				  modal
				  href="/publishes">
					<span class="sm:hidden"> Details </span>
					<span class="hidden sm:inline"> See details </span>
				</Anchor>
			{/if}
		{:else if $userSettings.send_delay > 0}
			{@const seconds = rendered + Math.ceil($userSettings.send_delay / 1000) - $timestamp1}
			<span class="hidden sm:inline">
        Sending reply in {seconds} seconds
      </span>
			<span class="sm:hidden">
        Sending in {seconds}s
      </span>
			<button
			  class="ml-2 cursor-pointer rounded-md bg-neutral-100-d px-4 py-1 text-tinted-700-d"
			  on:click={abort}>Cancel
			</button>
		{/if}
	</div>
{/if}
