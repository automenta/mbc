<script lang="ts">
	import Input from "src/partials/Input.svelte"

	export let value
	export let onChange = null
	export let dark = false
</script>

<Input {...$$props} bind:value={value} dark={dark} on:change={() => onChange && onChange(value)} type="select">
	<slot />
	<slot name="before" slot="before" />
	<slot name="after" slot="after" />
</Input>
