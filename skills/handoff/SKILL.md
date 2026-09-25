---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

Write a handoff document, saved in the current workspace, that lets a fresh agent continue this conversation's work. Reference existing artifacts (specs, plans, ADRs, issues, commits, diffs) by path or URL instead of repeating them. Arguments, if given, describe the next session's focus; tailor the doc to it.
