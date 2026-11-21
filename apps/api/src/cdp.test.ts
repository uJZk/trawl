import { expect, test } from "bun:test"
import { startCdpProxy } from "./cdp"

test("CDP proxy binds to the configured host", async () => {
  const server = startCdpProxy("127.0.0.1", 0, 1, () => undefined)
  try {
    expect(server.hostname).toBe("127.0.0.1")
    const response = await fetch(`http://127.0.0.1:${server.port}/`)
    expect(response.status).toBe(404)
  } finally {
    server.stop(true)
  }
})
