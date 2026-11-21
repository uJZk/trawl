import { describe, expect, test } from "bun:test"
import { selectCloakBinary } from "../src/cloak-launch"

describe("CloakBrowser binary selection", () => {
  test("uses the bundled free build without a license", () => {
    expect(selectCloakBinary({})).toBe("/opt/cloakbrowser/chrome")
  })

  test("lets the SDK choose the licensed build when a key is set", () => {
    expect(selectCloakBinary({ CLOAKBROWSER_LICENSE_KEY: "cb_example" })).toBeUndefined()
  })

  test("honors an explicit binary even when a license is set", () => {
    expect(
      selectCloakBinary({ CLOAKBROWSER_BINARY_PATH: "/custom/chrome", CLOAKBROWSER_LICENSE_KEY: "cb_example" }),
    ).toBe("/custom/chrome")
  })
})
