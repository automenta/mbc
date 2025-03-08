<script lang="ts">
	import {last} from "@welshman/lib"

	export let url

	const {pathname} = new URL(url)
	const id = last(pathname.split("/"))
	const name = pathname.includes("album") ? "albums" : "tracks"
	const src = `https://embed.tidal.com/${name}/${id}`
</script>

<iframe
  allow="encrypted-media"
  allowfullscreen
  frameBorder="0"
  height="100%"
  loading="lazy"
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
  scrolling="no"
  {src}
  style="border-radius:12px"
  title="TIDAL Embed Player"
  width="100%" />
