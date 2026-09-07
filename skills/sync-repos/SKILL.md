---
name: sync-repos
description: Sweep a parent folder of sibling Git repos — switch each to staging, fast-forward pull, and report branch, stash and uncommitted state in one table.
disable-model-invocation: true
---

Update every Git repo sitting directly under a parent folder: switch each to
`staging`, fast-forward pull it, and report the result as one table. Invoking
this skill is the user's approval to run the checkout and pull steps without
pausing to confirm. It never commits, pushes, stashes, resets, or merges.
Pruning stale remote-tracking refs is also approved, but only as the recovery in
step 4 for a pull that a ref conflict blocked — it deletes nothing but pointers
to branches the remote itself already deleted, and never a local branch, commit,
or working-tree file.
If a step fails in a way it does not tell you how to handle, stop and report it;
do not improvise.

The parent folder is the skill's argument (e.g. `/sync-repos C:\Users\Ahmad\source\repos\ananinja`).
If none was given, ask for it — do not guess and do not fall back to the current
working directory.

1. Discover the repos. Every immediate child directory containing a `.git` entry
   is a repo; anything else is ignored. Do not recurse deeper. If none are found,
   say so and stop.

2. Survey each repo **before** touching it. This drives both the safety gate in
   step 3 and the final report:

   ```bash
   git -C <repo> rev-parse --abbrev-ref HEAD
   git -C <repo> diff --cached --name-only          # staged
   git -C <repo> diff --name-only                   # unstaged
   git -C <repo> ls-files --others --exclude-standard   # untracked
   git -C <repo> stash list
   git -C <repo> rev-parse --verify --quiet refs/remotes/origin/staging
   ```

3. Decide what each repo gets, from the survey:

   - **Staged or unstaged changes present** → skip it entirely. Do not check out,
     do not pull, do not stash. Record it as `SKIPPED — dirty` with the file
     counts, and list the actual staged/modified file names in the report so the
     user can see what is being protected. Untracked files alone are **not**
     dirty: they survive a checkout untouched, so proceed normally and just
     report the count.
   - **`origin/staging` exists** → check out `staging`, then pull.
   - **No `origin/staging`** → stay on the repo's own default branch and pull
     that. Mark it in the report so the user can see it was not put on `staging`.

4. Switch and pull each eligible repo:

   ```bash
   git -C <repo> checkout staging
   git -C <repo> pull --ff-only
   ```

   Always `--ff-only` — this must never silently create a merge commit. Skip the
   checkout when the repo is already on the target branch. Treat these outcomes
   as data for the report, not as reasons to stop the sweep:

   - `Already up to date.` — nothing to do.
   - `Fast-forward` with a diffstat — updated.
   - A refusal to fast-forward (local and remote diverged) — report it as
     `FAILED — diverged`. Never force, rebase, or reset to resolve it.
   - Checkout blocked because an untracked file would be overwritten — report it
     as `FAILED — checkout blocked` and name the file.
   - Fetch refused over conflicting refs — `unable to update local ref`,
     `cannot lock ref`, or `'refs/remotes/origin/X' exists; cannot create
     'refs/remotes/origin/X/Y'`. This is stale remote-tracking refs, not a
     divergence, and it is recoverable — run the prune below. Note that the pull
     aborts at the fetch, so the merge never runs: the repo sits untouched and
     quietly behind while the command looks merely noisy. Never report it as up
     to date on the strength of the pull not saying otherwise; read the repo's
     own `rev-list --left-right --count '@{upstream}...HEAD'` instead.

   Prune and retry, once, for that last case only:

   ```bash
   git -C <repo> remote prune origin --dry-run   # read what would go
   git -C <repo> remote prune origin
   git -C <repo> pull --ff-only
   ```

   If the prune itself exits non-zero with `cannot lock ref` /
   `Unable to create '<name>.lock': File exists` while no git process is running
   and no `.lock` file is on disk, the cause is two remote-tracking refs whose
   names differ only in case. Git deletes refs as one transaction, and on a
   case-insensitive filesystem their two lock paths collide, so the whole prune
   aborts and nothing at all is removed — including the ref that blocked the
   fetch. Find the pair and delete each one on its own, since a single lock
   cannot collide with itself:

   ```bash
   git -C <repo> for-each-ref --format='%(refname)' refs/remotes/origin \
     | tr 'A-Z' 'a-z' | sort | uniq -d
   git -C <repo> ls-remote --heads origin '<name>'   # empty = gone from remote
   git -C <repo> update-ref -d refs/remotes/origin/<ExactCaseName>
   ```

   Confirm with `ls-remote` that a ref is gone from the remote before deleting
   it, and never delete one `ls-remote` still returns. Then prune and pull again.
   If it still fails, report `FAILED — fetch blocked` with the git error verbatim
   and stop; do not go after the lock files or `packed-refs` by hand.

   A failure in one repo never aborts the others; carry on and collect it.

5. Re-survey every repo after the sweep and report the final state as one table,
   one row per repo, in this column order:

   | Repo | Branch now | Result | Staged | Unstaged | Untracked | Stash |

   `Result` is one of: `up to date`, `pulled`, `pulled after prune`,
   `SKIPPED — dirty`, `FAILED — diverged`, `FAILED — checkout blocked`,
   `FAILED — fetch blocked`. Mark any repo left on a
   non-`staging` default branch, and note the branch it was moved off when it
   started somewhere else — the user needs to know a feature branch was left
   behind.

   Under the table, cover only what needs action:

   - Every skipped and failed repo, with the file names involved and the one
     command the user would run next.
   - Any pre-existing stash found, per repo. A stash is invisible in
     `git status`, so it must be named explicitly or it will be forgotten.
   - Repos that were pulled on a default branch instead of `staging`.
   - Every repo that needed a prune: how many refs went, and the name of any ref
     deleted individually to break a case collision. The user never asked for
     those deletions, so they are reported, not assumed.

   Say plainly when a category is empty ("no stashes anywhere") rather than
   omitting it — the absence is the useful signal.
