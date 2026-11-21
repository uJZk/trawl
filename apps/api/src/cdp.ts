type Connection = {
  path: string
  upstream?: WebSocket
  pending: (string | Uint8Array)[]
  closed: boolean
  creating: Set<number>
  targets: Set<string>
  internalId: number
  aliasActive: boolean
}

/** Expose Chromium's loopback-only CDP endpoint and rewrite discovery URLs. */
export function startCdpProxy(port: number, internalPort: number, defaultContextId: () => string | undefined) {
  const closeOwnedPages = (data: Connection) => {
    if (data.upstream?.readyState !== WebSocket.OPEN) return
    for (const targetId of data.targets) {
      data.upstream.send(JSON.stringify({ id: data.internalId--, method: "Target.closeTarget", params: { targetId } }))
    }
    data.targets.clear()
  }
  return Bun.serve<Connection>({
    port,
    hostname: "0.0.0.0",
    async fetch(request, server) {
      const url = new URL(request.url)
      const launch = url.searchParams.get("launch")
      if (launch) {
        try {
          const options = JSON.parse(launch)
          if (
            options.proxy ||
            (Array.isArray(options.args) &&
              options.args.some((arg: unknown) => typeof arg === "string" && /^--proxy-(?:server|pac-url)=/.test(arg)))
          )
            return new Response("Per-client proxy is unavailable with the shared browser", { status: 400 })
        } catch {
          return new Response("Invalid launch options", { status: 400 })
        }
      }
      if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
        if (!url.pathname.startsWith("/devtools/")) return new Response("Not found", { status: 404 })
        if (
          server.upgrade(request, {
            data: {
              path: url.pathname + url.search,
              pending: [],
              closed: false,
              creating: new Set(),
              targets: new Set(),
              internalId: -1,
              aliasActive: false,
            },
          })
        )
          return
        return new Response("Upgrade failed", { status: 400 })
      }
      if (request.method !== "GET" || !url.pathname.startsWith("/json"))
        return new Response("Not found", { status: 404 })
      try {
        const response = await fetch(`http://127.0.0.1:${internalPort}${url.pathname}${url.search}`)
        const text = await response.text()
        const externalHost = request.headers.get("host") || `localhost:${port}`
        const body = text
          .replaceAll(`127.0.0.1:${internalPort}`, externalHost)
          .replaceAll(`localhost:${internalPort}`, externalHost)
        return new Response(body, {
          status: response.status,
          headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
        })
      } catch {
        return new Response("Browser unavailable", { status: 503 })
      }
    },
    websocket: {
      open(socket) {
        const upstream = new WebSocket(`ws://127.0.0.1:${internalPort}${socket.data.path}`)
        socket.data.upstream = upstream
        upstream.binaryType = "arraybuffer"
        upstream.onopen = () => {
          if (socket.data.closed) return upstream.close()
          for (const message of socket.data.pending)
            upstream.send(typeof message === "string" ? message : new Uint8Array(message))
          socket.data.pending = []
        }
        upstream.onmessage = (event) => {
          if (typeof event.data === "string" && socket.data.path.startsWith("/devtools/browser/")) {
            try {
              const reply = JSON.parse(event.data)
              if (typeof reply.id === "number" && reply.id < 0) return
              if (socket.data.creating.delete(reply.id) && typeof reply.result?.targetId === "string")
                socket.data.targets.add(reply.result.targetId)
            } catch {}
          }
          socket.send(typeof event.data === "string" ? event.data : new Uint8Array(event.data))
        }
        upstream.onclose = () => socket.close()
        upstream.onerror = () => socket.close()
      },
      message(socket, message) {
        const upstream = socket.data.upstream
        let outgoing = message
        if (typeof message === "string" && socket.data.path.startsWith("/devtools/browser/")) {
          try {
            const command = JSON.parse(message)
            if (typeof command.id === "number" && !command.sessionId) {
              if (command.method === "Target.createBrowserContext") {
                const contextId = defaultContextId()
                const error = !contextId
                  ? "Shared browser is unavailable"
                  : socket.data.aliasActive
                    ? "Only one context is available per CDP connection"
                    : command.params?.proxyServer
                      ? "Per-context proxy is unavailable with the shared browser"
                      : undefined
                if (!error) socket.data.aliasActive = true
                socket.send(
                  JSON.stringify(
                    error
                      ? { id: command.id, error: { code: -32000, message: error } }
                      : { id: command.id, result: { browserContextId: contextId } },
                  ),
                )
                return
              }
              if (
                command.method === "Target.disposeBrowserContext" &&
                command.params?.browserContextId === defaultContextId()
              ) {
                closeOwnedPages(socket.data)
                socket.data.aliasActive = false
                socket.send(JSON.stringify({ id: command.id, result: {} }))
                return
              }
              if (command.method === "Target.createTarget" && command.params?.browserContextId === defaultContextId())
                socket.data.creating.add(command.id)
              if (command.method === "Target.closeTarget") socket.data.targets.delete(command.params?.targetId)
              // Most CDP domains address the default context by omitting this
              // field; its TargetInfo ID is not accepted by those commands.
              if (command.params?.browserContextId === defaultContextId()) {
                delete command.params.browserContextId
                outgoing = JSON.stringify(command)
              }
            }
          } catch {}
        }
        if (upstream?.readyState === WebSocket.OPEN)
          upstream.send(typeof outgoing === "string" ? outgoing : new Uint8Array(outgoing))
        else socket.data.pending.push(outgoing)
      },
      close(socket) {
        socket.data.closed = true
        closeOwnedPages(socket.data)
        socket.data.upstream?.close()
      },
    },
  })
}
