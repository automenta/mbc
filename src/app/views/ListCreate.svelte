<script lang="ts">
	import Subheading from "src/partials/Subheading.svelte"
	import ListForm from "src/app/shared/ListForm.svelte"
	import {router} from "src/app/util"
	import {makeUserList} from "src/domain"

	export let tags = []

	const list = makeUserList({tags})

	const hide = tags.length > 0 ? ["type"] : []

	const exit = () => router.clearModals()
</script>

<Subheading class="text-center">Create list</Subheading>
<ListForm {exit} {hide} {list} />
