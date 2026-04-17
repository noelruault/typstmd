RULE: md/typst strict separation. Editor shows real typst or real markdown. No hybrids. Plugins operate at markdown parse layer OR produce standard
typst constructs. Source view = what any typst user would recognize.

FEATURE: custom template upload. Users upload .typ files as templates beyond Default/Minimal/Academic. Stored in localStorage per theme.

FEATURE: landscape directive. Markdown plugin :::landscape ... ::: -> #page(flipped: true)[...]. Remark layer only, clean typst output.

UX DECISION PENDING: template editor trigger. 8 options explored. Top candidates:
- 5 - gear icon next to theme dropdown. "Customize this theme." Settings action, not editor mode.
- 6 - drawer/modal. "Customize Theme" panel. Main editor stays markdown. No mode confusion.
- 3 - dropdown label. "Editing: Markdown ▾" selector. Compact.
- 1 - tab bar. Markdown | Template tabs. Clear but heavier.

FEATURE: render emoji
