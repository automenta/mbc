<script lang="ts">
	import cx from "classnames"
	import SelectList from "src/partials/SelectList.svelte"

	export let value = null
	export let displayOption = x => x

	const getClassName = active =>
	  cx("px-4 h-6 transition-all rounded-full mr-2 mb-2 inline-block items-center", {
		  "bg-neutral-900 dark:bg-tinted-100 text-accent": active,
		  "bg-neutral-900 text-neutral-400": !active
	  })
</script>

<div class={cx($$props.class, "-mb-2 inline-block")}>
	<SelectList {...$$props} bind:value optionClass=" inline-block">
		<div class={getClassName(active)} let:active let:i let:option slot="item">
			<slot {active} name="item" {option}>
				{displayOption(option)}
			</slot>
		</div>
	</SelectList>
</div>
