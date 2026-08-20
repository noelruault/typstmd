# Vuln 0b: `broken_access_control` (HIGH) — `proxymd` rule `admin-profile`

Inline code in a title must read as part of the title, not as a body-size span dropped
into it. Compare with `inline code` in this paragraph, which stays small.

## Section with `code` in the heading

### Deeper section with `code` and a path `pkg/module/file.go:55-68`

#### Level four with `code`

##### Level five with `code`

###### Level six with `code`

Six heading levels must render at six distinct sizes; they used to collapse into three.

## Emoji

Shipping :rocket: today, feeling :tada: about it, shrug at :bug: reports.

Emoji only loads its 10.7 MB face for documents that contain one, so a document
without emoji must compile with no font warnings at all.

## Code contexts

A code block keeps its own tighter size and leading:

```go
func main() {
	fmt.Println("hello")
}
```

| Cell with `code` | Description |
| --- | --- |
| `identifier_with_underscores` | wraps inside a narrow cell |

> A quote containing `code` and *emphasis*.
