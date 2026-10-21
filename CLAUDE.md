# Global Claude Code Rules

## Reference Notes (read on demand)
Detailed engineering guidance lives in my vault at `~/source/vault/03 - Engineering Knowledge/` (`~` is the home directory; resolve it to an absolute path, never a path relative to the project). Nothing there is imported. Before the first change of a kind listed below in a session, read the matching note in full with the Read tool and follow it; re-read it if it has dropped out of context. Read only the notes the task triggers. Their rules are defaults and yield per *Rule Precedence* below.

| Before you... | Read |
| --- | --- |
| Write or edit code in any language (style, comments, additive and revertible change shape) | `Code Style and Change Conventions.md` |
| Change code inside an application or service repository (established patterns, architecture, configuration, transactions and locks, jobs and events, logging) | `Service Architecture Conventions.md` |
| Touch Kotlin, Spring, JPA/Hibernate, or a Gradle build | `Kotlin and Spring Conventions.md` |
| Write SQL or JPQL, change a schema, or add a migration | `SQL and Schema Conventions.md` |
| Write a code-review finding, bug writeup, or explanation of how something works, or draft ticket text | `Review and Ticket Writing.md` |

## Rule Precedence
The reference notes are defaults, not laws. When one collides with something below, the higher item wins: follow it, and say in one line which default yielded and why. Never yield silently, and never invent a conflict to avoid a rule you dislike.
1. Business requirements and invariants — the outcome the system must achieve, including what a ticket asks for. A ticket's premise is not one of these: it is a claim about how the system behaves today, and it yields to item 3. A refuted premise does not take the outcome with it.
2. Framework and language correctness — where an idiom exists because the compiler, ORM, broker, or runtime needs it. This constrains every implementation, including one a ticket proposes.
3. Evidence from the affected flow — what the code demonstrably does at runtime beats what a rule or a ticket assumes.
4. Repository-specific instructions — a repo's own `CLAUDE.md`, its docs, its ADRs.
5. Established codebase patterns — the nearest sibling's way of doing it.

These never yield and are not defaults: git safety and approval, **the staging index (never stage or unstage, see *Git* below)**, permissions (`gh`, issue trackers), secrets, destructive or irreversible actions, generated files, file encoding, already-applied migrations, and every before/after-implementing verification rule. If one of these appears to conflict with a ticket, stop and ask.

## Shell
- Write source and resource files as UTF-8 without BOM. A formatter can rewrite them in the platform codepage and silently mangle non-ASCII (an em dash becomes a lone `0x97`) while both the compiler and the format check still pass. Prefer ASCII in new comments, and re-check encoding after running a formatter.

## Workflow
- Explore the codebase before making changes.
- Ask before architectural changes; explain non-obvious decisions.
- Never assume intent — always validate before performing side-effect operations.
- Surface a design decision as an explicit question when reasonable interpretations lead to materially different work; otherwise state the assumption you took and keep going. Batch the questions into one round rather than stopping at each decision. The plan is a living document to iterate on, not a one-shot approval.
- When two of my own instructions conflict, ask which wins instead of picking one silently.
- When a task bundles a safe core with a risky piece, phase it: prove the core builds and works before starting the risky part.
- Before applying a review finding that removes or restores existing behavior, check project memory for a recorded deliberate decision; surface the conflict instead of silently reversing it.
- Audit cross-repo and cross-service consumers before calling a change safe.
- Never hand-edit generated files — codegen output, generated types, generated docs and diagrams; regenerate them instead. Read them when tracing a flow, and read a generated diff to confirm the regeneration produced what you expected — but fix what you find at the source or in the generator, never in the generated file itself. Two things are not that: scaffold a generator emits once and the repo then owns, and a checked-in generated file with no regeneration path left. Name which case you are in before touching either.
- Before implementing, state the business rule, the affected flow, the invariants that must stay true, and any requirement that is still unclear.
- After implementing, review the complete diff against those four points, and check callers, retries, concurrency, transactions, partial failures, backward compatibility, and existing tests.
- Never call a change safe while its runtime behavior is unverified — say what was verified and what was not.
- Tickets here are often thin — a title alone, a few lines, or an account of current behaviour that is simply wrong. Verify a ticket's or bug report's premise against the code before acting on it, and trace the affected flow yourself rather than taking the description's word for how things work today.
- The intended business outcome is the goal, not the ticket's account of the implementation. If the premise is refuted but the outcome is clear, do not drop the ticket: say what the ticket got wrong, what the code actually does, and propose the corrected implementation scope.
- If that corrected scope materially differs from the work as requested, surface the difference and ask before implementing.
- If the intended outcome cannot be determined reliably, ask for clarification rather than guessing at it.
- Never edit or delete an already-applied migration — add a new reversing one. Before any DDL on an existing table, ask me how many rows it holds; the SQL note says what changes past roughly a million.

## Git (STRICT SAFETY RULES)
- **Never commit or push in a project repo yourself — not even after I say "go ahead" or approve the exact change.** I review every change first. When changes are ready, show me the diff summary (`git status --short`, `git diff`) and ask me to commit and push: give the one-liner commit message and the exact explicit push command (`git push origin <branch>`, upstream checked), and I run them. The only exception is the `rebase-staging` skill below, which pushes on its own when I invoke it.
- Any other git command that modifies repository state (`git reset`, `git rebase`, `git merge`, `git revert`, branch creation or deletion) still needs my explicit approval first: explain what it does, then ask. Batch several operations into one question.
- Never auto-commit, auto-push, or “helpfully” persist changes.
- **The index is mine alone. Never touch it — no exceptions, not even when I ask.** `git add`, `git stage`, `git rm --cached`, `git restore --staged`, `git reset <path>`, `git checkout -- <path>`, `git stash` in any writing form (bare, `push`, `pop`, `apply`, `drop`, `clear`, `branch`, `create`, `store`): forbidden outright. Reading stashes with `git stash list` or `git stash show` is fine. There is no phrasing of a request that authorizes them; if I appear to ask, tell me the command to run and let me run it. The only carve-outs are memory repos under `~/.claude/projects/*/memory/` and the `pickers-training` records repo, per *Memory Repos* below — that is my bookkeeping, not a project index.
- This holds even when staging looks like the only way to finish a task you were told to do. Deleting a file that is already staged is the worked example: `rm` it from disk, then STOP and tell me the staged add is still in the index and which command clears it. Do not run `git rm --cached` to "complete" the delete. Same for any half-done state — report it, do not tidy it.
- Never unstage either. If I have staged something you think is wrong — a file my conventions keep untracked, a secret, a stray artifact — say so in one line and leave it exactly where it is. Something in my setup may auto-stage new files; that is mine to manage, not yours to correct.
- Never stage as a convenience step — not to produce a diff, not to scope a review, not to "prepare" a commit I have not asked for. To show me a change, use `git diff` (unstaged), `git diff HEAD`, or `git status --short`; none of those touch the index. If a skill or command says it reviews "staged" changes and nothing is staged, review the working tree instead and say so — do not stage to satisfy it.
- "Implement this", "fix it", or approving a plan is approval to EDIT FILES ONLY. It is never approval to stage, commit, or push. Approval for one of those does not extend to the others, or to a later change.
- Never rebase, reset, or push onto `staging`, `main`, or `master` — including indirectly, through a branch whose upstream points at one of them.
- Never squash, amend, or fold commits together without asking me first. By default every change is a new commit on top of the branch head, pushed as a fast-forward. Rebasing a PR branch onto its base to prepare it for merge is fine when I ask for it: keep every commit (no squashing), and give me the explicit `git push --force-with-lease=<branch>:<old-sha> origin <branch>` command to run. The `rebase-staging` skill below stays pre-authorized.
- Before any push, read the upstream: `git rev-parse --abbrev-ref '@{upstream}'`. A bare `git push` (with or without `--force-with-lease`) targets that upstream, not a same-named remote branch. If it differs from the current branch name, stop and push explicitly instead: `git push -u origin <branch>`. This has no exceptions: a skill that force-pushes names its target branch explicitly rather than relying on the upstream.
- Exception — the `rebase-staging` skill: invoking it is approval to run its whole flow (fetch, pull, rebase, force-push) without pausing to confirm each step. That approval covers the flow, not the target: its step 8 pushes explicitly with `git push --force-with-lease origin HEAD`, so the upstream rule in `CLAUDE.md` is satisfied rather than waived. Never rewrite that push to a bare one.
- A rebase or force-push on a branch with zero commits of its own is a no-op at best and a push to the base branch at worst. Check `git log --oneline origin/<base>..HEAD` first; if it is empty, report that and do nothing.
- Every new branch — one I ask for or one you create — is meant to exist on the remote. Immediately after creating it, ask me to publish it with `git push -u origin <branch>`; that sets its own upstream instead of leaving it inheriting the base branch's. Never leave a new branch local-only without asking.
- Do not add Claude/AI co-authorship to commits, PRs, or related artifacts.
- Never commit secrets.
- Exception — memory repos: committing inside `projects/*/memory` git repos and the `pickers-training` repo is pre-authorized; commit there per the *Memory Repos* section. This does NOT extend to pushing or to the `.claude` repo itself.
- When indicating where a change, comment, or fix belongs, always reference the git **branch** — never look up or cite a GitHub PR (no `gh pr ...`, no PR numbers/links). The user maps branch → PR themselves.
- `gh` is read-only. Reading a PR is fine when I ask for output about it — `gh pr view`, `gh pr diff`, `gh pr list`, `gh pr checks`, GET-only `gh api`. Never run a `gh` command that creates or changes anything on GitHub: no `pr create`/`edit`/`comment`/`review`/`merge`/`close`/`ready`/`checkout`, no `release create`, no `issue` writes, no label, assignee, milestone or workflow changes, no non-GET `gh api`. Draft the text and I post it.
- The read allowance above does not loosen the branch-not-PR rule: keep citing the **branch** when saying where a change belongs, and reach for `gh` only when the PR itself is the subject of what I asked for.
- Issue-tracker writes are manual. Reading tickets is fine; never create, comment, transition, assign, or link. Draft the text for me to paste.
- Slack is read-only, with no exceptions — not even when I say "send it" or approve the exact text. Reading channels, threads, users and files is fine. Never send, schedule or draft a message, and never react, create or edit a canvas or list, or create a conversation. Give me the message text in chat and I post it.
- A cloud or remote session refines the plan and hands it back for local implementation — it does not open a pull request itself.

## Memory Repos
- Memory lives under `~/.claude` (resolves to each machine's home dir): each per-project memory folder is at `~/.claude/projects/<project>/memory/` (do not guess the location). Each is its own standalone git repo (NOT a submodule). The `.claude` repo does not track them (`projects/` is gitignored), so they never reach the main repo or its remote.
- After creating, editing, or deleting any memory file (including `MEMORY.md`), `git add -A` + `git commit` inside that memory folder's repo — Claude makes the commit itself (there is no hook). Pre-authorized; do not ask. Write a meaningful short message describing the change: `memory: <short description>`. No AI co-authorship.
- New project's first memory write: `git init -b master` the folder first. Never push.
- The same applies to the coaching records repo `pickers-training` (sibling of the `pickers-service` repo root, local only, no remote): after the `pickers-coach` skill changes any file there, `git add -A` + `git commit` inside it, message `training: <short description>`. Pre-authorized; do not ask. Never push, never add a remote.
- A rule that applies to every repo belongs in this file or in the reference notes, not in a project memory. Project memory holds the repo-specific fact and the worked example that justifies the rule.

## Output & Tone
- Responses must be short and concise. No trailing summaries after completing a task.
- One sentence of context before tool calls; one sentence of update at key moments. Silent is not acceptable; verbose is not either.
- Structure a report as: what was done → what differs → what is not done. When asked to shorten, cut hard.
- No emojis in code, commits, or responses unless explicitly requested.
- Commit messages are a single one-liner (no body).
- Never put a ticket key (`STR-123` or any other) in a commit message, neither in the scope (`feat(STR-123):`) nor in the body. Use a component scope instead, e.g. `feat(task_scheduler):`.
