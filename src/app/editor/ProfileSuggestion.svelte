<script lang="ts">
	import {displayPubkey, getListTags, getPubkeyTagValues} from "@welshman/util"
	import {
		deriveHandleForPubkey,
		deriveProfileDisplay,
		deriveUserWotScore,
		displayHandle,
		userFollows
	} from "@welshman/app"
	import WotScore from "src/partials/WotScore.svelte"
	import PersonCircle from "src/app/shared/PersonCircle.svelte"

	export let value

	const pubkey = value
	const profileDisplay = deriveProfileDisplay(pubkey)
	const handle = deriveHandleForPubkey(pubkey)
	const score = deriveUserWotScore(pubkey)

	$: following = getPubkeyTagValues(getListTags($userFollows)).includes(pubkey)
</script>

<div class="flex max-w-full gap-3">
	<div class="py-1">
		<PersonCircle class="h-10 w-10" {pubkey} />
	</div>
	<div class="flex min-w-0 flex-col">
		<div class="flex items-center gap-2">
			<div class="text-bold overflow-hidden text-ellipsis text-base">
				{$profileDisplay}
			</div>
			<WotScore accent={following} score={$score} />
		</div>
		<div class="overflow-hidden text-ellipsis text-sm opacity-75">
			{$handle ? displayHandle($handle) : displayPubkey(pubkey)}
		</div>
	</div>
</div>
