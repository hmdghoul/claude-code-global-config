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

## Code
- Readability over cleverness.
- Prefer explicit logic over implicit behavior.
- No comments unless the WHY is non-obvious (hidden constraint, subtle invariant, workaround). Never explain WHAT the code does.
- No docstrings, no multi-line comment blocks.
- No emojis in code, commits, or responses unless explicitly requested.

## Output & Tone
- Responses must be short and concise. No trailing summaries after completing a task.
- One sentence of context before tool calls; one sentence of update at key moments. Silent is not acceptable; verbose is not either.