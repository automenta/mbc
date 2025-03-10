<script lang="ts">
	import {FeedType} from "src/feeds"
	import Input from "src/partials/Input.svelte"

	export let feed
	export let onChange

	const onInput = e => onChange([FeedType.Search, e.target.value!])
</script>

<span class=" text-lg">Which would you like to search for?</span>
<Input on:input={onInput} value={feed[1]} />
