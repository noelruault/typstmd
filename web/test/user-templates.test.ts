import { describe, it, expect, beforeEach } from "bun:test";
import { classifyDroppedFile } from "../src/dropped-file";
import {
  listUserTemplates,
  getUserTemplate,
  hasUserTemplate,
  saveUserTemplate,
  removeUserTemplate,
  type KeyValueStore,
} from "../src/user-templates";

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("classifying a brought-in file", () => {
  it("treats .typ as a template", () => {
    expect(classifyDroppedFile("cv-typstmd.typ")).toBe("template");
    expect(classifyDroppedFile("CV.TYP")).toBe("template");
  });

  it("treats markdown as the document", () => {
    for (const name of ["notes.md", "notes.markdown", "notes.mdown", "notes.mkd"]) {
      expect(classifyDroppedFile(name)).toBe("markdown");
    }
    expect(classifyDroppedFile("untitled", "text/markdown")).toBe("markdown");
  });

  it("treats anything else as an asset to map into the VFS", () => {
    expect(classifyDroppedFile("photo.png")).toBe("asset");
    expect(classifyDroppedFile("logo.svg", "image/svg+xml")).toBe("asset");
  });

  it("does not mistake a typ-like name for a template", () => {
    expect(classifyDroppedFile("typst-notes.md")).toBe("markdown");
    expect(classifyDroppedFile("template.typ.png")).toBe("asset");
  });
});

describe("user template store", () => {
  let store: KeyValueStore;

  beforeEach(() => {
    store = memoryStore();
  });

  it("round-trips a template", () => {
    saveUserTemplate("cv.typ", "#set page(paper: \"a4\")", store);
    expect(getUserTemplate("cv.typ", store)).toBe('#set page(paper: "a4")');
    expect(hasUserTemplate("cv.typ", store)).toBe(true);
  });

  it("reports absence rather than throwing", () => {
    expect(getUserTemplate("nope.typ", store)).toBeNull();
    expect(hasUserTemplate("nope.typ", store)).toBe(false);
  });

  it("lists names sorted, so the picker order is stable", () => {
    saveUserTemplate("zeta.typ", "z", store);
    saveUserTemplate("alpha.typ", "a", store);
    saveUserTemplate("Mid.typ", "m", store);
    expect(listUserTemplates(store)).toEqual(["alpha.typ", "Mid.typ", "zeta.typ"]);
  });

  it("ignores unrelated keys in the same storage", () => {
    store.setItem("typstmd:autosave", "# document");
    store.setItem("typstmd:template:default", "theme override");
    saveUserTemplate("mine.typ", "source", store);
    expect(listUserTemplates(store)).toEqual(["mine.typ"]);
  });

  it("overwrites by name, which is what the confirmation guards", () => {
    saveUserTemplate("cv.typ", "first", store);
    saveUserTemplate("cv.typ", "second", store);
    expect(getUserTemplate("cv.typ", store)).toBe("second");
    expect(listUserTemplates(store)).toEqual(["cv.typ"]);
  });

  it("removes one without touching the rest", () => {
    saveUserTemplate("a.typ", "a", store);
    saveUserTemplate("b.typ", "b", store);
    removeUserTemplate("a.typ", store);
    expect(listUserTemplates(store)).toEqual(["b.typ"]);
  });
});
