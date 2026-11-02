import { describe, expect, it } from "vitest";
import { comparePassCatalog } from "../release/check-catalog.js";

describe("release catalog verification", () => {
  const ids = ["cline-pass/glm-5.3", "cline-pass/kimi-k3"];

  it("accepts a reordered pass lineup without reading metadata or other buckets", () => {
    expect(
      comparePassCatalog(ids, {
        clinePass: [
          { id: "cline-pass/kimi-k3", pricing: null, context_length: null },
          { id: "cline-pass/glm-5.3", architecture: null },
        ],
        recommended: [{ id: "cline-pass/not-a-pass-model" }],
        free: [{ id: "cline-free/free-model" }],
        clineCloud: [{ id: "cline-cloud/cloud-model" }],
      }),
    ).toEqual({ missing: [], unexpected: [] });
  });

  it("reports every missing and remote-only ID, including retired IDs", () => {
    expect(
      comparePassCatalog(ids, {
        clinePass: [
          { id: "cline-pass/new-a" },
          { id: "cline-pass/new-b" },
          { id: "cline-pass/glm-5.2" },
        ],
        recommended: ids.map((id) => ({ id })),
      }),
    ).toEqual({
      missing: ids,
      unexpected: ["cline-pass/new-a", "cline-pass/new-b", "cline-pass/glm-5.2"],
    });
  });

  it("does not infer pass membership from vendor slugs", () => {
    expect(() =>
      comparePassCatalog(ids, {
        clinePass: [{ id: "other/glm-5.3" }, { id: "moonshotai/kimi-k3" }],
      }),
    ).toThrow("Invalid ClinePass ID");
  });

  it.each([
    null,
    [],
    { data: ids.map((id) => ({ id })) },
    { clinePass: null },
    { clinePass: [] },
    { clinePass: [null] },
    { clinePass: [{}] },
    { clinePass: [{ id: 42 }] },
    { clinePass: [{ id: "cline-pass/" }] },
    { clinePass: [{ id: " cline-pass/glm-5.3" }] },
    { clinePass: [{ id: "cline-pass/glm-5.3" }, { id: "cline-pass/glm-5.3" }] },
  ])(
    "rejects incomplete or malformed feed %j instead of passing release verification",
    (payload) => {
      expect(() => comparePassCatalog(ids, payload)).toThrow(/clinePass|ClinePass/);
    },
  );
});
