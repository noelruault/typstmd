import { describe, it, expect } from "bun:test";
import { themes, getTheme, FONT_URLS, LOCAL_FONT_FAMILIES } from "../src/themes";
import { starters, getStarter } from "../src/starters";
import { markdownToTypst } from "../src/pipeline";

// Fonts a theme may name: the self-hosted baseline (web/fonts/) plus the CDN faces fontsFor
// loads by URL. Anything else renders a fallback.
const ALLOWED_FONTS = [...LOCAL_FONT_FAMILIES, ...Object.keys(FONT_URLS)];

describe("theme registry", () => {
  it("has unique ids", () => {
    const ids = themes.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("falls back to default for an unknown id", () => {
    expect(getTheme("nope").id).toBe("default");
  });

  for (const theme of themes) {
    describe(theme.id, () => {
      it("defines conf with the parameters the pipeline passes", () => {
        for (const param of ["title:", "authors:", "date:", "lang:", "toc:"]) {
          expect(theme.template).toContain(param);
        }
        // The trailing positional parameter receives the body.
        expect(theme.template).toMatch(/doc,\s*\)\s*=/);
      });

      it("names only fonts it can load", () => {
        // Embedded or a FONT_URLS CDN face; anything else renders a fallback.
        const named = [
          ...theme.template.matchAll(/(?:font: |[\w-]*-font\s*=\s*)"([^"]+)"/g),
        ].map((m) => m[1]);
        expect(named.length).toBeGreaterThan(0);
        for (const family of named) {
          expect(ALLOWED_FONTS).toContain(family);
        }
      });

      it("sizes code relative to its context", () => {
        // An absolute size renders inline code in a heading at body size.
        const rawSizes = [...theme.template.matchAll(/show raw: set text\([^)]*size: ([^,)]+)/g)];
        for (const [, size] of rawSizes) {
          expect(size).toContain("em");
        }
      });

      it("routes a document through conf", () => {
        const { typstSource } = markdownToTypst("# Title\n\nBody.\n", { themeId: theme.id });
        expect(typstSource).toContain("#show: doc => conf(");
      });
    });
  }
});

describe("universe starters", () => {
  it("has unique ids", () => {
    const ids = starters.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns undefined for an unknown id", () => {
    expect(getStarter("nope")).toBeUndefined();
  });

  for (const starter of starters) {
    describe(starter.id, () => {
      it("pins the version it imports", () => {
        expect(starter.spec).toMatch(/^[a-z0-9-]+:\d+\.\d+\.\d+$/);
        expect(starter.preamble).toContain(`@preview/${starter.spec}`);
      });

      it("applies the package with a show rule and defines no conf", () => {
        expect(starter.preamble).toMatch(/#show:\s+\S+\.with\(/);
        // A starter must take the raw-template path, not typstmd's conf shim.
        expect(starter.preamble).not.toContain("#let conf(");
      });

      it("assembles without a conf invocation", () => {
        const { typstSource } = markdownToTypst("Body.\n", { templateOverride: starter.preamble });
        expect(typstSource).not.toContain("conf(");
        expect(typstSource).toContain(`@preview/${starter.spec}`);
      });
    });
  }
});
