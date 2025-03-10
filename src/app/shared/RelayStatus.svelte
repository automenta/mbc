<script lang="ts">
	import {onMount} from "svelte"
	import {ctx} from "src/lib"
	import Popover from "src/partials/Popover.svelte"
	import {ConnectionType, displayConnectionType, getConnectionStatus} from "src/domain/connection"

	export let url

	let status = ConnectionType.NotConnected

	onMount(() => {
		const interval = setInterval(() => {
			status = getConnectionStatus(ctx.net.pool.get(url))
		}, 800)

		return () => clearInterval(interval)
	})
</script>

<Popover triggerType="mouseenter">
	<div
	  class="h-2 w-2 cursor-pointer rounded-full bg-neutral-600"
	  class:bg-danger={[ConnectionType.LoginFailed, ConnectionType.ConnectFailed].includes(status)}
	  class:bg-neutral-600={ConnectionType.NotConnected === status}
	  class:bg-success={ConnectionType.Connected === status}
	  class:bg-warning={[
      ConnectionType.Logging,
      ConnectionType.WaitReconnect,
      ConnectionType.UnstableConnection,
    ].includes(status)}
	  slot="trigger" />
	<div class="transition-all sm:block" slot="tooltip">
		{displayConnectionType(status)}
	</div>
</Popover>
