// PreToolUse hook: enforce the CLAUDE.md git and gh rules in every permission mode, including bypass.
const os = require('os');
const path = require('path');
const { parseSegments, parseGitInvocation, isGitCommandReadOnly, isGhCommandReadOnly, readHookInput } = require('./shell-tokens');

const INDEX_SUBCOMMANDS = new Set(['add', 'stage', 'stash', 'rm', 'mv', 'update-index', 'read-tree']);
const BOOKKEEPING_ALLOWED = new Set(['add', 'stage', 'commit']);
const RESET_MODES = new Set(['--hard', '--soft', '--mixed', '--keep', '--merge']);
const CD_PROGRAMS = new Set(['cd', 'chdir', 'pushd', 'set-location', 'sl']);
const DECISION_RANK = { ask: 1, deny: 2 };
const ALLOWED_REMOTE_SYNC = new Set(['fetch', 'pull']);

if (require.main === module) {
  readHookInput(input => {
    const verdict = decide(input);
    if (!verdict) {
      return null;
    }
    return {
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: verdict.decision, permissionDecisionReason: verdict.reason }
    };
  });
}

function decide(input) {
  if (input.tool_name !== 'Bash' && input.tool_name !== 'PowerShell') {
    return null;
  }
  const command = String((input.tool_input && input.tool_input.command) || '');
  let cwd = input.cwd || process.cwd();
  let strongest = null;
  for (const segment of parseSegments(command)) {
    if (segment.kind !== 'command') {
      continue;
    }
    if (CD_PROGRAMS.has(segment.program)) {
      const target = segment.args.find(arg => !arg.startsWith('-'));
      cwd = target === undefined ? os.homedir() : resolveShellPath(cwd, target);
      continue;
    }
    const verdict = segmentVerdict(segment, cwd);
    if (verdict && (!strongest || DECISION_RANK[verdict.decision] > DECISION_RANK[strongest.decision])) {
      strongest = verdict;
    }
  }
  return strongest;
}

function segmentVerdict(segment, cwd) {
  const shown = [segment.program, ...segment.args].join(' ');
  if (segment.program === 'gh') {
    if (isGhCommandReadOnly(segment.args)) {
      return null;
    }
    return { decision: 'deny', reason: `CLAUDE.md: gh is read-only. Draft the text and give the user this command to run: ${shown}` };
  }
  if (segment.program !== 'git') {
    return null;
  }
  const invocation = parseGitInvocation(segment.args);
  if (invocation.subcommand === null || ALLOWED_REMOTE_SYNC.has(invocation.subcommand) || isGitCommandReadOnly(segment.args)) {
    return null;
  }
  const effect = gitEffect(invocation);
  if (isBookkeepingRepo(targetDirectory(cwd, invocation))) {
    return BOOKKEEPING_ALLOWED.has(invocation.subcommand) ? null : { decision: 'ask', reason: `Git command that changes a memory repo: ${shown}` };
  }
  if (effect === 'index') {
    return { decision: 'deny', reason: `CLAUDE.md: the git index is the user's alone. Do not stage, unstage or stash; tell the user to run: ${shown}` };
  }
  if (effect === 'commit') {
    return { decision: 'deny', reason: 'CLAUDE.md: never commit in a project repo. Show the diff and give the user the one-line commit message.' };
  }
  return { decision: 'ask', reason: `Git command that changes repository state: ${shown}` };
}

function gitEffect({ subcommand, rest }) {
  if (INDEX_SUBCOMMANDS.has(subcommand)) {
    return 'index';
  }
  if (subcommand === 'commit') {
    return 'commit';
  }
  if (subcommand === 'reset') {
    return rest.some(arg => RESET_MODES.has(arg)) ? 'state' : 'index';
  }
  if (subcommand === 'restore') {
    return rest.some(arg => arg === '--staged' || /^-[A-Za-z]*S/.test(arg)) ? 'index' : 'state';
  }
  if (subcommand === 'checkout') {
    return rest.some(arg => arg === '--' || arg === '-p' || arg === '--patch') ? 'index' : 'state';
  }
  if (subcommand === 'apply') {
    return rest.some(arg => arg === '--cached' || arg === '--index') ? 'index' : 'state';
  }
  return 'state';
}

function targetDirectory(cwd, invocation) {
  const base = invocation.chdirs.reduce(resolveShellPath, cwd);
  if (invocation.workTree) {
    return resolveShellPath(base, invocation.workTree);
  }
  if (invocation.gitDir) {
    return path.dirname(resolveShellPath(base, invocation.gitDir));
  }
  return base;
}

function resolveShellPath(base, target) {
  const home = os.homedir();
  let expanded = target
    .replace(/^~(?=$|[\\/])/, home)
    .replace(/^(\$HOME|\$\{HOME\}|\$env:HOME|\$env:USERPROFILE|%USERPROFILE%)(?=$|[\\/])/i, home);
  if (process.platform === 'win32') {
    expanded = expanded.replace(/^\/([a-zA-Z])(?=$|\/)/, '$1:');
  }
  return path.resolve(base, expanded);
}

function isBookkeepingRepo(dir) {
  const parts = normalizedParts(dir);
  const projects = normalizedParts(path.join(os.homedir(), '.claude', 'projects'));
  if (projects.every((part, i) => parts[i] === part) && parts[projects.length + 1] === 'memory') {
    return true;
  }
  return parts.includes('pickers-training');
}

function normalizedParts(dir) {
  const resolved = path.resolve(dir).replace(/\\/g, '/');
  return (process.platform === 'win32' ? resolved.toLowerCase() : resolved).split('/').filter(Boolean);
}

module.exports = { decide };
