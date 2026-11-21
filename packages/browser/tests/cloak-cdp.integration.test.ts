import { afterAll, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium } from "playwright-core"
import { launchCloakContext } from "../src/cloak-launch"

const binary = process.env.CLOAK_TEST_BINARY
const profile = await mkdtemp(join(tmpdir(), "trawl-cloak-test-"))
afterAll(async () => rm(profile, { recursive: true, force: true }))

describe.skipIf(!binary)("CloakBrowser CDP", () => {
  test("CDP and the API context share cookies", async () => {
    const server = createServer()
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Unable to reserve a port")
    const port = address.port
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    const fixture = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () =>
        new Response("<button onclick='this.textContent=\"clicked\"'>click</button>", {
          headers: { "content-type": "text/html" },
        }),
    })
    const old = {
      binary: process.env.CLOAKBROWSER_BINARY_PATH,
      profile: process.env.CLOAK_USER_DATA_DIR,
      fonts: process.env.CLOAKBROWSER_SUPPRESS_FONT_WARNING,
    }
    process.env.CLOAKBROWSER_BINARY_PATH = binary
    process.env.CLOAK_USER_DATA_DIR = profile
    process.env.CLOAKBROWSER_SUPPRESS_FONT_WARNING = "1"
    try {
      const context = await launchCloakContext(port)
      try {
        const page = await context.newPage()
        await page.goto(fixture.url.href)
        await page.locator("button").click({ timeout: 10_000 })
        expect(await page.locator("button").textContent()).toBe("clicked")
        if (process.env.CLOAK_EXPECT_TIMEZONE) {
          expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(
            process.env.CLOAK_EXPECT_TIMEZONE,
          )
        }
        const remote = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
        try {
          await context.addCookies([{ name: "shared", value: "yes", url: "http://example.com" }])
          expect(await remote.contexts()[0].cookies("http://example.com")).toMatchObject([
            { name: "shared", value: "yes" },
          ])
        } finally {
          await remote.close()
        }
      } finally {
        await context.close()
      }
    } finally {
      fixture.stop(true)
      for (const [key, value] of Object.entries({
        CLOAKBROWSER_BINARY_PATH: old.binary,
        CLOAK_USER_DATA_DIR: old.profile,
        CLOAKBROWSER_SUPPRESS_FONT_WARNING: old.fonts,
      })) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  }, 30_000)
})
