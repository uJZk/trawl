import { describe, expect, test } from "bun:test"
import { cloakLaunchOptions } from "../src/cloak-config"

describe("CloakBrowser configuration", () => {
  test("defaults to careful humanization and San Francisco when the system uses UTC", () => {
    expect(cloakLaunchOptions({}, "UTC")).toEqual({
      userDataDir: "/data/cloakbrowser",
      headless: true,
      humanize: true,
      humanPreset: "careful",
      args: ["--fingerprint-timezone=America/Los_Angeles"],
    })
  })

  test.each([
    ["UTC", "America/Los_Angeles"],
    ["Etc/UTC", "America/Los_Angeles"],
    ["Etc/GMT+0", "America/Los_Angeles"],
    ["Asia/Shanghai", "Asia/Shanghai"],
    ["Europe/London", "Europe/London"],
  ])("selects the browser time zone for system time zone %s", (system, expected) => {
    expect(cloakLaunchOptions({}, system).args).toContain(`--fingerprint-timezone=${expected}`)
  })

  test("honors explicit time zone and humanization overrides", () => {
    const options = cloakLaunchOptions(
      { CLOAK_FINGERPRINT_TIMEZONE: "UTC", CLOAK_HUMANIZE: "false", CLOAK_HUMAN_PRESET: "default" },
      "Asia/Shanghai",
    )
    expect(options).toMatchObject({ humanize: false, humanPreset: "default", args: ["--fingerprint-timezone=UTC"] })
    expect(cloakLaunchOptions({ CLOAK_EXTRA_ARGS: '["--fingerprint-timezone=Asia/Tokyo"]' }, "UTC").args).toEqual([
      "--fingerprint-timezone=Asia/Tokyo",
    ])
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
    const options = cloakLaunchOptions(
      {
        CLOAK_PROXY: "http://user:pass@proxy.example:8080",
        CLOAK_PROXY_BYPASS: "localhost,127.0.0.1",
        CLOAK_EXTRA_ARGS: '["--fingerprint-max-touch-points=2"]',
      },
      "UTC",
    )
    expect(options.proxy).toEqual({
      server: "http://proxy.example:8080",
      username: "user",
      password: "pass",
      bypass: "localhost,127.0.0.1",
    })
    expect(options.args).toEqual(["--fingerprint-max-touch-points=2", "--fingerprint-timezone=America/Los_Angeles"])
    expect(() => cloakLaunchOptions({ CLOAK_EXTRA_ARGS: '["--remote-debugging-port=1234"]' })).toThrow()
    expect(() => cloakLaunchOptions({ CLOAK_EXTRA_ARGS: "not-json" })).toThrow()
  })
})
