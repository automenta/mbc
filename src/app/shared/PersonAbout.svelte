<script lang="ts">
	import {deriveProfile} from "src/app"
	import NoteContentKind1 from "src/app/shared/NoteContentKind1.svelte"

	export let pubkey
	export let truncate = false

	const profile = deriveProfile(pubkey)
</script>

<NoteContentKind1
  class={$$props.class}
  expandable={false}
  maxLength={300}
  minLength={200}
  note={{content: $profile?.about || "", tags: []}}
  showEntire={!truncate} />
