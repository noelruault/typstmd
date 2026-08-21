import { describe, it, expect } from "bun:test";
import {
  formatSelection,
  parseSelection,
  fontThemeId,
  pristineSource,
  resolveTemplateSource,
  type SelectionSources,
} from "../src/template-selection";

const sources: SelectionSources = {
  themeTemplate: (id) => (id === "aitelier" ? "THEME aitelier" : undefined),
  starterPreamble: (id) => (id === "basic-resume" ? "STARTER basic-resume" : undefined),
  userTemplate: (name) => (name === "cv.typ" ? "USER cv.typ" : null),
  override: (key) => (key === "theme:aitelier" ? "EDITED aitelier" : null),
};

describe("selection round trip", () => {
  it("formats and parses each kind", () => {
    for (const kind of ["theme", "starter", "user"] as const) {
      const value = formatSelection({ kind, id: "x" });
      expect(parseSelection(value)).toEqual({ kind, id: "x" });
    }
  });

  it("keeps colons inside a user template's name", () => {
    // A file name is not a safe id, so only the first colon separates.
    expect(parseSelection("user:my:cv.typ")).toEqual({ kind: "user", id: "my:cv.typ" });
  });

  it("rejects values that are not selections", () => {
    for (const value of ["", "default", "theme:", ":default", "nonsense:x"]) {
      expect(parseSelection(value)).toBeNull();
    }
  });
});

describe("font descriptor", () => {
  it("uses the theme's own fonts for a theme", () => {
    expect(fontThemeId("theme:aitelier")).toBe("aitelier");
  });

  it("falls back to the default set for anything not a theme", () => {
    // Only a theme declares fonts; a package or a brought-in file gets what the browser loads.
    expect(fontThemeId("starter:basic-resume")).toBe("default");
    expect(fontThemeId("user:cv.typ")).toBe("default");
    expect(fontThemeId("garbage")).toBe("default");
  });
});

describe("resolving a template source", () => {
  it("reads each kind from its own place", () => {
    expect(resolveTemplateSource("starter:basic-resume", sources)).toBe("STARTER basic-resume");
    expect(resolveTemplateSource("user:cv.typ", sources)).toBe("USER cv.typ");
  });

  it("prefers an edit over the pristine source", () => {
    expect(resolveTemplateSource("theme:aitelier", sources)).toBe("EDITED aitelier");
    expect(pristineSource({ kind: "theme", id: "aitelier" }, sources)).toBe("THEME aitelier");
  });

  it("returns null for an unknown id so the caller can fall back", () => {
    expect(resolveTemplateSource("theme:nope", sources)).toBeNull();
    expect(resolveTemplateSource("user:missing.typ", sources)).toBeNull();
    expect(resolveTemplateSource("not-a-selection", sources)).toBeNull();
  });
});
