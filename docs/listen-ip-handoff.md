# Listener address handoff

The API accepts `HOST` (default `0.0.0.0`) when run directly. The Compose files use
`LISTEN_IP` (default `0.0.0.0`) for the host-side API and MITM port bindings; the
container API listener remains on all interfaces. `MITM_HOST` independently controls
the proxy listener inside the process. Cloak CDP remains published on loopback.
Set `HOST=127.0.0.1` for direct API use or `LISTEN_IP=127.0.0.1` for Compose.

On 2026-11-21, `docker compose config` verified loopback port bindings for all four
Compose files, and `git diff --check` passed. API configuration tests were added but
could not be run because Bun and project dependencies were unavailable in this
environment. Next: run the API config tests and typecheck in a Bun-enabled checkout;
verify actual connectivity in the intended deployment environment.
