import {writable} from "svelte/store"
import {assoc} from "src/lib"
import type {TrustedEvent} from "src/util"
import {withGetter} from "src/store"

import {getSession, getSigner} from "./session.js"
import {decrypt} from "src/signer/util"

export const plaintext = withGetter(writable<Record<string, string>>({}))

export const getPlaintext = (e: TrustedEvent) => plaintext.get()[e.id]

export const setPlaintext = (e: TrustedEvent, content: string) =>
  plaintext.update(assoc(e.id, content))

export const ensurePlaintext = async (e: TrustedEvent) => {
  if (e.content && !getPlaintext(e)) {
    const $session = getSession(e.pubkey)

    if (!$session) return

    const $signer = getSigner($session)

    if (!$signer) return

    let result

    try {
      result = await decrypt($signer, e.pubkey, e.content)
    } catch (e: any) {
      if (!String(e).match(/invalid base64/)) {
        throw e
      }
    }

    if (result) {
      setPlaintext(e, result)
    }
  }

  return getPlaintext(e)
}
