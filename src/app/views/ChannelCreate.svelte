<script lang="ts">
	import {derived} from "svelte/store"
	import {uniq} from "src/lib"
	import {isShareableRelayUrl} from "src/util"
	import {displayProfileByPubkey, getRelayUrls, inboxRelaySelectionsByPubkey, pubkey} from "src/app"
	import Field from "src/partials/Field.svelte"
	import FlexColumn from "src/partials/FlexColumn.svelte"
	import Anchor from "src/partials/Anchor.svelte"
	import PersonSelect from "src/app/shared/PersonSelect.svelte"
	import {router} from "src/app/util/router"
	import {hasNip44} from "src/engine"
	import {displayList, pluralize} from "src/util/misc"

	let value = []

	const submit = () => router.at("channels").of(pubkeys).push()

	$: pubkeys = uniq(value.concat($pubkey))
	$: pubkeysWithoutInbox = derived(inboxRelaySelectionsByPubkey, $inboxRelaySelectionsByPubkey =>
	  pubkeys.filter(
		pubkey => !getRelayUrls($inboxRelaySelectionsByPubkey.get(pubkey)).some(isShareableRelayUrl)
	  )
	)
	$: nip44Disabled = pubkeys.length > 2 && !$hasNip44
	$: missingInbox = pubkeys.length > 2 && $pubkeysWithoutInbox.length > 0
</script>

<form class="flex justify-center py-12" on:submit|preventDefault={submit}>
	<FlexColumn class="pb-56">
		<h2 class=" text-center text-6xl">Start a conversation</h2>
		<Field label="Who do you want to talk to?">
			<PersonSelect autofocus bind:value multiple />
		</Field>
		<Anchor button disabled={nip44Disabled} tag="button" type="submit">Start Chat</Anchor>
		{#if nip44Disabled}
			<p class="flex gap-2">
				<i class="fa fa-info-circle p-1" />
				You are using a login method that doesn't yet support group chats. Please consider upgrading
				your signer to access this feature.
			</p>
		{/if}
		{#if missingInbox}
			<p class="flex gap-2">
				<i class="fa fa-info-circle p-1" />
				{displayList($pubkeysWithoutInbox.map(displayProfileByPubkey))}
				{pluralize($pubkeysWithoutInbox.length, "does not have", "do not have")}
				inbox relays, which means they likely either don't want to receive DMs, or are using a client
				that does not support nostr group chats.
			</p>
		{/if}
	</FlexColumn>
</form>
