# Plan: Cloudflare Worker + Optional Storage Backend

## Goal

Add a Cloudflare Worker that serves the web app and optionally provides a multi-user file storage API. Storage is a **hard on/off switch** controlled entirely at runtime — the same JS bundle deploys to GitHub Pages (storage off) or Cloudflare Worker (storage on) with zero code changes.

### Storage OFF (default)

- Deploy anywhere static: GitHub Pages, Cloudflare Pages, Netlify, any CDN
- No backend, no account, no config
- **Single auto-save slot**: whatever is in the editor is silently written to one `localStorage` key on every input (debounced). Restored on next visit. No file list, no file names, no multi-file management — it's a scratchpad, not a filing cabinet.
- An **"Unsaved" badge** appears in the toolbar while there are unsaved changes (between input and the debounced write). Disappears once saved.
- No file panel UI in this mode. The multi-file manager is hidden entirely to avoid implying durable, named storage.
- Fully offline-capable after first load (WASM cached)
- This is the primary publish target — always works, always ships

### Storage ON (opt-in)

- Deploy the Cloudflare Worker instead
- Worker serves the same static assets + exposes a `/api/*` file storage API
- Files stored per-user in R2, encrypted client-side before upload
- Multi-user, authenticated (email + password, JWT sessions)
- **File panel UI unlocks**: named files, list, save/open/delete appear only when authenticated
- User switches on by logging in; switches off by logging out (file panel disappears, returns to scratchpad mode)

The switch between modes is **runtime, not build-time**. The Worker injects `window.__TYPSTMD__` into the HTML for authenticated sessions. Its absence means storage off — no flags, no env vars, no rebuild required.

## Deployment matrix

| Deploy target | Storage | Multi-user | Auth required | WASM works |
|---|---|---|---|---|
| GitHub Pages | localStorage only | No | No | Yes |
| Cloudflare Pages | localStorage only | No | No | Yes |
| Cloudflare Worker (unauthenticated) | localStorage only | No | No | Yes |
| Cloudflare Worker (authenticated) | R2 + KV (encrypted) | Yes | Yes | Yes |

The app is never broken. Storage OFF is not a degraded mode — it is the base product.

## What the Worker is NOT

The Cloudflare Worker does **not** run the Typst WASM compiler. The 21MB WASM binary exceeds the 10MB Worker bundle limit and requires `SharedArrayBuffer`, which is unavailable in Workers. All PDF compilation stays browser-side, unchanged.

## Architecture

```
Browser
  ├── remark pipeline (unchanged)
  ├── WASM Typst compiler (unchanged, browser-only)
  ├── StorageProvider (NEW — localStorage or Cloudflare)
  └── File panel UI (NEW — list, save, open, delete)
         │
         │ fetch /api/* (only when window.__TYPSTMD__ present)
         ▼
Cloudflare Worker  ← optional, storage OFF works without this entirely
  ├── Serve static assets (web/dist/ with COOP/COEP headers)
  ├── POST /api/auth/register|login  →  JWT
  └── /api/files/*  (JWT-protected)
           │
           ├── Cloudflare R2  — encrypted file content
           └── Cloudflare KV  — user records + file index
```

## Storage abstraction

### Storage OFF — single auto-save slot (no abstraction needed)

No `StorageProvider` interface in this phase. Just one `localStorage` key:

```typescript
const AUTOSAVE_KEY = "typstmd:autosave";

// On init: restore last session
const saved = localStorage.getItem(AUTOSAVE_KEY);
if (saved) { editor.value = saved; currentMarkdown = saved; }

// On input: mark dirty, schedule save (1000ms debounce)
function scheduleSave() {
  setDirty();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(AUTOSAVE_KEY, editor.value);
    clearDirty();
  }, 1000);
}
```

The "Unsaved" badge reflects the gap between the user's last keystroke and the debounced write. It is not a manual save — the user never has to click Save. The badge just communicates that the in-memory state is slightly ahead of what's on disk.

### Storage ON — StorageProvider abstraction (introduced with cloud backend)

The `StorageProvider` interface is only introduced in Phase 3, when there are actually two implementations to abstract over. Premature abstraction here adds complexity with no benefit.

```typescript
// web/src/storage/index.ts  (Phase 3+)

export interface FileEntry {
  id: string;
  name: string;
  size: number;
  updatedAt: string;     // ISO 8601
}

export interface StorageProvider {
  listFiles(): Promise<FileEntry[]>;
  loadFile(id: string): Promise<string>;
  saveFile(id: string, name: string, content: string): Promise<void>;
  deleteFile(id: string): Promise<void>;
  createFile(name: string, content: string): Promise<string>;
}

export function createStorageProvider(): StorageProvider {
  const cfg = (window as any).__TYPSTMD__;
  if (cfg?.apiUrl) return new CloudflareStorageProvider(cfg.apiUrl, cfg.token);
  // LocalStorageProvider here is the multi-file implementation,
  // not the single-slot auto-save used in storage OFF mode.
  return new LocalStorageProvider();
}
```

`window.__TYPSTMD__` is injected by the Worker into the HTML for authenticated sessions. Its absence means no cloud backend — the file panel stays hidden and the single auto-save slot remains active.

### CloudflareStorageProvider (Phase 3+)

- Wraps `fetch` calls to `/api/files/*`
- Attaches `Authorization: Bearer {token}` header
- Encrypts content with AES-GCM before POST/PUT (see Encryption section)
- Decrypts on load
- Error handling: 401 → clear token + prompt re-login; 5xx → surface to UI

## Cloudflare Worker structure

```
cf-worker/
├── wrangler.toml           # R2 + KV bindings, JWT_SECRET, FRONTEND_ORIGIN
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts            # Entry point: routing, static serving, CORS, COOP/COEP
    ├── auth.ts             # Register, login, JWT sign/verify (Web Crypto API)
    ├── files.ts            # File CRUD handlers
    └── storage.ts          # R2 + KV adapter (thin wrapper)
```

### wrangler.toml

```toml
name = "typstmd"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[r2_buckets]]
binding = "FILES"
bucket_name = "typstmd-files"

[[kv_namespaces]]
binding = "USERS"
id = ""          # fill after: wrangler kv:namespace create USERS

[vars]
# JWT_SECRET: set via wrangler secret put JWT_SECRET (never in toml)
# PBKDF2_ITERATIONS: 310000  (OWASP 2024 minimum for PBKDF2-HMAC-SHA256)
```

### Env type (TypeScript)

```typescript
export interface Env {
  FILES: R2Bucket;
  USERS: KVNamespace;
  JWT_SECRET: string;
  PBKDF2_ITERATIONS?: string;
}
```

### Routing (index.ts)

```
GET  /                      → inject __TYPSTMD__ config into index.html, serve with COOP/COEP
GET  /main.js, /worker.js   → serve from R2 assets bucket (or embedded via Wrangler assets)
GET  /*.wasm                → serve with application/wasm + COOP/COEP
POST /api/auth/register     → auth.register()
POST /api/auth/login        → auth.login()
GET  /api/files             → files.list()
POST /api/files             → files.create()
GET  /api/files/:id         → files.get()
PUT  /api/files/:id         → files.update()
DELETE /api/files/:id       → files.delete()
```

Static assets can be served two ways (decide at deploy time):
- **Wrangler Assets binding** (`[assets] directory = "../web/dist"`) — simplest, Worker serves the dist folder directly. Requires `bun run build` in `web/` before `wrangler deploy`.
- **R2 assets bucket** — upload dist files to a separate R2 bucket, Worker fetches and proxies. More control, allows independent asset updates.

Start with Wrangler Assets binding (simpler). R2 assets are a future optimization.

## Auth design

No external auth provider. All crypto uses the **Web Crypto API** (available in Workers and browsers).

### Registration

1. Client sends `{ email, password }` over HTTPS
2. Worker generates a random 16-byte salt
3. Derives key: `PBKDF2(password, salt, 310000 iterations, SHA-256, 32 bytes)`
4. Stores in KV: `user:{email}` → `{ userId, passwordHash (hex), salt (hex) }`
5. Returns signed JWT: `{ sub: userId, email, exp: now+7d }`

### Login

1. Client sends `{ email, password }`
2. Worker loads `user:{email}` from KV
3. Re-derives key with stored salt, compares with `crypto.subtle.verify` (constant-time)
4. Returns new JWT on success, 401 on mismatch

### JWT

- Algorithm: `HS256` with `JWT_SECRET` (minimum 32 bytes, set via `wrangler secret`)
- Payload: `{ sub: userId, email, iat, exp }`
- Lifetime: 7 days (refresh on any authenticated request)
- Verification middleware applied to all `/api/files/*` routes

No refresh token for now. Token expiry prompts re-login. Future: add refresh endpoint.

### File ownership

All file API routes extract `userId` from the verified JWT. No cross-user access is possible through the API — file IDs are `{userId}/{fileId}` in R2, and the KV index is keyed per user.

## File storage layout

### R2 bucket (file content)

```
{userId}/{fileId}          →  opaque bytes (AES-GCM ciphertext or plaintext)
```

Object metadata (R2 custom metadata):
```json
{ "name": "my-doc.md", "iv": "<hex AES-GCM IV>" }
```

### KV namespace (user data + file index)

```
user:{email}               →  { userId, passwordHash, salt }
files:{userId}             →  JSON FileEntry[]  (name, size, updatedAt — no content)
```

The KV index is updated on every write/delete. It stores only metadata so `listFiles()` is a single KV read, not an R2 list call (which is slower and has eventual-consistency quirks).

## Encryption

Client-side AES-GCM. The encryption key is derived from the user's **password**, never sent to the server. Server compromise exposes ciphertext only.

### Key derivation (browser)

```typescript
// web/src/storage/crypto.ts

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
```

Salt is stored in the browser (in `localStorage` alongside the token) so `deriveKey` can be called on every session without re-prompting password. Salt is unique per user and generated at registration.

### Encrypt / decrypt

```typescript
// Encrypt before upload
const iv = crypto.getRandomValues(new Uint8Array(12));
const ciphertext = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  key,
  new TextEncoder().encode(plaintext)
);

// Decrypt after download
const plaintext = await crypto.subtle.decrypt(
  { name: "AES-GCM", iv },   // iv stored in R2 object metadata
  key,
  ciphertext
);
```

The `iv` is stored in R2 object metadata (not secret, just unique per file version). The encryption key never leaves the browser.

**Consequence**: password reset = permanent data loss (no server-side key escrow). Document this clearly in the UI. Future: key backup via secret phrase.

## Configuration injection

The Worker injects runtime config into `index.html` before serving it:

```typescript
// In index.ts, when serving /
function injectConfig(html: string, userId: string | null, apiUrl: string): string {
  const config = userId
    ? `<script>window.__TYPSTMD__={apiUrl:"${apiUrl}",userId:"${userId}"}</script>`
    : "";
  return html.replace("</head>", `${config}</head>`);
}
```

When `userId` is null (unauthenticated), no config is injected. `createStorageProvider()` falls back to `LocalStorageProvider`. The app works without login.

The Worker reads `userId` from the JWT in the `Authorization` header or a `__session` cookie (cookie approach is simpler for browser navigation). When no valid token is present, the Worker still serves the page — just without the config injection.

## UI: unsaved badge (Storage OFF)

A badge in the toolbar signals that the editor content is ahead of the auto-saved state. Plain CSS, no framework:

```css
.badge-unsaved {
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  background-color: #fefce8;
  padding: 4px 8px;
  font-size: 0.75rem;
  line-height: 1rem;
  font-weight: 500;
  color: #854d0e;
  box-shadow: inset 0 0 0 1px rgb(202 138 4 / 0.2);
}

@media (prefers-color-scheme: dark) {
  .badge-unsaved {
    background-color: rgb(250 204 21 / 0.1);
    color: #eab308;
    box-shadow: inset 0 0 0 1px rgb(250 204 21 / 0.2);
  }
}
```

The badge is hidden by default (`display: none`) and shown only while `isDirty`. It disappears the moment the debounced auto-save fires. The user never has to click anything — this is purely informational.

## UI: file panel (Storage ON only)

The file panel is **not rendered at all** in storage OFF mode. It is conditionally mounted in `main.ts` only when `window.__TYPSTMD__` is present. This prevents any UI that implies durable named storage when none exists.

```
[ New ]  [ Save ]

  my-document.md         2026-03-27
  research-notes.md      2026-03-25
  draft.md               2026-03-20

[ Delete ]
```

Behavior:
- **New**: clears editor, generates new ID
- **Save**: calls `provider.saveFile(currentId, currentName, editor.value)`. Prompts for name on first save.
- Click a file entry: loads it into the editor and triggers compile
- **Delete**: confirm dialog, then `provider.deleteFile(id)`

Auth flow:
- If `window.__TYPSTMD__` is absent but user clicks "Save to Cloud": show login/register modal
- After login: Worker returns JWT, browser stores token + reinjects config, file panel mounts

## Phased implementation

### Phase 1 — Auto-save + unsaved badge (no backend)

No new files. Changes only in `index.html` and `main.ts`.

1. Add `.badge-unsaved` CSS + `<span id="unsaved-badge">` element to `index.html` toolbar
2. In `main.ts`: on init, restore editor content from `localStorage.getItem("typstmd:autosave")`
3. Add `isDirty` state, `setDirty()` / `clearDirty()` toggling badge visibility
4. Add `scheduleSave()` (1000ms debounce) writing to `"typstmd:autosave"` and calling `clearDirty()`
5. Wire input handler: `setDirty()` + `scheduleSave()` + existing `scheduleCompile()`
6. Also save on drag-and-drop file load (after `reader.onload`)
7. **Gate:** type something → badge appears; 1s idle → badge disappears; reload → content restored

### Phase 2 — Cloudflare Worker skeleton + static serving

`cf-worker/` directory, wrangler setup, static serving only. No file API yet.

1. Create `cf-worker/` with `wrangler.toml`, `package.json`, `tsconfig.json`
2. Implement static serving with COOP/COEP headers (reads from Wrangler Assets binding)
3. Wire the build: `cd web && bun run build` → `web/dist/`, then `wrangler deploy`
4. Add a `Makefile` target: `make deploy` runs both steps
5. **Gate:** `wrangler dev` serves the working web app with COOP/COEP headers; WASM loads and compiles a PDF

### Phase 3 — Auth + StorageProvider + file API

KV + R2 + frontend abstraction layer introduced together. No point building half an abstraction.

1. Create `USERS` KV namespace + `FILES` R2 bucket via wrangler
2. Implement `auth.ts`: register (PBKDF2 + KV write), login (verify + JWT sign), JWT middleware
3. Add routes: `POST /api/auth/register`, `POST /api/auth/login`
4. Implement `storage.ts` R2/KV adapter + `files.ts` CRUD route handlers
5. Implement config injection (`injectConfig`) in Worker static serving
6. Introduce `web/src/storage/` module: `StorageProvider` interface + `CloudflareStorageProvider` + `crypto.ts`
7. Add login/register modal + file panel to `main.ts`, mounted only when `window.__TYPSTMD__` present
8. **Gate:** register → login → JWT injected → file panel appears → save file → reload → file present → R2 object is ciphertext

### Phase 4 — Polish + deployment

1. Error handling: 401 re-login prompt, network errors, offline indicator
2. File rename support; conflict warning on overwrite
3. `make deploy` target in root `Makefile` (`cd web && bun run build && wrangler deploy`)
4. RECOMMENDATIONS.md update: document GitHub Pages (storage off) vs Worker (storage on) deploy paths
5. **Gate:** full round-trip: register → save 3 files → log out → log in → all files present; deploy to GitHub Pages → no file panel, badge works, content persists across reload

## File structure (after all phases)

```
cf-worker/
  wrangler.toml
  package.json
  tsconfig.json
  src/
    index.ts              # routing + static serving + config injection
    auth.ts               # PBKDF2 hash, JWT sign/verify
    files.ts              # file CRUD route handlers
    storage.ts            # R2 + KV thin adapter

web/
  index.html              # (updated Phase 1) badge CSS + #unsaved-badge element
  src/
    main.ts               # (updated Phase 1) auto-save, dirty state, badge toggle
                          # (updated Phase 3) file panel + auth modal (storage ON only)
    storage/              # (Phase 3+, not needed for storage OFF)
      index.ts            # StorageProvider interface + FileEntry + factory
      cloudflare.ts       # CloudflareStorageProvider (fetch + crypto)
      crypto.ts           # key derivation + AES-GCM encrypt/decrypt
```

Note: no `local.ts` multi-file provider. Storage OFF uses a single key directly in `main.ts`. The `StorageProvider` abstraction is only for the cloud backend.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| PBKDF2 in browser is slow (~1s at 310k iterations) | Medium | Show spinner during login/register; acceptable UX trade-off for security |
| IV reuse in AES-GCM | Critical | Always generate `crypto.getRandomValues(new Uint8Array(12))` per encryption. Never reuse. |
| Password change = key change = all files re-encrypt | Medium | Deferred: for now, password change is not supported. Document clearly. |
| KV index diverges from R2 objects | Low | KV is the source of truth for the index. R2 orphans are harmless (no cost, not listed). |
| Workers free tier limits (100k req/day) | Low | Sufficient for personal/small-team use. Upgrade to paid at scale. |
| wrangler.toml `JWT_SECRET` accidentally committed | Critical | Use `wrangler secret put JWT_SECRET` only. `.gitignore` wrangler.toml secrets. Add CI check. |
| COOP/COEP breaks iframe PDF preview | Medium | Already confirmed working in dev server; same headers in Worker. Test early in Phase 2. |
| R2 eventual consistency on rapid writes | Low | File save is user-initiated (not background), so races are unlikely in practice |

## Dependencies (new)

**cf-worker:**
- `wrangler` CLI (dev dependency, `npm i -g wrangler`)
- No npm runtime dependencies — uses Workers built-ins only (Web Crypto, R2, KV)

**web:**
- No new npm packages — `crypto.subtle` is a browser built-in

## Not in scope

| Feature | Reason |
|---|---|
| OAuth / social login | Adds external dependency; simple email+password is sufficient to start |
| File sharing between users | Requires signed URLs or access control lists in R2; separate project |
| Server-side encryption key | Key escrow defeats the security model; requires HSM or external KMS |
| File versioning / history | R2 supports versioning natively; enable when needed |
| Collaborative editing | Real-time sync is a separate product concern |
| CLI pipeline integration | The CLI (`cmd/converter.sh`) is a separate tool; no cross-concern needed |
