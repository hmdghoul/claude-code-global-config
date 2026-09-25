---
name: review-lessons
description: Mine the review feedback on a repository's merged pull requests into a grouped, actionable "recurring mistakes" document, and create or update it at ~/.claude/lessons/<owner>/<name>/review-lessons.md. Use when asked to learn from past code reviews, find recurring review comments, or refresh an existing review-lessons file.
---

# Review lessons

Turn a repo's code review history into a document of recurring mistakes, each with **Mistake / Why it matters / Example PR / What to check next time**. Output always goes to the global store, never into the analysed repo:

```
~/.claude/lessons/<owner>/<name>/review-lessons.md
~/.claude/lessons/<owner>/<name>/.review-lessons-state.json    lessons + resume watermark
~/.claude/lessons/<owner>/<name>/.review-lessons-corpus.json   every comment ever fetched
```

**Read-only.** Use only GET and GraphQL reads (`gh api graphql`, `gh pr view`, `gh pr list`). Never modify the repo, and never stage or commit, in the repo or in `~/.claude`.

## Step 1: Resolve the target

Run `gh auth status` first so a long fetch can't die on credentials. Then run `gh repo view --json nameWithOwner -q .nameWithOwner`, or use the repo the user names. Set:

- `DOC=~/.claude/lessons/<owner>/<name>/review-lessons.md`
- `CORPUS=~/.claude/lessons/<owner>/<name>/.review-lessons-corpus.json`
- `WORK=<scratchpad>/review-lessons/<name>`

## Step 2: Create or update

If `DOC` is missing, this is a **create**: fetch and analyse everything. Otherwise it is an **update**. Read `runAt` from `.review-lessons-state.json`, or from the `<!-- review-lessons ... runAt=... -->` comment on line 1 of the doc, and pass it as `--since`.

An update fetches less but re-derives lessons from the **whole** corpus. Never hand-merge into an existing lesson set. Say what the run costs before starting, and skip it if too little is new to move any count.

## Step 3: Collect and filter

```bash
node ~/.claude/skills/review-lessons/scripts/collect.js \
  --owner <owner> --repo <name> --out "$WORK" --corpus "$CORPUS" --chunks 9
# add --since "<runAt>" to re-fetch only what has been touched since the last run
```

The script fetches merged PRs by `updatedAt`, merges them into `$CORPUS`, then filters and chunks the full corpus. It drops bots, the PR author's own replies, approvals and acks, empty or image-only comments, and duplicate text on the same PR. It keeps the same point made on different PRs, because that is the recurrence signal.

Report the counts from `stats.json`. If `keptActionableCandidates` is under ~50, warn that there may be too little history and let the user decide whether to continue.

## Step 4: Analyse

Use `Workflow` if the user opted into multi-agent orchestration. Otherwise use `Agent`, or work inline for a small corpus.

1. **Extract**: one agent per chunk. For each actionable comment, emit `{pr, reviewer, file, category, mistake, quote, severity}`. `quote` is verbatim, and `mistake` is a repeatable lesson, not a restatement of the one line. Be strict about actionability and report what was dropped.
2. **Cluster**: group findings into themes that each recur across **3 or more distinct PRs**, and merge near-duplicates hard. Title each theme as a mistake in the second person, never a topic label.
3. **Enrich**: fan out over slices of themes. For each theme, write `mistake`, `whyItMatters` (the concrete consequence in this system), the clearest example PR with its verbatim quote, and 3-6 `whatToCheck` items.
4. **Critique**: one harsh agent looks for overlapping lessons, high-volume categories with no lesson, and checks that can't be performed.
5. **Revise**: merge overlaps, split buckets that hide several defect classes, add the missing lessons, and rewrite unperformable checks.
6. **Consolidate**: dedupe `whatToCheck` across all lessons so each check lives in exactly one. Assign `rank` and `band` (`before-you-open-the-pr` for mechanical diff checks, `while-you-write-the-code` otherwise), and record anything still weak in `residualConcerns`.

Order lessons by checkability × cost of a miss, not by frequency; big subjective categories go last. After extraction, write `actionable` (findings kept) and `actionablePrs` (distinct PRs those findings came from) into `$WORK/stats.json`. `render.js` requires both.

**Quality bars:**
- A quote is verbatim or absent.
- A check names a file, command, table or convention. Never write "be careful", "consider", "think about" or "read aloud", and never require production-sized data locally.
- `whyItMatters` names a real failure (what breaks, who sees it, what is silently wrong). Reviewer inconvenience comes second at most.
- Ground repo claims by reading the repo, but never let that override what a reviewer said.

## Step 5: Verify

Re-match every `exampleQuote` against `kept.json` for its PR yourself; don't trust an agent's `verified` flag. Report the match ratio, and fix or drop any lesson whose quote doesn't match.

## Step 6: Render

Give each lesson a short `title`, then run:

```bash
node ~/.claude/skills/review-lessons/scripts/render.js \
  --lessons "$WORK/final.json" --stats "$WORK/stats.json" --out "$DOC"
```

`final.json` is `{lessons: [...], residualConcerns: "..."}`. The renderer writes the doc, the state sidecar (with the next `runAt`) and a Coverage row, and it prints `{"action":"created"|"updated", ...}`. It refuses to write an empty lesson set over an existing doc.

Send the file to the user and report what was done, what differs from a plain reading of the request, and what is still weak, including the `residualConcerns`.

## Step 7: Offer reconciliation, then stop

If `~/.claude/skills/review-lessons-reconcile/` exists, end the report with:

> Do you want me to run `review-lessons-reconcile` to check these against your global rules and this project's memory, and propose what to add or update?

Ask and wait; never run it uninvited. If the user hasn't seen it before, explain in one line: it reports which lessons are already covered, which to add and where, which belong in project memory, and which conflict with a recorded decision. It only proposes, and nothing is written without a second approval.

## Notes

- Before a full rebuild, warn about the cost: about one GraphQL page per 25 PRs, and a few hundred thousand agent tokens once the corpus exceeds a thousand comments.
- If the user wants lessons about *their own* PRs, filter `kept.json` by `prAuthor` before Step 4 and say the corpus shrank.
