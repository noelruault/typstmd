// Copied to the clipboard by the "Onboard your agent" toolbar button so a user can paste it into a coding agent (Claude Code, Codex, Cursor, OpenCode). Self-contained on purpose: it must work even if the agent cannot fetch the linked docs. The three composition modes below are the real contract
// enforced by assemble() in pipeline.ts; keep them in sync if that changes.
export const AGENT_ONBOARDING_PROMPT = `You are helping me author a **template** for typstmd, a Markdown-to-PDF tool.

typstmd has two front-ends that share one design contract:
- Web (https://noelruault.github.io/typstmd/): Markdown -> remark -> Typst -> Typst WASM compiler -> PDF, 100% in the browser, no server, the document never leaves the machine.
- CLI: Markdown -> Pandoc -> Typst -> PDF.

A template is a single Typst (.typ) file that styles the document. typstmd generates the document BODY from my Markdown, then composes it with your template one of three ways (it auto-detects which):

1. conf() convention -- if your file defines
     #let conf(title: none, authors: (), date: none, lang: "en", toc: false, doc) = { /* ...style..., then */ doc }
   typstmd calls it as \`#show: doc => conf(doc)\` and passes the frontmatter (title/author/date/toc). Use this for a full-document template.
2. Body marker -- put \`#typstmd-body\` wherever the body should land; typstmd substitutes it with the serialized body.
3. Raw preamble -- anything else: typstmd appends the body after your file and passes title/author/date via \`#set document(...)\`.

Modes 2 and 3 have no conf() to receive \`lang\`, so typstmd emits \`#set text(lang: "...")\` ahead of your template; setting lang yourself overrides it.

Hard rules:
- Emit standard, idiomatic, self-contained Typst that compiles in the upstream \`typst\` compiler (0.14+). No custom macros, no hidden context, no Markdown syntax in the Typst.
- Name only fonts you can rely on. The browser build ships Libertinus Serif plus a small set; naming a font the build cannot resolve makes every compile warn. When unsure, do not set a font family.
- Size inline code relative to context (e.g. 0.78em), never an absolute pt, or code inside a heading renders at body size.
- Keep it to ONE .typ file.

For full context, fetch:
- https://raw.githubusercontent.com/noelruault/typstmd/main/AGENTS.md  (project, template contract, and the Typst gotchas that each cost a wrong attempt)
- https://noelruault.github.io/typstmd/llms.txt  (site summary, links to README and CLAUDE.md)

Now: ask me what kind of document this template is for (report, CV, letter, slides notes, ...) and its look, then produce ONE .typ template that follows the contract above. Finish by telling me to load it in typstmd with the "Open .typ" button or by dragging the file onto the page.`;
