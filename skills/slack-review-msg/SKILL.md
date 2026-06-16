---
name: slack-review-msg
description: Generate a copy-pasteable Slack review request from the active git diff plus the PR link and Jira issue number the user provides. Use when asking teammates on Slack to review a pull request.
---

## Current changes
!`git diff HEAD`

## Recent commits
!`git log -5 --oneline`

From the git context above, derive ONE short descriptive title and the key technical changes. Use the PR link and Jira issue number the user provided in the conversation. If there are no changes, say so and stop.

If the PR link or the Jira number was not provided, do not guess or use a placeholder — ask the user for the missing item(s) and wait for their reply before producing the message.

Output ONLY the message below in a fenced code block so it is copy-pasteable. No intro greeting, no commentary, no emojis beyond what is shown. Show the Jira as the plain issue number only (e.g. ABC-123) — no link.

Hi team, need your review: {pr_url} | {jira_number}

*[Short title from the code context]*

• [Change 1]
• [Change 2]
• [Change 3]
