<script lang="ts">
	import cx from "classnames"
	import {onMount} from "svelte"

	export let background = false

	let element, isAlt

	onMount(() => {
		let cur = element
		let count = 0
		while (cur.parentElement) {
			if (cur.parentElement.classList.contains("bg-swap-bg")) {
				count++
			}

			cur = cur.parentElement
		}

		isAlt = count % 2 === 0
	})
</script>

<div
  bind:this={element}
  class={cx("bg-swap", $$props.class)}
  class:bg-neutral-800={background && !isAlt}
  class:bg-swap-bg={background}
  class:bg-tinted-700={background && isAlt}
  on:click>
	<slot {isAlt} />
</div>
