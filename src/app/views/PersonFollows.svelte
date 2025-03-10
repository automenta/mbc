<script lang="ts">
	import {getListTags, getPubkeyTagValues} from "src/util"
	import {deriveFollows} from "src/app"
	import PersonList from "src/app/shared/PersonList.svelte"

	export let pubkey

	const follows = deriveFollows(pubkey)
</script>

<PersonList pubkeys={getPubkeyTagValues(getListTags($follows))} />
