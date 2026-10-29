// PreToolUse hook: enforce the CLAUDE.md git and gh rules in every permission mode, including bypass.
const path = require('path');

const SHELL_TOOLS = ['Bash', 'PowerShell'];
const CD_PROGRAMS = ['cd', 'chdir', 'pushd', 'set-location', 'sl'];
const ALLOWED_SUBCOMMANDS = new Set([
  'status', 'diff', 'log', 'show', 'blame', 'grep', 'shortlog', 'describe', 'rev-parse', 'rev-list', 'merge-base',
  'ls-files', 'ls-tree', 'ls-remote', 'cat-file', 'show-ref', 'for-each-ref', 'name-rev', 'check-ignore',
  'count-objects', 'range-diff', 'cherry', 'show-branch', 'whatchanged', 'diff-tree', 'diff-index', 'diff-files',
  'check-attr', 'var', 'help', 'version', 'fetch', 'pull'
]);
const BRANCH_LIST_FLAGS = ['-a', '-r', '-v', '-vv', '-l', '--list', '--all', '--remotes', '--show-current'];
const SWITCH_RISKY_FLAGS = ['-C', '--force-create', '-f', '--force', '--discard-changes', '--orphan', '-m', '--merge'];
const CONFIG_SCOPE_FLAGS = ['--global', '--system', '--local', '--worktree'];
const CONFIG_READ_FORMS = ['--get', '--get-all', '--list', '-l', 'get', 'list'];
const ALLOWED_FORMS = {
  stash: rest => rest[0] === 'list' || rest[0] === 'show',
  branch: rest => rest.every(arg => BRANCH_LIST_FLAGS.includes(arg)),
  tag: rest => rest.length === 0 || rest[0] === '-l' || rest[0] === '--list',
  remote: rest => rest.length === 0 || (rest.length === 1 && rest[0] === '-v') || rest[0] === 'show' || rest[0] === 'get-url',
  // A lone key (`git config core.autocrlf`) reads it like --get; a key plus a value writes.
  config: rest => {
    const args = rest.filter(arg => !CONFIG_SCOPE_FLAGS.includes(arg));
    return CONFIG_READ_FORMS.includes(args[0]) || (args.length === 1 && !args[0].startsWith('-'));
  },
  worktree: rest => rest[0] === 'list',
  reflog: rest => rest.length === 0 || rest[0] === 'show',
  switch: rest => !rest.some(arg => SWITCH_RISKY_FLAGS.includes(arg)),
  checkout: rest => rest[0] === '-b' && rest.length >= 2 && rest.length <= 3 && !rest.slice(1).some(arg => arg.startsWith('-'))
};
const INDEX_SUBCOMMANDS = new Set(['add', 'stage', 'stash', 'rm', 'mv', 'update-index', 'read-tree']);
const INDEX_FORMS = {
  restore: rest => rest.includes('--staged') || rest.includes('-S'),
  checkout: rest => rest.includes('--'),
  apply: rest => rest.includes('--cached') || rest.includes('--index'),
  // Without a mode flag reset is --mixed, which rewrites the index.
  reset: rest => !rest.some(arg => ['--hard', '--soft', '--keep'].includes(arg))
};
const GH_READ_ACTIONS = ['view', 'list', 'diff', 'checks', 'status'];
const GH_API_WRITE_FLAGS = ['-X', '--method', '-f', '-F', '--field', '--raw-field', '--input'];

let raw = '';
process.stdin.on('data', chunk => (raw += chunk));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw || '{}');
  } catch {
    return;
  }
  const verdict = decide(input);
  if (verdict) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: verdict.decision, permissionDecisionReason: verdict.reason }
    }));
  }
});

function decide(input) {
  if (!SHELL_TOOLS.includes(input.tool_name)) {
    return null;
  }
  // Quotes become spaces so `bash -c "git add ."` and `git -C "dir" add` still read as git commands.
  const pieces = String(input.tool_input?.command || '').replace(/["']/g, ' ').split(/[;&|(){}`\r\n]/);
  let dir = input.cwd || process.cwd();
  let firstAsk = null;
  for (const piece of pieces) {
    const words = piece.trim().split(/\s+/);
    if (CD_PROGRAMS.includes(words[0].toLowerCase())) {
      if (words[1]) {
        dir = path.resolve(dir, words[1]);
      }
      continue;
    }
    const at = words.findIndex(word => word === 'git' || word === 'gh');
    if (at === -1) {
      continue;
    }
    const args = words.slice(at + 1);
    const verdict = words[at] === 'gh' ? ghVerdict(args) : gitVerdict(args, dir);
    if (verdict?.decision === 'deny') {
      return verdict;
    }
    firstAsk ??= verdict;
  }
  return firstAsk;
}

function gitVerdict(args, cwd) {
  let dir = cwd;
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) {
    if (args[i] === '-C' && args[i + 1]) {
      dir = path.resolve(dir, args[i + 1]);
    }
    i += args[i] === '-C' || args[i] === '-c' ? 2 : 1;
  }
  const subcommand = args[i];
  const rest = args.slice(i + 1);
  const shown = ['git', ...args].join(' ');
  if (subcommand === undefined || isBookkeepingRepo(dir) || ALLOWED_SUBCOMMANDS.has(subcommand)) {
    return null;
  }
  if (Object.hasOwn(ALLOWED_FORMS, subcommand) && ALLOWED_FORMS[subcommand](rest)) {
    return null;
  }
  if (INDEX_SUBCOMMANDS.has(subcommand) || (Object.hasOwn(INDEX_FORMS, subcommand) && INDEX_FORMS[subcommand](rest))) {
    return { decision: 'deny', reason: `CLAUDE.md: the git index is the user's alone. Do not stage, unstage or stash; tell the user to run: ${shown}` };
  }
  if (subcommand === 'commit') {
    return { decision: 'deny', reason: 'CLAUDE.md: never commit in a project repo. Show the diff and give the user the one-line commit message.' };
  }
  return { decision: 'ask', reason: `Git command that changes repository state: ${shown}` };
}

function ghVerdict(args) {
  const [group, action] = args;
  if (group === undefined || ['--version', 'version', '--help', 'help', 'search'].includes(group)) {
    return null;
  }
  if (group === 'api' && !args.some(arg => GH_API_WRITE_FLAGS.some(flag => arg.startsWith(flag)))) {
    return null;
  }
  if (group !== 'api' && GH_READ_ACTIONS.includes(action)) {
    return null;
  }
  return { decision: 'deny', reason: `CLAUDE.md: gh is read-only. Draft the text and give the user this command to run: gh ${args.join(' ')}` };
}

function isBookkeepingRepo(dir) {
  const normalized = dir.split('\\').join('/').toLowerCase();
  return (normalized.includes('/.claude/projects/') && normalized.includes('/memory')) || normalized.includes('pickers-training');
}
