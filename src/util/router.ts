import {filterVals, first, identity, mergeLeft, randomId} from "@welshman/lib"
import {derived, get, writable, type Readable} from "svelte/store"
import logger from "src/util/logger"
import {buildQueryString, parseQueryString, updateIn} from "src/util/misc"
import {globalHistory} from "src/util/history"

// Adapted from https://github.com/EmilTholin/svelte-routing/blob/master/src/utils.js

const PARAM = /^:(.+)/
const SEGMENT_POINTS = 4
const STATIC_POINTS = 3
const DYNAMIC_POINTS = 2
const SPLAT_PENALTY = 1
const ROOT_POINTS = 1

const segmentize = (uri: string) => uri.replace(/(^\/+|\/+$)/g, "").split("/")

const rankRoute = (route: Route, index: number) => {
  const score = route.default
    ? 0
    : segmentize(route.path).reduce((currentScore, segment) => {
        let segmentScore = SEGMENT_POINTS // Renamed to avoid shadowing

        if (segment === "") {
          segmentScore += ROOT_POINTS
        } else if (PARAM.test(segment)) {
          segmentScore += DYNAMIC_POINTS
        } else if (segment[0] === "*") {
          segmentScore -= SEGMENT_POINTS + SPLAT_PENALTY
        } else {
          segmentScore += STATIC_POINTS
        }

        return currentScore + segmentScore
      }, 0)

  return {route, score, index}
}

const pickRoute = (routes: Route[], uri: string) => {
  let match: {route: Route; params: Record<string, string>; uri: string} | null = null
  let defaultMatch: {route: Route; params: {}; uri: string} | null = null // Renamed to avoid shadowing

  const [uriPathname] = uri.split("?")
  const uriSegments = segmentize(uriPathname)
  const isRootUri = uriSegments[0] === ""
  const ranked = routes
    .map(rankRoute)
    .sort((a, b) => (a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index))

  for (let i = 0, l = ranked.length; i < l; i++) {
    const rankedRoute = ranked[i] // Renamed to avoid shadowing
    const route = rankedRoute.route
    let missed = false

    if (route.default) {
      defaultMatch = { // Use defaultMatch here
        route,
        params: {},
        uri,
      }
      continue
    }

    const routeSegments = segmentize(route.path)
    const params: Record<string, string> = {}
    const max = Math.max(uriSegments.length, routeSegments.length)
    let index = 0

    for (; index < max; index++) {
      const routeSegment = routeSegments[index]
      const uriSegment = uriSegments[index]

      if (routeSegment && routeSegment[0] === "*") {
        const splatName = routeSegment === "*" ? "*" : routeSegment.slice(1)
        params[splatName] = uriSegments.slice(index).map(decodeURIComponent).join("/")
        break
      }

      if (typeof uriSegment === "undefined") {
        missed = true
        break
      }

      const dynamicMatch = PARAM.exec(routeSegment)

      if (dynamicMatch && !isRootUri) {
        const value = decodeURIComponent(uriSegment)
        params[dynamicMatch[1]] = value
      } else if (routeSegment !== uriSegment) {
        missed = true
        break
      }
    }

    if (!missed) {
      match = {
        route,
        params,
        uri: "/" + uriSegments.slice(0, index).join("/"),
      }
      break
    }
  }

  return match || defaultMatch || null // Use defaultMatch here
}

export type Serializer = {
  encode: (v: any) => string
  decode: (v: string) => any
}

export type ComponentSerializers = Record<string, Serializer>

export type RegisterOpts = {
  required?: string[]
  serializers?: ComponentSerializers
  requireUser?: boolean
  requireSigner?: boolean
  default?: boolean
}

export type Route = RegisterOpts & {
  path: string
  component: any
}

export type HistoryItem = {
  path: string
  key?: string
  mini?: boolean
  drawer?: boolean
  modal?: boolean
  virtual?: boolean
  noEscape?: boolean
  replace?: boolean
  context?: Record<string, any>
}

export const asPath = (...parts: string[]) => {
  let path = parts.filter(identity).join("/")

  if (path && !path.startsWith("/")) {
    path = "/" + path
  }

  return path
}

type RouterExtensionParams = {
  path: string
  queryParams?: Record<string, any>
  context?: Record<string, any>
  config?: Record<string, any>
}

class RouterExtension {
  constructor(
    readonly router: Router,
    readonly params: RouterExtensionParams,
    readonly getId: (...args: any[]) => string = identity,
  ) {}

  get path() {
    return this.params.path
  }

  get queryParams() {
    return this.params.queryParams
  }

  get context() {
    return this.params.context
  }

  get config() {
    return this.params.config
  }

  of = (...args: any[]) => this.at(this.getId(...args))

  clone = (params: Partial<RouterExtensionParams>) => new RouterExtension(this.router, {...this.params, ...params}, this.getId)

  at = (path: string) => this.clone({path: asPath(this.path, path)})

  qp = (queryParams: Record<string, any>) => {
    const match = pickRoute(this.router.routes, this.path)
    if (!match) return this.clone({queryParams})

    const data = {...this.queryParams}

    for (const [k, v] of Object.entries(queryParams)) {
      const serializer = match.route.serializers?.[k]

      if (serializer && v != null) { // Check for null or undefined
        data[k] = serializer.encode(v)
      }
    }

    return this.clone({queryParams: data})
  }

  cx = (context: Record<string, any>) => this.clone(updateIn("context", c => mergeLeft(context, c))(this.params))

  cg = (config: Record<string, any>) => this.clone(updateIn("config", c => mergeLeft(config, c))(this.params))

  toString = () => {
    let path = this.path

    if (this.queryParams && Object.keys(this.queryParams).length > 0) { // Check if queryParams is not empty
      const qs = buildQueryString(this.queryParams)
      path += qs
    }

    return path
  }

  go = (newConfig: Record<string, any> = {}) =>
    this.router.go(
      filterVals(identity, {
        ...this.config,
        ...newConfig,
        context: this.context,
        path: this.toString(),
      }),
    )

  push = (config: Record<string, any> = {}) => this.go(config)

  open = (config: Record<string, any> = {}) => this.go({modal: true, ...config})

  pushModal = (config: Record<string, any> = {}) => this.go({...config, modal: true})

  replace = (config: Record<string, any> = {}) => this.go({...config, replace: true})

  replaceModal = (config: Record<string, any> = {}) => this.go({...config, replace: true, modal: true})
}

export class Router {
  routes: Route[] = []
  extensions: Record<string, RouterExtension> = {}
  history = writable<HistoryItem[]>([])
  nonVirtual: Readable<HistoryItem[]> = derived(this.history, $history => $history.filter(h => !h.virtual))
  pages: Readable<HistoryItem[]> = derived(this.nonVirtual, $nonVirtual => $nonVirtual.filter(h => !h.modal))
  page: Readable<HistoryItem | undefined> = derived(this.nonVirtual, $nonVirtual => $nonVirtual.find((h: HistoryItem) => !h.modal))
  modals: Readable<HistoryItem[]> = derived(this.nonVirtual, $nonVirtual => {
    return $nonVirtual.filter(h => h.modal).reverse() // Modals are now reversed to get the topmost modal easily
  })
  modal: Readable<HistoryItem | undefined> = derived(this.modals, $modals => $modals[0]) // Get the topmost modal
  current: Readable<HistoryItem | undefined> = derived(this.nonVirtual, $nonVirtual => $nonVirtual[0])

  init() {
    this.at(window.location.pathname + window.location.search).push()
    this.page.subscribe($page => {
      if (!$page) {
        logger.error("No page available")
      }
    })
  }

  listen() {
    return globalHistory.listen(({location, action}) => {
      const {pathname, search} = location
      const path = pathname + search
      const currentHistory = get(this.history)[0]

      if (action === "POP") {
         if (path !== currentHistory?.path) {
          this.go({path, virtual: currentHistory?.virtual}) // Preserve virtual state on POP
        }
      }
    })
  }

  register = (
    path: string,
    component: any,
    {serializers, requireUser, requireSigner, required, default: isDefaultRoute}: RegisterOpts = {},
  ) => {
    this.routes.push({path, component, required, serializers, requireUser, requireSigner, default: isDefaultRoute})
  }

  getMatch(path: string): {route: Route; params: Record<string, string>} {
    const match = pickRoute(this.routes, path)

    if (!match) {
      throw new Error(`Failed to match path: ${path}`)
    }

    return match
  }

  go({replace, virtual, ...state}: HistoryItem) { // Added virtual to go function
    if (!state.path) {
      throw new Error("router.go called without a path")
    }

    if (!state.key) {
      state.key = randomId()
    }

    this.history.update($history => {
      if (replace) {
        $history = $history.slice(1)
      }

      return [{...state, virtual}, ...$history.slice(0, 100)] // Apply virtual here
    })

    globalHistory.navigate(state.path, {replace, state: {key: state.key, virtual}}) // Pass virtual to history state
  }

  pop() {
    const $history = get(this.history)
    if ($history.length <= 1) {
      return
    }
    window.history.back()
  }

  back(times: number) {
    if (times <= 0) return; // Prevent invalid calls

    let count = 0
    const popListener = () => {
      count++
      if (count >= times) {
        window.removeEventListener("popstate", popListener) // Remove listener after use
      } else {
        this.pop()
      }
    }
    window.addEventListener("popstate", popListener)
    this.pop()
  }


  remove(key: string) {
    this.history.update($history => $history.filter($item => $item.key !== key))
  }

  clearModals() {
    this.history.update($history => {
      let history = [...$history]
      while (history[0]?.modal) {
        history.shift() // Use shift for better performance when removing from the beginning
      }

      if (history.length === 0) {
        history.push({path: "/"})
      }

      globalHistory.navigate(history[0].path || "/")

      return history
    })
  }

  // Extensions

  extend(path: string, getId: (...args: any[]) => string) {
    this.extensions[path] = new RouterExtension(this, {path: asPath(path)}, getId)
  }

  at(path: string) {
    return this.extensions[path] || new RouterExtension(this, {path: asPath(path)}, identity)
  }

  from(historyItem: HistoryItem) {
    const path = first(historyItem.path.split("?")) || ""
    const params = this.decodeQueryString(historyItem.path)

    return this.at(path).qp(params).cg(historyItem)
  }

  fromCurrent() {
    return this.from(get(this.current) || {path: '/'})
  }


  virtual() {
    return this.fromCurrent().cg({virtual: true})
  }

  // Props etc

  decodeQueryString = (path: string) => {
    return this.decodeParams(path, 'query')
  }

  decodeRouteParams = (path: string) => {
    return this.decodeParams(path, 'route')
  }


  private decodeParams = (path: string, type: 'query' | 'route') => {
    const match = pickRoute(this.routes, path)
    if (!match) return {}

    const params = type === 'query' ? parseQueryString(path) : match.params
    const serializers = match.route.serializers || {}
    const  Record<string, any> = {} // Explicit type annotation

    for (const [k, serializer] of Object.entries(serializers)) {
      const v = params[k]
      if (v) {
        try {
          Object.assign(data, serializer.decode(v))
        } catch (e) {
          logger.warn(`${type} param decoding failed`, k, v, e)
        }
      }
    }
    return data
  }


  getKey = (item: HistoryItem) => item.key || item.path

  getProps = (item: HistoryItem) => ({
    ...this.decodeQueryString(item.path),
    ...this.decodeRouteParams(item.path),
    ...item.context,
  })
}
