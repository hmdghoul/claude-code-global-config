---
name: investigate-ticket
description: Investigate the Jira bug ticket linked to the current branch (or a ticket key you pass) WITHOUT implementing. Fetch the ticket, trace the full real code flow, verify the reported problem against the current implementation without assuming the root cause, then present a scope-limited fix plan with affected files and risks. Read-only, no tests, no unrelated refactoring — built to run in plan mode. Use for "/investigate-ticket STR-539", "investigate the ticket on this branch", "find the root cause before we fix it".
---

# investigate-ticket

Verify a Jira bug ticket against the real code, find the actual issue, and present a scoped fix plan for approval. This skill is built for plan mode.

## Contract

- **Do not implement.** Make no edits and no tests, even outside plan mode.
- **Assume no root cause**, whether it comes from the ticket, the branch name, or what looks obvious. Confirm or refute each hypothesis in code. If the cause stays inconclusive, rank the candidates and name the evidence that would decide between them.
- **Cite `file:line` for every behavioral claim.** The ticket gives intent and symptoms, and the code gives reality. Say where they diverge.
- **Read in a targeted way.** Read the checked-out files with the Read tool; a `git diff` dump garbles UTF-16 files on Windows. Read small files whole. For large files, Grep for the line, then read that region with `offset`/`limit`. Use Grep to map call sites, but read only the ones on the ticket's path.
- **Stay in scope.** Put unrelated smells in one "Out of scope" line at most.
- **Propose no tests,** but read the existing tests on the path. They encode the intended contract and often the exact scenario.

## Arguments

`/investigate-ticket [TICKET-KEY] [base=<branch>] [hints...]`. The key overrides the branch's key. `base` overrides the default `staging` → `main` → `master`. Hints can be a suspected area, repro notes, or pasted ticket text. Pasted text is a fallback when Jira is unreachable, and it still gets verified against the code.

## Step 1: Fetch the ticket

1. Take the key from the argument, otherwise the first match of `(^|/)[A-Z][A-Z0-9]+-[0-9]+` in `git branch --show-current`. If there is none, use AskUserQuestion to ask for the key or the pasted ticket text. Never proceed without the ticket.
2. `cloudId`: reuse it if known, pass the site host if known, otherwise call `mcp__atlassian__getAccessibleAtlassianResources` once. Call `mcp__atlassian__getJiraIssue` with `responseContentFormat: "markdown"` and `fields`: `summary`, `description`, `comment`, `status`, `issuetype`, `attachment`, `issuelinks`.
3. Read the comments, which often hold the real repro or a scope correction. Follow only `is-caused-by`, duplicate, and remote PR/commit/doc links (`mcp__atlassian__getJiraIssueRemoteIssueLinks`). Ignore "relates to" links. Still verify any stated cause.
4. Restate the symptom, repro conditions, any named error or validation, the acceptance criteria, and any cause the reporter asserts (to be verified).
5. Mine attachments and pasted traces. Fetch text attachments with `mcp__atlassian__fetch` or `WebFetch`. A stack trace's top application frame is your entry point; map each frame to `file:line`. Treat a screenshot's values as expected-vs-actual data. If an attachment can't be retrieved, say so and don't infer its contents.
6. If Jira is unreachable and no text was pasted, stop.

## Step 2: Locate

- If the branch is detached or is a base branch, investigate the checked-out code and skip the diff.
- Otherwise detect the base from `git branch -r` (or use `base=`) and run `git fetch origin <base>` on a best-effort basis. Run `git diff --stat <base>...HEAD` only to see what the branch touches. An empty result is normal for a fresh ticket branch. A missing ref never aborts the investigation; fall back to the local ref and say so. Never infer the cause from the branch name or changed files.
- Grep the exact error string, validation, field, enum or keyword to find the entry point, then read only the top hits. Never guess filenames.
- Identify the actors on the path: controller → service → repository/entity → migration → Kafka event, cron job or cross-service call. Check any Unleash flag's actual default or rollout in the affected environment, since a flag gated off is a common root cause. Follow only the branch the trigger takes.

## Step 3: Trace

- Build the call chain from trigger to symptom with `file:line` at each hop. Pin the exact divergence: a condition, comparison, mapping, null, transaction boundary, ordering or state.
- **Date the defect** with `git blame -L <a>,<b> -- <file>`, `git log -L <a>,<b>:<file>` and `git log -S"<token>" -- <path>`. Read the introducing commit's message and diff, and carry its intent into Risks so the fix doesn't undo it. Classify the defect as a **regression** (name the commit) or **latent**.
- Check the boundaries the ticket implies, such as units on each side of a comparison, where a value is set versus read, and partial or return paths. Use the real data model.
- Fan out with Agent or Workflow only for 3+ subsystems or 2+ independent hypotheses. Each reader gets the symptom and one subsystem or hypothesis, and returns candidate `file:line` evidence read-only. Do the final verifying read yourself. Never restate a line you haven't seen.

## Step 4: Verify the ticket against the code

- Compare point by point what the ticket says with what the code does. Don't claim reproduction when it needs runtime data.
- **Ref gap:** HEAD may differ from the environment where the symptom was reported. Say so rather than declaring a phantom fix or a false "can't reproduce".
- Mark the reporter's asserted cause **confirmed**, **refuted** or **partially** confirmed. A refutation is a key finding.
- If the premise is wrong (already handled, a different service, or the repro can't occur), make that the conclusion. Don't invent a fix.

## Step 5: Root cause

State it in 1-2 sentences at its `file:line`. If it is inconclusive, rank the candidates with evidence for and against, and name the one check that would decide.

## Step 6: Fix plan

```
## <TICKET-KEY> — <short title>

**Confidence:** confirmed | best-candidate  ·  **Reproduces:** statically from code | needs runtime check (<exact value/log/query>)  ·  **Regression:** introduced in <shortSHA> "<subject>" | pre-existing
**Effort:** S | M | L (~N files)

**Reported problem:** <1–2 lines, from the ticket>

**Ticket vs. implementation:** <what the code actually does; reporter's asserted cause confirmed/refuted>

**Flow traced:** <trigger → … → symptom, with file:line at each hop>

**Root cause:** <the verified cause at file:line — or ranked candidates + the check that disambiguates>

**Fix plan (scoped to the ticket):**
- `path/to/File.kt:NN` — <the minimal change and why it resolves the root cause>
- `path/to/Other.kt:NN` — <…only files that must change for this ticket>

**Risks:** <regressions, edge cases, partial-return/legacy paths, flag interactions, migration/data concerns>

**Out of scope:** <one line max — unrelated issues noticed but deliberately not touched; omit if none>

**Not included:** no tests, no refactoring beyond the fix.
```

**Regression** comes from Step 3 and **Reproduces** from Step 4. Drop **Effort** if you can't estimate it honestly. Present the plan via ExitPlanMode and don't start editing. Afterwards, state the ticket source (Jira key or pasted) and the branch investigated, and surface only the remaining ambiguity or runtime checks.
