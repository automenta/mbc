// Adapted from https://raw.githubusercontent.com/EmilTholin/svelte-routing/master/src/history.js

type Listener = (update: { location: Location; action: string, preserveScroll?: boolean }) => void
type NavigateOptions = { state?: any; replace?: boolean; preserveScroll?: boolean; blurActiveElement?: boolean }
type NavigateFn = (to: string, options?: NavigateOptions) => void

interface HistorySource {
  readonly location: Location
  addEventListener(name: string, fn: any): void
  removeEventListener(name: string, fn: any): void
  history: {
    readonly state: any
    pushState(state: any, _: string, uri: string): void
    replaceState(state: any, _: string, uri: string): void
  }
}


const getLocation = (source: HistorySource) => ({
  ...source.location,
  state: source.history.state,
  key: (source.history.state && source.history.state.key) || "initial",
})

const createHistory = (source: HistorySource) => {
  const listeners: Listener[] = []
  let location = getLocation(source)

  return {
    get location() {
      return location
    },

    listen(listener: Listener) {
      listeners.push(listener)

      const popstateListener = () => {
        location = getLocation(source)
        listener({location, action: "POP"})
      }

      source.addEventListener("popstate", popstateListener)

      return () => {
        source.removeEventListener("popstate", popstateListener)
        const index = listeners.indexOf(listener)
        listeners.splice(index, 1)
      }
    },

    navigate: (
      to: string,
      {state = {}, replace = false, preserveScroll = false, blurActiveElement = true}: NavigateOptions = {},
    ) => {
      const navigateAction = replace ? "replaceState" : "pushState"
      try {
        source.history[navigateAction](state, "", to)
      } catch (e) {
        source.location[replace ? "replace" : "assign"](to) // Fallback for errors in history API
      }
      location = getLocation(source)
      listeners.forEach(listener => listener({location, action: "PUSH", preserveScroll}))
      if (blurActiveElement) document.activeElement?.blur()
    },
  }
}


// Global history uses window.history as the source if available
const globalHistory = createHistory(window) as ReturnType<typeof createHistory> & { navigate: NavigateFn }


export {globalHistory, createHistory}
