<script lang="ts">
	import {identity} from "@welshman/lib"
	import {FeedType} from "@welshman/feeds"
	import {topicSearch} from "@welshman/app"
	import SearchSelect from "src/partials/SearchSelect.svelte"

	export let feed
	export let onChange
</script>

<span class=" text-lg">Which topics do you want to see?</span>
<SearchSelect
  multiple
  onChange={topics => onChange([FeedType.Tag, "#t", ...topics])}
  search={$topicSearch.searchValues}
  termToItem={identity}
  value={feed.slice(2)}>
	<span let:item slot="item">#{item}</span>
</SearchSelect>
