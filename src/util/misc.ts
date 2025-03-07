import {derived, type Readable} from "svelte/store"
import {
  DAY,
  ensurePlural,
  first,
  fromPairs,
  HOUR,
  identity,
  int,
  last,
  MINUTE,
  now,
  round,
  stripProtocol,
  sum,
  tryCatch,
} from "@welshman/lib"
import Fuse, {type IFuseOptions} from "fuse.js"
import logger from "src/util/logger"

export const timestamp1: Readable<number> = derived([], (_, set) => {
  const interval = setInterval(() => {
    set(Math.floor(Date.now() / 1000))
  }, 1000)
  return () => clearInterval(interval)
})

export const secondsToDate = (ts: number) => new Date(ts * 1000)

export const dateToSeconds = (date: Date) => Math.round(date.valueOf() / 1000)

export const getTimeZone = () => new Date().toString().match(/GMT[^\s]+/)?.[0] || ""

export const createLocalDate = (dateString: string) => new Date(`${dateString} ${getTimeZone()}`)

export const getLocale = () => new Intl.DateTimeFormat().resolvedOptions().locale

const defaultDateFormatter = new Intl.DateTimeFormat(getLocale(), {
  dateStyle: "short",
  timeStyle: "short",
})

export const formatTimestamp = (ts: number) => defaultDateFormatter.format(new Date(ts * 1000))

const dateFormatterAsDate = new Intl.DateTimeFormat(getLocale(), {
  year: "numeric",
  month: "long",
  day: "numeric",
})

export const formatTimestampAsDate = (ts: number) => dateFormatterAsDate.format(new Date(ts * 1000))

const relativeTimeFormatter = new Intl.RelativeTimeFormat(getLocale(), {numeric: "auto"})

export const formatTimestampRelative = (ts: number) => {
  const deltaSeconds = now() - ts
  let delta: number
  let unit: Intl.RelativeTimeFormatUnit

  if (deltaSeconds < MINUTE) {
    unit = "second"
    delta = Math.round(deltaSeconds)
  } else if (deltaSeconds < HOUR) {
    unit = "minute"
    delta = Math.round(deltaSeconds / MINUTE)
  } else if (deltaSeconds < int(2, DAY)) {
    unit = "hour"
    delta = Math.round(deltaSeconds / HOUR)
  } else {
    unit = "day"
    delta = Math.round(deltaSeconds / DAY)
  }

  return relativeTimeFormatter.format(-delta, unit)
}

export const formatDateAsLocalISODate = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString()
}

export const formatTimestampAsLocalISODate = (ts: number) =>
  formatDateAsLocalISODate(new Date(ts * 1000))

export type ScrollerOptions = {
  delay?: number
  threshold?: number
  reverse?: boolean
  element?: Element
}

const defaultScrollerOptions: ScrollerOptions = {delay: 1000, threshold: 2000, reverse: false}

export const createScroller = (loadMore: () => Promise<void>, options: ScrollerOptions = {}) => {
  const opts = {...defaultScrollerOptions, ...options}
  let observer: IntersectionObserver | null = null
  let done = false

  const handleIntersection: IntersectionObserverCallback = async (entries, observerInstance) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        observerInstance.unobserve(entry.target)
        await loadMore()
        if (!done) {
          observeTrigger()
        }
      }
    }
  }

  const startObserver = (targetElement: Element) => {
    observer = new IntersectionObserver(handleIntersection, {
      root: opts.element?.closest(".modal-content") || opts.element || null,
      rootMargin: `0px 0px ${opts.threshold}px 0px`,
    })
    observer.observe(targetElement)
  }

  const observeTrigger = () => {
    let triggerElement = document.querySelector("#scroll-trigger")
    if (!triggerElement) {
      triggerElement = document.createElement("div")
      triggerElement.id = "scroll-trigger"
      opts.element?.appendChild(triggerElement) || document.body.appendChild(triggerElement) // Append to element if provided
    }
    startObserver(triggerElement)
  }

  observeTrigger()

  return {
    check: observeTrigger,
    stop: () => {
      done = true
      if (observer) {
        observer.disconnect()
        observer = null
      }
    },
  }
}

export const stringToHue = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
    hash &= hash // Convert to 32bit integer
  }
  return hash % 360
}

export const hsl = (hue: number, {saturation = 100, lightness = 50, opacity = 1} = {}) =>
  `hsl(${hue}, ${saturation}%, ${lightness}%, ${opacity})`

export const parseJson = <T>(json: string | null | undefined): T | null => { // Added generic type and handles undefined
  if (!json) return null
  try {
    return JSON.parse(json) as T
  } catch (e) {
    logger.warn("JSON parse error:", e)
    return null
  }
}

export const tryFetch = <T>(f: () => Promise<T>) =>
  tryCatch(f, (e: Error) => {
    if (!e.toString().includes("fetch")) {
      logger.warn("Fetch-like error:", e)
    }
  })

const numberFmt = new Intl.NumberFormat()

export const formatSats = (sats: number) => {
  if (sats < 1_000) return numberFmt.format(sats)
  if (sats < 1_000_000) return numberFmt.format(round(1, sats / 1000)) + "K"
  if (sats < 100_000_000) return numberFmt.format(round(1, sats / 1_000_000)) + "M" // Corrected to M for Million
  return numberFmt.format(round(2, sats / 100_000_000)) + "BTC"
}

const toSnakeCase = (str: string) =>
  str
    .replace(/[-_ ]+/g, "_")
    .replace(/([^_])_*([A-Z][a-z]+)/g, "$1_$2")
    .replace(/\.([A-Z])/g, "_$1")
    .toLowerCase()

export const toTitle = (str: string) =>
  toSnakeCase(str)
    .split("_")
    .map(([firstChar = "", ...rest]) => `${firstChar.toUpperCase()}${rest.join("")}`) // More concise
    .join(" ")

export const commaFormat = (x: string | number) =>
  String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ",") // Using regex for comma formatting

export const pluralize = (n: number, label: string, pluralLabel?: string) =>
  n === 1 ? label : pluralLabel || `${label}s`

export const quantify = (n: number, label: string, pluralLabel?: string) =>
  `${commaFormat(n)} ${pluralize(n, label, pluralLabel)}`

export const race = <T>(threshold: number, promises: Promise<T>[]) => {
  if (threshold <= 0 || promises.length === 0) { // Early exit for efficiency
    return Promise.resolve()
  }

  let count = 0
  return new Promise<void>((resolve, reject) => {
    for (const p of promises) { // Using for...of loop for better readability
      p.then(() => {
        count++
        if (count >= threshold * promises.length) {
          resolve()
        }
      }).catch(reject)
    }
  })
}

export const displayUrl = (url: string) =>
  stripProtocol(url)
    .replace(/^(www\.)?/i, "")
    .replace(/\/$/, "")

export const displayDomain = (url: string) => first(displayUrl(url).split(/[\/\?]/)) || ""

export const sumBy = <T>(f: (item: T) => number, xs: T[]) => sum(xs.map(f))

export const ensureProto = (url: string) => (url.includes("://") ? url : `https://${url}`) // Template literal

export const asArray = <T>(v: T | T[]): T[] => ensurePlural(v).filter(identity) as T[]

export const buildQueryString = (params: Record<string, any>) => {
  const queryString = new URLSearchParams(params).toString()
  return queryString ? `?${queryString}` : ""
}

export const parseQueryString = (path: string): Record<string, string> => {
  const queryString = last(path.split("?"))
  return queryString ? fromPairs(Array.from(new URLSearchParams(queryString))) : {}
}

export const joinPath = (...parts: string[]) => {
  return parts.map(part => part.endsWith("/") ? part : `${part}/`).join("").slice(0, -1) || "" // More concise and handles empty parts
}

export const updateIn = <T, K extends keyof T>(k: K, f: (x: T[K]) => T[K]) => (x: T) => ({...x, [k]: f(x[k])})

export const pickVals = <T, K extends keyof T>(ks: K[], x: T): Array<T[K]> => ks.map(k => x[k])

export const getStringWidth = (text: string): number => {
  const span = document.createElement("span")
  span.style.visibility = "hidden" // More performant than height: 0
  span.style.whiteSpace = 'nowrap' // Ensure single line width calculation
  span.textContent = text
  document.body.appendChild(span)
  const {width} = span.getBoundingClientRect()
  span.remove()
  return width
}

export const fuzzy = <T, U extends keyof T>(
   T[],
  opts: IFuseOptions<T> = {},
): ((q: string) => T[]) => {
  const fuse = new Fuse(data, opts)
  return (q: string) => q ? fuse.search(q.slice(0, 32)).map(result => result.item) : data
}

export class SearchHelper<T, V> {
  config: IFuseOptions<T> = {}
  private _optionsByValue = new Map<V, T>() // Made private
  private _search?: (term: string) => T[] // Made private

  constructor(readonly options: T[]) {}

  private _setup() { // Made private
    if (!this._search) {
      for (const option of this.options) {
        this._optionsByValue.set(this.getValue(option), option)
      }
      this._search = this.getSearch()
    }
    return this
  }

  getSearch = () => fuzzy<T, keyof T>(this.options, this.config)

  getOption = (value: V) => this._setup()._optionsByValue.get(value)

  getValue = (option: T) => option as unknown as V

  displayValue = (value: V) => String(value)

  displayOption = (option: T) => this.displayValue(this.getValue(option))

  searchOptions = (term: string) => this._setup()._search(term)

  searchValues = (term: string) => this.searchOptions(term).map(this.getValue)
}

export const fromCsv = (s: string | null | undefined) => (s || "").split(",").filter(identity)

export const toSpliced = <T>(xs: T[], start: number, deleteCount = 0, ...items: T[]) => [
  ...xs.slice(0, start),
  ...items,
  ...xs.slice(start + deleteCount),
]

const defaultListFormat = new Intl.ListFormat(getLocale(), {style: "long", type: "conjunction"})

export const displayList = <T>(items: T[], conj = "and", n = 6, locale = "en-US") => {
  if (items.length > n + 2) {
    const unitListFormatter = new Intl.ListFormat(locale, {style: "long", type: "unit"})
    const formattedList = unitListFormatter.format(items.slice(0, n).map(String)) // Ensure string conversion here
    return `${formattedList}, ${conj} ${items.length - n} others`
  }

  return defaultListFormat.format(items.map(String)) // Ensure string conversion here
}
