<script lang="ts">
	import {FeedType} from "@welshman/feeds"
	import {displayProfileByPubkey, profileSearch} from "@welshman/app"
	import Anchor from "src/partials/Anchor.svelte"
	import SearchSelect from "src/partials/SearchSelect.svelte"
	import PersonBadge from "src/app/shared/PersonBadge.svelte"
	import {router} from "src/app/util/router"

	export let feed
	export let onChange
</script>

<span class=" text-lg">Which mentions would you like to see?</span>
<SearchSelect
  multiple
  onChange={pubkeys => onChange([FeedType.Tag, "#p", ...pubkeys])}
  search={$profileSearch.searchValues}
  value={feed.slice(2)}>
  <span let:context let:item slot="item">
    {#if context === "value"}
      <Anchor modal href={router.at("people").of(item).toString()}>
        {displayProfileByPubkey(item)}
      </Anchor>
    {:else}
      <PersonBadge inert pubkey={item} />
    {/if}
  </span>
</SearchSelect>
