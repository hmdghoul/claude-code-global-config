---
name: rebase-staging
description: Rebase the current Git branch onto the latest remote staging branch and safely force-push it.
disable-model-invocation: true
---

Rebase the current branch onto the latest `origin/staging` and force-push it with `--force-with-lease`. Invoking this skill approves the whole flow; do not pause to confirm steps. If a step fails in a way not covered here, stop and report. Do not improvise.

1. `git branch --show-current`. If it is empty (detached HEAD) or `staging`, `main` or `master`, stop and tell the user.
2. `git status --porcelain`. If there is any output, stop and ask the user to commit or stash. Never auto-stash.
3. `git fetch origin staging`
4. `git pull --ff-only origin "$(git branch --show-current)"` brings in remote-only commits so the later push isn't rejected as `stale info`. Name the branch: a bare `git pull` uses the upstream, which may be `staging`, and `origin HEAD` resolves on the remote. A never-pushed branch errors harmlessly, so continue. If it can't fast-forward (diverged), stop and report without forcing anything.
5. `git rebase origin/staging`. Resolve conflicts yourself rather than reporting them. For each file, read both sides, work out the intent of each change, and edit to a correct result that keeps both. Then `git add` it and `git rebase --continue`, and repeat. Use `git rebase --abort` only as a last resort, when a conflict can't be resolved safely, then report what blocked it.
6. `git push --force-with-lease origin HEAD`. The target is explicit because a bare push goes to the upstream, which may be `staging`. The lease still refuses if the remote moved.
