---
name: split-task
description: Split one Jira task into the fewest independently shippable subtasks (max 3), each drafted as a self-contained, AI-agent-ready ticket with outcome, implementation steps, file locations, acceptance criteria, dependencies and delivery order. Accepts an epic plus a target task (reviews the epic and its siblings first for scope, dependencies, settled decisions and duplication) or a target task alone. Plan-mode: analyzes read-only, then writes each ticket as a Markdown file under the project's feature-docs/ after approval, then reviews those drafts in rounds until they settle - never writes to Jira and never touches source. Use for "/split-task STR-758", "/split-task epic=STR-652 STR-660", "split this ticket into shippable pieces", or "review the split documents again".
---

# split-task

Turn one oversized task into **the fewest independently shippable tickets**, each ready to hand to an AI agent or a developer with no other context. Built for **plan mode**: read, analyze, draft, then - after approval - write one Markdown ticket file per subtask into the project's `feature-docs/`, then review those files in rounds until they settle. No source edits, no Jira writes.

## Goal

Produce the smallest set of tickets that each ship on their own, and make every one of them survive being handed to someone who has nothing else.

The measure is not that the task got split. It is that an implementer given **one** of these files and the repository can start, finish and prove the work without opening the parent ticket, guessing a file location, or discovering halfway through that a constraint they needed lives in a sibling ticket they were never given.

Two failure modes the whole procedure exists to prevent:

- **A dropped requirement** - the split loses something the original carried. Steps 4 and 6 are the guard: inventory every requirement, then prove coverage in a table.
- **A leaking seam** - the split *itself* creates the defect. A constraint stated in the ticket that cannot act on it; two tickets editing the same file with neither saying so; an acceptance criterion that contradicts its own implementation steps. Nothing in the source ticket is wrong; the division introduced the bug. Step 10 is the guard.

The second failure mode is the one that goes unnoticed, because every individual ticket reads fine on its own.

## Non-negotiable contract

- **Never write to Jira.** No create, comment, transition, link or assign. The tickets are delivered as Markdown files under the project's `feature-docs/` for the user to paste. Reading - fetching an issue, searching, following links - is fine.
- **Do not implement.** No source edits, no tests, no refactoring. The only files this skill writes are the `feature-docs/` ticket Markdown, and only after the plan is approved.
- **Preserve every original requirement.** Inventory them first, then prove coverage with a traceability table. A requirement that lands in no subtask is a bug in the split, not a scope decision.
- **Do not invent missing details.** No fabricated endpoints, field names, table names, thresholds or acceptance numbers. Anything the source does not state and the code does not show goes under "Open questions", named as unknown.
- **Maximum three subtasks. Fewer is better.** Two good tickets beat three thin ones. One is a valid answer.
- **No split when a split adds nothing.** Say so plainly, output the single tightened ticket, and give the reason.
- **File locations only when verified.** A `path/File.kt:NN` in a ticket must come from a real read or grep of the checked-out code. When the code was not consulted or the area lives in another repo, write the step behaviourally and mark the location unconfirmed.
- **Leave pipeline noise out of ticket text.** No codegen steps, formatter passes, lockfile refreshes, regenerated docs or diagrams, CI reruns or PR checklists. A schema/contract version bump, a per-environment config key and a migration that must be run do stay - a person decides those.

## Arguments

Invoked as `/split-task [EPIC-KEY] <TARGET-KEY> [hints...]`, or with `epic=<EPIC-KEY>`.

- `TARGET-KEY` - the task to split.
- `EPIC-KEY` / `epic=<KEY>` - optional parent epic. Present means **mode A**; absent means **mode B**.
- Free text - a pasted ticket body (Jira unreachable), a constraint ("must ship behind a flag"), or a preferred seam.

Two bare keys without `epic=` means the first is the epic and the second the target.

**Called with no arguments, prompt - do not guess.** Ask with AskUserQuestion which input mode applies:

- **Epic + task** (mode A) - then ask for both keys.
- **Task only** (mode B) - then ask for the one key.

Offer the branch's key as the suggested value when the current branch name carries one (`git branch --show-current`, regex `(^|/)[A-Z][A-Z0-9]+-[0-9]+`), naming it in the option so the user can confirm or override it - a branch key is a suggestion, never a silent default. If Jira is unavailable, the same prompt accepts pasted ticket text instead of a key. Never split a task the user did not name.

## Step 1 - Fetch the target

Use the available Jira/Atlassian read tools to fetch the requested issues. If no Jira integration is available, use pasted ticket content; otherwise stop and request it. Tool names differ between environments - discover what is present rather than assuming a specific one, and satisfy whatever the tool requires (a site/cloud identifier resolved once and reused, a markdown response format, an explicit field list).

Get at least: `summary`, `description`, `comment`, `status`, `issuetype`, `parent`, `attachment`, `issuelinks`. Read the **comments** - they routinely carry the scope cut, the decision that overrides the description, or the requirement nobody put in the body. Follow `blocks` / `is-blocked-by` and `duplicates` links.

## Step 2 (mode A only) - Review the epic and its siblings

Skip entirely in mode B; never invent a parent.

1. Fetch the epic itself (same fields) - its description holds the outcome the target must serve.
2. List its children with the available issue-search tool: `parent = <EPIC-KEY> ORDER BY created ASC`, falling back to `"Epic Link" = <EPIC-KEY>` on older projects; fields `summary`, `status`, `issuetype`, `issuelinks`. Read the description of any sibling whose summary overlaps the target's area; skim the rest.
3. Write down four things and carry them into the split:
   - **Wider scope** - what the epic is actually delivering, so a subtask is not scoped past it.
   - **Dependencies** - siblings that must land before or after, in either direction.
   - **Settled decisions** - anything already chosen in an epic or sibling comment (a flag name, a table, a rejected approach). These are constraints, not options to reopen.
   - **Duplication** - work a sibling already covers or already delivered. Never draft a subtask that redoes it; note the overlap and shrink the target instead.

## Step 3 - Ground the task in code

Targeted, not exhaustive. Grep the endpoint, entity, enum, config key, error string or feature word the task names; read only the top hits plus enough context to see the seam. Follow the path far enough to answer: where the change enters, what it touches (controller / service / repository / entity / migration / event / job / flag), and what already exists. Map the seams a split could cut along - a migration, a flag, a new endpoint, a consumer, a read path against a write path. Start with targeted searches, then inspect additional files only when needed to verify the execution path, dependencies, configuration, or proposed split. Never guess a filename.

## Step 4 - Inventory the requirements

Number every requirement the source states, `R1..Rn`: explicit asks, acceptance criteria, constraints from comments, and anything in the epic that binds the target. Keep each atomic - a requirement whose delivery has to be split across two subtasks was two requirements, while a constraint that holds whole for several subtasks stays one. This list is the contract for Step 6.

## Step 5 - Decide the split

A candidate subtask ships independently only if **all** of these hold:

- It can be merged and deployed safely on its own when its declared dependencies have shipped.
- It leaves the system coherent - either delivering user-visible value, or a complete dormant layer that is safely no-op (behind a flag, unreferenced, or additive schema).
- Its acceptance criteria can be verified without a sibling being done.
- It owns its files and its decisions; two subtasks do not edit the same logic in conflicting ways.

Cut along **outcome seams**, not layers. Good seams: a migration plus its entity, shipping before the feature reads it; a new endpoint separate from the consumer that calls it; a flagged path separate from making it the default; one entity or flow when the task covers several. Never "write the code" / "write the tests", never backend / frontend halves of one indivisible behaviour, never "implement" / "review".

**Do not split** when the task is a single coherent change; when the pieces are only sequential steps of one merge; when the split leaves a half-migrated schema or dead code with no flag; when coordination costs more than the split delivers; or when filling a third ticket would need invented scope. Then say so and output the single ticket, tightened.

## Step 6 - Prove coverage

Build the traceability table before writing any ticket; it goes in the output.

| Req | From | Subtask(s) |
|---|---|---|
| R1 | description | 1 |
| R2 | comment 2026-09-01 | 2 |
| R3 | epic (backward compatibility) | 1, 2 |

Every requirement must map to at least one subtask. Avoid duplication unless a cross-cutting constraint - such as backward compatibility or observability - legitimately applies to multiple subtasks. An unmapped `R` is a missing subtask or a dropped requirement, and dropping is not yours to decide - surface it.

## Step 7 - Draft the tickets

One ticket per subtask, in delivery order. **Self-contained**: an agent given only that one ticket and the repo must be able to start. Repeat the context it needs instead of pointing at the parent; reference other tickets only as dependency keys. Concrete verbs - no "handle", "support" or "improve" without an object and a condition.

Each ticket becomes its own Markdown file in the current project's `feature-docs/` folder (Step 9 writes them, after approval). Body:

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
- <anything unknown - never guessed>
```

## Step 8 - Present

Output in this order, then call ExitPlanMode with it as the plan:

1. **Verdict** - `Split into N` or `Keep as one ticket`, one sentence of why, and the seam used.
2. **Epic context** (mode A only) - wider scope, dependencies, settled decisions, duplication found. 4 lines max.
3. **Delivery order** - `1 -> 2 -> 3`, with what forces the order, or "independent, any order".
4. **Traceability table** from Step 6.
5. **The ticket drafts** from Step 7.
6. **Open questions** - consolidated, if any. Nothing invented to close one.
7. **Files to be written** - the `feature-docs/` paths from Step 9.

## Step 9 - Write the ticket files

After the plan is approved (plan mode forbids writing before that), write each ticket from Step 7 as its own Markdown file under `feature-docs/` at the repo root (`git rev-parse --show-toplevel`). Create the folder if it does not exist.

- One file per subtask: `feature-docs/<TARGET-KEY>-split-<n>-<kebab-slug>.md`, `<n>` being the delivery order.
- No split: one file, `feature-docs/<TARGET-KEY>-ticket-<kebab-slug>.md`.
- File content is the ticket body from Step 7 - the whole body, paste-ready, with an `# <KEY> - <Summary>` heading on top. Do not wrap it in a code fence, and do not add cross-file navigation beyond the dependency keys the ticket already carries.
- Never overwrite an existing file silently: if the path exists, say so and ask before replacing it.
- Leave the files untracked. Do not `git add`, stage, or commit them.

Then list the written paths, and close with one line reminding the user they paste these into Jira themselves. Do not offer to create the Jira issues.

## Step 10 - Review the drafts in rounds, until they settle

**Writing the files is not the end.** Expect the first drafts to carry real defects, and expect several rounds to be needed - each one finding things the last did not. Offer a review after writing, and run another whenever asked.

Each round is the same loop: **re-read the files from disk**, verify what you carried rather than checked, report the findings, apply on approval. Re-read from disk every time - reviewing from memory of what you wrote is how a defect survives three passes.

Report findings in the shape the user's rules require for review output: one plain sentence of effect, what the document says now, what it should say, why it matters, the suggested change. Most severe first. Say plainly when something is **not** a problem and why - that is as useful as a finding. Then ask before applying; do not edit on your own initiative.

### What each round should hunt

Rounds have different highest-yield targets. Do not repeat round 1's sweep three times.

1. **Cross-ticket coherence.** The defects the split created. A constraint written into the ticket whose implementer never opens that file, while the ticket that *does* edit it says nothing. Two tickets touching the same file with neither flagging it. A "Blocks:" line claiming a dependency that does not exist. An acceptance criterion sitting in the wrong ticket to be checkable.
2. **The fixes you just applied.** A fix routinely breaks its own ticket's coherence: an added implementation step that the Scope section does not list, or that contradicts an acceptance criterion saying the commit contains "nothing else". After every edit re-read the **whole** ticket - Scope, Implementation, How to prove it, Acceptance criteria, Risks - not just the paragraph you changed.
3. **The code you never opened.** Consistently the highest-yield round. Go read the validator behind the annotation you cited, the config file above the line you quoted, the helper whose behaviour you asserted, the workflow you claimed defaults to something. Claims that were carried from the source ticket rather than verified are where the factual errors live.

Keep going while a pass over previously-unexamined material is still finding things. Stop when a full round turns up nothing new, and say so rather than manufacturing a finding.

### Standing checks, every round

- **Verify or label.** Every `file:line`, count and version in a ticket is either verified this session or explicitly flagged as carried from the source. Never let a carried claim read as a checked one.
- **Read project memory before writing guidance about a subsystem.** A memory file that already records how something works will contradict a draft written without it - a defect that was avoidable, not merely missed.
- **Encoding.** Pure ASCII, no BOM, no code-fence wrapper around the body. Check after every editing round, including your own edits - it is easy to introduce a stray glyph in a warning line.
- **Index untouched.** Never stage, unstage or commit the ticket files. If the user's tooling auto-stages them, say so and give them the command; do not run it.

## Usage

**Mode A - epic plus target** (reviews the epic and its siblings first):

```
/split-task epic=STR-652 STR-660
/split-task STR-652 STR-660
/split-task epic=STR-758 STR-787 must stay behind a flag
```

**Mode B - target only** (analyzed standalone):

```
/split-task STR-539
/split-task STR-448 the idle-tracking write path is already merged
```

**No arguments** - prompts for the mode, then the key(s), suggesting the branch's key if it has one:

```
/split-task
```

**Reviewing drafts that already exist** (step 10) - no key needed; the drafts are the input:

```
review the split documents again
review the updated documents
```

Each such request is one more round. Run it against the files on disk, not against the drafts as you remember writing them, and pick the round's focus from "What each round should hunt" rather than repeating the previous sweep.
