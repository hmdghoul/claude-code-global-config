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

In every mode: use the PR link(s) and Jira issue number(s) the user provided in the conversation. If either was not provided, do not guess or use a placeholder — ask the user for the missing item(s) and wait for their reply before producing the message. Show each Jira as the plain issue number only (e.g. ABC-123) — no link; separate multiple with commas. From the git context above, derive ONE short descriptive title and the key technical changes. If there are no changes, say so and stop.

Output ONLY the message below for the selected mode, in a fenced code block so it is copy-pasteable. No intro greeting, no commentary, no emojis beyond what is shown.

## Writing the bullets

The bullets exist so a reader can decide **whether this PR needs their eyes** — not to teach them the change. They are skimmed in a Slack channel, before anyone opens the diff.

- Keep each to one short line. If it wraps in Slack, it is too long.
- Say the **area touched and what it affects**: a new topic, a new endpoint, a schema change, a background job, a migration. That is what tells someone "this is mine" or "not mine".

Cut every bullet that does not survive these:

- **Never state an absence.** "No API change", "no migration", "no behaviour change" — a reader already assumes nothing is there unless told. Only say what the change does.
- **Never restate the structure.** The labelled PR lines already say which repo is which and, by their order, which merges first. A bullet repeating that is noise.
- **Never restate the title.** If the bullet is the title in other words, drop it.
- **Leave out the mechanics** — field counts, key formats, internal class names, rate or volume figures, why an approach was chosen. The reviewer meets all of that in the diff; it belongs in the PR description, not in Slack.

Two or three bullets. If only two survive, ship two — never pad to a count.

## One PR vs. several

**One PR** — put the link on the header line, as shown in the single-PR templates below.

**Two or more PRs** — never stack them on one line. Give each its own line, in the order they must merge, prefixed by one or two words naming what that PR holds:

```
Schema — {pr_url}
Service — {pr_url}
```

Derive the label from the repo and what the PR actually changes: `Schema`, `Service`, `Migration`, `Config`, `Admin UI`, `Contract`, `Consumer`. Never reuse the same label twice in one message. Keep the Jira number(s) on the header line, never beside a PR link.

The line order carries the merge order on its own — do not add a bullet repeating it.

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
