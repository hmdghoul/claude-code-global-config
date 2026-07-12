---
name: slack-ticket-msg
description: Generate a copy-pasteable Slack message announcing a Jira ticket to a teammate or team lead, in a fixed friendly format (greeting, one-line what-it-is + ticket link, quick plain-English summary, optional endpoint/interface bullets). Use when telling someone on Slack about a ticket you created for them to pick up (e.g. handing frontend work to the FE lead).
---

## Context (for deriving the summary)
Current branch: !`git rev-parse --abbrev-ref HEAD`
Recent commits: !`git log -5 --oneline`

## Inputs

Read the argument passed to this skill ($ARGUMENTS) — it may contain the recipient name, the
ticket, or free text. Gather these three things; take whatever the conversation already
provides, and ask the user only for what is genuinely missing (do not guess or use
placeholders):

1. **Recipient** — the person's first name (e.g. Saadany). If none is given and none can be
   inferred, use `team`.
2. **Ticket** — the Jira key (e.g. STR-630) and its full URL. If only one is given, ask for
   the other. Show the key inline and the full URL as the link.
3. **What + summary** — a one-line "what it is" and a 2–4 sentence plain-English summary of
   what the feature does and why it matters. Prefer to derive these from the current
   conversation (the feature/ticket just discussed); fall back to the branch + commits above.
   Keep it product-level and readable — not a raw changelog.

If the feature exposes an API or interface the recipient's team will integrate against, add a
short bullet list of the key endpoints/interfaces (method + path + one phrase). Otherwise omit
that block.

## Output

Output ONLY the message below, in a fenced code block so it is copy-pasteable. No intro, no
commentary. Keep the `:wave:` shortcode. Keep the soft "whenever you have capacity" ask.

```
Hey {Recipient} :wave:
Created {KEY} for {one-line what it is} — whenever you have capacity: {ticket_url}

Quick summary: {2–4 sentence plain-English summary of what it does and why}.

{optional — only if there's an API/interface to integrate against:}
{N} endpoints, {shared prefix or context}:
- {METHOD} {path} — {one phrase}
- {METHOD} {path} — {one phrase}
```
