<script lang="ts">
	import {ctx, identity} from "@welshman/lib"
	import {pubkey, topicSearch} from "@welshman/app"
	import {showInfo, showWarning} from "src/partials/Toast.svelte"
	import Heading from "src/partials/Heading.svelte"
	import FlexColumn from "src/partials/FlexColumn.svelte"
	import Anchor from "src/partials/Anchor.svelte"
	import Field from "src/partials/Field.svelte"
	import SearchSelect from "src/partials/SearchSelect.svelte"
	import SelectButton from "src/partials/SelectButton.svelte"
	import {router} from "src/app/util/router"
	import {collectionSearch, createAndPublish, deriveCollections, getClientTags, loadLabels} from "src/engine"

	export let id

	const collections = deriveCollections($pubkey)

	const onTopicChange = name => {
		if (name) {
			topicInput.clear()
			names = names.concat(name)
			options = options.concat(name)
		}
	}

	const onNamesChange = newNames => {
		names = newNames
	}

	const submit = () => {
		if (names.length === 0) {
			return showWarning("Please select at least one collection.")
		}

		createAndPublish({
			kind: 1985,
			relays: ctx.app.router.FromUser().getUrls(),
			tags: [["e", id], ["L", "#t"], ...names.map(name => ["l", name, "#t"]), ...getClientTags()]
		})

		showInfo("Your tag has been saved!")
		router.pop()
	}

	let topicInput
	let names = []

	$: options = $collections.map(c => c.name)

	loadLabels([$pubkey])
</script>

<form on:submit|preventDefault={submit}>
	<FlexColumn>
		<Heading class="text-center">Add to collection</Heading>
		<p class="text-center">
			Add this note to your collections. You can find your collections on your profile page.
		</p>
		<SelectButton
		  displayOption={$collectionSearch.displayValue}
		  multiple
		  onChange={onNamesChange}
		  {options}
		  value={names} />
		<div class="flex w-full flex-col gap-8">
			<Field label="Collections">
				<SearchSelect
				  bind:this={topicInput}
				  onChange={onTopicChange}
				  search={$topicSearch.searchValues}
				  termToItem={identity} />
				<div slot="info">Search for existing topics, or create your own.</div>
			</Field>
		</div>
		<div class="flex justify-end">
			<Anchor button tag="button" type="submit">Save</Anchor>
		</div>
	</FlexColumn>
</form>
