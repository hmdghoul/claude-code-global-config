---
name: review-lessons-reconcile
description: Cross-check the CURRENT project's mined review lessons against the global rule tree (~/.claude/CLAUDE.md and rules/) and that project's memory, then report decisions — what is already covered, what should be added or strengthened, where it belongs, and what conflicts with an existing rule. Stops immediately if this repository has no review lessons yet; never reconciles another project's. Proposes only; never edits a rule file or memory without explicit approval. Use after running review-lessons, or when asked whether the lessons are reflected in the rules.
---

# Reconcile review lessons with the rules

Takes the lessons produced by the `review-lessons` skill and answers one question per lesson: **is this already a rule, should it become one, and where does it belong?**

The output is a set of **decisions for the user to approve**. This skill writes nothing on its own.

## Why this is not part of `review-lessons`

That skill is read-only against GitHub and writes only to its own output folder. This one proposes edits to the files that govern every future session. Different blast radius, so a different skill and a stricter rule: **propose, never apply.**

## Step 0 — Gate: this project must have review lessons, or stop

This skill reconciles **the current project's** lessons and nothing else. Resolve the repository you are actually in, then look for its lesson set:

```bash
gh repo view --json nameWithOwner -q .nameWithOwner        # -> <owner>/<name>
ls ~/.claude/lessons/<owner>/<name>/.review-lessons-state.json
```

**If that file does not exist, stop.** Do not fall back to another project's lessons, do not offer to reconcile a different repository, and do not reconstruct lessons from anything else. Report exactly this and end:

> No review lessons exist for `<owner>/<name>`. Run the `review-lessons` skill for this repository first — this skill only reconciles lessons that were mined from it.

If the current directory is not a git repository or `gh` cannot resolve a remote, stop the same way: there is no project to reconcile.

Only when the file exists, load it — the `lessons` array carries `mistake`, `whyItMatters`, `whatToCheck`, `occurrences`, and `prNumbers`. Prefer it over parsing the rendered markdown. If it exists but holds zero lessons, stop and say the last run produced none.

## Step 1 — Read the current rule tree. Every time.

Never reconcile against a remembered structure. The tree gets reorganised, and a stale picture produces proposals aimed at files or sections that no longer exist.

```bash
cat ~/.claude/CLAUDE.md
ls ~/.claude/rules/ && cat ~/.claude/rules/*.md
```

Note the imports at the top of `CLAUDE.md` — that list is the authoritative set of rule files. Then read the memory for **this same project**:

```bash
ls ~/.claude/projects/<project-slug>/memory/
cat ~/.claude/projects/<project-slug>/memory/MEMORY.md
```

Read in full any memory file whose index line looks related to a lesson. Also check the analysed repository for its own `CLAUDE.md` — if one exists it outranks the global defaults for that repo, and a lesson it already covers needs nothing.

## Step 2 — Route each lesson

Two questions, in this order.

**First: is it universal or repo-specific?** The governing rule is in `CLAUDE.md` under *Memory Repos*: a rule that applies to every repo belongs in the global tree; project memory holds the repo-specific fact and the worked example that justifies it. A lesson naming a table, a service, a bundle filename, or a framework only this repo uses is repo-specific — no matter how strongly the evidence supports it.

**Second: which file?** Match the lesson to the file whose scope already covers that subject, and to a section that already exists there. Read the tree's own headers rather than assuming this table is current:

| Lesson is about | Target |
|---|---|
| Language-agnostic style, comments, additive/revertible change | `rules/preferences.md` |
| Matching existing patterns, architecture, layering, jobs and events, logging | `rules/repository.md` |
| Kotlin idioms, Spring, JPA/Hibernate, build | `rules/lang-kotlin.md` |
| Queries, schema, migrations | `rules/lang-sql.md` |
| How a workflow or deliverable should be produced | `rules/skills.md` |
| Precedence, shell, workflow gates, git safety, memory, output | `CLAUDE.md` |
| A fact true only of this repo | that project's memory |

If a lesson fits no existing section, say so and propose the section — do not force it into a section it half-matches.

## Step 3 — Decide, one verdict per lesson

- **already-covered** — quote the existing rule line verbatim and name its file. No action. Say this plainly and often; it is the most useful verdict and the easiest to skip past.
- **strengthen** — a rule exists but is vaguer or narrower than the evidence warrants. Give the current line and the proposed replacement, and say what the evidence adds.
- **add** — no rule covers it. Give the exact line to insert, the file, and the section.
- **add-to-memory** — repo-specific. Give the memory file name, `description`, `metadata.type`, the body, and the `MEMORY.md` pointer line. Check the existing memories first: if one already covers the topic, propose an edit to that file rather than a new one.
- **conflict** — the lesson contradicts an existing rule or a recorded deliberate decision. **Never resolve this yourself.** Show both sides and ask. A reviewer's repeated comment is not automatically right; the user may have decided against it on purpose.
- **no-action** — real, but not rule-shaped: too situational, already enforced by CI or a linter, or a one-off. Say why.

## Step 4 — Report

Lead with a table: lesson, verdict, target. Then the details for every verdict that needs one, in the order a person would act on them.

For each proposal give the **exact text to insert**, ready to paste. Cite the evidence — occurrence count and two or three PR numbers — so the user can judge whether it earns its place.

Then ask which to apply. Apply only what is approved, one target at a time, and re-read the file immediately before editing it.

## Quality bars

- **Every line added to the global tree is read at the start of every session, in every project, forever.** That is the real cost. A rule must be worth that. Prefer strengthening an existing line over adding a neighbouring one, and prefer one precise sentence over three hedged ones.
- **Never propose a rule that only one repository needs.** That is the single most common way a global rule file rots. Route it to memory instead.
- **Match the voice of the file you are editing** — these files are terse, imperative, second person, and state the reason inline. A proposal that reads like documentation will not survive.
- **Quote before you claim.** "Already covered" without the quoted line is an assertion, not a finding. Same for "conflicts".
- **Do not propose what a tool already enforces.** If the formatter, compiler, or CI catches it, a rule adds noise and nothing else.
- Evidence strength is not the same as rule-worthiness. A lesson with 100 occurrences may be a linter's job; one with 5 may be a data-corruption class worth a permanent rule. Say which is which.

## Safety

- Propose only. Editing `CLAUDE.md`, anything in `rules/`, or any memory file requires explicit approval in the message that asks for it.
- Memory commits are pre-authorized once a memory file is actually written (see *Memory Repos* in `CLAUDE.md`) — but writing it is not. Get approval for the content first, then write and commit.
- Never edit the `.claude` repo's tracked files as a side effect, and never stage or commit there.
- If a proposal would reverse a decision recorded in project memory, that is a **conflict**, not an improvement.
