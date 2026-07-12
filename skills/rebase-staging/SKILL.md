---
name: rebase-staging
description: Rebase the current Git branch onto the latest remote staging branch and safely force-push it.
disable-model-invocation: true
---

Rebase the current branch onto the latest remote `staging`, then force-push it
safely with `--force-with-lease`. Invoking this skill is the user's approval to
run the whole flow — fetch, pull the current branch, rebase, and force-push — without pausing to confirm.
If a step fails in a way it does not tell you how to handle, stop and report it; do not improvise.

1. Determine the current branch:

   ```bash
   git branch --show-current
   ```

   If the output is empty (detached HEAD) or is `staging`, `main`, or `master`,
   stop and tell the user — do not rebase those branches.

2. Make sure the working tree is clean:

   ```bash
   git status --porcelain
   ```

   If there is any output (uncommitted changes), stop and ask the user to commit
   or stash first. Do not auto-stash.

3. Fetch the latest staging branch:

   ```bash
   git fetch origin staging
   ```

4. Sync the current branch with its own remote first, so any remote-only
   commits are included locally before the rebase — otherwise the later force-push is rejected with
   `stale info`:

   ```bash
   git pull --ff-only
   ```

   Use `--ff-only` so this never silently creates a merge commit. If the branch
   has no upstream yet (never pushed), this errors harmlessly — skip it and
   continue. If it fails because local and remote have genuinely diverged
   (can't fast-forward), stop and report — do not force anything.

5. Rebase the current branch onto it:

   ```bash
   git rebase origin/staging
   ```

   If the rebase stops on conflicts, resolve them — do not just report them. For each
   conflicted file: inspect both sides of the conflict, understand the intent of the
   current branch's change and of staging, and edit the file to a correct merged result
   that keeps both. Then `git add` the resolved files and run `git rebase --continue`.
   Repeat until the rebase finishes. Only abort (`git rebase --abort`) as a last resort,
   when a conflict genuinely cannot be resolved safely — then stop and report what blocked it.

6. Force-push the rebased branch safely:

   ```bash
   git push --force-with-lease
   ```
