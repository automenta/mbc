<script lang="ts">
	import {derived} from "svelte/store"
	import {MINUTE, now, omit} from "@welshman/lib"
	import {LOCAL_RELAY_URL} from "@welshman/util"
	import {PublishStatus} from "@welshman/net"
	import {
		deriveProfileDisplay,
		displayProfileByPubkey,
		pubkey,
		sessions,
		signer,
		type Thunk,
		thunks
	} from "@welshman/app"
	import {toggleTheme} from "src/partials/state"
	import MenuItem from "src/partials/MenuItem.svelte"
	import FlexColumn from "src/partials/FlexColumn.svelte"
	import Anchor from "src/partials/Anchor.svelte"
	import PersonCircle from "src/app/shared/PersonCircle.svelte"
	import PersonHandle from "src/app/shared/PersonHandle.svelte"
	import MenuDesktopItem from "src/app/MenuDesktopItem.svelte"
	import MenuDesktopSecondary from "src/app/MenuDesktopSecondary.svelte"
	import {slowConnections} from "src/app/state"
	import {router} from "src/app/util/router"
	import {env, hasNewMessages, hasNewNotifications} from "src/engine"

	const {page} = router

	$: recent = () => {
		const n = now()
		return (Object.values($thunks) as Thunk[]).filter(
		  t => t.event.pubkey === $pubkey && t.event.created_at > n - 5 * MINUTE
		)
	}


	$: hud = derived(
	  recent().map(t => t.status),
	  $statuses => {
		  let pending = 0
		  let success = 0
		  let failure = 0

		  for (const status of $statuses) {
			  const statuses = Object.values(omit([LOCAL_RELAY_URL], status))
			  const pubStatus = statuses.map(s => s.status)

			  if (statuses.length === 0 || pubStatus.includes(PublishStatus.Pending)) {
				  pending += 1
			  } else if (pubStatus.includes(PublishStatus.Success)) {
				  success += 1
			  } else {
				  failure += 1
			  }
		  }

		  return {pending, success, failure}
	  }
	)

	const closeSubMenu = () => {
		subMenu = null
	}

	const setSubMenu = name => {
		setTimeout(
		  () => {
			  subMenu = name
		  },
		  subMenu ? 100 : 0
		)
	}

	let subMenu

	$: isFeedPage = Boolean($page?.path.match(/^\/(notes)?$/))
	$: isListPage = Boolean($page?.path.match(/^\/(lists)?$/))
	$: userDisplay = deriveProfileDisplay($pubkey)
</script>

<div class="fixed bottom-0 left-0 top-0 z-sidebar w-72 bg-tinted-700 transition-colors">
	<MenuDesktopItem isActive={isFeedPage || isListPage} path="/notes">News</MenuDesktopItem>
	{#if env.PLATFORM_RELAYS.length === 0}
		<MenuDesktopItem
		  path="/settings/relays"
		  disabled={!$signer}
		  isActive={$page?.path.startsWith("/settings/relays")}>
			<div class="relative inline-block">
				Net
				{#if $slowConnections.length > 0}
					<div class="absolute -right-2.5 top-1 h-1.5 w-1.5 rounded bg-accent" />
				{/if}
			</div>
		</MenuDesktopItem>
	{/if}
	<MenuDesktopItem
	  disabled={!$signer}
	  isActive={$page?.path.startsWith("/notifications")}
	  path="/notifications">
		<div class="relative inline-block">
			Notes
			{#if $hasNewNotifications}
				<div class="absolute -right-2.5 top-1 h-1.5 w-1.5 rounded bg-accent" />
			{/if}
		</div>
	</MenuDesktopItem>
	<MenuDesktopItem
	  disabled={!$signer}
	  isActive={$page?.path.startsWith("/channels")}
	  path="/channels">
		<div class="relative inline-block">
			Messages
			{#if $hasNewMessages}
				<div class="absolute -right-2.5 top-1 h-1.5 w-1.5 rounded bg-accent" />
			{/if}
		</div>
	</MenuDesktopItem>
	<FlexColumn class="absolute bottom-0 w-72" small>
		<Anchor
		  class=" px-8 text-tinted-400 hover:text-tinted-100"
		  on:click={() => setSubMenu("settings")}>Settings
		</Anchor>
		<div class=" flex h-8 gap-2 px-8 text-tinted-500">
			<Anchor class="hover:text-tinted-100" href="/about">About</Anchor>
		</div>
		{#if subMenu === "settings"}
			<MenuDesktopSecondary onEscape={closeSubMenu}>
				<MenuItem class=" flex items-center gap-4 py-4 pl-8" on:click={toggleTheme}>
					<i class="fa fa-palette" /> Toggle Theme
				</MenuItem>
				<MenuItem
				  class=" flex items-center gap-4 py-4 pl-8"
				  href="/settings/data"
				  disabled={!$signer}>
					<i class="fa fa-database" /> Database
				</MenuItem>
				<MenuItem
				  class=" flex items-center gap-4 py-4 pl-8"
				  href="/settings"
				  disabled={!$signer}>
					<i class="fa fa-cog" /> App Settings
				</MenuItem>
				<MenuItem
				  class=" flex items-center gap-4 py-4 pl-8"
				  href="/settings/content"
				  disabled={!$signer}>
					<i class="fa fa-volume-xmark" /> Content Settings
				</MenuItem>
			</MenuDesktopSecondary>
		{:else if subMenu === "account"}
			<MenuDesktopSecondary onEscape={closeSubMenu}>
				<MenuItem
				  class=" flex items-center gap-4 py-4 pl-8"
				  href={router.at("people").of($pubkey).toString()}>
					<i class="fa fa-user-circle" /> Profile
				</MenuItem>
				<MenuItem class=" flex items-center gap-4 py-4 pl-8" href="/settings/keys">
					<i class="fa fa-key" /> Keys
				</MenuItem>
				<MenuItem
				  class=" flex items-center gap-4 py-4 pl-8"
				  href={router.at("invite/create").qp({initialPubkey: $pubkey}).toString()}>
					<i class="fa fa-paper-plane" /> Create Invite
				</MenuItem>
				<MenuItem
				  class=" flex items-center gap-4 py-4 pl-8"
				  on:click={() => setSubMenu("accounts")}>
					<i class="fa fa-right-left" /> Switch Account
				</MenuItem>
				<MenuItem class=" flex items-center gap-4 py-4 pl-8" href="/logout">
					<i class="fa fa-right-to-bracket" /> Log Out
				</MenuItem>
			</MenuDesktopSecondary>
		{:else if subMenu === "accounts"}
			<MenuDesktopSecondary onEscape={closeSubMenu}>
				{#each Object.values($sessions) as s (s.pubkey)}
					{#if s.pubkey !== $pubkey}
						<MenuItem class="py-4" on:click={() => pubkey.set(s.pubkey)}>
							<div class="flex items-center gap-2">
								<PersonCircle
								  class="h-8 w-8 border border-solid border-tinted-200"
								  pubkey={s.pubkey} />
								{displayProfileByPubkey(s.pubkey)}
							</div>
						</MenuItem>
					{/if}
				{/each}
				<MenuItem
				  class=" flex items-center gap-4 py-4"
				  on:click={() => router.at("login").open()}>
					<i class="fa fa-plus" /> Add Account
				</MenuItem>
			</MenuDesktopSecondary>
		{/if}
		<div>
			<Anchor
			  class="flex h-12 cursor-pointer items-center justify-between border-t border-solid border-neutral-600 pl-7 pr-12"
			  href="/publishes"
			  modal>
				<div class="flex items-center gap-1" class:text-tinted-500={$hud.pending === 0}>
					<i class="fa fa-hourglass" />
					{$hud.pending}
				</div>
				<div class="flex items-center gap-1" class:text-tinted-500={$hud.success === 0}>
					<i class="fa fa-cloud-arrow-up" />
					{$hud.success}
				</div>
				<div
				  class="flex items-center gap-1"
				  class:text-accent={$hud.failure > 0}
				  class:text-tinted-500={$hud.failure === 0}>
					<i class="fa fa-triangle-exclamation" />
					{$hud.failure}
				</div>
			</Anchor>
			<div class="h-20 cursor-pointer border-t border-solid border-neutral-600 px-7 py-4">
				{#if $pubkey}
					<Anchor class="flex items-center gap-2" on:click={() => setSubMenu("account")}>
						<PersonCircle class="h-10 w-10" pubkey={$pubkey} />
						<div class="flex min-w-0 flex-col">
							<span>@{$userDisplay}</span>
							<PersonHandle class="text-sm" pubkey={$pubkey} />
						</div>
					</Anchor>
				{:else}
					<Anchor modal button accent href="/login">Log In</Anchor>
				{/if}
			</div>
		</div>
	</FlexColumn>
</div>
