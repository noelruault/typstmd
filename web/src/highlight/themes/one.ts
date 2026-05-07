import { buildTheme, type HighlightTheme } from "../theme-builder";

const oneDark = buildTheme(
  {
    bg: "#282c33", fg: "#acb2be",
    gutterBg: "#282c33", gutterFg: "#4e5a5f", activeGutterFg: "#d0d4da",
    activeLine: "#2f343ebf",
    cursor: "#74ade8", selection: "#74ade83d",
    search: "#74ade866", searchActive: "#e8af7466",
    dark: true,
  },
  {
    heading: "#d07277", emphasis: "#74ade8", strong: "#bf956a",
    keyword: "#b477cf", string: "#a1c181", number: "#bf956a",
    function: "#73ade9", type: "#6eb4bf", property: "#d07277",
    comment: "#5d636f", url: "#6eb4bf", link: "#73ade9",
    operator: "#6eb4bf", punctuation: "#b2b9c6", meta: "#b477cf",
    quote: "#a1c181", monospace: "#a1c181",
  },
);

const oneLight = buildTheme(
  {
    bg: "#fafafa", fg: "#242529",
    gutterBg: "#fafafa", gutterFg: "#b4b4bb", activeGutterFg: "#44454b",
    activeLine: "#ebebecbf",
    cursor: "#5c78e2", selection: "#5c78e23d",
    search: "#5c79e266", searchActive: "#d0a92366",
  },
  {
    heading: "#d3604f", emphasis: "#5c78e2", strong: "#ad6e25",
    keyword: "#a449ab", string: "#649f57", number: "#ad6e25",
    function: "#5b79e3", type: "#3882b7", property: "#d3604f",
    comment: "#7c7e86", url: "#3882b7", link: "#5b79e3",
    operator: "#3882b7", punctuation: "#4d4f52", meta: "#a449ab",
    quote: "#649f57", monospace: "#649f57",
  },
);

export const themes: HighlightTheme[] = [
  { id: "one-dark", name: "One Dark", dark: true, extension: oneDark },
  { id: "one-light", name: "One Light", dark: false, extension: oneLight },
];
