# Claude Code Global Config

My global `~/.claude/` config for [Claude Code](https://claude.ai/code), version-controlled so it stays in sync across machines.

## Contents

| File             | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `CLAUDE.md`      | Global rules loaded into every Claude Code session     |
| `settings.json`  | Claude Code settings — model, plugins, status line     |
| `statusline.ps1` | PowerShell script that renders the status line         |
| `.gitignore`     | Allowlist — tracks only the files above                |
| `LICENSE`        | MIT                                                    |

The `.gitignore` ignores everything in `~/.claude/` and then un-ignores just the files above. Local state (`projects/`, `plugins/`, logs, caches) stays untracked.

## Setup (Windows)

```powershell
# If ~/.claude/ already has content, back it up first.
git clone https://github.com/hmdghoul/claude-code-global-config.git $env:USERPROFILE\.claude
```

## References

- [Claude Code docs](https://docs.anthropic.com/claude-code)
- [Claude Code best practices](https://www.anthropic.com/engineering/claude-code-best-practices)

## License

MIT
