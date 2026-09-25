---
name: review-lessons-reconcile
description: Cross-check the CURRENT project's mined review lessons against the global rule tree (~/.claude/CLAUDE.md and the reference notes its routing table names in the vault) and that project's memory, then report decisions — what is already covered, what should be added or strengthened, where it belongs, and what conflicts with an existing rule. Stops immediately if this repository has no review lessons yet; never reconciles another project's. Proposes only; never edits a rule file or memory without explicit approval. Use after running review-lessons, or when asked whether the lessons are reflected in the rules.
---

# Reconcile review lessons with the rules

For each lesson from `review-lessons`, decide whether it is already a rule, should become one, and where it belongs. The output is decisions for the user to approve: **propose, never apply.**

## Step 0: Gate

```bash
gh repo view --json nameWithOwner -q .nameWithOwner        # -> <owner>/<name>
ls ~/.claude/lessons/<owner>/<name>/.review-lessons-state.json
```

If the file doesn't exist, report exactly this and end. Don't use another project's lessons or reconstruct lessons from anything else:

> No review lessons exist for `<owner>/<name>`. Run the `review-lessons` skill for this repository first — this skill only reconciles lessons that were mined from it.

If there is no git repo or `gh` can't resolve a remote, stop the same way. If the state file has zero lessons, stop and say the last run produced none. Otherwise, load its `lessons` array (`mistake`, `whyItMatters`, `whatToCheck`, `occurrences`, `prNumbers`) rather than parsing the markdown.

## Step 1: Read the current rule tree, every time

Never rely on a remembered structure.
- Read `~/.claude/CLAUDE.md`. Its *Reference Notes* table is the authoritative list of rule files. Read every note it lists, in full, from the folder it names. Nothing already in context substitutes for this.
- Read this project's `~/.claude/projects/<project-slug>/memory/MEMORY.md`, plus any memory file whose index line relates to a lesson.
- Read the analysed repo's own `CLAUDE.md` if it has one. It outranks the global defaults, and a lesson it covers needs nothing.

## Step 2: Route each lesson

1. **Universal or repo-specific?** Per *Memory Repos* in `CLAUDE.md`, a lesson that names a table, service, bundle filename or framework only this repo uses is repo-specific, however strong the evidence. It goes to project memory.
2. **Which file and section?** Use the tree's actual headers; this table is only a guide:

| Lesson is about | Target |
|---|---|
| Language-agnostic style, comments, additive/revertible change | `Code Style and Change Conventions` note |
| Matching existing patterns, architecture, layering, configuration, transactions and locks, jobs and events, logging | `Service Architecture Conventions` note |
| Kotlin idioms, Spring, JPA/Hibernate, build | `Kotlin and Spring Conventions` note |
| Queries, schema, migrations | `SQL and Schema Conventions` note |
| How a review finding, an explanation, or ticket text is written | `Review and Ticket Writing` note |
| Process gates (ticket premise, rebasing, commit messages), precedence, shell, workflow, git safety, memory, output | `CLAUDE.md` |
| A fact true only of this repo | that project's memory |

If no existing section fits, say so and propose a new one rather than forcing a half-match.

## Step 3: One verdict per lesson

- **already-covered**: quote the existing line verbatim and name its file. Say this plainly and often.
- **strengthen**: give the current line, the replacement, and what the evidence adds.
- **add**: give the exact line, file and section.
- **add-to-memory**: give the file name, `description`, `metadata.type`, body and `MEMORY.md` pointer line. If an existing memory covers the topic, propose editing it instead.
- **conflict**: the lesson contradicts a rule or a recorded decision, including one in project memory. Show both sides and ask; never resolve it yourself.
- **no-action**: say why (too situational, already enforced by tooling, or a one-off).

## Step 4: Report

Lead with a table of lesson, verdict and target. Then give details in the order a person would act on them: paste-ready text for each proposal, with the occurrence count and 2-3 PR numbers as evidence. Ask which to apply. Apply only approved items, one target at a time, and re-read each file right before editing it.

## Quality bars

- A `CLAUDE.md` line costs every session in every project; a note line costs only the sessions that trigger that note. If a rule fits both, put it in the note. Prefer strengthening an existing line to adding a neighbour, and one precise sentence to three hedged ones.
- Never propose a global rule that only one repo needs; route it to memory.
- Match the target file's voice: terse, imperative, second person, reason inline.
- Quote before claiming "already covered" or "conflicts".
- Don't propose what a formatter, compiler or CI already enforces.
- Evidence strength is not rule-worthiness. 100 occurrences may be a linter's job, and 5 may be a data-corruption class. Say which is which.

## Safety

- Editing `CLAUDE.md`, a vault note or a memory file needs explicit approval in the message that asks for it. Once approved memory content is written, commit it per *Memory Repos*.
- Never edit, stage or commit the `.claude` repo's tracked files as a side effect.
- Apply approved vault edits with the Edit tool only. Never stage, commit or push the vault.
