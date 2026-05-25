# Global Claude Code Rules

## Shell
- Default to Windows PowerShell. Use the PowerShell tool, not Bash.
- Use PowerShell cmdlets (`Get-Content`, `Get-ChildItem`, `Select-String`) — not Unix tools (`cat`, `ls`, `grep`).

## Workflow
- Explore the codebase before making changes.
- Ask before architectural changes; explain non-obvious decisions.

## Git
- Write clear, concise commit messages.
- Do not add Claude/AI co-authorship to commits, PRs, or related artifacts.
- Never commit secrets (API keys, credentials, tokens).

## Code
- Readability over cleverness.
