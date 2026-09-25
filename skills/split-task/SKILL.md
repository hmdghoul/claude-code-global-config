---
name: split-task
description: >-
  Split one Jira task into the fewest independently shippable subtasks (max 3), each drafted as a self-contained, AI-agent-ready ticket with outcome, implementation steps, file locations, acceptance criteria, dependencies and delivery order. Accepts an epic plus a target task (reviews the epic and its siblings first for scope, dependencies, settled decisions and duplication) or a target task alone. Plan-mode: analyzes read-only, closes every open question with the code or by asking the user (who answers or explicitly defers), writes each ticket as a Markdown file under the project's feature-docs/ after approval, then reviews those drafts in rounds until they settle - never writes to Jira and never touches source. Use for "/split-task STR-758", "/split-task epic=STR-652 STR-660", "split this ticket into shippable pieces", or "review the split documents again".
---

# split-task

Split one oversized task into the fewest independently shippable tickets. This skill is built for plan mode: analyze and draft, write the ticket files after approval, then review them in rounds.

**Success test:** an implementer given **one** ticket file and the repo can start, finish and prove the work without the parent ticket, a guessed file location, or a constraint that only appears in a sibling ticket. The procedure guards against two failures:
- **Dropped requirement.** Steps 4 and 6 guard against it.
- **Leaking seam**, a defect the split itself creates. Examples: a constraint placed in a ticket that can't act on it; two tickets editing one file with neither saying so; an acceptance criterion that contradicts its own implementation steps. Each ticket reads fine alone. Step 11 guards against it.

## Contract

- **Never write to Jira.** Reads are fine.
- **Do not implement.** The only files you write are the `feature-docs/` tickets, after approval.
- **Preserve every requirement,** and prove it with the traceability table. An unmapped requirement is a bug in the split.
- **Invent nothing.** No endpoints, fields, tables, thresholds or numbers the source and the code don't show. An unknown becomes an open question.
- **Close every open question** from the code or by asking the user, with **defer** always offered (Step 8).
- **At most three subtasks; fewer is better.** One ticket is a valid answer. If a split adds nothing, say why and output the single tightened ticket.
- **Use `path/File.kt:NN` only when verified** by a read or grep this session. Otherwise describe the behavior and mark the location unconfirmed.
- **Keep pipeline noise out of tickets**: codegen, formatters, lockfiles, regenerated docs or diagrams, CI reruns, PR checklists. Keep human decisions: a schema or contract version bump, a per-environment config key, a migration that must be run.

## Arguments

`/split-task [EPIC-KEY] <TARGET-KEY> [hints...]` or `epic=<KEY>`. With an epic, this is **mode A**; without one, **mode B**. Two bare keys mean epic then target. Hints can be a pasted ticket body, a constraint, or a preferred seam.

**With no arguments, ask; don't guess.** Use AskUserQuestion to pick the mode (Epic + task, or Task only), then ask for the key(s). If the branch name matches `(^|/)[A-Z][A-Z0-9]+-[0-9]+`, name that key in the option as a suggestion, never as a silent default. If Jira is unavailable, accept pasted text. Never split a task the user didn't name.

## Step 1: Fetch the target

Discover which Jira read tools are available and satisfy their requirements (a cloud/site ID resolved once, markdown format, an explicit field list). If none are available, use pasted content or stop and request it. Fetch `summary`, `description`, `comment`, `status`, `issuetype`, `parent`, `attachment`, `issuelinks`. Read the comments, which often carry scope cuts and overriding decisions. Follow `blocks`/`is-blocked-by` and `duplicates` links.

## Step 2: Epic and siblings (mode A only; never invent a parent)

1. Fetch the epic with the same fields.
2. Search its children: `parent = <EPIC-KEY> ORDER BY created ASC`, falling back to `"Epic Link" = <EPIC-KEY>`, with fields `summary`, `status`, `issuetype`, `issuelinks`. Read the siblings whose area overlaps the target's; skim the rest.
3. Record four things:
   - **Wider scope:** don't scope past the epic.
   - **Dependencies** in either direction.
   - **Settled decisions:** constraints; don't reopen them.
   - **Duplication:** never redo a sibling's work; shrink the target instead.

## Step 3: Ground in code

Grep the endpoint, entity, enum, config key, error string or feature word; read the top hits and widen only as needed to verify the path. Find where the change enters, what it touches (controller, service, repository, entity, migration, event, job, flag) and what already exists. Map candidate seams: a migration, a flag, a new endpoint, a consumer, a read path versus a write path. Never guess a filename.

## Step 4: Inventory requirements

Number them `R1..Rn`: explicit asks, acceptance criteria, constraints from comments, and anything in the epic that binds the target. Keep each atomic. A requirement split across two subtasks was really two requirements. A constraint that holds whole for several subtasks stays one.

## Step 5: Decide the split

A subtask ships independently only if **all** of these hold:
- It merges and deploys safely once its declared dependencies have shipped.
- It leaves the system coherent: either user-visible value, or a complete dormant layer that is safely no-op (flagged, unreferenced, or additive schema).
- Its acceptance criteria can be verified without a sibling.
- It owns its files and decisions, with no conflicting edits to the same logic.

Cut along outcome seams, not layers. Good seams: a migration plus its entity before the feature that reads it; an endpoint before its consumer; a flagged path before making it the default; one entity or flow of several. Never split code from tests, backend from frontend of one indivisible behavior, or implement from review.

**Don't split** a single coherent change, sequential steps of one merge, anything that would leave a half-migrated schema or unflagged dead code, a split whose coordination costs more than it delivers, or a third ticket that would need invented scope.

## Step 6: Traceability table (before drafting; it goes in the output)

| Req | From | Subtask(s) |
|---|---|---|
| R1 | description | 1 |
| R2 | comment 2026-09-01 | 2 |
| R3 | epic (backward compatibility) | 1, 2 |

Every `R` maps to at least one subtask. Map to several only for real cross-cutting constraints, such as backward compatibility or observability. Surface any unmapped `R`; dropping it is not your decision.

## Step 7: Draft the tickets

Write one ticket per subtask, in delivery order. Each is self-contained: repeat the context it needs, and reference other tickets only by dependency key. Use concrete verbs; never "handle", "support" or "improve" without an object and a condition.

```
Summary: <imperative, outcome-shaped, 80 chars or less>

Outcome
<1-2 sentences: what is true after this ships, in behaviour terms.>

Context
<Only what an agent needs to start cold: current behaviour, the area, the constraint. 3-6 lines.>

Scope
In: <what this ticket changes>
Out: <what it deliberately does not touch, including the sibling subtasks>

Implementation
1. <step> - `path/to/File.kt:NN`   <verified locations only; otherwise describe the behaviour and mark the location unconfirmed>
2. <step>
3. <migration / config key / flag, each named>

Acceptance criteria
- [ ] <observable, verifiable without a sibling ticket being done>
- [ ] <error or edge path>
- [ ] <logging, flag-off behaviour, or backward compatibility, where they apply>

Dependencies
Blocked by: <KEY or none>  |  Blocks: <KEY or none>

Open questions
- <only questions the user explicitly deferred. Each names who can answer it, what it blocks, and what happens if nobody does. Never guessed, never unasked - see Step 8. Omit the whole section when none were deferred.>
```

## Step 8: Close every open question

1. **Try the repo first.** Grep, read the migration, the validator behind the annotation, the workflow default, or the published POM. Never ask the user something the code settles.
2. **Check project memory** for a recorded decision.
3. **Ask the rest in one batched AskUserQuestion round.** These are questions that need authority or access: ownership, per-environment values, acceptable baselines, intended behavior, unassigned work. **Every question offers "defer."** Each option says what the answer implies, what happens if the question stays open, and who would answer it.

Then fold the results in:
- **Answered:** put the answer where the work is (scope, step, criterion or risk). Never list it under "Open questions" as answered.
- **Deferred:** it stays, naming who can answer it, what it blocks, and what happens if nobody does. A deferred question without an owner is still unasked.
- **Never close a question by guessing.** If one doesn't matter, say why; don't delete it silently.

## Step 9: Present, then ExitPlanMode

1. **Verdict**: `Split into N` or `Keep as one ticket`, one sentence why, and the seam used.
2. **Epic context** (mode A only): scope, dependencies, settled decisions, duplication. 4 lines at most.
3. **Delivery order**: `1 -> 2 -> 3` and what forces it, or "independent, any order".
4. **Traceability table.**
5. **Ticket drafts.**
6. **Question ledger**: what the code answered, what the user answered and where each answer now lives, and what was deferred with its owner. If nothing was deferred, say so in one line.
7. **Files to be written.**

## Step 10: Write the files (after approval)

Write under `feature-docs/` at `git rev-parse --show-toplevel`, creating the folder if needed:
- Split: `feature-docs/<TARGET-KEY>-split-<n>-<kebab-slug>.md`, where `<n>` is the delivery order.
- No split: `feature-docs/<TARGET-KEY>-ticket-<kebab-slug>.md`.
- Content: `# <KEY> - <Summary>`, then the full Step 7 body. No code fence, and no cross-file navigation beyond dependency keys.
- If a path exists, ask before replacing it. Never stage or commit.

List the paths and remind the user in one line that they paste the tickets into Jira themselves. Don't offer to create issues.

## Step 11: Review in rounds until they settle

Expect the first drafts to have real defects and several rounds to be needed. Offer a review after writing, and run one whenever asked. Each round: **re-read the files from disk** (never from memory), report findings, and apply them only on approval.

Report each finding as: its effect in one plain sentence, what the document says now, what it should say, why it matters, and the suggested change. Order findings most severe first. Also say plainly what is **not** a problem, and why.

Give each round a different focus; don't repeat a previous sweep:
1. **Cross-ticket coherence:** a constraint in a ticket whose implementer never opens that file while the editing ticket is silent; two tickets touching one file unflagged; false "Blocks:" lines; an acceptance criterion in a ticket where it can't be checked.
2. **Your own fixes:** after any edit, re-read the **whole** ticket (Scope, Implementation, How to prove it, Acceptance criteria, Risks). A new step often contradicts Scope or a "nothing else" criterion.
3. **Code you never opened,** usually the highest-yield round: the validator behind a cited annotation, the config around a quoted line, a helper whose behavior you asserted, a claimed workflow default.

Continue while fresh material still yields findings. When a full round finds nothing new, say so; don't manufacture findings.

**Every round:**
- Every `file:line`, count and version is either verified this session or labeled as carried from the source.
- Read project memory before writing guidance about a subsystem.
- Pure ASCII, no BOM, no fence around the body. Re-check after every edit.
- Never stage, unstage or commit. If tooling auto-stages the files, tell the user the command to run.
- Send new unknowns through Step 8 now. Re-check that each deferred question still names an owner and what it blocks.

## Usage

```
/split-task epic=STR-652 STR-660                      # mode A
/split-task STR-652 STR-660                           # mode A
/split-task epic=STR-758 STR-787 must stay behind a flag
/split-task STR-539                                   # mode B
/split-task STR-448 the idle-tracking write path is already merged
/split-task                                           # prompts for mode and key(s)
review the split documents again                      # one more Step 11 round, from disk
```
