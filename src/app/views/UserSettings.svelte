<script lang="ts">
	import {identity} from "@welshman/lib"
	import {appName} from "src/partials/state"
	import {showInfo} from "src/partials/Toast.svelte"
	import Field from "src/partials/Field.svelte"
	import Footer from "src/partials/Footer.svelte"
	import FieldInline from "src/partials/FieldInline.svelte"
	import Toggle from "src/partials/Toggle.svelte"
	import Input from "src/partials/Input.svelte"
	import Anchor from "src/partials/Anchor.svelte"
	import Heading from "src/partials/Heading.svelte"
	import {fuzzy, pluralize} from "src/util/misc"
	import WorkEstimate from "src/partials/WorkEstimate.svelte"
	import SearchSelect from "src/partials/SearchSelect.svelte"
	import {env, publishSettings, userSettings} from "src/engine"
	import Select from "src/partials/Select.svelte"

	const values = {...$userSettings}

	const submit = () => {
		publishSettings({...values})

		showInfo("Your settings have been saved!")
	}

	const searchNIP96Providers = fuzzy(env.NIP96_URLS, {keys: ["url"]})
	const searchBlossomProviders = fuzzy(env.BLOSSOM_URLS, {keys: ["url"]})

	const formatPercent = d => String(Math.round(d * 100))
	const parsePercent = p => parseInt(p) / 100

	document.title = "Settings"
</script>

<form on:submit|preventDefault={submit}>
	<div class="mb-4 flex flex-col items-center justify-center">
		<Heading>App Settings</Heading>
		<p>Make {appName} work the way you want it to.</p>
	</div>
	<div class="flex w-full flex-col gap-8">
		<Field label="Default zap amount">
			<Input bind:value={values.default_zap}>
				<i class="fa fa-bolt" slot="before" />
			</Input>
			<p slot="info">The default amount of sats to use when sending a lightning tip.</p>
		</Field>
		<Field label="Platform zap split">
			<Input
			  bind:value={values.platform_zap_split}
			  format={formatPercent}
			  parse={parsePercent}
			  type="number">
				<i class="fa fa-percent" slot="before" />
			</Input>
			<p slot="info">
				How much you'd like to tip the developer of {appName} whenever you send a zap.
			</p>
		</Field>
		<Field>
			<div class="flex justify-between" slot="label">
				<strong>Send Delay</strong>
				<div>{values.send_delay / 1000} {pluralize(values.send_delay / 1000, "second")}</div>
			</div>
			<Input bind:value={values.send_delay} max={15_000} min={0} step="1000" type="range"></Input>
			<p slot="info">A delay period allowing you to cancel a reply or note creation, in seconds.</p>
		</Field>
		<Field>
			<div class="flex justify-between" slot="label">
				<strong>Proof Of Work</strong>
				<div>
					difficulty {values.pow_difficulty} (
					<WorkEstimate difficulty={values.pow_difficulty} />
					)
				</div>
			</div>
			<Input bind:value={values.pow_difficulty} max={32} min={0} step="1" type="range"></Input>
			<p slot="info">Add a proof-of-work stamp to your notes to increase your reach.</p>
		</Field>
		<Field>
			<div class="flex justify-between" slot="label">
				<strong>Max relays per request</strong>
				<div>{values.relay_limit} relays</div>
			</div>
			<Input bind:value={values.relay_limit} max={30} min={1} parse={parseInt} type="range" />
			<p slot="info">
				This controls how many relays to max out at when loading feeds and event context. More is
				faster, but will require more bandwidth and processing power.
			</p>
		</Field>
		{#if env.PLATFORM_RELAYS.length === 0}
			<FieldInline label="Authenticate with relays">
				<Toggle bind:value={values.auto_authenticate} />
				<p slot="info">
					Allows {appName} to authenticate with relays that have access controls automatically.
				</p>
			</FieldInline>
		{/if}
		<Field label="Upload Type">
			<p slot="info">
				Choose an upload type for your files, default is nip-96 but blossom is also supported.
			</p>
			<div class="flex items-center rounded-md px-2 text-neutral-600 dark:bg-neutral-100">
				<i class="fa-solid fa-cloud-upload-alt" />
				<Select
				  bind:value={values.upload_type}
				  class="w-full dark:!bg-neutral-100 dark:!text-neutral-900"
				  dark={false}>
					<option value="nip96">NIP-96</option>
					<option value="blossom">Blossom</option>
				</Select>
			</div>
		</Field>
		{#if values.upload_type === "nip96"}
			<Field label="NIP96 Provider URLs">
				<p slot="info">
					Enter one or more urls for nostr media servers. You can find a full list of NIP-96
					compatible servers
					<Anchor underline href="https://github.com/quentintaranpino/NIP96-compatible-servers"
					>here
					</Anchor>
				</p>
				<SearchSelect
				  multiple
				  search={searchNIP96Providers}
				  bind:value={values.nip96_urls}
				  termToItem={identity}>
					<div slot="item" let:item>
						<strong>{item}</strong>
					</div>
				</SearchSelect>
			</Field>
		{:else}
			<Field label="Blossom Provider URLs">
				<p slot="info">Enter one or more urls for blossom compatible nostr media servers.</p>
				<SearchSelect
				  multiple
				  search={searchBlossomProviders}
				  bind:value={values.blossom_urls}
				  termToItem={identity}>
					<div slot="item" let:item>
						<strong>{item}</strong>
					</div>
				</SearchSelect>
			</Field>
		{/if}
		<Field label="Dufflepud URL">
			<Input bind:value={values.dufflepud_url}>
				<i class="fa-solid fa-server" slot="before" />
			</Input>
			<p slot="info">
				Enter a custom url for {appName}'s helper application. Dufflepud is used for hosting images
				and loading link previews. You can find the source code
				<Anchor
				  href="https://github.com/coracle-social/dufflepud"
				  underline>here
				</Anchor
				>
				.
			</p>
		</Field>
		<Field label="Imgproxy URL">
			<Input bind:value={values.imgproxy_url}>
				<i class="fa-solid fa-image" slot="before" />
			</Input>
			<p slot="info">
				Enter a custom imgproxy url for resizing images on the fly to reduce bandwidth and improve
				privacy. You can set up your own proxy
				<Anchor href="https://imgproxy.net/" underline
				>here
				</Anchor
				>
				.
			</p>
		</Field>
		<FieldInline label="Report errors and analytics">
			<Toggle bind:value={values.report_analytics} />
			<p slot="info">
				Keep this enabled if you would like developers to be able to know what features are used,
				and to diagnose and fix bugs.
			</p>
		</FieldInline>
		<FieldInline label="Enable client fingerprinting">
			<Toggle bind:value={values.enable_client_tag} />
			<p slot="info">
				If this is turned on, public notes you create will have a "client" tag added. This helps
				with troubleshooting, and allows other people to find out about {appName}.
			</p>
		</FieldInline>
	</div>
	<Footer>
		<Anchor button grow tag="button" type="submit">Save</Anchor>
	</Footer>
</form>
