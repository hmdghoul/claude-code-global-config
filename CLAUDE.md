# Global Claude Code Rules

Scope split — the rest of my rules live in `rules/` and are imported here:
@rules/preferences.md
@rules/repository.md
@rules/lang-kotlin.md
@rules/lang-sql.md
@rules/skills.md

## Rule Precedence
Rules in `rules/` are defaults, not laws. When one collides with something below, the higher item wins: follow it, and say in one line which default yielded and why. Never yield silently, and never invent a conflict to avoid a rule you dislike.
1. Business requirements and invariants — the outcome the system must achieve, including what a ticket asks for. A ticket's premise is not one of these: it is a claim about how the system behaves today, and it yields to item 3. A refuted premise does not take the outcome with it.
2. Framework and language correctness — where an idiom exists because the compiler, ORM, broker, or runtime needs it. This constrains every implementation, including one a ticket proposes.
3. Evidence from the affected flow — what the code demonstrably does at runtime beats what a rule or a ticket assumes.
4. Repository-specific instructions — a repo's own `CLAUDE.md`, its docs, its ADRs.
5. Established codebase patterns — the nearest sibling's way of doing it.

These never yield and are not defaults: git safety and approval, permissions (`gh`, issue trackers), secrets, destructive or irreversible actions, generated files, file encoding, already-applied migrations, and every before/after-implementing verification rule. If one of these appears to conflict with a ticket, stop and ask.

## Shell
- Default to Windows PowerShell. Use the PowerShell tool, not Bash.
- Use PowerShell cmdlets (`Get-Content`, `Get-ChildItem`, `Select-String`) — not Unix tools (`cat`, `ls`, `grep`).
- Exception — when the harness puts the session in a mode that directs tool use to Bash (bypass permissions), Bash is fine for internal plumbing: reading, searching, and editing files. Anything you hand me to run myself, and anything touching Windows paths, tooling, or file encoding, stays PowerShell. Say once per session which you are using.
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
- Staging counts. Never run `git add`/`git stage`/`git rm --cached`/`git restore --staged` unless I explicitly asked for it in that message. Leave edits unstaged in the working tree and let me stage them myself.
- Never stage as a convenience step — not to produce a diff, not to scope a review, not to "prepare" a commit I have not asked for. To show me a change, use `git diff` (unstaged), `git diff HEAD`, or `git status --short`; none of those touch the index. If a skill or command says it reviews "staged" changes and nothing is staged, review the working tree instead and say so — do not stage to satisfy it.
- "Implement this", "fix it", or approving a plan is approval to EDIT FILES ONLY. It is never approval to stage, commit, or push. Approval for one of those does not extend to the others, or to a later change.
- Never rebase, reset, or push onto `staging`, `main`, or `master` — including indirectly, through a branch whose upstream points at one of them.
- Before any push, read the upstream: `git rev-parse --abbrev-ref '@{upstream}'`. A bare `git push` (with or without `--force-with-lease`) targets that upstream, not a same-named remote branch. If it differs from the current branch name, stop and push explicitly instead: `git push -u origin <branch>`. This has no exceptions: a skill that force-pushes names its target branch explicitly rather than relying on the upstream.
- Every new branch — one I ask for or one you create — is meant to exist on the remote. Immediately after creating it, ask me to publish it with `git push -u origin <branch>`; that sets its own upstream instead of leaving it inheriting the base branch's. Never leave a new branch local-only without asking.
- Do not add Claude/AI co-authorship to commits, PRs, or related artifacts.
- Never commit secrets.
- Exception — memory repos: committing inside `projects/*/memory` git repos is pre-authorized; commit there per the *Memory Repos* section. This does NOT extend to pushing or to the `.claude` repo itself.
- When indicating where a change, comment, or fix belongs, always reference the git **branch** — never look up or cite a GitHub PR (no `gh pr ...`, no PR numbers/links). The user maps branch → PR themselves.
- `gh` is read-only. Reading a PR is fine when I ask for output about it — `gh pr view`, `gh pr diff`, `gh pr list`, `gh pr checks`, GET-only `gh api`. Never run a `gh` command that creates or changes anything on GitHub: no `pr create`/`edit`/`comment`/`review`/`merge`/`close`/`ready`/`checkout`, no `release create`, no `issue` writes, no label, assignee, milestone or workflow changes, no non-GET `gh api`. Draft the text and I post it.
- The read allowance above does not loosen the branch-not-PR rule: keep citing the **branch** when saying where a change belongs, and reach for `gh` only when the PR itself is the subject of what I asked for.
- Issue-tracker writes are manual. Reading tickets is fine; never create, comment, transition, assign, or link. Draft the text for me to paste.
- A cloud or remote session refines the plan and hands it back for local implementation — it does not open a pull request itself.

## Memory Repos
- Memory lives under `~/.claude` (resolves to each machine's home dir): each per-project memory folder is at `~/.claude/projects/<project>/memory/` (do not guess the location). Each is its own standalone git repo (NOT a submodule). The `.claude` repo does not track them (`projects/` is gitignored), so they never reach the main repo or its remote.
- After creating, editing, or deleting any memory file (including `MEMORY.md`), `git add -A` + `git commit` inside that memory folder's repo — Claude makes the commit itself (there is no hook). Pre-authorized; do not ask. Write a meaningful short message describing the change: `memory: <short description>`. No AI co-authorship.
- New project's first memory write: `git init -b master` the folder first. Never push.
- A rule that applies to every repo belongs in this file, not in a project memory. Project memory holds the repo-specific fact and the worked example that justifies the rule.

## Output & Tone
- Responses must be short and concise. No trailing summaries after completing a task.
- One sentence of context before tool calls; one sentence of update at key moments. Silent is not acceptable; verbose is not either.
- Structure a report as: what was done → what differs → what is not done. When asked to shorten, cut hard.
- No emojis in code, commits, or responses unless explicitly requested.
