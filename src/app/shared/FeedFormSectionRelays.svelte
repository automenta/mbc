<script lang="ts">
	import {identity} from "src/lib"
	import {FeedType} from "src/feeds"
	import {relaySearch} from "src/app"
	import {displayRelayUrl} from "src/util"
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
