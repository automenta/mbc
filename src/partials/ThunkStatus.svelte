<script lang="ts">
	import {ne, omit} from "src/lib"
	import type {Thunk} from "src/app"
	import {PublishStatus} from "src/net"
	import {LOCAL_RELAY_URL} from "src/util"
	import Anchor from "src/partials/Anchor.svelte"

	export let thunk: Thunk

	$: status = thunk.status
	$: relays = thunk.request.relays.filter(ne(LOCAL_RELAY_URL))
	$: statuses = Object.values(omit([LOCAL_RELAY_URL], $status || {}))
	$: total = relays.length
	$: pending = statuses.filter(s => s.status === PublishStatus.Pending).length
</script>

<div>
	Published to {total - pending}/{total} relays.
	<Anchor href="/publishes" modal underline>View details</Anchor>
</div>
