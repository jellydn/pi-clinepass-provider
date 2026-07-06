import { describe, it, expect } from "vitest";
import { isRecord, stringValue, numberValue, booleanValue } from "../../src/utils.js";

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

// ─── numberValue ────────────────────────────────────────────────────────────

describe("numberValue", () => {
  it("returns the number for finite numeric values", () => {
    expect(numberValue(42)).toBe(42);
    expect(numberValue(0)).toBe(0);
    expect(numberValue(-1)).toBe(-1);
    expect(numberValue(3.14)).toBeCloseTo(3.14);
  });

  it("returns undefined for Infinity", () => {
    expect(numberValue(Infinity)).toBeUndefined();
    expect(numberValue(-Infinity)).toBeUndefined();
  });

  it("returns undefined for NaN", () => {
    expect(numberValue(NaN)).toBeUndefined();
  });

  it("parses parseable numeric strings", () => {
    expect(numberValue("42")).toBe(42);
    expect(numberValue("3.14")).toBeCloseTo(3.14);
    expect(numberValue("0")).toBe(0);
    expect(numberValue("-1")).toBe(-1);
  });

  it("rejects strings with trailing non-numeric text", () => {
    expect(numberValue("12px")).toBeUndefined();
    expect(numberValue("1e")).toBeUndefined();
  });

  it("returns undefined for non-parseable strings", () => {
    expect(numberValue("abc")).toBeUndefined();
    expect(numberValue("")).toBeUndefined();
    expect(numberValue("Infinity")).toBeUndefined();
  });

  it("returns undefined for non-numeric types", () => {
    expect(numberValue(true)).toBeUndefined();
    expect(numberValue(null)).toBeUndefined();
    expect(numberValue(undefined)).toBeUndefined();
    expect(numberValue({})).toBeUndefined();
    expect(numberValue([])).toBeUndefined();
  });
});

// ─── booleanValue ───────────────────────────────────────────────────────────

describe("booleanValue", () => {
  it("returns true for true", () => {
    expect(booleanValue(true)).toBe(true);
  });

  it("returns false for false", () => {
    expect(booleanValue(false)).toBe(false);
  });

  it("returns undefined for truthy non-booleans", () => {
    expect(booleanValue(1)).toBeUndefined();
    expect(booleanValue("true")).toBeUndefined();
    expect(booleanValue({})).toBeUndefined();
    expect(booleanValue([])).toBeUndefined();
  });

  it("returns undefined for falsy non-booleans", () => {
    expect(booleanValue(0)).toBeUndefined();
    expect(booleanValue("")).toBeUndefined();
    expect(booleanValue(null)).toBeUndefined();
    expect(booleanValue(undefined)).toBeUndefined();
  });
});
