import type { LaunchPersistentContextOptions } from "cloakbrowser"
import { toPlaywrightProxy } from "./proxy"

type Environment = Record<string, string | undefined>

// These are Chromium's native fingerprint switches. An omitted value leaves the
// SDK's coherent, seed-derived defaults in control.
const fingerprintOptions = {
  CLOAK_FINGERPRINT: "fingerprint",
  CLOAK_FINGERPRINT_PLATFORM: "fingerprint-platform",
  CLOAK_FINGERPRINT_GPU_VENDOR: "fingerprint-gpu-vendor",
  CLOAK_FINGERPRINT_HARDWARE_CONCURRENCY: "fingerprint-hardware-concurrency",
  CLOAK_FINGERPRINT_DEVICE_MEMORY: "fingerprint-device-memory",
  CLOAK_FINGERPRINT_SCREEN_WIDTH: "fingerprint-screen-width",
  CLOAK_FINGERPRINT_SCREEN_HEIGHT: "fingerprint-screen-height",
  CLOAK_FINGERPRINT_PLATFORM_VERSION: "fingerprint-platform-version",
  CLOAK_FINGERPRINT_TIMEZONE: "fingerprint-timezone",
  CLOAK_FINGERPRINT_LOCALE: "fingerprint-locale",
  CLOAK_FINGERPRINT_STORAGE_QUOTA: "fingerprint-storage-quota",
  CLOAK_FINGERPRINT_TASKBAR_HEIGHT: "fingerprint-taskbar-height",
  CLOAK_FINGERPRINT_WEBRTC_IP: "fingerprint-webrtc-ip",
  CLOAK_FINGERPRINT_NOISE: "fingerprint-noise",
  CLOAK_FINGERPRINT_SAPI_VOICES: "fingerprint-sapi-voices",
  CLOAK_FINGERPRINT_MAX_TOUCH_POINTS: "fingerprint-max-touch-points",
  CLOAK_FINGERPRINT_SEARCH_ENGINE: "fingerprint-search-engine",
  CLOAK_FINGERPRINT_TRANSPARENT_PROXY_DNS: "fingerprint-transparent-proxy-dns",
  CLOAK_LICENSE_ROUTE: "license-route",
} as const

const switches = {
  CLOAK_FINGERPRINT_ALLOW_3P_COOKIES: "fingerprint-allow-3p-cookies",
  CLOAK_FINGERPRINT_TRANSPARENT_PROXY: "fingerprint-transparent-proxy",
  CLOAK_FINGERPRINT_PORTABLE_COOKIES: "fingerprint-portable-cookies",
} as const

function booleanValue(name: string, value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") return defaultValue
  if (/^(true|1|yes)$/i.test(value.trim())) return true
  if (/^(false|0|no)$/i.test(value.trim())) return false
  throw new Error(`${name} must be true or false`)
}

/** Translate environment variables into options accepted by the official SDK. */
export function cloakLaunchOptions(env: Environment = process.env): LaunchPersistentContextOptions {
  const args: string[] = []
  for (const [name, flag] of Object.entries(fingerprintOptions)) {
    const value = env[name]?.trim()
    if (value) args.push(`--${flag}=${value}`)
  }
  for (const [name, flag] of Object.entries(switches)) {
    if (booleanValue(name, env[name], false)) args.push(`--${flag}`)
  }
  if (env.CLOAK_EXTRA_ARGS?.trim()) {
    let extra: unknown
    try {
      extra = JSON.parse(env.CLOAK_EXTRA_ARGS)
    } catch {
      throw new Error("CLOAK_EXTRA_ARGS must be a JSON array of Chromium arguments")
    }
    if (
      !Array.isArray(extra) ||
      extra.some(
        (arg) =>
          typeof arg !== "string" ||
          !arg.startsWith("--") ||
          /^--(?:remote-debugging-port|remote-debugging-pipe|remote-debugging-address|user-data-dir)(?:=|$)/.test(arg),
      )
    )
      throw new Error("CLOAK_EXTRA_ARGS must contain Chromium arguments without CDP or profile overrides")
    args.push(...extra)
  }
  const preset = env.CLOAK_HUMAN_PRESET?.trim()
  const proxy = env.CLOAK_PROXY?.trim()
  const bypass = env.CLOAK_PROXY_BYPASS?.trim()
  if (preset && preset !== "default" && preset !== "careful") {
    throw new Error("CLOAK_HUMAN_PRESET must be default or careful")
  }
  return {
    userDataDir: env.CLOAK_USER_DATA_DIR?.trim() || "/data/cloakbrowser",
    headless: booleanValue("CLOAK_HEADLESS", env.CLOAK_HEADLESS, true),
    humanize: booleanValue("CLOAK_HUMANIZE", env.CLOAK_HUMANIZE, false),
    ...(preset === "default" || preset === "careful" ? { humanPreset: preset } : {}),
    ...(proxy ? { proxy: bypass ? { ...toPlaywrightProxy(proxy), bypass } : proxy } : {}),
    args,
  }
}
