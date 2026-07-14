# Code block layout

Visual fixtures for fenced-code layout failure modes. Eyeball the rendered
PDF (`bun run dev`, paste a case) — unit tests assert the Typst string, not
line spacing or wrapping.

## Long space-less comma run — must wrap, no gap after it

Regression: a comma-separated list with no spaces (e.g. a numeric `IN`-list)
is a single unbreakable "word" nearly as wide as the page. Typst can't break
it, so it drops the line's indent and opens a large blank gap before the next
line. Fix: the theme inserts a zero-width break after each comma inside code
blocks, so these lists wrap at commas and the gap disappears. Line spacing
should stay uniform and tight throughout.

Copy-paste note: because the break is a real zero-width character, copying
one of these queries out of the PDF may carry invisible chars that some SQL
clients reject. Identifiers keep no breaks (no ZWSP at `.` or `_`), so
`DOTW.tbl_BookingMain` stays clean.

```sql
SELECT BookingCode, BookingDateTime, CustomerCode, MainCustomerCode, SupplierCode,
       ServiceName, LeadPassangerFirst, LeadPassangerLast, Status, ConfirmationNumber
FROM DOTW.tbl_BookingMain
WHERE BookingCode IN (1003424175,1003426185,1003428665,1003438065,1003441915,1003444715,
      1003446595,1003450825,1003451355,1003451835,1003455265,1003456255,1003459045,
      1003459935,1003461695,1003465365)
ORDER BY BookingDateTime;
```
