# Global Claude Code Rules

## Shell
- Default to Windows PowerShell. Use the PowerShell tool, not Bash.
- Use PowerShell cmdlets (`Get-Content`, `Get-ChildItem`, `Select-String`) — not Unix tools (`cat`, `ls`, `grep`).

## Workflow
- Explore the codebase before making changes.
- Ask before architectural changes; explain non-obvious decisions.
- Never assume intent — always validate before performing side-effect operations.

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
- Do not add Claude/AI co-authorship to commits, PRs, or related artifacts.
- Never commit secrets.
- Exception — memory repos: committing inside `projects/*/memory` git repos is pre-authorized; commit there per the *Memory Repos* section. This does NOT extend to pushing or to the `.claude` repo itself.
- When indicating where a change, comment, or fix belongs, always reference the git **branch** — never look up or cite a GitHub PR (no `gh pr ...`, no PR numbers/links). The user maps branch → PR themselves.
- When asked for a commit message, always provide TWO versions: a one-liner  and the normal version. Do not make me ask for the other.

## Memory Repos
- Memory lives under `~/.claude` (resolves to each machine's home dir): each per-project memory folder is at `~/.claude/projects/<project>/memory/` (do not guess the location). Each is its own standalone git repo (NOT a submodule). The `.claude` repo does not track them (`projects/` is gitignored), so they never reach the main repo or its remote.
- After creating, editing, or deleting any memory file (including `MEMORY.md`), `git add -A` + `git commit` inside that memory folder's repo — Claude makes the commit itself (there is no hook). Pre-authorized; do not ask. Write a meaningful short message describing the change: `memory: <short description>`. No AI co-authorship.
- New project's first memory write: `git init -b master` the folder first. Never push.

## Code
- Readability over cleverness.
- Prefer explicit logic over implicit behavior.
- No comments unless the WHY is non-obvious (hidden constraint, subtle invariant, workaround). Never explain WHAT the code does.
- No docstrings, no multi-line comment blocks.
- No emojis in code, commits, or responses unless explicitly requested.

## Output & Tone
- Responses must be short and concise. No trailing summaries after completing a task.
- One sentence of context before tool calls; one sentence of update at key moments. Silent is not acceptable; verbose is not either.