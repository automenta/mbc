<script lang="ts">
	import {displayUrl} from "src/util/misc"

	export let url: string
	export let onClick: (url: string, event: any) => void

	const _onClick = (e: any) => onClick(url, e)
</script>

<a
  class="overflow-hidden text-ellipsis whitespace-nowrap underline"
  href={url}
  on:click|preventDefault|stopPropagation={_onClick}>
	{displayUrl(url)}
</a>
