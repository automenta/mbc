<script lang="ts">
	import {copyToClipboard} from "src/util/html"
	import QRCode from "src/partials/QRCode.svelte"
	import Input from "src/partials/Input.svelte"
	import {showInfo} from "src/partials/Toast.svelte"

	export let code

	const copy = () => {
		copyToClipboard(code)
		showInfo("Copied to clipboard!")
	}
</script>

<div class="rounded-xl border border-solid border-neutral-600 bg-neutral-800 p-2">
	<div class="m-auto flex max-w-sm flex-col gap-2">
		<QRCode {code} />
		<slot {copy} name="below">
			<Input value={code}>
				<button class="fa fa-copy" on:click={copy} slot="after" />
			</Input>
		</slot>
	</div>
</div>
