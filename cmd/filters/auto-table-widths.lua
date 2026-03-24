-- Lua filter: reset all table column widths to default (auto)
-- so Typst can size them based on content instead of Pandoc's guesses.
function Table(tbl)
  for i, colspec in ipairs(tbl.colspecs) do
    colspec[2] = pandoc.ColWidthDefault
  end
  return tbl
end
