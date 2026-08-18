#!/usr/bin/env node
/*
 * Collect and filter merged-PR review feedback for the review-lessons skill.
 *
 * Usage:
 *   node collect.js --owner <org> --repo <name> --out <workdir> [--corpus <file>] [--since <iso>] [--chunks 9]
 *
 * Incremental runs are FETCH-only. With --corpus and --since, only PRs touched
 * since that timestamp are fetched; they are merged into the stored corpus and
 * the FULL corpus is then filtered and chunked. Lessons are therefore always
 * re-derived from complete history — there is no partial lesson set to merge.
 *
 * Produces inside <workdir>:
 *   raw/page_*.json      GraphQL pages from this fetch
 *   all_comments.json    every comment with a body, whole corpus
 *   kept.json            reviewer comments surviving the filter
 *   chunks/chunk_N.md    agent-readable slices of kept.json
 *   stats.json           counts the document cites
 *
 * Requires: gh (authenticated), node. No jq/python dependency.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

const OWNER = arg('--owner');
const REPO = arg('--repo');
const OUT = arg('--out');
const CORPUS = arg('--corpus', null);
const SINCE = arg('--since', null);
const CHUNKS = parseInt(arg('--chunks', '9'), 10) || 9;

if (!OWNER || !REPO || !OUT) {
  console.error('usage: node collect.js --owner <org> --repo <name> --out <workdir> [--corpus <file>] [--since <iso>] [--chunks N]');
  process.exit(2);
}
if (SINCE && !CORPUS) {
  console.error('error: --since needs --corpus (an incremental fetch has nothing to extend without the stored corpus)');
  process.exit(2);
}
const sinceMs = SINCE ? Date.parse(SINCE) : null;
if (SINCE && Number.isNaN(sinceMs)) {
  console.error(`error: --since is not a valid timestamp: ${SINCE}`);
  process.exit(2);
}

const RAW = path.join(OUT, 'raw');
const CHUNKDIR = path.join(OUT, 'chunks');
for (const d of [OUT, RAW, CHUNKDIR]) fs.mkdirSync(d, { recursive: true });

// updatedAt drives resumption: anything merged OR newly commented since the last
// run has updatedAt past the watermark. A mergedAt/number watermark would miss a
// long-lived PR that merged out of number order, and miss late comments entirely.
const PAGE_QUERY = `
query($cursor: String) {
  repository(owner: "${OWNER}", name: "${REPO}") {
    pullRequests(states: MERGED, first: 25, after: $cursor, orderBy: {field: UPDATED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title mergedAt updatedAt author { login }
        comments(first: 50) { nodes { author { login } body createdAt } }
        reviews(first: 30) { nodes { author { login } state body } }
        reviewThreads(first: 40) {
          nodes { isResolved comments(first: 15) { nodes { author { login } body path line } } }
        }
      }
    }
  }
}`;

const ONE_QUERY = `
query($num: Int!) {
  repository(owner: "${OWNER}", name: "${REPO}") {
    pullRequest(number: $num) {
      number title mergedAt updatedAt author { login }
      comments(first: 100) { nodes { author { login } body createdAt } }
      reviews(first: 100) { nodes { author { login } state body } }
      reviewThreads(first: 100) {
        nodes { isResolved comments(first: 50) { nodes { author { login } body path line } } }
      }
    }
  }
}`;

const FATAL = /Could not resolve to a Repository|Bad credentials|authentication required|not found/i;

function sleep(ms) {
  // synchronous backoff so the fetch loop stays linear and resumable
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function gh(queryFile, fields = [], attempt = 1) {
  const MAX = 3;
  let raw;
  try {
    raw = execFileSync('gh', ['api', 'graphql', '-F', `query=@${queryFile}`, ...fields], {
      encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const msg = (e.stderr || e.message || '').toString();
    if (FATAL.test(msg) || attempt >= MAX) throw new Error(msg.trim().split('\n')[0] || e.message);
    const wait = 2000 * attempt;
    console.error(`\n  transient failure (attempt ${attempt}/${MAX}), retrying in ${wait / 1000}s: ${msg.trim().split('\n')[0]}`);
    sleep(wait);
    return gh(queryFile, fields, attempt + 1);
  }
  const res = JSON.parse(raw);
  // GraphQL returns partial data alongside errors at HTTP 200 — never treat that as complete
  if (res.errors && res.errors.length) {
    throw new Error('GraphQL errors: ' + res.errors.map(e => e.message).join('; '));
  }
  return res;
}

const qPage = path.join(OUT, '_page.graphql');
const qOne = path.join(OUT, '_one.graphql');
fs.writeFileSync(qPage, PAGE_QUERY);
fs.writeFileSync(qOne, ONE_QUERY);

// ---------------------------------------------------------------- corpus
let corpus = {};
if (CORPUS && fs.existsSync(CORPUS)) {
  try {
    const stored = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
    corpus = stored.prs || {};
    console.error(`loaded stored corpus: ${Object.keys(corpus).length} PRs from ${CORPUS}`);
  } catch (e) {
    console.error(`warning: could not read corpus at ${CORPUS} (${e.message}); falling back to a full fetch`);
    corpus = {};
  }
}
const incremental = Boolean(SINCE && Object.keys(corpus).length);
if (SINCE && !incremental) console.error('note: --since given but no stored corpus, so this is a full fetch');

// ---------------------------------------------------------------- fetch
console.error(`fetching merged PRs for ${OWNER}/${REPO}${incremental ? ` (incremental, touched since ${SINCE})` : ' (full history)'}`);
for (const f of fs.readdirSync(RAW)) fs.unlinkSync(path.join(RAW, f));

let cursor = null, page = 0, fetched = 0, stop = false, staleStreak = 0;
const capped = new Set();

while (!stop) {
  page++;
  let res;
  try {
    res = gh(qPage, cursor ? ['-F', `cursor=${cursor}`] : []);
  } catch (e) {
    console.error(`\nFAILED on page ${page}: ${e.message}`);
    process.exit(1);
  }
  const conn = res?.data?.repository?.pullRequests;
  if (!conn) {
    console.error(`\nunexpected response on page ${page}: ${JSON.stringify(res).slice(0, 400)}`);
    process.exit(1);
  }
  for (const pr of conn.nodes) {
    corpus[pr.number] = pr;
    if ((pr.comments?.nodes || []).length >= 50) capped.add(pr.number);
    if ((pr.reviews?.nodes || []).length >= 30) capped.add(pr.number);
    if ((pr.reviewThreads?.nodes || []).length >= 40) capped.add(pr.number);
    for (const t of pr.reviewThreads?.nodes || []) {
      if ((t.comments?.nodes || []).length >= 15) capped.add(pr.number);
    }
  }
  fs.writeFileSync(path.join(RAW, `page_${String(page).padStart(3, '0')}.json`), JSON.stringify(res));
  fetched += conn.nodes.length;
  process.stderr.write(`\r  page ${page} (${fetched} PRs fetched)`);

  if (incremental && conn.nodes.length && conn.nodes.every(nd => Date.parse(nd.updatedAt) < sinceMs)) {
    staleStreak++;                    // one page of overlap before trusting the watermark
    if (staleStreak >= 2) stop = true;
  } else {
    staleStreak = 0;
  }
  if (!stop && !conn.pageInfo.hasNextPage) stop = true;
  else if (!stop) cursor = conn.pageInfo.endCursor;
  if (page > 400) { console.error('\nsafety stop at 400 pages'); stop = true; }
}
process.stderr.write(`\n  ${fetched} PRs fetched over ${page} pages\n`);

if (capped.size) {
  console.error(`  refetching ${capped.size} truncated PR(s): ${[...capped].join(', ')}`);
  for (const num of capped) {
    try {
      const res = gh(qOne, ['-F', `num=${num}`]);
      const pr = res?.data?.repository?.pullRequest;
      if (pr) corpus[pr.number] = pr;
    } catch (e) {
      console.error(`  warning: could not refetch PR #${num}: ${e.message}`);
    }
  }
}

if (CORPUS) {
  fs.mkdirSync(path.dirname(CORPUS), { recursive: true });
  fs.writeFileSync(CORPUS, JSON.stringify({ version: 1, owner: OWNER, repo: REPO, prs: corpus }), 'utf8');
}

// ---------------------------------------------------------------- flatten
const all = [];
for (const pr of Object.values(corpus)) {
  const meta = { pr: pr.number, title: pr.title, prAuthor: pr.author?.login || '(ghost)', mergedAt: pr.mergedAt };
  for (const c of pr.comments?.nodes || []) {
    all.push({ ...meta, kind: 'conversation', author: c.author?.login || '(ghost)', body: c.body || '', path: null, line: null, state: null });
  }
  for (const r of pr.reviews?.nodes || []) {
    if ((r.body || '').trim()) all.push({ ...meta, kind: 'reviewBody', author: r.author?.login || '(ghost)', body: r.body, path: null, line: null, state: r.state });
  }
  for (const t of pr.reviewThreads?.nodes || []) {
    for (const c of t.comments?.nodes || []) {
      all.push({ ...meta, kind: 'inline', author: c.author?.login || '(ghost)', body: c.body || '', path: c.path, line: c.line, state: t.isResolved ? 'RESOLVED' : 'OPEN' });
    }
  }
}
fs.writeFileSync(path.join(OUT, 'all_comments.json'), JSON.stringify(all));

// ---------------------------------------------------------------- filter
const BOT = /\[bot\]|dependabot|github-actions|codecov|sonar|coderabbit|renovate|snyk|imgbot|semantic-release|copilot/i;
const norm = s => s.trim().toLowerCase().replace(/\s+/g, ' ');
const substance = s => s.split('\n').filter(l => !/^\s*>/.test(l)).join('\n')
  .replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ')
  .replace(/https?:\/\/\S+/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const ACK = /^(lgtm|lgtm[!.,\s]*(minor|nit|small).*|done|addressed|address(ed)?|ok|okay|okey|k|resolved|fixed|updated|added|removed|thanks?|thank you|thx|ty|yes|yep|yeah|sure|correct|agreed|agree|noted|got it|good catch|nice|nice catch|great|good|cool|approved|approve|approving|\+1|same|same here|same as above|no need|makes sense|will do|ack|acknowledged|my bad|true|right|sounds good|sgtm|wfm|safe from my side|good to go|gtg|ship it|merged|rebased|please check|check the comments|minor comments?|nitpicks?|no comments?|nothing|na|n\/a|\?+|!+|\.+)[.!\s]*$/i;
const EMOJI = /^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}‍️]+$/u;

const dropped = { bot: 0, self: 0, ack: 0, empty: 0, tooShort: 0, dupInPr: 0 };
const seen = new Set();
const kept = [];
for (const c of all) {
  const b = (c.body || '').trim();
  if (BOT.test(c.author)) { dropped.bot++; continue; }
  if (c.author === c.prAuthor) { dropped.self++; continue; }      // author replying on their own PR is not feedback
  if (EMOJI.test(b)) { dropped.ack++; continue; }
  if (ACK.test(norm(b))) { dropped.ack++; continue; }
  const sub = substance(b);
  const hasCode = /```/.test(b);
  if (!sub && !hasCode) { dropped.empty++; continue; }
  if (sub.split(' ').filter(Boolean).length < 3 && !hasCode) { dropped.tooShort++; continue; }
  const key = c.pr + '|' + norm(b);                                // same text twice on the SAME PR is a dupe;
  if (seen.has(key)) { dropped.dupInPr++; continue; }              // the same point across PRs is the recurrence signal
  seen.add(key);
  kept.push({ ...c, sub });
}
fs.writeFileSync(path.join(OUT, 'kept.json'), JSON.stringify(kept));

// ---------------------------------------------------------------- chunk
for (const f of fs.readdirSync(CHUNKDIR)) fs.unlinkSync(path.join(CHUNKDIR, f));
kept.sort((a, b) => a.pr - b.pr);
const per = Math.ceil(kept.length / CHUNKS) || 1;
let written = 0;
for (let i = 0; i < CHUNKS; i++) {
  const part = kept.slice(i * per, (i + 1) * per);
  if (!part.length) continue;
  const body = part.map((c, j) => {
    let b = (c.body || '').replace(/\r/g, '').trim();
    if (b.length > 1200) b = b.slice(0, 1200) + ' …[truncated]';
    const loc = c.path ? ` | file: ${c.path}${c.line ? ':' + c.line : ''}` : '';
    return `### [${i + 1}.${j + 1}] PR #${c.pr} — "${c.title}"\n- reviewer: ${c.author} -> author: ${c.prAuthor}\n- kind: ${c.kind}${loc}\n- merged: ${(c.mergedAt || '').slice(0, 10)}\n\n${b}\n`;
  }).join('\n---\n\n');
  fs.writeFileSync(path.join(CHUNKDIR, `chunk_${i + 1}.md`), `# Review comment chunk ${i + 1}/${CHUNKS} (${part.length} comments)\n\n${body}`);
  written++;
}

// ---------------------------------------------------------------- stats
const prNums = Object.keys(corpus).map(Number);
const dates = kept.map(k => k.mergedAt).filter(Boolean).sort();
const stats = {
  owner: OWNER,
  repo: REPO,
  runAt: new Date().toISOString(),          // the watermark the NEXT incremental run resumes from
  incremental,
  since: SINCE || null,
  prsScanned: prNums.length,                // whole corpus, not just this fetch
  prsFetchedThisRun: fetched,
  commentsWithBody: all.length,
  keptActionableCandidates: kept.length,
  prsWithKeptComments: new Set(kept.map(k => k.pr)).size,
  prAuthors: new Set(kept.map(k => k.prAuthor)).size,
  reviewers: new Set(kept.map(k => k.author)).size,
  dropped,
  firstMerged: dates[0] ? dates[0].slice(0, 10) : null,
  lastMerged: dates[dates.length - 1] ? dates[dates.length - 1].slice(0, 10) : null,
  maxPr: prNums.length ? Math.max(...prNums) : 0,
  truncatedRefetched: [...capped],
  chunks: written,
  chunkDir: CHUNKDIR,
  // actionable / actionablePrs are filled in after classification (Step 4); render.js requires them
};
fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify(stats, null, 1), 'utf8');

console.error('');
console.error(`  PRs in corpus          ${stats.prsScanned}${incremental ? `  (${fetched} fetched this run)` : ''}`);
console.error(`  comments with a body   ${stats.commentsWithBody}`);
console.error(`  kept for analysis      ${stats.keptActionableCandidates}  (across ${stats.prsWithKeptComments} PRs, ${stats.prAuthors} PR authors)`);
console.error(`  dropped                bot ${dropped.bot} | self ${dropped.self} | ack ${dropped.ack} | empty ${dropped.empty} | short ${dropped.tooShort} | dupe ${dropped.dupInPr}`);
console.error(`  chunks written         ${written} -> ${CHUNKDIR}`);
console.error(`  NEXT: after classification, write actionable + actionablePrs into ${path.join(OUT, 'stats.json')}`);
console.log(JSON.stringify(stats));
