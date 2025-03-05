import "src/app.css"
import {addSession} from "@welshman/app"
import {getPubkey, makeSecret, Nip46Broker} from "@welshman/signer"
import {App as CapacitorApp} from "@capacitor/app"
import {nsecDecode} from "src/util/nostr"
import {router} from "src/app/util"
import App from "src/app/App.svelte"
import {installPrompt} from "src/partials/state"
import {loginWithNip46} from "src/engine"
import {mount} from "svelte"

// Nstart login - hash is replaced somewhere else, maybe router?
if (window.location.hash?.startsWith("#nostr-login")) {
  ;(async () => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const login = params.get("nostr-login")

    let success = false

    try {
      if (login.startsWith("bunker://")) {
        success = await loginWithNip46({
          clientSecret: makeSecret(),
          ...Nip46Broker.parseBunkerUrl(login),
        })
      } else {
        const secret = nsecDecode(login)

        addSession({method: "nip01", secret, pubkey: getPubkey(secret)})
        success = true
      }
    } catch (e) {
      console.error(e)
    }

    if (success) {
      setTimeout(() => router.at("/signup").open(), 300)
    }
  })()
}

window.addEventListener("beforeinstallprompt", e => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault()

  // Stash the event so it can be triggered later.
  installPrompt.set(e)
})

// Handle back button on android
CapacitorApp.addListener("backButton", ({canGoBack}) => {
  if (!canGoBack) {
    CapacitorApp.exitApp()
  } else {
    window.history.back()
  }
})

router.at("/onboarding").replace()

mount(App, {target: document.getElementById("app")})