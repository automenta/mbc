<script lang="ts">
	import cx from "classnames"
	import Card from "src/partials/Card.svelte"
</script>

<Card
  class={cx($$props.class, "overflow-hidden border border-solid border-neutral-600 shadow-lg")}
  noPad>
	<slot />
</Card>
