---
name: explain-changes
description: Analyze git diff, create a beginner-friendly changelog, and trace code sources to their business impact.
---

## Current changes
"!`git diff HEAD`"

Write `CHANGELOG.md` in the repo root explaining the diff above to a complete beginner. Ignore styling, patterns, linting and formatting. Cover:

1. **The Business Purpose**: the real-world problem this solves for the user or business.
2. **What Changed**: plain-English old-vs-new behavior.
3. **Affected Code Blueprint**: one entry per functional change, in this format:

### Affected Code Blueprint

* **File:** `[Path/to/file.ext]` (Line numbers or Function/Class name)
  * **What code changed:** One simple sentence.
  * **Direct Impact:** What it achieves in the live system and how it serves the business purpose.
