---
name: feature-doc
description: Generate a grounded, stakeholder-facing feature document (current + future implementation) for the CURRENT git branch by scanning its diff and the surrounding code — no assumptions. Outputs either a shareable Artifact page or a Markdown file in the repo. Use when the user wants a business/feature writeup of what a branch implements, e.g. "/feature-doc", "document this branch", "make a feature overview".
---

# feature-doc

Write a business-readable feature document for the current branch in two halves: **Current implementation** (what this branch ships) and **Future implementation** (grounded next steps). Output an Artifact or a Markdown file, whichever the user chooses.

## Grounding contract

- Read the changed files in full, plus the code they touch. Never describe the feature from the branch name.
- Every capability, data field and safeguard must trace to a specific file (ideally a line).
- **Shipped** means implemented on this branch. **Planned** means a clearly committed next step. **Proposed** means an opportunity surfaced from code or review, labeled as such.
- The Jira ticket states intent and the code states reality; say where they diverge. Never invent requirements, metrics, dates, owners or a roadmap. Without a ticket, infer intent from the branch, commits and code, and say it is inferred.
- Under-claim rather than over-claim, and name anything ambiguous.
- Keep the prose business-readable (no class, table or endpoint names) while the analysis stays code-grounded.

## Arguments

`/feature-doc [format] [...]`, all optional:
- `format`: `artifact`, `md` or `markdown`. If omitted, ask in Step 4.
- `base=<branch>`, an explicit ticket key (overrides the branch's), or pasted ticket text (used only if Jira is unreachable).

## Step 1: Scope

1. Run `git branch --show-current`. If it is empty or `staging`/`main`/`master`, stop and ask the user to switch to a feature branch.
2. Base is `base=` if given, otherwise the first of `staging`, `main`, `master` present in `git branch -r`. Run `git fetch origin <base>` on a best-effort basis; if offline, use the local ref and say so.
3. Run `git diff --stat origin/<base>...HEAD` and `git log origin/<base>..HEAD --format='%s%n%b'`.
4. **Fetch the Jira ticket before writing anything.** Take the key from the argument if given, otherwise the first match of `(^|/)[A-Z][A-Z0-9]+-[0-9]+` in the branch name. If there is no key, ask with AskUserQuestion: supply a key, or **"No ticket — use commits + titles only"**. If a key resolved, don't ask; just fetch. Call `mcp__atlassian__getJiraIssue` with `responseContentFormat: "markdown"` and `fields` that include `description` and `comment` (comments often change scope). For `cloudId`, use the site host if known; otherwise call `mcp__atlassian__getAccessibleAtlassianResources` once and reuse the result. If the fetch fails or the user chose commits-only, infer intent, say so, and continue. Never block on Jira.

## Step 2: Understand

- Read every changed file in full with the Read tool, not through a `git diff` dump, which garbles UTF-16 files on Windows. Follow the interfaces, callers (Grep the symbol), migrations, config and enums they reference.
- Establish: **the problem**; **what shipped** (capabilities, each tied to code); **data** (new tables, columns or models); **safeguards** (transactions, isolation, validation, attribution).
- **Requirement coverage** (only when a ticket was fetched): mark every acceptance criterion, "must" statement, schema or constraint detail, and DoD item as met, partially met or not met, grounded in the diff.
- **Future work** comes only from real signals: unmet criteria, `TODO`/`FIXME` in the diff, stubbed paths, an obvious counterpart (such as a UI that lives elsewhere), and gaps you can substantiate. Classify each as Planned or Proposed.
- For a large or subtle diff, you may fan out readers with Agent or Workflow, but claim only what you verified.

## Step 3: Sections

- Problem: 2-3 short paragraphs.
- Current implementation: one card per real capability.
- Optional sections: How it works (only for a real mechanism), Data captured (only if a record is added or exposed), Safeguards (only if real guardrails exist).
- Requirements not yet met (optional): include only with a fetched ticket that has unmet or partial requirements. List only the gaps, in the ticket's terms, stating what the code does or doesn't do. Don't repeat the Future section's wording.
- Future implementation: each item labeled Planned or Proposed.

Omit any section that would be padding.

## Step 4: Format

If no `format` was given, ask with AskUserQuestion: **Artifact** (shareable page, private until shared) or **Markdown** (a file in the repo).

## Step 5A: Artifact

1. Load the `artifact-design` skill first.
2. Copy this skill's `assets/template.html` to the scratchpad.
3. Replace every `{{PLACEHOLDER}}` with grounded content, and duplicate the repeatable blocks (cards, flow nodes, rows, roadmap items) as needed. Delete any OPTIONAL `<section>` that doesn't apply. Keep the `<style>` block unchanged.
4. Set a concrete `<title>`. Publish with a one-sentence `description`, a one-word `icon` (kept the same across redeploys of the feature) and a short `label`.
5. Report the URL and say it is private until shared.

## Step 5B: Markdown

Write to `feature-docs/<branch-slug>.md` at the repo root (replace `/` and whitespace with `-`, and create the folder if needed). Never write into generated docs areas. Put a source-path HTML comment on each Shipped claim. Report the path, and don't stage or commit it.

```markdown
# <Feature name>

> <one-line summary>  ·  <Project> · <Area> · <ticket-or-branch>  ·  Updated <date>

**Status legend:** `[Shipped]` implemented on this branch · `[Planned]` committed next step · `[Proposed]` opportunity from review (not committed)

## The problem
<2-3 short paragraphs, grounded>

## Current implementation
- **[Shipped] <Capability>** — <description>  <!-- (source: path/to/File) -->
- ...

### How it works  <!-- optional -->
<numbered flow or short prose of the real mechanism>

### What we capture  <!-- optional -->
| Field | What it tells the team |
|---|---|
| ... | ... |

### Safeguards  <!-- optional -->
- **<lead>** — <body>

## Requirements not yet met  <!-- optional: only when a ticket was fetched AND not all its requirements are met; omit if all met or no ticket -->
- **<unmet requirement / acceptance criterion, in the ticket's terms>** — <what the diff does instead / what's missing>
- **<partially-met requirement>** — Partially met: <what's covered vs what's not>

## Future implementation
- **[Planned] <next step>** — <why / what it unblocks>
- **[Proposed] <opportunity>** — <grounded rationale; note it needs confirmation>

---
_Generated from branch `<branch>` vs `<base>`. Requirements <from Jira `<TICKET-KEY>` | pasted | inferred from branch + commits + code>._
```

## Finish

State the branch and base compared, the requirements source (Jira key, pasted, or inferred) and the output location. Surface anything ambiguous or unverifiable.
