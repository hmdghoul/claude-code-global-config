# Global Claude Code Rules

## Shell
- Default to Windows PowerShell. Use the PowerShell tool, not Bash.
- Use PowerShell cmdlets (`Get-Content`, `Get-ChildItem`, `Select-String`) — not Unix tools (`cat`, `ls`, `grep`).
- Write source files as UTF-8 without BOM. A formatter can rewrite them in the platform codepage and silently mangle non-ASCII (an em dash becomes a lone `0x97`) while both the compiler and the format check still pass. Prefer ASCII in new comments, and re-check encoding after running a formatter.
- A JVM build daemon that dies with OOM corrupts the incremental cache, so the retry fails with a different, misleading error. Stop the daemon, delete the build cache directory, raise the heap, then rebuild.

## Workflow
- Explore the codebase before making changes.
- Ask before architectural changes; explain non-obvious decisions.
- Never assume intent — always validate before performing side-effect operations.
- Surface every non-trivial design decision as an explicit question. The plan is a living document to iterate on, not a one-shot approval.
- When two of my own instructions conflict, ask which wins instead of picking one silently.
- Verify a ticket's or bug report's premise against the code before acting on it. If verification refutes it, say so and drop it — do not rewrite its scope to keep it alive.
- When a task bundles a safe core with a risky piece, phase it: prove the core builds and works before starting the risky part.
- Before applying a review finding that removes or restores existing behavior, check project memory for a recorded deliberate decision; surface the conflict instead of silently reversing it.
- Model a new distinction inside the one component that consumes it — do not push it into a shared type because that is where it "naturally" belongs.
- Audit cross-repo and cross-service consumers before calling a change safe.
- Never hand-edit generated files — codegen output, generated types, generated docs and diagrams; regenerate them instead. Read them when tracing a flow; never review or "fix" them.

## Git (STRICT SAFETY RULES)
- You must NEVER run any git command that modifies repository state without explicit user approval.
- This includes (non-exhaustive) (`git commit`, `git push`, `git add`, `git reset`, `git rebase`, `git merge`, `git revert`)
- Before performing ANY of the above actions, you MUST:
    1. Explain what changes will be committed/pushed
    2. Ask a clear confirmation question:
       “Do you want me to proceed with committing/pushing these changes?”
- If the user does not explicitly confirm, you must NOT proceed.
- Batch multiple git operations into a single approval request (do not ask repeatedly).
- Never auto-commit, auto-push, or “helpfully” persist changes without permission.
- Never rebase, reset, or push onto `staging`, `main`, or `master` — including indirectly, through a branch whose upstream points at one of them.
- Before any push, read the upstream: `git rev-parse --abbrev-ref '@{upstream}'`. A bare `git push` (with or without `--force-with-lease`) targets that upstream, not a same-named remote branch. If it differs from the current branch name, stop and push explicitly instead: `git push -u origin <branch>`.
- Exception — the `rebase-staging` skill: its step 6 `git push --force-with-lease` is intentionally bare, and its step 1 gate checks only the local branch name. Invoking that skill is approval for that flow as written; do not add an upstream check or rewrite the push.
- A rebase or force-push on a branch with zero commits of its own is a no-op at best and a push to the base branch at worst. Check `git log --oneline origin/<base>..HEAD` first; if it is empty, report that and do nothing.
- Every new branch — one I ask for or one you create — is meant to exist on the remote. Immediately after creating it, ask me to publish it with `git push -u origin <branch>`; that sets its own upstream instead of leaving it inheriting the base branch's. Never leave a new branch local-only without asking.
- Do not add Claude/AI co-authorship to commits, PRs, or related artifacts.
- Never commit secrets.
- Exception — memory repos: committing inside `projects/*/memory` git repos is pre-authorized; commit there per the *Memory Repos* section. This does NOT extend to pushing or to the `.claude` repo itself.
- When indicating where a change, comment, or fix belongs, always reference the git **branch** — never look up or cite a GitHub PR (no `gh pr ...`, no PR numbers/links). The user maps branch → PR themselves.
- `gh` is read-only. Reading a PR is fine when I ask for output about it — `gh pr view`, `gh pr diff`, `gh pr list`, `gh pr checks`, GET-only `gh api`. Never run a `gh` command that creates or changes anything on GitHub: no `pr create`/`edit`/`comment`/`review`/`merge`/`close`/`ready`/`checkout`, no `release create`, no `issue` writes, no label, assignee, milestone or workflow changes, no non-GET `gh api`. Draft the text and I post it.
- The read allowance above does not loosen the branch-not-PR rule: keep citing the **branch** when saying where a change belongs, and reach for `gh` only when the PR itself is the subject of what I asked for.
- When asked for a commit message, always provide TWO versions: a one-liner  and the normal version. Do not make me ask for the other.
- Issue-tracker writes are manual. Reading tickets is fine; never create, comment, transition, assign, or link. Draft the text for me to paste.
- A cloud or remote session refines the plan and hands it back for local implementation — it does not open a pull request itself.

## Memory Repos
- Memory lives under `~/.claude` (resolves to each machine's home dir): each per-project memory folder is at `~/.claude/projects/<project>/memory/` (do not guess the location). Each is its own standalone git repo (NOT a submodule). The `.claude` repo does not track them (`projects/` is gitignored), so they never reach the main repo or its remote.
- After creating, editing, or deleting any memory file (including `MEMORY.md`), `git add -A` + `git commit` inside that memory folder's repo — Claude makes the commit itself (there is no hook). Pre-authorized; do not ask. Write a meaningful short message describing the change: `memory: <short description>`. No AI co-authorship.
- New project's first memory write: `git init -b master` the folder first. Never push.
- A rule that applies to every repo belongs in this file, not in a project memory. Project memory holds the repo-specific fact and the worked example that justifies the rule.

## Code
- Always match the app's established standard over your own defaults. Before writing or changing code, check how the codebase already does it (nearest sibling component, shared idiom) and follow that — serving/endpoint style (e.g. Elide resource vs custom controller), pagination base, naming, error handling, framework patterns. Never introduce a divergent pattern when an established one exists; when several conventions coexist, match the closest sibling.
- Readability over cleverness.
- Prefer explicit logic over implicit behavior.
- No comments unless the WHY is non-obvious (hidden constraint, subtle invariant, workaround). Never explain WHAT the code does.
- Before writing a comment, first try to make the code say it: rename the symbol to state the invariant (`resolveExistingWalletID`, `ClaimedSourceSystem`), extract a named constant instead of a magic value, or put the fact in the error message where it also reaches logs and callers. A comment is the last resort, not the first.
- Default to zero comments: write the block comment-free, then add back only the ones whose fact you can name — this external contract, this DB constraint, this JDK/library behaviour. If you cannot name it in one line, the comment is wrong; fix the naming instead. Never hand me a first draft dense with comments and trim it only when asked.
- Only comment when the WHY genuinely cannot live in code — an external contract, an RFC or spec reference, a cross-service policy, or a DB-level constraint the file cannot see. Keep it to one line placed at the exact spot.
- When you add or touch a comment, tighten it in the same edit — never restating the code.
- Never write bookkeeping into code: no ticket references, no `region` markers, no "delete this block to revert" or "deliberate, do not re-flag" notes. That belongs in the commit message, the PR, or memory. Structure is what makes a change revertible, not comments pointing at it.
- No docstrings, no multi-line comment blocks.
- No emojis in code, commits, or responses unless explicitly requested.
- Prefer named variables and early returns over chained scope/lambda helpers that do not earn their keep.
- Prefer a plain `if` over a ternary or elvis chain, and an early `return` over assigning an if/else expression to a variable. A `var` plus an `if` is fine; do not "simplify" it away.
- Always brace both branches, even when each is a single expression.
- Pass arguments positionally; name them only when the language requires it — skipping an optional, passing out of declaration order, or disambiguating an overload.
- Do not extract a helper used in exactly one place — inline it. For a tiny mutation/stamp block duplicated across sibling methods, keep it inline even at two call sites.
- No nullable "only type X has this" columns — generalize the concept so every row has a real value.
- Fire-and-forget background work must never throw; catch and log only.
- Any action that changes data must be logged on both outcomes — success and failure. On success log what changed, how much, and who did it. On failure or rejection log why it was refused, including a validation bail that aborts the mutation before it happens. Log at a level the service actually emits.
- Never load whole rows for data you immediately discard. If a step needs only ids, one column, or a count, write a projection query that selects exactly that. Loading full entities to keep a single field also drags in every EAGER association, so one call becomes one query per row unless a batch-fetch size is configured — read the entity's associations before assuming a finder costs one query. Add the projection as a new method beside the existing finder and leave that finder untouched for the callers that genuinely need the whole row.
- Spell joins out and never lean on a cartesian product: write `INNER JOIN` / `LEFT JOIN` naming the association or condition, never a comma-join (`FROM A a, B b WHERE a.x = b.id`) that the planner has to turn back into a join. In an ORM query language a join over a mapped relation already emits the FK condition and is never a cross join — write `INNER JOIN` anyway so the intent is visible to a reviewer instead of resting on a default.
- Deleting or updating a known set of rows is one statement, not one per row. Prefer a bulk/batch call keyed on `IN (ids)` over iterating; where the ORM offers both an entity-collection and an id-collection batch form, take the id form — the entity form usually expands to an `OR` chain that grows a clause per row. Before switching, confirm nothing depends on per-row lifecycle callbacks or cascades, since bulk statements bypass them.
- Durable idempotency needs a persisted marker, not a cache that can evict.
- One changeSet/migration per file. Never edit or delete an already-applied migration — add a new reversing one.

## Change Style
- Default to additive, revertible changes: aim for a diff with zero `-` lines against the baseline, so the feature comes out by deleting added blocks rather than retyping original logic.
- Add a sibling method or overload that delegates to the untouched original instead of adding a parameter to an existing one. Never make a new parameter required.
- Put a new branch or enum value first in the list so the existing trailing line stays byte-identical — except where position is behavior: append enum constants (ordinals may be persisted) and new guard clauses instead.
- Prefer a flag-gated early return above an untouched line over editing that line. Gate reads on the flag too, not just writes — flag-off must cost nothing extra.
- A trailing comma from appending a parameter or field is an acceptable floor; do not contort the design to reach literal zero.
- When changing existing logic genuinely is the fix, make the change — but surface it as an explicit decision and let me choose. Never silently.
- Watch for un-flagged riders: reordering guard clauses or changing which exception fires is a live behavior change no feature flag covers.
- Refactors must be verifiable by diffing: keep extracted abstractions in the same file, and reuse the original variable names so before and after line up 1:1.

## Output & Tone
- Responses must be short and concise. No trailing summaries after completing a task.
- One sentence of context before tool calls; one sentence of update at key moments. Silent is not acceptable; verbose is not either.
- Structure a report as: what was done → what differs → what is not done. When asked to shorten, cut hard.
- Review-comment replies are one-liners: what changed plus the one-phrase why. No preamble, no restating the question, no bullet lists unless asked.

## Findings & Explanations
Applies to every code-review finding, bug writeup, and explanation of how something works — in a document or in chat. It does NOT loosen the brevity rules above for ordinary task responses: those stay short.

Write each one in this shape, in this order. Drop a heading that has nothing to say; never reorder.
- **In one sentence** — plain language, no jargon, no file paths. State the effect, not the mechanism.
- **What the code does now** — the real snippet with `file:line`. Never paraphrase code that exists.
- **What it should be / what the contract expects** — the other side of the comparison: the library API, the schema, the previous behaviour.
- **Why it matters** — the concrete consequence. Who sees it, what breaks, what is silently wrong.
- **Suggested change** — the code to write. If the right fix depends on a decision I have to make, give the options and say what each implies instead of picking one.
- **What to check first** — the caveat that could invalidate the fix.

Rules for the prose itself:
- Short sentences. One idea each. Prefer a table over a paragraph when comparing two states (before/after, expected/actual, client-sees/log-says).
- Define jargon inline the first time: "401 (rejected, 'who are you?')", "403 (rejected, 'not allowed')".
- Say plainly when something is NOT a problem, and why — "creating a wallet is fine, because Kafka makes it".
- Separate severity from novelty: whether it is serious and whether this branch introduced it are two different facts. Label both.
- When correcting an earlier claim of mine, say what was wrong and what the evidence was, in one short paragraph. Do not bury it.
