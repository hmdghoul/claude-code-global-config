---
name: review-lessons
description: Mine the review feedback on a repository's merged pull requests into a grouped, actionable "recurring mistakes" document, and create or update it at ~/.claude/lessons/<owner>/<name>/review-lessons.md. Use when asked to learn from past code reviews, find recurring review comments, or refresh an existing review-lessons file.
---

# Review lessons

Turn the code review history of a repository into a document of recurring mistakes, each with **Mistake / Why it matters / Example PR / What to check next time**.

The output is **always** written to the global store, never into the repository being analysed:

```
~/.claude/lessons/<owner>/<name>/review-lessons.md
~/.claude/lessons/<owner>/<name>/.review-lessons-state.json    lessons + resume watermark
~/.claude/lessons/<owner>/<name>/.review-lessons-corpus.json   every comment ever fetched
```

`<owner>` and `<name>` are the two halves of the repository's GitHub slug, so every analysed repo gets its own folder under `~/.claude/lessons/` and they never collide.

## Read-only rule

This skill never writes to GitHub and never modifies the analysed repository. Use only GET/GraphQL reads (`gh api graphql`, `gh pr view`, `gh pr list`). Never `gh pr create|edit|comment|review|merge|close`, and never a non-GET `gh api`. Never stage or commit anything, in the repo or in `~/.claude`.

## Step 1 — Resolve the target

```bash
gh repo view --json nameWithOwner -q .nameWithOwner
```

Confirm `gh` is authenticated first — `gh auth status` — so a long fetch cannot die halfway on credentials. Then split the slug into `<owner>/<name>`. If the user names a different repository, use that instead. Set:

- `DOC=~/.claude/lessons/<owner>/<name>/review-lessons.md`
- `CORPUS=~/.claude/lessons/<owner>/<name>/.review-lessons-corpus.json`
- `WORK=<scratchpad>/review-lessons/<name>`

## Step 2 — Decide create or update

If `DOC` does not exist, this is a **create**: full fetch, full analysis.

If `DOC` exists, this is an **update**. Read `runAt` from `.review-lessons-state.json` beside it (or from the `<!-- review-lessons ... runAt=... -->` comment on line 1 of the doc), and pass it as `--since`.

**An incremental run is cheaper to *fetch*, never cheaper to *analyse*.** Only pull requests touched since `runAt` are re-fetched; they are merged into the stored corpus, and the lessons are then re-derived from the **whole** corpus. There is no partial lesson set and nothing to merge by hand — which is deliberate, because a hand-merged lesson set rots: counts drift, themes get half-updated, and no one can tell which run a number came from.

So the only real choice is whether to re-run the analysis at all. Say what it costs before starting, and skip the run entirely if too little is new to move any count.

## Step 3 — Collect and filter

```bash
node ~/.claude/skills/review-lessons/scripts/collect.js \
  --owner <owner> --repo <name> --out "$WORK" --corpus "$CORPUS" --chunks 9
# add --since "<runAt>" to re-fetch only what has been touched since the last run
```

It paginates merged PRs newest-updated first, re-fetches any PR truncated by a page cap, retries transient failures three times, merges everything into `$CORPUS`, then filters and chunks the **full** corpus. It aborts rather than continuing if GraphQL returns errors alongside partial data. It needs only `gh` and `node` — no `jq`, no `python`.

Resumption keys off `updatedAt`, not the PR number or `mergedAt`: pull requests do **not** merge in number order (measured at ~19% out-of-order on a real repo, with gaps over 150 PRs), and a long-lived PR that merges late would otherwise be skipped forever. `updatedAt` also catches review comments added to a PR after it merged.

What it drops, and why: **bots**; **the PR author's own replies** (a reply on your own PR is not feedback on you); **approvals and acknowledgements** (`lgtm`, `done`, `addressed`, emoji); **empty or image-only** comments; and **the same text repeated on the same PR**. It deliberately keeps the same point made across *different* PRs — that repetition is the recurrence signal the whole document rests on.

Report the counts from `stats.json` before going further. If `keptActionableCandidates` is under ~50, say so: there may not be enough history for recurring themes, and the user should decide whether to continue.

## Step 4 — Analyse

Run the pipeline below. Use the `Workflow` tool if the user opted into multi-agent orchestration; otherwise run the same stages with `Agent`, or inline for a small corpus.

1. **Extract** — one agent per chunk. Classify every comment: is it actionable, and what generalized mistake does it point at? Emit `{pr, reviewer, file, category, mistake, quote, severity}`. `quote` must be **verbatim**, `mistake` must be a repeatable lesson rather than a restatement of the one line. Be strict about actionability and report what was dropped.
2. **Cluster** — one agent over all findings. Group into themes, each recurring across **at least 3 distinct PRs**. Merge near-duplicate categories hard. Titles must state a *mistake in the second person*, never a topic label.
3. **Enrich** — fan out over theme slices. Per theme write `mistake`, `whyItMatters` (the concrete consequence in this system, not platitudes), the clearest example PR with its verbatim quote, and 3-6 `whatToCheck` items.
4. **Critique** — one agent. Find overlapping lessons, categories with real volume and no lesson, and checks that cannot actually be performed. Be harsh.
5. **Revise** — apply the critique: merge overlaps, split buckets that hide several defect classes, add the missing lessons, and rewrite unperformable checks.
6. **Consolidate** — one agent. Dedupe `whatToCheck` **across all lessons** so each check lives in exactly one; assign `rank` and `band` (`before-you-open-the-pr` for mechanical diff checks, `while-you-write-the-code` for the rest); record anything still weak in `residualConcerns`.

Order lessons by *checkability × cost of a miss*, **not** by frequency. The biggest categories are usually the most subjective and belong last.

When extraction finishes, write two numbers into `$WORK/stats.json` — `actionable` (total findings kept) and `actionablePrs` (distinct PRs those findings came from). `render.js` refuses to run without them, because the header would otherwise count a different thing from the body.

### Quality bars, non-negotiable

- **A quote is verbatim or it is absent.** Never paraphrase inside a quote.
- **A check must be performable.** Name the file, command, table, or convention. Ban "be careful", "consider", "think about", "read aloud", and anything needing production-sized data locally.
- **`whyItMatters` names a real failure** — what breaks, who sees it, what is silently wrong. Reviewer inconvenience is at most the second sentence.
- **A mistake is a mistake**, phrased in the second person, not a topic label.
- Ground claims about the repository by reading it, but never let repo reading override what a reviewer actually said.

## Step 5 — Verify before writing

Independently re-match every `exampleQuote` against `kept.json` for that PR number — do not trust an agent's own `verified` flag. Report the ratio. Fix or drop any lesson whose quote does not match.

## Step 6 — Render

Add a short `title` to each lesson (a readable heading; the renderer falls back to prettifying the slug), then:

```bash
node ~/.claude/skills/review-lessons/scripts/render.js \
  --lessons "$WORK/final.json" --stats "$WORK/stats.json" --out "$DOC"
```

`final.json` is `{lessons: [...], residualConcerns: "..."}`. The renderer creates or overwrites `DOC`, writes the sidecar state including the `runAt` the next run resumes from, and adds a row to the **Coverage** table so the document shows how it grew (re-rendering on the same date replaces that row rather than stacking a duplicate). It prints `{"action":"created"|"updated", ...}`.

It refuses to write an empty lesson set over an existing document, so a failed analysis cannot quietly gut the file.

Then send the file to the user and report: what was done, what differs from a plain reading of the request, and what is still weak — the `residualConcerns` belong in that report, not buried.

## Step 7 — Offer the reconciliation, then stop

The lessons are only worth what they change. End the run by asking, as the last line of the report:

> Do you want me to run `review-lessons-reconcile` to check these against your global rules and this project's memory, and propose what to add or update?

**Ask; never run it.** Wait for a yes. Reconciliation proposes edits to `~/.claude/CLAUDE.md`, the files in `~/.claude/rules/`, and the project memory — files that govern every future session in every project — so starting it uninvited is not a convenience, it is a surprise.

Say what it does in one line if the user has not seen it before: it reports which lessons are already covered by an existing rule, which should be added and to which file, which belong in project memory as repo-specific facts, and which conflict with a decision already recorded. It proposes only; nothing is written without a second approval.

Skip the offer if `~/.claude/skills/review-lessons-reconcile/` is not present.

## Notes

- Both scripts are pure `node` + `gh` on purpose — no `jq` and no `python`, neither of which is reliably present on Windows.
- A large repository is a real cost — roughly one GraphQL page per 25 PRs, and a few hundred thousand agent tokens once the corpus runs to a thousand-plus comments. Say so before starting a full rebuild.
- If the user asks for lessons about *their own* PRs rather than the whole repo, filter `kept.json` by `prAuthor` before Step 4 and say the corpus shrank.
