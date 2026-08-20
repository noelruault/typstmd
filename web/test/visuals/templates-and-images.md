---
title: Template and resource fixture
subtitle: exercises the frontmatter dictionary
keywords:
  - templates
  - packages
mainfont: exposed but never applied by typstmd
---

# Raw templates

Paste a Typst Universe template into the Template view and it must compile unchanged, for
example `basic-resume`, `charged-ieee` or `graceful-genetics`. Every one of them opens with
`#import "@preview/<name>:<version>"` and a `#show: <fn>.with(...)` call, and none of them
defines `conf`.

The frontmatter above is available to any template as `frontmatter.at("subtitle")`, and a
template that ignores it must render exactly as if it were absent.

## Remote images

A remote image is fetched and mapped into the compiler's virtual filesystem:

![Noto rocket](https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/72/emoji_u1f680.png)

A host that sends no CORS headers cannot be read by any browser, so this one must produce a
warning in the panel and no broken output in the PDF:

![Unreadable](https://www.python.org/static/img/python-logo.png)

## Local images

A relative path only works once the file has been dropped onto the page:

![Dropped file](photo.png)
