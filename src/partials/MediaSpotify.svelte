<script lang="ts">
	import {last} from "src/lib"

	export let url

	const id = last(url.split("?")[0].match(/[a-z]+\/[0-9A-z]+$/))
	const src = `https://open.spotify.com/embed/${id}`
</script>

<iframe
  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
  allowfullscreen
  frameBorder="0"
  height="352"
  loading="lazy"
  {src}
  style="border-radius:12px"
  width="100%" />
