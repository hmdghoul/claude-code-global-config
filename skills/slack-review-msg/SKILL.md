---
name: slack-review-msg
description: Generate a copy-pasteable Slack review request from the active git diff plus the PR link and Jira issue number the user provides. Supports a reminder mode for nudging the team about an old, still-unreviewed PR. Use when asking teammates on Slack to review a pull request.
---

## Current changes
!`git diff HEAD`

## Recent commits
!`git log -5 --oneline`

## Mode

Read the argument passed to this skill ($ARGUMENTS).

- If the argument is empty, do not pick a mode — ask the user which mode they want (Review request or Reminder) and wait for their reply before producing the message.
- If the argument is `reminder`, `remind`, `nudge`, or `old`, use **Reminder** mode.
- For any other argument, use **Review request** mode.

In every mode: use the PR link and Jira issue number the user provided in the conversation. If either was not provided, do not guess or use a placeholder — ask the user for the missing item(s) and wait for their reply before producing the message. Show the Jira as the plain issue number only (e.g. ABC-123) — no link. From the git context above, derive ONE short descriptive title and the key technical changes. If there are no changes, say so and stop.

Output ONLY the message below for the selected mode, in a fenced code block so it is copy-pasteable. No intro greeting, no commentary, no emojis beyond what is shown.

## Review request mode

Hi team, need your review: {pr_url} | {jira_number}

*[Short title from the code context]*

• [Change 1]
• [Change 2]
• [Change 3]

## Reminder mode

Hi team, this PR is still waiting for review — please take a look when you can: {pr_url} | {jira_number}

*[Short title from the code context]*

• [Change 1]
• [Change 2]
• [Change 3]
