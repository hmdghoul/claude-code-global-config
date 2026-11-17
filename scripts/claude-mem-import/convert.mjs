// Converter: Claude Code native memory -> claude-mem /api/import JSON (writes files only).
// Reads ~/.claude/projects/*/memory/*.md, writes one import file per project into <outDir>.
// Only memories with a record in verify/<project>.json are exported (see importDecision).
// Usage: node convert.mjs <outDir> [batchLabel]
// Import a file:  POST its {sessions, observations} to http://127.0.0.1:37777/api/import
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const OUT = process.argv[2];
// Batch label goes into the synthetic session id. claude-mem 15.x tombstones deleted
// sessions and refuses to re-import them, so a redo after a delete needs a new label.
const BATCH = process.argv[3] || 'b1';
// Third argument "feedback" exports only feedback memories, which the default run skips.
const FEEDBACK_ONLY = process.argv[4] === 'feedback';
if (!OUT) { console.error('usage: node convert.mjs <outDir> [batchLabel]'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const ROOT = path.join(os.homedir(), '.claude', 'projects');
const LIMIT = 8000; // max narrative chars per observation

// Claude Code names a project's memory folder after its path, with every
// non-alphanumeric character replaced by '-' (C:\Users\me\.claude -> C--Users-me--claude).
const memoryFolderFor = relPath => path.join(os.homedir(), relPath).replace(/[^A-Za-z0-9]/g, '-');

// Project path relative to the home dir -> claude-mem project (its git repo root basename).
const PROJECT_PATHS = {
  '.claude': '.claude',
  // Memory folder predates the move to source/repos/apps/athan-times-app; claude-mem names it by repo root.
  'source/repos/AthanTimesApp': 'athan-times-app',
  'source/repos/ananinja/employee-wallet-service': 'employee-wallet-service',
  'source/repos/ananinja/employees-service': 'employees-service',
  'source/repos/ananinja/gha-workflows': 'gha-workflows',
  'source/repos/ananinja/iot-service': 'iot-service',
  'source/repos/ananinja/kafka-config': 'kafka-config',
  'source/repos/ananinja/master-service': 'master-service',
  'source/repos/ananinja/orders-service': 'orders-service',
  'source/repos/ananinja/parcels-service': 'parcels-service',
  'source/repos/ananinja/pickers-service': 'pickers-service',
  'source/repos/ananinja/users-service': 'users-service',
  'source/repos/ananinja/whm-app': 'whm-app',
  'source/repos/apps/lessonhub-api': 'lessonhub-api',
  'source/repos/apps/remote-pay-tracker-app': 'remote-pay-tracker-app',
  'source/repos/hmdghoul': 'hmdghoul',
  'source/repos/raghadalsaka/firstmic': 'firstmic',
  'source/repos/raghadalsaka/questrush': 'questrush',
  'source/repos/raghadalsaka/quizrush': 'quizrush',
  'source/repos/raghadalsaka/raghadalsaka.github.io': 'raghadalsaka.github.io',
  'source/repos/rawanalsaka': 'rawanalsaka',
  'source/repos/timetable': 'timetable',
};
const PROJECTS = Object.fromEntries(
  Object.entries(PROJECT_PATHS).map(([rel, project]) => [memoryFolderFor(rel), project]));

function parseFrontmatter(raw) {
  const m = raw.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Za-z_]+):\s*(.*)$/);
    if (kv && kv[2] !== '') fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return { fm, body: m[2].replace(/\r\n/g, '\n').trim() };
}

function firstAddedEpoch(dir, file) {
  try {
    const out = execFileSync('git', ['-C', dir, 'log', '--diff-filter=A', '--follow', '--format=%aI', '--', file],
      { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    if (out.length) return Date.parse(out[out.length - 1]);
  } catch { /* fall through */ }
  return Math.floor(fs.statSync(path.join(dir, file)).mtimeMs);
}

// Split text into blocks at lines matching re, ignoring lines inside code fences.
function splitAt(text, re) {
  const blocks = []; let cur = []; let fence = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence && re.test(line) && cur.length) { blocks.push(cur.join('\n')); cur = []; }
    cur.push(line);
  }
  if (cur.length) blocks.push(cur.join('\n'));
  return blocks.map(b => b.trim()).filter(Boolean);
}

function splitLongLine(line) { // a single line over LIMIT: break at sentence ends, then by chars
  if (line.length <= LIMIT) return [line];
  const sentences = line.match(/[^.;]+[.;]+\s*|[^.;]+$/g) || [line];
  const out = []; let cur = '';
  for (const s of sentences.flatMap(x => (x.length > LIMIT ? x.match(new RegExp(`[\\s\\S]{1,${LIMIT}}`, 'g')) : [x]))) {
    if (cur && cur.length + s.length > LIMIT) { out.push(cur.trimEnd()); cur = ''; }
    cur += s;
  }
  if (cur) out.push(cur.trimEnd());
  return out;
}

function hardSplit(text) { // last resort: by lines
  const out = []; let cur = '';
  for (const line of text.split('\n').flatMap(splitLongLine)) {
    if (cur && cur.length + line.length + 1 > LIMIT) { out.push(cur); cur = ''; }
    cur += (cur ? '\n' : '') + line;
  }
  if (cur) out.push(cur);
  return out;
}

function pieces(text, level) {
  if (text.length <= LIMIT) return [text];
  const splitters = [/^## /, /^### /, /^#### /];
  if (level < splitters.length) {
    const blocks = splitAt(text, splitters[level]);
    if (blocks.length > 1) return blocks.flatMap(b => pieces(b, level + 1));
    return pieces(text, level + 1);
  }
  const paras = splitAt(text, /^\s*$/);
  if (paras.length > 1) return paras.flatMap(p => (p.length > LIMIT ? hardSplit(p) : [p]));
  return hardSplit(text);
}

function pack(blocks) { // greedily merge small neighbours up to LIMIT
  const out = [];
  for (const b of blocks) {
    if (out.length && out[out.length - 1].length + b.length + 2 <= LIMIT) out[out.length - 1] += '\n\n' + b;
    else out.push(b);
  }
  return out;
}

function headingOf(chunk) {
  const h = chunk.split('\n').find(l => /^#{1,4} /.test(l));
  if (h) return h.replace(/^#+\s*/, '').slice(0, 80);
  const bold = chunk.trimStart().match(/^(?:[-*]\s+)?\*\*([^*]{3,})\*\*/); // bold-led paragraph style
  return bold ? bold[1].replace(/[:\s]+$/, '').slice(0, 80) : null;
}

// Short, human-written titles keyed by "<project>/<file>"; anything missing falls back to
// a trimmed description (reported in _report.json as titleFallback).
const TITLES_PATH = path.join(SCRIPT_DIR, 'titles.json');
const TITLES = fs.existsSync(TITLES_PATH) ? JSON.parse(fs.readFileSync(TITLES_PATH, 'utf8')) : {};
const TITLE_MAX = 70;

function fallbackTitle(description, name) {
  if (!description) return name;
  let t = description
    .replace(/^(DECISION|INCIDENT|UPDATE|NOTE|REFERENCE)\b[^:]*:\s*/i, '') // leading tag + date
    .split(/\s+[-–—]\s+|;\s|\.\s/)[0]                       // first clause
    .replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length > TITLE_MAX) t = t.slice(0, TITLE_MAX).replace(/\s+\S*$/, '') + '...';
  return t || name;
}

// Verification results (verify/<project>.json) gate the import:
//   verified / unverifiable -> import; partly-stale -> import only once fixed and re-verified;
//   stale -> skip; no verification record -> skip (never import unverified memory).
const VERIFY_DIR = path.join(SCRIPT_DIR, 'verify');
function loadVerification(project) {
  const f = path.join(VERIFY_DIR, `${project}.json`);
  if (!fs.existsSync(f)) return null;
  const v = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
  return new Map(v.memories.map(m => [m.file, m]));
}
function importDecision(rec) {
  if (!rec) return { ok: false, reason: 'unverified' };
  if (rec.verdict === 'verified') return { ok: true, state: 'verified' };
  if (rec.verdict === 'unverifiable') return { ok: true, state: 'unverifiable' };
  if (rec.verdict === 'partly-stale') {
    if (rec.fixed && rec.verdict_after === 'verified') return { ok: true, state: 'fixed' };
    // Every code-checkable claim fixed; what is left lives only in external systems
    // (Grafana, Jira), which the import policy treats like "unverifiable".
    if (rec.fixed && rec.remaining_external_only) return { ok: true, state: 'fixed-external-unchecked' };
    return { ok: false, reason: 'partly-stale-unfixed' };
  }
  return { ok: false, reason: rec.verdict }; // stale or anything unexpected
}

const DECISION_RE = /\b(decision|decided|rejected|design|convention|plan|adr|approach|policy)\b/i;

const report = { generatedAt: new Date().toISOString(), limit: LIMIT, projects: {}, skipped: [], totals: {} };
const tot = { files: 0, observations: 0, split: 0, feedbackKept: 0, bytes: 0 };

for (const folder of fs.readdirSync(ROOT).sort()) {
  const dir = path.join(ROOT, folder, 'memory');
  if (!fs.existsSync(dir)) continue;
  const project = PROJECTS[folder];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md').sort();
  if (!project) { report.skipped.push({ folder, reason: 'no project mapping', files: files.length }); continue; }
  if (!files.length) { report.skipped.push({ folder, reason: 'no memory files' }); continue; }

  const sessionId = `native-memory-import-${project}-${BATCH}`;
  const observations = [];
  const pr = { project, files: 0, observations: 0, feedbackKept: [], split: [], types: {}, excluded: [], states: {} };
  const verification = loadVerification(project);

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const parsed = parseFrontmatter(raw);
    if (!parsed) { report.skipped.push({ folder, file, reason: 'no frontmatter' }); continue; }
    const { fm, body } = parsed;
    const memType = fm.type || 'unknown';
    if (FEEDBACK_ONLY && memType !== 'feedback') { continue; }
    if (memType === 'feedback' && !FEEDBACK_ONLY) { pr.feedbackKept.push(file); tot.feedbackKept++; continue; }

    const name = fm.name || file.replace(/\.md$/, '');
    const description = fm.description || null;
    const obsType = memType === 'project' && DECISION_RE.test(`${name} ${description || ''}`) ? 'decision' : 'discovery';
    const links = [...new Set([...body.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1].trim()))];
    const epoch = firstAddedEpoch(dir, file);
    const source = `~/.claude/projects/${folder}/memory/${file}`;

    const rec = verification ? verification.get(file) : null;
    const decision = importDecision(rec);
    if (!decision.ok) { pr.excluded.push({ file, reason: decision.reason }); continue; }
    pr.states[decision.state] = (pr.states[decision.state] || 0) + 1;

    const titleKey = `${project}/${file}`;
    const shortTitle = (rec && rec.title) || TITLES[titleKey] || fallbackTitle(description, name);
    if (!(rec && rec.title) && !TITLES[titleKey]) (pr.titleFallback ||= []).push(file);

    const chunks = body.length <= LIMIT ? [body] : pack(pieces(body, 0));
    if (chunks.length > 1) pr.split.push({ file, bytes: body.length, parts: chunks.length });

    chunks.forEach((chunk, i) => {
      const multi = chunks.length > 1;
      const h = multi ? headingOf(chunk) : null;
      const title = multi ? `${shortTitle} (${i + 1}/${chunks.length})${h ? `: ${h.slice(0, 50)}` : ''}` : shortTitle;
      const narrative = multi ? `[Part ${i + 1} of ${chunks.length} of memory "${shortTitle}" (${name})]\n\n${chunk}` : chunk;
      const createdEpoch = epoch + i; // keeps parts ordered and dedup keys unique
      observations.push({
        memory_session_id: sessionId,
        project,
        text: null,
        type: obsType,
        title,
        subtitle: description,
        facts: JSON.stringify([]),
        narrative,
        // The first concept must be one of the active mode's concepts (plugin/modes/code.json),
        // otherwise session-start context ignores the observation.
        concepts: JSON.stringify([obsType === 'decision' ? 'why-it-exists' : 'how-it-works',
          'native-memory', `memory-type:${memType}`, `verification:${decision.state}`, ...links.map(l => `link:${l}`)]),
        files_read: JSON.stringify([source]),
        files_modified: JSON.stringify([]),
        prompt_number: null,
        discovery_tokens: 0,
        created_at: new Date(createdEpoch).toISOString(),
        created_at_epoch: createdEpoch,
      });
      pr.types[obsType] = (pr.types[obsType] || 0) + 1;
      tot.bytes += narrative.length;
    });
    pr.files++; tot.files++;
    if (chunks.length > 1) tot.split++;
  }

  if (!observations.length) {
    report.skipped.push({ folder, project, reason: 'nothing importable', feedbackKept: pr.feedbackKept.length, excluded: pr.excluded });
    continue;
  }
  const startEpoch = Math.min(...observations.map(o => o.created_at_epoch));
  const endEpoch = Math.max(...observations.map(o => o.created_at_epoch));
  const session = {
    content_session_id: sessionId,
    memory_session_id: sessionId,
    project,
    platform_source: 'claude',
    user_prompt: 'Imported from Claude Code native memory (~/.claude/projects/*/memory)',
    started_at: new Date(startEpoch).toISOString(),
    started_at_epoch: startEpoch,
    completed_at: new Date(endEpoch).toISOString(),
    completed_at_epoch: endEpoch,
    status: 'completed',
  };
  const exportData = {
    exportedAt: new Date().toISOString(),
    query: `native-memory:${project}`,
    totalObservations: observations.length, totalSessions: 1, totalSummaries: 0, totalPrompts: 0,
    sessions: [session], summaries: [], observations, prompts: [],
  };
  fs.writeFileSync(path.join(OUT, `${project}.json`), JSON.stringify(exportData, null, 2), 'utf8');
  pr.observations = observations.length; tot.observations += observations.length;
  report.projects[project] = pr;
}

report.totals = tot;
fs.writeFileSync(path.join(OUT, '_report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(tot));
