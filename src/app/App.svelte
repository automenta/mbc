<script lang="ts">
	import "@fortawesome/fontawesome-free/css/fontawesome.css"
	import "@fortawesome/fontawesome-free/css/solid.css"

	import {nip19} from "nostr-tools"
	import {get} from "svelte/store"
	import * as lib from "src/lib"
	import {ago, ctx, isNil, max, memoize, omit, sleep} from "src/lib"
	import * as util from "src/util"
	import * as content from "src/content"
	import * as app from "src/app"
	import {getPubkeyRelays, getRelayQuality, loadRelay, trackRelayStats} from "src/app"
	import * as signer from "src/signer"
	import * as net from "src/net"
	import logger from "src/util/logger"
	import * as misc from "src/util/misc"
	import * as nostr from "src/util/nostr"
	import * as engine from "src/engine"
	import {ready} from "src/engine"
	import * as domain from "src/domain"
	import {loadUserData, slowConnections} from "src/app/state"
	import {appName, themeVariables} from "src/partials/state"
	import Toast from "src/partials/Toast.svelte"
	import ChatEnable from "src/app/views/ChatEnable.svelte"
	import Menu from "src/app/Menu.svelte"
	import Routes from "src/app/Routes.svelte"
	import Nav from "src/app/Nav.svelte"
	import ForegroundButtons from "src/app/ForegroundButtons.svelte"
	import About from "src/app/views/About.svelte"
	import Bech32Entity from "src/app/views/Bech32Entity.svelte"
	import ChannelCreate from "src/app/views/ChannelCreate.svelte"
	import ChannelsDetail from "src/app/views/ChannelsDetail.svelte"
	import ChannelsList from "src/app/views/ChannelsList.svelte"
	import DataExport from "src/app/views/DataExport.svelte"
	import DataImport from "src/app/views/DataImport.svelte"
	import FeedCreate from "src/app/views/FeedCreate.svelte"
	import FeedEdit from "src/app/views/FeedEdit.svelte"
	import FeedList from "src/app/views/FeedList.svelte"
	import Help from "src/app/views/Help.svelte"
	import Home from "src/app/views/Home.svelte"
	import InviteAccept from "src/app/views/InviteAccept.svelte"
	import InviteCreate from "src/app/views/InviteCreate.svelte"
	import LabelCreate from "src/app/views/LabelCreate.svelte"
	import ListCreate from "src/app/views/ListCreate.svelte"
	import ListDetail from "src/app/views/ListDetail.svelte"
	import ListEdit from "src/app/views/ListEdit.svelte"
	import ListList from "src/app/views/ListList.svelte"
	import ListSelect from "src/app/views/ListSelect.svelte"
	import Login from "src/app/views/Login.svelte"
	import LoginBunker from "src/app/views/LoginBunker.svelte"
	import LoginConnect from "src/app/views/LoginConnect.svelte"
	import Logout from "src/app/views/Logout.svelte"
	import MediaDetail from "src/app/views/MediaDetail.svelte"
	import NoteCreate from "src/app/views/NoteCreate.svelte"
	import NoteDelete from "src/app/views/NoteDelete.svelte"
	import NoteDetail from "src/app/views/NoteDetail.svelte"
	import Notifications from "src/app/views/Notifications.svelte"
	import Onboarding from "src/app/views/Onboarding.svelte"
	import PersonDetail from "src/app/views/PersonDetail.svelte"
	import PersonFollowers from "src/app/views/PersonFollowers.svelte"
	import PersonFollows from "src/app/views/PersonFollows.svelte"
	import PersonInfo from "src/app/views/PersonInfo.svelte"
	import PersonList from "src/app/shared/PersonList.svelte"
	import Publishes from "src/app/views/Publishes.svelte"
	import QRCode from "src/app/views/QRCode.svelte"
	import RelayDetail from "src/app/views/RelayDetail.svelte"
	import RelayList from "src/app/views/RelayList.svelte"
	import RelayReview from "src/app/views/RelayReview.svelte"
	import ReportCreate from "src/app/views/ReportCreate.svelte"
	import Search from "src/app/views/Search.svelte"
	import ThreadDetail from "src/app/views/ThreadDetail.svelte"
	import UserContent from "src/app/views/UserContent.svelte"
	import UserData from "src/app/views/UserData.svelte"
	import UserKeys from "src/app/views/UserKeys.svelte"
	import UserProfile from "src/app/views/UserProfile.svelte"
	import UserSettings from "src/app/views/UserSettings.svelte"
	import Zap from "src/app/views/Zap.svelte"
	import {onMount} from "svelte"
	import {
		asChannelId,
		asCsv,
		asEntity,
		asJson,
		asNaddr,
		asNote,
		asPerson,
		asRelay,
		asString,
		asUrlComponent,
		router
	} from "src/app/util/router"

	const {session, pubkey} = app

	// Routes

	router.register("/about", About)
	router.register("/search", Search)

	const requireSigner = {
		requireSigner: true
	}
	router.register("/channels", ChannelsList, requireSigner)
	router.register("/channels/enable", ChatEnable, requireSigner)
	router.register("/channels/create", ChannelCreate, requireSigner)
	router.register("/channels/requests", ChannelsList, requireSigner)
	router.register("/channels/:channelId", ChannelsDetail, {
		requireSigner: true,
		serializers: {
			channelId: asChannelId
		}
	})

	router.register("/help/:topic", Help)

	router.register("/invite", InviteAccept, {
		serializers: {
			people: asCsv("people"),
			relays: asCsv("relays"),
			groups: asCsv("groups")
		}
	})
	router.register("/invite/create", InviteCreate, {
		serializers: {
			initialPubkey: asUrlComponent("initialPubkey"),
			initialGroupAddress: asUrlComponent("initialGroupAddress")
		}
	})

	router.register("/feeds", FeedList)
	router.register("/feeds/create", FeedCreate)
	const addrSerializer = {
		serializers: {
			address: asNaddr("address")
		}
	}
	router.register("/feeds/:address", FeedEdit, addrSerializer)

	router.register("/lists", ListList)
	router.register("/lists/create", ListCreate)
	router.register("/lists/:address", ListDetail, addrSerializer)
	router.register("/lists/:address/edit", ListEdit, addrSerializer)
	router.register("/lists/select", ListSelect, {
		serializers: {
			type: asString("type"),
			value: asString("value")
		}
	})

	router.register("/login", Login)
	router.register("/login/bunker", LoginBunker)
	const requireUser = {
		requireUser: true
	}
	router.register("/login/connect", LoginConnect, requireUser)
	router.register("/logout", Logout)

	router.register("/media/:url", MediaDetail, {
		serializers: {
			url: asUrlComponent("url")
		}
	})

	router.register("/", Home)
	router.register("/notes", Home)
	router.register("/notes/create", NoteCreate, {
		requireSigner: true,
		serializers: {
			pubkey: asPerson,
			type: asString("type")
		}
	})
	const noteSerializer = {
		serializers: {
			entity: asNote
		}
	}
	router.register("/notes/:entity", NoteDetail, noteSerializer)
	router.register("/notes/:entity/label", LabelCreate, noteSerializer)
	router.register("/notes/:entity/report", ReportCreate, noteSerializer)
	router.register("/notes/:entity/thread", ThreadDetail, noteSerializer)
	router.register("/notes/:entity/delete", NoteDelete, {
		serializers: {
			entity: asNote,
			kind: asString("kind")
		}
	})

	router.register("/notifications", Notifications, requireUser)
	router.register("/notifications/:activeTab", Notifications, requireUser)

	router.register("/signup", Onboarding)

	router.register("/people/list", PersonList, {
		serializers: {
			pubkeys: asCsv("pubkeys")
		}
	})

	const serializersRequireUserRequireSignerRequiredDefaultIsDefaultRoute = {
		required: ["pubkey"],
		serializers: {
			entity: asPerson
		}
	}
	router.register("/people/:entity", PersonDetail, serializersRequireUserRequireSignerRequiredDefaultIsDefaultRoute)
	router.register("/people/:entity/followers", PersonFollowers, serializersRequireUserRequireSignerRequiredDefaultIsDefaultRoute)
	router.register("/people/:entity/follows", PersonFollows, serializersRequireUserRequireSignerRequiredDefaultIsDefaultRoute)
	router.register("/people/:entity/info", PersonInfo, serializersRequireUserRequireSignerRequiredDefaultIsDefaultRoute)

	router.register("/qrcode/:code", QRCode, {
		serializers: {
			code: asUrlComponent("code")
		}
	})

	router.register("/publishes", Publishes)

	const relaySerializer = {
		serializers: {
			entity: asRelay
		}
	}
	router.register("/relays/:entity", RelayDetail, relaySerializer)
	router.register("/relays/:entity/review", RelayReview, relaySerializer)

	router.register("/settings", UserSettings, requireUser)
	router.register("/settings/content", UserContent, requireUser)
	router.register("/settings/data", UserData, requireUser)
	router.register("/settings/data/export", DataExport, requireUser)
	router.register("/settings/data/import", DataImport, requireUser)
	router.register("/settings/keys", UserKeys, requireUser)
	router.register("/settings/profile", UserProfile, requireUser)
	router.register("/settings/relays", RelayList)

	router.register("/zap", Zap, {
		required: ["splits"],
		serializers: {
			id: asNote,
			amount: asJson("amount"),
			splits: asJson("splits"),
			anonymous: asJson("anonymous")
		}
	})

	const entitySerializer = {
		serializers: {
			entity: asEntity
		}
	}
	router.register("/:entity", Bech32Entity, entitySerializer)
	router.register("/:entity/*", Bech32Entity, entitySerializer)

	router.init()

	// Globals
	Object.assign(window, {
		get,
		nip19,
		logger,
		router,
		content,
		...nostr,
		...misc,
		...signer,
		...omit(["Worker"], lib),
		...util,
		...net,
		...app,
		...domain,
		...engine
	})

	const style = document.createElement("style")

	document.head.append(style)

	$: style.textContent = `:root { ${$themeVariables}; background: var(--neutral-800); }`

	let scrollY: number // Scroll position

	const unsubHistory = router.history.subscribe($history => {
		const s = document.body.style
		if ($history[0].modal) {
			// This is not idempotent, so don't duplicate it
			if (s.position !== "fixed") {
				scrollY = window.scrollY

				s.top = `-${scrollY}px`
				s.position = `fixed`
			}
		} else if (s.position === "fixed") {
			document.body.setAttribute("style", "")

			if (!isNil(scrollY)) {
				window.scrollTo(0, scrollY)
				scrollY = null
			}
		}
	})


	onMount(() => {
		const unsubPage = router.page.subscribe(
		  memoize($page => window.scrollTo(0, 0))
		)

		const unsubModal = router.modal.subscribe($modal => {
		})

		const unsubRouter = router.listen()

		return () => {
			unsubPage()
			unsubModal()
			unsubRouter()
			unsubHistory()
		}
	})


	try {
		const handler = navigator.registerProtocolHandler as (
		  scheme: string,
		  handler: string,
		  name: string
		) => void

		const o = `${location.origin}/%s`
		handler?.("web+nostr", o, appName)
		handler?.("nostr", o, appName)
	} catch (e) {
		// pass
	}

	ctx.net.pool.on("init", connection => {
		loadRelay(connection.url)
		trackRelayStats(connection)
	})

	ready.then(async () => {
		// Our stores are throttled by 300, so wait until they're populated
		// before loading app data
		await sleep(350) //HACK sloppy

		if ($session)
			loadUserData()

		const slowCloser = setInterval(() => {
			slowConnections.set(getPubkeyRelays($pubkey).filter(url => getRelayQuality(url) < 0.5))

			// Prune connections we haven't used in a while
			for (const connection of ctx.net.pool.data.values()) {
				const cs = connection.stats
				const lastActivity = max([
					cs.lastOpen,
					cs.lastPublish,
					cs.lastRequest,
					cs.lastEvent
				])
				if (lastActivity && lastActivity < ago(30))
					ctx.net.pool.get(connection.url).socket.close()

			}
		}, 5_000)

		return () => clearInterval(slowCloser)
	})
</script>

{#await ready}
	<!-- pass -->
{:then}
	<div class="text-tinted-200">
		<Routes />
		{#key $pubkey}
			<ForegroundButtons />
			<Nav />
			<Menu />
			<Toast />
		{/key}
	</div>
{/await}
