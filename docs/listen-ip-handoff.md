# Listener address handoff

The API and shared-browser CDP proxy use `HOST` (default `0.0.0.0`) as their bind address. The Compose files use
`LISTEN_IP` (default `0.0.0.0`) for the host-side API and MITM port bindings; the
container API listener remains on all interfaces. `MITM_HOST` independently controls
the proxy listener inside the process. Cloak CDP remains published on host loopback, but is reachable on the Compose network.
Set `HOST=127.0.0.1` for direct API and CDP use or `LISTEN_IP=127.0.0.1` for Compose.

On 2026-11-21, `docker compose config` verified loopback port bindings for all four
Compose files, and `git diff --check` passed. The API typecheck, host configuration test, and CDP bind test passed after installing
Bun and dependencies. The CDP bind test starts a real listener. Browser-backed CDP
integration and actual connectivity in the intended deployment environment remain
to be verified for the latest listener change.
