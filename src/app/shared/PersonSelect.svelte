<script lang="ts">
	import {derived} from "svelte/store"
	import {uniq} from "@welshman/lib"
	import {profileSearch} from "@welshman/app"
	import {parseAnything} from "src/util/nostr"
	import SearchSelect from "src/partials/SearchSelect.svelte"
	import PersonBadge from "src/app/shared/PersonBadge.svelte"
	import PersonLink from "src/app/shared/PersonLink.svelte"
	import {createPeopleLoader} from "src/engine"

	export let value
	export let multiple = false
	export let autofocus = false
	export let onChange = null

	let input

	const {loading, load} = createPeopleLoader()

	const search = derived(profileSearch, $profileSearch => {
		return term => {
			load(term)

			parseAnything(term).then(result => {
				if (result?.type === "npub") {
					value = uniq(value.concat(result.data))
					input.clearTerm()
					onChange?.(value)
				}

				if (result?.type === "nprofile") {
					value = uniq(value.concat(result.data.pubkey))
					input.clearTerm()
					onChange?.(value)
				}
			})

			return $profileSearch.searchValues(term)
		}
	})
</script>

<SearchSelect
  {autofocus}
  bind:this={input}
  bind:value
  loading={$loading}
  {multiple}
  {onChange}
  search={$search}>
	<div let:context let:item slot="item">
		<div class="-mt-1">
			{#if context === "value"}
				<PersonLink underline={false} pubkey={item} />
			{:else}
				<PersonBadge inert pubkey={item} />
			{/if}
		</div>
	</div>
</SearchSelect>
