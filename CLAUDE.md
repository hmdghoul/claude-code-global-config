# Global Claude Code Rules

## Shell (Windows)
- Default shell is **Windows PowerShell**. Use the PowerShell tool for all shell commands.
- Never call PowerShell commands via the Bash tool (e.g., `Bash(Get-Content ...)` is forbidden).
- Never use Bash/Linux commands (`cat`, `grep`, `chmod`, `ls`, etc.) unless the user explicitly requests Bash.
- Use PowerShell equivalents: `Get-Content`, `Get-ChildItem`, `Select-String`, etc.
- Prefer dedicated tools (Read, Grep, Glob) over shell commands when they cover the task.

## Code Style
- Prefer readability over cleverness

## Workflow
- Explore codebase before implementing changes

## Git Conventions
- Write clear, concise commit messages
- Never add your own co-authorship to commits, PRs, or related artifacts
- Never commit sensitive data (API keys, credentials)

## Communication
- Ask clarifying questions before architectural changes
- Explain reasoning for non-obvious decisions
