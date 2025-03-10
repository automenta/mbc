/**
 * Least Recently Used (LRU) cache implementation
 * @template T - Type of cache keys
 * @template U - Type of cache values
 */
export class LRUCache<T, U> {
  map = new Map<T, U>()
  keys: T[] = []

  constructor(readonly maxSize: number = Infinity) {}

  has(k: T) {
    return this.map.has(k)
  }

  get(key: T): U | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Move key to end (most recently used)
      const index = this.keys.indexOf(key);
      this.keys.splice(index, 1);
      this.keys.push(key);
    }
    return value;
  }

  set(k: T, v: U) {
    this.map.set(k, v)
    this.keys.push(k)

    if (this.map.size > this.maxSize) {
      this.map.delete(this.keys.shift() as T)
    }
  }
}

/**
 * Creates a memoized function with LRU caching
 * @template T - Cache key type
 * @template V - Cache value type
 * @template Args - Function argument types
 */
export function cached<T, V, Args extends any[]>({
                                                   maxSize,
                                                   getKey,
                                                   getValue,
                                                 }: {
  maxSize: number
  getKey: (args: Args) => T
  getValue: (args: Args) => V
}) {
  const cache = new LRUCache<T, V>(maxSize)

  const get = (...args: Args) => {
    const k = getKey(args)
    if (!cache.has(k)) {
      const v = getValue(args)
      cache.set(k, v)
      return v
    } else
      return cache.get(k)!
  }

  get.cache = cache
  get.getKey = getKey
  get.getValue = getValue

  return get
}

/**
 * Creates a simple memoized function with default settings
 * @template V - Cache value type
 * @template Args - Function argument types
 */
export function simpleCache<V, Args extends any[]>(getValue: (args: Args) => V) {
  return cached({maxSize: 10 ** 5, getKey: xs => xs.join(":"), getValue})
}