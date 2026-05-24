# Claude Code Global Config Template

A curated, production-ready global `CLAUDE.md` configuration for [Claude Code](https://claude.ai/code) - Anthropic's official AI coding assistant CLI.

## What is CLAUDE.md?

`CLAUDE.md` is a configuration file that Claude Code automatically loads into every conversation. It provides persistent context about your coding standards, workflow preferences, and project conventions.

**Global config location:** `~/.claude/CLAUDE.md`

## Features

- **Smart workflow** - explore before implementing, plan before coding
- **Git best practices** - clear commits, no credential leaks
- **Readability first** - clarity over cleverness

## Quick Start

```bash
# Clone to your .claude folder
git clone https://github.com/coelhoxyz/claude-code-global-config.git ~/.claude

# Or just copy the CLAUDE.md
curl -o ~/.claude/CLAUDE.md https://raw.githubusercontent.com/coelhoxyz/claude-code-global-config/main/CLAUDE.md
```

## Resources

- [Claude Code Best Practices - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Using CLAUDE.MD Files - Official Guide](https://claude.com/blog/using-claude-md-files)
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)

## License

MIT - Use freely, customize endlessly.
