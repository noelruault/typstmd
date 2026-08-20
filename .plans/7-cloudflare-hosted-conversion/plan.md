---
plan: cloudflare-hosted-conversion
title: Make the CLI (markdown → PDF) available as a Cloudflare-hosted endpoint
created: 2026-07-14
owner: @noelruault
status: draft
walkthrough:
  last_run: null
  completed_at: null
execution:
  started: null
  completed: null
  prs: []
tags: [distribution, cloudflare, optional]
notes: >-
  Contradicts the standing client-only distribution decision (see memory
  project_distribution-client-only). This is the "if we change our mind" spec,
  not a commitment. Overlaps in scope with .plans/3-cloudflare-worker-optional-storage.
---

## 1. Summary

Optionally expose markdown → PDF as a **scriptable, Cloudflare-hosted** endpoint:

```
curl -X POST --data-binary @report.md https://convert.<domain>/convert -o report.pdf
```

This is only worth doing if a *scriptable* endpoint (CI, curl, another program) is genuinely wanted — the human-interactive need is already met by the free in-browser web app on Pages. It also costs money (no free Cloudflare path runs the converter), so it contradicts the standing **client-only** decision; treat this plan as the spec to pull off the shelf if that decision changes.

**Recommended approach:** a Cloudflare **Worker** running the existing web pipeline (`remark → typst-WASM`), with **no pandoc**. This gives parity-by-construction (literally the same serializer the UI uses) and scales to zero. **Fallback:** Cloudflare **Containers** running the native Docker image (pandoc + typst) if the Worker/WASM route fails the size/CPU limits.

Why not the alternatives (settled research, do not re-derive): CF Pages is static-only (can't run it); CF Workers are V8 isolates that can't run native binaries (no native pandoc/typst, only JS + WASM); GitHub Pages/GHCR/Actions give no free live endpoint either.

## 2. Changes

### 2.0 GATE: verify current Cloudflare limits + pricing before building

**No code until this is checked against live CF docs** (limits drift; verify external contracts first). R2 is NOT a blocker (10GB free, free egress, 21MB trivial → host the WASM there, fetch at runtime). The real Worker-runtime constraints to confirm:
- **Worker memory cap (~128MB per isolate)** — must hold the 21MB WASM + instantiated typst compiler + fonts + one compile. Likely the binding limit.
- **Can a Worker instantiate a ~21MB WASM fetched at runtime?** CF historically favored deploy-time WASM binding; large runtime `WebAssembly.instantiate` has had size/startup limits. Verify this is even possible.
- **Per-request CPU-time cap** — typst compile is CPU-heavy; confirm the paid limit covers a real document.
- Cloudflare Containers pricing (fallback).

Outcome of this gate decides whether the Worker route is viable at all. If memory/instantiation fails → go straight to the Containers fallback (2.F).

### 2.1 Extract the shared md→typst serializer

**Files:** `web/src/mdast-to-typst.ts`, `web/src/pipeline.ts` (`markdownToTypst`).

Factor the markdown→Typst path into a module importable by **both** the web app and the Worker, so there is one serializer, not two that drift. No behavior change to the web app.

### 2.2 Worker: `POST /convert`

**New:** a `wrangler` project (co-located, e.g. `worker/`).

Handler: read request body (markdown; enforce size cap) → `markdownToTypst` → typst-WASM compile → respond `application/pdf`. Reuse the exact WASM compiler package the web app pins (`@myriaddreamin/typst-ts-web-compiler`).

### 2.3 WASM + fonts loading strategy

Host the ~21MB typst WASM **and** the Libertinus font bytes in an **R2** bucket (no relevant size limit, free egress); fetch + instantiate on cold start, cache in module scope across requests. This sidesteps the Worker bundle-size cap entirely — the open question is whether the Worker *runtime* can instantiate WASM that large within the memory cap (see 2.0), not whether R2 can store it. Fonts must be handed to the compiler explicitly or output diverges from the UI.

### 2.4 Security / limits

Untrusted input compiled server-side, so: request size cap (e.g. 256 KB markdown), CPU/time guard, no filesystem reliance (WASM is in-memory and sandboxed — no host FS/network, lower risk than native), rate limiting (CF built-in), optional API key for private use.

### 2.5 Deploy + route

`wrangler deploy`; bind a route/subdomain (e.g. `convert.<domain>`). Optionally wire into CI to deploy on tag.

### 2.6 Parity test

curl a fixture doc through the endpoint; diff the PDF against (a) the web app output — should be **identical** (same serializer) — and (b) the local CLI output (may differ slightly; that is the known pandoc-vs-remark gap, out of scope here).

### 2.F FALLBACK: Cloudflare Containers (only if 2.0 / 2.3 kill the Worker route)

Deploy the Docker image (pandoc + typst + filters + template + fonts, or a typst-only + remark image) as a CF Container behind the same `/convert` wrapper. Paid. Loses parity-by-construction unless the image uses the typst-only + remark path rather than pandoc.

## 3. Order of landing

1. **2.0** verify limits — gate; may end the free/Worker route before any code.
2. **2.1** extract the shared serializer (safe, no user-facing change).
3. **2.2–2.4** build + test the Worker locally (`wrangler dev`): WASM load, fonts, security caps.
4. **2.5** deploy to a route.
5. **2.6** parity test against the web app.
6. **2.F** only if the gate/limits prove the Worker route unviable.

## 4. Risk surface

- **Worker memory cap (~128MB) + runtime WASM instantiation** (biggest). Holding a 21 MB WASM + typst compiler + fonts + a compile in one isolate may not fit, and a Worker may not be able to instantiate WASM that large fetched at runtime at all. R2 removes the *bundle-size* blocker but not this.
- **Worker CPU-time cap** — large docs may blow the per-request CPU budget.
- **Cold-start latency** — fetching from R2 + instantiating ~21 MB WASM on a cold isolate.
- **Font loading** — omit it → output differs from the UI.
- **typst-WASM version drift** — Worker and web app must pin the *same* compiler version or outputs diverge.
- **Cost** — not free; contradicts the client-only free posture. Must be a deliberate choice.
- **Scope overlap** with `.plans/3-cloudflare-worker-optional-storage` — decide whether convert lives in that Worker or a standalone one, so there aren't two competing deploys.

## 5. Open questions

- Do we even want this? Client-only is the standing decision; this plan only fires if that changes.
- Free vs paid acceptable? (No free CF path runs the converter.)
- Public, or API-keyed / private?
- R2-host the WASM (settled: yes, no size limit) — but does the Worker runtime accept a 21MB WASM within the memory cap? (Gate 2.0.)
- Subdomain / route name?
- Merge with plan #3's Worker (serve app + storage + convert in one) or ship a standalone convert Worker?
