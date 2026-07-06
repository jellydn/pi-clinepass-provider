import { describe, it, expect, vi } from "vitest";
import {
  walkAuthPaths,
  walkClineProviderSettings,
  defaultAuthPaths,
} from "../../src/config-store.js";

// ─── defaultAuthPaths ───────────────────────────────────────────────────────

describe("defaultAuthPaths", () => {
  it("includes Cline CLI providers.json and pi auth.json paths", () => {
    const paths = defaultAuthPaths("/home/user");
    expect(paths).toContain("/home/user/.cline/data/settings/providers.json");
    expect(paths).toContain("/home/user/.pi/agent/auth.json");
  });
});

// ─── walkAuthPaths ──────────────────────────────────────────────────────────

describe("walkAuthPaths", () => {
  it("returns the value from the first file that has it", () => {
    const readFile = () => JSON.stringify({ apiKey: "found_key" });
    const fileExists = () => true;
    const result = walkAuthPaths({ readFile, fileExists }, (parsed) => {
      const key = parsed.apiKey;
      return typeof key === "string" ? key : undefined;
    });
    expect(result).toBe("found_key");
  });

  it("tries paths in order when first lacks the value", () => {
    const calls: string[] = [];
    const readFile = (p: string) => {
      calls.push(p);
      if (p.includes("first")) return JSON.stringify({ name: "first" });
      return JSON.stringify({ apiKey: "found_in_second" });
    };
    const fileExists = () => true;
    const result = walkAuthPaths(
      {
        readFile,
        fileExists,
        authPaths: ["/tmp/first.json", "/tmp/second.json"],
      },
      (parsed) => {
        const key = parsed.apiKey;
        return typeof key === "string" ? key : undefined;
      },
    );
    expect(result).toBe("found_in_second");
    expect(calls).toHaveLength(2);
  });

  it("returns undefined when no file has the value", () => {
    const readFile = () => JSON.stringify({ name: "test" });
    const fileExists = () => true;
    const result = walkAuthPaths({ readFile, fileExists }, (parsed) => {
      const key = parsed.apiKey;
      return typeof key === "string" ? key : undefined;
    });
    expect(result).toBeUndefined();
  });

  it("returns undefined when no file exists", () => {
    const fileExists = () => false;
    const result = walkAuthPaths({ fileExists }, () => "value");
    expect(result).toBeUndefined();
  });

  it("skips malformed files and logs a warning", () => {
    const readFile = () => "not json";
    const fileExists = () => true;
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = walkAuthPaths({ readFile, fileExists }, () => "value");
      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("failed to read auth file"));
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("skips files that throw ENOENT without logging", () => {
    const readFile = () => {
      const error = new Error("no such file");
      (error as NodeJS.ErrnoException).code = "ENOENT";
      throw error;
    };
    const fileExists = () => true;
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = walkAuthPaths({ readFile, fileExists }, () => "value");
      expect(result).toBeUndefined();
      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("propagates extractor errors without mislabeling them as file read failures", () => {
    const readFile = () => JSON.stringify({ apiKey: "key" });
    const fileExists = () => true;
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(() =>
        walkAuthPaths({ readFile, fileExists }, () => {
          throw new Error("extractor bug");
        }),
      ).toThrow("extractor bug");
      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("skips non-object JSON", () => {
    const readFile = () => JSON.stringify("string_not_object");
    const fileExists = () => true;
    const result = walkAuthPaths({ readFile, fileExists }, () => "value");
    expect(result).toBeUndefined();
  });
});

// ─── walkClineProviderSettings ──────────────────────────────────────────────

describe("walkClineProviderSettings", () => {
  const extractApiKey = (settings: Record<string, unknown>) => {
    const key = settings.apiKey;
    return typeof key === "string" ? key : undefined;
  };

  it("extracts from cline-pass provider when present", () => {
    const parsed = {
      providers: {
        "cline-pass": { settings: { apiKey: "cp_key" } },
      },
    };
    expect(walkClineProviderSettings(parsed, extractApiKey)).toBe("cp_key");
  });

  it("extracts from cline provider when cline-pass is absent", () => {
    const parsed = {
      providers: {
        cline: { settings: { apiKey: "cline_key" } },
      },
    };
    expect(walkClineProviderSettings(parsed, extractApiKey)).toBe("cline_key");
  });

  it("prefers cline-pass over cline when both are present", () => {
    const parsed = {
      providers: {
        "cline-pass": { settings: { apiKey: "cp_key" } },
        cline: { settings: { apiKey: "cline_key" } },
      },
    };
    expect(walkClineProviderSettings(parsed, extractApiKey)).toBe("cp_key");
  });

  it("returns undefined when providers field is missing", () => {
    expect(walkClineProviderSettings({}, extractApiKey)).toBeUndefined();
  });

  it("returns undefined when parsed is not a record", () => {
    expect(
      walkClineProviderSettings(null as unknown as Record<string, unknown>, extractApiKey),
    ).toBeUndefined();
  });

  it("returns undefined when providers is not an object", () => {
    expect(walkClineProviderSettings({ providers: "not_object" }, extractApiKey)).toBeUndefined();
  });

  it("returns undefined when settings is missing in provider entry", () => {
    const parsed = {
      providers: {
        "cline-pass": { tokenSource: "manual" },
      },
    };
    expect(walkClineProviderSettings(parsed, extractApiKey)).toBeUndefined();
  });

  it("returns undefined when no provider matches", () => {
    const parsed = {
      providers: {
        other: { settings: { apiKey: "other_key" } },
      },
    };
    expect(walkClineProviderSettings(parsed, extractApiKey)).toBeUndefined();
  });
});
