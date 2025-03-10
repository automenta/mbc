<script lang="ts">
	import {profilesByPubkey, pubkey} from "src/app"
	import Input from "src/partials/Input.svelte"
	import FlexColumn from "src/partials/FlexColumn.svelte"
	import Card from "src/partials/Card.svelte"
	import ImageInput from "src/partials/ImageInput.svelte"
	import Textarea from "src/partials/Textarea.svelte"
	import Anchor from "src/partials/Anchor.svelte"
	import Footer from "src/partials/Footer.svelte"
	import Heading from "src/partials/Heading.svelte"
	import Modal from "src/partials/Modal.svelte"
	import Field from "src/partials/Field.svelte"
	import {env, publishProfile} from "src/engine"
	import {router} from "src/app/util/router"

	const nip05Url = "https://github.com/nostr-protocol/nips/blob/master/05.md"
	const lud16Url = "https://lightningaddress.com/"
	const pseudUrl =
	  "https://www.coindesk.com/markets/2020/06/29/many-bitcoin-developers-are-choosing-to-use-pseudonyms-for-good-reason/"

	const closeModal = () => {
		modal = null
	}

	const publishToPlatform = () => {
		publishProfile(values, {forcePlatform: true})
		router.pop()
	}

	const publishToNetwork = () => {
		publishProfile(values, {forcePlatform: false})
		router.pop()
	}

	const submit = () => {
		if (env.PLATFORM_RELAYS.length === 0) {
			publishToNetwork()
		} else {
			modal = "select-scope"
		}
	}

	const values = {...$profilesByPubkey.get($pubkey)}

	let modal

	document.title = "Profile"
</script>

<form class="relative" on:submit|preventDefault={submit}>
	<div class="mb-4 flex flex-col items-center justify-center">
		<Heading>About You</Heading>
		<p>
			Give people a friendly way to recognize you. We recommend you do not use your real name or
			share your personal information. The future of the internet is
			<Anchor external href={pseudUrl} underline>pseudonymous</Anchor>
			.
		</p>
	</div>
	<div class="flex w-full flex-col gap-8">
		<Field label="Username">
			<Input bind:value={values.name} class="flex-grow" name="name" type="text">
				<i class="fa-solid fa-user-astronaut" slot="before" />
			</Input>
			<div slot="info">In most clients, this image will be shown on your profile page.</div>
		</Field>
		<Field label="NIP-05 Identifier">
			<Input bind:value={values.nip05} class="flex-grow" name="name" type="text">
				<i class="fa-solid fa-user-check" slot="before" />
			</Input>
			<div slot="info">
				Enter a
				<Anchor external href={nip05Url} underline>NIP-05</Anchor>
				address to verify your public
				key.
			</div>
		</Field>
		<Field label="Lightning address">
			<Input bind:value={values.lud16} class="flex-grow" name="name" type="text">
				<i class="fa-solid fa-bolt" slot="before" />
			</Input>
			<div slot="info">
				Enter a
				<Anchor external href={lud16Url} underline>lightning address</Anchor>
				to enable sending
				and receiving bitcoin tips.
			</div>
		</Field>
		<Field label="Website">
			<Input bind:value={values.website} class="flex-grow" name="name" type="text">
				<i class="fa-solid fa-link" slot="before" />
			</Input>
			<div slot="info">Enter any url where people can find out more about you.</div>
		</Field>
		<Field label="About you">
			<Textarea bind:value={values.about} name="about" />
			<div slot="info">Tell the world about yourself. This will be shown on your profile page.</div>
		</Field>
		<Field label="Profile Picture">
			<ImageInput
			  bind:value={values.picture}
			  icon="image-portrait"
			  maxHeight={480}
			  maxWidth={480} />
			<p slot="info">Please be mindful of others and only use small images.</p>
		</Field>
		<Field label="Profile Banner">
			<ImageInput bind:value={values.banner} icon="panorama" />
			<div slot="info">In most clients, this image will be shown on your profile page.</div>
		</Field>
	</div>
	<Footer>
		<Anchor button grow tag="button" type="submit">Save</Anchor>
	</Footer>
</form>

{#if modal === "select-scope"}
	<Modal onEscape={closeModal}>
		<div class="mb-4 flex flex-col items-center justify-center">
			<Heading>Update Profile</Heading>
			<p>Where would you like to publish your profile?</p>
		</div>
		<Card interactive on:click={publishToNetwork}>
			<FlexColumn>
				<div class="flex items-center justify-between">
					<p class="flex items-center gap-4 text-xl">
						<i class="fa fa-share-nodes text-neutral-600" />
						<strong>The wider nostr network</strong>
					</p>
					<i class="fa fa-arrow-right" />
				</div>
				<p>
					Publishing your profile to the wider nostr network will allow anyone to see it. Use this
					if you plan to use other clients or relay selections.
				</p>
			</FlexColumn>
		</Card>
		<Card interactive on:click={publishToPlatform}>
			<FlexColumn>
				<div class="flex items-center justify-between">
					<p class="flex items-center gap-4 text-xl">
						<i class="fa fa-thumbtack text-neutral-600" />
						<strong>Just this instance</strong>
					</p>
					<i class="fa fa-arrow-right" />
				</div>
				<p>
					Publish your profile just to the relays configured on this instance if you prefer. Be
					aware that how private this is depends on how the instance operator has set things up.
				</p>
			</FlexColumn>
		</Card>
	</Modal>
{/if}
