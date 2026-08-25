import { describe, it, expect } from "bun:test";
import { markdownToTypst } from "../src/pipeline";
import { encodeFrontmatterDict, encodeDocumentSet } from "../src/frontmatter";

const CONF_TEMPLATE = `#let conf(title: none, authors: (), date: none, lang: "en", toc: false, doc) = { doc }`;
const RAW_TEMPLATE = `#set page(paper: "a4")\n#set text(font: "Libertinus Serif")`;

describe("template assembly", () => {
  it("routes a template that defines conf through conf", () => {
    const { typstSource } = markdownToTypst("Body.", { templateOverride: CONF_TEMPLATE });
    expect(typstSource).toContain("#show: doc => conf(doc)");
    expect(typstSource.indexOf("#show: doc => conf")).toBeGreaterThan(typstSource.indexOf("#let conf"));
  });

  it("appends the body to a raw template instead of injecting conf", () => {
    const { typstSource } = markdownToTypst("Body.", { templateOverride: RAW_TEMPLATE });
    expect(typstSource).not.toContain("conf(");
    expect(typstSource.trimEnd().endsWith("Body.")).toBe(true);
  });

  it("gives a raw template its document properties through set document", () => {
    const md = "---\ntitle: A Title\nauthor: Someone\n---\n\nBody.";
    const { typstSource } = markdownToTypst(md, { templateOverride: RAW_TEMPLATE });
    // Strings, not content: document.author rejects content, which only a compile catches.
    expect(typstSource).toContain('#set document(title: "A Title", author: ("Someone",))');
  });

  it("puts set document before a show-with template rule so it is not inside a container", () => {
    const template = `#import "@preview/x:0.1.0": tmpl\n#show: tmpl.with(title: [T])`;
    const md = "---\ntitle: A Title\n---\n\nBody.";
    const { typstSource } = markdownToTypst(md, { templateOverride: template });
    expect(typstSource).toContain("#set document(");
    expect(typstSource.indexOf("#set document(")).toBeLessThan(typstSource.indexOf("#show: tmpl.with"));
  });

  it("substitutes the body marker when a template places content itself", () => {
    const template = `#set page(paper: "a4")\n#block[#typstmd-body]`;
    const { typstSource } = markdownToTypst("Body.", { templateOverride: template });
    expect(typstSource).toContain("#block[Body.]");
    expect(typstSource).not.toContain("#typstmd-body");
  });

  it("keeps a conf template working when frontmatter is present", () => {
    const md = "---\ntitle: T\ntoc: true\n---\n\nBody.";
    const { typstSource } = markdownToTypst(md, { templateOverride: CONF_TEMPLATE });
    expect(typstSource).toContain("title: [T]");
    expect(typstSource).toContain("toc: true");
  });
});

describe("frontmatter dictionary", () => {
  const dictFor = (md: string) => {
    const { typstSource } = markdownToTypst(md, { templateOverride: RAW_TEMPLATE });
    return typstSource.slice(0, typstSource.indexOf(")\n") + 1);
  };

  it("exposes keys typstmd assigns no meaning to", () => {
    const dict = dictFor("---\nsubtitle: Sub\nmainfont: UIBsans\ncolorlinks: true\n---\n\nBody.");
    expect(dict).toContain("subtitle: [Sub]");
    expect(dict).toContain("mainfont: [UIBsans]");
    expect(dict).toContain("colorlinks: true");
  });

  it("encodes arrays, nested maps and empty values", () => {
    const dict = dictFor("---\nkeywords:\n  - One\n  - Two\nauthor:\n  name: A\n  email: b@c\nsubtitle:\n---\n\nBody.");
    expect(dict).toContain("keywords: ([One], [Two])");
    // `@` is escaped: bare, Typst reads it as a reference.
    expect(dict).toContain("author: (name: [A], email: [b\\@c])");
    expect(dict).toContain("subtitle: none");
  });

  it("gives a single-element array a trailing comma so Typst reads an array", () => {
    const dict = dictFor("---\nkeywords:\n  - Only\n---\n\nBody.");
    expect(dict).toContain("keywords: ([Only],)");
  });

  it("escapes values instead of interpolating raw YAML", () => {
    const dict = dictFor("---\ntitle: 'Cost #5 [draft] ~ok'\n---\n\nBody.");
    expect(dict).toContain("\\#5");
    expect(dict).toContain("\\[draft\\]");
    expect(dict).toContain("\\~ok");
  });

  it("emits nothing when there is no frontmatter", () => {
    expect(encodeFrontmatterDict({})).toBe("");
    expect(encodeDocumentSet({})).toBe("");
  });

  it("quotes keys that are not bare Typst identifiers", () => {
    const dict = dictFor("---\ntitlepage-logo: ./a.png\n'weird key': 1\n---\n\nBody.");
    expect(dict).toContain("titlepage-logo: [./a.png]");
    expect(dict).toContain('"weird key": 1');
  });
});
