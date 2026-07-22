---
name: investigate-ticket
description: Investigate the Jira bug ticket linked to the current branch (or a ticket key you pass) WITHOUT implementing. Fetch the ticket, trace the full real code flow, verify the reported problem against the current implementation without assuming the root cause, then present a scope-limited fix plan with affected files and risks. Read-only, no tests, no unrelated refactoring — built to run in plan mode. Use for "/investigate-ticket STR-539", "investigate the ticket on this branch", "find the root cause before we fix it".
---

# investigate-ticket

Investigate a Jira bug ticket end to end and produce a **focused fix plan** — do not implement. This skill is meant to run in **plan mode**: the whole point is to verify the ticket against the real code, find the *actual* issue, and hand back a scoped plan for approval. No file edits, no tests, no drive-by refactoring.

## Non-negotiable investigation contract

- **Do not implement.** Read and analyze only. The deliverable is a diagnosis + fix plan, not a change. (In plan mode this is enforced; respect it even if invoked outside plan mode.)
- **Do not assume the root cause.** Not the ticket's stated cause, not the branch name, not the "obvious" one. Confirm or refute every hypothesis by reading the real code path. If the cause can't be pinned down conclusively, say so and present the ranked candidates plus exactly what evidence would disambiguate them.
- **Ground every claim in code.** Each statement about behavior must trace to a specific `file:line`. The ticket states *intent and symptoms*; the code states *reality*. Where they diverge, say so plainly.
- **Read what the flow touches — targeted, not exhaustive.** Read the checked-out files (not a diff). Small file: read it whole. Large file: Grep the symbol for the relevant method/branch's line, then Read that region with `offset`/`limit` plus enough surrounding context — don't page through thousands of unrelated lines. Follow the flow through the callers, callees, interfaces, migrations, config, enums, and Unleash flags the path actually touches. Grep symbols to **map** call sites, then read only the ones on the ticket's path — don't read every call site of a ubiquitous helper.
- **Windows/UTF-16 gotcha:** read source with the Read tool directly, not by parsing a `git diff` dump (which renders as spaced-out characters).
- **Stay in ticket scope.** Only the code paths the ticket is about. Note unrelated smells in one line at most under "Out of scope" — never fold them into the plan.
- **No new tests, but read the existing ones.** Do not propose adding or modifying tests as part of the plan. Do read the existing unit/integration tests covering the path — they encode the intended contract and often the exact reported scenario, and are frequently the fastest confirmation of the expected-vs-actual divergence (read-only).

## Arguments

Invoked as `/investigate-ticket [TICKET-KEY] [extra context...]`. All optional:
- `TICKET-KEY` — e.g. `STR-539`. Overrides the key derived from the branch. This is the ticket you're passing in.
- `base=<branch>` — override the detected base branch for the branch-diff overview (default: `staging` → `main` → `master`).
- Anything else on the line — free-text hints (a suspected area, a repro note, a paste of the ticket if Jira is unreachable). Treat pasted text as a fallback only, and still verify it against code.

## Step 1 — Resolve and fetch the ticket

1. Determine the ticket key, in order: explicit `TICKET-KEY` argument → the first `<PROJECT>-<NUMBER>` in the current branch name (`git branch --show-current`; regex `(^|/)[A-Z][A-Z0-9]+-[0-9]+`, so it matches a bare leading key or one behind a prefix, e.g. `STR-539-Returning-order-...`, `feature/STR-539-...`, `bugfix/STR-539` → `STR-539`).
2. If no key resolves, ask the user for it with AskUserQuestion (one option to supply the key, one to paste the ticket text). Do not silently proceed without the ticket.
3. Fetch from Jira via the Atlassian MCP:
   - **Resolve `cloudId` first** (required arg of every Jira call): reuse it if known; if you know the site host (e.g. `yoursite.atlassian.net`) pass that directly as `cloudId`; otherwise call `mcp__atlassian__getAccessibleAtlassianResources` once and reuse the result.
   - `mcp__atlassian__getJiraIssue` with that `cloudId`, `issueIdOrKey` = the key, `responseContentFormat: "markdown"`, and explicit `fields`: `summary`, `description`, `comment`, `status`, `issuetype`, `attachment`, `issuelinks` (there is no `linked-issue` field — issue links come back under `issuelinks`).
   - **Comments matter** — they frequently carry the real repro steps, scope narrowing, or a correction to the original description. Read them.
   - **Follow causal/duplicate/remote links only.** For `is-caused-by`, `duplicates`/`is-duplicated-by`, and remote PR/commit/doc links (via `mcp__atlassian__getJiraIssueRemoteIssueLinks` with the same `cloudId` + `issueIdOrKey`), fetch and read them: a caused-by link often names the introducing change and a duplicate may already hold the diagnosis. Ignore unrelated "relates to" noise; still verify any stated cause against the checked-out code.
4. Extract and restate: the reported symptom, the repro/trigger conditions, any error message or failing validation named, acceptance criteria, and any cause the reporter *asserts* (to be verified, not trusted).
5. **Mine attachments and pasted traces for the real repro.** Scan the description + comments for pasted stack traces, and fetch text attachments (e.g. `mcp__atlassian__fetch`, or `WebFetch` on the content URL). A stack trace's top application frame is your entry point — start there and map each frame to `file:line` instead of grepping blind. A screenshot's concrete values (a wrong quantity, status, error) are the expected-vs-actual data to check against the code; if an image can't be viewed, use the reporter's described values. If an attachment can't be retrieved, say so — don't infer its contents.
6. If Jira is unreachable and no ticket text was pasted, stop and tell the user — do not diagnose against a guessed problem statement.

## Step 2 — Locate the code under investigation

- Current branch: `git branch --show-current`. If empty (detached) or itself a base branch (`staging`/`main`/`master`), there is no feature-branch diff — investigate the ticket against the checked-out code and skip the branch-diff overview below.
- Detect the base from the remote (`git branch -r`): prefer `staging`, else `main`, else `master`; honor an explicit `base=` argument. `git fetch origin <base>` best-effort — if offline or the ref is missing, use the local ref / plain `git diff --stat` and note it; never let a missing remote-tracking ref abort the investigation.
- `git diff --stat <base>...HEAD` only to see what the branch already touches. **Expect this to be empty** — the branch is usually cut fresh for the ticket and still matches `<base>`; that's normal, not an error. When empty, there is no prior work to read: investigate the checked-out base code (= staging/main) directly. When non-empty, still don't infer the fix or root cause from the branch name or changed files — the investigation targets the *live behavior of the checked-out code*, not just the diff.
- **Locate before you open.** From the ticket's symptom (or a stack-trace frame, if one was attached), find the entry point(s): the endpoint/handler/job/validation named or implied. Grep the exact error string, validation name, field, enum, or feature keyword to get ranked `file:line` candidates, then targeted-read only the top hits — don't open a file before a search points at it, and never guess at filenames.
- Identify the actors on the ticket's path: controller/resource → service → repository/entity → migration/schema → any Kafka event, cron, or cross-service call, and any Unleash flag gating the behavior — for a flag, check its actual default/rollout state in the affected environment, since a behavior gated off is itself a common root cause. Follow only the branch the ticket's trigger conditions take; note but don't chase unrelated call sites.

## Step 3 — Trace the full flow

- Walk the path from trigger to symptom in order, reading each hop's relevant region (the whole file only when small). Build an explicit call chain with `file:line` at each step.
- Pin down the exact point where behavior diverges from what the ticket expects: the specific condition, comparison, mapping, null, transaction boundary, ordering, or state that produces the reported symptom.
- **Date the defect.** Once the divergence is pinned to a `file:line`, find when it got that way — often the fastest path to the real cause. `git blame -L <a>,<b> -- <file>` (commit that last set the line); `git log -L <a>,<b>:<file>` (history of just that range); `git log -S"<token>" -- <path>` (pickaxe for a moved constant/threshold/flag/branch). Read the introducing commit's message + diff — it usually reveals the original intent, so the fix doesn't silently reintroduce what that commit was solving; carry that into Risks. Classify as **regression** (name the commit) or **latent** (never worked). All read-only, identical in PowerShell and bash.
- Check the boundaries the ticket implies (e.g. a quantity/validation bug → the exact comparison, the units on each side, where the value is set vs. read, returning/partial-return paths). Confirm inputs and state with the real data model, not assumptions.
- **Fan out only when it pays; split search from verification.** Use parallel Agent/Workflow readers only when the flow genuinely spans 3+ subsystems/services or you're holding 2+ independent root-cause hypotheses — for a single-service bug, trace it yourself. Give each a tight brief: the ticket symptom, its one assigned subsystem/hypothesis, and "return candidate `file:line` evidence only — read-only, no edits, no fix." They localize in parallel; then YOU do the final verifying read on the narrowed set. Don't restate a claim whose line you haven't seen.

## Step 4 — Verify ticket vs. implementation

- State, point by point: what the ticket says happens vs. what the code actually does. Determine whether the reported symptom can be explained by the current code. Do not claim reproduction or confirmation when runtime data is required through the traced flow.
- **Mind the ref gap.** The checked-out branch HEAD may not match where the symptom was reported (prod/staging); unmerged changes on this branch can already alter or fix the traced path. If the traced code may differ from the reported environment, say so — don't declare a phantom fix or a false "can't reproduce."
- Explicitly test the reporter's asserted cause (if any) against the code: **confirmed / refuted / partially**. If refuted, that's a key finding — say what the code actually does instead.
- If the premise of the ticket is itself wrong (the code already handles the case, the bug is in another service, the repro can't occur), surface that as the conclusion rather than inventing a fix.

## Step 5 — Identify the actual issue

- Name the root cause in one or two sentences, anchored to the exact `file:line` where it lives.
- If not conclusively determined, present the ranked candidate causes, each with its supporting/contradicting evidence, and state the one check (a log, a value, a query result, a repro) that would confirm which is real.

## Step 6 — Present the fix plan

Output a concise, structured plan (this is the plan-mode deliverable). Keep it tight and code-grounded:

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

Fill the status row from the investigation — **Regression** comes from the "Date the defect" step, **Reproduces** from the Step 4 anti-false-repro rule; drop the **Effort** line if you can't estimate it honestly. Then present this as the plan for approval (ExitPlanMode) — do not start editing.

## Finish

State the ticket source (Jira `<TICKET-KEY>` or pasted) and the branch investigated. Confidence and reproducibility live in the plan block above — don't restate them; only surface any remaining ambiguity or a detail that needs a runtime check.
