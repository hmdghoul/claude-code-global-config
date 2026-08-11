---
name: sync-repos
description: Sweep a parent folder of sibling Git repos — switch each to staging, fast-forward pull, and report branch, stash and uncommitted state in one table.
disable-model-invocation: true
---

Update every Git repo sitting directly under a parent folder: switch each to
`staging`, fast-forward pull it, and report the result as one table. Invoking
this skill is the user's approval to run the checkout and pull steps without
pausing to confirm. It never commits, pushes, stashes, resets, or merges.
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

   A failure in one repo never aborts the others; carry on and collect it.

5. Re-survey every repo after the sweep and report the final state as one table,
   one row per repo, in this column order:

   | Repo | Branch now | Result | Staged | Unstaged | Untracked | Stash |

   `Result` is one of: `up to date`, `pulled`, `SKIPPED — dirty`,
   `FAILED — diverged`, `FAILED — checkout blocked`. Mark any repo left on a
   non-`staging` default branch, and note the branch it was moved off when it
   started somewhere else — the user needs to know a feature branch was left
   behind.

   Under the table, cover only what needs action:

   - Every skipped and failed repo, with the file names involved and the one
     command the user would run next.
   - Any pre-existing stash found, per repo. A stash is invisible in
     `git status`, so it must be named explicitly or it will be forgotten.
   - Repos that were pulled on a default branch instead of `staging`.

   Say plainly when a category is empty ("no stashes anywhere") rather than
   omitting it — the absence is the useful signal.
