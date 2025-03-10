<script lang="ts">
	import {makeListFeed} from "src/feeds"
	import {displayProfileByPubkey, repository} from "src/app"
	import Anchor from "src/partials/Anchor.svelte"
	import SearchSelect from "src/partials/SearchSelect.svelte"
	import {listSearch} from "src/engine"
	import {router} from "src/app/util"

	export let feed
	export let onChange

	const onAddressesChange = addresses => onChange(makeListFeed({addresses}))

	const displayAddress = address => {
		const event = repository.getEvent(address)

		return event
		  ? `${$listSearch.displayValue(address)} by ${displayProfileByPubkey(event.pubkey)}`
		  : $listSearch.displayValue(address)
	}

	$: addresses = feed.slice(1).flatMap(it => it.addresses)
</script>

<span class=" text-lg">Which lists would you like to use?</span>
<SearchSelect
  multiple
  onChange={onAddressesChange}
  search={$listSearch.searchValues}
  value={addresses}>
  <span let:context let:item slot="item">
    {#if context === "option"}
      {displayAddress(item)}
    {:else}
      <Anchor modal href={router.at("lists").of(item).toString()}>
        {displayAddress(item)}
      </Anchor>
    {/if}
  </span>
</SearchSelect>
