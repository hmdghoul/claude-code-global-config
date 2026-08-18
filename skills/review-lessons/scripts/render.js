#!/usr/bin/env node
/*
 * Render review-lessons.md from a lesson set, creating or updating in place.
 *
 * Usage:
 *   node render.js --lessons <lessons.json> --stats <stats.json> --out <path/to/review-lessons.md>
 *
 * Writes:
 *   <out>                         the document
 *   <dir>/.review-lessons-state.json   machine state for the next incremental run
 *
 * Create vs update is decided by whether <out> already exists. On update the
 * previous coverage is carried into the History section so the doc shows how it grew.
 */
const fs = require('fs');
const path = require('path');

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) {
    console.error(`error: ${flag} needs a value`);
    process.exit(2);
  }
  return v;
}

const LESSONS = arg('--lessons');
const STATS = arg('--stats');
const OUT = arg('--out');
const RUN_DATE = arg('--date', new Date().toISOString().slice(0, 10));
if (!LESSONS || !STATS || !OUT) {
  console.error('usage: node render.js --lessons <f> --stats <f> --out <path/review-lessons.md>');
  process.exit(2);
}

const src = JSON.parse(fs.readFileSync(LESSONS, 'utf8'));
const lessons = (Array.isArray(src) ? src : src.lessons).slice().sort((a, b) => a.rank - b.rank);
const stats = JSON.parse(fs.readFileSync(STATS, 'utf8'));
const residual = (Array.isArray(src) ? '' : src.residualConcerns) || '';

// These are produced by the classification pass, not by collect.js. Failing loudly
// beats silently printing a header that counts a different thing from the body.
for (const k of ['actionable', 'actionablePrs']) {
  if (typeof stats[k] !== 'number') {
    console.error(`error: stats.json is missing "${k}".`);
    console.error('After classification, write the actionable finding count and the number of');
    console.error(`distinct PRs those findings came from into ${STATS}, then render again.`);
    process.exit(2);
  }
}
if (!lessons.length) {
  console.error('error: no lessons to render — refusing to overwrite an existing document with an empty one.');
  process.exit(2);
}

const dir = path.dirname(OUT);
fs.mkdirSync(dir, { recursive: true });
const statePath = path.join(dir, '.review-lessons-state.json');
const isUpdate = fs.existsSync(OUT);
let prev = null;
if (fs.existsSync(statePath)) {
  try { prev = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (e) { prev = null; }
}

const REPO_URL = `https://github.com/${stats.owner}/${stats.repo}`;
const PR = n => `[#${n}](${REPO_URL}/pull/${n})`;
const dec = s => String(s == null ? '' : s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const titleOf = l => dec(l.title || dec(l.slug).replace(/-/g, ' ').replace(/^./, c => c.toUpperCase()));
const n = x => Number(x || 0).toLocaleString('en-US');

const pre = lessons.filter(l => l.band === 'before-you-open-the-pr');
const cod = lessons.filter(l => l.band !== 'before-you-open-the-pr');
const out = [];
const p = (...xs) => out.push(...xs);

p(`<!-- review-lessons v1 | repo=${stats.owner}/${stats.repo} | lastPr=${stats.maxPr} | prsScanned=${stats.prsScanned} | runAt=${stats.runAt} | generated=${RUN_DATE} -->`);
p('');
p(`# Review lessons — ${stats.repo}`);
p('');
p(`Recurring mistakes drawn from the code review history of \`${stats.owner}/${stats.repo}\`.`);
p('');
p([
  `**${n(stats.prsScanned)} merged pull requests** were read`,
  stats.firstMerged ? `, spanning **${stats.firstMerged} to ${stats.lastMerged}**` : '',
  `. Their review threads, review summaries, and conversation comments were collected, then stripped of bot output, approvals, acknowledgements, and the PR authors' own replies. `,
  `That left **${n(stats.keptActionableCandidates)} reviewer comments**, of which `,
  `**${n(stats.actionable)} were actionable**, across **${n(stats.actionablePrs)} PRs** `,
  `and **${n(stats.prAuthors)} different PR authors**.`,
].join(''));
p('');
p("These are team-wide patterns, not one person's. A mistake earned a place here only by recurring across at least three separate pull requests.");
p('');
p('## How to use this');
p('');
p('The order is not by frequency. It is by *how mechanically checkable a mistake is* multiplied by *what it costs to miss it*. The most subjective categories sit last, because a reviewer will catch those for you and the cost is review time. The ones at the top fail silently in production, and nothing else catches them.');
p('');
p(`- **Before you open the PR** (${pre.length} lessons) — mechanical checks against a finished diff. Roughly five minutes, no judgement required.`);
p(`- **While you write the code** (${cod.length} lessons) — things to weigh as you go.`);
p('');
p('| # | Mistake | Seen in |');
p('|---|---|---|');
for (const l of lessons) p(`| ${l.rank} | ${titleOf(l)} | ${l.occurrences} comments / ${l.prNumbers.length} PRs |`);
p('');

function section(list, heading, note) {
  p('---', '', '# ' + heading, '');
  if (note) p(note, '');
  for (const l of list) {
    p(`## ${l.rank}. ${titleOf(l)}`, '');
    p(`> Seen in **${l.occurrences} review comments** across **${l.prNumbers.length} pull requests**.`, '');
    p('**Mistake**', '', dec(l.mistake), '');
    p('**Why it matters**', '', dec(l.whyItMatters), '');
    p('**Example PR**', '');
    const bits = [PR(l.examplePr)];
    if (l.exampleReviewer) bits.push('reviewed by `' + dec(l.exampleReviewer) + '`');
    p(bits.join(' — '), '');
    if (l.exampleFile) p('`' + dec(l.exampleFile) + '`', '');
    if (l.exampleContext) p(dec(l.exampleContext), '');
    p('> ' + dec(l.exampleQuote).replace(/\s*\n+\s*/g, ' ').trim(), '');
    p('**What to check next time**', '');
    l.whatToCheck.forEach((c, i) => p(`${i + 1}. ${dec(c)}`));
    p('');
    const others = l.prNumbers.filter(x => x !== l.examplePr);
    if (others.length) {
      const shown = others.slice(0, 18).map(PR).join(', ');
      p(`<sub>Also in: ${shown}${others.length > 18 ? ` and ${others.length - 18} more` : ''}.</sub>`, '');
    }
  }
}
section(pre, 'Before you open the PR', 'Diff-level checks. You can run all of them on a finished branch without re-reading your own logic.');
section(cod, 'While you write the code', 'These need judgement about the change itself, so they are cheapest to apply while the code is still in your head.');

p('---', '');
p('## How this was built', '');
p('1. Every merged PR was pulled through the GitHub GraphQL API — review threads, review summary bodies, and conversation comments. PRs whose thread or review counts exceeded the page size were re-fetched individually so nothing was truncated.');
p('2. Comments were dropped if they came from a bot, from the PR author replying on their own PR, or if they were an approval, an acknowledgement ("lgtm", "done", "addressed"), an emoji, an image with no prose, or release logistics.');
p('3. The survivors were classified one by one into a mistake and a category, and the non-actionable ones set aside.');
p('4. Categories were clustered into recurring themes, each required to appear in at least three distinct PRs.');
p('5. A separate pass audited the result for overlapping lessons, uncovered categories, and checklist items that could not actually be performed, and its findings were applied.');
p('6. Every quotation was verified verbatim against the collected comment, and repository claims were confirmed against the working tree.');
p('');
if (residual) {
  p('## Limits', '');
  for (const para of residual.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)) p(para, '');
}
p('## Coverage', '');
p('| Run | Date | PRs scanned | Comments kept | Lessons | Newest PR |');
p('|---|---|---|---|---|---|');
const row = { date: RUN_DATE, prsScanned: stats.prsScanned, kept: stats.keptActionableCandidates, lessons: lessons.length, maxPr: stats.maxPr };
// re-rendering the same day is a correction, not a new run — replace rather than stack rows
const history = (prev?.history || []).filter(h => h.date !== RUN_DATE);
history.push(row);
history.forEach((h, i) => p(`| ${i + 1}${i === history.length - 1 ? ' (latest)' : ''} | ${h.date} | ${n(h.prsScanned)} | ${n(h.kept)} | ${h.lessons} | #${h.maxPr} |`));
p('');
p(`Regenerate with the \`review-lessons\` skill. The next run resumes from \`${stats.runAt}\`, re-fetching only the pull requests touched since then. The lessons are always re-derived from the full stored corpus, so an incremental run costs less but still reads everything.`);
p('');

fs.writeFileSync(OUT, out.join('\n'), 'utf8');
fs.writeFileSync(statePath, JSON.stringify({
  version: 1,
  owner: stats.owner,
  repo: stats.repo,
  lastPr: stats.maxPr,
  runAt: stats.runAt,          // pass to the next run as --since
  generated: RUN_DATE,
  lessonCount: lessons.length,
  history,
  lessons,
}, null, 1), 'utf8');

console.error(`${isUpdate ? 'updated' : 'created'}: ${OUT}`);
console.error(`state:   ${statePath}`);
console.log(JSON.stringify({ action: isUpdate ? 'updated' : 'created', out: OUT, lessons: lessons.length, lastPr: stats.maxPr }));
