# Adding a highlight theme

Themes in this folder are picked up automatically at build time by the Bun plugin in `web/plugins/themes.ts`. You don't register them anywhere.

## TL;DR

1. Create `your-theme.ts` in this folder.
2. Export a `themes: HighlightTheme[]` array. You may ship multiple variants per file.

That's it. No changes to `index.ts`, no HTML edits, no central registry. The `<select>` in `web/index.html` is populated at runtime from the build-time registry.

## The builder

All themes go through `buildTheme(colors, syntax)` from `../theme-builder.ts`. It returns a CodeMirror `Extension` that combines:

- `EditorView.theme(...)` sets the editor chrome (background, gutter, cursor, selection, search highlight).
- `syntaxHighlighting(HighlightStyle.define(...))` maps Lezer tags to colors.

There is no other custom logic. If you need behavior that the builder doesn't expose (extra tags, per-token font styling, decorations), extend `buildTheme` itself rather than duplicating the setup inline.

## Required exports

```ts
// your-theme.ts
import { buildTheme, type HighlightTheme } from "../theme-builder";

const myDark = buildTheme({ /* ThemeColors */ }, { /* SyntaxColors */ });

export const themes: HighlightTheme[] = [
  { id: "my-dark", name: "My Dark", dark: true, extension: myDark },
];
```

The plugin imports the `themes` named export from every `*.ts` in this folder and concatenates them into `allThemes`. Shape must match:

```ts
interface HighlightTheme {
  id: string;        // kebab-case, unique across the whole registry
  name: string;      // display name shown in the UI
  dark: boolean;     // informational; doesn't drive rendering
  extension: Extension;
}
```

## Editor chrome (`ThemeColors`)

| Field             | Purpose                                               |
| ----------------- | ----------------------------------------------------- |
| `bg`              | Editor background.                                    |
| `fg`              | Default text color.                                   |
| `gutterBg`        | Line-number gutter background.                        |
| `gutterFg`        | Line-number color.                                    |
| `activeGutterFg`  | Line-number color on the active line.                 |
| `activeLine`      | Active-line background (use alpha like `bf` suffix).  |
| `cursor`          | Cursor stroke color.                                  |
| `selection`       | Selection background (translucent: `3d` alpha).       |
| `search`          | Search-match background.                              |
| `searchActive`    | Optional. Current search match. Falls back to `search`. |
| `dark`            | Optional. Flags the theme to CodeMirror as dark.      |

Alpha hex suffixes (`3d`, `66`, `bf`) are deliberate. Selections and the active line need transparency so the text underneath stays legible. Keep this convention.

## Lezer tag mapping (`SyntaxColors`)

Mapped 1:1 to `@lezer/highlight` tags inside `buildTheme`:

| Field           | Lezer tag(s)                          |
| --------------- | ------------------------------------- |
| `heading`       | `t.heading`                           |
| `headingWeight` | Optional. `"bold"` etc.               |
| `emphasis`      | `t.emphasis` (italic applied)         |
| `strong`        | `t.strong` (bold applied)             |
| `keyword`       | `t.keyword`                           |
| `string`        | `t.string`                            |
| `number`        | `t.number`                            |
| `function`      | `t.function(t.variableName)`          |
| `type`          | `t.typeName`                          |
| `property`      | `t.propertyName`                      |
| `comment`       | `t.comment`                           |
| `url`           | `t.url`                               |
| `link`          | `t.link` (italic applied)             |
| `operator`      | `t.operator`                          |
| `punctuation`   | `t.punctuation`                       |
| `meta`          | `t.meta` + `t.processingInstruction`  |
| `quote`         | `t.quote` (italic applied)            |
| `monospace`     | `t.monospace`                         |

If you want a new tag (e.g. `t.atom`, `t.bracket`, `t.className`), add it to `SyntaxColors` and to the `HighlightStyle.define` list in `theme-builder.ts`. Then every theme gets the new field.

## Conventions

- **One palette source per file.** `one.ts` holds both One Dark and One Light; `ayu.ts` holds the three Ayu variants. Group by upstream theme, not by dark/light.
- **IDs are `kebab-case`** and should encode the variant: `one-dark`, `ayu-mirage`.
- **Colors are inline literals**, not constants. It's easier to scan and diff a palette when every hex is visible next to its role.
- **No runtime lookups in theme files.** The plugin reads files at build time. Don't rely on dynamic imports, environment variables, or anything asynchronous.

## Testing your theme

1. `bun run dev` and switch to your theme in the dropdown.
2. Run `bun run build` to confirm the plugin picked up the file.
3. Run `bunx tsc --noEmit` to catch missing `SyntaxColors` fields.
