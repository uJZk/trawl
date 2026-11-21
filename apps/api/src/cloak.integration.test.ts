import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium } from "playwright-core"

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("No port")
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  return address.port
}

describe.skipIf(!process.env.CLOAK_TEST_BINARY && !process.env.CLOAKBROWSER_LICENSE_KEY)(
  "shared CloakBrowser API",
  () => {
    test("FlareSolverr, native API, and CDP share state without closing external pages", async () => {
      const profile = await mkdtemp(join(tmpdir(), "trawl-cloak-api-"))
      const [port, cdpPort, internalPort] = await Promise.all([freePort(), freePort(), freePort()])
      const target = Bun.serve({
        port: 0,
        hostname: "127.0.0.1",
        async fetch(request) {
          return new Response(
            `<html><body>cookie=${request.headers.get("cookie") ?? "none"} method=${request.method} body=${await request.text()} ${"fixture ".repeat(30)}</body></html>`,
            {
              headers: { "content-type": "text/html", "set-cookie": "shared=working; Path=/" },
            },
          )
        },
      })
      const url = `http://127.0.0.1:${target.port}/`
      const child = Bun.spawn([process.execPath, "run", "apps/api/src/index.ts"], {
        cwd: join(import.meta.dir, "../../.."),
        stdout: "ignore",
        stderr: "ignore",
        env: {
          ...process.env,
          PORT: String(port),
          CLOAK_CDP_PORT: String(cdpPort),
          CLOAK_CDP_INTERNAL_PORT: String(internalPort),
          CLOAK_SINGLE_SESSION: "true",
          CLOAK_USER_DATA_DIR: profile,
          CLOAKBROWSER_BINARY_PATH: process.env.CLOAK_TEST_BINARY,
          CLOAKBROWSER_SUPPRESS_FONT_WARNING: "1",
          CLOAK_PROXY_BYPASS: "localhost,127.0.0.1",
          SESSION_CACHE_DRIVER: "memory",
          WAF_DETECTION_ENABLED: "false",
          METRICS_DB_PATH: ":memory:",
        },
      })
      const api = `http://127.0.0.1:${port}`
      const send = async (path: string, body: object) => {
        const response = await fetch(`${api}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
        return { status: response.status, body: (await response.json()) as any }
      }
      try {
        const deadline = Date.now() + 90_000
        while (true) {
          if (
            await fetch(`${api}/health`)
              .then((res) => res.ok)
              .catch(() => false)
          )
            break
          if (child.exitCode !== null || Date.now() > deadline) throw new Error("API did not become ready")
          await Bun.sleep(200)
        }
        const remote = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`)
        try {
          const context = remote.contexts()[0]
          const externalPage = await context.newPage()
          await externalPage.goto(url)
          expect(
            await externalPage.evaluate(() => {
              const host = document.createElement("div")
              host.attachShadow({ mode: "closed" })
              return Boolean((host as HTMLElement & { shadowRootUnl?: ShadowRoot }).shadowRootUnl)
            }),
          ).toBe(true)
          await externalPage.evaluate(() => localStorage.setItem("shared", "yes"))
          const rsshubContext = await remote.newContext()
          await expect(remote.newContext()).rejects.toThrow("Only one context")
          const rsshubPage = await rsshubContext.newPage()
          await rsshubPage.goto(url)
          expect(await rsshubPage.evaluate(() => localStorage.getItem("shared"))).toBe("yes")
          expect(await rsshubPage.evaluate(() => document.cookie)).toContain("shared=working")
          await rsshubContext.close()
          expect(externalPage.isClosed()).toBe(false)
          const launch = encodeURIComponent(JSON.stringify({ args: ["--proxy-server=http://127.0.0.1:8888"] }))
          expect((await fetch(`http://127.0.0.1:${cdpPort}/json/version?launch=${launch}`)).status).toBe(400)
          const flare = await send("/v1", { cmd: "request.get", url, maxTimeout: 20_000 })
          if (flare.status !== 200) throw new Error(`FlareSolverr failed: ${JSON.stringify(flare.body)}`)
          expect(flare.status).toBe(200)
          expect(flare.body.status).toBe("ok")
          expect(flare.body.solution.response).toContain("shared=working")
          expect(externalPage.isClosed()).toBe(false)
          expect(await externalPage.evaluate(() => localStorage.getItem("shared"))).toBe("yes")
          const created = await send("/v1", { cmd: "sessions.create", session: "alias" })
          expect(created.body.status).toBe("ok")
          const named = await send("/v1", { cmd: "request.get", session: "alias", url, maxTimeout: 20_000 })
          expect(named.body.solution.response).toContain("shared=working")
          const destroyed = await send("/v1", { cmd: "sessions.destroy", session: "alias" })
          expect(destroyed.body.status).toBe("ok")
          const native = await send("/scrape", { url, maxTimeout: 20_000 })
          expect(native.status).toBe(200)
          expect(native.body.html).toContain("shared=working")
          const concurrent = await Promise.all([
            send("/scrape", { url, maxTimeout: 20_000 }),
            send("/scrape", { url, maxTimeout: 20_000 }),
          ])
          expect(concurrent.map((result) => result.status)).toEqual([200, 200])
          const post = await send("/v1", { cmd: "request.post", url, postData: "name=example", maxTimeout: 20_000 })
          expect(post.body.solution.response).toContain("method=POST body=name=example")
          expect(externalPage.isClosed()).toBe(false)
          expect(await context.cookies(url)).toMatchObject([{ name: "shared", value: "working" }])
        } finally {
          await remote.close()
        }
      } finally {
        child.kill("SIGTERM")
        await child.exited
        target.stop(true)
        await rm(profile, { recursive: true, force: true })
      }
    }, 120_000)
  },
)
