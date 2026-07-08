---
name: feature-doc
description: Generate a grounded, stakeholder-facing feature document (current + future implementation) for the CURRENT git branch by scanning its diff and the surrounding code — no assumptions. Outputs either a shareable Artifact page or a Markdown file in the repo. Use when the user wants a business/feature writeup of what a branch implements, e.g. "/feature-doc", "document this branch", "make a feature overview".
---

# feature-doc

Produce a business-readable feature document for the current branch. Two halves: **Current implementation** (what shipped on this branch) and **Future implementation** (grounded next steps). Every statement must trace to the real diff or code. Output is an **Artifact** (shareable page) or a **Markdown** file in the repo — the user chooses.

## Non-negotiable grounding contract (do not assume anything)

- Read the actual changed files in full and the code they touch — never describe the feature from the branch name or a guess.
- Every capability, data field, and safeguard in the doc must be traceable to a specific file (and ideally line) in the diff or codebase.
- Status labels are honest: mark **Shipped** only what is actually implemented on this branch; **Planned** only the clearly-committed next step; **Proposed** for opportunities surfaced from the code/review (label them, don't assert them as roadmap).
- Do **not** invent requirements, ticket text, metrics, dates, owners, or a roadmap. If the ticket/requirements are not provided, infer intent from branch name + commit messages + code and **state that intent is inferred**.
- Prefer under-claiming to over-claiming. If something is ambiguous, say so plainly rather than smoothing it over.
- The document body stays business-readable (avoid class/table/endpoint names in prose) — but the underlying analysis must be fully code-grounded.

## Arguments

Invoked as `/feature-doc [format] [ticket text...]`. All optional:
- `format`: `artifact` | `md` | `markdown`. If omitted, ask the user (see Step 4).
- Anything else on the line: treat as the ticket/requirements text or a base-branch hint. If it names a base branch (e.g. `base=main`), use it.

## Step 1 — Establish scope

1. Current branch: `git branch --show-current`. If empty (detached) or it is a base branch (`staging`/`main`/`master`), stop and tell the user to switch to a feature branch.
2. Base branch: default to the repo's main line. Detect it: prefer `staging` if it exists on the remote, else `main`, else `master` (`git branch -r`). Honor an explicit `base=` argument.
3. `git fetch origin <base>` (best-effort; if offline, use the local base ref and note it).
4. Changed files + stats: `git diff --stat origin/<base>...HEAD`.
5. Commit messages (intent signal): `git log origin/<base>..HEAD --format='%s%n%b'`.

## Step 2 — Understand deeply, don't skim

- Read every changed source file **in full** (the checked-out file, not just the diff). On Windows, source files may be UTF-16 — read the files directly with the Read tool rather than parsing a `git diff` dump, which renders as spaced-out characters.
- Follow the code outward: read the interfaces, callers, migrations, config, and enums the change references. Trace call sites of any changed/added function to see how it is actually used (Grep for the symbol).
- Build a factual picture of:
  - **The problem** the change addresses (from commits, comments, and what the code guards against).
  - **What shipped**: the concrete capabilities — endpoints/actions, recorded data, detection/automation, guardrails. Each tied to code.
  - **Data**: new tables/columns/models the change introduces or exposes.
  - **Safeguards**: transactional boundaries, best-effort/isolation, validation, attribution — anything that protects correctness.
  - **Future work — only from real signals**: `TODO`/`FIXME` in the diff, deferred or stubbed paths, an obvious counterpart (e.g. a backend change whose UI lives elsewhere), and known gaps/tradeoffs noted in comments or that you can substantiate from the code. Classify each as Planned vs Proposed.
- For a large or subtle diff, consider fanning out with the Agent/Workflow tools (one reader per subsystem or per requirement, adversarially verifying findings) before writing — but keep the doc's claims to what you verified.

## Step 3 — Decide what goes in each section

- Problem → 2-3 short paragraphs.
- Current implementation → one capability card per real capability (usually all Shipped).
- How it works (OPTIONAL) → include a flow only if there is a real mechanism; otherwise omit.
- Data captured (OPTIONAL) → include only if the change adds/exposes a record.
- Safeguards (OPTIONAL) → include only if the change builds in real guardrails.
- Future implementation → grounded next steps, each labeled Planned or Proposed.

Omit any optional section that would be padding. An honest short doc beats a padded one.

## Step 4 — Choose output format

If `format` was passed, use it. Otherwise ask with AskUserQuestion:
- **Artifact** — a shareable, rendered page (private until the user shares it).
- **Markdown** — a file committed in the repo.

## Step 5A — Artifact output

1. **Load the `artifact-design` skill first** (required before calling Artifact).
2. Copy `assets/template.html` (in this skill's folder) to the session scratchpad directory.
3. Replace every `{{PLACEHOLDER}}` with real, code-grounded content and fill/duplicate the repeatable blocks (cards, flow nodes, table rows, roadmap items). **Delete** any OPTIONAL `<section>` that doesn't apply. Keep the `<style>` block unchanged.
4. Set a concrete `<title>`. Publish with the Artifact tool: pass a one-sentence `description`, a `favicon` emoji that fits the subject (keep it stable across redeploys of the same feature), and a short `label`.
5. Report the URL and note it's private until shared.

## Step 5B — Markdown output

1. Slugify the branch name (replace `/` and whitespace with `-`).
2. Write to **`feature-docs/<branch-slug>.md`** at the repo root (create the `feature-docs/` folder if missing). Never write into a generated docs area (e.g. `docs/architecture/**`, per-component `**/docs/`); this dedicated folder avoids those.
3. Use this structure, mirroring the artifact but in plain Markdown, with honest status tags inline:

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

## Future implementation
- **[Planned] <next step>** — <why / what it unblocks>
- **[Proposed] <opportunity>** — <grounded rationale; note it needs confirmation>

---
_Generated from branch `<branch>` vs `<base>`. Requirements <provided | inferred from branch + commits + code>._
```

4. Keep a source pointer (file path) as an HTML comment on Shipped claims so a reviewer can verify. Report the written path. Do **not** `git add`/commit unless the user asks.

## Finish

State clearly: which branch/base was compared, whether requirements were provided or inferred, and where the output is (URL or file path). If anything was ambiguous or unverifiable, surface it — don't paper over it.
