---
name: slack-review-msg
description: Generate a copy-pasteable Slack review request from the active git diff plus the PR link and Jira issue number the user provides. Supports a reminder mode for nudging the team about an old, still-unreviewed PR, and a release mode that summarises a release PR from its own commit list. Use when asking teammates on Slack to review a pull request.
---

## Current changes
!`git diff HEAD`

## Recent commits
!`git log -5 --oneline`

## Mode

Pick the mode from $ARGUMENTS:
- Empty: ask whether they want Review request or Reminder, and wait for the answer.
- `reminder`, `remind`, `nudge` or `old`: **Reminder**.
- Starts with `release` or `deploy`: **Release**.
- Anything else: **Review request**.

In Review request and Reminder, use the PR link(s) and Jira number(s) from the conversation. If either is missing, ask and wait; never guess or use a placeholder. Write Jira as plain keys (ABC-123), comma-separated, with no links. From the git context, derive one short title and the key changes. If there are no changes, say so and stop.

Output only the selected template, in a fenced code block. No greeting, no commentary, no emojis beyond the template's.

## Bullets

Bullets help a skimming reader decide whether the PR needs their eyes. Write two or three, each one short line that names the area touched and what it affects (a topic, endpoint, schema change, job or migration). If only two survive the rules below, ship two; never pad. Never include:
- Absences, such as "no API change" or "no migration".
- Anything the PR lines or title already say, such as which repo, merge order, or the title reworded.
- Mechanics, such as field counts, key formats, class names, volumes or rationale. Those belong in the PR description.

## One PR vs. several

With one PR, the link goes on the header line. With two or more, give each its own line in merge order as `{Label} — {pr_url}`. The label is one or two words describing what that PR changes (`Schema`, `Service`, `Migration`, `Config`, `Admin UI`, `Contract`, `Consumer`), and no label repeats. Jira numbers stay on the header line.

## Release mode

Build the message from the release PR alone. Use nothing from the conversation, memory, or the git context above, and include no Jira numbers.

1. Run `gh pr view {pr_url} --json title,baseRefName,headRefName,commits`. This is the only PR lookup allowed. If it fails or returns no commits, say so and stop.
2. Write one bullet per merged PR in commit order. For a merge-commit release, group each PR's commits into one bullet. There is no bullet cap.
3. Drop pure chores (formatting, lockfile bumps, CI tweaks) unless the release is only chores.

The Bullets wording rules still apply.

## Release mode — template

Hi team, release is ready for review: {pr_url}

*[Short title from the release contents]*

• [Merged PR 1]
• [Merged PR 2]
• [Merged PR 3]

## Review request mode — one PR

Hi team, need your review: {pr_url} | {jira_numbers}

*[Short title from the code context]*

• [Change 1]
• [Change 2]
• [Change 3]

## Review request mode — several PRs

Hi team, need your review: {jira_numbers}

{Label} — {pr_url}
{Label} — {pr_url}

*[Short title from the code context]*

• [Change 1]
• [Change 2]
• [Change 3]

## Reminder mode — one PR

Hi team, this PR is still waiting for review — please take a look when you can: {pr_url} | {jira_numbers}

*[Short title from the code context]*

• [Change 1]
• [Change 2]
• [Change 3]

## Reminder mode — several PRs

Hi team, these PRs are still waiting for review — please take a look when you can: {jira_numbers}

{Label} — {pr_url}
{Label} — {pr_url}

*[Short title from the code context]*

• [Change 1]
• [Change 2]
• [Change 3]
