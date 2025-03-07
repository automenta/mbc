const LOG_LEVELS = {
  info: 0,
  warn: 1,
  error: 2,
} as const

type LogLevel = keyof typeof LOG_LEVELS

let level: LogLevel = (import.meta.env.VITE_LOG_LEVEL || "info") as LogLevel

export const setLevel = (l: LogLevel) => {
  level = l
}

const shouldLog = (messageLevel: LogLevel): boolean => {
  return LOG_LEVELS[level] <= LOG_LEVELS[messageLevel]
}

export const info = (...message: any[]) => {
  if (shouldLog("info")) {
    console.info("[INFO]", ...message) // Changed to console.info for semantic correctness
  }
}

export const warn = (...message: any[]) => {
  if (shouldLog("warn")) {
    console.warn("[WARN]", ...message)
  }
}

export const error = (...message: any[]) => {
  if (shouldLog("error")) {
    console.error("[ERROR]", ...message)
  }
}

export default {info, warn, error, setLevel}
