---
name: explain-changes
description: Analyze git diff and create a beginner-friendly changelog
---

## Current changes
"!`git diff HEAD`"

Analyze the git diff shown above. 

Create a file named CHANGELOG.md in the root directory. Structure the explanation so a complete beginner who knows absolutely nothing about this project can understand what happened. 

Do NOT discuss code styling, project patterns, linting, or formatting choices. Instead, focus entirely on:

1. **The Business Purpose**: Deduce and explain the business or product reason behind this change. What real-world problem does this solve for the user or the business? Why do we need this from a product perspective?
2. **What Changed (Beginner-Friendly)**: Explain in simple terms what the code does now compared to before. Use plain English to describe the functional differences, including brief old-vs-new behavior comparisons.
