<script lang="ts">
	import {ctx, equals, identity} from "src/lib"
	import {MUTES} from "src/util"
	import {tagPubkey, topicSearch} from "src/app"
	import {appName} from "src/partials/state"
	import {showInfo} from "src/partials/Toast.svelte"
	import Input from "src/partials/Input.svelte"
	import Field from "src/partials/Field.svelte"
	import Footer from "src/partials/Footer.svelte"
	import FieldInline from "src/partials/FieldInline.svelte"
	import Toggle from "src/partials/Toggle.svelte"
	import SelectButton from "src/partials/SelectButton.svelte"
	import WorkEstimate from "src/partials/WorkEstimate.svelte"
	import Anchor from "src/partials/Anchor.svelte"
	import SearchSelect from "src/partials/SearchSelect.svelte"
	import Heading from "src/partials/Heading.svelte"
	import PersonSelect from "src/app/shared/PersonSelect.svelte"
	import {createAndPublish, publishSettings, userMutes, userSettings} from "src/engine"

	const values = {...$userSettings}

	const noteActionOptions = ["zaps", "replies", "reactions", "recommended_apps"]

	const submit = () => {
		if (!equals($userSettings, values)) {
			publishSettings(values)
		}

		if (!equals(mutedPubkeys, Array.from($userMutes))) {
			createAndPublish({
				kind: MUTES,
				tags: mutedPubkeys.map(pk => tagPubkey(pk)),
				relays: ctx.app.router.FromUser().getUrls()
			})
		}

		showInfo("Your preferences have been saved!")
	}

	let mutedPubkeys = Array.from($userMutes)

	document.title = "Content Preferences"
</script>

<form on:submit|preventDefault={submit}>
	<div class="mb-4 flex flex-col items-center justify-center">
		<Heading>Content Settings</Heading>
		<p>Control who and what you see on {appName}.</p>
	</div>
	<div class="flex w-full flex-col gap-8">
		<Field label="Note actions">
			<SelectButton bind:value={values.note_actions} multiple options={noteActionOptions} />
			<p slot="info">
				Controls which icons appear at the bottom of any given note. Disabling these can reduce how
				much data {appName} uses.
			</p>
		</Field>
		<FieldInline label="Show images and link previews">
			<Toggle bind:value={values.show_media} />
			<p slot="info">
				If enabled, {appName} will automatically show images and previews for embedded links.
			</p>
		</FieldInline>
		<FieldInline label="Hide sensitive content">
			<Toggle bind:value={values.hide_sensitive} />
			<p slot="info">
				If enabled, content flagged by the author as potentially sensitive will be hidden.
			</p>
		</FieldInline>

		<Field>
			<div class="flex justify-between" slot="label">
				<strong>Minimum WoT score</strong>
				<div>{values.min_wot_score}</div>
			</div>
			<Input bind:value={values.min_wot_score} max={10} min={-10} type="range" />
			<p slot="info">
				Select a minimum
				<Anchor href="/help/web-of-trust" modal underline>web-of-trust</Anchor>
				score. Notes from accounts with a lower score will be automatically hidden.
			</p>
		</Field>
		<Field>
			<div class="flex justify-between" slot="label">
				<strong>Minimum Proof of Work</strong>
				<div>
					difficulty {values.min_pow_difficulty} (
					<WorkEstimate
					  difficulty={values.min_pow_difficulty} />
					)
				</div>
			</div>
			<Input bind:value={values.min_pow_difficulty} max={32} min={0} type="range" />
			<p slot="info">
				Select a minimum proof-of-work difficulty for notes from people outside your network. If a
				note fails to meet both your minimum web of trust score and minimum proof-of-work
				difficulty, it will be hidden.
			</p>
		</Field>
		<Field label="Muted accounts">
			<PersonSelect bind:value={mutedPubkeys} multiple />
			<p slot="info">Notes from these people will be hidden by default.</p>
		</Field>
		<Field label="Muted words and topics">
			<SearchSelect
			  bind:value={values.muted_words}
			  multiple
			  search={$topicSearch.searchValues}
			  termToItem={identity} />
			<p slot="info">Notes containing these words will be hidden by default.</p>
		</Field>
		<FieldInline label="Ignore muted content">
			<Toggle bind:value={values.ignore_muted_content} />
			<p slot="info">If enabled, muted replies will be ignored.</p>
		</FieldInline>
	</div>
	<Footer>
		<Anchor button grow tag="button" type="submit">Save</Anchor>
	</Footer>
</form>
