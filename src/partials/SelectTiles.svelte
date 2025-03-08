<script lang="ts">
	import cx from "classnames"
	import Tile from "src/partials/Tile.svelte"
	import SelectList from "src/partials/SelectList.svelte"

	const getClass = active =>
	  cx("transition-all", {
		  "bg-tinted-500 dark:bg-tinted-600 text-tinted-800": !active,
		  "bg-white dark:bg-tinted-200 dark:text-neutral-900": active
	  })
</script>

<SelectList {...$$props} class={cx("grid justify-between gap-4", $$props.class)}>
	<div let:active let:i let:option slot="item">
		<Tile class={getClass(active)}>
			<slot {active} name="item" {option} />
		</Tile>
	</div>
</SelectList>
