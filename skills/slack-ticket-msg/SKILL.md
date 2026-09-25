---
name: slack-ticket-msg
description: Generate a copy-pasteable Slack message announcing a Jira ticket to a teammate or team lead (greeting, ticket link, plain-English summary, optional endpoint bullets). Use when telling someone on Slack about a ticket you created for them to pick up (e.g. handing frontend work to the FE lead).
---

## Context
Current branch: !`git rev-parse --abbrev-ref HEAD`
Recent commits: !`git log -5 --oneline`

## Inputs

Take these from $ARGUMENTS and the conversation. Ask only for what is missing; never guess or use placeholders.

1. **Recipient**: first name. If none is given or inferable, use `team`.
2. **Ticket**: Jira key and full URL. Ask for whichever is missing.
3. **What + summary**: a one-line "what it is" plus a 2-4 sentence product-level summary of what it does and why it matters (not a changelog). Derive from the conversation first, then from the branch and commits above.

Add the endpoint block only if the recipient's team will integrate against an API or interface.

## Output

Only this message, in a fenced code block, with no commentary:

```
Hey {Recipient} :wave:
Created {KEY} for {one-line what it is} — whenever you have capacity: {ticket_url}

Quick summary: {2–4 sentence plain-English summary of what it does and why}.

{optional — only if there's an API/interface to integrate against:}
{N} endpoints, {shared prefix or context}:
- {METHOD} {path} — {one phrase}
- {METHOD} {path} — {one phrase}
```
