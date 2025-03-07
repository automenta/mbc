<script lang="ts">
	import {get, writable} from "svelte/store"
	import {extractPrivateKey, isKeyValid} from "src/util/nostr"
	import {addSession, getWriteRelayUrls, userRelaySelections} from "@welshman/app"
	import {getPubkey, makeSecret} from "@welshman/signer"
	import {router} from "src/app/util"
	import {createAndPublish, env, setOutboxPolicies} from "src/engine"
	import {PROFILE} from "@welshman/util"
	import Input from "src/partials/Input.svelte"

	let keyPairInput = ""
	let keyPairFile: File | null = null
	let privateKey = writable<string | null>(null)
	let error = writable<string | null>(null)
	// Initialize relays with a more explicit structure: { url: string, read: boolean }
	let relays = writable(env.DEFAULT_RELAYS.map(url => ({url, read: true})))
	// Use a Set to ensure uniqueness and then convert back to array
	let follows = writable(Array.from(new Set(env.DEFAULT_FOLLOWS)))
	let profileName = writable("") // Store profile name

	async function handleKeyPairInput() {
		error.set(null)
		const extractedKey = await extractPrivateKey(keyPairInput)

		if (extractedKey && isKeyValid(extractedKey)) {
			privateKey.set(extractedKey)
		} else {
			error.set("Invalid KeyPair format.")
			privateKey.set(null)
		}
	}

	async function handleKeyPairFile(event: Event) {
		error.set(null)
		keyPairFile = (event.target as HTMLInputElement).files[0]

		if (keyPairFile) {
			const reader = new FileReader()
			reader.onload = async (e) => {
				const fileContent = e.target.result as string
				const extractedKey = await extractPrivateKey(fileContent)

				if (extractedKey && isKeyValid(extractedKey)) {
					privateKey.set(extractedKey)
				} else {
					error.set("Invalid KeyPair file format.")
					privateKey.set(null)
				}
			}
			reader.readAsText(keyPairFile)
		}
	}

	function generateKeyPair() {
		error.set(null)
		const newSecret = makeSecret()
		if (isKeyValid(newSecret)) {
			privateKey.set(newSecret)
		} else {
			error.set("Failed to generate a valid KeyPair.")
			privateKey.set(null)
		}
	}

	async function register() {
		if ($privateKey) {
			try {
				const pubkey = getPubkey($privateKey)
				addSession({method: "nip01", secret: $privateKey, pubkey})

				// Publish relays - map back to the expected array format
				await setOutboxPolicies(() => get(relays).map(r => ["r", r.url]))

				// Publish Profile Metadata (Kind 0)
				if ($profileName) {
					await createAndPublish({
						kind: PROFILE,
						content: JSON.stringify({name: $profileName}),
						relays: getWriteRelayUrls($userRelaySelections),
						sk: $privateKey
					})
				}

				// Publish follows -  Do not publish follows during onboarding for now
				// const sk = $privateKey
				// await createAndPublish({
				//   kind: FOLLOWS,
				//   tags: get(follows).map(tagPubkey),
				//   relays: getWriteRelayUrls($userRelaySelections),
				//   sk,
				// });

				// Make sure our profile gets to the right relays
				broadcastUserData(getWriteRelayUrls($userRelaySelections))

				// Start our notifications listener
				listenForNotifications()
				setChecked("*")

				router.at("notes").replace() // Redirect to the main app view
			} catch (e) {
				error.set("Error creating session.")
			}
		} else {
			error.set("No valid KeyPair provided.")
		}
	}
</script>

<div>
	<h2>Signup/Register</h2>

	<p>Paste your KeyPair (NSEC, hex, or JSON):</p>
	<textarea bind:value={keyPairInput} onChange={handleKeyPairInput} />

	<p>Or upload a KeyPair file:</p>
	<input accept=".txt,.json" onChange={handleKeyPairFile} type="file" />

	<p>Or generate a new KeyPair:</p>
	<button onclick={generateKeyPair}>Generate KeyPair</button>

	{#if $privateKey}
		<h3>Set Profile Name (Optional)</h3>
		<Input placeholder="Profile Name" bind:value={$profileName} />
	{/if}


	<h3>Select Relays</h3>
	{#each get(relays) as relay (relay.url)}
		<label>
			<input type="checkbox" bind:checked={relay.read} />
			{relay.url}
		</label>
	{/each}

	{#if false}
		<h3>Select Initial Follows</h3>
		{#each get(follows) as follow, i (follow)}
			<label>
				<input type="checkbox" bind:checked={$follows[i]} disabled={true} hidden={true} />
				{follow}
			</label>
		{/each}
	{/if}


	{#if $error}
		<p class="error">{$error}</p>
	{/if}

	<button disabled={!$privateKey} onclick={register}>Register</button>
</div>
