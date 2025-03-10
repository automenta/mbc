<script lang="ts">
	import {prop} from "src/lib"
	import {fuzzy} from "src/util/misc"
	import {currencyOptions} from "src/util/i18n"
	import SearchSelect from "src/partials/SearchSelect.svelte"
	import Input from "src/partials/Input.svelte"

	export let value

	const getKey = prop("code")
	const termToItem = code => ({name: code, code})
	const search = fuzzy(currencyOptions, {keys: ["name", "code"], threshold: 0.4})
	const defaultCodes = ["BTC", "SAT", "USD", "GBP", "AUD", "CAD"]
	const defaultOptions = currencyOptions.filter(c => defaultCodes.includes(c.code))
</script>

<Input {...$$props} bind:value={value} type="currency">
  <span slot="before">
    <i class="fa fa-right-left" />
  </span>
	<SearchSelect bind:value {defaultOptions} {getKey} {search} slot="after" {termToItem}>
		<div let:item slot="item">
			{item.name} ({item.code})
		</div>
	</SearchSelect>
</Input>
