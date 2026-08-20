-- Must stay identical to serializeTable in web/src/mdast-to-typst.ts: one Markdown file
-- has to give one PDF from either front-end. Pandoc's own writer wraps tables in a centred
-- #figure, which Typst reserves for captions and references.
local WIDE_THRESHOLD = 40
local NARROW_THRESHOLD = 12

local function cell_to_typst(cell)
  local doc = pandoc.Pandoc(cell.contents)
  local out = pandoc.write(doc, "typst")
  return (out:gsub("^%s+", ""):gsub("%s+$", ""):gsub("\n", " "))
end

local function cell_text_length(cell)
  return #pandoc.utils.stringify(pandoc.Pandoc(cell.contents))
end

function Table(tbl)
  -- TableHead exposes its rows as `.rows`, TableBody as `.body`; they are not interchangeable.
  local header_rows = tbl.head.rows or {}
  local body_rows = {}
  for _, body in ipairs(tbl.bodies) do
    for _, row in ipairs(body.body or {}) do
      table.insert(body_rows, row)
    end
  end

  local column_count = #tbl.colspecs
  if column_count == 0 then
    return nil
  end

  local col_max = {}
  for i = 1, column_count do
    col_max[i] = 0
  end

  local function collect(rows)
    local out = {}
    for _, row in ipairs(rows) do
      for i, cell in ipairs(row.cells) do
        table.insert(out, "[" .. cell_to_typst(cell) .. "]")
        local len = cell_text_length(cell)
        if i <= column_count and len > col_max[i] then
          col_max[i] = len
        end
      end
    end
    return out
  end

  local header_cells = collect(header_rows)
  local body_cells = collect(body_rows)

  local has_wide = false
  for i = 1, column_count do
    if col_max[i] >= WIDE_THRESHOLD then
      has_wide = true
    end
  end

  local columns_arg
  if has_wide then
    local specs = {}
    for i = 1, column_count do
      specs[i] = col_max[i] <= NARROW_THRESHOLD and "auto" or "1fr"
    end
    columns_arg = "(" .. table.concat(specs, ", ") .. ")"
  else
    columns_arg = tostring(column_count)
  end

  local parts = { "columns: " .. columns_arg }
  if #header_cells > 0 then
    table.insert(parts, "table.header(" .. table.concat(header_cells, ", ") .. ")")
  end
  if #body_cells > 0 then
    table.insert(parts, table.concat(body_cells, ", "))
  end

  return pandoc.RawBlock("typst", "#table(" .. table.concat(parts, ", ") .. ")")
end
