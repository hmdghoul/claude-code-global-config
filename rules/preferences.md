# Personal Preferences — Code & Comment Style

Language-agnostic style defaults; Kotlin-specific idioms live in `lang-kotlin.md`. Defaults yield per the precedence ladder in `CLAUDE.md`.

## Code style
- Readability over cleverness.
- Prefer explicit logic over implicit behavior.
- Prefer `if` / `if-else` over `when` (or `switch`/`match`). Reach for `when` only for a genuine multi-way dispatch over many cases; two or three branches are an `if`. Compile-time exhaustiveness over an enum is not on its own a reason to pick `when` — say so once if it matters, then write the `if`.
- Always brace both branches, even when each is a single expression.
- Pass arguments positionally; name them only when the language requires it — skipping an optional, passing out of declaration order, or disambiguating an overload.
- Name for the behaviour, not for the feature that asked for it. `getOrdersSummary` outlives `getCodOrderSummary`; a name carrying today's only caller is either duplicated or made a lie by the second one.
- Do not extract a helper used in exactly one place — inline it. For a tiny mutation/stamp block duplicated across sibling methods, keep it inline even at two call sites. The converse also holds: when an addition gives a method a *second reason to change* — a new decision, a new response shape, a new business rule — that is a new function, not more lines in the old one.
- Prefer early returns and guard clauses over nested `if` / `else if`. When the guarded block sits mid-method with work that must still run after it — so returning from the method would skip that work — extract the guarded decision into its own function and write that flat with early returns. The distinct decision is itself the *second reason to change* that licenses the extraction, single call site notwithstanding; do not invoke the no-single-use-helpers rule to defend the nesting.

## Comment style
- No comments unless the WHY is non-obvious (hidden constraint, subtle invariant, workaround). Never explain WHAT the code does.
- Before writing a comment, first try to make the code say it: rename the symbol to state the invariant (`resolveExistingWalletID`, `ClaimedSourceSystem`), extract a named constant instead of a magic value, or put the fact in the error message where it also reaches logs and callers. A comment is the last resort, not the first.
- Default to zero comments: write the block comment-free, then add back only the ones whose WHY genuinely cannot live in code — an external contract, an RFC or spec reference, a cross-service policy, a JDK/library behaviour, or a DB-level constraint the file cannot see. If you cannot name the fact in one line, the comment is wrong; fix the naming instead. Keep it to one line placed at the exact spot. Never hand me a first draft dense with comments and trim it only when asked.
- When you add or touch a comment, tighten it in the same edit — never restating the code.
- Never write bookkeeping into code: no ticket references, no `region` markers, no "delete this block to revert" or "deliberate, do not re-flag" notes. That belongs in the commit message, the PR, or memory. Structure is what makes a change revertible, not comments pointing at it.
- No docstrings, no multi-line comment blocks.

## Change style
- Default to additive, revertible changes: aim for a diff with zero `-` lines against the baseline, so the feature comes out by deleting added blocks rather than retyping original logic.
- Add a sibling method or overload that delegates to the untouched original instead of adding a parameter to an existing one. Never make a new parameter required.
- Put a new branch or enum value first in the list so the existing trailing line stays byte-identical — except where position is behavior: append enum constants (ordinals may be persisted) and new guard clauses instead.
- Prefer a flag-gated early return above an untouched line over editing that line. Gate reads on the flag too, not just writes — flag-off must cost nothing extra.
- A trailing comma from appending a parameter or field is an acceptable floor; do not contort the design to reach literal zero.
- When changing existing logic genuinely is the fix, make the change — but surface it as an explicit decision and let me choose. Never silently.
- Watch for un-flagged riders: reordering guard clauses or changing which exception fires is a live behavior change no feature flag covers.
- Refactors must be verifiable by diffing: keep extracted abstractions in the same file, and reuse the original variable names so before and after line up 1:1.
