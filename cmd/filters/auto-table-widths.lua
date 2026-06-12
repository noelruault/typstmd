-- Lua filter: assign equal fractional column widths so Typst distributes
-- table width evenly across all columns. Using ColWidthDefault (auto) causes
-- overflow when cells contain long non-breaking content (e.g. inline code).
function Table(tbl)
  local n = #tbl.colspecs
  if n > 0 then
    local w = 1.0 / n
    for i, colspec in ipairs(tbl.colspecs) do
      colspec[2] = w
    end
  end
  return tbl
end
