
---
title: "Using pandoc and typst to convert markdown into custom-formatted PDFs"
author: Neil Brown
email: blog@example.com
---

# Heading 1

Cupiditate aperiam fugiat debitis et mollitia nemo officia. Explicabo voluptatem et ratione in iste blanditiis expedita in. Quia fugiat consequatur consequatur voluptas. Sequi qui mollitia ipsum voluptas modi. Nostrum animi exercitationem magnam repellendus.

## Subheading 1

Quod voluptatibus odit qui corrupti illo. Eum quibusdam culpa corrupti molestiae tempora praesentium esse. Beatae temporibus suscipit iure eligendi. Et quas iusto nisi. Dolorem ad qui sapiente eum accusamus. Aspernatur dolores ut ut eius suscipit quidem.

> Consequuntur et quae dolores placeat necessitatibus quam. Omnis ea ipsa ea et dolores. Voluptatem rerum reiciendis enim omnis aut. Architecto recusandae ipsam veritatis. Molestias est eum eos. Aut quia praesentium eveniet nostrum et quo eos ratione.

[This is a link](https://neilzone.co.uk).[^1]

[^1]: This is a footnote

Consequatur aut officia deserunt voluptatum autem voluptatem voluptatum neque. Qui vel ut sint unde neque possimus dolorem. A harum doloribus sit facere pariatur adipisci. Tempora voluptates iure sunt rerum ab repudiandae qui. Ut consequatur enim molestiae.

# Code formatting

I'd run `mdtopdf test_file.md`, for example, and that would put `test_file.pdf` into the same directory.

It uses:

```
/usr/bin/pandoc "$INPUTFILE" --pdf-engine=typst --template=/home/neil/briefcase/Store/typst/decoded.legal.template -o "$PDFFILE"
```

## A table[^2]

This is a table:

| Column 1      | Column 2      |
| ------------- | ------------- |
| Cell 1, Row 1 | Cell 2, Row 1 |
| Cell 1, Row 2 | Cell 1, Row 2 |

[^2]: another footnote
