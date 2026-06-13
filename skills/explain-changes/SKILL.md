---
name: explain-changes
description: Analyze git diff, create a beginner-friendly changelog, and trace code sources to their business impact.
---

## Current changes
"!`git diff HEAD`"

Analyze the git diff shown above. 

Create a file named CHANGELOG.md in the root directory. Structure the explanation so a complete beginner who knows absolutely nothing about this project can understand what happened. 

Do NOT discuss code styling, project patterns, linting, or formatting choices. Instead, focus entirely on:

1. **The Business Purpose**: Deduce and explain the business or product reason behind this change. What real-world problem does this solve for the user or the business? Why do we need this from a product perspective?
2. **What Changed (Beginner-Friendly)**: Explain in simple terms what the code does now compared to before. Use plain English to describe the functional differences, including brief old-vs-new behavior comparisons.
3. **Code Source & Impact Mapping**: For every distinct functional change listed, provide a highly targeted breakdown mapping the modified code to its real-world effect. Use the following structured format for this section:

### Affected Code Blueprint

* **File:** `[Path/to/file.ext]` (Line numbers or Function/Class name)
  * **What code changed:** A 1-sentence, simple description of the code added, modified, or deleted.
  * **Direct Impact:** What exactly does this specific line/block of code achieve in the live system? How does it connect to the business purpose?
