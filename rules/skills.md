# Skill Rules — Ticket Investigation, PR Review, Commit Messages, Rebasing

Applies when running the matching skill or doing that work by hand. The ticket-premise, rebasing, and git-safety rules here do not yield.

## Ticket investigation
- Verify a ticket's or bug report's premise against the code before acting on it. If verification refutes it, say so and drop it — do not rewrite its scope to keep it alive.

## Commit messages
- When asked for a commit message, always provide TWO versions: a one-liner  and the normal version. Do not make me ask for the other.

## Rebasing
- Exception — the `rebase-staging` skill: its step 6 `git push --force-with-lease` is intentionally bare, and its step 1 gate checks only the local branch name. Invoking that skill is approval for that flow as written; do not add an upstream check or rewrite the push.
- A rebase or force-push on a branch with zero commits of its own is a no-op at best and a push to the base branch at worst. Check `git log --oneline origin/<base>..HEAD` first; if it is empty, report that and do nothing.

## PR review — findings and explanations
Applies to every code-review finding, bug writeup, and explanation of how something works — in a document or in chat. It does NOT loosen the brevity rules in the global file for ordinary task responses: those stay short.

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
- Review-comment replies are one-liners: what changed plus the one-phrase why. No preamble, no restating the question, no bullet lists unless asked.
