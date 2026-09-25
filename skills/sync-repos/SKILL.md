---
name: sync-repos
description: Sweep a parent folder of sibling Git repos — switch each to staging, fast-forward pull, and report branch, stash and uncommitted state in one table.
disable-model-invocation: true
---

Switch every Git repo directly under a parent folder to `staging`, fast-forward pull it, and report the results in one table. Invoking this skill approves checkout and pull without confirmation. It also approves the step 4 prune, but only to recover a pull blocked by a ref conflict; that deletes only remote-tracking pointers for branches the remote already deleted. The skill never commits, pushes, stashes, resets or merges. If a step fails in a way not covered here, stop and report. Do not improvise.

The argument is the parent folder (e.g. `/sync-repos C:\Users\Ahmad\source\repos\ananinja`). If it is missing, ask. Do not fall back to the working directory.

1. **Discover.** Each immediate child directory that contains `.git` is a repo. Do not recurse. If there are none, say so and stop.

2. **Survey each repo before touching it:**

   ```bash
   git -C <repo> rev-parse --abbrev-ref HEAD
   git -C <repo> diff --cached --name-only          # staged
   git -C <repo> diff --name-only                   # unstaged
   git -C <repo> ls-files --others --exclude-standard   # untracked
   git -C <repo> stash list
   git -C <repo> rev-parse --verify --quiet refs/remotes/origin/staging
   ```

3. **Decide what each repo gets:**
   - **Staged or unstaged changes:** skip the repo entirely (no checkout, pull or stash). Record `SKIPPED — dirty` and list the file names. Untracked files alone don't count as dirty; report their count and proceed.
   - **`origin/staging` exists:** check out `staging`, then pull.
   - **No `origin/staging`:** pull the repo's default branch and flag it in the report.

4. **Switch and pull.** Skip the checkout if the repo is already on the target branch:

   ```bash
   git -C <repo> checkout staging
   git -C <repo> pull --ff-only
   ```

   Always use `--ff-only`. Record each outcome and carry on; one repo's failure never stops the sweep.
   - `Already up to date.` means up to date. `Fast-forward` means pulled.
   - If it can't fast-forward, record `FAILED — diverged`. Never force, rebase or reset.
   - If an untracked file blocks the checkout, record `FAILED — checkout blocked` and name the file.
   - If fetch fails with `unable to update local ref`, `cannot lock ref`, or `'refs/remotes/origin/X' exists; cannot create 'refs/remotes/origin/X/Y'`, the cause is stale remote-tracking refs. The pull aborted at the fetch, so the repo is untouched and behind. Never call it up to date; check `rev-list --left-right --count '@{upstream}...HEAD'` instead. Prune and retry once:

     ```bash
     git -C <repo> remote prune origin --dry-run   # read what would go
     git -C <repo> remote prune origin
     git -C <repo> pull --ff-only
     ```

     The prune can fail with `cannot lock ref` or `Unable to create '<name>.lock': File exists` while no git process runs and no `.lock` file exists. The cause is then two remote refs whose names differ only in case. On a case-insensitive filesystem their locks collide, so the whole prune aborts. Delete them one at a time instead:

     ```bash
     git -C <repo> for-each-ref --format='%(refname)' refs/remotes/origin \
       | tr 'A-Z' 'a-z' | sort | uniq -d
     git -C <repo> ls-remote --heads origin '<name>'   # empty = gone from remote
     git -C <repo> update-ref -d refs/remotes/origin/<ExactCaseName>
     ```

     Delete a ref only if `ls-remote` returns nothing for it. Then prune and pull again. If it still fails, record `FAILED — fetch blocked` with the git error verbatim. Never touch lock files or `packed-refs` by hand.

5. **Re-survey every repo and report** one row per repo:

   | Repo | Branch now | Result | Staged | Unstaged | Untracked | Stash |

   `Result` is one of `up to date`, `pulled`, `pulled after prune`, `SKIPPED — dirty`, `FAILED — diverged`, `FAILED — checkout blocked` or `FAILED — fetch blocked`. Mark repos left on a non-`staging` default branch, and name the branch a repo was moved off if it didn't start there.

   Under the table, list only what needs action. For each category, say "none" rather than omitting it:
   - Skipped or failed repos: the files involved and the one next command to run.
   - Existing stashes, per repo. `git status` doesn't show them.
   - Repos pulled on a default branch instead of `staging`.
   - Prunes: how many refs were removed, plus every ref deleted individually to break a case collision.
