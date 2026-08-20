# Heading spacing debug

Each case targets one heading failure mode. Watch for: a heading that wraps to two+ lines showing a full body-size gap between its own lines (reads as several separate titles); a heading glued to the body text below it (gap smaller than the body line spacing). Both were real bugs — a wrapped heading inherited the body's loose `leading`, and `below` was tighter than the body line gap. Fixed by a tight per-heading `leading` and a `below` raised above the body line gap. Also render this in the IEEE theme to check the two-column numbered headings.

## Long heading that wraps to several lines and must read as one title, not as three separate titles stacked with big gaps

**Likelihood / Impact / Risk:** High / High / Critical. This body line must sit close under the heading above (bound to it), not floating a full blank line away, and the heading's own wrapped lines must be tight.

### F-01 Rewards SPA exposes production message-broker credentials unauthenticated (STILL VULNERABLE, Critical)

**Likelihood / Impact / Risk:** High / High / Critical. Wiz category: OWASP API8:2023. The third-order heading above is the exact case from the security report that surfaced the bug.

#### A fourth-order heading long enough to wrap once across the page width and be checked for the same tight leading

Body text following the fourth-order heading.

##### Fifth-order heading that also wraps across the page to verify consistency at the deeper levels too

Body text following the fifth-order heading.
