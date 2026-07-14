-- Lua filter: a paragraph that is exactly "+++" becomes a Typst page break.
-- Shortcut for `#pagebreak()`; write +++ on its own line to start a new page.
function Para(p)
  if #p.content == 1 and p.content[1].t == "Str" and p.content[1].text == "+++" then
    return pandoc.RawBlock("typst", "#pagebreak()")
  end
end
