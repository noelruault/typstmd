# Ethos critique: execution of feature/typst-parity

Companion to `typst-parity.md` and `HANDOFF.md`. Critique of how the branch was executed, not of the product. Written 2026-08-21 against head `1c266c2` plus the then-uncommitted worker/mermaid work.

Evidence base, verified at time of writing: 17 commits, 3739 insertions committed, ~120 lines plus 4 new files uncommitted, `bun test` 262 pass / 0 fail, `tsc` clean, branch has no upstream, CI never triggered.

## The lie

"Executed and handed off." Plan stamped `status: executed` at commit 10 of 17, then 7 more commits landed on the same branch, then more work landed uncommitted on top of the handoff. HANDOFF.md said head `c8af52b`, mermaid decision open, both front-ends print the source; the tree said decision resolved (merman draws real diagrams), a Web Worker compile architecture added, CLAUDE.md rewritten. The handoff was stale within a day of being written, and a handoff that contradicts the tree misleads the next session worse than no handoff.

## Findings, ranked

1. **Branch outlived its plan.** Parity plan done at `9e0870f`; aitelier theme, Universe starters, user templates, template picker, pentest theme, mermaid rework all piled on after. Roughly half the 3.7k lines are features, not parity. One unreviewable merge unit.
2. **Zero push, zero CI run, ever.** Commit `384cf93` says "compare the two front-ends on every commit"; that comparison never ran outside one laptop. The 4-layer harness was asserted, not proven. Unexecuted CI is a hypothesis.
3. **CI gate has two holes.** `pages.yml` triggers only on push to `main`, paths `web/**`. (a) No PR gate: a red commit lands on main, then fails. (b) `cmd/**` excluded: editing `cmd/filters/mermaid.lua`, the file required to mirror `MERMAID_PREAMBLE` byte-for-byte, never fires the parity tests. The exact drift the branch exists to prevent has a green path around its own gate.
4. **Mermaid churn.** `c8af52b` pins "neither draws" as a tested contract; work a day later flips it to "both draw". The winning option (merman package) was not among the handoff's three costed options, so the decision menu was incomplete when written. Outcome right; process paid one pinned-then-reversed contract, with the reversal uncommitted so history contradicted the tree.
5. **Rescue commit `8ab96f0`:** 892 lines, three concerns (IEEE theme, spacing, CLI template). Defensible as save-the-old-work-first, but it is three commits wearing one hash.

## What hit the upper bound

The plan doc is reference-grade: reproduced evidence table with the commands that produced it, 4-layer testing contract, back-filled tests for pre-contract changes, sanctioned divergences asserted rather than waved away, hard-won Typst facts recorded so the next session pays nothing. Commit subjects tell the story in plain English. Local state green and typechecked. Craftsmanship is not the problem.

## Implicit constraint

Solo repo, no reviewer, so merge feels optional. Wrong frame: CI plus remote is the only adversarial second agent this repo has, and unpushed work means that agent never once disagreed. One dead laptop erases everything.

## Verdict

**The work is right, the landing is missing. Quality execution, closure failure.** The branch stopped being a plan's branch and became a session's home directory.

Adversarial pass: strongest counter is that push was deliberately withheld pending decision #6 and the plan docs make loss recoverable. That softens finding 2's urgency, does not touch findings 3 and 5, and finding 1 stands because review cost grows with the diff whether the reviewer is a human or future-you. Verdict holds; "unpushed" downgraded from negligence to a deferred decision left deferred too long.

## Next move (as prescribed 2026-08-21)

Commit the uncommitted work as 3 commits (worker compile, mermaid-via-merman parity flip with `parity.test.ts` update, docs/llms). Refresh HANDOFF.md head and close decision #1 in it. Push. Watch one real CI run go green. Then fix the trigger: add `pull_request` and `cmd/**` to paths, or split tests into their own workflow on all pushes. Success criterion: green check on GitHub before end of day.

Forcing question left open: merge as one 3.7k-line PR, or split parity (`8ab96f0..9e0870f`) from features (`b4a4629..HEAD`) into two.

## Reusable lessons (repo-agnostic)

- A plan reaching `status: executed` closes its branch; new scope gets a new branch, or the status is a lie.
- A handoff is only true at the commit it names; any work after it must update the handoff in the same session or not happen.
- A CI gate that a covered file can bypass (path filter excluding one side of a mirrored pair) is worse than no gate: it certifies parity it never checked.
- Pinning a contract in tests is cheap; count the cost of reversal before pinning a contract a pending decision can flip.
