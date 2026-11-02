import { describe, it, expect } from "vitest";
import { isRecord, stringValue } from "../../src/utils.js";

// ─── isRecord ───────────────────────────────────────────────────────────────

describe("isRecord", () => {
  it("returns true for plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ key: "value", num: 42 })).toBe(true);
    expect(isRecord({ nested: { inner: true } })).toBe(true);
  });

  it("returns true for objects with null prototype", () => {
    expect(isRecord(Object.create(null))).toBe(true);
  });

  it("returns false for null", () => {
    expect(isRecord(null)).toBe(false);
  });

  it("returns false for arrays", () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isRecord("string")).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord(Symbol("test"))).toBe(false);
  });

  it("returns false for functions", () => {
    expect(isRecord(() => {})).toBe(false);
    function Foo() {}
    expect(isRecord(Foo)).toBe(false);
  });

  it("returns true for Date instances (Date is a non-null, non-array object)", () => {
    expect(isRecord(new Date())).toBe(true);
  });
});

// ─── stringValue ────────────────────────────────────────────────────────────

describe("stringValue", () => {
  it("returns the string for string values", () => {
    expect(stringValue("hello")).toBe("hello");
    expect(stringValue("")).toBe("");
    expect(stringValue("42")).toBe("42");
  });

  it("returns undefined for non-string values", () => {
    expect(stringValue(42)).toBeUndefined();
    expect(stringValue(true)).toBeUndefined();
    expect(stringValue(null)).toBeUndefined();
    expect(stringValue(undefined)).toBeUndefined();
    expect(stringValue({})).toBeUndefined();
    expect(stringValue([])).toBeUndefined();
  });
});
