---
name: blocker-review
description: Two independent subagents review pinned PRs, branches, or staged changes (in any local repo) for demonstrable release blockers; every finding is deduplicated and verified. Read-only. Use for "/blocker-review 2082", "/blocker-review staged", or "two independent reviews of this PR".
---

# blocker-review

## Arguments

`/blocker-review [<target>...] [base=<branch>] [paths=<glob>,...]`

- **Target:** `<ref>[@<repo-dir>]`, where ref is a PR number, `staged`, or a branch name. The repo defaults to the current one. With no target, the current branch is reviewed. Several targets are reviewed together, including the contracts between them.
- **Base:** `base=` when passed, else the PR's own base, else `staging`, else the repo's default branch. `staged` always compares against HEAD.
- **`paths=`** limits which changed files are reviewed (`!` excludes). Agents may read beyond it to trace callers and entry points.
- Review exactly what the arguments name. Never widen or narrow it.

## Rules

- **Read-only.** The only writes allowed are `git fetch` and `git write-tree` to snapshot staged changes. `write-tree` reads the index and never modifies it. No edits, staging, checkout, commits, or `gh`/PR writes. Resolve PRs with read-only `gh pr view`.
- **Pin before dispatch.** Resolve both sides of every comparison to an immutable SHA once: merge-base and head for a PR or branch, HEAD and the snapshot tree for staged. Every read, by the agents and during verification, goes through git objects at those SHAs, never the working tree.
- Drop any target whose diff is empty and say so. Stop if none remain.
- **Isolation.** Agents get the code and the brief below only: no notes, memory, hypotheses, conversation context, or each other's output.
- **Never assume** production conditions or deployment order. A finding that depends on one is unresolved, not confirmed.

## Dispatch

Send both agents in one message so they run concurrently. Each gets the brief with its own lens.

- **A:** from each changed hunk outward to callers, consumers and side effects, across all targets.
- **B:** from every entry point that reaches the changed code (handlers, consumers, jobs, startup, migrations) inward to the diff.

```
Review these pinned targets: <per target: repo, kind, base SHA, head SHA, scope>.
Read code only through git objects at those SHAs (git show, git grep, git ls-tree); the working tree
is not the reviewed revision. Read-only. Follow the repository's own conventions.

<lens>

Report only demonstrable release blockers introduced by these changes: security holes, data corruption,
broken existing contracts (including between targets), unsafe migrations, concurrency defects, or
failures in previously working flows. No pre-existing issues, speculation, style, or optional
improvements. Zero findings is valid.

Per finding: location, preconditions (each verified or unknown), failure scenario, impact,
evidence (the traced call path), smallest safe fix. Then list what you could not check.
```

## Verify

1. Deduplicate findings by root cause.
2. Verify every finding yourself at the pinned SHAs. Two agents agreeing is not verification.
3. Classify each finding:
   - **Confirmed:** holds in code, with every precondition verified.
   - **Unresolved:** holds in code but depends on an unverified condition.
   - **Refuted:** the code contradicts it.
4. Rank confirmed findings by impact.

## Output

```
## Blocker review: <each target: head short-SHA vs base short-SHA>; scope: <paths or full diff>

### Confirmed
1. <title> [A|B|both] - <location>
   Failure: ...  Preconditions: ...  Impact: ...  Evidence: ...  Fix: ...

### Unresolved
- <title> - <location> - needs <evidence>

### Refuted
- <title> - <why>

### Gaps
<what neither agent nor verification could check; dropped targets>
```

When nothing is confirmed, write "No confirmed release blockers" under Confirmed.
