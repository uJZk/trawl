#!/bin/sh
set -eu

case "$(printf '%s' "${CLOAK_HEADLESS:-true}" | tr '[:upper:]' '[:lower:]')" in
  0|false|no)
    if [ -z "${DISPLAY:-}" ]; then
      exec xvfb-run -a bun run apps/api/src/index.ts
    fi
    ;;
esac
exec bun run apps/api/src/index.ts
