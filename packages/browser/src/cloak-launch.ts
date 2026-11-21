import { existsSync } from "node:fs"
import { launchPersistentContext } from "cloakbrowser"
import { cloakLaunchOptions } from "./cloak-config"

const BUNDLED_BROWSER = "/opt/cloakbrowser/chrome"

/**
 * Use the bundled, keyless release unless the operator selects another binary
 * or provides a license. A licensed launch lets the SDK resolve its own build.
 */
export function selectCloakBinary(env: Record<string, string | undefined> = process.env): string | undefined {
  const explicit = env.CLOAKBROWSER_BINARY_PATH?.trim()
  if (explicit) return explicit
  if (env.CLOAKBROWSER_LICENSE_KEY?.trim()) return undefined
  return BUNDLED_BROWSER
}

/** Launch a persistent context, which is also the default context exposed over CDP. */
export async function launchCloakContext(cdpPort: number) {
  if (!Number.isSafeInteger(cdpPort) || cdpPort < 1 || cdpPort > 65535) {
    throw new Error("CDP port must be an integer from 1 to 65535")
  }
  const binary = selectCloakBinary()
  if (binary && !existsSync(binary)) throw new Error(`CloakBrowser executable not found: ${binary}`)

  // The SDK accepts its binary override as an environment variable. Restore a
  // temporary default afterwards so a later licensed launch can use the SDK's
  // normal download path. The shared browser must be launched only once.
  const previous = process.env.CLOAKBROWSER_BINARY_PATH
  if (binary && !previous) process.env.CLOAKBROWSER_BINARY_PATH = binary
  try {
    const options = cloakLaunchOptions()
    const context = await launchPersistentContext({
      ...options,
      args: [...(options.args ?? []), "--no-sandbox", `--remote-debugging-port=${cdpPort}`],
      launchOptions: { handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false },
    })
    try {
      // The existing challenge handler uses this hook to locate closed shadow
      // roots created after navigation, including Turnstile's checkbox.
      await context.addInitScript(() => {
        const attachShadow = Element.prototype.attachShadow
        Element.prototype.attachShadow = function (init: ShadowRootInit) {
          const root = attachShadow.call(this, init)
          Object.defineProperty(this, "shadowRootUnl", { configurable: true, value: root })
          return root
        }
      })
      return context
    } catch (error) {
      await context.close()
      throw error
    }
  } catch (error) {
    // Playwright's multiline launch errors may contain the full Chromium
    // command line, including an authenticated proxy. Never log that command.
    let message = error instanceof Error ? error.message.split("\n", 1)[0] : "unknown error"
    for (const secret of [process.env.CLOAKBROWSER_LICENSE_KEY, process.env.CLOAK_PROXY]) {
      if (secret) message = message.replaceAll(secret, "[redacted]")
    }
    throw new Error(`CloakBrowser launch failed: ${message}`)
  } finally {
    if (previous === undefined) delete process.env.CLOAKBROWSER_BINARY_PATH
    else process.env.CLOAKBROWSER_BINARY_PATH = previous
  }
}
