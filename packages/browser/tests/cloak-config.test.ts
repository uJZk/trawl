import { describe, expect, test } from "bun:test"
import { cloakLaunchOptions } from "../src/cloak-config"

describe("CloakBrowser configuration", () => {
  test("preserves the SDK's default fingerprint when no overrides are provided", () => {
    expect(cloakLaunchOptions({})).toEqual({
      userDataDir: "/data/cloakbrowser",
      headless: true,
      humanize: false,
      args: [],
    })
  })

  test("passes fingerprint values and enabled switches as separate arguments", () => {
    const options = cloakLaunchOptions({
      CLOAK_FINGERPRINT: "12345",
      CLOAK_FINGERPRINT_PLATFORM: "windows",
      CLOAK_FINGERPRINT_TIMEZONE: "Asia/Shanghai",
      CLOAK_FINGERPRINT_NOISE: "false",
      CLOAK_FINGERPRINT_ALLOW_3P_COOKIES: "true",
      CLOAK_FINGERPRINT_PORTABLE_COOKIES: "false",
      CLOAK_PROXY: "http://proxy.example:8080",
      CLOAK_HEADLESS: "false",
      CLOAK_HUMANIZE: "yes",
      CLOAK_HUMAN_PRESET: "careful",
    })
    expect(options).toMatchObject({ proxy: "http://proxy.example:8080", headless: false, humanize: true })
    expect(options.args).toEqual([
      "--fingerprint=12345",
      "--fingerprint-platform=windows",
      "--fingerprint-timezone=Asia/Shanghai",
      "--fingerprint-noise=false",
      "--fingerprint-allow-3p-cookies",
    ])
  })

  test("rejects invalid booleans and human presets", () => {
    expect(() => cloakLaunchOptions({ CLOAK_HEADLESS: "maybe" })).toThrow("CLOAK_HEADLESS")
    expect(() => cloakLaunchOptions({ CLOAK_FINGERPRINT_ALLOW_3P_COOKIES: "maybe" })).toThrow(
      "CLOAK_FINGERPRINT_ALLOW_3P_COOKIES",
    )
    expect(() => cloakLaunchOptions({ CLOAK_HUMAN_PRESET: "fast" })).toThrow("CLOAK_HUMAN_PRESET")
  })

  test("passes additional switches and a proxy bypass without exposing CDP control arguments", () => {
    const options = cloakLaunchOptions({
      CLOAK_PROXY: "http://user:pass@proxy.example:8080",
      CLOAK_PROXY_BYPASS: "localhost,127.0.0.1",
      CLOAK_EXTRA_ARGS: '["--fingerprint-max-touch-points=2"]',
    })
    expect(options.proxy).toEqual({
      server: "http://proxy.example:8080",
      username: "user",
      password: "pass",
      bypass: "localhost,127.0.0.1",
    })
    expect(options.args).toEqual(["--fingerprint-max-touch-points=2"])
    expect(() => cloakLaunchOptions({ CLOAK_EXTRA_ARGS: '["--remote-debugging-port=1234"]' })).toThrow()
    expect(() => cloakLaunchOptions({ CLOAK_EXTRA_ARGS: "not-json" })).toThrow()
  })
})
