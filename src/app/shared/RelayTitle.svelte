<script lang="ts">
	import {displayRelayUrl} from "@welshman/util"
	import {hsl, stringToHue} from "src/util/misc"
	import Rating from "src/partials/Rating.svelte"
	import Anchor from "src/partials/Anchor.svelte"
	import RelayStatus from "src/app/shared/RelayStatus.svelte"
	import {router} from "src/app/util/router"

	export let url
	export let rating = null
</script>

<div class="flex items-center gap-2 text-xl">
	<i class={url.startsWith("wss") ? "fa fa-lock" : "fa fa-unlock"} />
	<Anchor
	  class="border-b border-solid"
	  href={router.at("relays").of(url).toString()}
	  style={`border-color: ${hsl(stringToHue(url))}`}
	  type="unstyled">
		{displayRelayUrl(url)}
	</Anchor>
	<RelayStatus {url} />
	{#if rating}
		<div class="px-4 text-sm">
			<Rating inert value={rating} />
		</div>
	{/if}
</div>
