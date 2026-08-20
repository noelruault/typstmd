-- Typst decodes by file extension, and Pandoc names fetched media from the URL, so a URL
-- ending .jpg that serves PNG bytes aborts the whole compile. Sniff the magic number and
-- store the file under an extension that matches what the bytes actually are.
local MAGIC = {
  { prefix = "\137PNG\r\n\26\n", ext = "png" },
  { prefix = "\255\216\255", ext = "jpg" },
  { prefix = "GIF8", ext = "gif" },
  { prefix = "RIFF", ext = "webp" },
  { prefix = "<svg", ext = "svg" },
  { prefix = "<?xml", ext = "svg" },
}

local function sniff(contents)
  for _, candidate in ipairs(MAGIC) do
    if contents:sub(1, #candidate.prefix) == candidate.prefix then
      return candidate.ext
    end
  end
  return nil
end

function Image(img)
  if not img.src:match("^https?://") then
    return nil
  end

  local mime, contents = pandoc.mediabag.fetch(img.src)
  if not contents then
    return nil
  end

  local ext = sniff(contents)
  if not ext then
    return nil
  end

  local name = pandoc.sha1(contents) .. "." .. ext
  pandoc.mediabag.insert(name, mime, contents)
  img.src = name
  return img
end
