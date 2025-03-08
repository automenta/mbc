<script lang="ts">
	import {identity} from "@welshman/lib"
	import {FeedType} from "@welshman/feeds"
	import {relaySearch} from "@welshman/app"
	import {displayRelayUrl} from "@welshman/util"
	import SearchSelect from "src/partials/SearchSelect.svelte"

	export let feed
	export let onChange
</script>

<span class=" text-lg">Which relays would you like to use?</span>
<SearchSelect
  multiple
  onChange={urls => onChange([FeedType.Relay, ...urls])}
  search={$relaySearch.searchValues}
  termToItem={identity}
  value={feed.slice(1)}>
	<span let:item slot="item">{displayRelayUrl(item)}</span>
</SearchSelect>
