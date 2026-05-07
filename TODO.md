RULE: md/typst strict separation. Editor shows real typst or real markdown. No hybrids. Plugins operate at markdown parse layer OR produce standard typst constructs. Source view = what any typst user would recognize.

FEATURE: custom template upload. Users upload .typ files as templates beyond Default/Minimal/Academic. Stored in localStorage per theme.

FEATURE: landscape directive. Markdown plugin :::landscape ... ::: -> #page(flipped: true)[...]. Remark layer only, clean typst output.

UX DECISION PENDING: template editor trigger. 8 options explored. Top candidates:
- gear icon next to theme dropdown. "Customize this theme." Settings action, not editor mode.
- drawer/modal. "Customize Theme" panel. Main editor stays markdown. No mode confusion.
- dropdown label. "Editing: Markdown ▾" selector. Compact.
- tab bar. Markdown | Template tabs. Clear but heavier.

FEATURE: render emoji
FEATURE: make yellowish the document in dark mode
FEATURE: Syntax highlighter
FEATURE: Consider adding a formatter

place an optional name for the file
[x] automatic save filename typstmd-YYYYmmDDHHmmSS
cabecera de tabla vertical si el width es mayor que el de las filas? para booleanos 0/1, para que occupen menos
[x] tablas que se ajusten al max width de rows+row header
[x] El header, por pequeño que sea (#####), su font size nunca puede ser mas pequeño que el body 
