<script lang="ts">
	import {
		deriveHandleForPubkey,
		deriveProfile,
		deriveProfileDisplay,
		getUserWotScore,
		maxWot,
		profilesByPubkey,
		session,
		tagZapSplit
	} from "src/app"
	import {userFollows} from "src/engine"
	import Anchor from "src/partials/Anchor.svelte"
	import Popover from "src/partials/Popover.svelte"
	import WotScore from "src/partials/WotScore.svelte"
	import PersonHandle from "src/app/shared/PersonHandle.svelte"
	import PersonAbout from "src/app/shared/PersonAbout.svelte"
	import {router} from "src/app/util"
	import {ensureProto, formatTimestampRelative} from "src/util/misc"
	import {stripProtocol} from "src/lib"
	import CopyValueSimple from "src/partials/CopyValueSimple.svelte"
	import {nip19} from "nostr-tools"

	export let pubkey

	const handle = deriveHandleForPubkey(pubkey)
	const wotScore = getUserWotScore(pubkey)
	const profile = deriveProfile(pubkey, {relays: []})
	const profileDisplay = deriveProfileDisplay(pubkey)
	const showPerson = () => router.at("people").of(pubkey).open()

	$: zapLink = router
	  .at("zap")
	  .qp({splits: [tagZapSplit(pubkey)]})
	  .toString()
	$: following = $userFollows.has(pubkey)
	$: zapDisplay = $profile?.lud16 || $profile?.lud06
	$: accent = following || pubkey === $session?.pubkey
	$: profileUpdated = $profilesByPubkey.get(pubkey)?.event?.created_at
</script>

<div on:click|stopPropagation>
	<Popover opts={{hideOnClick: true}} placement="right" triggerType="mouseenter">
		<div slot="trigger">
			<WotScore {accent} max={$maxWot} score={wotScore} />
		</div>
		<div class="p-4" slot="tooltip">
			<strong class="cursor-pointer font-bold" on:click={showPerson}>{$profileDisplay}</strong>
			{#if profileUpdated}
				<div class="text-neutral-400">Updated {formatTimestampRelative(profileUpdated)}</div>
			{/if}
			{#if $profile?.about}
				<PersonAbout class="mt-4 font-thin" {pubkey} />
			{/if}
			{#if $handle}
				<div class="mt-4 flex items-center gap-2 text-accent">
					<i class="fa fa-at" />
					<PersonHandle {pubkey} />
				</div>
			{/if}
			<Anchor class="mt-4 flex items-center gap-2" href={zapLink} modal>
				<i class="fa fa-bolt" />
				<div class="overflow-hidden overflow-ellipsis">
					{zapDisplay}
				</div>
			</Anchor>
			{#if $profile?.website}
				<Anchor
				  external
				  class="mt-4 flex items-center gap-2 overflow-hidden overflow-ellipsis whitespace-nowrap"
				  href={ensureProto($profile.website)}>
					<i class="fa fa-link text-accent" />
					{stripProtocol($profile.website)}
				</Anchor>
			{/if}
			<div class="mt-4 break-all">
				<span class="text-neutral-400">{nip19.npubEncode(pubkey)}</span>
				<CopyValueSimple class="!inline-flex pl-1" label="Npub" value={nip19.npubEncode(pubkey)} />
			</div>
			<div class="mt-4 flex items-center gap-2">
				<Anchor class="flex items-center gap-1" href="/help/web-of-trust" modal>
					WoT Score: {wotScore}
					<i class="fa fa-info-circle" />
				</Anchor>
			</div>
		</div>
	</Popover>
</div>
