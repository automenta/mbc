<script lang="ts">
	import cx from "classnames"

	export let gap = "gap-6"
	export let size = "2xl"

	const className = `flex flex-col flex-grow m-auto text-neutral-100 ${gap}`

	if (!["inherit", "lg", "2xl"].includes(size)) {
		throw new Error(`Invalid size: ${size}`)
	}
</script>

{#if size === "inherit"}
	<div {...$$props} class={cx($$props.class, className, "w-full")}>
		<slot />
	</div>
{/if}

{#if size === "lg"}
	<div {...$$props} class={cx($$props.class, className, "w-full max-w-lg p-2 py-8")}>
		<slot />
	</div>
{/if}

{#if size === "2xl"}
	<div {...$$props} class={cx($$props.class, className, "w-full max-w-2xl p-4")}>
		<slot />
	</div>
{/if}
