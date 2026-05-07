import { buildTheme, type HighlightTheme } from "../theme-builder";

const ayuDark = buildTheme(
  {
    bg: "#0d1016", fg: "#bfbdb6",
    gutterBg: "#0d1016", gutterFg: "#4b4c4e", activeGutterFg: "#cbcccd",
    activeLine: "#1f2127bf",
    cursor: "#5ac1fe", selection: "#5ac1fe3d",
    search: "#5ac2fe66",
    dark: true,
  },
  {
    heading: "#bfbdb6", headingWeight: "bold",
    emphasis: "#5ac1fe", strong: "#5ac1fe",
    keyword: "#ff8f3f", string: "#a9d94b", number: "#d2a6ff",
    function: "#ffb353", type: "#59c2ff", property: "#5ac1fe",
    comment: "#5c6773", url: "#aad84c", link: "#fe8f40",
    operator: "#f29668", punctuation: "#a6a5a0", meta: "#ff8f3f",
    quote: "#a9d94b", monospace: "#fe8f40",
  },
);

const ayuLight = buildTheme(
  {
    bg: "#fcfcfc", fg: "#5c6166",
    gutterBg: "#fcfcfc", gutterFg: "#b0b3b5", activeGutterFg: "#313435",
    activeLine: "#ececedbf",
    cursor: "#3b9ee5", selection: "#3b9ee53d",
    search: "#3b9ee566",
  },
  {
    heading: "#5c6166", headingWeight: "bold",
    emphasis: "#3b9ee5", strong: "#3b9ee5",
    keyword: "#fa8d3e", string: "#86b300", number: "#a37acc",
    function: "#f2ad48", type: "#389ee6", property: "#3b9ee5",
    comment: "#abb0b6", url: "#85b304", link: "#f98d3f",
    operator: "#ed9365", punctuation: "#73777b", meta: "#fa8d3e",
    quote: "#86b300", monospace: "#f98d3f",
  },
);

const ayuMirage = buildTheme(
  {
    bg: "#242835", fg: "#cccac2",
    gutterBg: "#242835", gutterFg: "#575c6b", activeGutterFg: "#e1e3ea",
    activeLine: "#353944bf",
    cursor: "#72cffe", selection: "#72cffe3d",
    search: "#73cffe66",
    dark: true,
  },
  {
    heading: "#cccac2", headingWeight: "bold",
    emphasis: "#72cffe", strong: "#72cffe",
    keyword: "#ffad65", string: "#d4fe7f", number: "#dfbfff",
    function: "#ffd173", type: "#73cfff", property: "#72cffe",
    comment: "#5c6773", url: "#d5fe80", link: "#fead66",
    operator: "#f29e74", punctuation: "#b4b3ae", meta: "#ffad65",
    quote: "#d4fe7f", monospace: "#fead66",
  },
);

export const themes: HighlightTheme[] = [
  { id: "ayu-dark", name: "Ayu Dark", dark: true, extension: ayuDark },
  { id: "ayu-light", name: "Ayu Light", dark: false, extension: ayuLight },
  { id: "ayu-mirage", name: "Ayu Mirage", dark: true, extension: ayuMirage },
];
